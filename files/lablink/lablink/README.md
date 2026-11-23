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

## Development demo accounts

The seed creates a demo account only when its matching password environment variable is set. Use unique development-only passwords of at least 12 characters; the seed hashes them and never replaces an existing account.

| Role | Demo email | Password environment variable |
|---|---|---|
| Student | `student@lablink.demo` | `DEMO_STUDENT_PASSWORD` |
| Faculty Coordinator | `faculty@lablink.demo` | `DEMO_FACULTY_PASSWORD` |
| Lab In-Charge | `labincharge@lablink.demo` | `DEMO_LAB_INCHARGE_PASSWORD` |
| Dean | `dean@lablink.demo` | `DEMO_DEAN_PASSWORD` |
| Admin | `admin@lablink.demo` | `DEMO_ADMIN_PASSWORD` |

Do not use these development accounts in production. No demo passwords are committed.

## How it works
- **Availability**: `available = total − approved bookings active today`; recalculated on every approve/reject/complete and when an admin edits stock or maintenance status. Approval is refused if no unit is free for the requested dates.
- **Access control**: server middleware `auth(...roles)` guards every route; the UI hides links by role. Faculty only review requests for their own department.
- **AI assistant**: `POST /api/ai/recommend` sends the live catalogue to the LLM (`ANTHROPIC_API_KEY`) and returns reasoning plus resource cards. Without a key it falls back to keyword matching.
- **Community questions**: signed-in users can browse seven topic categories, search and filter questions, post tagged questions, and respond to discussions. Questions and responses are stored in MongoDB with their authors and timestamps.
- **Lab sessions**: staff configure a room number and seat capacity when scheduling a practical. Students reserve a seat or join the FIFO waitlist; cancellation is immediate until two hours before start, after which it requires Lab In-Charge approval. A cancellation promotes the next waitlisted student. Capacity counts are reserved atomically to prevent overbooking.
- **Student analytics**: activity charts use the signed-in student's own equipment bookings, support queries, community questions, and Lab In-Charge-recorded attendance. Attendance and assignment metrics are not synthesized; attendance stays unreported until entered by authorized lab staff, and assignments are labelled untracked until an assignment feed exists. Empty timetable days mean no session is recorded, not that a lab has been confirmed free.
- **Session history**: pre-existing practical sessions have no inferred capacity or attendance. Staff must configure capacity for booking and record attendance after a session.

The Questions dashboard includes recent, popular, and personal discussions. Notification delivery and password reset are not currently provided by the API.

## Structure
```
lablink/
├── server/  (src/index.js, models.js, auth.js, routes.js, seed.js)
└── client/  (src/App.jsx, api.js, ctx.jsx, ui.jsx, pages/*)
```
