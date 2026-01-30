import { useState, useEffect } from 'react';
import { TrendingUp, Flame, TrendingDown, Activity, Zap, Filter, Star, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Skeleton } from '../components/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import UpgradePrompt from '../components/UpgradePrompt';
import EntityCard from '../components/EntityCard';
import EntityDetailsModal from '../components/EntityDetailsModal';
import { TIME_RANGES, filterDataByTimeRange, aggregateMentionsByDate } from '../utils/trendCalculations';

export default function FutureTopics() {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [entities, setEntities] = useState([]);
  const [watchedEntities, setWatchedEntities] = useState([]);
  const [trackedEntityIds, setTrackedEntityIds] = useState(new Set());
  const [entityCharts, setEntityCharts] = useState({});
  const [loading, setLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [trendFilter, setTrendFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('30d');
  const [categories, setCategories] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [showWatchedOnly, setShowWatchedOnly] = useState(false);

  useEffect(() => {
    fetchGlobalTrends();
    fetchTrackedEntities();
  }, [trendFilter, categoryFilter]);

  useEffect(() => {
    if (entities.length > 0) {
      fetchEntityCharts(entities.map(e => e.id));
    }
  }, [entities, timeRange]);

  useEffect(() => {
    if (trackedEntityIds.size > 0) {
      fetchWatchedEntities();
    }
  }, [trackedEntityIds]);

  const fetchGlobalTrends = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('global_entities')
        .select('*')
        .gte('total_mentions', 3);

      if (trendFilter === 'exploding') {
        query = query.eq('trend_status', 'Exploding').order('z_score', { ascending: false });
      } else if (trendFilter === 'slow_burn') {
        query = query.eq('trend_status', 'Slow Burn').order('growth_slope', { ascending: false });
      } else if (trendFilter === 'new') {
        query = query.eq('trend_status', 'New').order('created_at', { ascending: false });
      } else {
        query = query.order('volume_24h', { ascending: false });
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      query = query.limit(100);

      const { data, error } = await query;

      if (error) throw error;

      setEntities(data || []);

      const uniqueCategories = [...new Set(data?.map(e => e.category) || [])].sort();
      setCategories(uniqueCategories);
    } catch (err) {
      console.error('Failed to fetch global trends:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrackedEntities = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('entity_trackers')
        .select('global_entity_id')
        .eq('user_id', user.id);

      if (error) throw error;

      setTrackedEntityIds(new Set(data?.map(t => t.global_entity_id) || []));
    } catch (err) {
      console.error('Failed to fetch tracked entities:', err);
    }
  };

  const fetchWatchedEntities = async () => {
    if (!user || trackedEntityIds.size === 0) return;

    try {
      const { data, error } = await supabase
        .from('global_entities')
        .select('*')
        .in('id', Array.from(trackedEntityIds))
        .order('volume_24h', { ascending: false });

      if (error) throw error;

      setWatchedEntities(data || []);
    } catch (err) {
      console.error('Failed to fetch watched entities:', err);
    }
  };

  const fetchEntityCharts = async (entityIds) => {
    setChartsLoading(true);
    try {
      const { data, error } = await supabase
        .from('entity_mentions')
        .select('global_entity_id, mention_date, mention_count')
        .in('global_entity_id', entityIds)
        .order('mention_date', { ascending: true });

      if (error) throw error;

      const chartsByEntity = {};
      (data || []).forEach(mention => {
        if (!chartsByEntity[mention.global_entity_id]) {
          chartsByEntity[mention.global_entity_id] = [];
        }
        chartsByEntity[mention.global_entity_id].push({
          date: mention.mention_date,
          count: mention.mention_count,
        });
      });

      Object.keys(chartsByEntity).forEach(entityId => {
        chartsByEntity[entityId] = aggregateMentionsByDate(
          chartsByEntity[entityId].map(d => ({
            mention_date: d.date,
            mention_count: d.count,
          }))
        );
      });

      setEntityCharts(chartsByEntity);
    } catch (err) {
      console.error('Failed to fetch entity charts:', err);
    } finally {
      setChartsLoading(false);
    }
  };

  const toggleTracking = async (entityId, isTracked) => {
    if (!user) return;

    try {
      if (isTracked) {
        const { error } = await supabase
          .from('entity_trackers')
          .delete()
          .eq('user_id', user.id)
          .eq('global_entity_id', entityId);

        if (error) throw error;

        setTrackedEntityIds(prev => {
          const updated = new Set(prev);
          updated.delete(entityId);
          return updated;
        });
      } else {
        const { error } = await supabase
          .from('entity_trackers')
          .insert({
            user_id: user.id,
            global_entity_id: entityId,
            is_custom: false,
          });

        if (error) throw error;

        setTrackedEntityIds(prev => new Set([...prev, entityId]));
      }
    } catch (err) {
      console.error('Failed to toggle tracking:', err);
    }
  };


  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
              <TrendingUp className="text-emerald-400" size={32} />
              Global Trend Discovery
            </h1>
            <p className="text-slate-400 mt-2">
              Real-time trends discovered across all users - track what matters to you
            </p>
          </div>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <TrendingUp className="text-emerald-400" size={32} />
            Global Trend Discovery
          </h1>
          <p className="text-slate-400 mt-2">
            Real-time trends discovered across all users - track what matters to you
          </p>
        </div>
      </div>

      {subscription?.tier_id === 'free' && (
        <UpgradePrompt
          feature="Unlock custom tracking and advanced analytics with Pro or Enterprise"
          targetTier="Pro"
        />
      )}

      <div className="terminal-card space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="text-slate-400" size={18} />
            <button
              onClick={() => setTrendFilter('all')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                trendFilter === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              All Trends
            </button>
            <button
              onClick={() => setTrendFilter('exploding')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
                trendFilter === 'exploding'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Flame size={14} />
              Exploding
            </button>
            <button
              onClick={() => setTrendFilter('slow_burn')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
                trendFilter === 'slow_burn'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <TrendingUp size={14} />
              Slow Burn
            </button>
            <button
              onClick={() => setTrendFilter('new')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
                trendFilter === 'new'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Zap size={14} />
              New
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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

        {user && trackedEntityIds.size > 0 && (
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
            <span className="text-slate-400 text-sm">
              ({trackedEntityIds.size} watching)
            </span>
          </div>
        )}
      </div>

      {showWatchedOnly && watchedEntities.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Star className="text-emerald-400 fill-emerald-400" size={24} />
            <h2 className="text-xl font-bold text-slate-100">Your Watched Topics</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchedEntities.map((entity) => {
              const chartData = filterDataByTimeRange(entityCharts[entity.id] || [], timeRange);
              return (
                <EntityCard
                  key={entity.id}
                  entity={entity}
                  chartData={chartData}
                  isTracked={true}
                  onToggleTracking={toggleTracking}
                  onViewDetails={setSelectedEntity}
                  timeRange={timeRange}
                />
              );
            })}
          </div>
        </div>
      )}

      {!showWatchedOnly && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entities.map((entity) => {
            const isTracked = trackedEntityIds.has(entity.id);
            const chartData = filterDataByTimeRange(entityCharts[entity.id] || [], timeRange);

            return (
              <EntityCard
                key={entity.id}
                entity={entity}
                chartData={chartData}
                isTracked={isTracked}
                onToggleTracking={toggleTracking}
                onViewDetails={setSelectedEntity}
                timeRange={timeRange}
              />
            );
          })}
        </div>
      )}

      {entities.length === 0 && (
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
          <TrendingUp className="text-emerald-400 flex-shrink-0 mt-1" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">How Global Discovery Works</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              Every user search contributes to the global trend database. As more people monitor keywords,
              we discover and rank emerging entities using AI-powered named entity recognition. Track any
              trend to add it to your personal monitoring list and view detailed historical charts.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
              <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="text-orange-400" size={16} />
                  <span className="text-xs font-semibold text-orange-400">EXPLODING</span>
                </div>
                <p className="text-xs text-slate-400">Sudden spike in mentions - breaking news</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="text-emerald-400" size={16} />
                  <span className="text-xs font-semibold text-emerald-400">SLOW BURN</span>
                </div>
                <p className="text-xs text-slate-400">Steady upward trajectory - future opportunity</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="text-blue-400" size={16} />
                  <span className="text-xs font-semibold text-blue-400">NEW</span>
                </div>
                <p className="text-xs text-slate-400">Just discovered - watch for momentum</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="text-amber-400" size={16} />
                  <span className="text-xs font-semibold text-amber-400">PEAKED</span>
                </div>
                <p className="text-xs text-slate-400">High volume sustained - mature trend</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedEntity && (
        <EntityDetailsModal
          entity={selectedEntity}
          chartData={entityCharts[selectedEntity.id] || []}
          onClose={() => setSelectedEntity(null)}
        />
      )}
    </div>
  );
}
