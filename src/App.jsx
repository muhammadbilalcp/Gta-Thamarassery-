import React, { useEffect, useRef, useState } from 'react';
import { Game } from './Game.js';
import { HUDContainer } from './components/HUDContainer.jsx';
import { BigMap } from './components/BigMap.jsx';
import { LoadingScreen } from './components/LoadingScreen.jsx';
import { MobileControls } from './components/MobileControls.jsx';

export function App() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [activeGame, setActiveGame] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new Game(canvas);
    gameRef.current = game;
    window.__game = game;
    setActiveGame(game);

    let cancelled = false;
    game.start().catch((err) => {
      if (cancelled) return;
      console.error('[Game] Start error:', err);
      const status = document.getElementById('loading-status');
      if (status) status.textContent = `Failed to start: ${err.message}`;
    });

    return () => {
      cancelled = true;
      try {
        game.dispose();
      } catch (e) {
        console.warn('[Game] Dispose error:', e);
      }
      if (window.__game === game) {
        window.__game = null;
      }
      setActiveGame(null);
    };
  }, []);

  const handleStart = () => {
    if (gameRef.current?.begin) {
      gameRef.current.begin();
    }
  };

  return (
    <>
      <canvas ref={canvasRef} id="game"></canvas>
      <HUDContainer />
      <BigMap />
      <LoadingScreen onStart={handleStart} />
      <MobileControls game={activeGame} />
    </>
  );
}

export default App;
