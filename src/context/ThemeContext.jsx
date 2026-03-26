import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const themes = [
  { id: 'midnight-neon', name: 'Midnight Neon', color: '#3b82f6' },
  { id: 'emerald-city', name: 'Emerald City', color: '#10b981' },
  { id: 'solar-flare', name: 'Solar Flare', color: '#f59e0b' },
  { id: 'cyber-orchid', name: 'Cyber Orchid', color: '#a855f7' },
  { id: 'steel-horizon', name: 'Steel Horizon', color: '#475569' },
];

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState('midnight-neon');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const changeTheme = (newTheme) => {
    if (newTheme === currentTheme || isTransitioning) return;
    
    setIsTransitioning(true);
    // Wait for curtains to close (400ms is roughly halfway through the 800ms animation)
    setTimeout(() => {
      setCurrentTheme(newTheme);
      document.documentElement.setAttribute('data-theme', newTheme);
    }, 450);

    // Reopen curtains after full animation cycle
    setTimeout(() => {
      setIsTransitioning(false);
    }, 900);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ currentTheme, changeTheme, themes, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
