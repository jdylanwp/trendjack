import { useState, useEffect, useCallback } from 'react';
import { PenTool, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useRealtimeSubscription } from '../hooks/useRealtimeSubscription';
import ContentGenerateForm from '../components/ContentGenerateForm';
import ContentDraftCard from '../components/ContentDraftCard';
import EmptyState from '../components/EmptyState';

export default function ContentStudio() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingDraft, setEditingDraft] = useState(null);
  const [editBody, setEditBody] = useState('');

  const fetchDrafts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('content_drafts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setDrafts(data);
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  useRealtimeSubscription('content_drafts', {
    event: 'INSERT',
    onInsert: useCallback(() => fetchDrafts(), [fetchDrafts]),
  });

  const handleGenerated = useCallback(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const handleDelete = useCallback(async (draftId) => {
    try {
      const { error } = await supabase
        .from('content_drafts')
        .delete()
        .eq('id', draftId);
      if (error) throw error;
      setDrafts(prev => prev.filter(d => d.id !== draftId));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  }, []);

  const handleEdit = useCallback((draft) => {
    setEditingDraft(draft);
    setEditBody(draft.body);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingDraft) return;

    try {
      const { error } = await supabase
        .from('content_drafts')
        .update({ body: editBody, status: 'edited', updated_at: new Date().toISOString() })
        .eq('id', editingDraft.id);

      if (error) throw error;

      setDrafts(prev =>
        prev.map(d =>
          d.id === editingDraft.id ? { ...d, body: editBody, status: 'edited' } : d
        )
      );
      setEditingDraft(null);
      setEditBody('');
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [editingDraft, editBody]);

  const draftCount = drafts.length;
  const publishedCount = drafts.filter(d => d.status === 'published').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Content Studio</h1>
        <p className="text-slate-400">
          Turn exploding trends into viral thought-leadership posts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="terminal-card">
          <p className="text-sm text-slate-400">Total Drafts</p>
          <p className="text-3xl font-bold text-slate-100">{draftCount}</p>
        </div>
        <div className="terminal-card">
          <p className="text-sm text-slate-400">Published</p>
          <p className="text-3xl font-bold text-emerald-400">{publishedCount}</p>
        </div>
        <div className="terminal-card">
          <p className="text-sm text-slate-400">Pending Edit</p>
          <p className="text-3xl font-bold text-amber-400">
            {drafts.filter(d => d.status === 'draft').length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ContentGenerateForm onGenerated={handleGenerated} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          {editingDraft && (
            <div className="terminal-card border-amber-500/40 space-y-3">
              <h3 className="text-sm font-semibold text-amber-400">Editing Draft</h3>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={10}
                className="terminal-input w-full font-sans text-sm leading-relaxed"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="terminal-button"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => { setEditingDraft(null); setEditBody(''); }}
                  className="terminal-button-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="terminal-card animate-pulse">
                  <div className="h-4 bg-slate-700 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-slate-700 rounded w-2/3 mb-2" />
                  <div className="h-24 bg-slate-700/50 rounded mb-3" />
                  <div className="h-8 bg-slate-700 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : drafts.length > 0 ? (
            drafts.map(draft => (
              <ContentDraftCard
                key={draft.id}
                draft={draft}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))
          ) : (
            <EmptyState
              icon={FileText}
              title="No content drafts yet"
              description="Select a trending topic and generate your first piece of content. The AI will use real-time news to create platform-native posts."
            />
          )}
        </div>
      </div>
    </div>
  );
}
