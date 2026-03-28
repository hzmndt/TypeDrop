// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import '@material/web/button/elevated-button.js';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/slider/slider.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/progress/circular-progress.js';
import '@material/web/icon/icon.js';
import GameCanvas from './components/GameCanvas';
import { generateCommentary, generateMusic } from './services/geminiService';
import { VOCABULARY } from './data/vocabulary';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'md-elevated-button': any;
      'md-filled-button': any;
      'md-outlined-button': any;
      'md-text-button': any;
      'md-slider': any;
      'md-switch': any;
      'md-checkbox': any;
      'md-radio': any;
      'md-circular-progress': any;
      'md-linear-progress': any;
      'md-dialog': any;
      'md-icon': any;
      'md-icon-button': any;
      'md-fab': any;
      'md-list': any;
      'md-list-item': any;
      'md-divider': any;
      'md-menu': any;
      'md-menu-item': any;
      'md-tabs': any;
      'md-primary-tab': any;
      'md-secondary-tab': any;
      'md-textfield': any;
      'md-outlined-text-field': any;
      'md-filled-text-field': any;
    }
  }
}

type GameState = 'MENU' | 'PLAYING' | 'GAMEOVER';

const LEVEL_DEFAULTS: Record<string, { speed: number, spawn: number }> = {
  'Letters': { speed: 100, spawn: 1.0 },
  'K1': { speed: 80, spawn: 0.8 },
  'K2': { speed: 70, spawn: 0.7 },
  'P1': { speed: 60, spawn: 0.6 },
  'P2': { speed: 55, spawn: 0.5 },
  'P3': { speed: 50, spawn: 0.5 },
  'P4': { speed: 45, spawn: 0.4 },
  'P5': { speed: 40, spawn: 0.4 },
  'P6': { speed: 35, spawn: 0.3 }
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [gameId, setGameId] = useState(0);
  const [startingScore, setStartingScore] = useState(100);
  const [deductionPoints, setDeductionPoints] = useState(10);
  const [spawnRate, setSpawnRate] = useState(0.5); // words per second
  const [baseSpeed, setBaseSpeed] = useState(60); // pixels per second
  const [selectedLevel, setSelectedLevel] = useState<string>('P1');
  
  const [finalScore, setFinalScore] = useState(0);
  const [commentary, setCommentary] = useState('');
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [isMusicPaused, setIsMusicPaused] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.5;
      if (musicUrl) {
        if (isMusicPaused) {
          audioRef.current.pause();
        } else {
          audioRef.current.play().catch(console.error);
        }
      }
    }
  }, [musicUrl, isMusicPaused]);

  const handleStartGame = () => {
    setGameState('PLAYING');
    setGameId(prev => prev + 1);
    setCommentary('');
  };

  const handleGameOver = (score: number) => {
    setGameState('GAMEOVER');
    setFinalScore(score);
  };

  const handleMiss = async (currentScore: number, missedCount: number) => {
    // Only generate commentary occasionally to avoid spamming the API and UI
    if (missedCount % 3 === 0) {
      const comment = await generateCommentary(currentScore, missedCount);
      setCommentary(comment);
      
      // Clear commentary after 3 seconds
      setTimeout(() => {
        setCommentary(prev => prev === comment ? '' : prev);
      }, 3000);
    }
  };

  const handleGenerateMusic = async () => {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.aistudio) {
      // @ts-ignore
      if (!(await window.aistudio.hasSelectedApiKey())) {
        try {
          // @ts-ignore
          await window.aistudio.openSelectKey();
        } catch (e) {
          console.error("Failed to open key selector", e);
          return;
        }
      }
    }

    setIsGeneratingMusic(true);
    const url = await generateMusic("cheerful, upbeat, kid-friendly background music, playful, fun, lighthearted, marimba, xylophone, happy arcade style");
    if (url) {
      setMusicUrl(url);
    } else {
      // If it fails, they might need to re-select the key
      console.error("Music generation failed. You may need to select a valid paid API key.");
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        try {
          await (window as any).aistudio.openSelectKey();
        } catch (e) {
          console.error("Failed to open key selector after generation failure", e);
        }
      }
    }
    setIsGeneratingMusic(false);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col items-center justify-center p-4">
      
      {/* Background Music Player */}
      {musicUrl && (
        <audio ref={audioRef} src={musicUrl} loop className="hidden" />
      )}

      {/* Header */}
      <header className={`absolute top-0 left-0 w-full p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center z-10 gap-4 ${gameState === 'PLAYING' ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-3xl text-primary-400">keyboard</span>
          <h1 className="text-2xl font-bold tracking-tight">TypeDrop</h1>
        </div>
        
        {gameState === 'MENU' && (
          <div className="flex items-center gap-4">
            {isGeneratingMusic ? (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <md-circular-progress indeterminate></md-circular-progress>
                <span>Generating Music...</span>
              </div>
            ) : musicUrl ? (
              <md-outlined-button onClick={() => setIsMusicPaused(!isMusicPaused)} style={{ whiteSpace: 'nowrap' }}>
                <md-icon slot="icon">{isMusicPaused ? 'play_arrow' : 'pause'}</md-icon>
                {isMusicPaused ? 'Play Music' : 'Pause Music'}
              </md-outlined-button>
            ) : (
              <div className="flex items-center gap-2">
                <md-outlined-button onClick={handleGenerateMusic} style={{ whiteSpace: 'nowrap' }}>
                  <md-icon slot="icon">music_note</md-icon>
                  Generate Kid-Friendly BGM
                </md-outlined-button>
                {typeof window !== 'undefined' && (window as any).aistudio && (
                  <md-icon-button onClick={() => (window as any).aistudio.openSelectKey()} title="Set API Key">
                    <md-icon>key</md-icon>
                  </md-icon-button>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-4xl h-[80vh] relative flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {gameState === 'MENU' && (
            <motion.div 
              key="menu"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl shadow-2xl w-full max-w-md flex flex-col gap-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold">Ready to Type?</h2>
                <p className="text-neutral-400">Configure your game settings below.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-300 flex justify-between">
                    <span>Vocabulary Level</span>
                    <span className="text-purple-400 font-bold">{selectedLevel}</span>
                  </label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.keys(VOCABULARY).map(level => (
                      <button
                        key={level}
                        onClick={() => {
                          setSelectedLevel(level);
                          if (LEVEL_DEFAULTS[level]) {
                            setBaseSpeed(LEVEL_DEFAULTS[level].speed);
                            setSpawnRate(LEVEL_DEFAULTS[level].spawn);
                          }
                        }}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          selectedLevel === level 
                            ? 'bg-purple-500 text-white' 
                            : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-300 flex justify-between">
                    <span>Starting Score</span>
                    <span className="text-primary-400">{startingScore}</span>
                  </label>
                  <md-slider 
                    min="10" max="500" step="10" value={startingScore}
                    onInput={(e: any) => setStartingScore(Number(e.target.value))}
                    style={{ width: '100%' }}
                  ></md-slider>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-300 flex justify-between">
                    <span>Deduction per Miss</span>
                    <span className="text-red-400">-{deductionPoints}</span>
                  </label>
                  <md-slider 
                    min="1" max="50" step="1" value={deductionPoints}
                    onInput={(e: any) => setDeductionPoints(Number(e.target.value))}
                    style={{ width: '100%' }}
                  ></md-slider>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-300 flex justify-between">
                    <span>Spawn Rate (words/sec)</span>
                    <span className="text-blue-400">{spawnRate.toFixed(1)}</span>
                  </label>
                  <md-slider 
                    min="0.2" max="2" step="0.1" value={spawnRate}
                    onInput={(e: any) => setSpawnRate(Number(e.target.value))}
                    style={{ width: '100%' }}
                  ></md-slider>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-neutral-300 flex justify-between">
                    <span>Fall Speed</span>
                    <span className="text-green-400">{baseSpeed}</span>
                  </label>
                  <md-slider 
                    min="20" max="200" step="10" value={baseSpeed}
                    onInput={(e: any) => setBaseSpeed(Number(e.target.value))}
                    style={{ width: '100%' }}
                  ></md-slider>
                </div>
              </div>

              <div className="w-full mt-4 flex">
                <md-filled-button onClick={handleStartGame} style={{ width: '100%' }}>
                  <md-icon slot="icon">play_arrow</md-icon>
                  Start Game
                </md-filled-button>
              </div>
            </motion.div>
          )}

          {gameState === 'PLAYING' && (
            <motion.div 
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full relative"
            >
              <GameCanvas 
                key={gameId}
                isPlaying={true}
                startingScore={startingScore}
                deductionPoints={deductionPoints}
                spawnRate={spawnRate}
                baseSpeed={baseSpeed}
                wordList={VOCABULARY[selectedLevel]}
                onGameOver={handleGameOver}
                onMiss={handleMiss}
                onRestart={handleStartGame}
                onHome={() => setGameState('MENU')}
                hasMusic={!!musicUrl}
                isMusicPaused={isMusicPaused}
                onToggleMusic={() => setIsMusicPaused(!isMusicPaused)}
              />
              
              {/* AI Commentary Overlay */}
              <AnimatePresence>
                {commentary && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-primary-500/30 px-6 py-3 rounded-full shadow-lg shadow-primary-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary-400 animate-pulse">auto_awesome</span>
                      <span className="text-lg font-medium text-white">{commentary}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {gameState === 'GAMEOVER' && (
            <motion.div 
              key="gameover"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl shadow-2xl w-full max-w-md flex flex-col items-center gap-6"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-2">
                <span className="material-symbols-outlined text-5xl text-red-500">sentiment_dissatisfied</span>
              </div>
              
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-bold text-white">Game Over</h2>
                <p className="text-neutral-400">Your score dropped to zero!</p>
              </div>

              <div className="w-full bg-neutral-950 rounded-xl p-4 border border-neutral-800 flex justify-between items-center">
                <span className="text-neutral-400 font-medium">Final Score</span>
                <span className="text-2xl font-bold font-mono text-white">{finalScore}</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full mt-4">
                <div className="flex-1 flex">
                  <md-outlined-button onClick={() => setGameState('MENU')} style={{ width: '100%' }}>
                    <md-icon slot="icon">settings</md-icon>
                    Settings
                  </md-outlined-button>
                </div>
                <div className="flex-1 flex">
                  <md-filled-button onClick={handleStartGame} style={{ width: '100%' }}>
                    <md-icon slot="icon">replay</md-icon>
                    Play Again
                  </md-filled-button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
