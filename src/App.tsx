import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Activity, Fuel, Gauge, History, Map, Timer, Zap, Globe, Shield, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TelemetryData {
  fuelLevel: number;
  fuelPct: number;
  avgFuelPerLap: number;
  lapsOnTank: number;
  lastLapTime: number;
  bestLapTime: number;
  lap: number;
  sessionTimeRemain: number;
  trackName: string;
  airTemp: number;
  trackTemp: number;
  stintStartTime: number;
}

const formatTime = (seconds: number) => {
  if (!seconds || seconds < 0) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatLap = (seconds: number) => {
  if (!seconds) return "--:--.---";
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(3);
  return `${m}:${s.padStart(6, '0')}`;
};

const StatCard = ({ label, value, unit, icon: Icon, colorClass = "text-glow-cyan" }: any) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass-panel p-6 flex flex-col justify-between"
  >
    <div className="flex justify-between items-start">
      <div className="label">{label}</div>
      <Icon size={16} className="text-slate-500" />
    </div>
    <div className="flex items-baseline gap-2 mt-2">
      <AnimatePresence mode="wait">
        <motion.div 
          key={value}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`telemetry-value ${colorClass}`}
        >
          {value}
        </motion.div>
      </AnimatePresence>
      {unit && <div className="text-slate-400 text-sm font-semibold">{unit}</div>}
    </div>
  </motion.div>
);

