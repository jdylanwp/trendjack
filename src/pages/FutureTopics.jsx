import { useState, useMemo } from 'react';
import { Sparkles, Zap, Star, Gauge } from 'lucide-react';
import { Skeleton } from '../components/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import UpgradePrompt from '../components/UpgradePrompt';
import EntityCard from '../components/EntityCard';
import EntityDetailsModal from '../components/EntityDetailsModal';
import TrendFilters from '../components/TrendFilters';
import { useFutureTopics } from '../hooks/useFutureTopics';
import { filterDataByTimeRange } from '../utils/trendCalculations';
import { calculateTrendDynamics, calculateSnapMetric } from '../utils/predictiveMath';

export default function FutureTopics() {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [trendFilter, setTrendFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [showWatchedOnly, setShowWatchedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('default');

  const {
    entities, watchedEntities, trackedEntityIds, entityCharts,
    loading, categories, toggleTracking,
  } = useFutureTopics(user, trendFilter, categoryFilter);

  const entityDynamicsMap = useMemo(() => {
    const map = {};
    const seen = new Set();
    [...entities, ...watchedEntities].forEach(entity => {
      if (seen.has(entity.id)) return;
      seen.add(entity.id);
      const chartData = entityCharts[entity.id] || [];
      if (chartData.length >= 3) {
        map[entity.id] = {
          dynamics: calculateTrendDynamics(chartData),
          snap: calculateSnapMetric(chartData),
        };
      }
    });
    return map;
  }, [entities, watchedEntities, entityCharts]);

  const sortedEntities = useMemo(() => {
    const list = showWatchedOnly ? watchedEntities : entities;
    if (sortBy !== 'predictive') return list;
    return [...list].sort((a, b) => {
      const gA = entityDynamicsMap[a.id]?.dynamics?.gForce || 0;
      const gB = entityDynamicsMap[b.id]?.dynamics?.gForce || 0;
      return gB - gA;
    });
  }, [entities, watchedEntities, showWatchedOnly, sortBy, entityDynamicsMap]);

  const predictiveStats = useMemo(() => {
    const values = Object.values(entityDynamicsMap);
    return {
      accelerating: values.filter(v => v.dynamics?.acceleration > 0).length,
      highGForce: values.filter(v => v.dynamics?.gForce >= 5).length,
      total: values.length,
    };
  }, [entityDynamicsMap]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Gauge className="text-emerald-400" size={32} />
            Prediction Engine
          </h1>
          <p className="text-slate-400 mt-2">Analyzing trend dynamics...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="terminal-card">
              <Skeleton width="w-full" height="h-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Gauge className="text-emerald-400" size={32} />
            Prediction Engine
          </h1>
          <p className="text-slate-400 mt-2">
            Calculus-based trend analysis — discover breakouts before they happen
          </p>
        </div>
        <button
          onClick={() => setSortBy(sortBy === 'predictive' ? 'default' : 'predictive')}
          className={`group flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-300 ${
            sortBy === 'predictive'
              ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.5)]'
              : 'bg-slate-700 text-slate-300 hover:bg-purple-600 hover:text-white hover:shadow-[0_0_15px_rgba(147,51,234,0.4)]'
          }`}
        >
          <Sparkles size={18} className={sortBy === 'predictive' ? 'animate-pulse' : ''} />
          {sortBy === 'predictive' ? 'Showing Hidden Gems' : 'Predict Hidden Gems'}
        </button>
      </div>

      {sortBy === 'predictive' && predictiveStats.total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="terminal-card bg-gradient-to-r from-purple-900/20 to-slate-800 border-purple-500/30">
            <div className="text-xs text-purple-300 mb-1">Accelerating</div>
            <div className="text-2xl font-bold text-purple-400">{predictiveStats.accelerating}</div>
          </div>
          <div className="terminal-card bg-gradient-to-r from-orange-900/20 to-slate-800 border-orange-500/30">
            <div className="text-xs text-orange-300 mb-1">High G-Force</div>
            <div className="text-2xl font-bold text-orange-400">{predictiveStats.highGForce}</div>
          </div>
          <div className="terminal-card bg-gradient-to-r from-emerald-900/20 to-slate-800 border-emerald-500/30">
            <div className="text-xs text-emerald-300 mb-1">Total Analyzed</div>
            <div className="text-2xl font-bold text-emerald-400">{predictiveStats.total}</div>
          </div>
        </div>
      )}

      {subscription?.tier_id === 'free' && (
        <UpgradePrompt
          feature="Unlock custom tracking and advanced analytics with Pro or Enterprise"
          targetTier="Pro"
        />
      )}

      <TrendFilters
        trendFilter={trendFilter}
        setTrendFilter={setTrendFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        categories={categories}
        timeRange={timeRange}
        setTimeRange={setTimeRange}
        showWatchedOnly={showWatchedOnly}
        setShowWatchedOnly={setShowWatchedOnly}
        trackedCount={trackedEntityIds.size}
        hasUser={!!user}
      />

      {showWatchedOnly && watchedEntities.length > 0 && (
        <div className="flex items-center gap-3 mb-2">
          <Star className="text-emerald-400 fill-emerald-400" size={24} />
          <h2 className="text-xl font-bold text-slate-100">Your Watched Topics</h2>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedEntities.map(entity => {
          const chartData = filterDataByTimeRange(entityCharts[entity.id] || [], timeRange);
          const dyn = entityDynamicsMap[entity.id];
          return (
            <EntityCard
              key={entity.id}
              entity={entity}
              chartData={chartData}
              isTracked={trackedEntityIds.has(entity.id)}
              onToggleTracking={toggleTracking}
              onViewDetails={setSelectedEntity}
              timeRange={timeRange}
              dynamics={dyn?.dynamics}
              showPrediction={sortBy === 'predictive'}
            />
          );
        })}
      </div>

      {sortedEntities.length === 0 && (
        <div className="terminal-card text-center py-12">
          <Zap className="text-slate-600 mx-auto mb-4" size={48} />
          <p className="text-slate-400 text-lg">No trends found for this filter</p>
          <p className="text-slate-500 text-sm mt-2">
            Try changing your filters or check back soon as trends accumulate
          </p>
        </div>
      )}

      <div className="terminal-card bg-gradient-to-r from-slate-800/50 to-emerald-900/20 border-emerald-500/30">
        <div className="flex items-start gap-4">
          <Gauge className="text-emerald-400 flex-shrink-0 mt-1" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">How Prediction Works</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              Our engine uses calculus-based analysis to detect acceleration patterns invisible to volume-based trackers.
              G-Force scoring rewards topics with high acceleration but low current volume — the hidden gems about to explode.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="text-xs font-semibold text-orange-400 mb-1">IMMINENT BREAKOUT</div>
                <p className="text-xs text-slate-400">G-Force 20+ — act now</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="text-xs font-semibold text-amber-400 mb-1">HIGH G-FORCE</div>
                <p className="text-xs text-slate-400">G-Force 10+ — strong signal</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="text-xs font-semibold text-emerald-400 mb-1">BUILDING MOMENTUM</div>
                <p className="text-xs text-slate-400">G-Force 5+ — watch closely</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="text-xs font-semibold text-cyan-400 mb-1">EARLY SIGNAL</div>
                <p className="text-xs text-slate-400">Positive G-Force detected</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedEntity && (
        <EntityDetailsModal
          entity={selectedEntity}
          chartData={entityCharts[selectedEntity.id] || []}
          dynamics={entityDynamicsMap[selectedEntity.id]?.dynamics}
          snapMetric={entityDynamicsMap[selectedEntity.id]?.snap}
          onClose={() => setSelectedEntity(null)}
        />
      )}
    </div>
  );
}
