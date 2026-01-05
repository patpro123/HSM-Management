# Student Enrollment (Q&A Prototype)

Tech stack (recommended for quick mobile-friendly prototype):
- **Vite + React** (fast, minimal) 🔧
- **Plain CSS (mobile-first)** for responsiveness; optionally replace with Tailwind for faster styling ⚡
- To run as native-like mobile app later: **Capacitor** (web→mobile) or **Expo** (if you reimplement in React Native)

Files created:
- `src/components/QuestionFlow.jsx` — Q&A flow + mock submit (saves to localStorage)
- `src/App.jsx`, `src/main.jsx`, `index.html`, `src/styles.css`

Quick start:
1. cd frontend-enroll
2. npm install
3. npm run dev

App routes:
- `/` — Enrollment Q&A (default)
- `/admin` — Admin list of enrollments (simple admin view)

Notes:
- For production, build the app (`npm run build`) and serve the `dist/` files from your Node backend or a static host.

Notes:
- The Q&A collects: Name (first, last), Email, DOB, Mailing address, **Streams** (one or more of: Keyboard, Guitar, Piano, Drums, Tabla, Violin, Hindustani vocals, Carnatic vocals). For each selected stream the user configures **Batch** and **Payment** (Monthly/Quarterly).
- The frontend POSTs `{ answers: { firstName, lastName, email, dob, address, streams: [ { instrument, batch, payment } ], dateOfJoining } }` to `http://localhost:3000/api/enroll` and falls back to `localStorage` if the server is unavailable.
- To package for mobile: run with Capacitor (add Capacitor, build, then `npx cap add android` / `npx cap add ios`).

Next suggested steps:
- Improve inline validation messages and UX
- Add an admin list to fetch `GET /api/enrollments`
- Hook up to persistent DB when ready
