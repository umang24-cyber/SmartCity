import React, { useState } from 'react';
import { Send } from 'lucide-react';

export default function ReportForm() {
  const [report, setReport] = useState({ type: 'Lighting', severity: 3, description: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Incident Reported:', report);
    setReport({ type: 'Lighting', severity: 3, description: '' });
  };

  return (
    <div className="glass rounded-2xl p-4 border border-white/5 h-full flex flex-col overflow-hidden">
      <h3 className="font-bold text-sm text-text-secondary uppercase tracking-widest mb-2">Report Incident</h3>
      <form onSubmit={handleSubmit} className="flex-col flex gap-2 flex-1 justify-between">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-text-secondary font-bold uppercase block mb-1">Type</label>
            <select 
              value={report.type} 
              onChange={e => setReport({...report, type: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-1.5 text-xs focus:border-accent outline-none transition-colors"
            >
              <option value="Lighting">Lighting</option>
              <option value="CCTV">CCTV</option>
              <option value="Footfall">Crowd</option>
              <option value="Traffic">Transit</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] text-text-secondary font-bold uppercase block mb-1">Severity</label>
            <div className="flex gap-1">
              {[1, 3, 5].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setReport({...report, severity: v})}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all ${report.severity === v ? 'bg-accent text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-16 lg:h-20">
          <label className="text-[10px] text-text-secondary font-bold uppercase block mb-1">Description</label>
          <textarea 
            value={report.description} 
            onChange={e => setReport({...report, description: e.target.value})}
            placeholder="Details..."
            className="w-full h-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs focus:border-accent outline-none transition-colors resize-none"
          />
        </div>

        <button type="submit" className="w-full bg-accent hover:bg-accent/80 text-white font-bold py-1.5 rounded-xl transition-all flex items-center justify-center gap-2 group text-xs">
          <Send className="w-3 h-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          Dispatch
        </button>
      </form>
    </div>
  );
}
