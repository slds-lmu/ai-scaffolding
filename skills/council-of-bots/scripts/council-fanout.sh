#!/usr/bin/env bash
# ============================================================================
# Council of Bots - Parallel Fan-out Launcher
# ============================================================================
# Launches external council members in parallel on a shared context file.
# Codex and Gemini always run through this script.
# Claude may run either via the host adapter (Claude Code Agent) or via CLI
# when this script is called with --claude-via-cli.
#
# Usage:
#   council-fanout.sh <context-file> [--no-codex] [--no-gemini] [--no-claude]
#                    [--claude-via-cli] [--add-dir DIR]...
#                    [--codex-effort L] [--gemini-effort L] [--timeout SECONDS]
#                    [--gemini-inline FILE]... [--no-gemini-inline]
#                    [--gemini-inline-max KB]
#
# Output files are written next to the context file with the same prefix:
#   /tmp/council-abc123-context.md  →  /tmp/council-abc123-codex.txt
#                                      /tmp/council-abc123-gemini.txt
#                                      /tmp/council-abc123-claude.txt
# ============================================================================

set -uo pipefail

# The Antigravity `agy` CLI (Gemini leg) installs to ~/.local/bin, which is not
# always on PATH for non-login shells. Make sure we can find it.
export PATH="$HOME/.local/bin:$PATH"

CLAUDE_RUNNER="${CLAUDE_RUNNER:-$HOME/.claude/skills/claude-cli/scripts/claude-run.sh}"

CONTEXT_FILE="${1:?Usage: council-fanout.sh <context-file> [--no-codex] [--no-gemini]}"
shift

if [ ! -f "$CONTEXT_FILE" ]; then
  echo "ERROR: Context file not found: $CONTEXT_FILE" >&2
  exit 1
fi

# Derive output prefix from context filename
# e.g. /tmp/council-abc123-context.md → /tmp/council-abc123
PREFIX="${CONTEXT_FILE%-context.md}"
if [ "$PREFIX" = "$CONTEXT_FILE" ]; then
  PREFIX="${CONTEXT_FILE%.md}"
  PREFIX="${PREFIX%.txt}"
fi

# Parse flags
# Model for the Codex leg: COUNCIL_CODEX_MODEL, else the `model` in
# ~/.codex/config.toml (kept current by the user), else a last-known fallback.
# A hardcoded pin went stale here (gpt-5.6-terra while config had moved on).
# Effort is chosen by the CALLER per review (--codex-effort low|medium|high|xhigh).
# It must not silently inherit config.toml's model_reasoning_effort, which is tuned
# for interactive use ("low") and once produced a shallow review that never opened
# the referenced files. If the caller passes nothing, use "high".
CODEX_CONFIG_MODEL=$(sed -n 's/^model *= *"\(.*\)"/\1/p' "$HOME/.codex/config.toml" 2>/dev/null | head -n 1)
CODEX_MODEL="${COUNCIL_CODEX_MODEL:-${CODEX_CONFIG_MODEL:-gpt-6.1-sol}}"
CODEX_EFFORT="${COUNCIL_CODEX_EFFORT:-high}"
# Gemini effort, also chosen by the caller (--gemini-effort low|medium|high).
# agy encodes effort in the model label, so this selects the strongest family's
# variant at that effort (xhigh/max map to high). Default "high".
GEMINI_EFFORT="${COUNCIL_GEMINI_EFFORT:-high}"

RUN_CODEX=1
RUN_GEMINI=1
RUN_CLAUDE=1
CLAUDE_VIA_CLI=0
# Claude CLI leg (only used with --claude-via-cli, i.e. on a Codex host). Default to
# the strongest tier: a review is judgment work and the council exists to catch what
# the working model missed. Override with COUNCIL_CLAUDE_MODEL or --claude-model.
CLAUDE_MODEL="${COUNCIL_CLAUDE_MODEL:-fable}"
ADD_DIRS=()
# Gemini inlining (see the Gemini section): auto-inline text files named in the
# context, plus any --gemini-inline files, up to GEMINI_INLINE_KB in total.
GEMINI_INLINE_AUTO=1
GEMINI_INLINE=()
GEMINI_INLINE_KB=400

