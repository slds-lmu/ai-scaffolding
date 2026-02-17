#!/usr/bin/env bash
# ============================================================================
# Council of Bots - Parallel Fan-out Launcher
# ============================================================================
# Launches Codex, Gemini, and Claude in parallel on a shared context file.
# Waits for all to finish, reports results.
#
# Usage:
#   council-fanout.sh <context-file> [--no-codex] [--no-gemini] [--no-claude]
#
# Output files are written next to the context file with the same prefix:
#   /tmp/council-abc123-context.md  →  /tmp/council-abc123-codex.txt
#                                      /tmp/council-abc123-gemini.txt
#                                      /tmp/council-abc123-claude.txt
# ============================================================================

set -uo pipefail

CONTEXT_FILE="${1:?Usage: council-fanout.sh <context-file> [--no-codex] [--no-gemini] [--no-claude]}"
shift

if [ ! -f "$CONTEXT_FILE" ]; then
  echo "ERROR: Context file not found: $CONTEXT_FILE" >&2
  exit 1
fi

# Derive output prefix from context filename
# e.g. /tmp/council-abc123-context.md → /tmp/council-abc123
PREFIX="${CONTEXT_FILE%-context.md}"
if [ "$PREFIX" = "$CONTEXT_FILE" ]; then
  # Fallback if filename doesn't match pattern
  PREFIX="${CONTEXT_FILE%.md}"
  PREFIX="${PREFIX%.txt}"
fi

# Parse flags
RUN_CODEX=1
RUN_GEMINI=1
RUN_CLAUDE=1

for arg in "$@"; do
  case "$arg" in
    --no-codex)  RUN_CODEX=0 ;;
    --no-gemini) RUN_GEMINI=0 ;;
    --no-claude) RUN_CLAUDE=0 ;;
    *) echo "Unknown flag: $arg" >&2; exit 1 ;;
  esac
done

REVIEW_PROMPT="Review the following. Identify bugs, improvements, security concerns, and potential issues. Verify all computations."

PIDS=()
BOTS=()

# --- Codex ---
if [ "$RUN_CODEX" -eq 1 ] && command -v codex &>/dev/null; then
  OUTFILE="${PREFIX}-codex.txt"
  echo "Launching Codex..."
  (
    cd /tmp && codex exec --full-auto --skip-git-repo-check \
      "Read the file ${CONTEXT_FILE} and review it. ${REVIEW_PROMPT}" \
      > "$OUTFILE" 2>/dev/null
  ) &
  PIDS+=($!)
  BOTS+=("codex")
elif [ "$RUN_CODEX" -eq 1 ]; then
  echo "SKIP: codex not found on PATH"
fi

# --- Gemini ---
if [ "$RUN_GEMINI" -eq 1 ] && command -v gemini &>/dev/null; then
  OUTFILE="${PREFIX}-gemini.txt"
  echo "Launching Gemini..."
  (
    CONTEXT_SIZE=$(wc -c < "$CONTEXT_FILE")
    if [ "$CONTEXT_SIZE" -gt 200000 ]; then
      gemini "Read ${CONTEXT_FILE} and review it. ${REVIEW_PROMPT}" \
        > "$OUTFILE" 2>&1
    else
      gemini "${REVIEW_PROMPT}

$(cat "$CONTEXT_FILE")" > "$OUTFILE" 2>&1
    fi
  ) &
  PIDS+=($!)
  BOTS+=("gemini")
elif [ "$RUN_GEMINI" -eq 1 ]; then
  echo "SKIP: gemini not found on PATH"
fi

# --- Claude ---
if [ "$RUN_CLAUDE" -eq 1 ] && command -v claude &>/dev/null; then
  OUTFILE="${PREFIX}-claude.txt"
  echo "Launching Claude..."
  (
    CONTEXT_SIZE=$(wc -c < "$CONTEXT_FILE")
    if [ "$CONTEXT_SIZE" -gt 200000 ]; then
      CLAUDECODE= claude -p --model sonnet \
        "Read ${CONTEXT_FILE} and review it. ${REVIEW_PROMPT}" \
        > "$OUTFILE" 2>&1
    else
      CLAUDECODE= claude -p --model sonnet \
        "${REVIEW_PROMPT}

$(cat "$CONTEXT_FILE")" > "$OUTFILE" 2>&1
    fi
  ) &
  PIDS+=($!)
  BOTS+=("claude")
elif [ "$RUN_CLAUDE" -eq 1 ]; then
  echo "SKIP: claude not found on PATH"
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
      echo "  ✓ ${bot} done ($(wc -l < "$OUTFILE") lines)"
    else
      echo "  ✗ ${bot} returned empty/near-empty output"
      FAILURES=$((FAILURES + 1))
    fi
  else
    echo "  ✗ ${bot} failed (exit code $?)"
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
