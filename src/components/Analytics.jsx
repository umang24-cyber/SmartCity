import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useTheme } from '../context/ThemeContext';

export function SafetyVariance({ data = [] }) {
  const { mode } = useTheme();

  const chartStyle = {
    contentStyle: {
      background: 'var(--bg-panel)',
      border: '1px solid var(--border)',
      borderRadius: 0,
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 10,
      color: 'var(--text-primary)',
    },
    itemStyle: { color: 'var(--accent)' },
  };
  return (
    <div className="panel panel-cut" style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="label-xs" style={{ marginBottom: '0.6rem', color: 'var(--accent)' }}>
        ▤ SAFETY SCORE VARIANCE — 24H
      </div>
      <div style={{ flex: 1, minHeight: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00ff88" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(0,255,136,0.06)" vertical={false} />
            <XAxis dataKey="time" stroke="rgba(0,255,136,0.3)" fontSize={9}
              axisLine={false} tickLine={false} fontFamily="Share Tech Mono, monospace" />
            <YAxis hide domain={[0, 100]} />
            <Tooltip contentStyle={chartStyle.contentStyle} itemStyle={chartStyle.itemStyle} />
            <Area type="monotone" dataKey="value"
              stroke="#00ff88" strokeWidth={1.5}
              fillOpacity={1} fill="url(#areaGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PeakDangerHours({ data = [] }) {
  const { mode } = useTheme();

  const chartStyle = {
    contentStyle: {
      background: 'var(--bg-panel)',
      border: '1px solid var(--border)',
      borderRadius: 0,
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 10,
      color: 'var(--text-primary)',
    },
    itemStyle: { color: 'var(--accent)' },
  };

  return (
    <div className="panel panel-cut" style={{ padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="label-xs" style={{ marginBottom: '0.6rem', color: 'var(--amber)' }}>
        ⚠ PEAK DANGER HOURS
      </div>
      <div style={{ flex: 1, minHeight: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,170,0,0.06)" vertical={false} />
            <XAxis dataKey="hour" stroke="rgba(255,170,0,0.3)" fontSize={9}
              axisLine={false} tickLine={false} fontFamily="Share Tech Mono, monospace" />
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              cursor={{ fill: 'rgba(255,170,0,0.04)' }}
              contentStyle={{ ...chartStyle.contentStyle, borderColor: 'rgba(255,170,0,0.2)' }}
              itemStyle={{ color: '#ffaa00' }}
            />
            <Bar dataKey="level" radius={[0, 0, 0, 0]} maxBarSize={24}>
              {data.map((entry, i) => (
                <Cell key={i}
                  fill={entry.level >= 90 ? '#ff3344' : entry.level >= 70 ? '#ffaa00' : '#00ff88'}
                  style={{ filter: `drop-shadow(0 0 4px ${entry.level >= 90 ? '#ff3344' : entry.level >= 70 ? '#ffaa00' : '#00ff88'})` }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
