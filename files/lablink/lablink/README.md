# LabLink – Making College Laboratories More Accessible

React + Tailwind + Lucide frontend, Node/Express API, MongoDB, JWT role-based auth, LLM-powered equipment assistant.

## Run locally
Requires Node 18+ and MongoDB running locally (or an Atlas URI).

```bash
# 1. API
cd server
cp .env.example .env      # set MONGO_URI, JWT_SECRET, optionally ANTHROPIC_API_KEY
npm install
npm run dev               # http://localhost:5000  (seeds demo data on first run)

# 2. Web app (new terminal)
cd client
npm install
npm run dev               # http://localhost:5173
```

## Demo logins (password `password123`)
| Role | Email |
|---|---|
| Student | student@lablink.edu |
| Faculty (Electronics) | faculty@lablink.edu |
| Lab admin | admin@lablink.edu |

Registering as faculty/admin needs invite codes from `.env` (defaults `FACULTY2026`, `LABADMIN2026`).

## How it works
- **Availability**: `available = total − approved bookings active today`; recalculated on every approve/reject/complete and when an admin edits stock or maintenance status. Approval is refused if no unit is free for the requested dates.
- **Access control**: server middleware `auth(...roles)` guards every route; the UI hides links by role. Faculty only review requests for their own department.
- **AI assistant**: `POST /api/ai/recommend` sends the live catalogue to the LLM (`ANTHROPIC_API_KEY`) and returns reasoning plus resource cards. Without a key it falls back to keyword matching.

## Structure
```
lablink/
├── server/  (src/index.js, models.js, auth.js, routes.js, seed.js)
└── client/  (src/App.jsx, api.js, ctx.jsx, ui.jsx, pages/*)
```
