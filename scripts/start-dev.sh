#!/bin/bash
# Start Mission Control dev server in a managed tmux session
# Uses stable socket at ~/.tmux/sock so it survives terminal disconnects

SESSION="mission-control"
SOCKET="$HOME/.tmux/sock"
DIR="$HOME/repos/mission-control"

mkdir -p "$HOME/.tmux"

# Check if session already running
if tmux -S "$SOCKET" has-session -t "$SESSION" 2>/dev/null; then
  echo "✅ Mission Control already running"
  echo "   Attach: tmux -S $SOCKET attach -t $SESSION"
  echo "   Logs:   tmux -S $SOCKET capture-pane -t $SESSION -p | tail -20"
  exit 0
fi

# Start new session
tmux -S "$SOCKET" new-session -d -s "$SESSION" \
  -x 220 -y 50 \
  "cd $DIR && npm run dev -- -H 0.0.0.0; echo 'EXITED: '\$?; sleep 999999"

echo "✅ Mission Control started"
echo "   Session: $SESSION"
echo "   Socket:  $SOCKET"
echo "   URL:     http://localhost:3000"
echo ""
echo "   Attach:  tmux -S $SOCKET attach -t $SESSION"
echo "   Logs:    tmux -S $SOCKET capture-pane -t $SESSION -p | tail -20"
echo "   Stop:    tmux -S $SOCKET kill-session -t $SESSION"
