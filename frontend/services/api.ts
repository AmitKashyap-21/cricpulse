import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

export async function getMatches() {
  const res = await api.get('/matches');
  return res.data?.data || [];
}

export async function getMatch(id: string) {
  const res = await api.get(`/match/${id}`);
  return res.data?.data || null;
}

export default api;
