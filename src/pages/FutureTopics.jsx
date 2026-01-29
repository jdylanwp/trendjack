import { useState, useEffect } from 'react';
import { TrendingUp, Zap, Clock, BarChart3, Flame, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Skeleton } from '../components/Skeleton';
import { useSubscription } from '../contexts/SubscriptionContext';
import UpgradePrompt from '../components/UpgradePrompt';

export default function FutureTopics() {
  const { limits, canPerformAIAnalysis, trackUsage, subscription } = useSubscription();
  const [topics, setTopics] = useState([]);
  const [trendingKeywords, setTrendingKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [analyses, setAnalyses] = useState({});
  const [analyzing, setAnalyzing] = useState({});

  useEffect(() => {
    fetchData();
  }, [timeRange]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: scores, error: scoresError } = await supabase
        .from('trend_scores')
        .select(`
          keyword_id,
          z_score,
          heat_score,
          is_trending,
          calculated_at,
          monitored_keywords!inner(id, keyword)
        `)
        .order('calculated_at', { ascending: false });

      if (scoresError) throw scoresError;

      const keywordMap = new Map();
      scores?.forEach(score => {
        const keywordData = score.monitored_keywords;
        if (!keywordMap.has(keywordData.id)) {
          keywordMap.set(keywordData.id, {
            id: keywordData.id,
            keyword: keywordData.keyword,
            zScore: score.z_score || 0,
            heatScore: score.heat_score || 0,
            isTrending: score.is_trending,
            lastCalculated: score.calculated_at
          });
        }
      });

      const trending = Array.from(keywordMap.values())
        .sort((a, b) => (b.zScore || 0) - (a.zScore || 0));

      setTrendingKeywords(trending);

      if (trending.length > 0 && !selectedKeyword) {
        setSelectedKeyword(trending[0].id);
      }

      await fetchTopicsForKeyword(selectedKeyword || trending[0]?.id);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopicsForKeyword = async (keywordId) => {
    if (!keywordId) return;

    try {
      const cutoffDate = new Date();
      if (timeRange === '24h') cutoffDate.setHours(cutoffDate.getHours() - 24);
      else if (timeRange === '7d') cutoffDate.setDate(cutoffDate.getDate() - 7);
      else cutoffDate.setDate(cutoffDate.getDate() - 30);

      const { data, error } = await supabase
        .from('related_topics')
        .select('topic, frequency_count, last_seen_at')
        .eq('keyword_id', keywordId)
        .gte('last_seen_at', cutoffDate.toISOString())
        .order('frequency_count', { ascending: false })
        .limit(50);

      if (error) throw error;

      const enrichedTopics = (data || []).map(topic => ({
        ...topic,
        growthRate: calculateGrowthRate(topic),
        isHot: topic.frequency_count > 10,
      }));

      setTopics(enrichedTopics);
    } catch (err) {
      console.error('Failed to fetch topics:', err);
    }
  };

  const calculateGrowthRate = (topic) => {
    const hoursSinceLastSeen = (new Date() - new Date(topic.last_seen_at)) / (1000 * 60 * 60);
    if (hoursSinceLastSeen < 1) return 'explosive';
    if (hoursSinceLastSeen < 6) return 'heating';
    return 'stable';
  };

  const handleKeywordChange = async (keywordId) => {
    setSelectedKeyword(keywordId);
    await fetchTopicsForKeyword(keywordId);
  };

  const analyzeTrend = async (topic) => {
    const key = `${selectedKeyword}-${topic}`;

    if (analyzing[key]) return;

    if (!canPerformAIAnalysis()) {
      setAnalyses(prev => ({
        ...prev,
        [key]: {
          summary: [`You've reached your AI analysis limit (${limits?.max_ai_analyses_per_month} per month). Upgrade to continue analyzing trends.`],
          confidence: 'low',
          newsCount: 0
        }
      }));
      return;
    }

    setAnalyzing(prev => ({ ...prev, [key]: true }));

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze_trend`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          keyword_id: selectedKeyword,
          topic: topic,
          hours: 48
        })
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();

      if (result.success) {
        setAnalyses(prev => ({
          ...prev,
          [key]: result.analysis
        }));

        await trackUsage('ai_analysis');
      }
    } catch (err) {
      console.error('Failed to analyze trend:', err);
      setAnalyses(prev => ({
        ...prev,
        [key]: {
          summary: ['Analysis failed. Please try again later.'],
          confidence: 'low',
          newsCount: 0
        }
      }));
    } finally {
      setAnalyzing(prev => ({ ...prev, [key]: false }));
    }
  };

  const getGrowthColor = (growthRate) => {
    if (growthRate === 'explosive') return '#10b981';
    if (growthRate === 'heating') return '#f59e0b';
    return '#64748b';
  };

  const chartData = topics.slice(0, 15).map(topic => ({
    name: topic.topic,
    count: topic.frequency_count,
    growthRate: topic.growthRate
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
              <Zap className="text-emerald-400" size={32} />
              Future Topics
            </h1>
            <p className="text-slate-400 mt-2">
              Prediction engine tracking emerging problems before they become mainstream
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="terminal-card">
            <Skeleton width="w-48" height="h-5" className="mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-slate-800/50 p-4 rounded-lg">
                  <Skeleton width="w-32" height="h-4" className="mb-2" />
                  <div className="flex items-center gap-3">
                    <Skeleton width="w-20" height="h-3" />
                    <Skeleton width="w-16" height="h-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="terminal-card">
              <Skeleton width="w-64" height="h-5" className="mb-4" />
              <Skeleton width="w-full" height="h-72" />
            </div>

            <div className="terminal-card">
              <Skeleton width="w-48" height="h-5" className="mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-slate-800/50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Skeleton width="w-48" height="h-4" />
                      <Skeleton width="w-16" height="h-6" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedKeywordData = trendingKeywords.find(k => k.id === selectedKeyword);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Zap className="text-emerald-400" size={32} />
            Future Topics
          </h1>
          <p className="text-slate-400 mt-2">
            Prediction engine tracking emerging problems before they become mainstream
          </p>
        </div>
      </div>

      {limits && limits.current_ai_analyses >= limits.max_ai_analyses_per_month * 0.8 && subscription?.tier_id !== 'enterprise' && (
        <UpgradePrompt
          feature={`You're running low on AI analyses. Upgrade to ${subscription?.tier_id === 'free' ? 'Pro' : 'Enterprise'} to unlock ${subscription?.tier_id === 'free' ? '200' : '1000'} analyses per month.`}
          currentUsage={limits.current_ai_analyses}
          limit={limits.max_ai_analyses_per_month}
          targetTier={subscription?.tier_id === 'free' ? 'Pro' : 'Enterprise'}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="terminal-card">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <TrendingUp className="text-emerald-400" size={18} />
            Monitored Keywords
          </h3>
          <div className="space-y-2">
            {trendingKeywords.map(keyword => (
              <button
                key={keyword.id}
                onClick={() => handleKeywordChange(keyword.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-all ${
                  selectedKeyword === keyword.id
                    ? 'bg-emerald-900/30 border border-emerald-500'
                    : 'bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-100">{keyword.keyword}</span>
                  {keyword.isTrending && (
                    <Flame className="text-orange-400" size={16} />
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span>Z-Score: {keyword.zScore?.toFixed(2) || '0.00'}</span>
                  <span>Heat: {keyword.heatScore?.toFixed(2) || '0.00'}</span>
                </div>
              </button>
            ))}
            {trendingKeywords.length === 0 && (
              <p className="text-slate-500 text-sm text-center py-4">
                No keywords configured yet. Add some in Settings.
              </p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selectedKeywordData && (
            <div className="terminal-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  <BarChart3 className="text-emerald-400" size={18} />
                  Topic Frequency for "{selectedKeywordData.keyword}"
                </h3>
                <div className="flex gap-2">
                  {['24h', '7d', '30d'].map(range => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        timeRange === range
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#f1f5f9'
                      }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getGrowthColor(entry.growthRate)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-slate-500">
                  No topics discovered yet. The prediction engine needs time to analyze news patterns.
                </div>
              )}
            </div>
          )}

          <div className="terminal-card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Clock className="text-emerald-400" size={18} />
              Emerging Topics
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {topics.map((topic, index) => {
                const key = `${selectedKeyword}-${topic.topic}`;
                const analysis = analyses[key];
                const isAnalyzing = analyzing[key];

                return (
                  <div
                    key={index}
                    className="bg-slate-800/50 rounded-lg border border-slate-700 hover:border-emerald-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getGrowthColor(topic.growthRate) }}
                        ></div>
                        <div className="flex-1">
                          <p className="text-slate-100 font-medium capitalize">{topic.topic}</p>
                          <p className="text-xs text-slate-500">
                            Last seen: {new Date(topic.last_seen_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm text-slate-400">Mentions</p>
                          <p className="text-lg font-bold text-emerald-400">{topic.frequency_count}</p>
                        </div>
                        {topic.isHot && (
                          <Flame className="text-orange-400 flex-shrink-0" size={20} />
                        )}
                        <button
                          onClick={() => analyzeTrend(topic.topic)}
                          disabled={isAnalyzing}
                          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} />
                              Why?
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                    {analysis && (
                      <div className="px-3 pb-3 pt-0">
                        <div className="bg-slate-900/50 border border-emerald-500/30 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="text-emerald-400" size={16} />
                            <span className="text-xs font-semibold text-emerald-400 uppercase">
                              AI Briefing
                              {analysis.cached && ' (Cached)'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              analysis.confidence === 'high' ? 'bg-emerald-900/50 text-emerald-400' :
                              analysis.confidence === 'medium' ? 'bg-amber-900/50 text-amber-400' :
                              'bg-slate-700 text-slate-400'
                            }`}>
                              {analysis.confidence} confidence
                            </span>
                          </div>
                          <ul className="space-y-1.5">
                            {analysis.summary.map((bullet, i) => (
                              <li key={i} className="text-sm text-slate-300 flex gap-2">
                                <span className="text-emerald-400 flex-shrink-0">•</span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="text-xs text-slate-500 mt-2">
                            Based on {analysis.newsCount} news items from the last {analysis.timeRange}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {topics.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No topics found for this time range.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="terminal-card bg-gradient-to-r from-slate-800/50 to-emerald-900/20 border-emerald-500/30">
        <div className="flex items-start gap-4">
          <Zap className="text-emerald-400 flex-shrink-0 mt-1" size={24} />
          <div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">How It Works</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-3">
              The prediction engine analyzes news headlines to discover emerging topics related to your monitored keywords.
              It tracks word frequency and velocity to identify problems before they become mainstream.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-xs font-semibold text-emerald-400">EXPLOSIVE</span>
                </div>
                <p className="text-xs text-slate-400">Seen in the last hour - immediate opportunity</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <span className="text-xs font-semibold text-amber-400">HEATING</span>
                </div>
                <p className="text-xs text-slate-400">Seen in last 6 hours - growing trend</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                  <span className="text-xs font-semibold text-slate-400">STABLE</span>
                </div>
                <p className="text-xs text-slate-400">Consistent baseline - monitor for changes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
