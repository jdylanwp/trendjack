import { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, AlertCircle, Briefcase, Crown, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import UpgradePrompt from '../components/UpgradePrompt';

export default function Settings() {
  const { user } = useAuth();
  const { subscription, limits, canAddKeyword, refreshLimits, tiers } = useSubscription();
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [formData, setFormData] = useState({
    keyword: '',
    subreddit: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [offerContext, setOfferContext] = useState('');
  const [savingContext, setSavingContext] = useState(false);

  useEffect(() => {
    fetchKeywords();
    fetchOfferContext();
  }, []);

  const fetchKeywords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('monitored_keywords')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKeywords(data || []);
    } catch (err) {
      setError(`Failed to load keywords: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchOfferContext = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('offer_context')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setOfferContext(data.offer_context || '');
      }
    } catch (err) {
      console.error('Failed to load offer context:', err);
    }
  };

  const handleSaveOfferContext = async () => {
    if (!user) return;

    setError(null);
    setSuccess(null);

    try {
      setSavingContext(true);

      const { data: existing } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('user_settings')
          .update({
            offer_context: offerContext.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_settings')
          .insert({
            user_id: user.id,
            offer_context: offerContext.trim()
          });

        if (error) throw error;
      }

      setSuccess('Offer context saved! Future AI-generated replies will use this information.');
    } catch (err) {
      setError(`Failed to save offer context: ${err.message}`);
    } finally {
      setSavingContext(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!user) {
      setError('You must be logged in to add keywords');
      return;
    }

    if (!formData.keyword.trim() || !formData.subreddit.trim()) {
      setError('Both keyword and subreddit are required');
      return;
    }

    if (!canAddKeyword()) {
      setError(`You've reached your keyword limit (${limits?.max_keywords}). Upgrade to add more keywords.`);
      return;
    }

    try {
      setSubmitting(true);
      const { data, error } = await supabase
        .from('monitored_keywords')
        .insert([{
          user_id: user.id,
          keyword: formData.keyword.trim(),
          related_subreddit: formData.subreddit.trim().replace(/^r\//, ''),
          enabled: true
        }])
        .select();

      if (error) throw error;

      setSuccess('Keyword added successfully! It will be picked up in the next cron run.');
      setFormData({ keyword: '', subreddit: '' });
      await fetchKeywords();
      await refreshLimits();
    } catch (err) {
      setError(`Failed to add keyword: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, keyword) => {
    if (!confirm(`Are you sure you want to delete "${keyword}"? This will also remove all related data.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('monitored_keywords')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccess(`Keyword "${keyword}" deleted successfully`);
      await fetchKeywords();
      await refreshLimits();
    } catch (err) {
      setError(`Failed to delete keyword: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-emerald-400 text-xl">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Settings</h1>
        <p className="text-slate-400">Manage monitored keywords and subreddits</p>
      </div>

      {subscription && limits && (
        <div className="terminal-card bg-gradient-to-r from-slate-800 to-slate-900 border-emerald-500/30">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-900/30 rounded-lg">
                <Crown className="text-emerald-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">{subscription.subscription_tiers?.name || limits.tier_name} Plan</h2>
                <p className="text-slate-400 text-sm">{subscription.subscription_tiers?.description}</p>
              </div>
            </div>
            {subscription.tier_id === 'free' && (
              <button
                onClick={() => alert('Payment integration coming soon! Contact sales@trendjack.com for early access.')}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-medium rounded-lg transition-all flex items-center gap-2"
              >
                <TrendingUp size={16} />
                Upgrade
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Keywords</span>
                <span className="text-lg font-bold text-slate-100">
                  {limits.current_keywords} / {limits.max_keywords}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((limits.current_keywords / limits.max_keywords) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">AI Analyses</span>
                <span className="text-lg font-bold text-slate-100">
                  {limits.current_ai_analyses} / {limits.max_ai_analyses_per_month}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((limits.current_ai_analyses / limits.max_ai_analyses_per_month) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Leads Discovered</span>
                <span className="text-lg font-bold text-slate-100">
                  {limits.current_leads} / {limits.max_leads_per_month}
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min((limits.current_leads / limits.max_leads_per_month) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0" size={20} />
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-900/20 border border-emerald-500 rounded-lg p-4 flex items-start gap-3">
          <Tag className="text-emerald-400 flex-shrink-0" size={20} />
          <p className="text-emerald-400">{success}</p>
        </div>
      )}

      {limits && limits.current_keywords >= limits.max_keywords && subscription?.tier_id !== 'enterprise' && (
        <UpgradePrompt
          feature={`You've reached your keyword limit. Upgrade to ${subscription?.tier_id === 'free' ? 'Pro' : 'Enterprise'} to monitor more keywords and discover more opportunities.`}
          currentUsage={limits.current_keywords}
          limit={limits.max_keywords}
          targetTier={subscription?.tier_id === 'free' ? 'Pro' : 'Enterprise'}
        />
      )}

      <div className="terminal-card">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Briefcase className="text-emerald-400" size={20} />
          My Offer Context
        </h2>
        <p className="text-slate-400 text-sm mb-4">
          Describe your business or service. This context will be used by the AI to generate personalized replies that subtly pitch your offering when analyzing leads.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="offerContext" className="block text-sm font-medium text-slate-300 mb-2">
              Your Business Description
            </label>
            <textarea
              id="offerContext"
              value={offerContext}
              onChange={(e) => setOfferContext(e.target.value)}
              placeholder="e.g., I run a Shopify Agency that specializes in chargeback protection. We help e-commerce stores reduce fraudulent transactions and recover lost revenue."
              rows={5}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-vertical"
              disabled={savingContext}
            />
            <p className="text-xs text-slate-500 mt-2">
              Be specific about what you offer and who you help. The AI will use this to craft targeted responses.
            </p>
          </div>
          <button
            onClick={handleSaveOfferContext}
            disabled={savingContext}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingContext ? 'Saving...' : 'Save Offer Context'}
          </button>
        </div>
      </div>

      <div className="terminal-card">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Plus className="text-emerald-400" size={20} />
          Add New Keyword
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="keyword" className="block text-sm font-medium text-slate-300 mb-2">
                Keyword
              </label>
              <input
                type="text"
                id="keyword"
                name="keyword"
                value={formData.keyword}
                onChange={handleInputChange}
                placeholder="e.g., project management"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="subreddit" className="block text-sm font-medium text-slate-300 mb-2">
                Subreddit
              </label>
              <input
                type="text"
                id="subreddit"
                name="subreddit"
                value={formData.subreddit}
                onChange={handleInputChange}
                placeholder="e.g., startups"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                disabled={submitting}
              />
              <p className="text-xs text-slate-500 mt-1">Don't include "r/" prefix</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Plus size={18} />
            {submitting ? 'Adding...' : 'Add Keyword'}
          </button>
        </form>
      </div>

      <div className="terminal-card">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Tag className="text-emerald-400" size={20} />
          Monitored Keywords ({keywords.length})
        </h2>
        {keywords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="terminal-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Subreddit</th>
                  <th>Status</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((kw) => (
                  <tr key={kw.id}>
                    <td className="font-semibold text-emerald-400">{kw.keyword}</td>
                    <td className="text-slate-300">r/{kw.related_subreddit}</td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          kw.enabled
                            ? 'bg-emerald-900/30 text-emerald-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {kw.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="text-slate-400 text-sm">
                      {new Date(kw.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(kw.id, kw.keyword)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Delete keyword"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-slate-400 text-center py-8">
            No keywords configured yet. Add your first keyword above.
          </p>
        )}
      </div>
    </div>
  );
}
