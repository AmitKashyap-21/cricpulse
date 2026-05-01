# CricPulse (Monorepo) — MVP

Minimal real-time cricket scores MVP.

- Backend: NestJS + Redis + Socket.IO (WS path `/ws`)
- Frontend: Next.js 15 (App Router) + Tailwind + socket.io-client
- Data: RapidAPI Cricbuzz (`cricbuzz-cricket.p.rapidapi.com`) via backend aggregator

---

## Prereqs

- Node.js 22+
- Docker (for Redis)
- A [RapidAPI](https://rapidapi.com/cricketapilive/api/cricbuzz-cricket) key for the Cricbuzz Cricket API

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
# edit .env and set RAPIDAPI_KEY to your RapidAPI key
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

## Environment variables (backend)

| Variable | Description | Default |
|---|---|---|
| `RAPIDAPI_KEY` | Your RapidAPI key for Cricbuzz | *(required)* |
| `RAPIDAPI_HOST` | RapidAPI host header | `cricbuzz-cricket.p.rapidapi.com` |
| `RAPIDAPI_BASE_URL` | Base URL for Cricbuzz API | `https://cricbuzz-cricket.p.rapidapi.com` |
| `RAPIDAPI_MATCHES_PATH` | Endpoint path for live matches list | `/matches/v1/live` |
| `REDIS_HOST` | Redis hostname | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `PORT` | Backend HTTP port | `3000` |
| `FRONTEND_ORIGIN` | CORS allowed origin | `http://localhost:3001` |

---

## Notes / MVP behavior

- Backend polls live matches every ~8 seconds (capped to top 20 match IDs).
- All clients subscribe via WebSocket; backend broadcasts `match_update`.
- If RapidAPI Cricbuzz fails or rate-limiter blocks, backend serves cached snapshot marked `stale: true`.
- Rate limiting uses Redis key `rate_limit:rapidapi_cricbuzz`.