while [ $# -gt 0 ]; do
  case "$1" in
    --no-codex)
      RUN_CODEX=0
      shift
      ;;
    --no-gemini)
      RUN_GEMINI=0
      shift
      ;;
    --no-claude)
      RUN_CLAUDE=0
      shift
      ;;
    --claude-via-cli)
      CLAUDE_VIA_CLI=1
      shift
      ;;
    --claude-model)
      CLAUDE_MODEL="${2:?Missing value for --claude-model}"
      shift 2
      ;;
    --add-dir)
      ADD_DIRS+=("${2:?Missing value for --add-dir}")
      shift 2
      ;;
    --codex-effort)
      CODEX_EFFORT="${2:?Missing value for --codex-effort (low|medium|high|xhigh)}"
      shift 2
      ;;
    --gemini-effort)
      GEMINI_EFFORT="${2:?Missing value for --gemini-effort (low|medium|high)}"
      shift 2
      ;;
    --gemini-inline)
      GEMINI_INLINE+=("${2:?Missing value for --gemini-inline (file path)}")
      shift 2
      ;;
    --no-gemini-inline)
      GEMINI_INLINE_AUTO=0
      shift
      ;;
    --gemini-inline-max)
      GEMINI_INLINE_KB="${2:?Missing value for --gemini-inline-max (KB)}"
      shift 2
      ;;
    # (effort values are validated after parsing, before any bot launches)
    --timeout)
      # Flag rather than env var: the Bash permission rule for this launcher
      # forbids `VAR=x bash ...` prefixes. Applied after the dynamic default.
      COUNCIL_TIMEOUT="${2:?Missing value for --timeout (seconds)}"
      shift 2
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 1
      ;;
  esac
done

# Validate effort levels up front, so a typo cannot abort the run after one bot
# has already been launched in the background.
case "$CODEX_EFFORT" in
  minimal | low | medium | high | xhigh) ;;
  *) echo "ERROR: --codex-effort must be minimal|low|medium|high|xhigh, got '${CODEX_EFFORT}'" >&2; exit 1 ;;
esac
case "$(printf '%s' "$GEMINI_EFFORT" | tr '[:upper:]' '[:lower:]')" in
  low | medium | high | xhigh | max) ;;
  *) echo "ERROR: --gemini-effort must be low|medium|high (xhigh/max = high), got '${GEMINI_EFFORT}'" >&2; exit 1 ;;
esac

# Dynamic timeout: 600s base + 2s per KB of context, capped at 1200s
# Bots often need to read large files from disk (not just the context),
# so the base must be generous enough for complex reviews.
CONTEXT_BYTES=$(wc -c < "$CONTEXT_FILE")
CONTEXT_KB=$(( CONTEXT_BYTES / 1024 ))
BOT_TIMEOUT=$(( 600 + 2 * CONTEXT_KB ))
if [ "$BOT_TIMEOUT" -gt 1200 ]; then
  BOT_TIMEOUT=1200
fi
# Repo-backed reviews at high/xhigh effort routinely need 15-25 min (2026-10-16: Codex
# did 49 file/git reads and still hit 606s). Override for such reviews.
BOT_TIMEOUT="${COUNCIL_TIMEOUT:-$BOT_TIMEOUT}"

# --- Prompt construction ---
INSTRUCTIONS="You are an expert reviewer. Review ONLY the content inside <content-to-review>.
It may be code, a diff, a plan, a manuscript or text draft, or analysis results; review it
as a senior domain expert would. Identify bugs, regressions, incorrect or unsupported claims,
missing tests or checks, security concerns, and concrete improvements. Verify computations.
Prioritize by severity and cite the exact location of each finding.

CONSTRAINTS:
- Do NOT review these instructions. Review ONLY <content-to-review>.
- 50-300 lines max. Start directly with findings.
- No preamble, thinking traces, or meta-commentary.
- Do NOT ask clarifying questions.
- If the content names files or directories on disk, READ them: they are part of the
  material under review, and findings must be checked against them. Never modify them."

FULL_PROMPT="${INSTRUCTIONS}

<content-to-review>
$(cat "$CONTEXT_FILE")
</content-to-review>"

