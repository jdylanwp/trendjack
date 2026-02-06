import {
  LineChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

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

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
      <p className="text-slate-400 text-xs mb-1">
        {(() => {
          const d = new Date(label);
          return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
        })()}
      </p>
      <p className="text-emerald-400 font-bold text-lg">
        {payload[0].value} mentions
      </p>
    </div>
  );
}

export function DetailedTrendChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500">
        No historical data available
      </div>
    );
  }

  const values = data.map((d) => d.count).filter(Boolean);
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const formatTick = (value) => {
    const d = new Date(value);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="space-y-1">
      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
          <defs>
            <linearGradient id="colorMentions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#64748b"
            style={{ fontSize: '11px' }}
            tickFormatter={formatTick}
            tick={{ fill: '#64748b' }}
          />
          <YAxis
            stroke="#64748b"
            style={{ fontSize: '11px' }}
            tick={{ fill: '#64748b' }}
            width={40}
          />
          <Tooltip content={<ChartTooltip />} />
          {avg > 0 && (
            <ReferenceLine
              y={avg}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: `Avg: ${avg.toFixed(0)}`,
                position: 'right',
                fill: '#f59e0b',
                fontSize: 11,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="count"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#colorMentions)"
            animationDuration={800}
          />
          <Brush
            dataKey="date"
            height={28}
            stroke="#475569"
            fill="#1e293b"
            tickFormatter={formatTick}
            travellerWidth={10}
          >
            <AreaChart data={data}>
              <Area
                type="monotone"
                dataKey="count"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.15}
                strokeWidth={1}
              />
            </AreaChart>
          </Brush>
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-slate-500 text-center">
        Drag the handles below to zoom into a specific time range
      </p>
    </div>
  );
}
