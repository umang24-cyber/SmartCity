import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export function SafetyVariance({ data }) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5 h-full flex flex-col">
      <h3 className="font-bold text-sm text-text-secondary uppercase tracking-widest mb-4">Safety Score Variance</h3>
      <div className="flex-1 min-h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, 100]} />
            <Tooltip 
              contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '10px' }}
              itemStyle={{ color: 'var(--accent)' }}
            />
            <Area type="monotone" dataKey="value" stroke="var(--accent)" fillOpacity={1} fill="url(#colorValue)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PeakDangerHours({ data }) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5 h-full flex flex-col">
      <h3 className="font-bold text-sm text-text-secondary uppercase tracking-widest mb-4">Peak Danger Levels</h3>
      <div className="flex-1 min-h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="hour" stroke="rgba(255,255,255,0.3)" fontSize={10} axisLine={false} tickLine={false} />
            <YAxis hide domain={[0, 100]} />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '10px' }}
            />
            <Bar dataKey="level" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.level > 80 ? '#ef4444' : 'var(--accent)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
