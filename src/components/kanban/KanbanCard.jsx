import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, Check, ExternalLink, GripVertical } from 'lucide-react';
import { getIntentScoreColor, getFuryScoreColor, getQuadrantLabel } from '../../utils/leadHelpers';

export default function KanbanCard({ lead, onStatusChange }) {
  const [copiedId, setCopiedId] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const quadrant = getQuadrantLabel(lead.intent_score, lead.fury_score || 0);

  const copyToClipboard = async (text, leadId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(leadId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`terminal-card p-4 cursor-default group ${
        isDragging ? 'shadow-2xl ring-2 ring-emerald-500/50' : 'hover:border-slate-600'
      } transition-all duration-150`}
    >
      <div className="flex items-start gap-2">
        <button
          className="mt-1 text-slate-600 hover:text-slate-400 cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-1.5 py-0.5 ${quadrant.color} ${quadrant.textColor} text-[10px] font-bold rounded`}>
              {quadrant.label}
            </span>
            <span className="text-emerald-400 text-xs font-semibold truncate">
              {lead.monitored_keywords?.keyword}
            </span>
          </div>

          <h4
            className="text-sm font-medium text-slate-200 mb-2 line-clamp-2 cursor-pointer hover:text-slate-100"
            onClick={() => setExpanded(!expanded)}
          >
            {lead.reddit_posts?.title || 'Untitled Post'}
          </h4>

          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 uppercase">Int</span>
              <span className={`text-sm font-bold ${getIntentScoreColor(lead.intent_score)}`}>
                {lead.intent_score}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 uppercase">Fury</span>
              <span className={`text-sm font-bold ${getFuryScoreColor(lead.fury_score || 0)}`}>
                {lead.fury_score || 0}
              </span>
            </div>
            <span className="text-slate-600 text-xs">
              r/{lead.monitored_keywords?.related_subreddit}
            </span>
          </div>

          {expanded && (
            <div className="mt-3 space-y-3 animate-in slide-in-from-top-1">
              {lead.pain_point && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Pain Point</p>
                  <p className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded">{lead.pain_point}</p>
                </div>
              )}

              {lead.pain_summary && (
                <div className="bg-red-900/10 border border-red-500/20 rounded p-2">
                  <p className="text-[10px] text-red-400 uppercase font-semibold mb-1">Frustration</p>
                  <p className="text-xs text-slate-300">{lead.pain_summary}</p>
                </div>
              )}

              {lead.suggested_reply && lead.suggested_reply !== 'SKIP - Low priority lead' && (
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-semibold mb-1">Suggested Reply</p>
                  <p className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded whitespace-pre-wrap">
                    {lead.suggested_reply}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {lead.suggested_reply && (
                  <button
                    onClick={() => copyToClipboard(lead.suggested_reply, lead.id)}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs transition-colors"
                  >
                    {copiedId === lead.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                  </button>
                )}
                {lead.reddit_posts?.canonical_url && (
                  <a
                    href={lead.reddit_posts.canonical_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs transition-colors"
                  >
                    <ExternalLink size={12} /> View
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