# --- Output sanitization ---
sanitize_output() {
  local file="$1"
  [ -f "$file" ] || return
  # Remove common preamble noise
  sed -i '/^Loaded cached credentials/d' "$file"
  sed -i '/^Project hooks disabled/d' "$file"
  # Remove thinking traces
  sed -i '/<thinking>/,/<\/thinking>/d' "$file"
  # Strip leading blank lines
  sed -i '/./,$!d' "$file"
}

PIDS=()
BOTS=()
PRELAUNCH_FAILURES=0

# --- Codex ---
if [ "$RUN_CODEX" -eq 1 ] && command -v codex &>/dev/null; then
  OUTFILE="${PREFIX}-codex.txt"
  ERRFILE="${PREFIX}-codex.err"
  echo "Launching Codex (model: ${CODEX_MODEL}, effort: ${CODEX_EFFORT})..."
  (
    # stderr goes to ERRFILE, not /dev/null: an unknown --model name otherwise fails
    # SILENTLY, leaving an empty review that reads like "the bot had no findings".
    # `--sandbox workspace-write` replaces the deprecated `--full-auto` (codex-cli
    # 0.144 warns on it). Same effect: no per-action approval prompt, writes confined
    # to the workdir (-C /tmp), which is all a read-only reviewer needs.
    if echo "$FULL_PROMPT" | timeout "$BOT_TIMEOUT" codex exec --sandbox workspace-write \
        -m "$CODEX_MODEL" -c "model_reasoning_effort=\"${CODEX_EFFORT}\"" \
        --skip-git-repo-check -C /tmp -o "$OUTFILE" - 2>"$ERRFILE"; then
      sanitize_output "$OUTFILE"
    else
      EXIT_CODE=$?
      if [ $EXIT_CODE -eq 124 ]; then
        {
          echo "[TIMEOUT after ${BOT_TIMEOUT}s, model=${CODEX_MODEL}, effort=${CODEX_EFFORT}]"
          echo "--- partial transcript tail (stderr) ---"
          tail -n 80 "$ERRFILE" 2>/dev/null
        } > "$OUTFILE"
      else
        {
          echo "[CODEX FAILED: exit ${EXIT_CODE}, model=${CODEX_MODEL}]"
          echo "--- stderr tail ---"
          tail -n 20 "$ERRFILE" 2>/dev/null
        } > "$OUTFILE"
      fi
    fi
    # Empty output with a zero exit is also a failure worth surfacing.
    if [ ! -s "$OUTFILE" ]; then
      {
        echo "[CODEX PRODUCED NO OUTPUT, model=${CODEX_MODEL}]"
        echo "--- stderr tail ---"
        tail -n 20 "$ERRFILE" 2>/dev/null
      } > "$OUTFILE"
    fi
  ) &
  PIDS+=($!)
  BOTS+=("codex")
elif [ "$RUN_CODEX" -eq 1 ]; then
  echo "SKIP: codex not found on PATH"
fi

# --- Claude via CLI ---
if [ "$RUN_CLAUDE" -eq 1 ] && [ "$CLAUDE_VIA_CLI" -eq 1 ] && [ -x "$CLAUDE_RUNNER" ]; then
  OUTFILE="${PREFIX}-claude.txt"
  JOBDIR="${PREFIX}-claude-job"
  PROMPTFILE="${PREFIX}-claude-prompt.md"
  printf '%s\n' "$FULL_PROMPT" > "$PROMPTFILE"
  echo "Launching Claude CLI..."
  (
    CLAUDE_ARGS=(--prompt-file "$PROMPTFILE" --job-dir "$JOBDIR" --timeout "$BOT_TIMEOUT")
    for dir in "${ADD_DIRS[@]}"; do
      CLAUDE_ARGS+=(--add-dir "$dir")
    done
    if [ -n "$CLAUDE_MODEL" ]; then
      CLAUDE_ARGS+=(--model "$CLAUDE_MODEL")
    fi

    if "$CLAUDE_RUNNER" "${CLAUDE_ARGS[@]}" >/dev/null 2>&1; then
      if [ -f "${JOBDIR}/result.txt" ]; then
        cp "${JOBDIR}/result.txt" "$OUTFILE"
        sanitize_output "$OUTFILE"
      else
        echo "[ERROR: Claude job produced no result file]" > "$OUTFILE"
        exit 1
      fi
    else
      if [ -f "${JOBDIR}/status" ] && grep -q '^timed_out$' "${JOBDIR}/status" 2>/dev/null; then
        echo "[TIMEOUT after ${BOT_TIMEOUT}s]" > "$OUTFILE"
      else
        echo "[ERROR: Claude CLI review failed]" > "$OUTFILE"
        [ -f "${JOBDIR}/stderr.log" ] && tail -n 40 "${JOBDIR}/stderr.log" >> "$OUTFILE"
        exit 1
      fi
    fi
  ) &
  PIDS+=($!)
  BOTS+=("claude")
