import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, Cpu, ShieldAlert, Sparkles, Activity, 
  HelpCircle, RefreshCw, Layers, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { analyzeReport } from '../api/smartcity';

// Helper for emergency level colors
const emColor = (lvl) => {
  const l = (lvl || 'NORMAL').toUpperCase();
  if (l === 'CRITICAL') return '#ff3344';
  if (l === 'HIGH')     return '#ff6600';
  if (l === 'MEDIUM')   return '#ffaa00';
  if (l === 'LOW')      return '#00cc66';
  return '#00ff88';
};

// Word attention classifier
const getWordClass = (word, keywords = []) => {
  const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!keywords.includes(cleanWord)) return '';

  const CRITICAL = ['help', 'emergency', 'attack', 'assault', 'rape', 'kidnap', 'danger', 'sos', 'save', 'chasing', 'police', 'kill', 'weapon', 'stab'];
  const HIGH = ['scared', 'fear', 'threatened', 'following', 'stalked', 'stalking', 'harassed', 'harassment', 'unsafe', 'threat', 'intimidate', 'chase', 'afraid', 'terrified'];
  const MEDIUM = ['uncomfortable', 'suspicious', 'creepy', 'weird', 'loitering', 'inappropriate', 'staring', 'catcalling', 'watched'];
  const LOW = ['dark', 'empty', 'deserted', 'broken', 'streetlight', 'fix', 'repair', 'light', 'camera', 'cctv', 'infrastructure'];

  if (CRITICAL.some(kw => cleanWord.includes(kw))) return 'token-critical';
  if (HIGH.some(kw => cleanWord.includes(kw))) return 'token-high';
  if (MEDIUM.some(kw => cleanWord.includes(kw))) return 'token-medium';
  if (LOW.some(kw => cleanWord.includes(kw))) return 'token-low';
  return 'token-default';
};

