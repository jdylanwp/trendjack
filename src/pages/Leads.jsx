import { useState, useEffect } from 'react';
import { Copy, Check, ExternalLink, Filter, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import EmptyState from '../components/EmptyState';
import { StatCardSkeleton, LeadCardSkeleton } from '../components/Skeleton';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 30000);
    return () => clearInterval(interval);
  }, [statusFilter]);

  const fetchLeads = async () => {
    try {
      let query = supabase
        .from('leads')
        .select(`
          *,
          monitored_keywords (
            keyword,
            related_subreddit
          ),
          reddit_posts (
            title,
            body,
            canonical_url,
            author,
            created_at
          )
        `)
        .order('intent_score', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        setLeads(data);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    const previousLeads = [...leads];

    setLeads(leads.map(lead =>
      lead.id === leadId ? { ...lead, status: newStatus } : lead
    ));

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating lead status:', error);
      setLeads(previousLeads);
    }
  };

  const copyToClipboard = async (text, leadId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(leadId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const getIntentScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 80) return 'text-blue-400';
    if (score >= 75) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const getFuryScoreColor = (score) => {
    if (score >= 80) return 'text-red-400';
    if (score >= 60) return 'text-orange-400';
    if (score >= 30) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const getQuadrantLabel = (intentScore, furyScore) => {
    if (intentScore >= 85 && furyScore >= 75) {
      return { label: 'RED ZONE', color: 'bg-red-600', textColor: 'text-white' };
    }
    if (intentScore >= 85 && furyScore < 75) {
      return { label: 'High Intent', color: 'bg-emerald-600', textColor: 'text-white' };
    }
    if (intentScore < 85 && furyScore >= 75) {
      return { label: 'High Fury', color: 'bg-orange-600', textColor: 'text-white' };
    }
    return { label: 'Standard', color: 'bg-slate-600', textColor: 'text-slate-300' };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-100 mb-2">Leads</h1>
            <p className="text-slate-400">High-intent Reddit posts identified by AI</p>
          </div>
          <div className="flex items-center gap-3">
            <Filter size={20} className="text-slate-400" />
            <select className="terminal-input" disabled>
              <option>All Status</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        <div className="space-y-4">
          <LeadCardSkeleton />
          <LeadCardSkeleton />
          <LeadCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Leads</h1>
          <p className="text-slate-400">High-intent Reddit posts identified by AI</p>
        </div>
        <div className="flex items-center gap-3">
          <Filter size={20} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="terminal-input"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="reviewed">Reviewed</option>
            <option value="ignored">Ignored</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="terminal-card">
          <p className="text-sm text-slate-400">Total Leads</p>
          <p className="text-3xl font-bold text-slate-100">{leads.length}</p>
        </div>
        <div className="terminal-card bg-red-900/10 border-red-500/30">
          <p className="text-sm text-slate-400">Red Zone 🔥</p>
          <p className="text-3xl font-bold text-red-400">
            {leads.filter(l => l.intent_score >= 85 && (l.fury_score || 0) >= 75).length}
          </p>
        </div>
        <div className="terminal-card">
          <p className="text-sm text-slate-400">Avg Intent</p>
          <p className="text-3xl font-bold text-emerald-400">
            {leads.length > 0
              ? (leads.reduce((sum, l) => sum + l.intent_score, 0) / leads.length).toFixed(0)
              : 0}
          </p>
        </div>
        <div className="terminal-card">
          <p className="text-sm text-slate-400">Avg Fury</p>
          <p className="text-3xl font-bold text-orange-400">
            {leads.length > 0
              ? (leads.reduce((sum, l) => sum + (l.fury_score || 0), 0) / leads.length).toFixed(0)
              : 0}
          </p>
        </div>
      </div>

      {leads.length > 0 ? (
        <div className="space-y-4">
          {leads.map((lead) => (
            <div key={lead.id} className="terminal-card hover:border-emerald-700 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-100">
                      {lead.reddit_posts?.title || 'Untitled Post'}
                    </h3>
                    <span className={`status-badge status-${lead.status}`}>
                      {lead.status}
                    </span>
                    {(() => {
                      const quadrant = getQuadrantLabel(lead.intent_score, lead.fury_score || 0);
                      return (
                        <span className={`px-2 py-1 ${quadrant.color} ${quadrant.textColor} text-xs font-bold rounded`}>
                          {quadrant.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
                    <span className="text-emerald-400 font-semibold">
                      {lead.monitored_keywords?.keyword}
                    </span>
                    <span>r/{lead.monitored_keywords?.related_subreddit}</span>
                    <span>u/{lead.reddit_posts?.author}</span>
                    <span>
                      {lead.reddit_posts?.created_at
                        ? new Date(lead.reddit_posts.created_at).toLocaleDateString()
                        : 'Unknown date'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Intent</div>
                    <div className={`text-2xl font-bold ${getIntentScoreColor(lead.intent_score)}`}>
                      {lead.intent_score}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-400 mb-1">Fury</div>
                    <div className={`text-2xl font-bold ${getFuryScoreColor(lead.fury_score || 0)}`}>
                      {lead.fury_score || 0}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Pain Point</h4>
                <p className="text-slate-400 text-sm bg-slate-900 p-3 rounded border border-slate-700">
                  {lead.pain_point}
                </p>
              </div>

              {(lead.fury_score > 0 || lead.pain_summary) && (
                <div className="mb-4 bg-gradient-to-r from-red-900/10 to-orange-900/10 border border-red-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                    <span className="text-lg">🔥</span>
                    Fury Analysis (Score: {lead.fury_score || 0}/100)
                  </h4>

                  {lead.pain_summary && (
                    <div className="mb-3">
                      <span className="text-xs text-slate-400 font-semibold">WHY THEY'RE FRUSTRATED:</span>
                      <p className="text-slate-300 text-sm mt-1">{lead.pain_summary}</p>
                    </div>
                  )}

                  {lead.primary_trigger && (
                    <div className="mb-3">
                      <span className="text-xs text-slate-400 font-semibold">PRIMARY TRIGGER:</span>
                      <p className="text-orange-400 text-sm mt-1 font-medium">{lead.primary_trigger}</p>
                    </div>
                  )}

                  {lead.sample_quote && (
                    <div>
                      <span className="text-xs text-slate-400 font-semibold">SAMPLE QUOTE:</span>
                      <p className="text-slate-300 text-sm mt-1 italic border-l-2 border-red-500 pl-3">
                        "{lead.sample_quote}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mb-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Suggested Reply</h4>
                <div className="bg-slate-900 p-3 rounded border border-slate-700">
                  <p className="text-slate-300 text-sm whitespace-pre-wrap">
                    {lead.suggested_reply}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(lead.suggested_reply, lead.id)}
                    className="terminal-button flex items-center gap-2"
                  >
                    {copiedId === lead.id ? (
                      <>
                        <Check size={16} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        Copy Reply
                      </>
                    )}
                  </button>
                  {lead.reddit_posts?.canonical_url && (
                    <a
                      href={lead.reddit_posts.canonical_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="terminal-button-secondary flex items-center gap-2"
                    >
                      <ExternalLink size={16} />
                      View Post
                    </a>
                  )}
                </div>

                <div className="flex gap-2">
                  {lead.status !== 'reviewed' && (
                    <button
                      onClick={() => updateLeadStatus(lead.id, 'reviewed')}
                      className="px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded text-sm font-medium transition-colors"
                    >
                      Mark Reviewed
                    </button>
                  )}
                  {lead.status !== 'ignored' && (
                    <button
                      onClick={() => updateLeadStatus(lead.id, 'ignored')}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded text-sm font-medium transition-colors"
                    >
                      Ignore
                    </button>
                  )}
                  {lead.status !== 'new' && (
                    <button
                      onClick={() => updateLeadStatus(lead.id, 'new')}
                      className="px-3 py-2 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 rounded text-sm font-medium transition-colors"
                    >
                      Mark New
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title={statusFilter !== 'all' ? `No ${statusFilter} leads` : 'No leads yet'}
          description={
            statusFilter !== 'all'
              ? `You don't have any leads with the status "${statusFilter}". Try changing the filter or wait for the automated system to discover new opportunities.`
              : 'The system is actively scanning Reddit for high-intent posts. Leads will appear here automatically once the lead scoring function runs. Check back in a few minutes or configure your keywords in Settings.'
          }
          action={
            statusFilter !== 'all'
              ? null
              : {
                  href: '/settings',
                  label: 'Configure Keywords',
                }
          }
        />
      )}
    </div>
  );
}
