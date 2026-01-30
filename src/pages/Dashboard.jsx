import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, Cell } from 'recharts';
import { TrendingUp, Activity, Flame, BarChart3, RefreshCw, Zap, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CronTimer from '../components/CronTimer';
import EmptyState from '../components/EmptyState';
import { StatCardSkeleton, ChartSkeleton, TableSkeleton } from '../components/Skeleton';
import { useSubscription } from '../contexts/SubscriptionContext';
import UpgradePrompt from '../components/UpgradePrompt';

export default function Dashboard() {
  const { limits, canPerformManualRun, trackUsage, subscription, refreshLimits } = useSubscription();
  const [trendData, setTrendData] = useState([]);
  const [trendingKeywords, setTrendingKeywords] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState(null);
  const [stats, setStats] = useState({
    totalKeywords: 0,
    trendingCount: 0,
    avgHeatScore: 0,
  });

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [scoresResult, leadsResult] = await Promise.all([
        supabase
          .from('trend_scores')
          .select(`
            *,
            monitored_keywords (
              keyword,
              related_subreddit
            )
          `)
          .order('calculated_at', { ascending: false })
          .limit(100),
        supabase
          .from('leads')
          .select('id, intent_score, fury_score, pain_point, monitored_keywords(keyword)')
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      const { data: scores, error: scoresError } = scoresResult;
      const { data: leadsData, error: leadsError } = leadsResult;

      if (scoresError) throw scoresError;
      if (leadsData) setLeads(leadsData);

      if (scores && scores.length > 0) {
        const chartData = processChartData(scores);
        setTrendData(chartData);

        // Deduplicate trending keywords by keyword name (in case both system and user have same keyword)
        const trendingMap = new Map();
        scores
          .filter(s => s.is_trending)
          .forEach(s => {
            const keyword = s.monitored_keywords?.keyword || 'Unknown';
            const heatScore = parseFloat(s.heat_score);

            // Keep the entry with highest heat score for each unique keyword name
            if (!trendingMap.has(keyword) || trendingMap.get(keyword).heatScore < heatScore) {
              trendingMap.set(keyword, {
                id: s.id,
                keyword,
                subreddit: s.monitored_keywords?.related_subreddit || 'Unknown',
                heatScore: heatScore.toFixed(2),
                calculatedAt: new Date(s.calculated_at).toLocaleString(),
              });
            }
          });

        const trending = Array.from(trendingMap.values())
          .sort((a, b) => parseFloat(b.heatScore) - parseFloat(a.heatScore))
          .slice(0, 10);

        setTrendingKeywords(trending);

        const avgHeat = scores
          .filter(s => s.is_trending)
          .reduce((sum, s) => sum + parseFloat(s.heat_score), 0) / (scores.filter(s => s.is_trending).length || 1);

        // Deduplicate keywords by name for accurate counts
        const uniqueKeywords = new Set(scores.map(s => s.monitored_keywords?.keyword).filter(Boolean));

        setStats({
          totalKeywords: uniqueKeywords.size,
          trendingCount: trendingMap.size,
          avgHeatScore: avgHeat.toFixed(2),
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (scores) => {
    const dataByKeyword = {};

    scores.forEach(score => {
      const keyword = score.monitored_keywords?.keyword || 'Unknown';
      const date = new Date(score.calculated_at).toLocaleDateString();

      if (!dataByKeyword[date]) {
        dataByKeyword[date] = { date };
      }

      // If keyword already exists for this date, take the max heat score
      // This handles duplicate keywords (system + user keywords with same name)
      const currentScore = parseFloat(score.heat_score);
      if (!dataByKeyword[date][keyword] || dataByKeyword[date][keyword] < currentScore) {
        dataByKeyword[date][keyword] = currentScore;
      }
    });

    return Object.values(dataByKeyword).slice(0, 20).reverse();
  };

  const handleManualRefresh = async () => {
    if (!canPerformManualRun()) {
      setRefreshMessage({
        type: 'error',
        text: `Manual refresh limit reached (${limits?.max_manual_runs_per_month} per month). Upgrade for more manual refreshes.`
      });
      return;
    }

    setRefreshing(true);
    setRefreshMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manual_refresh`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Refresh failed');
      }

      setRefreshMessage({
        type: 'success',
        text: result.message || 'Data refreshed successfully!'
      });

      await refreshLimits();
      await fetchDashboardData();
    } catch (error) {
      console.error('Manual refresh error:', error);
      setRefreshMessage({
        type: 'error',
        text: error.message || 'Failed to refresh data'
      });
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
          <p className="text-slate-400">Monitor trending keywords and heat scores over time</p>
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

      <div className="terminal-card">
        <h2 className="text-xl font-bold text-slate-100 mb-4">Heat Score Trends</h2>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                stroke="#64748b"
                style={{ fontSize: '12px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              {Object.keys(trendData[0] || {})
                .filter(key => key !== 'date')
                .map((keyword, idx) => (
                  <Line
                    key={keyword}
                    type="monotone"
                    dataKey={keyword}
                    stroke={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12">
            <BarChart3 className="text-slate-600 mx-auto mb-4" size={48} />
            <p className="text-slate-400">No trend data yet</p>
            <p className="text-slate-500 text-sm mt-2">
              The automated system will start collecting trend data shortly. Chart will populate as keywords are monitored.
            </p>
          </div>
        )}
      </div>

      <div className="terminal-card">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Flame className="text-orange-400" size={20} />
          Trending Keywords
        </h2>
        {trendingKeywords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Subreddit</th>
                  <th>Heat Score</th>
                  <th>Last Calculated</th>
                </tr>
              </thead>
              <tbody>
                {trendingKeywords.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold text-emerald-400">{item.keyword}</td>
                    <td className="text-slate-300">r/{item.subreddit}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-orange-400 font-semibold">
                        <Flame size={16} />
                        {item.heatScore}
                      </span>
                    </td>
                    <td className="text-slate-400 text-xs">{item.calculatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Flame className="text-slate-600 mx-auto mb-4" size={48} />
            <p className="text-slate-400">No trending keywords yet</p>
            <p className="text-slate-500 text-sm mt-2">
              Keywords will appear here when they show increased activity on Reddit. The system checks every 15 minutes.
            </p>
          </div>
        )}
      </div>

      {leads.length > 0 && (
        <div className="terminal-card">
          <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
            <Target className="text-red-400" size={20} />
            Lead Quadrant Analysis
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Leads plotted by Intent Score (buying readiness) vs Fury Score (frustration level). Red Zone = high intent + high fury.
          </p>

          <ResponsiveContainer width="100%" height={500}>
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                type="number"
                dataKey="intent_score"
                name="Intent Score"
                domain={[70, 100]}
                stroke="#64748b"
                label={{ value: 'Intent Score (Buying Readiness)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }}
              />
              <YAxis
                type="number"
                dataKey="fury_score"
                name="Fury Score"
                domain={[0, 100]}
                stroke="#64748b"
                label={{ value: 'Fury Score (Frustration)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
                        <p className="text-slate-300 font-semibold mb-2">{data.monitored_keywords?.keyword}</p>
                        <p className="text-emerald-400 text-sm">Intent: {data.intent_score}</p>
                        <p className="text-orange-400 text-sm">Fury: {data.fury_score || 0}</p>
                        <p className="text-slate-400 text-xs mt-2 max-w-xs">{data.pain_point}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={leads} shape="circle">
                {leads.map((lead, index) => {
                  let color = '#64748b';
                  if (lead.intent_score >= 85 && (lead.fury_score || 0) >= 75) {
                    color = '#ef4444';
                  } else if (lead.intent_score >= 85) {
                    color = '#10b981';
                  } else if ((lead.fury_score || 0) >= 75) {
                    color = '#f97316';
                  }
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm font-semibold text-red-400">RED ZONE</span>
              </div>
              <p className="text-xs text-slate-400">High Intent + High Fury</p>
              <p className="text-2xl font-bold text-red-400 mt-2">
                {leads.filter(l => l.intent_score >= 85 && (l.fury_score || 0) >= 75).length}
              </p>
            </div>
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-semibold text-emerald-400">HIGH INTENT</span>
              </div>
              <p className="text-xs text-slate-400">High Intent + Low Fury</p>
              <p className="text-2xl font-bold text-emerald-400 mt-2">
                {leads.filter(l => l.intent_score >= 85 && (l.fury_score || 0) < 75).length}
              </p>
            </div>
            <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-sm font-semibold text-orange-400">HIGH FURY</span>
              </div>
              <p className="text-xs text-slate-400">Low Intent + High Fury</p>
              <p className="text-2xl font-bold text-orange-400 mt-2">
                {leads.filter(l => l.intent_score < 85 && (l.fury_score || 0) >= 75).length}
              </p>
            </div>
            <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                <span className="text-sm font-semibold text-slate-400">STANDARD</span>
              </div>
              <p className="text-xs text-slate-400">Low Intent + Low Fury</p>
              <p className="text-2xl font-bold text-slate-400 mt-2">
                {leads.filter(l => l.intent_score < 85 && (l.fury_score || 0) < 75).length}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
