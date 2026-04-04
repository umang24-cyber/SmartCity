import React, { useState } from 'react';
import { detectZoneAnomaly } from '../api/smartcity';
import { Activity, AlertOctagon, TrendingUp } from 'lucide-react';

export default function AnomalyScanner() {
  const [zoneId, setZoneId] = useState('INT_001');
  const [timeSeries, setTimeSeries] = useState('2, 3, 2, 8, 14');
  const [status, setStatus] = useState('IDLE');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleScan = async (e) => {
    e.preventDefault();
    setStatus('SCANNING');
    setErrorMsg('');
    setResult(null);

    const values = timeSeries.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
    
    if (values.length < 3) {
      setErrorMsg('Need at least 3 values for Z-score calculation.');
      setStatus('ERROR');
      return;
    }

    try {
      const res = await detectZoneAnomaly(zoneId, values);
      setResult(res);
      setStatus('IDLE');
    } catch (err) {
      setErrorMsg(err.message || 'Anomaly scan failed.');
      setStatus('ERROR');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
      <div className="panel panel-cut" style={{ padding: '1.5rem', flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--accent)', letterSpacing: '0.15em', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={20} /> STATISTICAL ANOMALY SCANNER
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Input recent incident counts or crowd volume metrics below. The backend AI engine will evaluate the data stream using Z-score statistical analysis to detect sudden surges or critical spikes in activity.
        </p>

        <form onSubmit={handleScan} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label className="label-xs" style={{ display: 'block', marginBottom: '0.5rem' }}>TARGET ZONE ID</label>
            <input 
              type="text" 
              value={zoneId} 
              onChange={e => setZoneId(e.target.value)} 
              className="sub-input" 
              required 
            />
          </div>
          <div>
            <label className="label-xs" style={{ display: 'block', marginBottom: '0.5rem' }}>TIME SERIES DATA (COMMA SEPARATED)</label>
            <input 
              type="text" 
              value={timeSeries} 
              onChange={e => setTimeSeries(e.target.value)} 
              className="sub-input" 
              placeholder="e.g. 5, 6, 5, 20" 
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={status === 'SCANNING'}
            className="btn-primary" 
            style={{ padding: '0.65rem 1.5rem', height: '36px' }}
          >
            {status === 'SCANNING' ? 'CALCULATING...' : 'INITIATE SCAN'}
          </button>
        </form>
        {errorMsg && <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginTop: '1rem' }}>ERROR: {errorMsg}</div>}
      </div>

      {result && (
        <div className="panel panel-cut fade-in" style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column', background: result.anomaly_detected ? 'rgba(255, 51, 68, 0.05)' : 'rgba(0, 255, 136, 0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
             <div>
               <div className="label-xs">ANALYSIS REPORT FOR ZONE:</div>
               <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text-primary)' }}>{result.zone_id}</div>
             </div>
             
             <div style={{ textAlign: 'right' }}>
               <div className="label-xs">DETECTION STATUS</div>
               {result.anomaly_detected ? (
                 <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertOctagon size={20} /> CRITICAL SPIKE DETECTED
                 </div>
               ) : (
                 <div style={{ color: 'var(--safe)', fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    NOMINAL VARIANCE
                 </div>
               )}
             </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
             <div style={{ padding: '1rem', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
               <div className="label-xs">ANOMALY SCORE</div>
               <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', color: result.anomaly_score > 0.5 ? 'var(--amber)' : 'var(--accent)' }}>
                 {(result.anomaly_score * 100).toFixed(0)}%
               </div>
             </div>
             <div style={{ padding: '1rem', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
               <div className="label-xs">Z-SCORE INTENSITY</div>
               <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', color: 'var(--text-primary)' }}>
                 {result.zscore ? result.zscore.toFixed(2) : 'N/A'}
               </div>
             </div>
             <div style={{ padding: '1rem', border: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
               <div className="label-xs">AI METHODOLOGY</div>
               <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                 {result.method.toUpperCase()}
               </div>
             </div>
          </div>

          <div style={{ flex: 1, border: '1px solid var(--border)', background: 'var(--bg-panel)', padding: '1.5rem' }}>
            <div className="label-xs" style={{ marginBottom: '1rem' }}>SYSTEM DIAGNOSTICS & DETAILS</div>
            <pre style={{ 
              fontFamily: 'var(--font-mono)', 
              fontSize: '0.75rem', 
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              margin: 0
            }}>
              {JSON.stringify(result.details, null, 2)}
            </pre>
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--border)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
              <TrendingUp size={14} /> Backend Model: {result.loader_status}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
