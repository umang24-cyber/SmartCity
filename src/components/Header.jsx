import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { ChevronDown } from 'lucide-react';

export default function Header({ safetyScore }) {
  const { currentTheme, changeTheme, themes } = useTheme();

  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);

  return (
    <header className="flex justify-between items-center p-6 glass rounded-2xl mb-6 mx-6 mt-6 border border-white/5 relative z-50">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-text-primary to-accent bg-clip-text text-transparent">
          Smart City Dash
        </h1>
        <div className="h-6 w-[1px] bg-white/10 mx-2" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-widest text-text-secondary font-bold">Current Sector</span>
          <span className="text-sm font-medium">Downtown Core - Sector 7</span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Theme Selector */}
        <div className="relative">
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/10 hover:border-accent transition-colors"
          >
            <div className="w-3 h-3 rounded-full bg-accent" />
            <span className="text-sm font-medium">{themes.find(t => t.id === currentTheme).name}</span>
            <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsDropdownOpen(false)} 
              />
              <div className="absolute top-full right-0 mt-2 w-48 glass rounded-xl border border-white/10 transition-all duration-300 z-50 p-2 shadow-2xl">
                {themes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      changeTheme(theme.id);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent hover:text-white transition-colors text-sm flex items-center gap-3"
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.color }} />
                    {theme.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Safety Gauge */}
        <div className="flex items-center gap-4 px-6 py-2 glass rounded-xl border border-white/10">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-text-secondary font-bold">Safety Score</span>
            <span className="text-xl font-black text-accent">{safetyScore}%</span>
          </div>
          <div className="w-12 h-12 relative flex items-center justify-center">
             <svg className="w-full h-full -rotate-90">
               <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-white/10" />
               <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-accent transition-all duration-1000" strokeDasharray={126} strokeDashoffset={126 - (126 * safetyScore) / 100} strokeLinecap="round" />
             </svg>
          </div>
        </div>
      </div>
    </header>
  );
}
