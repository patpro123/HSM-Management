---
description: Kill and restart both the HSM frontend (port 5173) and backend (port 3000) dev servers
---

Kill any processes running on ports 3000 and 5173, then restart both servers in the background.

## Steps

1. Kill existing processes on both ports:
```bash
lsof -ti TCP:3000 | xargs kill -9 2>/dev/null; lsof -ti TCP:5173 | xargs kill -9 2>/dev/null; echo "Cleared ports 3000 and 5173"
```

2. Start the backend (from `backend-enroll/`, uses `.env` which has `DISABLE_AUTH=true DEV_PROFILE=admin`):
```bash
cd /Users/srinikamukherjee/Documents/HSM_Claude_Code/HSM-Management/backend-enroll && node index.js &> /tmp/hsm-backend.log &
echo "Backend PID: $!"
```
Wait ~2 seconds, then verify with: `lsof -ti TCP:3000 | head -1 && echo "Backend up on :3000"`

3. Start the frontend (from `frontend-enroll/`) with `--host` so it binds to `0.0.0.0` and is reachable on mobile over the local network:
```bash
cd /Users/srinikamukherjee/Documents/HSM_Claude_Code/HSM-Management/frontend-enroll && npm run dev -- --host &> /tmp/hsm-frontend.log &
echo "Frontend PID: $!"
```
Wait ~3 seconds, then verify with: `lsof -ti TCP:5173 | head -1 && echo "Frontend up on :5173"`

After startup, report the machine's local IP (e.g. `192.168.x.x:5173`) so it can be opened on mobile.

4. Report the PIDs and confirm both ports are listening.

Logs: `/tmp/hsm-backend.log` and `/tmp/hsm-frontend.log`
