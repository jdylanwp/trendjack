import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Linkedin, Twitter, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-400 border-blue-500' },
  { id: 'twitter', label: 'X / Twitter', icon: Twitter, color: 'text-sky-400 border-sky-500' },
  { id: 'reddit', label: 'Reddit', icon: MessageCircle, color: 'text-orange-400 border-orange-500' },
];

const CONTENT_TYPES = [
  { id: 'thought_leadership', label: 'Thought Leadership', desc: 'Authoritative industry insight' },
  { id: 'hot_take', label: 'Hot Take', desc: 'Contrarian / provocative angle' },
  { id: 'educational', label: 'Educational', desc: 'Breakdown for non-experts' },
];

export default function ContentGenerateForm({ onGenerated, prefilledKeyword }) {
  const { user } = useAuth();
  const [keyword, setKeyword] = useState(prefilledKeyword || '');
  const [platform, setPlatform] = useState('linkedin');
  const [contentType, setContentType] = useState('thought_leadership');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [entities, setEntities] = useState([]);
  const [selectedEntityId, setSelectedEntityId] = useState('');

  useEffect(() => {
    async function fetchEntities() {
      const { data } = await supabase
        .from('global_entities')
        .select('id, entity_name, trend_status, volume_24h')
        .in('trend_status', ['Exploding', 'Slow Burn'])
        .order('volume_24h', { ascending: false })
        .limit(20);
      if (data) setEntities(data);
    }
    fetchEntities();
  }, []);

  useEffect(() => {
    if (prefilledKeyword) setKeyword(prefilledKeyword);
  }, [prefilledKeyword]);

  const handleEntitySelect = (entityId) => {
    setSelectedEntityId(entityId);
    const entity = entities.find(e => e.id === entityId);
    if (entity) setKeyword(entity.entity_name);
  };

  const handleGenerate = async () => {
    if (!keyword.trim() || !user) return;

    setGenerating(true);
    setError(null);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/content_generate`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trend_keyword: keyword.trim(),
          platform,
          content_type: contentType,
          user_id: user.id,
          entity_id: selectedEntityId || undefined,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Generation failed');
      }

      onGenerated(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="terminal-card space-y-5">
      <h2 className="text-lg font-bold text-slate-100">Generate Content</h2>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Trending Topic</label>
        {entities.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {entities.slice(0, 8).map((entity) => (
              <button
                key={entity.id}
                onClick={() => handleEntitySelect(entity.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedEntityId === entity.id
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {entity.entity_name}
                <span className="ml-1.5 text-slate-500">
                  {entity.trend_status === 'Exploding' ? '(!)' : '(~)'}
                </span>
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setSelectedEntityId(''); }}
          placeholder="e.g., Cursor AI, Shopify outage, GPT-5..."
          className="terminal-input w-full"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Platform</label>
        <div className="grid grid-cols-3 gap-3">
          {PLATFORMS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  platform === p.id
                    ? `${p.color} bg-slate-800`
                    : 'border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                }`}
              >
                <Icon size={16} />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-2">Content Style</label>
        <div className="space-y-2">
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct.id}
              onClick={() => setContentType(ct.id)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                contentType === ct.id
                  ? 'border-emerald-500 bg-emerald-900/15 text-slate-200'
                  : 'border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              <span className="text-sm font-medium">{ct.label}</span>
              <span className="block text-xs text-slate-500 mt-0.5">{ct.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={generating || !keyword.trim()}
        className="w-full terminal-button flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generating ? (
          <><Loader2 size={18} className="animate-spin" /> Generating...</>
        ) : (
          <><Sparkles size={18} /> Generate Draft</>
        )}
      </button>
    </div>
  );
}