const App: React.FC = () => {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [stintTime, setStintTime] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [gatewayOpen, setGatewayOpen] = useState(true);
  const [error, setError] = useState('');
  
  // Gateway Inputs
  const [mode, setMode] = useState<'local' | 'remote'>('local');
  const [relayUrl, setRelayUrl] = useState('https://iracing-strategy-relay.onrender.com');
  const [sessionId, setSessionId] = useState('');
  const [pin, setPin] = useState('');

  const socketRef = useRef<Socket | null>(null);

  const connect = (targetMode = mode, targetRelay = relayUrl, targetId = sessionId, targetPin = pin) => {
    setError('');
    if (socketRef.current) socketRef.current.disconnect();

    const targetUrl = targetMode === 'local' ? 'http://localhost:3001' : targetRelay;
    if (!targetUrl) {
       setError('Please enter a Relay URL');
       return;
    }

    const socket = io(targetUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      if (targetMode === 'remote') {
        socket.emit('join-session', { sessionId: targetId, pin: targetPin });
      } else {
        setIsConnected(true);
        setGatewayOpen(false);
      }
    });

    socket.on('session-joined', () => {
       setIsConnected(true);
       setGatewayOpen(false);
       setSessionId(targetId); // Ensure state is updated for the header
    });
    
    // ... rest of socket listeners
    socket.on('telemetry', (payload: TelemetryData) => setData(payload));
    socket.on('error', (err: string) => { setError(err); socket.disconnect(); });
    socket.on('disconnect', () => setIsConnected(false));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sId = params.get('session');
    const sPin = params.get('pin');
    const sRelay = params.get('relay') || 'https://iracing-strategy-relay.onrender.com';

    if (sId && sPin) {
      setMode('remote');
      setRelayUrl(sRelay);
      setSessionId(sId);
      setPin(sPin);
      connect('remote', sRelay, sId, sPin);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (data?.stintStartTime) {
        setStintTime(Math.floor((Date.now() - data.stintStartTime) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [data?.stintStartTime]);

  if (gatewayOpen) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-obsidian p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel max-w-md w-full p-8"
        >
          <div className="flex items-center gap-3 mb-8">
            <Zap className="text-cyan-400" size={32} />
            <h1 className="text-2xl font-bold">MISSION GATEWAY</h1>
          </div>

          <div className="flex gap-2 mb-6">
            <button 
              onClick={() => setMode('local')}
              className={`flex-1 py-2 rounded-md transition-colors ${mode === 'local' ? 'bg-cyan-400 text-black font-bold' : 'bg-slate-800 text-slate-400'}`}
            >
              LOCAL
            </button>
            <button 
              onClick={() => setMode('remote')}
              className={`flex-1 py-2 rounded-md transition-colors ${mode === 'remote' ? 'bg-cyan-400 text-black font-bold' : 'bg-slate-800 text-slate-400'}`}
            >
              REMOTE
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'local' ? (
              <motion.div 
                key="local"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="text-slate-400 text-sm mb-6"
              >
                Connecting to iRacing Strategy Bridge on this machine (Port 3001).
              </motion.div>
            ) : (
              <motion.div 
                key="remote"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4 mb-6"
              >
                <div className="label text-[10px]">Relay Endpoint</div>
                <input 
                  type="text" 
                  placeholder="https://..." 
                  value={relayUrl}
                  onChange={(e) => setRelayUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 font-mono"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="label text-[10px]">Session</div>
                    <input 
                      type="text" 
                      placeholder="ID" 
                      value={sessionId}
                      onChange={(e) => setSessionId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                  <div>
                    <div className="label text-[10px]">Security PIN</div>
                    <input 
                      type="password" 
                      placeholder="PIN" 
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && <div className="text-red-400 text-xs mb-4 font-mono">{error}</div>}

          <button 
            onClick={connect}
            className="w-full py-3 bg-white text-black font-bold rounded-md hover:bg-cyan-400 transition-colors uppercase tracking-widest text-sm"
          >
            Initiate Connection
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="grid-layout">
      {/* Header */}
      <div className="col-span-2 flex justify-between items-center px-4">
        <div className="flex items-center gap-6">
          <img src="/team-logo.png" alt="Operation Motorsport Racing" className="h-20 w-auto brightness-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]" />
          <div className="h-12 w-px bg-slate-800 mx-2 hidden md:block"></div>
          <div>
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-mono uppercase tracking-[0.2em]">
              {mode === 'remote' ? <Globe size={10} /> : <Shield size={10} />}
              {mode === 'remote' ? `Live Telemetry Link • ${sessionId}` : 'Local Diagnostic Link'}
            </div>
            <div className="text-cyan-400 text-xs font-bold uppercase tracking-widest mt-1">
              {data?.trackName || 'Awaiting Connection...'}
            </div>
          </div>
        </div>
        <div className="flex gap-8 items-center">
          <button 
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?session=${sessionId}&pin=${pin}&relay=${relayUrl}`;
              navigator.clipboard.writeText(url);
              alert('Mission Control link copied to clipboard!');
            }}
            className="flex flex-col items-center gap-1 group"
            title="Copy Instant-Access Link for Team"
          >
            <div className="label group-hover:text-cyan-400 transition-colors">Share Mission</div>
            <Share2 size={18} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
          </button>
          <div className="h-8 w-px bg-slate-800 mx-2"></div>
          <div className="text-right">
             <div className="label">Session Status</div>
             <div className="text-glow-cyan text-xs font-bold uppercase">{isConnected ? 'Active' : 'Offline'}</div>
          </div>
          <div className="text-right">
            <div className="label">Session Clock</div>
            <div className="telemetry-value text-xl">{formatTime(data?.sessionTimeRemain || 0)}</div>
          </div>
        </div>
      </div>

      {/* Main Stats Pane */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard 
          label="Fuel Level" 
          value={data?.fuelLevel.toFixed(1) || "0.0"} 
          unit="L" 
          icon={Fuel} 
          colorClass="text-glow-green"
        />
        <StatCard 
          label="Avg Fuel per Lap" 
          value={data?.avgFuelPerLap.toFixed(2) || "0.00"} 
          unit="L/LAP" 
          icon={Activity} 
        />
        <StatCard 
          label="Laps Remaining on Tank" 
          value={data?.lapsOnTank.toFixed(1) || "0.0"} 
          unit="LAPS" 
          icon={Gauge} 
          colorClass="text-glow-orange"
        />
        <StatCard 
          label="Current Stint Time" 
          value={formatTime(stintTime)} 
          unit="HH:MM:SS" 
          icon={Timer} 
        />
        
        {/* Large Pit Window Widget */}
        <div className="glass-panel col-span-2 p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <div className="label">Pit window projection</div>
             <History size={16} className="text-slate-500" />
          </div>
          <div className="flex-1 flex items-center justify-center border-t border-dashed border-slate-800 pt-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-glow-cyan mb-2">
                LAP {Math.floor((data?.lap || 0) + (data?.lapsOnTank || 0))}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-widest">Projected Empty Tank</div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Pane */}
      <div className="flex flex-col gap-4">
        <div className="glass-panel flex-1 p-6">
          <div className="label mb-4">Timing & Performance</div>
          <div className="space-y-6">
            <div>
              <div className="text-xs text-slate-500 mb-1">LAST LAP</div>
              <div className="font-mono text-2xl">{formatLap(data?.lastLapTime || 0)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">BEST LAP</div>
              <div className="font-mono text-2xl text-cyan-400">{formatLap(data?.bestLapTime || 0)}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6">
          <div className="label mb-4 flex items-center gap-2">
            <Map size={14} /> Track Conditions
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500">AIR TEMP</div>
              <div className="font-mono text-lg">{data?.airTemp.toFixed(1) || 0}°C</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">TRACK TEMP</div>
              <div className="font-mono text-lg">{data?.trackTemp.toFixed(1) || 0}°C</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
