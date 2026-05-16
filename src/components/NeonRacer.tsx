import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, RotateCcw, Zap, Gauge } from 'lucide-react';

// --- Types ---
type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

interface Car {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  color: string;
  isPlayer?: boolean;
}

interface PlayerCharacter {
  x: number;
  y: number;
  width: number;
  height: number;
  isInsideVehicle: boolean;
  currentVehicleId: string | null;
}

// --- Constants ---
const ROAD_LANES = 4;
const LANE_WIDTH = 80;
const CANVAS_WIDTH = LANE_WIDTH * ROAD_LANES;
const CANVAS_HEIGHT = 600;
const PLAYER_WIDTH = 45;
const PLAYER_HEIGHT = 75;
const HUMAN_SIZE = 16;
const TRAFFIC_SPAWN_RATE = 0.015; 
const INITIAL_GAME_SPEED = 5;
const SPEED_INCREMENT = 0.0001;

export default function NeonRacer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isInsideVehicle, setIsInsideVehicle] = useState(true);
  const [isNight, setIsNight] = useState(true);
  
  // Game Refs
  const playerCharRef = useRef<PlayerCharacter>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 100,
    width: HUMAN_SIZE,
    height: HUMAN_SIZE,
    isInsideVehicle: true,
    currentVehicleId: 'player-car'
  });

  const playerCarRef = useRef<Car>({
    id: 'player-car',
    x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
    y: CANVAS_HEIGHT - PLAYER_HEIGHT - 40,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    speed: 0,
    color: '#00c3ff',
    isPlayer: true
  });
  
  const trafficRef = useRef<Car[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const roadOffsetRef = useRef(0);
  const animationFrameId = useRef<number>(0);
  const lastScoreRef = useRef(0);

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem('neonRacerHighScore');
    if (saved) setHighScore(parseInt(saved));

    const checkTime = () => {
      const hours = new Date().getHours();
      setIsNight(hours < 6 || hours >= 18);
    };
    checkTime();
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('neonRacerHighScore', score.toString());
    }
  }, [score, highScore]);

  // --- Reset Game ---
  const initGame = useCallback(() => {
    playerCarRef.current = {
      id: 'player-car',
      x: CANVAS_WIDTH / 2 - PLAYER_WIDTH / 2,
      y: CANVAS_HEIGHT - PLAYER_HEIGHT - 40,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
      speed: 0,
      color: '#00c3ff',
      isPlayer: true
    };
    playerCharRef.current = {
      x: playerCarRef.current.x + PLAYER_WIDTH / 2,
      y: playerCarRef.current.y + PLAYER_HEIGHT / 2,
      width: HUMAN_SIZE,
      height: HUMAN_SIZE,
      isInsideVehicle: true,
      currentVehicleId: 'player-car'
    };
    trafficRef.current = [];
    roadOffsetRef.current = 0;
    lastScoreRef.current = 0;
    setScore(0);
    setSpeedMultiplier(1);
    setIsInsideVehicle(true);
    setGameState('PLAYING');
  }, []);

  // --- Collision Detection ---
  const checkCollision = (rect1: {x:number, y:number, width:number, height:number}, rect2: {x:number, y:number, width:number, height:number}) => {
    const margin = 5;
    return (
      rect1.x + margin < rect2.x + rect2.width - margin &&
      rect1.x + rect1.width - margin > rect2.x + margin &&
      rect1.y + margin < rect2.y + rect2.height - margin &&
      rect1.y + rect1.height - margin > rect2.y + margin
    );
  };

  // --- Game Loop ---
  const update = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    const currentSpeed = INITIAL_GAME_SPEED * speedMultiplier;
    roadOffsetRef.current = (roadOffsetRef.current + currentSpeed) % 100;

    // Handle Interaction (Exit/Enter Car)
    if (keysRef.current['e'] || keysRef.current['f']) {
      keysRef.current['e'] = false;
      keysRef.current['f'] = false;

      if (playerCharRef.current.isInsideVehicle) {
        // Exit Vehicle
        playerCharRef.current.isInsideVehicle = false;
        playerCharRef.current.currentVehicleId = null;
        setIsInsideVehicle(false);
        // Turn the car into traffic
        trafficRef.current.push({ ...playerCarRef.current, isPlayer: false, speed: currentSpeed * 0.5 });
      } else {
        // Try Enter Vehicle
        const nearbyCar = trafficRef.current.find(car => 
          Math.abs(car.x + car.width/2 - playerCharRef.current.x) < 50 &&
          Math.abs(car.y + car.height/2 - playerCharRef.current.y) < 50
        );

        if (nearbyCar) {
          playerCarRef.current = { ...nearbyCar, isPlayer: true };
          trafficRef.current = trafficRef.current.filter(c => c.id !== nearbyCar.id);
          playerCharRef.current.isInsideVehicle = true;
          playerCharRef.current.currentVehicleId = 'player-car';
          setIsInsideVehicle(true);
        }
      }
    }

    // Move Player (Car or Human)
    if (playerCharRef.current.isInsideVehicle) {
      const moveSpeed = 6 * speedMultiplier;
      if (keysRef.current['arrowleft'] || keysRef.current['a']) {
        playerCarRef.current.x = Math.max(0, playerCarRef.current.x - moveSpeed);
      }
      if (keysRef.current['arrowright'] || keysRef.current['d']) {
        playerCarRef.current.x = Math.min(CANVAS_WIDTH - PLAYER_WIDTH, playerCarRef.current.x + moveSpeed);
      }
      // Keep character sync
      playerCharRef.current.x = playerCarRef.current.x + PLAYER_WIDTH/2;
      playerCharRef.current.y = playerCarRef.current.y + PLAYER_HEIGHT/2;
    } else {
      // Human movement relative to scrolling road
      const humanSpeed = 4;
      if (keysRef.current['arrowleft'] || keysRef.current['a']) playerCharRef.current.x -= humanSpeed;
      if (keysRef.current['arrowright'] || keysRef.current['d']) playerCharRef.current.x += humanSpeed;
      if (keysRef.current['arrowup'] || keysRef.current['w']) playerCharRef.current.y -= humanSpeed;
      if (keysRef.current['arrowdown'] || keysRef.current['s']) playerCharRef.current.y += humanSpeed;
      
      // Boundaries
      playerCharRef.current.x = Math.max(0, Math.min(CANVAS_WIDTH - HUMAN_SIZE, playerCharRef.current.x));
      playerCharRef.current.y = Math.max(0, Math.min(CANVAS_HEIGHT - HUMAN_SIZE, playerCharRef.current.y));
      
      // Drag back slightly by road speed
      playerCharRef.current.y += currentSpeed * 0.2;
    }

    // Update Traffic
    if (Math.random() < TRAFFIC_SPAWN_RATE * speedMultiplier) {
      const lane = Math.floor(Math.random() * ROAD_LANES);
      const laneX = lane * LANE_WIDTH + (LANE_WIDTH - PLAYER_WIDTH) / 2;
      
      const isSpaceClear = trafficRef.current.every(t => Math.abs(t.y) > 200);
      
      if (isSpaceClear) {
        trafficRef.current.push({
          id: Math.random().toString(36).substr(2, 9),
          x: laneX,
          y: -PLAYER_HEIGHT - 50,
          width: PLAYER_WIDTH,
          height: PLAYER_HEIGHT,
          speed: (Math.random() * 2 + 1) * (speedMultiplier * 0.8),
          color: `hsl(${Math.random() * 360}, 70%, 50%)`
        });
      }
    }

    // Move traffic and check collision
    trafficRef.current = trafficRef.current.filter(car => {
      car.y += currentSpeed - car.speed;
      
      // Handle Collisions
      if (playerCharRef.current.isInsideVehicle) {
        if (checkCollision(playerCarRef.current, car)) {
          setGameState('GAMEOVER');
        }
      } else {
        if (checkCollision({ 
          x: playerCharRef.current.x - HUMAN_SIZE/2, 
          y: playerCharRef.current.y - HUMAN_SIZE/2, 
          width: HUMAN_SIZE, 
          height: HUMAN_SIZE 
        }, car)) {
          setGameState('GAMEOVER');
        }
      }
      
      return car.y < CANVAS_HEIGHT + 100 && car.y > -200;
    });

    if (playerCharRef.current.y > CANVAS_HEIGHT) setGameState('GAMEOVER'); // Player fell off back of screen

    // Update Score
    lastScoreRef.current += 1;
    if (Math.floor(lastScoreRef.current / 10) > score) {
      setScore(Math.floor(lastScoreRef.current / 10));
    }
    setSpeedMultiplier(prev => prev + SPEED_INCREMENT);

    draw();
    animationFrameId.current = requestAnimationFrame(update);
  }, [gameState, score, speedMultiplier]);

  // --- Rendering Helpers ---
  const drawCar = (ctx: CanvasRenderingContext2D, car: Car) => {
    const { x, y, width, height, color, isPlayer } = car;
    
    // Shadow/Glow only at night
    if (isNight) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
    } else {
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 8);
    ctx.fill();
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(x + 5, y + 15, width - 10, 15);
    if (isPlayer) {
      ctx.fillStyle = isNight ? '#fff' : 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + 5, y, 8, 4); ctx.fillRect(x + width - 13, y, 8, 4);
    } else {
      ctx.fillStyle = isNight ? '#ff0000' : 'rgba(0,0,0,0.2)';
      ctx.fillRect(x + 5, y + height - 4, 8, 4); ctx.fillRect(x + width - 13, y + height - 4, 8, 4);
    }
  };

  const drawHuman = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    if (isNight) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fff';
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = isNight ? '#fff' : '#000';
    ctx.beginPath();
    ctx.arc(x, y, HUMAN_SIZE/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = isNight ? '#0a0a0c' : '#222228';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Road Lines
    ctx.setLineDash([30, 20]);
    ctx.lineDashOffset = -roadOffsetRef.current;
    ctx.strokeStyle = isNight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 2;
    for (let i = 1; i < ROAD_LANES; i++) {
        ctx.beginPath(); ctx.moveTo(i * LANE_WIDTH, 0); ctx.lineTo(i * LANE_WIDTH, CANVAS_HEIGHT); ctx.stroke();
    }

    // Side Borders
    ctx.setLineDash([]);
    ctx.strokeStyle = isNight ? '#00c3ff' : '#555';
    ctx.lineWidth = 4;
    ctx.shadowBlur = isNight ? 10 : 0; 
    ctx.shadowColor = '#00c3ff';
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(2, CANVAS_HEIGHT); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CANVAS_WIDTH - 2, 0); ctx.lineTo(CANVAS_WIDTH - 2, CANVAS_HEIGHT); ctx.stroke();

    // Traffic
    trafficRef.current.forEach(car => drawCar(ctx, car));

    // Player
    if (playerCharRef.current.isInsideVehicle) {
      drawCar(ctx, playerCarRef.current);
    } else {
      drawHuman(ctx, playerCharRef.current.x, playerCharRef.current.y);
      
      // Interaction Prompt
      const nearbyCar = trafficRef.current.find(car => 
        Math.abs(car.x + car.width/2 - playerCharRef.current.x) < 60 &&
        Math.abs(car.y + car.height/2 - playerCharRef.current.y) < 60
      );
      if (nearbyCar) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS [E] TO HIJACK', playerCharRef.current.x, playerCharRef.current.y - 15);
      }
    }
  }, []);

  // --- Effects ---
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
    if (gameState === 'PLAYING') {
      animationFrameId.current = requestAnimationFrame(update);
    } else {
      cancelAnimationFrame(animationFrameId.current);
      draw();
    }
    return () => cancelAnimationFrame(animationFrameId.current);
  }, [gameState, update, draw]);

  const handleTouch = (e: React.TouchEvent | React.MouseEvent) => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const y = (clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
    
    if (playerCharRef.current.isInsideVehicle) {
        playerCarRef.current.x = Math.min(Math.max(0, x - PLAYER_WIDTH / 2), CANVAS_WIDTH - PLAYER_WIDTH);
    } else {
        playerCharRef.current.x = x;
        playerCharRef.current.y = y;
    }
  };

  return (
    <div 
      className="relative flex flex-col items-center justify-center min-h-screen bg-[#0a0a0c] text-[#eee] font-sans selection:bg-cyan-neon"
      ref={containerRef}
    >
      <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-1/2 h-full bg-gradient-to-b from-[#00c3ff22] to-transparent blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-1/2 h-80 bg-[#ff323211] blur-[120px]" />
      </div>

      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-neon/30 to-transparent z-50"></div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-neon/30 to-transparent z-50"></div>

      <div className="z-20 flex gap-4 mb-8 uppercase tracking-widest text-[9px] font-bold font-sans">
        <div className="hud-glass px-5 py-3 rounded-none skew-x-[-15deg] flex items-center gap-3 border-l-4 border-l-cyan-neon">
          <Trophy className="w-3 h-3 text-cyan-neon" />
          <span className="skew-x-[15deg]">BEST: <span className="text-white neon-text">{highScore}</span></span>
        </div>
        <div className="hud-glass px-5 py-3 rounded-none skew-x-[-15deg] flex items-center gap-3 border-l-4 border-l-red-neon">
          <Gauge className="w-3 h-3 text-red-neon" />
          <span className="skew-x-[15deg]">SYNC: <span className="text-white neon-red-text">x{speedMultiplier.toFixed(2)}</span></span>
        </div>
        <div className="hud-glass px-5 py-3 rounded-none skew-x-[-15deg] flex items-center gap-3 border-l-4 border-l-white">
          <Zap className="w-3 h-3 text-white" />
          <span className="skew-x-[15deg]">DIS: <span className="text-white font-mono">{score}</span></span>
        </div>
        <div className="hud-glass px-5 py-3 rounded-none skew-x-[-15deg] flex items-center gap-2 border-l-4 border-l-yellow-400">
           <span className="skew-x-[15deg] text-[8px]">{isInsideVehicle ? 'DRIVING' : 'ON FOOT'}</span>
        </div>
      </div>

      <div className="relative z-10 border border-white/10 rounded-sm shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseMove={handleTouch}
          onTouchMove={handleTouch}
          className={`${isNight ? 'bg-[#0a0a0c]' : 'bg-[#222228]'} cursor-none block w-full max-w-[400px] h-auto lg:max-w-none`}
        />

        {/* On-screen Controls (Visible in-game) */}
        {gameState === 'PLAYING' && (
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none z-30 lg:hidden">
            {/* Movement */}
            <div className="flex gap-2 pointer-events-auto">
              <button 
                onMouseDown={() => { keysRef.current['a'] = true; }}
                onMouseUp={() => { keysRef.current['a'] = false; }}
                onTouchStart={() => { keysRef.current['a'] = true; }}
                onTouchEnd={() => { keysRef.current['a'] = false; }}
                className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center active:bg-cyan-neon"
              >
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Play className="w-6 h-6 rotate-180" />
                </motion.div>
              </button>
              <button 
                onMouseDown={() => { keysRef.current['d'] = true; }}
                onMouseUp={() => { keysRef.current['d'] = false; }}
                onTouchStart={() => { keysRef.current['d'] = true; }}
                onTouchEnd={() => { keysRef.current['d'] = false; }}
                className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center active:bg-cyan-neon"
              >
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Play className="w-6 h-6" />
                </motion.div>
              </button>
            </div>

            {/* Action */}
            <div className="pointer-events-auto">
              <button 
                onClick={() => { keysRef.current['e'] = true; }}
                className="w-20 h-20 bg-white/20 backdrop-blur-md border-2 border-cyan-neon rounded-full flex flex-col items-center justify-center active:bg-cyan-neon font-black italic text-xs tracking-tighter"
              >
                <Zap className="w-6 h-6 mb-1" />
                <span>ACT</span>
              </button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {gameState === 'START' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#0a0a0cdd] backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-cyan-neon shadow-[0_0_15px_rgba(0,195,255,1)]" />
              <h1 className="text-7xl font-black mb-2 italic tracking-tighter text-white neon-text uppercase leading-none">
                Neon<br/><span className="text-cyan-neon">Racer</span>
              </h1>
              <div className="w-12 h-1 bg-cyan-neon mb-6 mx-auto" />
              <p className="max-w-xs mb-10 text-[10px] text-cyan-neon font-bold leading-relaxed opacity-60 uppercase tracking-[0.3em]">
                System Status: Ready<br/>
                Action: Drive or Hijack
              </p>
              <button 
                onClick={initGame}
                className="group relative px-12 py-5 bg-white text-black font-black uppercase transition-all hover:bg-cyan-neon hover:text-white flex items-center gap-4 rounded-none -skew-x-12 active:scale-95"
              >
                <Play className="w-5 h-5 fill-current" />
                <span className="tracking-widest">Initiate Run</span>
              </button>
              <div className="mt-12 text-[8px] text-white/30 uppercase tracking-[0.5em] flex flex-col gap-1">
                <span>[WASD] to Move</span>
                <span>[E] to Exit / Enter Vehicles</span>
              </div>
            </motion.div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, x: [0, -10, 10, -10, 10, 0] }}
              transition={{ opacity: { duration: 0.3 }, scale: { duration: 0.3 }, x: { duration: 0.4, times: [0, 0.1, 0.3, 0.5, 0.7, 1] } }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#0a0a0caa] backdrop-blur-md flex flex-col items-center justify-center p-8 text-center border-y-2 border-red-neon shadow-[inset_0_0_100px_rgba(255,0,0,0.2)]"
            >
              <h2 className="text-6xl font-black mb-1 italic tracking-tighter text-white neon-red-text uppercase">
                System<br/>Crash
              </h2>
              <div className="mb-12 mt-8">
                <div className="text-[10px] uppercase tracking-[0.4em] opacity-40 mb-2">Distance logged</div>
                <div className="text-7xl font-sans text-white font-black italic italic leading-none">{score}</div>
              </div>
              <button 
                onClick={initGame}
                className="group relative px-12 py-5 bg-red-neon text-white font-black uppercase transition-all hover:scale-105 flex items-center gap-4 rounded-none -skew-x-12 active:scale-95"
              >
                <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                <span className="tracking-widest">Restart System</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-16 text-[8px] text-white/20 uppercase tracking-[1em] font-bold z-10 flex flex-col items-center gap-4">
        <div className="flex gap-8 items-center">
          <div className="w-12 h-px bg-white/10" />
          <span>NeonRacer_Terminal_v1.2</span>
          <div className="w-12 h-px bg-white/10" />
        </div>
      </div>
    </div>
  );
}