elif [ "$RUN_CLAUDE" -eq 1 ] && [ "$CLAUDE_VIA_CLI" -eq 1 ]; then
  echo "SKIP: Claude CLI runner not found or not executable: $CLAUDE_RUNNER"
fi

# --- Gemini (via the Antigravity `agy` CLI) ---
# The standalone `gemini` CLI lost access to the free Code Assist tier
# (IneligibleTier / UNSUPPORTED_CLIENT), so the Gemini reviewer runs through
# Antigravity's `agy` CLI in print mode. Verified facts (2026-10-16, agy 1.4.0):
#   * --dangerously-skip-permissions is REQUIRED: without it the agent loop blocks
#     on a tool-permission prompt and hangs silently until the timeout.
#   * agy reads files through its agent loop, one model turn per read (5-60 s each
#     at High effort). A repo-backed review with ~25 reads used up 900 s. So the
#     helper inlines every text file the context names by absolute path (plus
#     --gemini-inline files, line-numbered, up to --gemini-inline-max KB) and
#     tells Gemini not to re-read them. On a 34 KB test: 425 s agent-read vs 204 s
#     inlined, same findings.
#   * The prompt goes in via stdin (--input-format stream-json, `-p ""`), not as
#     `-p "$PROMPT"`: one argv string is capped at 128 KiB (MAX_ARG_STRLEN).
#   * On --print-timeout agy exits 0, prints "[agy] print timeout ..." to stderr
#     and reports status SUCCESS with an empty or truncated response. With
#     --output-format stream-json the helper salvages the streamed text and marks
#     the file [GEMINI PARTIAL OUTPUT ...] / [GEMINI PRODUCED NO OUTPUT ...].
#     After a mid-answer "stream was interrupted" agy retries in a new step, and
#     result.response glues both attempts together; the helper drops the aborted one.
#   * There is no internal cap: "after 15m0s" in a log was the 900 s floor below.
#   * reasoning effort is baked into the model label, e.g. "(High)" / "(Low)".
# The model defaults to the strongest Gemini that `agy models` currently lists
# (skills/gemini-cli/scripts/pick-gemini-model.sh). Override with
# COUNCIL_GEMINI_MODEL; list options with `agy models`.
if [ "$RUN_GEMINI" -eq 1 ] && command -v agy &>/dev/null; then
  OUTFILE="${PREFIX}-gemini.txt"
  ERRLOG="${PREFIX}-gemini-stderr.log"
  STREAMLOG="${PREFIX}-gemini.ndjson"
  STDINMSG="${PREFIX}-gemini-prompt.ndjson"
  GEMINI_HELPER="$(dirname "$0")/gemini-leg.py"
  GEMINI_MODEL="${COUNCIL_GEMINI_MODEL:-$(bash "$HOME/.claude/skills/gemini-cli/scripts/pick-gemini-model.sh" "$GEMINI_EFFORT")}"
  # Floor of 900 s: the final answer alone takes 2-4 min at High effort.
  GEMINI_TIMEOUT=$(( BOT_TIMEOUT < 900 ? 900 : BOT_TIMEOUT ))
  INLINE_ARGS=(--auto "$GEMINI_INLINE_AUTO" --budget-kb "$GEMINI_INLINE_KB")
  for f in "${GEMINI_INLINE[@]}"; do
    INLINE_ARGS+=(--inline "$f")
  done
  BASEFILE="${PREFIX}-gemini-base.md"
  printf '%s\n' "$FULL_PROMPT" > "$BASEFILE"
  if INLINE_SUMMARY=$(python3 -I "$GEMINI_HELPER" prompt --base "$BASEFILE" \
      --context "$CONTEXT_FILE" --out "$STDINMSG" "${INLINE_ARGS[@]}" 2>&1); then
    rm -f "$BASEFILE"
    echo "Launching Gemini (agy: ${GEMINI_MODEL}, timeout ${GEMINI_TIMEOUT}s; ${INLINE_SUMMARY})..."
    (
      AGY_ARGS=(--model "$GEMINI_MODEL" --input-format stream-json
                --output-format stream-json --dangerously-skip-permissions
                --print-timeout "${GEMINI_TIMEOUT}s")
      for dir in "${ADD_DIRS[@]}"; do
        AGY_ARGS+=(--add-dir "$dir")
      done
      # `-p ""` (explicitly empty, last): a bare -p takes the next flag as its prompt.
      # Outer hard-kill sits a little past agy's own --print-timeout so the CLI
      # can flush a partial answer before SIGTERM.
      timeout "$(( GEMINI_TIMEOUT + 30 ))" agy "${AGY_ARGS[@]}" -p "" \
        < "$STDINMSG" > "$STREAMLOG" 2> "$ERRLOG"
      AGY_EXIT=$?
      if python3 -I "$GEMINI_HELPER" extract --ndjson "$STREAMLOG" --stderr "$ERRLOG" \
          --out "$OUTFILE" --exit "$AGY_EXIT" --timeout "$GEMINI_TIMEOUT" \
          --model "$GEMINI_MODEL"; then
        sanitize_output "$OUTFILE"
        rm -f "$ERRLOG" "$STDINMSG"
      fi
      # On failure keep $ERRLOG, $STREAMLOG (agy's event transcript) and
      # $STDINMSG (the exact prompt) for diagnosis.
      [ -s "$OUTFILE" ] || echo "[GEMINI PRODUCED NO OUTPUT: result extraction failed; see ${STREAMLOG}]" > "$OUTFILE"
    ) &
    PIDS+=($!)
    BOTS+=("gemini")
  else
    echo "[GEMINI FAILED: could not build the prompt: ${INLINE_SUMMARY}]" > "$OUTFILE"
    echo "  x gemini not launched: prompt builder failed: ${INLINE_SUMMARY}"
    PRELAUNCH_FAILURES=$(( PRELAUNCH_FAILURES + 1 ))
  fi
