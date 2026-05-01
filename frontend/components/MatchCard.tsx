import Link from 'next/link';
import { MatchSummary } from '../app/page';

interface Props {
  match: MatchSummary;
}

export default function MatchCard({ match }: Props) {
  const teamA = match.teams?.[0] || 'Team A';
  const teamB = match.teams?.[1] || 'Team B';

  const scoreText = match.score
    ?.map((s) => {
      const parts = [];
      if (s.inning) parts.push(s.inning.replace(/innings$/, 'Inn').substring(0, 20));
      if (s.r !== undefined) parts.push(`${s.r}/${s.w ?? '?'}`);
      if (s.o !== undefined) parts.push(`(${s.o} ov)`);
      return parts.join(' ');
    })
    .filter(Boolean)
    .join('  •  ');

  const statusColor =
    match.matchEnded
      ? 'text-gray-400'
      : match.matchStarted
      ? 'text-green-400'
      : 'text-yellow-400';

  return (
    <Link href={`/match/${match.id}`}>
      <div className="bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-green-700 rounded-xl p-5 cursor-pointer transition-all duration-200">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-lg font-semibold text-white leading-tight">{match.name}</h2>
          {match.stale && (
            <span className="text-xs text-orange-400 ml-2 shrink-0">stale</span>
          )}
        </div>

        <div className="flex items-center gap-4 mb-3">
          <span className="text-gray-300 font-medium">{teamA}</span>
          <span className="text-gray-600 text-sm">vs</span>
          <span className="text-gray-300 font-medium">{teamB}</span>
        </div>

        {scoreText ? (
          <p className="text-sm text-gray-400 mb-2 font-mono">{scoreText}</p>
        ) : null}

        <div className="flex justify-between items-center text-xs text-gray-500">
          <span className={`font-medium ${statusColor}`}>{match.status}</span>
          <span>{match.venue || match.date || ''}</span>
        </div>
      </div>
    </Link>
  );
}
