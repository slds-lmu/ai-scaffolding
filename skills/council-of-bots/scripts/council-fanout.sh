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
#
# Output files are written next to the context file with the same prefix:
#   /tmp/council-abc123-context.md  →  /tmp/council-abc123-codex.txt
#                                      /tmp/council-abc123-gemini.txt
#                                      /tmp/council-abc123-claude.txt
# ============================================================================

set -uo pipefail

CLAUDE_RUNNER="${CLAUDE_RUNNER:-/home/fabians/.claude/skills/claude-cli/scripts/claude-run.sh}"

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
RUN_CODEX=1
RUN_GEMINI=1
RUN_CLAUDE=1
CLAUDE_VIA_CLI=0
CLAUDE_MODEL="${COUNCIL_CLAUDE_MODEL:-}"
ADD_DIRS=()

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
    *)
      echo "Unknown flag: $1" >&2
      exit 1
      ;;
  esac
done

# Dynamic timeout: 600s base + 2s per KB of context, capped at 1200s
# Bots often need to read large files from disk (not just the context),
# so the base must be generous enough for complex reviews.
CONTEXT_BYTES=$(wc -c < "$CONTEXT_FILE")
CONTEXT_KB=$(( CONTEXT_BYTES / 1024 ))
BOT_TIMEOUT=$(( 600 + 2 * CONTEXT_KB ))
if [ "$BOT_TIMEOUT" -gt 1200 ]; then
  BOT_TIMEOUT=1200
fi

# --- Prompt construction ---
INSTRUCTIONS="You are a code reviewer. Review ONLY the content inside <content-to-review>.
Identify bugs, improvements, security concerns, and potential issues. Verify all computations.

CONSTRAINTS:
- Do NOT review these instructions. Review ONLY <content-to-review>.
- 50-300 lines max. Start directly with findings.
- No preamble, thinking traces, or meta-commentary.
- Do NOT ask clarifying questions."

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

# --- Codex ---
if [ "$RUN_CODEX" -eq 1 ] && command -v codex &>/dev/null; then
  OUTFILE="${PREFIX}-codex.txt"
  echo "Launching Codex..."
  (
    if echo "$FULL_PROMPT" | timeout "$BOT_TIMEOUT" codex exec --full-auto \
        --skip-git-repo-check -C /tmp -o "$OUTFILE" - 2>/dev/null; then
      sanitize_output "$OUTFILE"
    else
      EXIT_CODE=$?
      if [ $EXIT_CODE -eq 124 ]; then
        echo "[TIMEOUT after ${BOT_TIMEOUT}s]" > "$OUTFILE"
      fi
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

# --- Gemini ---
if [ "$RUN_GEMINI" -eq 1 ] && command -v gemini &>/dev/null; then
  OUTFILE="${PREFIX}-gemini.txt"
  echo "Launching Gemini..."
  (
    if echo "$FULL_PROMPT" | timeout "$BOT_TIMEOUT" gemini --yolo \
        --output-format text > "$OUTFILE" 2>/dev/null; then
      sanitize_output "$OUTFILE"
    else
      EXIT_CODE=$?
      if [ $EXIT_CODE -eq 124 ]; then
        echo "[TIMEOUT after ${BOT_TIMEOUT}s]" > "$OUTFILE"
      fi
    fi
  ) &
  PIDS+=($!)
  BOTS+=("gemini")
elif [ "$RUN_GEMINI" -eq 1 ]; then
  echo "SKIP: gemini not found on PATH"
fi

if [ ${#PIDS[@]} -eq 0 ]; then
  echo "ERROR: No bots launched." >&2
  exit 1
fi

echo ""
echo "Waiting for ${#PIDS[@]} bot(s): ${BOTS[*]}"
echo "---"

# Wait for each, report as they finish
FAILURES=0
for i in "${!PIDS[@]}"; do
  pid=${PIDS[$i]}
  bot=${BOTS[$i]}
  if wait "$pid"; then
    OUTFILE="${PREFIX}-${bot}.txt"
    SIZE=$(wc -c < "$OUTFILE" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 10 ]; then
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
