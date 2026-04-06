import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Explorer from '../components/Explorer';
import { getOverview, getSupervisorTrends, getInfrastructureStatus, fetchSupervisorReports } from '../api/smartcity';
import { useTigerGraph } from '../hooks/useTigerGraph';
import ModeSlider from '../components/ModeSlider';
import OrayaLogo from '../components/OrayaLogo';

/* ── Sparkline ──────────────────────────────────────────────── */
function Sparkline({ data = [], color = 'var(--accent)', height = 40, width = 160 }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible', display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={lastY} r="3" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

/* ── Infra colors ───────────────────────────────────────────── */
const INFRA_COLORS = { active: 'var(--accent)', inactive: 'var(--red-alert)', degraded: 'var(--amber)' };

/* ── Emergency level helpers ───────────────────────────────── */
const emColor = (lvl) => {
  const l = (lvl || 'NORMAL').toUpperCase();
  if (l === 'CRITICAL') return '#ff3344';
  if (l === 'HIGH')     return '#ff6600';
  if (l === 'MEDIUM')   return '#ffaa00';
  if (l === 'LOW')      return '#00cc66';
  return 'rgba(255,255,255,0.4)';
};

/* ── Floating Window ─────────────────────────────────────────── */
function FloatingWindow({
  id, title, subtitle, badge, badgeColor = 'var(--amber)',
  accentColor = 'var(--amber)', icon, children,
  defaultPos, collapsed: initialCollapsed = false,
  collapsedContent, zIndex = 100, onFocus,
}) {
  const [pos, setPos] = useState(defaultPos);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e) => {
    if (e.target.closest('.fw-no-drag')) return;
    onFocus?.(id);
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    setIsDragging(true);
  }, [pos, id, onFocus]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => setPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    const onUp = () => setIsDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging]);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onFocus?.(id)}
      style={{
        position: 'absolute', left: pos.x, top: pos.y, zIndex,
        userSelect: 'none',
        transition: isDragging ? 'none' : 'box-shadow 0.3s ease, transform 0.2s ease',
        transform: isHovered && !isDragging ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: isHovered
          ? `0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px ${accentColor}40, 0 0 30px ${accentColor}15`
          : `0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)`,
        borderRadius: 8, willChange: 'transform',
      }}
    >
      <div style={{
        background: 'rgba(10, 15, 25, 0.93)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${accentColor}30`, borderTop: `1.5px solid ${accentColor}70`,
        borderRadius: 8, overflow: 'hidden',
      }}>
        {/* Title bar */}
        <div
          onMouseDown={onMouseDown}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.55rem 0.85rem',
            background: `linear-gradient(90deg, ${accentColor}10 0%, transparent 100%)`,
            borderBottom: collapsed ? 'none' : `1px solid ${accentColor}20`,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, opacity: 0.35, marginRight: 2 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ display: 'flex', gap: 3 }}>
                {[0,1].map(j => <div key={j} style={{ width: 2, height: 2, borderRadius: '50%', background: accentColor }} />)}
              </div>
            ))}
          </div>
          {icon && <span style={{ fontSize: '0.75rem', filter: `drop-shadow(0 0 4px ${accentColor})`, color: accentColor }}>{icon}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.62rem', color: accentColor, letterSpacing: '0.2em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
            {subtitle && !collapsed && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.52rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', marginTop: 1 }}>{subtitle}</div>}
          </div>
          {badge && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', padding: '2px 7px', border: `1px solid ${badgeColor}60`, color: badgeColor, background: `${badgeColor}10`, borderRadius: 3, letterSpacing: '0.08em', flexShrink: 0 }}>{badge}</span>
          )}
          <button
            className="fw-no-drag"
            onClick={e => { e.stopPropagation(); setCollapsed(v => !v); }}
            style={{ background: 'transparent', border: `1px solid ${accentColor}30`, color: accentColor, width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s ease', padding: 0, lineHeight: 1 }}
            onMouseEnter={e => { e.currentTarget.style.background = `${accentColor}20`; e.currentTarget.style.borderColor = accentColor; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `${accentColor}30`; }}
          >
            {collapsed ? '⊞' : '⊟'}
          </button>
        </div>
        {/* Expandable body */}
        <div style={{ overflow: 'hidden', maxHeight: collapsed ? 0 : '72vh', opacity: collapsed ? 0 : 1, transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease', pointerEvents: collapsed ? 'none' : 'all' }}>
          <div className="fw-no-drag" style={{ padding: '0.75rem 0.85rem', overflowY: 'auto', maxHeight: '68vh' }}>
            {children}
          </div>
        </div>
        {collapsed && collapsedContent && (
          <div className="fw-no-drag" style={{ padding: '0.4rem 0.85rem 0.55rem', borderTop: `1px solid ${accentColor}15` }}>
            {collapsedContent}
          </div>
        )}
        {!collapsed && <div style={{ height: 1, background: `linear-gradient(90deg, ${accentColor}40, transparent)` }} />}
      </div>
    </div>
  );
}

/* ── NLP Analysis Card (full view for a submitted report) ──── */
function ReportCard({ report, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const lvl = (report.emergency_level || 'NORMAL').toUpperCase();
  const col = emColor(lvl);
  const sev = Math.min(5, Math.max(1, report.severity ?? 1));
  const sevPct = ((sev - 1) / 4) * 100;
  const submitted = report.timestamp ? new Date(report.timestamp) : null;
  const timeStr = submitted ? submitted.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const dateStr = submitted ? submitted.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

  // Emotion scores
  const emotionScores = report.emotion_all_scores ? Object.entries(report.emotion_all_scores)
    .sort((a, b) => b[1] - a[1]).slice(0, 4) : [];

  return (
    <div
      onClick={() => setExpanded(v => !v)}
      style={{
        border: `1px solid ${col}28`,
        borderLeft: `2.5px solid ${col}`,
        borderRadius: 5,
        background: `linear-gradient(135deg, ${col}06 0%, rgba(5,12,22,0.55) 100%)`,
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${col}12 0%, rgba(5,12,22,0.8) 100%)`; e.currentTarget.style.borderColor = `${col}55`; }}
      onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg, ${col}06 0%, rgba(5,12,22,0.55) 100%)`; e.currentTarget.style.borderColor = `${col}28`; }}
    >
      {/* Compact header */}
      <div style={{ padding: '0.6rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(report.incident_type || 'GENERAL REPORT').replace(/_/g, ' ').toUpperCase()}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.54rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            {report.report_id} · {dateStr} {timeStr}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '2px 6px', background: `${col}18`, color: col, border: `1px solid ${col}45`, borderRadius: 3, letterSpacing: '0.06em' }}>{lvl}</span>
          <span style={{ fontSize: '0.51rem', color: 'rgba(255,255,255,0.3)' }}>SEV {sev.toFixed(1)}/5</span>
        </div>
        <span style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.2)', transition: 'transform 0.2s ease, color 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'none', color: expanded ? col : undefined }}>▼</span>
      </div>

      {/* Severity bar */}
      <div style={{ height: 1.5, background: 'rgba(255,255,255,0.05)', margin: '0 0.7rem' }}>
        <div style={{ height: '100%', width: `${sevPct}%`, background: col, borderRadius: 1, boxShadow: `0 0 6px ${col}60`, transition: 'width 0.6s ease' }} />
      </div>

      {/* Expanded NLP analysis */}
      <div style={{ maxHeight: expanded ? 600 : 0, opacity: expanded ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease' }}>
        <div style={{ padding: '0.7rem 0.75rem 0.75rem' }}>

          {/* Report text */}
          {report.text && (
            <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: '0.65rem', padding: '0.45rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${col}50`, borderRadius: '0 3px 3px 0', fontStyle: 'italic' }}>
              "{report.text}"
            </div>
          )}

          {/* Key metrics row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', marginBottom: '0.6rem' }}>
            {[
              { label: 'SENTIMENT', value: (report.sentiment || 'neutral').toUpperCase(), color: report.sentiment === 'negative' ? 'var(--red-alert)' : report.sentiment === 'positive' ? 'var(--accent)' : 'rgba(255,255,255,0.5)' },
              { label: 'DISTRESS', value: report.distress_level || '—', color: report.distress_level === 'HIGH' ? 'var(--red-alert)' : report.distress_level === 'MEDIUM' ? 'var(--amber)' : 'rgba(255,255,255,0.45)' },
              { label: 'CREDIBILITY', value: report.credibility_label || '—', color: report.credibility_score >= 70 ? 'var(--accent)' : report.credibility_score >= 40 ? 'var(--amber)' : 'var(--red-alert)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '0.35rem 0.45rem', background: 'rgba(0,0,0,0.25)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '0.48rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: '0.6rem', color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Severity + credibility bars */}
          <div style={{ marginBottom: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {/* Severity bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>SEVERITY SCORE</span>
                <span style={{ fontSize: '0.55rem', color: col, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{sev.toFixed(1)} / 5.0</span>
              </div>
              <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${sevPct}%`, background: col, borderRadius: 2, boxShadow: `0 0 6px ${col}80`, transition: 'width 0.7s ease' }} />
              </div>
            </div>
            {/* Credibility bar */}
            {report.credibility_score != null && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>CREDIBILITY</span>
                  <span style={{ fontSize: '0.55rem', color: report.credibility_score >= 70 ? 'var(--accent)' : 'var(--amber)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{report.credibility_score}%</span>
                </div>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${report.credibility_score}%`, background: report.credibility_score >= 70 ? 'var(--accent)' : 'var(--amber)', borderRadius: 2, transition: 'width 0.7s ease' }} />
                </div>
              </div>
            )}
          </div>

          {/* Emotion */}
          {report.emotion && (
            <div style={{ marginBottom: '0.55rem' }}>
              <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>EMOTION PROFILE</div>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {emotionScores.map(([emotion, score]) => (
                  <div key={emotion} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '2px 7px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                    <span style={{ fontSize: '0.56rem', color: '#fff', fontFamily: 'var(--font-mono)' }}>{emotion}</span>
                    <span style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.4)' }}>{(score * 100).toFixed(0)}%</span>
                  </div>
                ))}
                {emotionScores.length === 0 && (
                  <div style={{ padding: '2px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3 }}>
                    <span style={{ fontSize: '0.58rem', color: '#fff', fontFamily: 'var(--font-mono)' }}>{report.emotion} ({(report.emotion_confidence * 100 || 0).toFixed(0)}%)</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Keywords */}
          {report.matched_keywords?.length > 0 && (
            <div style={{ marginBottom: '0.55rem' }}>
              <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>MATCHED KEYWORDS</div>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                {report.matched_keywords.slice(0, 8).map(kw => (
                  <span key={kw} style={{ fontSize: '0.57rem', padding: '2px 6px', border: `1px solid ${col}30`, color: col, background: `${col}08`, borderRadius: 3, fontFamily: 'var(--font-mono)' }}>{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Auto response / recommended actions */}
          {report.auto_response && (
            <div style={{ marginBottom: '0.55rem', padding: '0.4rem 0.6rem', background: 'rgba(255,170,0,0.05)', borderLeft: '2px solid var(--amber)', borderRadius: '0 3px 3px 0', fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>
              🤖 {report.auto_response}
            </div>
          )}
          {report.recommended_actions?.length > 0 && (
            <div style={{ marginBottom: '0.55rem' }}>
              <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>RECOMMENDED ACTIONS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {report.recommended_actions.slice(0, 3).map((action, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.58rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                    <span style={{ color: col, flexShrink: 0 }}>→</span>
                    <span>{action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Duplicate warning */}
          {report.is_duplicate && (
            <div style={{ padding: '0.3rem 0.5rem', background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.3)', borderRadius: 3, fontSize: '0.58rem', color: 'var(--amber)', marginBottom: '0.45rem' }}>
              ⚠ Possible duplicate report detected
            </div>
          )}

          {/* Flags */}
          {report.credibility_flags?.length > 0 && (
            <div style={{ marginBottom: '0.45rem', display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {report.credibility_flags.map(f => (
                <span key={f} style={{ fontSize: '0.52rem', padding: '1px 5px', border: '1px solid rgba(255,50,50,0.3)', color: 'rgba(255,100,100,0.7)', borderRadius: 3 }}>⚑ {f}</span>
              ))}
            </div>
          )}

          {/* Location & meta */}
          <div style={{ display: 'flex', gap: '0.7rem', fontSize: '0.56rem', color: 'rgba(255,255,255,0.3)', flexWrap: 'wrap' }}>
            <span>{report.source === 'user_report' ? '👤 Citizen' : report.source === 'dispatch_console' ? '🎛 Dispatch' : '🤖 AI'}</span>
            {report.lat != null && report.lng != null && <span>📍 {report.lat?.toFixed(4)}, {report.lng?.toFixed(4)}</span>}
            {report.loader_status && <span style={{ color: 'rgba(0,255,136,0.3)' }}>NLP: {report.loader_status}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── InfraCard ───────────────────────────────────────────────── */
function InfraCard({ f, i }) {
  const col = INFRA_COLORS[f.status] || 'var(--border)';
  const reliability = ((f.reliability_score ?? 0) * 100).toFixed(0);
  return (
    <div style={{ border: `1px solid ${col}22`, borderLeft: `2px solid ${col}`, borderRadius: 5, background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.7rem', transition: 'background 0.2s ease' }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.4)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.25)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.64rem', color: '#fff', fontWeight: 600 }}>{f.feature_id || f.name || `UNIT-${i + 1}`}</span>
        <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '2px 6px', background: `${col}15`, color: col, border: `1px solid ${col}40`, borderRadius: 3 }}>{f.status?.toUpperCase()}</span>
      </div>
      <div style={{ fontSize: '0.54rem', color: 'rgba(255,255,255,0.33)', marginBottom: '0.35rem' }}>{f.type || f.feature_type || 'System Component'}</div>
      <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.54rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
        <span><span style={{ color: 'rgba(255,255,255,0.3)' }}>Reliability: </span><span style={{ color: reliability > 70 ? 'var(--accent)' : 'var(--amber)', fontWeight: 600 }}>{reliability}%</span></span>
        <span><span style={{ color: 'rgba(255,255,255,0.3)' }}>Crit: </span><span style={{ color: ((f.criticality_score ?? 0) * 100) > 70 ? 'var(--red-alert)' : 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{((f.criticality_score ?? 0) * 100).toFixed(0)}%</span></span>
        <span><span style={{ color: 'rgba(255,255,255,0.3)' }}>Maint: </span><span style={{ color: 'var(--amber)', fontWeight: 600 }}>{f.maintenance_prediction || '—'}</span></span>
      </div>
      <div style={{ height: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 1 }}>
        <div style={{ height: '100%', width: `${reliability}%`, background: col, borderRadius: 1, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

/* ── StatPill ────────────────────────────────────────────────── */
function StatPill({ label, value, color, glow, pulse }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.55rem 1.1rem', background: 'rgba(8, 14, 26, 0.85)', backdropFilter: 'blur(16px)', border: `1px solid ${color}25`, borderTop: `1.5px solid ${color}50`, borderRadius: 6, boxShadow: glow ? `0 4px 20px ${color}20` : '0 4px 16px rgba(0,0,0,0.4)', transition: 'all 0.3s ease', minWidth: 90 }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}50`; e.currentTarget.style.boxShadow = `0 6px 28px ${color}30`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${color}25`; e.currentTarget.style.boxShadow = glow ? `0 4px 20px ${color}20` : '0 4px 16px rgba(0,0,0,0.4)'; }}
    >
      <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color, animation: pulse ? 'statPulse 2s ease-in-out infinite' : 'none', lineHeight: 1 }}>{value}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function SupervisorDashboard() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { intersections, safeRoute, selectedIntersection } = useTigerGraph();

  const [reports, setReports] = useState([]);       // from /reports → enriched NLP reports
  const [reportLoading, setReportLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [infraStatus, setInfraStatus] = useState([]);
  const [windowZIndexes, setWindowZIndexes] = useState({ reports: 200, infra: 200, trends: 200, stats: 200 });
  const zCounter = useRef(200);
  const refreshTimerRef = useRef(null);

  const loadReports = useCallback(async () => {
    try {
      const data = await fetchSupervisorReports(token);
      setReports(data);
    } catch {
      setReports([]);
    } finally {
      setReportLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      getOverview(token).then(setStats).catch(() => {});
      getSupervisorTrends(token).then(setTrends).catch(() => {});
      getInfrastructureStatus(token).then(res => setInfraStatus(Array.isArray(res) ? res : [])).catch(() => {});
    }
    loadReports();
    // Auto-refresh reports every 15s to pick up new submissions
    refreshTimerRef.current = setInterval(loadReports, 15000);
    return () => clearInterval(refreshTimerRef.current);
  }, [token, loadReports]);

  const handleLogout = () => { logout(); navigate('/login'); };
  const focusWindow = useCallback((id) => {
    zCounter.current += 1;
    setWindowZIndexes(prev => ({ ...prev, [id]: zCounter.current }));
  }, []);

  const trendData = trends?.safety_trend?.map(d => d.avg_score) ?? [];
  const incidentTrend = trends?.daily_incidents?.map(d => d.count) ?? [];
  const activeInfra = infraStatus.filter(f => f.status === 'active').length;
  const inactiveInfra = infraStatus.filter(f => f.status === 'inactive').length;

  // Critical / high count from reports
  const criticalCount = reports.filter(r => ['CRITICAL', 'HIGH'].includes((r.emergency_level || '').toUpperCase())).length;

  return (
    <div className="rbac-layout" style={{ fontFamily: 'var(--font-mono)' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,170,0,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />

      {/* Map */}
      <div className="map-container">
        <Explorer intersections={intersections} incidents={reports.map(r => ({ ...r, incident_id: r.report_id, incident_type: r.incident_type, lat: r.lat, lng: r.lng, severity: r.severity, verified: false, source: r.source }))} safeRoute={safeRoute} selectedIntersection={selectedIntersection} />
      </div>

      {/* Header */}
      <header className="site-header" style={{ borderBottomColor: 'var(--medium)50', background: 'rgba(8,12,20,0.88)', backdropFilter: 'blur(20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <OrayaLogo variant="full" status="active" subtitle={
            <span style={{ fontSize: '0.62rem', color: 'var(--medium)', fontFamily: 'var(--font-mono)', letterSpacing: '0.14em' }}>SUPERVISOR OVERRIDE</span>
          } />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 140 }}><ModeSlider /></div>
          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>OP: {user?.email}</span>
          <button onClick={handleLogout}
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', letterSpacing: '0.14em', padding: '5px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', color: 'rgba(255,255,255,0.55)', borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red-alert)'; e.currentTarget.style.color = 'var(--red-alert)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
          >TIMEOUT</button>
        </div>
      </header>

      {/* Stats bar */}
      <div style={{ position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)', zIndex: 500, display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
        <StatPill label="City Safety" value={stats ? `${stats.avg_city_safety ?? '--'}%` : '--'} color="var(--accent)" glow />
        <StatPill label="Reports" value={reports.length} color="var(--medium)" />
        <StatPill label="High Risk" value={criticalCount} color="var(--red-alert)" pulse={criticalCount > 0} />
        <StatPill label="Infrastructure" value={`${activeInfra}✔${inactiveInfra > 0 ? ` ${inactiveInfra}✕` : ''}`} color={inactiveInfra > 0 ? 'var(--amber)' : 'var(--accent)'} />
      </div>

      {/* ── Floating Window: Submitted Reports (from /reports) ── */}
      <FloatingWindow
        id="reports"
        title="INCIDENT REPORTS"
        subtitle="From citizen & dispatch submissions"
        badge={reportLoading ? 'LOADING…' : reports.length > 0 ? `${reports.length} REPORTS` : 'NO REPORTS YET'}
        badgeColor={reports.length > 0 ? 'var(--red-alert)' : 'rgba(255,255,255,0.3)'}
        accentColor="var(--medium)"
        icon="⬡"
        defaultPos={{ x: window.innerWidth - 380, y: 80 }}
        zIndex={windowZIndexes.reports}
        onFocus={focusWindow}
        collapsedContent={
          <div style={{ fontSize: '0.6rem', color: 'var(--medium)', fontFamily: 'var(--font-mono)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--red-alert)', fontWeight: 700 }}>{reports.length}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>submitted reports</span>
          </div>
        }
      >
        <div style={{ width: 330, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {reportLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>
              <span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block', marginRight: 8 }}>⟳</span>
              Fetching submitted reports…
            </div>
          ) : reports.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 6, lineHeight: 1.8 }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem', opacity: 0.4 }}>📭</div>
              No reports submitted yet.
              <br />
              <span style={{ fontSize: '0.58rem' }}>Use the Dispatch Console to submit one.</span>
            </div>
          ) : (
            reports.map(report => (
              <ReportCard key={report.report_id} report={report} />
            ))
          )}
        </div>
      </FloatingWindow>

      {/* ── Floating Window: Trends ── */}
      <FloatingWindow
        id="trends"
        title="SAFETY TRENDS"
        subtitle="7-day rolling data"
        badge="LIVE"
        badgeColor="var(--accent)"
        accentColor="var(--accent)"
        icon="◈"
        defaultPos={{ x: window.innerWidth - 760, y: 80 }}
        zIndex={windowZIndexes.trends}
        onFocus={focusWindow}
        collapsed={trendData.length === 0}
        collapsedContent={<div style={{ fontSize: '0.57rem', color: 'rgba(0,255,136,0.4)', fontFamily: 'var(--font-mono)' }}>No trend data yet</div>}
      >
        <div style={{ width: 280 }}>
          {trendData.length > 0 ? (
            <>
              <div style={{ marginBottom: '0.6rem' }}>
                <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Safety Score</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <Sparkline data={trendData} color="var(--accent)" width={210} height={44} />
                  <div style={{ textAlign: 'right', paddingLeft: 8 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--accent)', lineHeight: 1 }}>{trendData[trendData.length - 1]}%</div>
                    <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>current</div>
                  </div>
                </div>
              </div>
              {incidentTrend.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.6rem' }}>
                  <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Incident Volume</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <Sparkline data={incidentTrend} color="var(--red-alert)" width={210} height={44} />
                    <div style={{ textAlign: 'right', paddingLeft: 8 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--red-alert)', lineHeight: 1 }}>{incidentTrend[incidentTrend.length - 1]}</div>
                      <div style={{ fontSize: '0.5rem', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>latest</div>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.65rem', background: 'rgba(255,170,0,0.05)', borderLeft: '2px solid var(--medium)', borderRadius: '0 4px 4px 0', fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                🤖 Focus on repeated zone reports to reduce escalation risk faster.
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '1.5rem' }}>Awaiting trend data from backend…</div>
          )}
        </div>
      </FloatingWindow>

      {/* ── Floating Window: Infrastructure ── */}
      {infraStatus.length > 0 && (
        <FloatingWindow
          id="infra"
          title="INFRASTRUCTURE"
          subtitle="System health matrix"
          badge={`${activeInfra}✔${inactiveInfra > 0 ? ` ${inactiveInfra}✕` : ''}`}
          badgeColor={inactiveInfra > 0 ? 'var(--amber)' : 'var(--accent)'}
          accentColor={inactiveInfra > 0 ? 'var(--amber)' : 'var(--accent)'}
          icon="◎"
          defaultPos={{ x: 20, y: 80 }}
          collapsed
          zIndex={windowZIndexes.infra}
          onFocus={focusWindow}
          collapsedContent={<div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.58rem', fontFamily: 'var(--font-mono)' }}><span style={{ color: 'var(--accent)' }}>{activeInfra} active</span>{inactiveInfra > 0 && <span style={{ color: 'var(--red-alert)' }}>{inactiveInfra} down</span>}</div>}
        >
          <div style={{ width: 320, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {infraStatus.map((f, i) => <InfraCard key={i} f={f} i={i} />)}
          </div>
        </FloatingWindow>
      )}

      {/* ── Floating Window: Incident Breakdown ── */}
      {stats?.incidents_by_type && (
        <FloatingWindow
          id="stats"
          title="TYPE BREAKDOWN"
          subtitle="By category"
          accentColor="#a855f7"
          icon="▦"
          defaultPos={{ x: 20, y: 420 }}
          collapsed
          zIndex={windowZIndexes.stats}
          onFocus={focusWindow}
          collapsedContent={<div style={{ fontSize: '0.57rem', color: 'rgba(168,85,247,0.5)', fontFamily: 'var(--font-mono)' }}>{Object.keys(stats.incidents_by_type).length} categories</div>}
        >
          <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {Object.entries(stats.incidents_by_type).map(([type, count]) => {
              const maxCount = Math.max(...Object.values(stats.incidents_by_type));
              return (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1, fontSize: '0.6rem', color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{type.replace(/_/g, ' ')}</div>
                  <div style={{ width: 60, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }}>
                    <div style={{ height: '100%', width: `${(count / maxCount) * 100}%`, background: '#a855f7', borderRadius: 1, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#a855f7', minWidth: 16, textAlign: 'right', fontWeight: 700 }}>{count}</div>
                </div>
              );
            })}
          </div>
        </FloatingWindow>
      )}

      <style>{`
        @keyframes statPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; text-shadow: 0 0 12px currentColor; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
