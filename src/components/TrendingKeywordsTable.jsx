import { Flame } from 'lucide-react';

export default function TrendingKeywordsTable({ keywords }) {
  if (keywords.length === 0) {
    return (
      <div className="terminal-card">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Flame className="text-orange-400" size={20} />
          Trending Keywords
        </h2>
        <div className="text-center py-12">
          <Flame className="text-slate-600 mx-auto mb-4" size={48} />
          <p className="text-slate-400">No trending keywords yet</p>
          <p className="text-slate-500 text-sm mt-2">
            Keywords will appear here when they show increased activity on Reddit. The system checks every 15 minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="terminal-card">
      <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
        <Flame className="text-orange-400" size={20} />
        Trending Keywords
      </h2>
      <div className="overflow-x-auto">
        <table className="terminal-table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Subreddit</th>
              <th>Heat Score</th>
              <th>Last Calculated</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((item) => (
              <tr key={item.id}>
                <td className="font-semibold text-emerald-400">{item.keyword}</td>
                <td className="text-slate-300">r/{item.subreddit}</td>
                <td>
                  <span className="inline-flex items-center gap-1 text-orange-400 font-semibold">
                    <Flame size={16} />
                    {item.heatScore}
                  </span>
                </td>
                <td className="text-slate-400 text-xs">{item.calculatedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
