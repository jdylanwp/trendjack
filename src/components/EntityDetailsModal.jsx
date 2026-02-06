import { X, TrendingUp, Flame, Activity, Calendar, Gauge } from 'lucide-react';
import { DetailedTrendChart } from './TrendChart';
import { getHistoricalComparison } from '../utils/trendCalculations';

function getComparisonColor(value) {
  if (value > 50) return 'text-emerald-400';
  if (value > 0) return 'text-emerald-300';
  if (value < -50) return 'text-red-400';
  if (value < 0) return 'text-red-300';
  return 'text-slate-400';
}

function getValueColor(val) {
  if (val > 0) return 'text-emerald-400';
  if (val < 0) return 'text-red-400';
  return 'text-slate-400';
}

function getGForceColor(gForce) {
  if (gForce >= 10) return 'text-orange-400';
  if (gForce >= 5) return 'text-amber-400';
  if (gForce > 0) return 'text-emerald-400';
  return 'text-slate-400';
}

function PredictionPanel({ dynamics, snapMetric }) {
  return (
    <div className="terminal-card bg-gradient-to-r from-purple-900/20 to-slate-800 border-purple-500/30">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="text-purple-400" size={20} />
        <h3 className="text-lg font-semibold text-slate-100">Prediction Analysis</h3>
        {snapMetric && snapMetric.signal !== 'Insufficient Data' && (
          <span className={`ml-auto px-2.5 py-1 rounded text-xs font-bold ${snapMetric.signalColor} bg-slate-800/80 border border-slate-600`}>
            {snapMetric.signal}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-800/60 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">Velocity</div>
          <div className={`text-xl font-bold ${getValueColor(dynamics.velocity)}`}>
            {dynamics.velocity > 0 ? '+' : ''}{dynamics.velocity}
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">Acceleration</div>
          <div className={`text-xl font-bold ${getValueColor(dynamics.acceleration)}`}>
            {dynamics.acceleration > 0 ? '+' : ''}{dynamics.acceleration}
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">G-Force</div>
          <div className={`text-xl font-bold ${getGForceColor(dynamics.gForce)}`}>
            {dynamics.gForce}
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">Confidence</div>
          <div className="text-xl font-bold text-slate-100">{dynamics.confidence}%</div>
          <div className="w-full bg-slate-700 rounded-full h-1 mt-1.5">
            <div
              className="bg-purple-500 h-1 rounded-full transition-all"
              style={{ width: `${dynamics.confidence}%` }}
            />
          </div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">Current Vol</div>
          <div className="text-xl font-bold text-slate-100">{dynamics.currentVolume}</div>
        </div>
      </div>
    </div>
  );
}

export default function EntityDetailsModal({ entity, chartData, dynamics, snapMetric, onClose }) {
  if (!entity) return null;

  const comparisons = getHistoricalComparison(chartData);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {dynamics && <PredictionPanel dynamics={dynamics} snapMetric={snapMetric} />}

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
