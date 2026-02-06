import { useState } from 'react';
import { Copy, Check, Trash2, Edit3, Linkedin, Twitter, MessageCircle } from 'lucide-react';

const PLATFORM_CONFIG = {
  linkedin: { icon: Linkedin, label: 'LinkedIn', color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-700/40' },
  twitter: { icon: Twitter, label: 'X / Twitter', color: 'text-sky-400', bg: 'bg-sky-900/20 border-sky-700/40' },
  reddit: { icon: MessageCircle, label: 'Reddit', color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-700/40' },
};

const TYPE_LABELS = {
  thought_leadership: 'Thought Leadership',
  hot_take: 'Hot Take',
  educational: 'Educational',
};

export default function ContentDraftCard({ draft, onDelete, onEdit }) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const platform = PLATFORM_CONFIG[draft.platform] || PLATFORM_CONFIG.linkedin;
  const PlatformIcon = platform.icon;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(draft.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(draft.id);
    setDeleting(false);
  };

  return (
    <div className={`border rounded-lg p-5 transition-colors hover:border-slate-600 ${platform.bg}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <PlatformIcon size={20} className={platform.color} />
          <span className={`text-sm font-semibold ${platform.color}`}>{platform.label}</span>
          <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">
            {TYPE_LABELS[draft.content_type] || draft.content_type}
          </span>
        </div>
        <span className="text-xs text-slate-500">
          {new Date(draft.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-slate-300 mb-1">{draft.trend_keyword}</h3>
      <p className="text-xs text-slate-500 mb-3">{draft.title}</p>

      <div className="bg-slate-900/60 rounded-lg p-4 mb-3 border border-slate-700/50">
        <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
          {draft.body}
        </p>
      </div>

      {draft.news_context && (
        <details className="mb-3">
          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400 transition-colors">
            News sources used
          </summary>
          <p className="text-xs text-slate-500 mt-1 pl-3 border-l border-slate-700 whitespace-pre-wrap">
            {draft.news_context}
          </p>
        </details>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-medium transition-colors"
        >
          {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
        </button>
        <button
          onClick={() => onEdit(draft)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm font-medium transition-colors"
        >
          <Edit3 size={14} /> Edit
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Trash2 size={14} /> {deleting ? '...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}
