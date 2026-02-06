import { Filter, Flame, TrendingUp, Zap, Clock, Star } from 'lucide-react';
import { TIME_RANGES } from '../utils/trendCalculations';

const TREND_FILTERS = [
  { key: 'all', label: 'All Trends', activeClass: 'bg-emerald-600 text-white' },
  { key: 'exploding', label: 'Exploding', activeClass: 'bg-orange-600 text-white', icon: Flame },
  { key: 'slow_burn', label: 'Slow Burn', activeClass: 'bg-emerald-600 text-white', icon: TrendingUp },
  { key: 'new', label: 'New', activeClass: 'bg-blue-600 text-white', icon: Zap },
];

export default function TrendFilters({
  trendFilter,
  setTrendFilter,
  categoryFilter,
  setCategoryFilter,
  categories,
  timeRange,
  setTimeRange,
  showWatchedOnly,
  setShowWatchedOnly,
  trackedCount,
  hasUser,
}) {
  return (
    <div className="terminal-card space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="text-slate-400" size={18} />
          {TREND_FILTERS.map(({ key, label, activeClass, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTrendFilter(key)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
                trendFilter === key
                  ? activeClass
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {Icon && <Icon size={14} />}
              {label}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-700 text-slate-300 px-3 py-1.5 rounded text-sm border border-slate-600 hover:border-emerald-500 transition-colors"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
        <Clock className="text-slate-400" size={16} />
        <span className="text-slate-400 text-sm">Time Range:</span>
        <div className="flex gap-1 flex-wrap">
          {Object.entries(TIME_RANGES).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => setTimeRange(key)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                timeRange === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {hasUser && trackedCount > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
          <Star className="text-emerald-400" size={16} />
          <button
            onClick={() => setShowWatchedOnly(!showWatchedOnly)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              showWatchedOnly
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {showWatchedOnly ? 'Show All' : 'Show Watched Only'}
          </button>
          <span className="text-slate-400 text-sm">({trackedCount} watching)</span>
        </div>
      )}
    </div>
  );
}
