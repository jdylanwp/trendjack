import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { aggregateMentionsByDate } from '../utils/trendCalculations';

export function useFutureTopics(user, trendFilter, categoryFilter) {
  const [entities, setEntities] = useState([]);
  const [watchedEntities, setWatchedEntities] = useState([]);
  const [trackedEntityIds, setTrackedEntityIds] = useState(new Set());
  const [entityCharts, setEntityCharts] = useState({});
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  const fetchGlobalTrends = useCallback(async () => {
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

      const { data, error } = await query.limit(100);
      if (error) throw error;

      setEntities(data || []);
      setCategories([...new Set(data?.map(e => e.category) || [])].sort());
    } catch (err) {
      console.error('Failed to fetch global trends:', err);
    } finally {
      setLoading(false);
    }
  }, [trendFilter, categoryFilter]);

  const fetchTrackedEntities = useCallback(async () => {
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
  }, [user]);

  const fetchWatchedEntities = useCallback(async () => {
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
  }, [user, trackedEntityIds]);

  const fetchEntityCharts = useCallback(async (entityIds) => {
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
          mention_date: mention.mention_date,
          mention_count: mention.mention_count,
        });
      });

      Object.keys(chartsByEntity).forEach(id => {
        chartsByEntity[id] = aggregateMentionsByDate(chartsByEntity[id]);
      });

      setEntityCharts(chartsByEntity);
    } catch (err) {
      console.error('Failed to fetch entity charts:', err);
    }
  }, []);

  const toggleTracking = useCallback(async (entityId, isTracked) => {
    if (!user) return;
    try {
      if (isTracked) {
        await supabase
          .from('entity_trackers')
          .delete()
          .eq('user_id', user.id)
          .eq('global_entity_id', entityId);
        setTrackedEntityIds(prev => {
          const next = new Set(prev);
          next.delete(entityId);
          return next;
        });
      } else {
        await supabase
          .from('entity_trackers')
          .insert({ user_id: user.id, global_entity_id: entityId, is_custom: false });
        setTrackedEntityIds(prev => new Set([...prev, entityId]));
      }
    } catch (err) {
      console.error('Failed to toggle tracking:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchGlobalTrends();
    fetchTrackedEntities();
  }, [fetchGlobalTrends, fetchTrackedEntities]);

  useEffect(() => {
    if (entities.length > 0) {
      fetchEntityCharts(entities.map(e => e.id));
    }
  }, [entities, fetchEntityCharts]);

  useEffect(() => {
    if (trackedEntityIds.size > 0) {
      fetchWatchedEntities();
    }
  }, [trackedEntityIds, fetchWatchedEntities]);

  return {
    entities,
    watchedEntities,
    trackedEntityIds,
    entityCharts,
    loading,
    categories,
    toggleTracking,
  };
}
