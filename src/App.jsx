import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Dashboard from './components/Dashboard';
import ThemeTransition from './components/ThemeTransition';
import LoadingScreen from './components/LoadingScreen';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider>
      <div className="relative min-h-screen overflow-hidden">
        {isLoading && <LoadingScreen />}
        <div className="crt-overlay" />
        <div className="scanline" />
        <ThemeTransition />
        <div className="crt-bloom relative z-10 h-full">
          <Dashboard />
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
