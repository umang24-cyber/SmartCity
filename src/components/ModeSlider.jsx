import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ModeSlider() {
  const { mode, toggleMode, isTransitioning } = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [trackWidth, setTrackWidth] = useState(168);
  const trackRef = useRef(null);

  // Constants for slider (width and track)
  const TRACK_HEIGHT = 24;
  const THUMB_SIZE = 20;

  const handleModeChange = useCallback((targetMode) => {
    if (mode !== targetMode && !isTransitioning) {
      toggleMode();
    }
  }, [mode, isTransitioning, toggleMode]);

  const onMouseDown = () => {
    if (isTransitioning) return;
    setIsDragging(true);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updateWidth = () => setTrackWidth(track.offsetWidth || 168);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(track);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isDragging || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      
      // Discrete zones: left half is dark, right half is light
      if (percentage < 0.3) {
        handleModeChange('dark');
      } else if (percentage > 0.7) {
        handleModeChange('light');
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleModeChange]);

  const thumbOffset = mode === 'dark' ? 2 : trackWidth - THUMB_SIZE - 6;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
      {/* Labels - positioned above slider so they aren't hidden under the thumb */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0.2rem' }}>
        <span style={{ 
          fontSize: '0.55rem', fontWeight: 800, 
          color: mode === 'dark' ? 'var(--accent)' : 'var(--text-secondary)',
          letterSpacing: '0.1em', transition: 'color 0.3s'
        }}>DARK_OPS</span>
        <span style={{ 
          fontSize: '0.55rem', fontWeight: 800, 
          color: mode === 'light' ? 'var(--accent)' : 'var(--text-secondary)',
          letterSpacing: '0.1em', transition: 'color 0.3s'
        }}>HIGH_VIS</span>
      </div>

      <div 
        ref={trackRef}
        onMouseDown={onMouseDown}
        style={{ 
          height: TRACK_HEIGHT, 
          background: 'rgba(0,0,0,0.4)', 
          borderRadius: 4, 
          padding: 2, 
          cursor: isDragging ? 'grabbing' : 'grab', 
          position: 'relative',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)'
        }}
      >
        {/* Track Line */}
        <div style={{ 
          position: 'absolute', left: '10%', right: '10%', height: 1, 
          background: 'var(--border)', opacity: 0.5 
        }} />

        {/* Thumb */}
        <div style={{ 
          width: THUMB_SIZE, height: THUMB_SIZE, 
          background: 'var(--accent)', 
          borderRadius: 2, 
          boxShadow: `0 0 12px var(--accent-glow), inset 0 0 4px rgba(255,255,255,0.4)`,
          transform: `translateX(${thumbOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ width: 2, height: 10, background: 'rgba(0,0,0,0.3)', borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}
