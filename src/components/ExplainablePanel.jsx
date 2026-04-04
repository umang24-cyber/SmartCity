import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function ExplainablePanel({ reasoning, themeAction }) {
  if (!reasoning) return null;

  return (
    <div className={`glass rounded-2xl p-4 border overflow-hidden flex flex-col gap-2 transition-all duration-700
      ${themeAction === 'pulse-red' ? 'border-red-500/50 bg-red-500/5' : 
        themeAction === 'pulse-yellow' ? 'border-yellow-500/50 bg-yellow-500/5' : 
        'border-green-500/50 bg-green-500/5'}
    `}>
      <div className="flex items-center gap-2">
         <AlertCircle className={`w-4 h-4 
           ${themeAction === 'pulse-red' ? 'text-red-500' : 
             themeAction === 'pulse-yellow' ? 'text-yellow-500' : 
             'text-green-500'}
         `} />
         <h3 className="font-bold text-xs uppercase tracking-widest text-text-primary">Explainable AI Insights</h3>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed italic border-l-2 pl-3 
        border-white/20
      ">
        "{reasoning}"
      </p>
    </div>
  );
}
