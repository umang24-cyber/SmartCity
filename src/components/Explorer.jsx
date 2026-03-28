import React from 'react';

export default function Explorer({ nodes, edges }) {
  return (
    <div className="glass rounded-2xl p-6 h-full flex flex-col border border-white/5 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">TigerGraph Explorer</h3>
        <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full animate-pulse border border-accent/30 font-bold uppercase tracking-widest">Live Node-Edge Feed</span>
      </div>
      
      <div className="flex-1 relative flex items-center justify-center bg-black/20 rounded-xl overflow-hidden group">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(var(--accent) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        
        <svg viewBox="0 0 400 300" className="w-full h-full stroke-accent/40 fill-accent/40">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Edges */}
          {edges.map((edge, i) => {
            const start = nodes.find(n => n.id === edge.source);
            const end = nodes.find(n => n.id === edge.target);
            return (
              <line 
                key={i} 
                x1={start.x} y1={start.y} 
                x2={end.x} y2={end.y} 
                className="stroke-accent transition-all duration-500 opacity-30 group-hover:opacity-60" 
                strokeWidth="1"
                strokeDasharray="4 2"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map(node => (
            <g key={node.id} className="cursor-pointer group/node" filter="url(#glow)">
              <circle 
                cx={node.x} cy={node.y} r="8" 
                className="fill-accent group-hover/node:fill-white transition-colors duration-300" 
              />
              <circle 
                cx={node.x} cy={node.y} r="14" 
                className="stroke-accent fill-transparent animate-pulse-slow" 
                strokeWidth="1" 
                strokeOpacity="0.4"
              />
              <text 
                x={node.x} y={node.y + 25} 
                textAnchor="middle" 
                className="text-[10px] fill-text-secondary group-hover/node:fill-text-primary font-bold uppercase tracking-widest pointer-events-none"
              >
                {node.type}
              </text>
            </g>
          ))}
        </svg>

        {/* HUD Overlay Elements */}
        <div className="absolute top-4 left-4 flex gap-2">
            {[1,2,3].map(i => <div key={i} className="w-1 h-3 bg-accent/40 rounded-full" />)}
        </div>
        <div className="absolute bottom-4 right-4 text-[10px] font-mono text-accent/60 flex flex-col items-end">
            <span>TX_LATENCY: 0.14ms</span>
            <span>NODES_SYNCED: 100%</span>
        </div>
      </div>
    </div>
  );
}
