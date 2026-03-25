#!/bin/bash
# ─────────────────────────────────────────────────────────────
# RecruitIQ — Start Script
# Runs the FastAPI backend and React frontend simultaneously
# ─────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Load .env if it exists
if [ -f "$BACKEND_DIR/.env" ]; then
  export $(cat "$BACKEND_DIR/.env" | grep -v '^#' | xargs)
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   🚀 RecruitIQ — Starting Up"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start FastAPI backend
echo "▶ Starting backend (FastAPI) on http://localhost:8000"
cd "$BACKEND_DIR"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

sleep 2

# Start React frontend
echo "▶ Starting frontend (React) on http://localhost:5173"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   ✅ RecruitIQ is running!"
echo ""
echo "   🌐 Open: http://localhost:5173"
echo "   📡 API:  http://localhost:8000"
echo "   📖 Docs: http://localhost:8000/docs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   Press Ctrl+C to stop both servers"
echo ""

# Wait and cleanup
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT INT TERM
wait
