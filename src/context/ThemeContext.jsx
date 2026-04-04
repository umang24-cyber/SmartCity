import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const themes = [
  { id: 'submarine', name: 'Submarine Green', color: '#00ff88' },
  { id: 'sakura', name: 'Sakura Blossoms', color: '#ec4899' },
  { id: 'midnight-neon', name: 'Midnight Neon', color: '#3b82f6' },
  { id: 'solar-flare', name: 'Solar Flare', color: '#f59e0b' },
  { id: 'cyber-orchid', name: 'Cyber Orchid', color: '#a855f7' },
];

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('submarine');
  const [mode, setMode] = useState('dark');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const changeTheme = (newTheme) => {
    if (newTheme === currentTheme || isTransitioning) return;
    
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentTheme(newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }, 450);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 900);
  };

  const toggleMode = () => {
    if (isTransitioning) return;

    const newMode = mode === 'dark' ? 'light' : 'dark';
    
    setIsTransitioning(true);
    setTimeout(() => {
      setMode(newMode);
      document.documentElement.setAttribute('data-mode', newMode);
    }, 450);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 900);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.documentElement.setAttribute('data-mode', mode);
  }, []);

  return (
    <ThemeContext.Provider value={{ 
      currentTheme, 
      changeTheme, 
      themes, 
      isTransitioning,
      mode,
      toggleMode
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
