import React from 'react';
import { Map, ShieldAlert, Activity, Zap } from 'lucide-react';

export default function Sidebar({ activeTab, onTabChange }) {
  const icons = [
    { id: 'Map', icon: Map, label: 'Map' },
    { id: 'Alerts', icon: ShieldAlert, label: 'Alerts' },
    { id: 'Stats', icon: Activity, label: 'Stats' },
    { id: 'Power', icon: Zap, label: 'Power' },
  ];

  return (
    <div className="w-16 flex flex-col items-center py-6 gap-8 glass rounded-r-2xl h-full border-r border-white/5 relative z-50">
      <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent-glow animate-pulse">
        <Zap className="text-white w-6 h-6" />
      </div>
      <div className="flex flex-col gap-6 flex-1">
        {icons.map(({ id, icon: Icon, label }) => (
          <button 
            key={id} 
            onClick={() => onTabChange(id)}
            className={`p-3 rounded-xl transition-all duration-300 group relative ${activeTab === id ? 'text-accent bg-accent/10 shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]' : 'text-text-secondary hover:text-accent hover:bg-white/5'}`}
          >
            <Icon className="w-6 h-6" />
            <span className="absolute left-16 bg-bg-secondary backdrop-blur px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10 z-[100]">
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
