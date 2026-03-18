#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  claude-job-status.sh [--wait] [--print-result] JOB_DIR

Options:
  --wait          Poll until the job is no longer running
  --print-result  Print result.txt after the status summary
  --help          Show this help
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

WAIT=0
PRINT_RESULT=0
JOB_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --wait)
      WAIT=1
      shift
      ;;
    --print-result)
      PRINT_RESULT=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [ -z "${JOB_DIR}" ]; then
        JOB_DIR="$1"
        shift
      else
        die "Unexpected argument: $1"
      fi
      ;;
  esac
done

[ -n "${JOB_DIR}" ] || die "Provide a job directory"
[ -d "${JOB_DIR}" ] || die "Job directory not found: ${JOB_DIR}"

status_file="${JOB_DIR}/status"
output_json="${JOB_DIR}/output.json"
output_text="${JOB_DIR}/output.text"
result_file="${JOB_DIR}/result.txt"
stderr_file="${JOB_DIR}/stderr.log"
exit_file="${JOB_DIR}/exit_code"
pid_file="${JOB_DIR}/pid"
session_file="${JOB_DIR}/session_id.txt"

if [ "${WAIT}" -eq 1 ]; then
  while true; do
    status="unknown"
    [ -f "${status_file}" ] && status=$(cat "${status_file}")
    case "${status}" in
      running)
        sleep 2
        ;;
      *)
        break
        ;;
    esac
  done
fi

status="unknown"
[ -f "${status_file}" ] && status=$(cat "${status_file}")

echo "job_dir=${JOB_DIR}"
echo "status=${status}"
[ -f "${pid_file}" ] && echo "pid=$(cat "${pid_file}")"
[ -f "${exit_file}" ] && echo "exit_code=$(cat "${exit_file}")"
[ -f "${session_file}" ] && echo "session_id=$(cat "${session_file}")"

if [ -f "${result_file}" ]; then
  echo "result_file=${result_file}"
fi

if [ -f "${output_json}" ]; then
  echo "output_file=${output_json}"
elif [ -f "${output_text}" ]; then
  echo "output_file=${output_text}"
fi

if [ -f "${stderr_file}" ]; then
  echo "stderr_file=${stderr_file}"
fi

if [ "${PRINT_RESULT}" -eq 1 ] && [ -f "${result_file}" ]; then
  printf '\n'
  cat "${result_file}"
fi
