import { X, TrendingUp, Flame, Activity, Calendar } from 'lucide-react';
import { DetailedTrendChart } from './TrendChart';
import { getHistoricalComparison } from '../utils/trendCalculations';

export default function EntityDetailsModal({ entity, chartData, onClose }) {
  if (!entity) return null;

  const comparisons = getHistoricalComparison(chartData);

  const getComparisonColor = (value) => {
    if (value > 50) return 'text-emerald-400';
    if (value > 0) return 'text-emerald-300';
    if (value < -50) return 'text-red-400';
    if (value < 0) return 'text-red-300';
    return 'text-slate-400';
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
              {entity.trend_status === 'Exploding' ? (
                <Flame className="text-orange-400" size={28} />
              ) : (
                <TrendingUp className="text-emerald-400" size={28} />
              )}
              {entity.entity_name}
            </h2>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-slate-400">{entity.category}</span>
              <span className="px-2 py-1 bg-emerald-900/30 border border-emerald-500/50 rounded text-emerald-400 font-medium">
                {entity.trend_status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="terminal-card">
              <div className="text-slate-400 text-sm mb-1">Total Mentions</div>
              <div className="text-2xl font-bold text-slate-100">{entity.total_mentions}</div>
            </div>
            <div className="terminal-card">
              <div className="text-slate-400 text-sm mb-1">24h Volume</div>
              <div className="text-2xl font-bold text-emerald-400">{entity.volume_24h}</div>
            </div>
            <div className="terminal-card">
              <div className="text-slate-400 text-sm mb-1">Growth Slope</div>
              <div className={`text-2xl font-bold ${entity.growth_slope > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {entity.growth_slope > 0 ? '+' : ''}{entity.growth_slope?.toFixed(3) || '0.000'}
              </div>
            </div>
            <div className="terminal-card">
              <div className="text-slate-400 text-sm mb-1">Z-Score</div>
              <div className="text-2xl font-bold text-slate-100">{entity.z_score?.toFixed(2) || '0.00'}</div>
            </div>
          </div>

          {comparisons && Object.keys(comparisons).length > 0 && (
            <div className="terminal-card">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="text-emerald-400" size={20} />
                <h3 className="text-lg font-semibold text-slate-100">Historical Growth</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.entries(comparisons).map(([period, growth]) => (
                  <div key={period} className="bg-slate-800/50 rounded p-3 text-center">
                    <div className="text-slate-400 text-xs mb-1 uppercase">{period}</div>
                    <div className={`text-xl font-bold ${getComparisonColor(growth)}`}>
                      {growth > 0 ? '+' : ''}{growth.toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="terminal-card">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-emerald-400" size={20} />
              <h3 className="text-lg font-semibold text-slate-100">Mention Trend Over Time</h3>
            </div>
            <DetailedTrendChart data={chartData} entityName={entity.entity_name} />
          </div>

          {chartData && chartData.length > 0 && (
            <div className="terminal-card">
              <h3 className="text-sm font-semibold text-slate-100 mb-3">Data Points</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-400">First Seen:</span>
                  <span className="text-slate-200 ml-2 font-medium">
                    {new Date(chartData[0].date).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Latest Data:</span>
                  <span className="text-slate-200 ml-2 font-medium">
                    {new Date(chartData[chartData.length - 1].date).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Data Points:</span>
                  <span className="text-slate-200 ml-2 font-medium">{chartData.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
