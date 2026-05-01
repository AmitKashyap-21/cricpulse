'use client';

import { useEffect, useState } from 'react';
import { getMatches } from '../services/api';
import MatchList from '../components/MatchList';

export interface MatchSummary {
  id: string;
  name: string;
  status: string;
  venue: string;
  date: string;
  teams: string[];
  score: { r?: number; w?: number; o?: number | string; inning?: string }[];
  matchStarted: boolean;
  matchEnded: boolean;
  stale: boolean;
}

export default function HomePage() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMatches()
      .then((data) => {
        setMatches(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Failed to load matches');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg animate-pulse">Loading matches…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900 border border-red-600 rounded-lg p-4 text-red-200">
        Error: {error}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6 text-green-400">Live &amp; Recent Matches</h1>
      <MatchList matches={matches} />
    </div>
  );
}
