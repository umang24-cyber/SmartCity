import React, { useState, useEffect } from 'react';

const LoadingScreen = () => {
  const [statusIndex, setStatusIndex] = useState(0);
  const statuses = [
    "INITIALIZING POWER GRID...",
    "CONNECTING TO SMART NODE 04...",
    "SYNCING UTILITY DATA...",
    "ESTABLISHING SECURE PROTOCOLS...",
    "LOADING CITY SCHEMATICS...",
    "SYSTEM READY."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev < statuses.length - 1 ? prev + 1 : prev));
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-screen">
      <div className="power-grid" />
      
      {/* Random flash points */}
      <div className="grid-flicker" style={{ '--x': '20%', '--y': '30%', animationDelay: '0.2s' }} />
      <div className="grid-flicker" style={{ '--x': '80%', '--y': '40%', animationDelay: '0.5s' }} />
      <div className="grid-flicker" style={{ '--x': '40%', '--y': '70%', animationDelay: '1.2s' }} />
      <div className="grid-flicker" style={{ '--x': '60%', '--y': '20%', animationDelay: '2s' }} />
      
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="glitch-text">SMARTCITY</h1>
        
        <div className="status-line">
          {statuses[statusIndex]}
        </div>
        
        <div className="progress-container">
          <div className="progress-bar" />
        </div>
      </div>
      
      {/* Cinematic CRT noise (can reuse existing styles if needed, but keeping it simple for now) */}
      <div className="crt-overlay opacity-30" />
    </div>
  );
};

export default LoadingScreen;
