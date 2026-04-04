import React, { useState, useRef } from 'react';
import { analyzeCCTVSnapshot } from '../api/smartcity';
import { Camera, Upload, AlertTriangle, Users, Activity } from 'lucide-react';

export default function CCTVPanel() {
  const [imagePreview, setImagePreview] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [status, setStatus] = useState('IDLE'); // IDLE, UPLOADING, ANALYZING, ERROR
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setStatus('UPLOADING');
    setErrorMsg('');
    setAnalysisResult(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64String = event.target.result;
      setImagePreview(base64String);
      
      // Extract base64 payload (remove data:image/jpeg;base64,)
      const payload = base64String.split(',')[1];
      
      try {
        setStatus('ANALYZING');
        const result = await analyzeCCTVSnapshot(payload);
        setAnalysisResult(result);
        setStatus('IDLE');
      } catch (err) {
        console.error("CCTV Analysis Failed:", err);
        setErrorMsg(err.message || 'CV Pipeline Failure');
        setStatus('ERROR');
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read image file');
      setStatus('ERROR');
    };
    reader.readAsDataURL(file);
  };

  const clearFeed = () => {
    setImagePreview(null);
    setAnalysisResult(null);
    setStatus('IDLE');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 2fr) minmax(280px, 1fr)', gap: '1rem', height: '100%' }}>
      {/* Viewer / Feed Simulator */}
      <div className="panel panel-cut" style={{ display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--accent)', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Camera size={16} /> SURVEILLANCE UPLINK
          </div>
          {status === 'ANALYZING' && <div className="pulse-amber" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--amber)' }}>PROCESSING VISUAL DATA...</div>}
        </div>

        <div style={{ flex: 1, position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {imagePreview ? (
            <>
              <img src={imagePreview} alt="CCTV Feed" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} className={status === 'ANALYZING' ? 'pulse-opacity' : ''} />
              <div className="scanlines" style={{ opacity: 0.5 }} />
              {/* Optional UI overlay if anomalies found */}
              {analysisResult?.anomaly_detected && (
                <div style={{ position: 'absolute', inset: 0, border: '4px solid var(--danger)', pointerEvents: 'none' }}>
                   <div style={{ position: 'absolute', top: 10, right: 10, background: 'var(--danger)', color: '#fff', padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 'bold' }}>
                     THREAT DETECTED
                   </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--border)' }}>
               <Camera size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
               <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>FEED DISCONNECTED</div>
               <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', opacity: 0.5, marginTop: '0.5rem' }}>AWAITING MANUAL INPUT</div>
            </div>
          )}
        </div>

        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
           <input 
             type="file" 
             accept="image/*" 
             onChange={handleFileChange} 
             style={{ display: 'none' }} 
             ref={fileInputRef}
           />
           <div style={{ display: 'flex', gap: '1rem' }}>
             <button 
               onClick={() => fileInputRef.current.click()}
               disabled={status === 'ANALYZING'}
               className="btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
             >
               <Upload size={16} /> {imagePreview ? 'OVERRIDE FEED' : 'CONNECT CAMERA STREAM'}
             </button>
             {imagePreview && (
               <button onClick={clearFeed} className="btn-secondary" style={{ padding: '0 1rem' }}>TERMINATE</button>
             )}
           </div>
           {errorMsg && <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', marginTop: '0.5rem' }}>{errorMsg}</div>}
        </div>
      </div>

      {/* Analytics Result Panel */}
      <div className="panel panel-cut" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--accent)', letterSpacing: '0.15em' }}>
          VISION ANALYTICS
        </div>

        {!analysisResult ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
            {status === 'ANALYZING' ? 'CV Pipeline running inference...' : 'No data ingested.'}
          </div>
        ) : (
          <>
            {/* Primary Status */}
            <div style={{ 
              padding: '1rem', 
              background: analysisResult.anomaly_detected ? 'rgba(255,51,68,0.1)' : 'rgba(0,255,136,0.05)',
              border: `1px solid ${analysisResult.anomaly_detected ? 'var(--danger)' : 'var(--accent)'}`,
              borderRadius: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Activity size={18} color={analysisResult.anomaly_detected ? 'var(--danger)' : 'var(--safe)'} />
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: analysisResult.anomaly_detected ? 'var(--danger)' : 'var(--safe)' }}>
                  {analysisResult.anomaly_detected ? 'ANOMALY DETECTED' : 'PARAMETERS NOMINAL'}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Danger Score Integration: {(analysisResult.danger_contribution * 100).toFixed(1)}% <br/>
                Overall Safety: {analysisResult.safety_score}/100
              </div>
            </div>

            {/* Crowd Analysis */}
            <div>
              <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>CROWD METRICS</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', border: '1px solid var(--border)' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                   <Users size={16} color="var(--accent)" />
                   <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>Count: {analysisResult.people_count}</span>
                 </div>
                 <div style={{ 
                   fontFamily: 'var(--font-mono)', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '2px',
                   background: analysisResult.crowd_density === 'CRITICAL' ? 'var(--danger)' : 'var(--bg-panel)',
                   color: analysisResult.crowd_density === 'CRITICAL' ? '#fff' : 'var(--accent)',
                   border: `1px solid ${analysisResult.crowd_density === 'CRITICAL' ? 'transparent' : 'var(--accent)'}`
                 }}>
                   {analysisResult.crowd_density} DENSITY
                 </div>
              </div>
            </div>

            {/* Anomalies List */}
            {analysisResult.anomalies?.length > 0 && (
              <div>
                <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--danger)', marginBottom: '0.5rem' }}>DETECTED THREATS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {analysisResult.anomalies.map((anom, idx) => (
                    <div key={idx} style={{ padding: '0.5rem', borderLeft: '2px solid var(--danger)', background: 'rgba(255,51,68,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                        <AlertTriangle size={12} color="var(--danger)" />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-primary)' }}>{anom.type.toUpperCase()}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                        Conf: {(anom.confidence * 100).toFixed(1)}% {anom.details ? `| ${anom.details}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* System Info */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--border)' }}>
              Inference Time: {analysisResult.inference_ms.toFixed(1)}ms <br/>
              Engine Status: {analysisResult.loader_status}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
