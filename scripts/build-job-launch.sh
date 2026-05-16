#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASK_ID=""; NAME=""; CWD=""; COMMAND=""; CHECK=""; PROOF_PATH=""; STALE_MINUTES="30"; OPERATOR="athena"; EXECUTOR="elon"; PRIORITY="P1"; CHANNEL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --task-id) TASK_ID="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --cwd) CWD="$2"; shift 2 ;;
    --command) COMMAND="$2"; shift 2 ;;
    --check) CHECK="$2"; shift 2 ;;
    --proof-path) PROOF_PATH="$2"; shift 2 ;;
    --stale-minutes) STALE_MINUTES="$2"; shift 2 ;;
    --operator) OPERATOR="$2"; shift 2 ;;
    --executor) EXECUTOR="$2"; shift 2 ;;
    --priority) PRIORITY="$2"; shift 2 ;;
    --channel) CHANNEL="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$TASK_ID" || -z "$CWD" || -z "$COMMAND" ]]; then
  echo "required: --task-id --cwd --command" >&2
  exit 2
fi
if [[ ! -d "$CWD" ]]; then
  echo "cwd does not exist: $CWD" >&2
  exit 1
fi

SESSION="mc-${TASK_ID:0:8}"
LOG_DIR="${MISSION_CONTROL_JOB_LOG_DIR:-$HOME/.openclaw-elon/workspace/logs/mission-control-jobs}"
mkdir -p "$LOG_DIR"
LOG_PATH="$LOG_DIR/$SESSION.log"
RUNNER="$LOG_DIR/$SESSION.runner.sh"
: > "$LOG_PATH"

node "$SCRIPT_DIR/mc-task-update.mjs" "$TASK_ID" \
  status=in_progress lifecycleStatus=running runnerType=tmux runnerSession="$SESSION" \
  logPath="$LOG_PATH" operatorAgent="$OPERATOR" ownerAgent="$EXECUTOR" priority="$PRIORITY" \
  staleAfterMinutes="$STALE_MINUTES" lastHeartbeatAt="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  completionCriteria="${CHECK:-manual verification}" proofPath="${PROOF_PATH:-}" >/dev/null

cat > "$RUNNER" <<RUNNER_EOF
#!/usr/bin/env bash
set -euo pipefail
cd "$CWD"
export TASKS_DATA_PATH="${TASKS_DATA_PATH:-}"
echo "STARTED: \$(date -u +%Y-%m-%dT%H:%M:%SZ)"
node "$SCRIPT_DIR/mc-task-update.mjs" "$TASK_ID" lifecycleStatus=running lastHeartbeatAt="\$(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null
set +e
bash -lc '$COMMAND'
CMD_EXIT=\$?
set -e
echo "COMMAND_EXIT: \$CMD_EXIT"
if [[ \$CMD_EXIT -ne 0 ]]; then
  node "$SCRIPT_DIR/mc-task-update.mjs" "$TASK_ID" lifecycleStatus=failed blockedReason="command failed with exit \$CMD_EXIT" lastHeartbeatAt="\$(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null
  exit \$CMD_EXIT
fi
if [[ -n "$CHECK" ]]; then
  bash -lc '$CHECK'
fi
if [[ -n "$PROOF_PATH" && ! -e "$PROOF_PATH" ]]; then
  node "$SCRIPT_DIR/mc-task-update.mjs" "$TASK_ID" lifecycleStatus=blocked blockedReason="proof path missing: $PROOF_PATH" lastHeartbeatAt="\$(date -u +%Y-%m-%dT%H:%M:%SZ)" >/dev/null
  exit 3
fi
node "$SCRIPT_DIR/mc-task-update.mjs" "$TASK_ID" status=done lifecycleStatus=succeeded lastHeartbeatAt="\$(date -u +%Y-%m-%dT%H:%M:%SZ)" lastProofAt="\$(date -u +%Y-%m-%dT%H:%M:%SZ)" blockedReason=null >/dev/null
echo "SUCCEEDED: \$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RUNNER_EOF
chmod +x "$RUNNER"

tmux -S ~/.tmux/sock kill-session -t "$SESSION" 2>/dev/null || true
tmux -S ~/.tmux/sock new -d -s "$SESSION" "bash '$RUNNER' >> '$LOG_PATH' 2>&1; echo EXITED:\$? >> '$LOG_PATH'; sleep 999999"
echo "launched $SESSION log=$LOG_PATH"
