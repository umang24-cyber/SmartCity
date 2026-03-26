import { useState, useEffect } from 'react';

export const useTigerGraph = () => {
  const [data, setData] = useState({
    isolation_score: 0.65,
    primary_risk_factors: ['Poor Lighting', 'Low Footfall', 'High Density'],
    safety_score: 72,
    variance: [
      { time: '00:00', value: 45 },
      { time: '04:00', value: 30 },
      { time: '08:00', value: 65 },
      { time: '12:00', value: 85 },
      { time: '16:00', value: 75 },
      { time: '20:00', value: 55 },
      { time: '23:59', value: 40 },
    ],
    peak_hours: [
      { hour: '18:00', level: 80 },
      { hour: '19:00', level: 95 },
      { hour: '20:00', level: 85 },
      { hour: '21:00', level: 70 },
      { hour: '22:00', level: 60 },
    ],
    nodes: [
      { id: 1, x: 100, y: 100, type: 'CCTV' },
      { id: 2, x: 200, y: 150, type: 'Light' },
      { id: 3, x: 150, y: 250, type: 'Sensor' },
      { id: 4, x: 300, y: 200, type: 'Patrol' },
    ],
    edges: [
      { source: 1, target: 2 },
      { source: 2, target: 3 },
      { source: 3, target: 4 },
      { source: 4, target: 1 },
    ]
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return { data, isLoading };
};
