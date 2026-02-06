import { useState, useEffect, useCallback } from 'react';
import { Filter, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import EmptyState from '../components/EmptyState';
import LeadCard from '../components/LeadCard';
import { StatCardSkeleton, LeadCardSkeleton } from '../components/Skeleton';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchLeads = useCallback(async () => {
    try {
      let query = supabase
        .from('leads')
        .select(`
          *,
          monitored_keywords (keyword, related_subreddit),
          reddit_posts (title, body, canonical_url, author, created_at)
        `)
        .order('intent_score', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (data) setLeads(data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useRealtimeSubscription('leads', {
    event: 'INSERT',
    onInsert: useCallback(() => {
      fetchLeads();
    }, [fetchLeads]),
  });

  useRealtimeSubscription('leads', {
    event: 'UPDATE',
    onUpdate: useCallback((newRecord) => {
      setLeads(prev => prev.map(l => (l.id === newRecord.id ? { ...l, ...newRecord } : l)));
    }, []),
  });

  const updateLeadStatus = async (leadId, newStatus) => {
    const previousLeads = [...leads];
    setLeads(leads.map(lead => (lead.id === leadId ? { ...lead, status: newStatus } : lead)));

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

  const redZoneCount = leads.filter(l => l.intent_score >= 85 && (l.fury_score || 0) >= 75).length;
  const avgIntent = leads.length > 0
    ? (leads.reduce((sum, l) => sum + l.intent_score, 0) / leads.length).toFixed(0)
    : 0;
  const avgFury = leads.length > 0
    ? (leads.reduce((sum, l) => sum + (l.fury_score || 0), 0) / leads.length).toFixed(0)
    : 0;

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
          <p className="text-sm text-slate-400">Red Zone</p>
          <p className="text-3xl font-bold text-red-400">{redZoneCount}</p>
        </div>
        <div className="terminal-card">
          <p className="text-sm text-slate-400">Avg Intent</p>
          <p className="text-3xl font-bold text-emerald-400">{avgIntent}</p>
        </div>
        <div className="terminal-card">
          <p className="text-sm text-slate-400">Avg Fury</p>
          <p className="text-3xl font-bold text-orange-400">{avgFury}</p>
        </div>
      </div>

      {leads.length > 0 ? (
        <div className="space-y-4">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onStatusChange={updateLeadStatus} />
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
              : { href: '/settings', label: 'Configure Keywords' }
          }
        />
      )}
    </div>
  );
}
