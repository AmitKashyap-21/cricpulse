export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3001',
  rapidapi: {
    key: process.env.RAPIDAPI_KEY || '',
    host: process.env.RAPIDAPI_HOST || 'cricbuzz-cricket.p.rapidapi.com',
    baseUrl: process.env.RAPIDAPI_BASE_URL || 'https://cricbuzz-cricket.p.rapidapi.com',
    matchesPath: process.env.RAPIDAPI_MATCHES_PATH || '/matches/v1/live',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  },
  ttl: {
    matchSnapshot: parseInt(process.env.MATCH_SNAPSHOT_TTL, 10) || 30,
    matchesList: parseInt(process.env.MATCHES_LIST_TTL, 10) || 60,
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 60,
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 30,
  },
});
