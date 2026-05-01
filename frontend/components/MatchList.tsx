import { MatchSummary } from '../app/page';
import MatchCard from './MatchCard';

interface Props {
  matches: MatchSummary[];
}

export default function MatchList({ matches }: Props) {
  if (!matches || matches.length === 0) {
    return (
      <div className="text-center text-gray-500 py-16">
        <p className="text-4xl mb-4">🏏</p>
        <p className="text-lg">No matches available right now.</p>
        <p className="text-sm mt-2">Check back later or verify your CricAPI key.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
      {matches.map((match) => (
        <MatchCard key={match.id} match={match} />
      ))}
    </div>
  );
}
