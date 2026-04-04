import React, { useState } from 'react';

const TYPE_ICONS = {
  poor_lighting:       '⚡',
  felt_followed:       '👁',
  broken_cctv:         '📷',
  suspicious_activity: '⬡',
};

const TYPE_LABELS = {
  poor_lighting:       'POOR LIGHTING',
  felt_followed:       'FELT FOLLOWED',
  broken_cctv:         'BROKEN CCTV',
  suspicious_activity: 'SUSPICIOUS ACT.',
};

function SeverityBar({ level }) {
  const color = level >= 5 ? 'var(--red-alert)' : level >= 3 ? 'var(--amber)' : 'var(--accent)';
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          width: 6, height: 12, borderRadius: 1,
          background: i <= level ? color : 'rgba(255,255,255,0.08)',
          boxShadow: i <= level ? `0 0 4px ${color}` : 'none',
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  );
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function IncidentsPanel({ incidents = [], verifiedOnly, setVerifiedOnly }) {
  const [search, setSearch] = useState('');

  const filtered = incidents.filter(inc =>
    (!search || inc.incident_type.includes(search.toLowerCase()) || inc.incident_id.toLowerCase().includes(search.toLowerCase()))
  );

  const unverifiedCount = incidents.filter(i => !i.verified).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.75rem' }}>

      {/* Controls bar */}
      <div className="panel panel-cut" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        <div className="label-xs" style={{ color: 'var(--accent)' }}>
          INCIDENT FEED — {filtered.length} RECORDS
        </div>
        <div style={{ flex: 1 }} />

        {/* Search */}
        <input
          type="text"
          placeholder="SEARCH..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sub-input"
          style={{ width: 180 }}
        />

        {/* Verified toggle */}
        <button
          onClick={() => setVerifiedOnly(v => !v)}
          className={`btn-primary ${verifiedOnly ? '' : 'btn-amber'}`}
          style={{ whiteSpace: 'nowrap', padding: '0.35rem 0.85rem' }}
        >
          {verifiedOnly ? '✓ VERIFIED ONLY' : '◎ ALL INCIDENTS'}
        </button>

        {unverifiedCount > 0 && !verifiedOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div className="led led-amber pulse-amber" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--amber)' }}>
              {unverifiedCount} UNVERIFIED
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="panel panel-cut" style={{ flex: 1, padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <table className="sub-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>TYPE</th>
              <th>SEV</th>
              <th>COORDS</th>
              <th>REPORTED</th>
              <th>STATUS</th>
            </tr>
          </thead>
        </table>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table className="sub-table">
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    NO RECORDS FOUND
                  </td>
                </tr>
              )}
              {filtered.map(inc => (
                <tr key={inc.incident_id} className="fade-in">
                  <td style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                    {inc.incident_id}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span>{TYPE_ICONS[inc.incident_type] || '?'}</span>
                      <span style={{ fontSize: '0.65rem' }}>{TYPE_LABELS[inc.incident_type] || inc.incident_type}</span>
                    </div>
                  </td>
                  <td><SeverityBar level={inc.severity} /></td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text-secondary)' }}>
                    {inc.lat?.toFixed(4)}, {inc.lng?.toFixed(4)}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                    {timeAgo(inc.reported_at)}
                  </td>
                  <td>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.6rem',
                      padding: '2px 8px',
                      border: `1px solid ${inc.verified ? 'var(--accent)' : 'var(--amber)'}`,
                      color: inc.verified ? 'var(--accent)' : 'var(--amber)',
                      background: inc.verified ? 'rgba(0,255,136,0.06)' : 'rgba(255,170,0,0.06)',
                    }}>
                      {inc.verified ? 'VERIFIED' : 'PENDING'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
