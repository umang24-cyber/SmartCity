import { useState, useEffect, useCallback } from 'react';

export const useTigerGraph = () => {
  const [data, setData] = useState({
    isolation_score: 0.65,
    primary_risk_factors: ['Loading...'],
    safety_score: 0,
    variance: [],
    peak_hours: [],
    route: null,
    incidents: [],
    reasons: '',
    dashboardRaw: null
  });

  const [isLoading, setIsLoading] = useState(true);

  const fetchLiveFeed = useCallback(async () => {
    try {
      // For local testing without TigerGraph Cloud, backend defaults to DATA_SOURCE=mock.
      // But we integrate fully with the API path.
      
      const headers = { 'x-data-source': 'mock' }; // Override for immediate testing

      const [scoreRes, clusterRes, routeRes, incidentsRes] = await Promise.all([
        fetch('http://localhost:5000/danger-score?intersection_id=INT_001', { headers }),
        fetch('http://localhost:5000/cluster-info', { headers }),
        fetch('http://localhost:5000/safe-route', { headers }),
        fetch('http://localhost:5000/incidents', { headers })
      ]);

      const scoreData = await scoreRes.json();
      const clusterData = await clusterRes.json();
      const routeData = await routeRes.json();
      const incidentsData = await incidentsRes.json();

      setData({
        isolation_score: clusterData.avg_cluster_safety / 100 || 0.65,
        primary_risk_factors: clusterData.primary_risk_factors || ['Loading...'],
        safety_score: scoreData.score || 0,
        variance: scoreData.variance || [], // Optional backend property
        peak_hours: scoreData.peak_hours || [], // Optional backend property
        route: routeData.coordinates || [],
        incidents: incidentsData || [],
        reasoning: scoreData.reasoning || '',
        themeAction: scoreData.themeAction || 'pulse-yellow' // 'pulse-green', 'pulse-yellow', 'pulse-red'
      });
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to sync with TigerGraph API:', err);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveFeed();
    const interval = setInterval(fetchLiveFeed, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, [fetchLiveFeed]);

  return { data, isLoading, refresh: fetchLiveFeed };
};
