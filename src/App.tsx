import { useCallback, useEffect, useRef, useState } from 'react';
import { HorrorHud } from './components/HorrorHud';
import { MobileControls } from './components/MobileControls';
import { EndOverlay, PauseOverlay } from './components/PauseAndEndOverlays';
import { TitleOverlay } from './components/TitleOverlay';
import { WebGLFallback } from './components/WebGLFallback';
import { HorrorEngine } from './game/HorrorEngine';
import { DifficultyMode, HudSnapshot } from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  deathReason: null,
  difficulty: 'standard',
  night: 1,
  maxNights: 50,
  timeOfDay: 'dawn',
  isBloodMoon: false,
  phaseSecondsLeft: 300,
  phaseProgress: 0,
  warmth: 100,
  frost: 0,
  sanity: 100,
  hallucinationFlash: 0,
  battery: 100,
  stamina: 100,
  flashlightOn: true,
  firewoodCount: 2,
  planksCount: 3,
  doorOpen: false,
  intactBarricades: 8,
  totalBarricadeSlots: 12,
  threatLevel: 0,
  stalkerState: 'lurk',
  locationLabel: 'Inside Cabin',
  interactPrompt: null,
  statusMessage: null,
  inSafeZone: false,
  safeZoneSource: null,
  pointerLocked: false,
  muted: false,
  bestNight: 0,
  planksPlaced: 0,
  totalNightsSurvived: 0,
  closeCalls: 0,
};

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HorrorEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [difficulty, setDifficulty] = useState<DifficultyMode>('standard');
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [isTouchDevice] = useState<boolean>(() => detectTouchDevice());
  const [touchControlsEnabled, setTouchControlsEnabled] = useState<boolean>(() =>
    detectTouchDevice(),
  );

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let engine: HorrorEngine | null = null;
    try {
      engine = new HorrorEngine(
        container,
        (snapshot) => setHud(snapshot),
        () => setWebglUnavailable(true),
        isTouchDevice,
      );
      engineRef.current = engine;
    } catch {
      setWebglUnavailable(true);
    }

    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
  }, [isTouchDevice]);

  useEffect(() => {
    engineRef.current?.setTouchMode(touchControlsEnabled);
  }, [touchControlsEnabled]);

  const handleStart = () => {
    engineRef.current?.startNewGame(difficulty);
  };

  const handleReplay = (mode: DifficultyMode) => {
    setDifficulty(mode);
    engineRef.current?.startNewGame(mode);
  };

  const handleReturnTitle = () => {
    engineRef.current?.returnToTitle();
  };

  const handleVirtualMove = useCallback((strafe: number, forward: number) => {
    engineRef.current?.setVirtualMove(strafe, forward);
  }, []);

  const handleLookDelta = useCallback((dx: number, dy: number) => {
    engineRef.current?.applyLookDelta(dx, dy);
  }, []);

  const handleSprintChange = useCallback((active: boolean) => {
    engineRef.current?.setVirtualSprint(active);
  }, []);

  const handleToggleFlashlight = useCallback(() => {
    engineRef.current?.triggerFlashlight();
  }, []);

  const handleInteract = useCallback(() => {
    engineRef.current?.triggerInteract();
  }, []);

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-[#060709]">
      {/* Isolated WebGL canvas mount point */}
      <div ref={mountRef} className="fixed inset-0 w-full h-full touch-none" />

      {webglUnavailable && <WebGLFallback />}

      {!webglUnavailable && hud.phase === 'title' && (
        <TitleOverlay
          difficulty={difficulty}
          bestNight={hud.bestNight}
          isTouchDevice={isTouchDevice}
          onSelectDifficulty={setDifficulty}
          onStart={handleStart}
          muted={hud.muted}
          onToggleMute={() => engineRef.current?.toggleMute()}
        />
      )}

      {!webglUnavailable && hud.phase === 'playing' && (
        <>
          <HorrorHud
            hud={hud}
            touchControlsEnabled={touchControlsEnabled}
            onToggleTouchControls={() => setTouchControlsEnabled((v) => !v)}
            onToggleMute={() => engineRef.current?.toggleMute()}
            onPause={() => engineRef.current?.pauseGame()}
          />
          {touchControlsEnabled && (
            <MobileControls
              flashlightOn={hud.flashlightOn}
              hasInteractPrompt={Boolean(hud.interactPrompt)}
              interactLabel={hud.interactPrompt}
              onMove={handleVirtualMove}
              onLookDelta={handleLookDelta}
              onSprintChange={handleSprintChange}
              onToggleFlashlight={handleToggleFlashlight}
              onInteract={handleInteract}
            />
          )}
        </>
      )}

      {!webglUnavailable && hud.phase === 'paused' && (
        <PauseOverlay
          hud={hud}
          onResume={() => engineRef.current?.resumeGame()}
          onRestart={() => engineRef.current?.startNewGame(hud.difficulty)}
          onReturnTitle={handleReturnTitle}
        />
      )}

      {!webglUnavailable && (hud.phase === 'caught' || hud.phase === 'survived') && (
        <EndOverlay
          hud={hud}
          onReplay={handleReplay}
          onReturnTitle={handleReturnTitle}
        />
      )}
    </div>
  );
}
