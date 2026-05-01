# CricPulse (Monorepo) — MVP

Minimal real-time cricket scores MVP.

- Backend: NestJS + Redis + Socket.IO (WS path `/ws`)
- Frontend: Next.js 15 (App Router) + Tailwind + socket.io-client
- Data: CricAPI / CricketData (free tier) via backend aggregator

---

## Prereqs

- Node.js 22+
- Docker (for Redis)
- A CricAPI/CricketData API key

---

## 1) Start Redis (root)

```bash
docker compose up -d
```

---

## 2) Backend setup (`/backend`)

```bash
cd backend
cp .env.example .env
# edit .env and set CRICAPI_API_KEY
npm install
npm run start:dev
```

Backend runs at: `http://localhost:3000`
WebSocket (Socket.IO) path: `http://localhost:3000/ws`

### Test backend
```bash
curl http://localhost:3000/matches
# pick a matchId from response:
curl http://localhost:3000/match/<MATCH_ID>
```

---

## 3) Frontend setup (`/frontend`)

```bash
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

Frontend runs at: `http://localhost:3001`

---

## Notes / MVP behavior

- Backend polls live matches every ~8 seconds (capped to top 20 match IDs).
- All clients subscribe via WebSocket; backend broadcasts `match_update`.
- If CricAPI fails or rate-limiter blocks, backend serves cached snapshot marked `stale: true`.