import { MatchDetail } from '../app/match/[id]/page';

interface Props {
  match: MatchDetail;
}

export default function ScoreBoard({ match }: Props) {
  const teamA = match.teams?.[0] || 'Team A';
  const teamB = match.teams?.[1] || 'Team B';

  const teamAInfo = match.teamInfo?.find(
    (t) => t.name === teamA || t.shortname === teamA,
  );
  const teamBInfo = match.teamInfo?.find(
    (t) => t.name === teamB || t.shortname === teamB,
  );

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">{match.name}</h1>
        <p className="text-sm text-gray-400">
          {match.matchType && (
            <span className="uppercase font-mono mr-3">{match.matchType}</span>
          )}
          {match.venue && <span>{match.venue}</span>}
        </p>
        {match.date && (
          <p className="text-xs text-gray-500 mt-1">{match.date}</p>
        )}
      </div>

      {/* Teams */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { name: teamA, info: teamAInfo },
          { name: teamB, info: teamBInfo },
        ].map(({ name, info }) => (
          <div
            key={name}
            className="bg-gray-800 rounded-xl p-4 flex items-center gap-3"
          >
            {info?.img && (
              <img
                src={info.img}
                alt={name}
                className="w-10 h-10 rounded-full object-cover border border-gray-600"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div>
              <p className="font-semibold text-white">{name}</p>
              {info?.shortname && (
                <p className="text-xs text-gray-400">{info.shortname}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Scores */}
      {match.score && match.score.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Score
          </h2>
          <div className="space-y-2">
            {match.score.map((s, i) => (
              <div
                key={i}
                className="bg-gray-800 rounded-lg px-4 py-3 flex justify-between items-center"
              >
                <span className="text-gray-300 text-sm">
                  {s.inning || `Innings ${i + 1}`}
                </span>
                <span className="font-mono font-semibold text-white text-lg">
                  {s.r ?? '-'}/{s.w ?? '-'}
                  {s.o !== undefined && (
                    <span className="text-sm text-gray-400 ml-2">({s.o} ov)</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      <div className="border-t border-gray-700 pt-4">
        <div className="flex justify-between items-center">
          <span
            className={`text-sm font-semibold ${
              match.matchEnded
                ? 'text-gray-400'
                : match.matchStarted
                ? 'text-green-400'
                : 'text-yellow-400'
            }`}
          >
            {match.status}
          </span>
          {match.tossWinner && (
            <span className="text-xs text-gray-500">
              Toss: {match.tossWinner} ({match.tossChoice})
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-2">
          Last updated: {match.fetchedAt ? new Date(match.fetchedAt).toLocaleTimeString() : '—'}
        </p>
      </div>
    </div>
  );
}
