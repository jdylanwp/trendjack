import { Eye, EyeOff, Flame, TrendingUp, TrendingDown, Activity, Zap, Star, BarChart3, ArrowUp } from 'lucide-react';
import { TrendSparkline } from './TrendChart';
import { calculateGrowthPercentage } from '../utils/trendCalculations';
import { getPredictionLabel } from '../utils/predictiveMath';

const TREND_ICONS = {
  Exploding: { icon: Flame, color: 'text-orange-400' },
  'Slow Burn': { icon: TrendingUp, color: 'text-emerald-400' },
  Declining: { icon: TrendingDown, color: 'text-red-400' },
  Peaked: { icon: Activity, color: 'text-amber-400' },
};

const TREND_COLORS = {
  Exploding: 'border-orange-500/50 bg-orange-900/10 hover:border-orange-500',
  'Slow Burn': 'border-emerald-500/50 bg-emerald-900/10 hover:border-emerald-500',
  Declining: 'border-red-500/50 bg-red-900/10 hover:border-red-500',
  Peaked: 'border-amber-500/50 bg-amber-900/10 hover:border-amber-500',
};

function getGrowthColor(growth) {
  if (growth > 50) return 'text-emerald-400';
  if (growth > 0) return 'text-emerald-300';
  if (growth < -50) return 'text-red-400';
  if (growth < 0) return 'text-red-300';
  return 'text-slate-400';
}

function getGForceColor(gForce) {
  if (gForce >= 10) return 'text-orange-400';
  if (gForce >= 5) return 'text-amber-400';
  if (gForce > 0) return 'text-emerald-400';
  return 'text-slate-400';
}

export default function EntityCard({
  entity,
  chartData,
  isTracked,
  onToggleTracking,
  onViewDetails,
  timeRange,
  dynamics,
  showPrediction,
}) {
  const trendConfig = TREND_ICONS[entity.trend_status] || { icon: Zap, color: 'text-blue-400' };
  const TrendIcon = trendConfig.icon;
  const trendColor = TREND_COLORS[entity.trend_status] || 'border-blue-500/50 bg-blue-900/10 hover:border-blue-500';
  const growthPercentage = calculateGrowthPercentage(chartData, timeRange);
  const predictionLabel = showPrediction && dynamics ? getPredictionLabel(dynamics.gForce) : null;

  return (
    <div
      className={`terminal-card border transition-all hover:shadow-lg ${trendColor} group cursor-pointer relative`}
      onClick={() => onViewDetails(entity)}
    >
      {predictionLabel && (
        <div className={`absolute -top-2.5 -right-2.5 z-10 px-2 py-0.5 rounded-full text-[10px] font-bold border ${predictionLabel.bg} ${predictionLabel.color} animate-pulse`}>
          {predictionLabel.label}
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TrendIcon className={trendConfig.color} size={18} />
          <h3 className="font-semibold text-slate-100 text-lg group-hover:text-emerald-400 transition-colors truncate">
            {entity.entity_name}
          </h3>
        </div>
        {isTracked && (
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-900/50 border border-emerald-500 rounded text-xs font-medium text-emerald-400 flex-shrink-0">
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

      <div className={`grid ${showPrediction && dynamics ? 'grid-cols-4' : 'grid-cols-2'} gap-2 text-xs mb-3`}>
        <div>
          <div className="text-slate-500">24h Vol</div>
          <div className="text-emerald-400 font-bold">{entity.volume_24h}</div>
        </div>
        <div>
          <div className="text-slate-500">Mentions</div>
          <div className="text-slate-200 font-bold">{entity.total_mentions}</div>
        </div>
        {showPrediction && dynamics && (
          <>
            <div>
              <div className="text-slate-500">Velocity</div>
              <div className={`font-bold ${dynamics.velocity > 0 ? 'text-emerald-400' : dynamics.velocity < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {dynamics.velocity > 0 ? '+' : ''}{dynamics.velocity}
              </div>
            </div>
            <div>
              <div className="text-slate-500">G-Force</div>
              <div className={`font-bold ${getGForceColor(dynamics.gForce)}`}>
                {dynamics.gForce}
              </div>
            </div>
          </>
        )}
      </div>

      {showPrediction && dynamics && dynamics.acceleration !== 0 && (
        <div className={`flex items-center gap-1.5 text-xs mb-3 px-2 py-1 rounded ${
          dynamics.acceleration > 0
            ? 'bg-emerald-900/30 text-emerald-400'
            : 'bg-red-900/30 text-red-400'
        }`}>
          <ArrowUp size={12} className={dynamics.acceleration < 0 ? 'rotate-180' : ''} />
          {dynamics.acceleration > 0 ? 'Accelerating' : 'Decelerating'}
          <span className="text-slate-500 ml-auto">{dynamics.confidence}% confidence</span>
        </div>
      )}

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
          {isTracked ? <><EyeOff size={14} /> Untrack</> : <><Eye size={14} /> Track</>}
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
