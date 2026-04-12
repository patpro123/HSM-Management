#!/usr/bin/env bash
# server-restart.sh — Kill and restart HSM backend (:3000) and frontend (:5173)

set -euo pipefail

PROJECT_DIR="/Users/srinikamukherjee/Documents/HSM-Management"
BACKEND_LOG="/tmp/hsm-backend.log"
FRONTEND_LOG="/tmp/hsm-frontend.log"

# ── 1. Kill existing processes ────────────────────────────────────────────────
echo "Clearing ports 3000 and 5173..."
lsof -ti TCP:3000 | xargs kill -9 2>/dev/null || true
lsof -ti TCP:5173 | xargs kill -9 2>/dev/null || true
echo "Ports cleared."

# ── 2. Start backend ──────────────────────────────────────────────────────────
echo "Starting backend..."
cd "$PROJECT_DIR/backend-enroll"
node index.js &> "$BACKEND_LOG" &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to bind
for i in {1..10}; do
  if lsof -ti TCP:3000 &>/dev/null; then
    echo "Backend up on :3000"
    break
  fi
  sleep 0.5
done

# ── 3. Start frontend ─────────────────────────────────────────────────────────
echo "Starting frontend..."
cd "$PROJECT_DIR/frontend-enroll"
npm run dev -- --host &> "$FRONTEND_LOG" &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

# Wait for frontend to bind
for i in {1..20}; do
  if lsof -ti TCP:5173 &>/dev/null; then
    echo "Frontend up on :5173"
    break
  fi
  sleep 0.5
done

# ── 4. Report ─────────────────────────────────────────────────────────────────
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "unknown")

echo ""
echo "Servers running:"
echo "  Backend  PID $BACKEND_PID  → http://localhost:3000"
echo "  Frontend PID $FRONTEND_PID → http://localhost:5173"
echo "  Mobile access              → http://$LOCAL_IP:5173"
echo ""
echo "Logs: $BACKEND_LOG  |  $FRONTEND_LOG"
