#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  claude-run.sh --prompt-text TEXT [options]
  claude-run.sh --prompt-file FILE [options]

Options:
  --job-dir DIR                 Reuse or create a specific job directory
  --target PATH                 File or directory Claude should be able to read
  --add-dir DIR                 Extra directory to allow explicitly
  --model MODEL                 Claude model alias or full model name
  --effort LEVEL                low, medium, high, or max
  --timeout SECONDS             Kill the run after this many seconds
  --output-format FORMAT        json or text (default: json)
  --permission-mode MODE        default: bypassPermissions
  --allowed-tools TOOLS         Comma-separated tool list (default: Read,Grep,Glob)
  --system-prompt TEXT          Override the system prompt
  --append-system-prompt TEXT   Append extra system prompt text
  --max-budget-usd AMOUNT       Optional budget cap
  --session-persistence         Keep Claude session files instead of disabling them
  --help                        Show this help

Examples:
  claude-run.sh --prompt-text "Summarize this file" --target ./R/file.R
  claude-run.sh --prompt-file /tmp/review.md --target ./R --model opus
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

ensure_dir() {
  local path="$1"
  [ -d "$path" ] || die "Directory not found: $path"
}

stage_prompt() {
  local destination="$1"

  if [ -n "${PROMPT_FILE}" ]; then
    [ -f "${PROMPT_FILE}" ] || die "Prompt file not found: ${PROMPT_FILE}"
    cp "${PROMPT_FILE}" "${destination}"
    return
  fi

  if [ -n "${PROMPT_TEXT}" ]; then
    printf '%s\n' "${PROMPT_TEXT}" > "${destination}"
    return
  fi

  die "Provide either --prompt-file or --prompt-text"
}

calc_timeout() {
  local prompt_path="$1"
  local prompt_bytes prompt_kb

  prompt_bytes=$(wc -c < "${prompt_path}")
  prompt_kb=$(( prompt_bytes / 1024 ))
  TIMEOUT_SECONDS=$(( 300 + 2 * prompt_kb + 45 * ${#TARGETS[@]} ))

  if [ "${TIMEOUT_SECONDS}" -lt 300 ]; then
    TIMEOUT_SECONDS=300
  fi

  if [ "${TIMEOUT_SECONDS}" -gt 1800 ]; then
    TIMEOUT_SECONDS=1800
  fi
}

write_metadata() {
  local prompt_path="$1"

  {
    echo "output_format=${OUTPUT_FORMAT}"
    echo "permission_mode=${PERMISSION_MODE}"
    echo "allowed_tools=${ALLOWED_TOOLS}"
    echo "timeout_seconds=${TIMEOUT_SECONDS}"
    echo "model=${MODEL}"
    echo "effort=${EFFORT}"
    echo "prompt_file=${prompt_path}"
  } > "${JOB_DIR}/metadata.env"

  if [ ${#TARGETS[@]} -gt 0 ]; then
    printf '%s\n' "${TARGETS[@]}" > "${JOB_DIR}/targets.txt"
  fi

  if [ ${#ADD_DIRS[@]} -gt 0 ]; then
    printf '%s\n' "${ADD_DIRS[@]}" > "${JOB_DIR}/add_dirs.txt"
  fi
}

extract_json_fields() {
  local output_file="$1"
  local result_file="$2"
  local session_file="$3"

  python3 - "$output_file" "$result_file" "$session_file" <<'PY'
import json
import pathlib
import sys

output_path = pathlib.Path(sys.argv[1])
result_path = pathlib.Path(sys.argv[2])
session_path = pathlib.Path(sys.argv[3])

try:
    data = json.loads(output_path.read_text())
except Exception:
    sys.exit(0)

result = data.get("result")
if isinstance(result, str):
    result_path.write_text(result)

session_id = data.get("session_id")
if isinstance(session_id, str):
    session_path.write_text(session_id + "\n")
PY
}

launch_worker() {
  local -a cmd
  local output_path="${JOB_DIR}/output.${OUTPUT_FORMAT}"
  local stderr_path="${JOB_DIR}/stderr.log"
  local exit_path="${JOB_DIR}/exit_code"
  local status_path="${JOB_DIR}/status"
  local session_path="${JOB_DIR}/session_id.txt"
  local result_path="${JOB_DIR}/result.txt"
  local command_path="${JOB_DIR}/command.txt"

  cmd=(env -u CLAUDECODE claude -p --output-format "${OUTPUT_FORMAT}")
  cmd+=(--permission-mode "${PERMISSION_MODE}")
  cmd+=(--allowedTools="${ALLOWED_TOOLS}")

  if [ -n "${MODEL}" ]; then
    cmd+=(--model "${MODEL}")
  fi

  if [ -n "${EFFORT}" ]; then
    cmd+=(--effort "${EFFORT}")
  fi

  if [ -n "${SYSTEM_PROMPT}" ]; then
    cmd+=(--system-prompt "${SYSTEM_PROMPT}")
  fi

  if [ -n "${APPEND_SYSTEM_PROMPT}" ]; then
    cmd+=(--append-system-prompt "${APPEND_SYSTEM_PROMPT}")
  fi

  if [ -n "${MAX_BUDGET_USD}" ]; then
    cmd+=(--max-budget-usd "${MAX_BUDGET_USD}")
  fi

  if [ "${SESSION_PERSISTENCE}" -eq 0 ]; then
    cmd+=(--no-session-persistence)
  fi

  for dir in "${ADD_DIRS[@]}"; do
    cmd+=("--add-dir=${dir}")
  done

  printf '%q ' "${cmd[@]}" > "${command_path}"
  printf '\n' >> "${command_path}"

  printf 'running\n' > "${status_path}"

  set +e
  timeout "${TIMEOUT_SECONDS}" "${cmd[@]}" \
    < "${JOB_DIR}/prompt.md" \
    > "${output_path}" \
    2> "${stderr_path}"
  local exit_code=$?
  set -e

  printf '%s\n' "${exit_code}" > "${exit_path}"

  if [ "${exit_code}" -eq 0 ]; then
    if [ "${OUTPUT_FORMAT}" = "json" ]; then
      extract_json_fields "${output_path}" "${result_path}" "${session_path}"
    else
      cp "${output_path}" "${result_path}"
    fi
    printf 'succeeded\n' > "${status_path}"
    return
  fi

  if [ "${exit_code}" -eq 124 ]; then
    printf 'timed_out\n' > "${status_path}"
    return
  fi

  printf 'failed\n' > "${status_path}"
}

WORKER_MODE=0
PROMPT_FILE=""
PROMPT_TEXT=""
JOB_DIR=""
MODEL=""
EFFORT=""
TIMEOUT_SECONDS=""
OUTPUT_FORMAT="json"
PERMISSION_MODE="bypassPermissions"
ALLOWED_TOOLS="Read,Grep,Glob"
SYSTEM_PROMPT=""
APPEND_SYSTEM_PROMPT=""
MAX_BUDGET_USD=""
SESSION_PERSISTENCE=0

declare -a TARGETS=()
declare -a ADD_DIRS=()

while [ $# -gt 0 ]; do
  case "$1" in
    --worker)
      WORKER_MODE=1
      shift
      ;;
    --prompt-file)
      PROMPT_FILE="${2:?Missing value for --prompt-file}"
      shift 2
      ;;
    --prompt-text)
      PROMPT_TEXT="${2:?Missing value for --prompt-text}"
      shift 2
      ;;
    --job-dir)
      JOB_DIR="${2:?Missing value for --job-dir}"
      shift 2
      ;;
    --target)
      TARGETS+=("${2:?Missing value for --target}")
      shift 2
      ;;
    --add-dir)
      ADD_DIRS+=("${2:?Missing value for --add-dir}")
      shift 2
      ;;
    --model)
      MODEL="${2:?Missing value for --model}"
      shift 2
      ;;
    --effort)
      EFFORT="${2:?Missing value for --effort}"
      shift 2
      ;;
    --timeout)
      TIMEOUT_SECONDS="${2:?Missing value for --timeout}"
      shift 2
      ;;
    --output-format)
      OUTPUT_FORMAT="${2:?Missing value for --output-format}"
      shift 2
      ;;
    --permission-mode)
      PERMISSION_MODE="${2:?Missing value for --permission-mode}"
      shift 2
      ;;
    --allowed-tools)
      ALLOWED_TOOLS="${2:?Missing value for --allowed-tools}"
      shift 2
      ;;
    --system-prompt)
      SYSTEM_PROMPT="${2:?Missing value for --system-prompt}"
      shift 2
      ;;
    --append-system-prompt)
      APPEND_SYSTEM_PROMPT="${2:?Missing value for --append-system-prompt}"
      shift 2
      ;;
    --max-budget-usd)
      MAX_BUDGET_USD="${2:?Missing value for --max-budget-usd}"
      shift 2
      ;;
    --session-persistence)
      SESSION_PERSISTENCE=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "Unknown argument: $1"
      ;;
  esac
