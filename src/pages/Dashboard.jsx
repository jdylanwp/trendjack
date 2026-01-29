import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Activity, Flame } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const [trendData, setTrendData] = useState([]);
  const [trendingKeywords, setTrendingKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const { data: scores, error: scoresError } = await supabase
        .from('trend_scores')
        .select(`
          *,
          monitored_keywords (
            keyword,
            related_subreddit
          )
        `)
        .order('calculated_at', { ascending: false })
        .limit(100);

      if (scoresError) throw scoresError;

      if (scores && scores.length > 0) {
        const chartData = processChartData(scores);
        setTrendData(chartData);

        const trending = scores
          .filter(s => s.is_trending)
          .map(s => ({
            id: s.id,
            keyword: s.monitored_keywords?.keyword || 'Unknown',
            subreddit: s.monitored_keywords?.related_subreddit || 'Unknown',
            heatScore: parseFloat(s.heat_score).toFixed(2),
            calculatedAt: new Date(s.calculated_at).toLocaleString(),
          }))
          .slice(0, 10);

        setTrendingKeywords(trending);

        const avgHeat = scores
          .filter(s => s.is_trending)
          .reduce((sum, s) => sum + parseFloat(s.heat_score), 0) / (scores.filter(s => s.is_trending).length || 1);

        setStats({
          totalKeywords: new Set(scores.map(s => s.keyword_id)).size,
          trendingCount: scores.filter(s => s.is_trending).length,
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

      dataByKeyword[date][keyword] = parseFloat(score.heat_score);
    });

    return Object.values(dataByKeyword).slice(0, 20).reverse();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-emerald-400 text-xl">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Dashboard</h1>
        <p className="text-slate-400">Monitor trending keywords and heat scores over time</p>
      </div>

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
          <p className="text-slate-400 text-center py-8">No trend data available yet. Run the trend_fetch and trend_score functions.</p>
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
          <p className="text-slate-400 text-center py-8">No trending keywords at the moment.</p>
        )}
      </div>
    </div>
  );
}
