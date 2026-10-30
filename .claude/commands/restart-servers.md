---
description: Kill and restart both the HSM frontend (port 5173) and backend (port 3000) dev servers
---

Kill any processes running on ports 3000 and 5173, then restart both servers in the background.

Run the project's restart script from the repo root — pick the one for the current platform and run nothing else beforehand (the script does its own port checks):

**Windows** (PowerShell tool):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\server-restart.ps1
```

**macOS:**
```bash
/Users/srinikamukherjee/Documents/HSM-Management/server-restart.sh
```

The script handles everything: killing old processes, starting backend and frontend in the background, polling until both respond, and reporting UP/DOWN, PIDs and the mobile-accessible local IP. On failure it prints the tail of the logs and exits 1.

Logs: Windows `%TEMP%\hsm-backend.log` / `%TEMP%\hsm-frontend.log` (stderr in `*.err`); macOS `/tmp/hsm-backend.log` / `/tmp/hsm-frontend.log`