export default function ExplainablePanel({ selectedReport, dangerTelemetry, selectedIntersectionName, token }) {
  const [activeTab, setActiveTab] = useState('nlp'); // 'nlp' or 'danger'
  const [simulationText, setSimulationText] = useState('');
  const [simulatedResult, setSimulatedResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState(null);

  // Automatically update simulation text when report changes
  useEffect(() => {
    if (selectedReport) {
      setSimulationText(selectedReport.text || '');
      setSimulatedResult(null);
    }
  }, [selectedReport]);

  // Handle NLP simulation API call
  const handleSimulate = async () => {
    if (!simulationText.trim()) return;
    setSimLoading(true);
    setSimError(null);
    try {
      const res = await analyzeReport(simulationText, token);
      setSimulatedResult(res);
    } catch (err) {
      setSimError(err.message || 'Simulation failed');
    } finally {
      setSimLoading(false);
    }
  };

  const handleResetSim = () => {
    setSimulatedResult(null);
    setSimulationText(selectedReport?.text || '');
  };

  const reportToDisplay = simulatedResult || selectedReport;

  // Format Recharts data for Emotion profiles
  const emotionData = (() => {
    if (!reportToDisplay?.emotion_all_scores) return [];
    return Object.entries(reportToDisplay.emotion_all_scores).map(([name, score]) => ({
      name: name.toUpperCase(),
      score: Number((score * 100).toFixed(1)),
    })).sort((a, b) => b.score - a.score);
  })();

  const activeColor = reportToDisplay ? emColor(reportToDisplay.emergency_level) : 'var(--amber)';

  return (
    <div className="telemetry-panel flex flex-col gap-4 text-xs font-mono w-full" style={{ minWidth: 320 }}>
      
      {/* Tabs */}
      <div className="flex border-b border-white/10 pb-2 gap-2">
        <button 
          onClick={() => setActiveTab('nlp')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
            activeTab === 'nlp' 
              ? 'border-purple-500/40 bg-purple-500/10 text-purple-400 font-bold' 
              : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          NLP INTELLIGENCE
        </button>
        <button 
          onClick={() => setActiveTab('danger')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
            activeTab === 'danger' 
              ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400 font-bold' 
              : 'border-transparent text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          SENSOR METRICS
        </button>
      </div>

      {/* Tab Content: NLP Analysis */}
      {activeTab === 'nlp' && (
        <div className="flex flex-col gap-4">
          {!reportToDisplay ? (
            <div className="p-6 text-center text-white/45 border border-dashed border-white/10 rounded-xl">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Select an incident report from the list to analyze its AI weights.
            </div>
          ) : (
            <>
              {/* Emergency Summary Badge */}
              <div className="glass rounded-xl p-3 border border-white/10 flex flex-col gap-2 relative overflow-hidden">
                <div className="absolute right-3 top-3 flex items-center gap-1 text-[10px] text-white/40">
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  {simulatedResult ? 'SIMULATION' : 'PRODUCTION INFERENCE'}
                </div>
                <div className="text-[10px] text-white/40 tracking-wider">THREAT LEVEL & SEVERITY</div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold tracking-widest px-2.5 py-1 rounded-md border" style={{ borderColor: `${activeColor}40`, color: activeColor, background: `${activeColor}10` }}>
                    {reportToDisplay.emergency_level}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-white/80 font-bold">Severity: {reportToDisplay.severity?.toFixed(2)}/5.0</span>
                    <span className="text-[9px] text-white/40">Distress: {reportToDisplay.distress_level}</span>
                  </div>
                </div>
              </div>

              {/* Word Attention / Token Highlights */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] text-white/40 tracking-wider">WORD ATTENTION HIGH-LIGHTER</div>
                <div className="p-3 bg-black/45 border border-white/5 rounded-xl leading-relaxed text-sm min-h-[60px] max-h-[140px] overflow-y-auto font-sans">
                  {reportToDisplay.text?.split(/\s+/).map((word, idx) => {
                    const c = getWordClass(word, reportToDisplay.matched_keywords);
                    return (
                      <span 
                        key={idx} 
                        className={`inline-block mr-1 rounded px-1 text-[13px] border border-transparent transition-all ${
                          c === 'token-critical' ? 'bg-red-500/20 text-red-400 border-red-500/40 font-bold' :
                          c === 'token-high' ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 font-bold' :
                          c === 'token-medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' :
                          c === 'token-low' ? 'bg-green-500/20 text-green-400 border-green-500/40' :
                          c === 'token-default' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                          'text-white/70'
                        }`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>
                {reportToDisplay.matched_keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 text-[9px]">
                    <span className="text-white/35">Legend:</span>
                    <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Critical</span>
                    <span className="px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">Distress</span>
                    <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Medium</span>
                    <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Infra</span>
                  </div>
                )}
              </div>

              {/* Emotion Profile Recharts Bar Chart */}
              {emotionData.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] text-white/40 tracking-wider">EMOTION ANALYSIS CONFIDENCE</div>
                  <div className="h-[120px] w-full bg-black/20 border border-white/5 rounded-xl p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={emotionData} layout="vertical" margin={{ top: 5, right: 15, left: -10, bottom: 5 }}>
                        <XAxis type="number" domain={[0, 100]} hide />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          stroke="rgba(255,255,255,0.4)" 
                          fontSize={8} 
                          tickLine={false} 
                          axisLine={false} 
                          width={60} 
                        />
                        <Tooltip 
                          formatter={(value) => [`${value}%`, 'Confidence']}
                          contentStyle={{ background: '#080c14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, fontFamily: 'monospace', fontSize: 10 }}
                        />
                        <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                          {emotionData.map((entry, idx) => {
                            let color = 'rgba(255,255,255,0.3)';
                            if (entry.name === 'FEAR') color = '#ff3344';
                            else if (entry.name === 'ANGER') color = '#ff6600';
                            else if (entry.name === 'SURPRISE') color = '#f59e0b';
                            else if (entry.name === 'NEUTRAL') color = '#94a3b8';
                            else if (entry.name === 'JOY') color = '#00ff88';
                            return <Cell key={`cell-${idx}`} fill={color} fillOpacity={0.75} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Credibility & Spam metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-xl p-3 border border-white/5 bg-black/15 flex flex-col gap-1.5">
                  <div className="text-[10px] text-white/40 tracking-wider">CREDIBILITY SCORE</div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold" style={{ 
                      color: reportToDisplay.credibility_score >= 70 ? 'var(--accent)' : reportToDisplay.credibility_score >= 40 ? 'var(--amber)' : 'var(--red-alert)' 
                    }}>
                      {reportToDisplay.credibility_score}%
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">
                      {reportToDisplay.credibility_label}
                    </span>
                  </div>
                  {reportToDisplay.credibility_flags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {reportToDisplay.credibility_flags.slice(0, 3).map(f => (
                        <span key={f} className="text-[8px] bg-red-500/10 text-red-400/80 px-1 rounded">⚑ {f}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="glass rounded-xl p-3 border border-white/5 bg-black/15 flex flex-col gap-1.5">
                  <div className="text-[10px] text-white/40 tracking-wider">DEDUPLICATION MATRIX</div>
                  <div className="flex flex-col justify-center h-full">
                    {reportToDisplay.is_duplicate ? (
                      <span className="text-red-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> DUPLICATE REPORT
                      </span>
                    ) : (
                      <span className="text-green-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> UNIQUE REPORT
                      </span>
                    )}
                    <span className="text-[9px] text-white/35 mt-1">Similarity score: {(reportToDisplay.duplicate_score * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* What-If Simulation Form */}
              <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
                <div className="text-[10px] text-purple-400 tracking-wider flex items-center gap-1 font-bold">
                  <HelpCircle className="w-3.5 h-3.5" /> WHAT-IF INCIDENT SIMULATOR
                </div>
                <textarea
                  value={simulationText}
                  onChange={(e) => setSimulationText(e.target.value)}
                  placeholder="Enter hypothetical report description to run simulated NLP classifications..."
                  className="w-full bg-black/60 border border-white/15 rounded-lg p-2 text-white font-sans text-xs focus:outline-none focus:border-purple-500/50 resize-y min-h-[50px] leading-relaxed"
                />
                <div className="flex gap-2 justify-end">
                  {simulatedResult && (
                    <button 
                      onClick={handleResetSim}
                      className="px-2.5 py-1.5 border border-white/15 text-white/70 hover:text-white rounded-md cursor-pointer hover:bg-white/5 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Reset
                    </button>
                  )}
                  <button 
                    onClick={handleSimulate}
                    disabled={simLoading || !simulationText.trim()}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-md cursor-pointer flex items-center gap-1.5 font-bold shadow-lg shadow-purple-900/20"
                  >
                    {simLoading ? 'Analyzing...' : 'Simulate NLP'}
                  </button>
                </div>
                {simError && <div className="text-red-400 text-[10px]">Error: {simError}</div>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab Content: Sensor Aggregation Telemetry */}
      {activeTab === 'danger' && (
        <div className="flex flex-col gap-4">
          {!dangerTelemetry ? (
            <div className="p-6 text-center text-white/45 border border-dashed border-white/10 rounded-xl">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Click on any intersection dot on the map to inspect sensor telemetry.
            </div>
          ) : (
            <>
              {/* Aggregated Safety Danger Level Gauge */}
              <div className="glass rounded-xl p-3 border border-white/10 flex flex-col gap-2">
                <div className="text-[10px] text-white/40 tracking-wider">AGGREGATED DANGER telemetry</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold tracking-wider" style={{ 
                      color: dangerTelemetry.danger_score > 0.7 ? '#ff3344' : dangerTelemetry.danger_score > 0.4 ? '#ffaa00' : '#00ff88' 
                    }}>
                      {(dangerTelemetry.danger_score * 100).toFixed(0)}%
                    </span>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-bold text-white/60">
                      {dangerTelemetry.danger_level || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/50 text-right">
                    📍 {selectedIntersectionName || dangerTelemetry.zone_id}
                  </div>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-1">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${dangerTelemetry.danger_score * 100}%`,
                      background: dangerTelemetry.danger_score > 0.7 ? '#ff3344' : dangerTelemetry.danger_score > 0.4 ? '#ffaa00' : '#00ff88'
                    }}
                  />
                </div>
                {dangerTelemetry.recommendation && (
                  <p className="text-[10px] text-white/50 leading-relaxed border-t border-white/5 pt-2 mt-1">
                    💡 <span className="italic">"{dangerTelemetry.recommendation}"</span>
                  </p>
                )}
              </div>

              {/* Weight Distribution breakdown */}
              <div className="flex flex-col gap-2">
                <div className="text-[10px] text-white/40 tracking-wider flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  MODEL REDISTRIBUTION MATRIX (SUM = 100%)
                </div>
                
                <div className="flex flex-col gap-2.5 bg-black/30 border border-white/5 rounded-xl p-3">
                  {dangerTelemetry.components && Object.entries(dangerTelemetry.components).map(([name, c]) => {
                    const status = c.status || 'skipped';
                    const weightPct = ((c.weight || 0) * 100).toFixed(0);
                    const scorePct = c.score != null ? (c.score * 100).toFixed(0) : null;
                    const isUsed = status === 'used';
                    
                    let modelName = name.toUpperCase();
                    if (name === 'lstm') modelName = 'LSTM DANGER FORECASTER';
                    if (name === 'cv') modelName = 'CCTV COMPUTER VISION';
                    if (name === 'anomaly') modelName = 'ANOMALY DETECTOR';
                    if (name === 'graph') modelName = 'TIGERGRAPH HISTORICAL';

                    return (
                      <div key={name} className="flex flex-col gap-1 relative">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className={`font-bold ${isUsed ? 'text-white/80' : 'text-white/30'}`}>{modelName}</span>
                          <span className={`text-[9px] ${isUsed ? 'text-cyan-400 font-bold' : 'text-white/20'}`}>
                            {isUsed ? `W: ${weightPct}% | Score: ${scorePct}%` : 'OFFLINE/SKIPPED'}
                          </span>
                        </div>
                        
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden flex">
                          {isUsed ? (
                            <>
                              <div 
                                className="h-full bg-cyan-500 opacity-80" 
                                style={{ width: `${c.score * 100}%` }}
                              />
                              <div 
                                className="h-full bg-white/10" 
                                style={{ width: `${100 - c.score * 100}%` }}
                              />
                            </>
                          ) : (
                            <div className="h-full w-full bg-white/5 border border-dashed border-white/5" />
                          )}
                        </div>

                        {/* Model-specific details */}
                        {isUsed && c.detail && (
                          <div className="pl-2.5 border-l border-cyan-500/20 text-[9px] text-white/45 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                            {name === 'lstm' && (
                              <>
                                <span>Next-hour: {c.detail.next_hour_score?.toFixed(1)}</span>
                                <span>Risk level: {c.detail.next_hour_severity}</span>
                                <span>Status: {c.detail.loader_status}</span>
                              </>
                            )}
                            {name === 'cv' && (
                              <>
                                <span>Density: {c.detail.crowd_density}</span>
                                <span>People: {c.detail.person_count}</span>
                                <span>Anomaly: {c.detail.anomaly_detected ? '🚨 DETECTED' : 'None'}</span>
                              </>
                            )}
                            {name === 'anomaly' && (
                              <>
                                <span>Z-Score: {c.detail.zscore?.toFixed(2)}</span>
                                <span>Type: {c.detail.anomaly_type || 'None'}</span>
                                <span>Method: {c.detail.method}</span>
                              </>
                            )}
                            {name === 'graph' && (
                              <span>Historical Score: {c.detail.raw_graph_score?.toFixed(2)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* TigerGraph Sync Info */}
              <div className="glass rounded-xl p-3 border border-white/5 bg-black/15 flex flex-col gap-1 text-[9px] text-white/40 leading-relaxed">
                <div className="flex items-center gap-1 font-bold text-white/60 mb-0.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                  DATABASE CONNECTIONS & SYNC STATUS
                </div>
                <div>Knowledge Graph: <span className="text-cyan-400 font-bold">UrbanSafetyGraph</span></div>
                <div>Sync Mechanism: <span className="text-white/60">pyTigerGraph REST++ Batched Loader</span></div>
                <div>Weights: <span className="text-white/60">LSTM (45%) | CV (30%) | Anomaly (15%) | Graph (10%)</span></div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
