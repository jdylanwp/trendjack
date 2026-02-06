import { useState, useEffect, useCallback } from 'react';
import { Filter, Target, LayoutGrid, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import EmptyState from '../components/EmptyState';
import LeadCard from '../components/LeadCard';
import KanbanBoard from '../components/kanban/KanbanBoard';
import { StatCardSkeleton, LeadCardSkeleton } from '../components/Skeleton';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('kanban');

  const fetchLeads = useCallback(async () => {
    try {
      const query = supabase
        .from('leads')
        .select(`
          *,
          monitored_keywords (keyword, related_subreddit),
          reddit_posts (title, body, canonical_url, author, created_at)
        `)
        .order('intent_score', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      if (data) setLeads(data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const updateLeadStatus = useCallback(async (leadId, newStatus) => {
    setLeads(prev => prev.map(lead => (lead.id === leadId ? { ...lead, status: newStatus } : lead)));

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating lead status:', error);
      fetchLeads();
    }
  }, [fetchLeads]);

  const filteredLeads = statusFilter === 'all'
    ? leads
    : leads.filter(l => l.status === statusFilter);

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Leads</h1>
          <p className="text-slate-400">High-intent Reddit posts identified by AI</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid size={16} />
              Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List size={16} />
              List
            </button>
          </div>

          {viewMode === 'list' && (
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="terminal-input"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="reviewed">Reviewed</option>
                <option value="contacted">Contacted</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
          )}
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
        viewMode === 'kanban' ? (
          <KanbanBoard leads={leads} onStatusChange={updateLeadStatus} />
        ) : (
          <div className="space-y-4">
            {filteredLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onStatusChange={updateLeadStatus} />
            ))}
            {filteredLeads.length === 0 && statusFilter !== 'all' && (
              <EmptyState
                icon={Target}
                title={`No ${statusFilter} leads`}
                description={`You don't have any leads with the status "${statusFilter}".`}
              />
            )}
          </div>
        )
      ) : (
        <EmptyState
          icon={Target}
          title="No leads yet"
          description="The system is actively scanning Reddit for high-intent posts. Leads will appear here automatically once the lead scoring function runs."
          action={{ href: '/settings', label: 'Configure Keywords' }}
        />
      )}
    </div>
  );
}
