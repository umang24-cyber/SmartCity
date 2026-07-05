import React, { useState } from 'react';
import { exportReports } from '../api/smartcity';

/**
 * ExportModal — floating modal for configuring and triggering report exports.
 *
 * Matches the dark terminal / glassmorphism aesthetic of the Supervisor Dashboard.
 * Props:
 *   isOpen   — visibility flag
 *   onClose  — callback to close modal
 *   token    — JWT supervisor token
 */
export default function ExportModal({ isOpen, onClose, token }) {
  const [format, setFormat] = useState('csv');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minSeverity, setMinSeverity] = useState('');
  const [emergencyLevel, setEmergencyLevel] = useState('');
  const [includeZones, setIncludeZones] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleExport = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await exportReports({
        token,
        format,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        minSeverity: minSeverity ? parseFloat(minSeverity) : undefined,
        emergencyLevel: emergencyLevel || undefined,
        includeZones,
      });
      setSuccess(`${format.toUpperCase()} exported successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const accent = 'var(--accent)';
  const medium = 'var(--medium)';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'exportFadeIn 0.2s ease',
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: 420,
          maxWidth: '92vw',
          background: 'rgba(8, 14, 26, 0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${accent}30`,
          borderTop: `2px solid ${accent}70`,
          borderRadius: 10,
          boxShadow: `0 30px 80px rgba(0,0,0,0.8), 0 0 40px ${accent}10`,
          overflow: 'hidden',
          animation: 'exportSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: `linear-gradient(90deg, ${accent}08 0%, transparent 100%)`,
            borderBottom: `1px solid ${accent}20`,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.68rem',
                color: accent,
                letterSpacing: '0.2em',
              }}
            >
              EXPORT REPORTS
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.52rem',
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.1em',
                marginTop: 2,
              }}
            >
              Download incident data as CSV or PDF
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid rgba(255,255,255,0.15)`,
              color: 'rgba(255,255,255,0.4)',
              width: 26,
              height: 26,
              borderRadius: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.7rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--red-alert)';
              e.currentTarget.style.color = 'var(--red-alert)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

          {/* Format selector */}
          <div>
            <label style={labelStyle}>FORMAT</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['csv', 'pdf'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.68rem',
                    letterSpacing: '0.12em',
                    border: `1px solid ${format === f ? accent : 'rgba(255,255,255,0.12)'}`,
                    background: format === f ? `${accent}12` : 'rgba(0,0,0,0.3)',
                    color: format === f ? accent : 'rgba(255,255,255,0.5)',
                    borderRadius: 5,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textTransform: 'uppercase',
                  }}
                >
                  {f === 'csv' ? '📊 CSV' : '📄 PDF'}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>FROM DATE</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>TO DATE</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Severity + Emergency level */}
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>
                MIN SEVERITY
                {minSeverity && (
                  <span style={{ color: accent, marginLeft: 6, fontWeight: 700 }}>
                    {parseFloat(minSeverity).toFixed(1)}
                  </span>
                )}
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={minSeverity || 1}
                onChange={(e) => setMinSeverity(e.target.value === '1' ? '' : e.target.value)}
                style={{
                  width: '100%',
                  accentColor: accent,
                  cursor: 'pointer',
                  height: 4,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.48rem', color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                <span>1.0</span>
                <span>3.0</span>
                <span>5.0</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>EMERGENCY LEVEL</label>
              <select
                value={emergencyLevel}
                onChange={(e) => setEmergencyLevel(e.target.value)}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2300ff88' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  paddingRight: 24,
                }}
              >
                <option value="">ALL</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
          </div>

          {/* Include zones toggle */}
          <div
            onClick={() => setIncludeZones((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.55rem 0.7rem',
              background: includeZones ? `${accent}08` : 'rgba(0,0,0,0.2)',
              border: `1px solid ${includeZones ? `${accent}40` : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: `1.5px solid ${includeZones ? accent : 'rgba(255,255,255,0.2)'}`,
                background: includeZones ? `${accent}20` : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              {includeZones && (
                <span style={{ color: accent, fontSize: '0.6rem', lineHeight: 1 }}>✓</span>
              )}
            </div>
            <div>
              <div style={{ fontSize: '0.64rem', color: includeZones ? '#fff' : 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', fontWeight: 600, transition: 'color 0.2s ease' }}>
                Include Zone Danger Summary
              </div>
              <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                Appends a breakdown of all 30 monitored zones and their danger scores
              </div>
            </div>
          </div>

          {/* Status messages */}
          {error && (
            <div
              style={{
                padding: '0.45rem 0.65rem',
                background: 'rgba(255, 51, 68, 0.08)',
                border: '1px solid rgba(255, 51, 68, 0.3)',
                borderRadius: 5,
                fontSize: '0.6rem',
                color: 'var(--red-alert)',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>⚠</span> {error}
            </div>
          )}
          {success && (
            <div
              style={{
                padding: '0.45rem 0.65rem',
                background: `${accent}08`,
                border: `1px solid ${accent}30`,
                borderRadius: 5,
                fontSize: '0.6rem',
                color: accent,
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>✓</span> {success}
            </div>
          )}

          {/* Export button */}
          <button
            onClick={handleExport}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.65rem 0',
              fontFamily: 'var(--font-display)',
              fontSize: '0.72rem',
              letterSpacing: '0.18em',
              border: `1px solid ${accent}60`,
              background: loading
                ? 'rgba(0,0,0,0.3)'
                : `linear-gradient(135deg, ${accent}15 0%, ${accent}08 100%)`,
              color: loading ? 'rgba(255,255,255,0.35)' : accent,
              borderRadius: 6,
              cursor: loading ? 'wait' : 'pointer',
              transition: 'all 0.25s ease',
              boxShadow: loading ? 'none' : `0 4px 20px ${accent}15`,
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = `linear-gradient(135deg, ${accent}25 0%, ${accent}12 100%)`;
                e.currentTarget.style.boxShadow = `0 6px 28px ${accent}25`;
                e.currentTarget.style.borderColor = accent;
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = `linear-gradient(135deg, ${accent}15 0%, ${accent}08 100%)`;
                e.currentTarget.style.boxShadow = `0 4px 20px ${accent}15`;
                e.currentTarget.style.borderColor = `${accent}60`;
              }
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⟳</span>
                EXPORTING…
              </span>
            ) : (
              `⬡ DOWNLOAD ${format.toUpperCase()}`
            )}
          </button>
        </div>

        {/* Bottom accent bar */}
        <div style={{ height: 2, background: `linear-gradient(90deg, ${accent}50, transparent 80%)` }} />
      </div>

      <style>{`
        @keyframes exportFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes exportSlideUp {
          from { opacity: 0; transform: translate(-50%, -46%); }
          to   { opacity: 1; transform: translate(-50%, -50%); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

/* ── Shared inline styles ───────────────────────────────────────────────── */

const labelStyle = {
  display: 'block',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.52rem',
  color: 'rgba(255,255,255,0.35)',
  letterSpacing: '0.15em',
  marginBottom: 5,
  textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%',
  padding: '0.45rem 0.55rem',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.62rem',
  color: '#fff',
  background: 'rgba(0, 0, 0, 0.35)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 5,
  outline: 'none',
  transition: 'border-color 0.2s ease',
  boxSizing: 'border-box',
  colorScheme: 'dark',
};
