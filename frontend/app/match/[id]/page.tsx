'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getMatch } from '../../../services/api';
import { connectSocket, disconnectSocket } from '../../../services/socket';
import ScoreBoard from '../../../components/ScoreBoard';

export interface MatchDetail {
  id: string;
  name: string;
  status: string;
  venue: string;
  date: string;
  teams: string[];
  score: { r?: number; w?: number; o?: number | string; inning?: string }[];
  teamInfo: { name?: string; shortname?: string; img?: string }[];
  tossWinner: string;
  tossChoice: string;
  matchType: string;
  matchStarted: boolean;
  matchEnded: boolean;
  stale: boolean;
  fetchedAt: string;
  error?: string;
}

export default function MatchPage() {
  const params = useParams();
  const matchId = params?.id as string;

  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMatch = useCallback(async () => {
    try {
      const data = await getMatch(matchId);
      setMatch(data);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load match');
    }
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;

    // Initial fetch
    fetchMatch().finally(() => setLoading(false));

    // WebSocket
    const socket = connectSocket();

    socket.on('connect', () => {
      setWsConnected(true);
      socket.emit('subscribe_match', { matchId });
      // Clear REST fallback polling if WS reconnects
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    });

    socket.on('disconnect', () => {
      setWsConnected(false);
      // Fallback: poll REST every 10s when WS disconnected
      pollingRef.current = setInterval(fetchMatch, 10000);
    });

    socket.on('match_update', (data: MatchDetail) => {
      if (data.id === matchId) {
        setMatch(data);
      }
    });

    return () => {
      socket.emit('unsubscribe_match', { matchId });
      disconnectSocket();
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [matchId, fetchMatch]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-lg animate-pulse">Loading match…</div>
      </div>
    );
  }

  if (error && !match) {
    return (
      <div className="bg-red-900 border border-red-600 rounded-lg p-4 text-red-200">
        Error: {error}
      </div>
    );
  }

  if (!match) return null;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <a href="/" className="text-green-400 hover:text-green-300 text-sm">
          ← All Matches
        </a>
        <span className="text-gray-600">|</span>
        <span
          className={`text-xs px-2 py-1 rounded-full font-semibold ${
            wsConnected
              ? 'bg-green-900 text-green-300'
              : 'bg-yellow-900 text-yellow-300'
          }`}
        >
          {wsConnected ? '● Live' : '○ Polling'}
        </span>
        {match.stale && (
          <span className="text-xs px-2 py-1 rounded-full bg-orange-900 text-orange-300 font-semibold">
            Stale data
          </span>
        )}
      </div>
      <ScoreBoard match={match} />
    </div>
  );
}
