export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3001',
  cricapi: {
    apiKey: process.env.CRICAPI_API_KEY || '',
    baseUrl: 'https://api.cricapi.com/v1',
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
