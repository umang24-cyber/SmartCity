import React, { useEffect, useState, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function CustomCursor() {
  const [cursorState, setCursorState] = useState('default'); 
  // states: default, hover, drag, scroll
  const cursorRef = useRef(null);
  const ringRef = useRef(null);

  // Position tracking using requestAnimationFrame for smoothness
  const pos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const onMouseMove = (e) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      // Update DOM directly to bypass React state overhead
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
      // Check hover state continuously
      const target = e.target;
      if (target) {
        const isClickable = 
          target.tagName === 'BUTTON' || 
          target.tagName === 'A' || 
          target.closest('.sidebar-btn') || 
          getComputedStyle(target).cursor === 'pointer';
        
        if (cursorState === 'default' && isClickable) setCursorState('hover');
        if (cursorState === 'hover' && !isClickable) setCursorState('default');
      }
    };

    const onMouseDown = (e) => {
      if (e.target.tagName === 'CANVAS' && e.target.classList.contains('maplibregl-canvas')) {
        setCursorState('drag');
      } else {
        // Just a normal click flash, we can briefly set drag or keep hover
        // but 'drag' gives a nice tactile visual feedback for clicking too.
        setCursorState('drag');
        setTimeout(() => setCursorState(prev => prev === 'drag' ? 'default' : prev), 150);
      }
    };

    const onMouseUp = () => {
      setCursorState('default');
    };

    let scrollTimeout;
    const onWheel = () => {
      setCursorState('scroll');
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setCursorState('default');
      }, 300);
    };
    // Init position
    if (cursorRef.current) cursorRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
    if (ringRef.current) ringRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('wheel', onWheel);
    };
  }, [cursorState]);

  // Determine styles based on state
  const getRingStyles = () => {
    switch (cursorState) {
      case 'hover':
        return {
          width: 48, height: 48,
          border: '1px dashed var(--accent)',
          borderRadius: '50%',
          animation: 'radar-spin 4s linear infinite',
          boxShadow: '0 0 10px var(--accent-glow)'
        };
      case 'drag':
        return {
          width: 24, height: 24,
          border: '2px solid var(--accent)',
          borderRadius: '4px', // Square up
          transform: 'rotate(45deg)', // Diamond
          boxShadow: '0 0 15px var(--accent)'
        };
      case 'scroll':
        return {
          width: 16, height: 48,
          borderLeft: '2px solid var(--accent)',
          borderRight: '2px solid var(--accent)',
          borderRadius: 8,
          opacity: 0.8
        };
      default:
        // Radar ring default
        return {
          width: 36, height: 36,
          border: '1px solid var(--border)',
          borderRadius: '50%',
          animation: 'radar-spin 8s linear infinite',
        };
    }
  };

  const getDotStyles = () => {
    switch(cursorState) {
      case 'hover':
        return {
          width: 8, height: 8,
          background: 'var(--bg-primary)',
          border: '2px solid var(--accent)',
          borderRadius: '50%',
        };
      case 'drag':
        return {
          width: 12, height: 12,
          background: 'var(--accent)',
          borderRadius: '2px',
        }
      case 'scroll':
        return {
          width: 4, height: 16,
          background: 'var(--accent)',
          borderRadius: 2,
          animation: 'scroll-pulse 0.5s infinite alternate'
        }
      default:
        return {
          width: 4, height: 4,
          background: 'var(--accent)',
          borderRadius: '50%',
          boxShadow: '0 0 8px var(--accent)'
        };
    }
  };

  return (
    <div style={{ pointerEvents: 'none', zIndex: 999999, position: 'fixed', inset: 0, overflow: 'hidden' }}>
      
      {/* Outer Translating Ring */}
      <div 
        ref={ringRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          pointerEvents: 'none',
          willChange: 'transform'
        }}
      >
        {/* Inner Styling Ring */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: '-50%',
          marginTop: '-50%',
          transition: 'width 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-radius 0.2s, transform 0.2s',
          ...getRingStyles(),
          transformOrigin: 'center center' // fix transform origin
        }}>
          {cursorState === 'default' && (
            <div style={{ position: 'absolute', inset: -4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', width: 2, height: '100%', background: 'var(--border)' }} />
              <div style={{ position: 'absolute', width: '100%', height: 2, background: 'var(--border)' }} />
            </div>
          )}
        </div>
      </div>

      {/* Outer Translating Dot */}
      <div
        ref={cursorRef}
        style={{
          position: 'absolute', top: 0, left: 0,
          pointerEvents: 'none',
          willChange: 'transform'
        }}
      >
        {/* Inner Styling Dot */}
        <div style={{
          display: 'flex',
          marginLeft: '-50%',
          marginTop: '-50%',
          transition: 'width 0.2s, height 0.2s, background 0.2s, border-radius 0.2s',
          ...getDotStyles()
        }} />
      </div>

    </div>
  );
}
