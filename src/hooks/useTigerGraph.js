import { useState, useEffect, useCallback } from 'react';
import {
  fetchDangerScore, fetchIncidents, fetchSafeRoute, fetchClusterInfo, fetchHealth,
  MOCK_DANGER, MOCK_INCIDENTS, MOCK_ROUTE, MOCK_CLUSTER
} from '../api/smartcity';

export const useTigerGraph = () => {
  const [danger, setDanger]       = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [safeRoute, setSafeRoute] = useState(null);
  const [cluster, setCluster]     = useState(null);
  const [backendOnline, setBackendOnline] = useState(null); // null=checking, true, false
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIntersection, setSelectedIntersection] = useState('INT_001');
  const [selectedWeather, setSelectedWeather]           = useState('clear');
  const [verifiedOnly, setVerifiedOnly]                 = useState(false);

  // ── Check backend health ──────────────────────────────────────
  const checkHealth = useCallback(async () => {
    try { await fetchHealth(); setBackendOnline(true); }
    catch { setBackendOnline(false); }
  }, []);

  // ── Load danger score ─────────────────────────────────────────
  const loadDanger = useCallback(async () => {
    try {
      const d = await fetchDangerScore(selectedIntersection, selectedWeather);
      setDanger(d);
    } catch {
      setDanger(MOCK_DANGER);
    }
  }, [selectedIntersection, selectedWeather]);

  // ── Load incidents ────────────────────────────────────────────
  const loadIncidents = useCallback(async () => {
    try {
      const d = await fetchIncidents(verifiedOnly);
      setIncidents(d);
    } catch {
      setIncidents(MOCK_INCIDENTS);
    }
  }, [verifiedOnly]);

  // ── Load safe route ───────────────────────────────────────────
  const loadRoute = useCallback(async () => {
    try {
      const d = await fetchSafeRoute();
      setSafeRoute(d);
    } catch {
      setSafeRoute(MOCK_ROUTE);
    }
  }, []);

  // ── Load cluster info ─────────────────────────────────────────
  const loadCluster = useCallback(async () => {
    try {
      const d = await fetchClusterInfo(1);
      setCluster(d);
    } catch {
      setCluster(MOCK_CLUSTER);
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await checkHealth();
      await Promise.allSettled([loadDanger(), loadIncidents(), loadRoute(), loadCluster()]);
      setIsLoading(false);
    };
    init();
  }, []);

  // ── Re-fetch danger when intersection/weather changes ─────────
  useEffect(() => { if (!isLoading) loadDanger(); }, [selectedIntersection, selectedWeather]);

  // ── Re-fetch incidents when filter changes ────────────────────
  useEffect(() => { if (!isLoading) loadIncidents(); }, [verifiedOnly]);

  // ── Auto-refresh every 30s ────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      loadDanger();
      loadIncidents();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadDanger, loadIncidents]);

  // ── Derived legacy shape for compatibility ────────────────────
  const data = {
    safety_score:        danger?.score ?? 72,
    isolation_score:     danger?.meta?.isolation_score ?? 0.15,
    primary_risk_factors: (danger?.warnings ?? []).slice(0, 3).map(w => w.slice(0, 30)),
    variance: [
      { time: '00:00', value: 45 }, { time: '04:00', value: 30 },
      { time: '08:00', value: 65 }, { time: '12:00', value: 85 },
      { time: '16:00', value: 75 }, { time: '20:00', value: 55 }, { time: '23:59', value: 40 },
    ],
    peak_hours: [
      { hour: '18:00', level: 80 }, { hour: '19:00', level: 95 },
      { hour: '20:00', level: 85 }, { hour: '21:00', level: 70 }, { hour: '22:00', level: 60 },
    ],
    nodes: [
      { id: 1, x: 80,  y: 80,  type: 'CCTV',    risk: 'low' },
      { id: 2, x: 200, y: 60,  type: 'Light',   risk: 'medium' },
      { id: 3, x: 300, y: 130, type: 'Sensor',  risk: 'low' },
      { id: 4, x: 150, y: 200, type: 'Patrol',  risk: 'high' },
      { id: 5, x: 280, y: 220, type: 'EmgBtn',  risk: 'medium' },
    ],
    edges: [
      { source: 1, target: 2 }, { source: 2, target: 3 },
      { source: 3, target: 5 }, { source: 4, target: 1 }, { source: 5, target: 4 },
    ]
  };

  return {
    data, danger, incidents, safeRoute, cluster,
    backendOnline, isLoading,
    selectedIntersection, setSelectedIntersection,
    selectedWeather, setSelectedWeather,
    verifiedOnly, setVerifiedOnly,
    refresh: () => { loadDanger(); loadIncidents(); loadRoute(); loadCluster(); }
  };
};
