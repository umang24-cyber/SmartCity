import React, { useState } from 'react';
import { postReport, analyzeReport } from '../api/smartcity';

const VALID_TYPES = [
  { value: 'poor_lighting',       label: 'POOR LIGHTING' },
  { value: 'felt_followed',       label: 'FELT FOLLOWED' },
  { value: 'broken_cctv',         label: 'BROKEN CCTV' },
  { value: 'suspicious_activity', label: 'SUSPICIOUS ACTIVITY' },
];

export default function ReportForm() {
  const [form, setForm] = useState({
    lat: '',
    lng: '',
    incident_type: 'poor_lighting',
    severity: 3,
    description: '',
  });
  const [status, setStatus] = useState(null); // null | 'loading' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [incidentId, setIncidentId] = useState('');
  const [nlpData, setNlpData] = useState(null);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const payload = {
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        incident_type: form.incident_type,
        severity: form.severity,
        description: form.description,
      };
      const res = await postReport(payload);
      setIncidentId(res.incident_id || 'INC_' + Date.now());

      if (form.description && form.description.length >= 5) {
        try {
          const nlpRes = await analyzeReport(form.description);
          setNlpData(nlpRes);
        } catch (nlpErr) {
          console.warn('NLP Analysis skipped:', nlpErr);
          setNlpData(null);
        }
      } else {
        setNlpData(null);
      }

      setStatus('success');
      setTimeout(() => {
        setStatus(null);
        setForm({ lat: '', lng: '', incident_type: 'poor_lighting', severity: 3, description: '' });
        setIncidentId('');
        setNlpData(null);
      }, 6000);
    } catch (err) {
      setErrorMsg(typeof err === 'object' && err !== null && err.message ? err.message : 'DISPATCH FAILED');
      setStatus('error');
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const SevBtn = ({ v }) => (
    <button
      type="button"
      onClick={() => set('severity', v)}
      style={{
        flex: 1,
        padding: '0.4rem',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        letterSpacing: '0.1em',
        background: form.severity === v
          ? (v >= 5 ? 'var(--red-alert)' : v >= 3 ? 'var(--amber)' : 'var(--accent)')
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${form.severity === v
          ? (v >= 5 ? 'var(--red-alert)' : v >= 3 ? 'var(--amber)' : 'var(--accent)')
          : 'var(--border)'}`,
        color: form.severity === v ? '#030d18' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        fontWeight: form.severity === v ? 700 : 400,
      }}
    >
      {v}
    </button>
  );

  return (
    <div className="panel panel-cut" style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="label-xs" style={{ color: 'var(--accent)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span className="blink-slow" style={{ color: 'var(--red-alert)' }}>✦</span>
        INCIDENT DISPATCH CONSOLE
      </div>

      {/* Overlay states */}
      {status === 'success' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(3,13,24,0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '0.75rem',
        }}
          className="fade-in"
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--accent)', letterSpacing: '0.2em' }}>
            DISPATCH CONFIRMED
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            {incidentId}
          </div>
          <div className="led led-green pulse-green" style={{ width: 12, height: 12, marginBottom: 8 }} />
          
          {nlpData && (
            <div style={{ background: 'rgba(0,255,136,0.05)', border: '1px solid var(--border)', padding: '1rem', width: '85%' }}>
              <div className="label-xs" style={{ color: 'var(--accent)', marginBottom: 6 }}>NLP ANALYSIS</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><strong>Classification:</strong> {nlpData.emergency_level} EMERGENCY</div>
                <div><strong>Calc Severity:</strong> {(nlpData.severity || 1).toFixed(1)} / 5.0</div>
                <div><strong>Keywords:</strong> {(nlpData.matched_keywords || []).join(', ') || 'None'}</div>
                {nlpData.is_duplicate && (
                  <div style={{ color: 'var(--amber)', marginTop: 4 }}>[!] Possible Duplicate</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {status === 'error' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(3,13,24,0.95)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '0.75rem',
        }}
          className="fade-in"
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: 'var(--red-alert)', letterSpacing: '0.2em' }}>
            DISPATCH FAILED
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.67rem', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 240 }}>
            {errorMsg}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>
        {/* Coordinates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <div className="label-xs" style={{ marginBottom: 3 }}>LATITUDE</div>
            <input type="number" step="any" required placeholder="12.9716"
              value={form.lat} onChange={e => set('lat', e.target.value)}
              className="sub-input"
            />
          </div>
          <div>
            <div className="label-xs" style={{ marginBottom: 3 }}>LONGITUDE</div>
            <input type="number" step="any" required placeholder="77.5946"
              value={form.lng} onChange={e => set('lng', e.target.value)}
              className="sub-input"
            />
          </div>
        </div>

        {/* Type */}
        <div>
          <div className="label-xs" style={{ marginBottom: 3 }}>INCIDENT TYPE</div>
          <select
            value={form.incident_type}
            onChange={e => set('incident_type', e.target.value)}
            className="sub-input"
          >
            {VALID_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Severity */}
        <div>
          <div className="label-xs" style={{ marginBottom: 5 }}>SEVERITY LEVEL</div>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {[1, 2, 3, 4, 5].map(v => <SevBtn key={v} v={v} />)}
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Description textarea */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="label-xs" style={{ marginBottom: 3 }}>DESCRIPTION (OPTIONAL)</div>
          <textarea
            placeholder="Describe the incident for NLP analysis (min 5 chars)..."
            value={form.description}
            onChange={e => set('description', e.target.value)}
            className="sub-input"
            style={{ flex: 1, minHeight: 60, resize: 'none' }}
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={status === 'loading'}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.72rem',
            letterSpacing: '0.2em',
            padding: '0.7rem',
            background: status === 'loading' ? 'rgba(255,51,68,0.1)' : 'rgba(255,51,68,0.12)',
            border: '1px solid var(--red-alert)',
            color: 'var(--red-alert)',
            cursor: status === 'loading' ? 'wait' : 'pointer',
            transition: 'all 0.2s',
            width: '100%',
          }}
          onMouseEnter={e => { if (status !== 'loading') { e.currentTarget.style.background = 'var(--red-alert)'; e.currentTarget.style.color = '#030d18'; }}}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,51,68,0.12)'; e.currentTarget.style.color = 'var(--red-alert)'; }}
        >
          {status === 'loading' ? '⟳ TRANSMITTING...' : '✦ DISPATCH REPORT'}
        </button>
      </form>
    </div>
  );
}
