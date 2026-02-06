import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Target } from 'lucide-react';

const QUADRANT_CONFIG = [
  {
    label: 'RED ZONE', desc: 'High Intent + High Fury',
    test: (l) => l.intent_score >= 85 && (l.fury_score || 0) >= 75,
    card: 'bg-red-900/20 border-red-500/30',
    dot: 'bg-red-500',
    text: 'text-red-400',
  },
  {
    label: 'HIGH INTENT', desc: 'High Intent + Low Fury',
    test: (l) => l.intent_score >= 85 && (l.fury_score || 0) < 75,
    card: 'bg-emerald-900/20 border-emerald-500/30',
    dot: 'bg-emerald-500',
    text: 'text-emerald-400',
  },
  {
    label: 'HIGH FURY', desc: 'Low Intent + High Fury',
    test: (l) => l.intent_score < 85 && (l.fury_score || 0) >= 75,
    card: 'bg-orange-900/20 border-orange-500/30',
    dot: 'bg-orange-500',
    text: 'text-orange-400',
  },
  {
    label: 'STANDARD', desc: 'Low Intent + Low Fury',
    test: (l) => l.intent_score < 85 && (l.fury_score || 0) < 75,
    card: 'bg-slate-800/50 border-slate-600',
    dot: 'bg-slate-500',
    text: 'text-slate-400',
  },
];

function getCellColor(lead) {
  if (lead.intent_score >= 85 && (lead.fury_score || 0) >= 75) return '#ef4444';
  if (lead.intent_score >= 85) return '#10b981';
  if ((lead.fury_score || 0) >= 75) return '#f97316';
  return '#64748b';
}

function QuadrantTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
      <p className="text-slate-300 font-semibold mb-2">{data.monitored_keywords?.keyword}</p>
      <p className="text-emerald-400 text-sm">Intent: {data.intent_score}</p>
      <p className="text-orange-400 text-sm">Fury: {data.fury_score || 0}</p>
      <p className="text-slate-400 text-xs mt-2 max-w-xs">{data.pain_point}</p>
    </div>
  );
}

export default function LeadQuadrantChart({ leads }) {
  if (leads.length === 0) return null;

  return (
    <div className="terminal-card">
      <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
        <Target className="text-red-400" size={20} />
        Lead Quadrant Analysis
      </h2>
      <p className="text-slate-400 text-sm mb-6">
        Leads plotted by Intent Score (buying readiness) vs Fury Score (frustration level). Red Zone = high intent + high fury.
      </p>

      <ResponsiveContainer width="100%" height={500}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            type="number"
            dataKey="intent_score"
            name="Intent Score"
            domain={[70, 100]}
            stroke="#64748b"
            label={{ value: 'Intent Score (Buying Readiness)', position: 'insideBottom', offset: -10, fill: '#94a3b8' }}
          />
          <YAxis
            type="number"
            dataKey="fury_score"
            name="Fury Score"
            domain={[0, 100]}
            stroke="#64748b"
            label={{ value: 'Fury Score (Frustration)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
            content={QuadrantTooltip}
          />
          <Scatter data={leads} shape="circle">
            {leads.map((lead, index) => (
              <Cell key={`cell-${index}`} fill={getCellColor(lead)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {QUADRANT_CONFIG.map(({ label, desc, test, card, dot, text }) => (
          <div key={label} className={`${card} border rounded-lg p-3`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${dot}`}></div>
              <span className={`text-sm font-semibold ${text}`}>{label}</span>
            </div>
            <p className="text-xs text-slate-400">{desc}</p>
            <p className={`text-2xl font-bold ${text} mt-2`}>
              {leads.filter(test).length}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
