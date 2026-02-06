import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#06b6d4'];

export default function HeatScoreChart({ data }) {
  if (data.length === 0) {
    return (
      <div className="terminal-card">
        <h2 className="text-xl font-bold text-slate-100 mb-4">Heat Score Trends</h2>
        <div className="text-center py-12">
          <BarChart3 className="text-slate-600 mx-auto mb-4" size={48} />
          <p className="text-slate-400">No trend data yet</p>
          <p className="text-slate-500 text-sm mt-2">
            The automated system will start collecting trend data shortly. Chart will populate as keywords are monitored.
          </p>
        </div>
      </div>
    );
  }

  const keywords = Object.keys(data[0] || {}).filter(key => key !== 'date');

  return (
    <div className="terminal-card">
      <h2 className="text-xl font-bold text-slate-100 mb-4">Heat Score Trends</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '12px' }} />
          <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
            }}
          />
          <Legend />
          {keywords.map((keyword, idx) => (
            <Line
              key={keyword}
              type="monotone"
              dataKey={keyword}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