done

require_command claude
require_command timeout
require_command python3

if [ "${OUTPUT_FORMAT}" != "json" ] && [ "${OUTPUT_FORMAT}" != "text" ]; then
  die "Unsupported output format: ${OUTPUT_FORMAT}"
fi

if [ -z "${JOB_DIR}" ]; then
  JOB_DIR=$(mktemp -d /tmp/claude-cli-XXXXXX)
else
  mkdir -p "${JOB_DIR}"
fi

PROMPT_PATH="${JOB_DIR}/prompt.md"

if [ "${WORKER_MODE}" -eq 0 ]; then
  stage_prompt "${PROMPT_PATH}"
elif [ ! -f "${PROMPT_PATH}" ]; then
  die "Worker mode requires an existing prompt file: ${PROMPT_PATH}"
fi

for target in "${TARGETS[@]}"; do
  [ -e "${target}" ] || die "Target not found: ${target}"
  if [ -d "${target}" ]; then
    ADD_DIRS+=("${target}")
  else
    ADD_DIRS+=("$(dirname "${target}")")
  fi
done

if [ ${#ADD_DIRS[@]} -gt 0 ]; then
  mapfile -t ADD_DIRS < <(printf '%s\n' "${ADD_DIRS[@]}" | awk 'NF && !seen[$0]++')
  for dir in "${ADD_DIRS[@]}"; do
    ensure_dir "${dir}"
  done
fi

if [ -z "${TIMEOUT_SECONDS}" ]; then
  calc_timeout "${PROMPT_PATH}"
fi

write_metadata "${PROMPT_PATH}"

if [ "${WORKER_MODE}" -eq 1 ]; then
  launch_worker
  exit 0
fi

launch_worker

if [ -f "${JOB_DIR}/result.txt" ]; then
  cat "${JOB_DIR}/result.txt"
else
  cat "${JOB_DIR}/output.${OUTPUT_FORMAT}"
fi