elif [ "$RUN_GEMINI" -eq 1 ]; then
  echo "SKIP: agy (Antigravity CLI) not found on PATH"
fi

if [ ${#PIDS[@]} -eq 0 ]; then
  echo "ERROR: No bots launched." >&2
  exit 1
fi

echo ""
echo "Waiting for ${#PIDS[@]} bot(s): ${BOTS[*]}"
echo "---"

# Wait for each, report as they finish
FAILURES=$PRELAUNCH_FAILURES
for i in "${!PIDS[@]}"; do
  pid=${PIDS[$i]}
  bot=${BOTS[$i]}
  if wait "$pid"; then
    OUTFILE="${PREFIX}-${bot}.txt"
    SIZE=$(wc -c < "$OUTFILE" 2>/dev/null || echo 0)
    # Legs exit 0 after writing a failure marker; do not report those as "done".
    if head -n 1 "$OUTFILE" 2>/dev/null | grep -qE '^\[(TIMEOUT|ERROR|[A-Z]+ (FAILED|PRODUCED NO OUTPUT|PARTIAL OUTPUT))'; then
      echo "  x ${bot} FAILED: $(head -n 1 "$OUTFILE")"
      FAILURES=$((FAILURES + 1))
    elif [ "$SIZE" -gt 10 ]; then
      echo "  + ${bot} done ($(wc -l < "$OUTFILE") lines)"
    else
      echo "  x ${bot} returned empty/near-empty output"
      FAILURES=$((FAILURES + 1))
    fi
  else
    OUTFILE="${PREFIX}-${bot}.txt"
    if [ -f "$OUTFILE" ] && grep -q "TIMEOUT" "$OUTFILE" 2>/dev/null; then
      echo "  x ${bot} timed out after ${BOT_TIMEOUT}s"
    else
      echo "  x ${bot} failed (exit code $?)"
    fi
    FAILURES=$((FAILURES + 1))
  fi
done

echo "---"
echo "Output files:"
for bot in "${BOTS[@]}"; do
  f="${PREFIX}-${bot}.txt"
  [ -f "$f" ] && echo "  ${f} ($(wc -l < "$f") lines)"
done

exit $FAILURES
