import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Dashboard from './components/Dashboard';
import ThemeTransition from './components/ThemeTransition';

function App() {
  return (
    <ThemeProvider>
      <div className="relative min-h-screen overflow-hidden">
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
