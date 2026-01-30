import { Eye, EyeOff, Flame, TrendingUp, TrendingDown, Activity, Zap, Star, BarChart3 } from 'lucide-react';
import { TrendSparkline } from './TrendChart';
import { calculateGrowthPercentage } from '../utils/trendCalculations';

export default function EntityCard({
  entity,
  chartData,
  isTracked,
  onToggleTracking,
  onViewDetails,
  timeRange
}) {
  const getTrendIcon = (status) => {
    switch (status) {
      case 'Exploding':
        return <Flame className="text-orange-400" size={18} />;
      case 'Slow Burn':
        return <TrendingUp className="text-emerald-400" size={18} />;
      case 'Declining':
        return <TrendingDown className="text-red-400" size={18} />;
      case 'Peaked':
        return <Activity className="text-amber-400" size={18} />;
      default:
        return <Zap className="text-blue-400" size={18} />;
    }
  };

  const getTrendColor = (status) => {
    switch (status) {
      case 'Exploding':
        return 'border-orange-500/50 bg-orange-900/10 hover:border-orange-500';
      case 'Slow Burn':
        return 'border-emerald-500/50 bg-emerald-900/10 hover:border-emerald-500';
      case 'Declining':
        return 'border-red-500/50 bg-red-900/10 hover:border-red-500';
      case 'Peaked':
        return 'border-amber-500/50 bg-amber-900/10 hover:border-amber-500';
      default:
        return 'border-blue-500/50 bg-blue-900/10 hover:border-blue-500';
    }
  };

  const growthPercentage = calculateGrowthPercentage(chartData, timeRange);

  const getGrowthColor = (growth) => {
    if (growth > 50) return 'text-emerald-400';
    if (growth > 0) return 'text-emerald-300';
    if (growth < -50) return 'text-red-400';
    if (growth < 0) return 'text-red-300';
    return 'text-slate-400';
  };

  return (
    <div
      className={`terminal-card border transition-all hover:shadow-lg ${getTrendColor(entity.trend_status)} group cursor-pointer`}
      onClick={() => onViewDetails(entity)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1">
          {getTrendIcon(entity.trend_status)}
          <h3 className="font-semibold text-slate-100 text-lg group-hover:text-emerald-400 transition-colors">
            {entity.entity_name}
          </h3>
        </div>
        {isTracked && (
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-900/50 border border-emerald-500 rounded text-xs font-medium text-emerald-400">
            <Star size={12} className="fill-emerald-400" />
            Watching
          </div>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>{entity.category}</span>
          <span className={`font-bold ${getGrowthColor(growthPercentage)}`}>
            {growthPercentage > 0 ? '+' : ''}{growthPercentage.toFixed(1)}%
          </span>
        </div>
        <TrendSparkline
          data={chartData}
          color={entity.trend_status === 'Exploding' ? '#fb923c' : '#10b981'}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <div className="text-slate-500">24h Volume</div>
          <div className="text-emerald-400 font-bold">{entity.volume_24h}</div>
        </div>
        <div>
          <div className="text-slate-500">Total Mentions</div>
          <div className="text-slate-200 font-bold">{entity.total_mentions}</div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleTracking(entity.id, isTracked);
          }}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded font-medium text-sm transition-colors ${
            isTracked
              ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isTracked ? (
            <>
              <EyeOff size={14} />
              Untrack
            </>
          ) : (
            <>
              <Eye size={14} />
              Track
            </>
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(entity);
          }}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded font-medium text-sm transition-colors"
        >
          <BarChart3 size={16} />
        </button>
      </div>
    </div>
  );
}
