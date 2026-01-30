import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

export function TrendSparkline({ data, color = "#10b981" }) {
  if (!data || data.length === 0) {
    return <div className="h-12 flex items-center text-slate-500 text-xs">No data</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="count"
          stroke={color}
          strokeWidth={2}
          fill={`url(#gradient-${color})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DetailedTrendChart({ data, entityName }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500">
        No historical data available
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 rounded p-3 shadow-lg">
          <p className="text-slate-300 font-medium mb-1">{label}</p>
          <p className="text-emerald-400 font-bold text-lg">
            {payload[0].value} mentions
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorMentions" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          stroke="#64748b"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => {
            const date = new Date(value);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }}
        />
        <YAxis
          stroke="#64748b"
          style={{ fontSize: '12px' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#10b981"
          strokeWidth={3}
          fill="url(#colorMentions)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
