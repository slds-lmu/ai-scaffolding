#!/usr/bin/env bash
# Print the agy label of the strongest Gemini model currently available,
# optionally at a requested reasoning effort.
#
# Google's labels change often (e.g. "Gemini 3.1 Pro (High)" disappeared in
# Oct 2026), so callers should not hardcode one. Ranking: highest major version,
# then tier (Ultra > Pro > Flash > Flash-Lite/other), then highest minor version,
# then effort (High > Medium > Low). So a 3.x Pro beats a 3.y Flash, but any 4.x
# beats any 3.x. Falls back to FALLBACK if `agy models` fails or lists no Gemini.
#
# Effort is encoded in the label ("(High)", "(Medium)", "(Low)"). With an EFFORT
# argument the script keeps the strongest model FAMILY and picks that family's
# variant at the requested effort; xhigh/max map to high (the highest label agy
# offers). If the family has no variant at that effort, it prints the family's best.
#
# Usage: bash pick-gemini-model.sh [low|medium|high|xhigh|max]
#        -> e.g. "Gemini 4 Argon (Medium)"

FALLBACK="Gemini 3.8 Flash (High)"

want="$(printf '%s' "${1:-high}" | tr '[:upper:]' '[:lower:]')"
case "$want" in
  low) want_n=0 ;;
  medium) want_n=1 ;;
  high | xhigh | max) want_n=2 ;;
  *)
    echo "pick-gemini-model.sh: unknown effort '$1' (low|medium|high|xhigh|max)" >&2
    exit 2
    ;;
esac

ranked=$(
  agy models 2>/dev/null | awk -F'\t' '
    tolower($2) ~ /^gemini/ {
      label = $2
      major = 0; minor = 0
      if (match(label, /[0-9]+(\.[0-9]+)?/)) {
        split(substr(label, RSTART, RLENGTH), v, ".")
        major = v[1] + 0; minor = (v[2] == "" ? 0 : v[2] + 0)
      }
      l = tolower(label)
      tier = 0
      if (l ~ /ultra/) tier = 3
      else if (l ~ /pro/) tier = 2
      else if (l ~ /flash/ && l !~ /lite/) tier = 1
      effort = 0
      if (l ~ /\(high\)/) effort = 2
      else if (l ~ /\(medium\)/) effort = 1
      printf "%05d %d %05d\t%d\t%s\n", major, tier, minor, effort, label
    }' | sort -r
)

if [ -z "$ranked" ]; then
  echo "$FALLBACK"
  exit 0
fi

# Strongest family = family key of the top-ranked line.
family=$(printf '%s\n' "$ranked" | head -n 1 | cut -f1)
best=$(printf '%s\n' "$ranked" |
  awk -F'\t' -v fam="$family" -v want="$want_n" '$1 == fam && $2 == want { print $3; exit }')
if [ -z "$best" ]; then
  best=$(printf '%s\n' "$ranked" | head -n 1 | cut -f3)
fi

echo "$best"
