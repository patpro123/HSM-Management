---
description: Kill and restart both the HSM frontend (port 5173) and backend (port 3000) dev servers
---

Kill any processes running on ports 3000 and 5173, then restart both servers in the background.

Run the project's restart script:

```bash
/Users/srinikamukherjee/Documents/HSM-Management/server-restart.sh
```

The script handles everything: killing old processes, starting backend and frontend in the background, polling until both ports are live, and reporting PIDs and the mobile-accessible local IP.

Logs: `/tmp/hsm-backend.log` and `/tmp/hsm-frontend.log`
