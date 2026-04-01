import { useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';

export function useSubmarineAudio() {
  const audioCtxRef = useRef(null);
  const { mode } = useTheme();

  // Initialize synth on first user interaction to bypass browser autoplay policies
  useEffect(() => {
    const initAudio = () => {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioContext();
        const ctx = audioCtxRef.current;

        // Startup Sound / System Boot
        const startupOsc = ctx.createOscillator();
        const startupGain = ctx.createGain();
        startupOsc.connect(startupGain);
        startupGain.connect(ctx.destination);
        
        startupOsc.type = 'sine';
        startupOsc.frequency.setValueAtTime(150, ctx.currentTime);
        startupOsc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 1.5);
        startupGain.gain.setValueAtTime(0, ctx.currentTime);
        startupGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
        startupGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
        startupOsc.start();
        startupOsc.stop(ctx.currentTime + 2.0);

        // Continuous Background Ambience (Deep underwater hum)
        const ambienceOsc = ctx.createOscillator();
        const ambienceGain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        // LFO modulates the frequency of the main hum for a "breathing" underwater effect
        lfo.type = 'sine';
        lfo.frequency.value = 0.1; // Very slow
        lfoGain.gain.value = 8;
        lfo.connect(lfoGain);
        lfoGain.connect(ambienceOsc.frequency);

        ambienceOsc.type = 'sine';
        ambienceOsc.frequency.value = 60; // Low frequency bass
        
        ambienceGain.gain.value = 0.02; // Very subtle volume
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 150; // Muffle frequencies

        ambienceOsc.connect(ambienceGain);
        ambienceGain.connect(filter);
        filter.connect(ctx.destination);
        
        lfo.start();
        ambienceOsc.start();

        // Load background "Signal to Noise" track
        fetch('/sb_signaltonoise.mp3')
          .then(res => res.arrayBuffer())
          .then(data => ctx.decodeAudioData(data))
          .then(buffer => {
            const trackSource = ctx.createBufferSource();
            trackSource.buffer = buffer;
            trackSource.loop = true; // Infinite loop

            const trackGain = ctx.createGain();
            
            // Crossfade in to fit behind the synthetic startup sound
            trackGain.gain.setValueAtTime(0, ctx.currentTime);
            // Gradually transition from 0 to 0.05 over 4 seconds
            trackGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 4.0);

            trackSource.connect(trackGain);
            trackGain.connect(ctx.destination);
            
            trackSource.start(0);
          })
          .catch(err => console.warn("Background audio fail:", err));
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    };
    
    document.addEventListener('mousedown', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });

    return () => {
      document.removeEventListener('mousedown', initAudio);
      document.removeEventListener('keydown', initAudio);
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  const playSynthesizedSound = useCallback((type) => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== 'running') return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Filter to make it sound "underwater"
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    gainNode.disconnect();
    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Pitch modifier based on theme/mode just for subtle variation
    const pitchMod = mode === 'light' ? 1.2 : 1.0;

    if (type === 'hover') {
      // Very short high-frequency tick
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200 * pitchMod, t);
      osc.frequency.exponentialRampToValueAtTime(800 * pitchMod, t + 0.02);
      gainNode.gain.setValueAtTime(0.05, t); // Low volume
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.start(t);
      osc.stop(t + 0.05);

    } else if (type === 'click') {
      // Short dual-ping 
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600 * pitchMod, t);
      osc.frequency.exponentialRampToValueAtTime(1200 * pitchMod, t + 0.05);
      gainNode.gain.setValueAtTime(0.2, t);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t);
      osc.stop(t + 0.1);

    } else if (type === 'drag') {
      // Low bubble rumble
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80 * pitchMod, t);
      // add some subtle frequency wobble
      osc.frequency.linearRampToValueAtTime(85 * pitchMod, t + 0.1);
      
      gainNode.gain.setValueAtTime(0.02, t);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      
      filter.frequency.value = 300; // Muffled underwater sound

      osc.start(t);
      osc.stop(t + 0.2);

    } else if (type === 'scroll') {
      // Quick mechanical ratchet sound
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200 * pitchMod, t);
      gainNode.gain.setValueAtTime(0.03, t);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      filter.frequency.value = 1000;
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }, [mode]);

  // Attach global event listeners
  useEffect(() => {
    // We attach global listeners to track interactions.
    // Instead of overriding everything, we attach to window/document.
    
    const handleMouseOver = (e) => {
      // If hovering over buttons, links, inputs, or anything clickable
      const target = e.target;
      const isClickable = 
        target.tagName === 'BUTTON' || 
        target.tagName === 'A' || 
        target.tagName === 'INPUT' || 
        target.closest('button') || 
        target.closest('a') ||
        getComputedStyle(target).cursor === 'pointer' ||
        target.classList.contains('sidebar-btn');
        
      if (isClickable) {
        playSynthesizedSound('hover');
      }
    };

    const handleMouseDown = (e) => {
      // If it's the maplibre canvas, it's a drag start
      if (e.target.tagName === 'CANVAS' && e.target.classList.contains('maplibregl-canvas')) {
        playSynthesizedSound('drag');
      } else {
        playSynthesizedSound('click');
      }
    };

    let scrollTimeout;
    const handleWheel = () => {
      if (!scrollTimeout) {
        playSynthesizedSound('scroll');
        scrollTimeout = setTimeout(() => {
          scrollTimeout = null;
        }, 150); // Ratchet every 150ms while scrolling
      }
    };

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [playSynthesizedSound]);

}
