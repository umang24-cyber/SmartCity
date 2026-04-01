import { useState, useEffect, useCallback } from 'react';
import {
  fetchDangerScore, fetchIncidents, fetchSafeRoute, fetchClusterInfo, fetchHealth,
  fetchIntersections,
  MOCK_DANGER, MOCK_INCIDENTS, MOCK_ROUTE, MOCK_CLUSTER
} from '../api/smartcity';

export const useTigerGraph = () => {
  const [danger, setDanger]             = useState(null);
  const [incidents, setIncidents]       = useState([]);
  const [safeRoute, setSafeRoute]       = useState(null);
  const [routeStart, setRouteStart]     = useState(null);
  const [routeEnd, setRouteEnd]         = useState(null);
  const [cluster, setCluster]           = useState(null);
  const [intersections, setIntersections] = useState([]);
  const [backendOnline, setBackendOnline] = useState(null); // null=checking, true, false
  const [isLoading, setIsLoading]       = useState(true);
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
      if (routeStart && routeEnd) {
        const d = await fetchSafeRoute(routeStart.lat, routeStart.lng, routeEnd.lat, routeEnd.lng);
        setSafeRoute(d);
      } else {
        const d = await fetchSafeRoute();
        setSafeRoute(d);
      }
    } catch {
      setSafeRoute(MOCK_ROUTE);
    }
  }, [routeStart, routeEnd]);

  // ── Load cluster info ─────────────────────────────────────────
  const loadCluster = useCallback(async () => {
    try {
      const d = await fetchClusterInfo(1);
      setCluster(d);
    } catch {
      setCluster(MOCK_CLUSTER);
    }
  }, []);

  // ── Load all intersections (for map dots layer) ───────────────
  const loadIntersections = useCallback(async () => {
    try {
      const d = await fetchIntersections();
      setIntersections(d);
    } catch {
      // Fallback inline mock (mirrors API shape)
      setIntersections([
        { intersection_id: 'INT_001', intersection_name: 'MG Road & Brigade Rd', lat: 12.9716, lng: 77.5946, baseline_safety_score: 72, cluster_id: 1, isolation_score: 0.15 },
        { intersection_id: 'INT_002', intersection_name: 'Residency Road & Richmond Rd', lat: 12.9698, lng: 77.5981, baseline_safety_score: 58, cluster_id: 1, isolation_score: 0.55 },
        { intersection_id: 'INT_003', intersection_name: 'Cubbon Park North Gate', lat: 12.9763, lng: 77.5929, baseline_safety_score: 45, cluster_id: 2, isolation_score: 0.78 },
        { intersection_id: 'INT_004', intersection_name: 'Lavelle Rd & Museum Rd', lat: 12.9725, lng: 77.5958, baseline_safety_score: 66, cluster_id: 1, isolation_score: 0.30 },
        { intersection_id: 'INT_005', intersection_name: 'St Marks Rd & Cunningham Rd', lat: 12.9738, lng: 77.5965, baseline_safety_score: 78, cluster_id: 1, isolation_score: 0.10 },
      ]);
    }
  }, []);

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      
      // Start all in parallel - no more blocking on checkHealth
      const allTasks = [
        checkHealth(),
        loadDanger(),
        loadIncidents(),
        loadRoute(),
        loadCluster(),
        loadIntersections()
      ];

      // Add a 3s max timeout for initial loading UI
      // Even if some requests are pending, we want the UI reachable
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
      
      await Promise.race([
        Promise.allSettled(allTasks),
        timeoutPromise
      ]);

      setIsLoading(false);
    };
    init();
  }, [checkHealth, loadDanger, loadIncidents, loadRoute, loadCluster, loadIntersections]);

  // ── Re-fetch danger when intersection/weather changes ─────────
  useEffect(() => { if (!isLoading) loadDanger(); }, [selectedIntersection, selectedWeather]);

  // ── Re-fetch incidents when filter changes ────────────────────
  useEffect(() => { if (!isLoading) loadIncidents(); }, [verifiedOnly]);

  // ── Re-fetch route when start/end changes ─────────────────────
  useEffect(() => { if (!isLoading) loadRoute(); }, [routeStart, routeEnd]);

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
    comfort_score:       danger?.comfort_score ?? 72,
    comfort_label:       danger?.comfort_label ?? 'SAFE CORRIDOR',
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
    data, danger, incidents, safeRoute, cluster, intersections,
    backendOnline, isLoading,
    selectedIntersection, setSelectedIntersection,
    selectedWeather, setSelectedWeather,
    verifiedOnly, setVerifiedOnly,
    routeStart, setRouteStart,
    routeEnd, setRouteEnd,
    refresh: () => { loadDanger(); loadIncidents(); loadRoute(); loadCluster(); loadIntersections(); }
  };
};
