import React, { useState, useCallback } from 'react';
import Dashboard from './components/Dashboard';
import LoadingScreen from './components/LoadingScreen';
import { ThemeProvider } from './context/ThemeContext';
import ThemeTransition from './components/ThemeTransition';
import CustomCursor from './components/CustomCursor';
import { useSubmarineAudio } from './hooks/useSubmarineAudio';

function SubmarineSystems() {
  useSubmarineAudio();
  return <CustomCursor />;
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const handleComplete = useCallback(() => setIsLoading(false), []);

  return (
    <ThemeProvider>
      <SubmarineSystems />
      <ThemeTransition />
      {isLoading && <LoadingScreen onComplete={handleComplete} />}
      {!isLoading && <Dashboard />}
    </ThemeProvider>
  );
}

export default App;
