#!/usr/bin/env bash
# Print the agy label of the strongest Gemini model currently available,
# optionally at a requested reasoning effort.
#
# Google's labels change often (e.g. "Gemini 3.1 Pro (High)" disappeared in
# Oct 2026), so callers should not hardcode one. Ranking: highest major version,
# then tier (Ultra > Pro or codename > Flash > Flash-Lite), then highest minor version,
# then RANK2 order among same-version Pro/codename families (remaining ties: reverse
# name order, C locale). So a 3.x Pro beats a 3.y Flash, a 4.5 Pro beats any 4.0
# codename, and any 4.x beats any 3.x. Falls back to FALLBACK if `agy models` fails or
# lists no Gemini.
#
# Effort is encoded in the label ("(Max)", "(XHigh)", "(High)", "(Medium)", "(Low)";
# any other suffix counts as Low and warns). The script keeps the strongest model
# FAMILY (the label without its effort) and picks that family's variant at the
# requested EFFORT (default high). If the family has no such variant, it takes the
# nearest effort, the higher one on a tie (xhigh on Argon -> High; max on Neon ->
# XHigh; low on a family with only High/XHigh -> High).
#
# EXCLUDE (optional, "|"-separated exact family names, i.e. labels without the effort,
# such as "Gemini 4 Argon|Gemini 3.8 Flash") skips families, e.g. those whose quota is
# exhausted. With EXCLUDE set, an empty result prints nothing and exits 1
# rather than falling back, so a caller's retry loop terminates.
#
# MATCH (optional, case-insensitive text in the label, e.g. "flash" or "argon") restricts
# the choice to matching models and also exits 1 with no output if none match.
#
# Usage: bash pick-gemini-model.sh [low|medium|high|xhigh|max] [EXCLUDE] [MATCH]
#        -> e.g. "Gemini 4 Argon (Medium)"

FALLBACK="Gemini 3.8 Flash (High)"
# Same-version Pro/codename families carry no rank in their labels, so list them
# strongest first; "*" marks where unlisted codenames go (they also trigger a warning
# on stderr, so a new family gets ranked here deliberately). Codename order follows
# Google's model docs (checked 2026-11-23): Carbon "our strongest reasoning model";
# Neon (GA 2026-11-18, priciest) "frontier-level intelligence with fast end-to-end task
# completion"; Argon "efficient ... frontier reasoning model"; Hydrogen "speed and
# efficiency for everyday coding". Neon above Argon rests on recency and price, not on
# a stated comparison.
RANK2="carbon neon argon pro * hydrogen"
want="$(printf '%s' "${1:-high}" | tr '[:upper:]' '[:lower:]')"
exclude="${2:-}"
match="${3:-}"
case "$want" in
  low) want_n=0 ;;
  medium) want_n=1 ;;
  high) want_n=2 ;;
  xhigh) want_n=3 ;;
  max) want_n=4 ;;
  *)
    echo "pick-gemini-model.sh: unknown effort '$1' (low|medium|high|xhigh|max)" >&2
    exit 2
    ;;
esac

ranked=$(
  agy models 2>/dev/null | awk -F'\t' -v rank2="$RANK2" '
    BEGIN {
      nr = split(rank2, rk, " ")
      for (i = 1; i <= nr; i++) if (rk[i] == "*") star = nr + 1 - i
      if (!star) { print "pick-gemini-model.sh: RANK2 lacks a \"*\" slot" > "/dev/stderr"; exit 2 }
    }
    { sub(/\r$/, "", $2) }
    tolower($2) ~ /^gemini/ {
      label = $2
      major = 0; minor = 0
      if (match(label, /[0-9]+(\.[0-9]+)?/)) {
        split(substr(label, RSTART, RLENGTH), v, ".")
        major = v[1] + 0; minor = (v[2] == "" ? 0 : v[2] + 0)
      }
      l = tolower(label)
      fam = label; sub(/ \([^)]*\)$/, "", fam)
      # Tier and rank describe the family, so match whole words of the label minus its effort.
      w = tolower(fam); gsub(/[^a-z0-9]+/, " ", w); w = " " w " "
      tier = 0; r = 0
      if (index(w, " ultra ")) tier = 3
      else if (index(w, " lite ")) tier = 0
      else if (index(w, " flash ")) tier = 1
      else {
        tier = 2  # Pro or a codename such as Argon: must not lose to a same-version Flash
        for (i = 1; i <= nr; i++) {
          if (rk[i] != "*" && index(w, " " rk[i] " ")) { r = nr + 1 - i; break }
        }
        if (r == 0) {
          r = star
          if (!(fam in warned)) {
            warned[fam] = 1
            print "pick-gemini-model.sh: unranked Gemini family \"" fam "\"; add it to RANK2" > "/dev/stderr"
          }
        }
      }
      effort = 0
      if (l ~ /\(max\)$/) effort = 4
      else if (l ~ /\(xhigh\)$/) effort = 3
      else if (l ~ /\(high\)$/) effort = 2
      else if (l ~ /\(medium\)$/) effort = 1
      else if (l ~ /\([^)]*\)$/ && l !~ /\(low\)$/)
        print "pick-gemini-model.sh: unknown effort in \"" label "\", treated as Low" > "/dev/stderr"
      printf "%05d %d %05d %02d %d\t%s\t%s\n", major, tier, minor, r, effort, fam, label
    }' | LC_ALL=C sort -r
)

if [ -n "$match" ]; then
  ranked=$(printf '%s\n' "$ranked" | awk -F'\t' -v m="$match" 'index(tolower($3), tolower(m))')
  [ -n "$ranked" ] || exit 1
fi

if [ -n "$exclude" ]; then
  ranked=$(printf '%s\n' "$ranked" | awk -F'\t' -v ex="$exclude" '
    BEGIN { n = split(ex, e, "|"); for (i = 1; i <= n; i++) skip[e[i]] = 1 }
    !($2 in skip)')
  [ -n "$ranked" ] || exit 1
fi

if [ -z "$ranked" ]; then
  echo "$FALLBACK"
  exit 0
fi

# Strongest family = family of the top-ranked line; within it, the variant whose
# effort is nearest the request (higher effort wins a tie, since lines are sorted
# by descending effort and only a strictly smaller distance replaces the pick).
family=$(printf '%s\n' "$ranked" | head -n 1 | cut -f2)
best=$(printf '%s\n' "$ranked" | awk -F'\t' -v fam="$family" -v want="$want_n" '
  $2 == fam {
    split($1, k, " "); d = k[5] - want; if (d < 0) d = -d
    if (pick == "" || d < bd) { bd = d; pick = $3 }
  }
  END { print pick }')

echo "$best"
