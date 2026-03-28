import React, { useEffect, useRef, useState } from 'react';
import { audioService } from '../services/audioService';

interface FallingWord {
  id: number;
  text: string;
  typed: string;
  x: number;
  y: number;
  speed: number;
  color: string;
}

interface GameCanvasProps {
  isPlaying: boolean;
  startingScore: number;
  deductionPoints: number;
  spawnRate: number; // words per second
  baseSpeed: number; // pixels per second
  wordList: string[];
  onGameOver: (finalScore: number) => void;
  onMiss: (score: number, missed: number) => void;
  onRestart?: () => void;
  onHome?: () => void;
}

const COLORS = ['#FF5252', '#FF4081', '#E040FB', '#7C4DFF', '#536DFE', '#448AFF', '#40C4FF', '#18FFFF', '#64FFDA', '#69F0AE', '#B2FF59', '#EEFF41', '#FFFF00', '#FFD740', '#FFAB40', '#FF6E40'];

export default function GameCanvas({
  isPlaying,
  startingScore,
  deductionPoints,
  spawnRate,
  baseSpeed,
  wordList,
  onGameOver,
  onMiss,
  onRestart,
  onHome
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(startingScore);
  const [missedCount, setMissedCount] = useState(0);

  // Use refs for mutable game state to avoid dependency issues in requestAnimationFrame
  const gameState = useRef({
    words: [] as FallingWord[],
    activeWordId: null as number | null,
    lastSpawnTime: 0,
    lastFrameTime: 0,
    score: startingScore,
    missedCount: 0,
    idCounter: 0,
    isPlaying: false
  });

  useEffect(() => {
    gameState.current.score = startingScore;
    gameState.current.missedCount = 0;
    gameState.current.words = [];
    gameState.current.activeWordId = null;
    gameState.current.lastFrameTime = 0;
    gameState.current.lastSpawnTime = 0;
    setScore(startingScore);
    setMissedCount(0);
  }, [startingScore, isPlaying]);

  useEffect(() => {
    gameState.current.isPlaying = isPlaying;
    if (!isPlaying) return;

    audioService.init();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const spawnWord = (timestamp: number) => {
      if (wordList.length === 0) return;
      const canvasWidth = canvas.width;
      const text = wordList[Math.floor(Math.random() * wordList.length)];
      
      // Keep words from spawning too close to edges
      const margin = 80;
      const x = margin + Math.random() * (canvasWidth - margin * 2);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      
      gameState.current.words.push({
        id: gameState.current.idCounter++,
        text,
        typed: '',
        x,
        y: -30,
        speed: baseSpeed + Math.random() * (baseSpeed * 0.5), // some variation
        color
      });
      gameState.current.lastSpawnTime = timestamp;
    };

    const gameLoop = (timestamp: number) => {
      if (!gameState.current.isPlaying) return;

      if (!gameState.current.lastFrameTime) {
        gameState.current.lastFrameTime = timestamp;
        gameState.current.lastSpawnTime = timestamp;
      }

      const deltaTime = (timestamp - gameState.current.lastFrameTime) / 1000; // in seconds
      gameState.current.lastFrameTime = timestamp;

      // Spawn new words
      if (timestamp - gameState.current.lastSpawnTime > (1000 / spawnRate)) {
        spawnWord(timestamp);
      }

      // Update positions and check for misses
      const canvasHeight = canvas.height;
      let missedThisFrame = 0;

      gameState.current.words = gameState.current.words.filter(word => {
        word.y += word.speed * deltaTime;
        if (word.y > canvasHeight + 30) {
          missedThisFrame++;
          if (gameState.current.activeWordId === word.id) {
            gameState.current.activeWordId = null;
          }
          return false;
        }
        return true;
      });

      if (missedThisFrame > 0) {
        audioService.playMissSound();
        gameState.current.score -= (deductionPoints * missedThisFrame);
        gameState.current.missedCount += missedThisFrame;
        setScore(gameState.current.score);
        setMissedCount(gameState.current.missedCount);
        
        onMiss(gameState.current.score, gameState.current.missedCount);

        if (gameState.current.score <= 0) {
          gameState.current.score = 0;
          setScore(0);
          gameState.current.isPlaying = false;
          onGameOver(0);
          return; // Stop game loop
        }
      }

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background
      ctx.fillStyle = '#1e1e24'; // dark background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw words
      gameState.current.words.forEach(word => {
        const isActive = word.id === gameState.current.activeWordId;
        
        ctx.font = 'bold 24px Roboto, sans-serif';
        const textWidth = ctx.measureText(word.text).width;
        const padding = 12;
        const pillWidth = textWidth + padding * 2;
        const pillHeight = 36;
        
        // Draw glow
        ctx.shadowBlur = isActive ? 20 : 10;
        ctx.shadowColor = word.color;
        
        // Draw pill
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(word.x - pillWidth/2, word.y - pillHeight/2, pillWidth, pillHeight, pillHeight/2);
        } else {
          ctx.rect(word.x - pillWidth/2, word.y - pillHeight/2, pillWidth, pillHeight);
        }
        ctx.fillStyle = isActive ? '#3d3d45' : '#2d2d35';
        ctx.fill();
        ctx.strokeStyle = word.color;
        ctx.lineWidth = isActive ? 3 : 2;
        ctx.stroke();

        // Draw text
        ctx.shadowBlur = 0;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        const startX = word.x - textWidth / 2;
        const typedWidth = ctx.measureText(word.typed).width;
        
        // Typed part
        ctx.fillStyle = '#4ade80'; // green-400
        ctx.fillText(word.typed, startX, word.y + 2);
        
        // Untyped part
        ctx.fillStyle = '#ffffff';
        ctx.fillText(word.text.substring(word.typed.length), startX + typedWidth, word.y + 2);
      });

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, spawnRate, baseSpeed, deductionPoints, wordList, onGameOver, onMiss]);

  // Handle keyboard input
  useEffect(() => {
    if (!isPlaying) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key.length !== 1 || !/[a-z]/.test(key)) return;

      let activeWord = gameState.current.words.find(w => w.id === gameState.current.activeWordId);

      if (activeWord) {
        const nextChar = activeWord.text[activeWord.typed.length].toLowerCase();
        if (key === nextChar) {
          activeWord.typed += activeWord.text[activeWord.typed.length];
          audioService.playHitSound();
          
          if (activeWord.typed === activeWord.text) {
            // Word finished!
            gameState.current.score += activeWord.text.length * 2;
            setScore(gameState.current.score);
            gameState.current.words = gameState.current.words.filter(w => w.id !== activeWord.id);
            gameState.current.activeWordId = null;
          }
        }
      } else {
        // Find the lowest word that starts with this key
        let targetWord: FallingWord | null = null;
        let maxY = -Infinity;

        gameState.current.words.forEach((word) => {
          if (word.text[0].toLowerCase() === key && word.y > maxY) {
            maxY = word.y;
            targetWord = word;
          }
        });

        if (targetWord) {
          targetWord.typed = targetWord.text[0];
          gameState.current.activeWordId = targetWord.id;
          audioService.playHitSound();
          
          if (targetWord.typed === targetWord.text) {
            gameState.current.score += 2;
            setScore(gameState.current.score);
            gameState.current.words = gameState.current.words.filter(w => w.id !== targetWord!.id);
            gameState.current.activeWordId = null;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          canvasRef.current.width = parent.clientWidth;
          canvasRef.current.height = parent.clientHeight;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-gray-800">
      <canvas ref={canvasRef} className="block w-full h-full" />
      
      {/* HUD */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none">
        <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
          <span className="material-symbols-outlined text-yellow-400">star</span>
          <span className="text-white font-bold text-xl font-mono">{score}</span>
        </div>
        
        <div className="flex gap-2">
          {onHome && (
            <button 
              onClick={onHome}
              className="pointer-events-auto bg-black/50 hover:bg-white/10 transition-colors backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-white"
              title="Back to Menu"
            >
              <span className="material-symbols-outlined text-white">home</span>
              <span className="hidden sm:inline font-medium">Menu</span>
            </button>
          )}
          {onRestart && (
            <button 
              onClick={onRestart}
              className="pointer-events-auto bg-black/50 hover:bg-white/10 transition-colors backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 text-white"
              title="Restart Game"
            >
              <span className="material-symbols-outlined text-white">refresh</span>
              <span className="hidden sm:inline font-medium">Restart</span>
            </button>
          )}
        </div>

        <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-400">warning</span>
          <span className="text-white font-bold text-xl font-mono">{missedCount}</span>
        </div>
      </div>
    </div>
  );
}
