---
description: Kill and restart both the HSM frontend (port 5173) and backend (port 3000) dev servers
---

Kill any processes running on ports 3000 and 5173, then restart both servers in the background.

## Steps

1. Kill existing processes on both ports:
```bash
lsof -ti :3000,:5173 | xargs kill -9 2>/dev/null; echo "Cleared ports 3000 and 5173"
```

2. Start the backend (from `backend-enroll/`, uses `.env` which has `DISABLE_AUTH=true DEV_PROFILE=admin`):
```bash
cd /Users/srinikamukherjee/Documents/HSM_Claude_Code/HSM-Management/backend-enroll && node index.js
```
Run this in the background and wait ~2 seconds for it to bind.

3. Start the frontend (from `frontend-enroll/`):
```bash
cd /Users/srinikamukherjee/Documents/HSM_Claude_Code/HSM-Management/frontend-enroll && npm run dev
```
Run this in the background.

4. Confirm both are up by checking ports 3000 and 5173 are listening.

Report which PIDs are running on each port once done.
