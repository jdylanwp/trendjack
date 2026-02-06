import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { getIntentScoreColor, getFuryScoreColor, getQuadrantLabel } from '../utils/leadHelpers';

export default function LeadCard({ lead, onStatusChange }) {
  const [copiedId, setCopiedId] = useState(null);

  const copyToClipboard = async (text, leadId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(leadId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const quadrant = getQuadrantLabel(lead.intent_score, lead.fury_score || 0);

  return (
    <div className="terminal-card hover:border-emerald-700 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold text-slate-100">
              {lead.reddit_posts?.title || 'Untitled Post'}
            </h3>
            <span className={`status-badge status-${lead.status}`}>{lead.status}</span>
            <span className={`px-2 py-1 ${quadrant.color} ${quadrant.textColor} text-xs font-bold rounded`}>
              {quadrant.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400 mb-3">
            <span className="text-emerald-400 font-semibold">{lead.monitored_keywords?.keyword}</span>
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
          <p className="text-slate-300 text-sm whitespace-pre-wrap">{lead.suggested_reply}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => copyToClipboard(lead.suggested_reply, lead.id)}
            className="terminal-button flex items-center gap-2"
          >
            {copiedId === lead.id ? (
              <><Check size={16} /> Copied!</>
            ) : (
              <><Copy size={16} /> Copy Reply</>
            )}
          </button>
          {lead.reddit_posts?.canonical_url && (
            <a
              href={lead.reddit_posts.canonical_url}
              target="_blank"
              rel="noopener noreferrer"
              className="terminal-button-secondary flex items-center gap-2"
            >
              <ExternalLink size={16} /> View Post
            </a>
          )}
        </div>
        <div className="flex gap-2">
          {lead.status !== 'reviewed' && (
            <button
              onClick={() => onStatusChange(lead.id, 'reviewed')}
              className="px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 rounded text-sm font-medium transition-colors"
            >
              Mark Reviewed
            </button>
          )}
          {lead.status !== 'ignored' && (
            <button
              onClick={() => onStatusChange(lead.id, 'ignored')}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded text-sm font-medium transition-colors"
            >
              Ignore
            </button>
          )}
          {lead.status !== 'new' && (
            <button
              onClick={() => onStatusChange(lead.id, 'new')}
              className="px-3 py-2 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 rounded text-sm font-medium transition-colors"
            >
              Mark New
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
