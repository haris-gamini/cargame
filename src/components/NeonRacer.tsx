import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Play, RotateCcw, Zap, Gauge, 
  ArrowLeft, ArrowRight, Bell, Volume2, 
  Settings, Radio, AlertTriangle, LightbulbOff,
  Lightbulb
} from 'lucide-react';

// --- Types ---
type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

interface Train {
  id: string;
  track: number; // 0, 1, 2
  z: number; // Distance from player (0 to 1000)
  speed: number;
  color: string;
}

// --- Constants ---
const TRACKS = 3;
const MAX_Z = 1000;
const INITIAL_SPEED = 10;
const SPEED_INC = 0.001;

export default function NeonTrainSimulation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [currentTrack, setCurrentTrack] = useState(1);
  const [isInsideVehicle, setIsInsideVehicle] = useState(true);
  const [isNight, setIsNight] = useState(true);
  
  const [activeAlert, setActiveAlert] = useState<string | null>(null);
  const [commsChannel, setCommsChannel] = useState(1);
  
  // Game Refs
  const trainsRef = useRef<Train[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const animationFrameId = useRef<number>(0);
  const trackTransitionRef = useRef(1);

  // Clear alerts
  useEffect(() => {
    if (activeAlert) {
      const timer = setTimeout(() => setActiveAlert(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [activeAlert]);

  // --- Sound Engine ---
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playTrainSound = useCallback((type: 'HORN' | 'BELL') => {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      
      const ctx = audioCtxRef.current!;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const gain = ctx.createGain();
      gain.connect(ctx.destination);

      if (type === 'HORN') {
        // Multi-oscillator approach for a rich train horn sound
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(160, ctx.currentTime);
        osc1.frequency.linearRampToValueAtTime(155, ctx.currentTime + 1.2);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(240, ctx.currentTime); // Harmonic richness
        osc2.frequency.linearRampToValueAtTime(235, ctx.currentTime + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

        osc1.start();
        osc2.start();
        osc1.stop(ctx.currentTime + 1.2);
        osc2.stop(ctx.currentTime + 1.2);
      } else {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.connect(gain);
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      }
    } catch (e) {
      console.warn('Audio context blocked or not supported');
    }
  }, []);

  // --- Initialization ---
  useEffect(() => {
    const saved = localStorage.getItem('neonExpressHighScore');
    if (saved) setHighScore(parseInt(saved));

    const checkTime = () => {
      const hours = new Date().getHours();
      setIsNight(hours < 6 || hours >= 18);
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const initGame = useCallback(() => {
    trainsRef.current = [];
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setCurrentTrack(1);
    trackTransitionRef.current = 1;
    setGameState('PLAYING');
    setIsInsideVehicle(true);
  }, []);

  // --- Game Loop ---
  const update = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    // Smooth movement
    const target = Math.round(currentTrack);
    trackTransitionRef.current += (target - trackTransitionRef.current) * 0.1;

    // Movement logic
    if (keysRef.current['a'] || keysRef.current['arrowleft']) {
      setCurrentTrack(prev => Math.max(0, prev - 1));
      keysRef.current['a'] = false; keysRef.current['arrowleft'] = false;
    }
    if (keysRef.current['d'] || keysRef.current['arrowright']) {
      setCurrentTrack(prev => Math.min(TRACKS - 1, prev + 1));
      keysRef.current['d'] = false; keysRef.current['arrowright'] = false;
    }

    // Spawn trains
    if (Math.random() < 0.015) {
      trainsRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        track: Math.floor(Math.random() * TRACKS),
        z: MAX_Z,
        speed: Math.random() * 5 + 5,
        color: `hsl(${Math.random() * 360}, 70%, 50%)`
      });
    }

    trainsRef.current = trainsRef.current.filter(t => {
      t.z -= speed;
      if (t.z < 100 && t.z > 0 && Math.round(t.track) === target) setGameState('GAMEOVER');
      return t.z > -100;
    });

    setSpeed(prev => prev + SPEED_INC);
    setScore(prev => prev + 1);

    draw();
    animationFrameId.current = requestAnimationFrame(update);
  }, [gameState, speed, currentTrack]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const horizonY = h * 0.45;
    const offsetX = (trackTransitionRef.current - 1) * (w * 0.4);

    // Scenery Logic
    const sceneryOffset = (score * speed * 0.1) % 1000;

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    if (isNight) {
      skyGrad.addColorStop(0, '#050510');
      skyGrad.addColorStop(1, '#1a1a3a');
    } else {
      skyGrad.addColorStop(0, '#87CEEB');
      skyGrad.addColorStop(1, '#E0F6FF');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Stars or Sun
    if (isNight) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 50; i++) {
        const sx = (Math.sin(i * 123.4) * 0.5 + 0.5) * w;
        const sy = (Math.cos(i * 567.8) * 0.5 + 0.5) * horizonY;
        ctx.fillRect(sx, sy, 1, 1);
      }
    } else {
      ctx.fillStyle = '#FFD700';
      ctx.shadowBlur = 40;
      ctx.shadowColor = '#FFD700';
      ctx.beginPath();
      ctx.arc(w * 0.8, horizonY * 0.3, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Remote Mountains (Far)
    ctx.fillStyle = isNight ? '#050515' : '#223d22';
    for (let i = -1; i < 3; i++) {
        const mX = w/2 + i * w - (sceneryOffset * 0.1) % w;
        ctx.beginPath();
        ctx.moveTo(mX - w * 0.8, horizonY);
        ctx.lineTo(mX, horizonY - 150);
        ctx.lineTo(mX + w * 0.8, horizonY);
        ctx.fill();
    }

    // Closer Hills
    ctx.fillStyle = isNight ? '#0a0a20' : '#2d4d2d';
    for (let i = -1; i < 3; i++) {
        const hX = w/2 + i * w - (sceneryOffset * 0.3) % w;
        ctx.beginPath();
        ctx.moveTo(hX - w * 0.6, horizonY);
        ctx.lineTo(hX, horizonY - 80);
        ctx.lineTo(hX + w * 0.6, horizonY);
        ctx.fill();
    }

    // Ground
    ctx.fillStyle = isNight ? '#05050f' : '#4a7a4a';
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Tracks
    ctx.strokeStyle = isNight ? 'rgba(0, 195, 255, 0.4)' : 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < TRACKS; i++) {
      const xTop = w / 2 + (i - 1) * 40;
      const xBottom = w / 2 + (i - 1) * (w * 0.6) - offsetX;
      
      // Rail lines
      ctx.beginPath();
      ctx.moveTo(xTop, horizonY);
      ctx.lineTo(xBottom, h);
      ctx.stroke();

      // Sleepers
      const sleeperCount = 20;
      for (let j = 0; j < sleeperCount; j++) {
          const zPos = ((j * (1000/sleeperCount) + score * speed * 0.5) % 1000) / 1000;
          const sY = horizonY + (h - horizonY) * zPos;
          const sScale = Math.pow(zPos, 2);
          const sWidth = 80 * sScale;
          const sXTop = w / 2 + (i - 1) * 40;
          const sXBottom = w / 2 + (i - 1) * (w * 0.6) - offsetX;
          const sX = sXTop + (sXBottom - sXTop) * zPos;
          
          ctx.strokeStyle = isNight ? 'rgba(100, 100, 150, 0.15)' : 'rgba(0,0,0,0.08)';
          ctx.beginPath();
          ctx.moveTo(sX - sWidth/2, sY);
          ctx.lineTo(sX + sWidth/2, sY);
          ctx.stroke();
      }
    }

    // Trains
    trainsRef.current.forEach(t => {
      // Draw 5 wagons per train for a "real train" feel
      for (let wIdx = 0; wIdx < 5; wIdx++) {
        const trainZ = t.z + wIdx * 120; // Offset each wagon
        const progress = 1 - trainZ / MAX_Z;
        if (progress < 0 || progress > 1) continue;
        
        const scale = Math.pow(progress, 3) * 1.5;
        const xTop = w / 2 + (t.track - 1) * 40;
        const xBottom = w / 2 + (t.track - 1) * (w * 0.6) - offsetX;
        const x = xTop + (xBottom - xTop) * progress;
        const y = horizonY + (h - horizonY) * progress;
        const tW = 100 * scale;
        const tH = 120 * scale;

        ctx.save();
        
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(x, y, tW * 0.6, tH * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        const grad = ctx.createLinearGradient(x - tW/2, y - tH, x + tW/2, y);
        grad.addColorStop(0, t.color);
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        
        if (wIdx === 0) {
            // Rounded Nose for Engine
            ctx.beginPath();
            ctx.moveTo(x - tW/2, y);
            ctx.lineTo(x + tW/2, y);
            ctx.lineTo(x + tW/2, y - tH * 0.6);
            ctx.quadraticCurveTo(x + tW/2, y - tH, x, y - tH);
            ctx.quadraticCurveTo(x - tW/2, y - tH, x - tW/2, y - tH * 0.6);
            ctx.closePath();
            ctx.fill();

            // Front Window
            ctx.fillStyle = isNight ? '#b0f2ff' : '#222';
            if (isNight) {
                ctx.shadowBlur = 15 * scale;
                ctx.shadowColor = '#00f2ff';
            }
            ctx.fillRect(x - tW * 0.35, y - tH * 0.85, tW * 0.7, tH * 0.25);
            
            // Headlights
            if (isNight) {
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 25 * scale;
                ctx.shadowColor = '#fff';
                ctx.beginPath();
                ctx.arc(x - tW * 0.25, y - tH * 0.2, 7 * scale, 0, Math.PI * 2);
                ctx.arc(x + tW * 0.25, y - tH * 0.2, 7 * scale, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Rectangular Wagon
            ctx.fillRect(x - tW/2, y - tH, tW, tH);
            // Side Windows
            ctx.fillStyle = isNight ? 'rgba(0, 242, 255, 0.4)' : 'rgba(0,0,0,0.3)';
            ctx.fillRect(x - tW * 0.45, y - tH * 0.8, tW * 0.9, tH * 0.3);
        }

        ctx.restore();
      }
    });
  }, [isNight, currentTrack]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (gameState === 'PLAYING') animationFrameId.current = requestAnimationFrame(update);
    else cancelAnimationFrame(animationFrameId.current);
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [gameState, update]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#0a0a0c] text-white font-sans overflow-hidden">
      
      <div className="relative w-full max-w-[1200px] h-[700px] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
        <canvas ref={canvasRef} width={1200} height={700} className="w-full h-full object-cover" />

        {/* Cockpit Glass Reflection */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-white/5 via-transparent to-white/5 opacity-30 z-20" />
        <div className="absolute top-1/4 -right-1/4 w-full h-px bg-white/5 rotate-[-15deg] blur-3xl pointer-events-none z-20" />

        {/* Dashboard Layout */}
        <div className="absolute inset-0 pointer-events-none z-30">
          <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black to-transparent flex items-center justify-between px-10">
            <div className="hud-glass px-6 py-2 border-l-4 border-l-cyan-400">
               <span className="text-[10px] opacity-40 uppercase block">Terminal Speed</span>
               <span className="font-mono text-xl neon-text">{(speed * 12).toFixed(0)} km/h</span>
            </div>
            <div className="hud-glass px-10 py-2 border-t-0 rounded-b-xl text-center">
               <span className="text-[8px] opacity-30 uppercase block tracking-[0.4em]">Grid Displacement</span>
               <span className="font-mono text-2xl tracking-tighter">{score.toString().padStart(6, '0')}</span>
            </div>
            <div className="hud-glass px-6 py-2 border-r-4 border-r-yellow-400 text-right">
               <span className="text-[10px] opacity-40 uppercase block">Record</span>
               <span className="font-mono text-xl text-yellow-400 neon-text">{highScore}</span>
            </div>
          </div>

          <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col gap-4 pointer-events-auto">
             {[
               { Icon: Bell, label: 'BELL', action: () => { setActiveAlert('BELL_ACTIVE'); playTrainSound('BELL'); } },
               { Icon: Volume2, label: 'HORN', action: () => { setActiveAlert('HORN_SIGNALLING'); playTrainSound('HORN'); } },
               { Icon: AlertTriangle, label: 'EMERGENCY', action: () => { setActiveAlert('EMERGENCY_STATUS'); playTrainSound('HORN'); } },
               { Icon: Radio, label: 'RADIO', action: () => {
                 const next = commsChannel % 4 + 1;
                 setCommsChannel(next);
                 setActiveAlert(`COMMS_CH_${next}`);
                 playTrainSound('BELL');
               }}
             ].map(({ Icon, action }, i) => (
                <button 
                  key={i} 
                  onClick={action}
                  className="w-12 h-12 rounded-full hud-glass flex items-center justify-center hover:scale-110 transition-transform active:bg-cyan-neon group"
                >
                   <Icon className={`w-5 h-5 ${i === 2 ? 'text-red-500' : 'text-cyan-400'} opacity-70 group-active:text-black`} />
                </button>
             ))}
          </div>

          {/* Active Alert Overlay */}
          <AnimatePresence>
            {activeAlert && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-1/3 left-1/2 -translate-x-1/2 px-8 py-4 hud-glass border-l-4 border-l-yellow-400"
              >
                <span className="text-yellow-400 font-bold tracking-[0.3em] text-xs neon-text">{activeAlert}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right Radar */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-6 pointer-events-auto">
            <div className="w-32 h-32 rounded-full hud-glass p-1 border-2 border-white/5 flex items-center justify-center relative">
               <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,195,255,0.1)_0%,transparent_70%)]" />
               <div className="w-px h-full bg-cyan-400/20 absolute left-1/2 -translate-x-1/2" />
               <div className="h-px w-full bg-cyan-400/20 absolute top-1/2 -translate-y-1/2" />
               <div className="text-[8px] uppercase tracking-widest text-cyan-400 font-black absolute top-2">Radar</div>
            </div>
          </div>

          {/* Bottom Cockpit Interface */}
          <div className="absolute bottom-0 inset-x-0 h-40 bg-[#121217] border-t-2 border-white/5 rounded-t-[80px] flex justify-between items-center px-20 shadow-[0_-20px_50px_rgba(0,0,0,1)]">
             <div className="flex items-center gap-6 pointer-events-auto">
                <button onClick={() => setCurrentTrack(prev => Math.max(0, prev - 1))} className="w-20 h-20 bg-black/50 border-2 border-cyan-400 rounded-xl flex items-center justify-center text-cyan-400 hover:bg-cyan-400/10 active:scale-95 transition-all">
                   <ArrowLeft className="w-8 h-8" />
                </button>
                <div className="text-[10px] font-black italic opacity-30 -rotate-90">TRACK_L</div>
             </div>

             <div className="relative pointer-events-auto">
                <div className="w-32 h-32 rounded-full border-4 border-gray-800 bg-black flex items-center justify-center">
                   <motion.div 
                    animate={{ rotate: (trackTransitionRef.current - 1) * 30 }}
                    className="w-1 h-12 bg-cyan-400 rounded-full shadow-[0_0_10px_cyan] mb-12" 
                   />
                   <div className="absolute bottom-4 text-[8px] font-black opacity-30 uppercase tracking-widest">Servo_Sync</div>
                </div>
             </div>

             <div className="flex items-center gap-6 pointer-events-auto">
                <div className="text-[10px] font-black italic opacity-30 -rotate-90">TRACK_R</div>
                <button onClick={() => setCurrentTrack(prev => Math.min(TRACKS - 1, prev + 1))} className="w-20 h-20 bg-black/50 border-2 border-cyan-400 rounded-xl flex items-center justify-center text-cyan-400 hover:bg-cyan-400/10 active:scale-95 transition-all">
                   <ArrowRight className="w-8 h-8" />
                </button>
             </div>
          </div>
        </div>

        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center text-center p-12">
               <h1 className="text-8xl font-black italic tracking-tighter text-white mb-4 neon-text">NEON<span className="text-cyan-neon">EXPRESS</span></h1>
               <p className="max-w-xs mb-10 text-[9px] uppercase tracking-[0.5em] text-cyan-neon font-black opacity-60">High-Speed Rail Simulation v1.2</p>
               <button onClick={initGame} className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest hover:bg-cyan-neon hover:text-white transition-all -skew-x-12 flex items-center gap-4">
                  <Play className="w-5 h-5 fill-current" />
                  <span>Execute Sequence</span>
               </button>
               <div className="mt-12 text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">Use [A] / [D] or Arrows to switch rails</div>
            </motion.div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-red-950/40 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-12 text-center">
               <div className="bg-[#0a0a0c] border-y-2 border-red-500 w-full py-16 flex flex-col items-center shadow-[0_0_50px_rgba(255,0,0,0.2)]">
                  <h2 className="text-8xl font-black italic text-white neon-red-text uppercase leading-none mb-8">System<br/>Halt</h2>
                  <div className="mb-12">
                    <div className="text-[10px] opacity-40 uppercase mb-2 tracking-widest">Displacement recorded</div>
                    <div className="text-7xl font-black italic neon-text">{score}</div>
                  </div>
                  <button onClick={initGame} className="px-12 py-5 bg-red-500 text-white font-black uppercase tracking-widest hover:scale-105 transition-all -skew-x-12 flex items-center gap-4">
                    <RotateCcw className="w-5 h-5" />
                    <span>Relaunch Sequence</span>
                  </button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
