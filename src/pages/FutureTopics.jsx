import { useState, useEffect } from 'react';
import { TrendingUp, Eye, EyeOff, Flame, TrendingDown, Activity, Zap, Filter, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Skeleton } from '../components/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import UpgradePrompt from '../components/UpgradePrompt';

export default function FutureTopics() {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [entities, setEntities] = useState([]);
  const [trackedEntityIds, setTrackedEntityIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [trendFilter, setTrendFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchGlobalTrends();
    fetchTrackedEntities();
  }, [trendFilter, categoryFilter]);

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
        return 'border-orange-500/50 bg-orange-900/10';
      case 'Slow Burn':
        return 'border-emerald-500/50 bg-emerald-900/10';
      case 'Declining':
        return 'border-red-500/50 bg-red-900/10';
      case 'Peaked':
        return 'border-amber-500/50 bg-amber-900/10';
      default:
        return 'border-blue-500/50 bg-blue-900/10';
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

      <div className="terminal-card">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
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

          <div className="flex items-center gap-2">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.map((entity) => {
          const isTracked = trackedEntityIds.has(entity.id);

          return (
            <div
              key={entity.id}
              className={`terminal-card border transition-all hover:scale-105 ${getTrendColor(entity.trend_status)}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                  {getTrendIcon(entity.trend_status)}
                  <h3 className="font-semibold text-slate-100 text-lg">{entity.entity_name}</h3>
                </div>
                {isTracked && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-emerald-900/50 border border-emerald-500 rounded text-xs font-medium text-emerald-400">
                    <Star size={12} className="fill-emerald-400" />
                    Watching
                  </div>
                )}
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Category</span>
                  <span className="text-slate-200 font-medium">{entity.category}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Status</span>
                  <span className="text-slate-200 font-medium">{entity.trend_status}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">24h Volume</span>
                  <span className="text-emerald-400 font-bold">{entity.volume_24h}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Growth Slope</span>
                  <span className={`font-bold ${entity.growth_slope > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {entity.growth_slope > 0 ? '+' : ''}{entity.growth_slope?.toFixed(3) || '0.000'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Z-Score</span>
                  <span className="text-slate-200 font-medium">{entity.z_score?.toFixed(2) || '0.00'}</span>
                </div>
              </div>

              <button
                onClick={() => toggleTracking(entity.id, isTracked)}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded font-medium text-sm transition-colors ${
                  isTracked
                    ? 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isTracked ? (
                  <>
                    <EyeOff size={16} />
                    Untrack
                  </>
                ) : (
                  <>
                    <Eye size={16} />
                    Track This
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

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
              trend to add it to your personal monitoring list.
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
    </div>
  );
}
