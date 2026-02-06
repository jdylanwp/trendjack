import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Activity, Flame, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import { processChartData, deriveStats } from '../utils/dashboardHelpers';
import CronTimer from '../components/CronTimer';
import HeatScoreChart from '../components/HeatScoreChart';
import TrendingKeywordsTable from '../components/TrendingKeywordsTable';
import LeadQuadrantChart from '../components/LeadQuadrantChart';
import { StatCardSkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';
import { useSubscription } from '../contexts/SubscriptionContext';
import UpgradePrompt from '../components/UpgradePrompt';

export default function Dashboard() {
  const { limits, canPerformManualRun, refreshLimits, subscription } = useSubscription();
  const [trendData, setTrendData] = useState([]);
  const [trendingKeywords, setTrendingKeywords] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState(null);
  const [stats, setStats] = useState({ totalKeywords: 0, trendingCount: 0, avgHeatScore: 0 });

  const fetchDashboardData = useCallback(async () => {
    try {
      const [scoresResult, leadsResult] = await Promise.all([
        supabase
          .from('trend_scores')
          .select('*, monitored_keywords (keyword, related_subreddit)')
          .order('calculated_at', { ascending: false })
          .limit(100),
        supabase
          .from('leads')
          .select('id, intent_score, fury_score, pain_point, monitored_keywords(keyword)')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (scoresResult.error) throw scoresResult.error;
      if (leadsResult.data) setLeads(leadsResult.data);

      if (scoresResult.data?.length > 0) {
        setTrendData(processChartData(scoresResult.data));
        const { trending, stats: derived } = deriveStats(scoresResult.data);
        setTrendingKeywords(trending);
        setStats(derived);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useRealtimeSubscription('leads', {
    event: 'INSERT',
    onInsert: useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData]),
  });

  useRealtimeSubscription('trend_scores', {
    event: 'INSERT',
    onInsert: useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData]),
  });

  const handleManualRefresh = async () => {
    if (!canPerformManualRun()) {
      setRefreshMessage({
        type: 'error',
        text: `Manual refresh limit reached (${limits?.max_manual_runs_per_month} per month). Upgrade for more manual refreshes.`,
      });
      return;
    }

    setRefreshing(true);
    setRefreshMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual_refresh`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Refresh failed');

      setRefreshMessage({ type: 'success', text: result.message || 'Data refreshed successfully!' });
      await refreshLimits();
    } catch (error) {
      console.error('Manual refresh error:', error);
      setRefreshMessage({ type: 'error', text: error.message || 'Failed to refresh data' });
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMessage(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Dashboard</h1>
          <p className="text-slate-400">Monitor Lizard trending keywords and heat scores over time</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <ChartSkeleton />
        <TableSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Dashboard</h1>
          <p className="text-slate-400">Monitor trending keywords and heat scores over time</p>
        </div>
        {limits && limits.max_manual_runs_per_month > 0 && (
          <button
            onClick={handleManualRefresh}
            disabled={refreshing || !canPerformManualRun()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all flex items-center gap-2"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Now'}
            {limits && (
              <span className="text-xs opacity-75">
                ({limits.current_manual_runs}/{limits.max_manual_runs_per_month})
              </span>
            )}
          </button>
        )}
      </div>

      {refreshMessage && (
        <div className={`rounded-lg p-4 ${
          refreshMessage.type === 'success'
            ? 'bg-emerald-900/20 border border-emerald-500 text-emerald-400'
            : 'bg-red-900/20 border border-red-500 text-red-400'
        }`}>
          <p>{refreshMessage.text}</p>
        </div>
      )}

      {subscription?.tier_id === 'free' && (
        <UpgradePrompt
          feature="Unlock manual data refreshes to get the latest trends on-demand. Pro users get 50 manual refreshes per month."
          targetTier="Pro"
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="terminal-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-900/30 rounded-lg">
              <Activity className="text-emerald-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Total Keywords</p>
              <p className="text-2xl font-bold text-slate-100">{stats.totalKeywords}</p>
            </div>
          </div>
        </div>
        <div className="terminal-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-900/30 rounded-lg">
              <Flame className="text-orange-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Trending Now</p>
              <p className="text-2xl font-bold text-slate-100">{stats.trendingCount}</p>
            </div>
          </div>
        </div>
        <div className="terminal-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-900/30 rounded-lg">
              <TrendingUp className="text-blue-400" size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Avg Heat Score</p>
              <p className="text-2xl font-bold text-slate-100">{stats.avgHeatScore}</p>
            </div>
          </div>
        </div>
      </div>

      <CronTimer />
      <HeatScoreChart data={trendData} />
      <TrendingKeywordsTable keywords={trendingKeywords} />
      <LeadQuadrantChart leads={leads} />
    </div>
  );
}
