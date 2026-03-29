import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import Explorer from './Explorer';
import { SafetyVariance, PeakDangerHours } from './Analytics';
import ReportForm from './ReportForm';
import ExplainablePanel from './ExplainablePanel';
import { useTigerGraph } from '../hooks/useTigerGraph';

export default function Dashboard() {
  const { data, isLoading, refresh } = useTigerGraph();
  const [activeTab, setActiveTab] = React.useState('Map');

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg-primary">
        <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin shadow-lg shadow-accent-glow" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'Map':
        return (
          <>
            {/* Main Visualization - Explorer */}
            <div className="col-span-12 lg:col-span-8 row-span-4 min-h-[420px]">
              <Explorer route={data.route} incidents={data.incidents} />
            </div>

            {/* Side Info - Risk Matrix */}
            <div className="col-span-12 lg:col-span-4 row-span-2 glass flex flex-col gap-4 rounded-2xl p-5 border border-white/5 overflow-y-auto">
                  <h3 className="font-bold text-sm text-text-secondary uppercase tracking-widest">Risk Matrix</h3>
                  
                  {data.reasoning && (
                    <ExplainablePanel reasoning={data.reasoning} themeAction={data.themeAction} />
                  )}

                  <div className="flex flex-col gap-3 flex-1 justify-center mt-2">
                      {(data.primary_risk_factors || []).slice(0, 2).map(factor => (
                          <div key={factor} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 hover:border-accent/40 transition-colors cursor-default">
                             <span className="text-xs font-medium">{factor}</span>
                             <span className="text-[10px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded">HIGH</span>
                          </div>
                      ))}
                      <div className="mt-1">
                          <div className="flex justify-between text-[10px] font-bold uppercase text-text-secondary mb-1">
                              <span>Isolation Score</span>
                              <span className="text-accent">{Math.round(data.isolation_score * 100)}%</span>
                          </div>
                          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-accent transition-all duration-1000" style={{ width: `${data.isolation_score * 100}%` }} />
                          </div>
                      </div>
                  </div>
            </div>

            {/* Form - Reporting */}
            <div className="col-span-12 lg:col-span-4 row-span-2">
              <ReportForm refreshData={refresh} />
            </div>

            {/* Graphs - Analytics */}
            <div className="col-span-12 lg:col-span-6 row-span-2 min-h-[200px]">
              <SafetyVariance data={data.variance} />
            </div>
            <div className="col-span-12 lg:col-span-6 row-span-2 min-h-[200px]">
              <PeakDangerHours data={data.peak_hours} />
            </div>
          </>
        );
      case 'Alerts':
        return (
          <div className="col-span-12 glass rounded-2xl p-8 border border-white/5 h-full">
            <h2 className="text-2xl font-bold mb-4">Security Alerts Feed</h2>
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold">Unverified Incident - Sector {i}</h4>
                    <p className="text-sm text-text-secondary">Reported 5 mins ago • Priority High</p>
                  </div>
                  <button className="bg-accent/20 text-accent px-4 py-2 rounded-lg font-bold hover:bg-accent/30 transition-colors">Acknowledge</button>
                </div>
              ))}
            </div>
          </div>
        );
      case 'Stats':
        return (
          <div className="col-span-12 grid grid-cols-12 gap-6 h-full">
             <div className="col-span-12 lg:col-span-6 glass rounded-2xl p-6 border border-white/5">
                <SafetyVariance data={data.variance} />
             </div>
             <div className="col-span-12 lg:col-span-6 glass rounded-2xl p-6 border border-white/5">
                <PeakDangerHours data={data.peak_hours} />
             </div>
          </div>
        );
      case 'Power':
        return (
          <div className="col-span-12 glass rounded-2xl p-8 border border-white/5 h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <div className="w-12 h-12 bg-accent rounded-full" />
              </div>
              <h2 className="text-3xl font-black mb-2 uppercase tracking-tighter italic">Grid Status: Stable</h2>
              <p className="text-text-secondary max-w-md">All municipal power grids are operating within normal parameters. No outages detected in Sector 7.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary font-sans overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header safetyScore={data.safety_score} />
        
        <main className="flex-1 px-6 pb-6 pt-0 grid grid-cols-12 auto-rows-min gap-6 overflow-y-auto overflow-x-hidden glass-scroll scroll-smooth">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
