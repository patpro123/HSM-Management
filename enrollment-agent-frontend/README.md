# Enrollment Agent Frontend

A lightweight static page for the conversational enrollment assistant. Points to the backend endpoint `POST /api/agent/enroll` and visualizes collected vs missing fields.

## Run locally
1. Start the backend API (defaults to http://localhost:3000).
2. Open `index.html` in a browser (no build step required).
3. Optionally set `window.AGENT_API` in the console to point to a different backend URL.

## Notes
- The assistant nudges for missing data until all required fields are available (name, dob, phone, guardian, date of joining, instrument + batch + payment plan).
- LLM calls default to Ollama via `http://localhost:11434` and model `llama3`. Configure with `LLM_PROVIDER`, `OLLAMA_HOST`, `OLLAMA_MODEL`.
