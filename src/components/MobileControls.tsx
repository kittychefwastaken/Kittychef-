import { useEffect, useRef, useState } from 'react';
import { Flashlight, Footprints, Hand } from 'lucide-react';

interface MobileControlsProps {
  flashlightOn: boolean;
  hasInteractPrompt: boolean;
  interactLabel: string | null;
  onMove: (strafe: number, forward: number) => void;
  onLookDelta: (dx: number, dy: number) => void;
  onSprintChange: (active: boolean) => void;
  onToggleFlashlight: () => void;
  onInteract: () => void;
}

const STICK_MAX_RADIUS = 38;

function safeSetPointerCapture(el: HTMLElement, pointerId: number) {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Some mobile WebViews throw if pointer state changes rapidly
  }
}

export function MobileControls({
  flashlightOn,
  hasInteractPrompt,
  interactLabel,
  onMove,
  onLookDelta,
  onSprintChange,
  onToggleFlashlight,
  onInteract,
}: MobileControlsProps) {
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [sprintActive, setSprintActive] = useState(false);

  const stickPointerId = useRef<number | null>(null);
  const stickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookPointerId = useRef<number | null>(null);
  const lastLook = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const sprintPointerId = useRef<number | null>(null);
  const onMoveRef = useRef(onMove);
  const onSprintRef = useRef(onSprintChange);
  onMoveRef.current = onMove;
  onSprintRef.current = onSprintChange;

  useEffect(() => {
    return () => {
      onMoveRef.current(0, 0);
      onSprintRef.current(false);
    };
  }, []);

  const updateStickFromClient = (clientX: number, clientY: number) => {
    const dx = clientX - stickCenter.current.x;
    const dy = clientY - stickCenter.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, STICK_MAX_RADIUS);
    const angle = Math.atan2(dy, dx);
    const nx = dist > 0.001 ? Math.cos(angle) * clamped : 0;
    const ny = dist > 0.001 ? Math.sin(angle) * clamped : 0;

    setKnobOffset({ x: nx, y: ny });
    onMove(nx / STICK_MAX_RADIUS, -ny / STICK_MAX_RADIUS);
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickPointerId.current !== null) return;
    stickPointerId.current = e.pointerId;
    safeSetPointerCapture(e.currentTarget, e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    stickCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateStickFromClient(e.clientX, e.clientY);
  };

  const handleStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    stickPointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const handleLookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (lookPointerId.current !== null) return;
    lookPointerId.current = e.pointerId;
    safeSetPointerCapture(e.currentTarget, e.pointerId);
    lastLook.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    const dx = e.clientX - lastLook.current.x;
    const dy = e.clientY - lastLook.current.y;
    lastLook.current = { x: e.clientX, y: e.clientY };
    onLookDelta(dx, dy);
  };

  const handleLookUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    lookPointerId.current = null;
  };

  const releaseSprint = (pointerId?: number) => {
    if (pointerId !== undefined && sprintPointerId.current !== pointerId) return;
    sprintPointerId.current = null;
    setSprintActive(false);
    onSprintChange(false);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none touch-none">
      {/* Full-viewport touch-look surface behind HUD/joystick/buttons */}
      <div
        onPointerDown={handleLookDown}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookUp}
        onPointerCancel={handleLookUp}
        onLostPointerCapture={handleLookUp}
        aria-label="Touch look area"
        className="absolute inset-0 z-0 pointer-events-auto touch-none"
      />

      {/* Left Thumb Zone: Virtual Analog Joystick */}
      <div
        onPointerDown={handleStickDown}
        onPointerMove={handleStickMove}
        onPointerUp={handleStickUp}
        onPointerCancel={handleStickUp}
        onLostPointerCapture={handleStickUp}
        aria-label="Movement thumbstick"
        className="absolute z-10 bottom-6 left-5 w-28 h-28 rounded-full bg-[#090a0d]/70 border border-white/25 flex items-center justify-center pointer-events-auto touch-none"
      >
        <div
          className="w-12 h-12 rounded-full bg-[#EAE6DF]/85 border border-white/40 shadow-md pointer-events-none"
          style={{
            transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
          }}
        />
      </div>

      {/* Right Thumb Zone: Ergonomic Action Buttons (>= 48x48px hitboxes) */}
      <div className="absolute z-10 bottom-6 right-5 flex flex-col items-end gap-3 pointer-events-auto touch-none">
        {/* Contextual Interact CTA when near stove / window / door / pickup */}
        {hasInteractPrompt && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onInteract();
            }}
            className="min-h-[48px] px-4 py-2.5 flex items-center gap-2 rounded-xl bg-[#EAE6DF] text-[#07080A] text-xs font-semibold shadow-lg active:scale-95 transition-transform whitespace-nowrap touch-none cursor-pointer"
          >
            <Hand className="w-4 h-4 shrink-0" />
            <span>{interactLabel?.replace(/^\[E\]\s*/, '') || 'Interact'}</span>
          </button>
        )}

        <div className="flex items-center gap-3">
          {/* Hold Sprint Button */}
          <button
            type="button"
            aria-label="Hold to sprint"
            onPointerDown={(e) => {
              e.stopPropagation();
              sprintPointerId.current = e.pointerId;
              safeSetPointerCapture(e.currentTarget, e.pointerId);
              setSprintActive(true);
              onSprintChange(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              releaseSprint(e.pointerId);
            }}
            onPointerCancel={(e) => releaseSprint(e.pointerId)}
            onLostPointerCapture={(e) => releaseSprint(e.pointerId)}
            className={`min-w-[54px] min-h-[54px] px-3 rounded-full border flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium active:scale-95 transition-transform touch-none cursor-pointer ${
              sprintActive
                ? 'bg-[#f59e0b] text-[#07080A] border-[#fbbf24]'
                : 'bg-[#090a0d]/85 text-[#EAE6DF] border-white/25'
            }`}
          >
            <Footprints className="w-4 h-4" />
            <span>Sprint</span>
          </button>

          {/* Toggle Flashlight Button */}
          <button
            type="button"
            aria-label={flashlightOn ? 'Turn flashlight off' : 'Turn flashlight on'}
            onPointerDown={(e) => {
              e.stopPropagation();
              onToggleFlashlight();
            }}
            className={`min-w-[54px] min-h-[54px] px-3 rounded-full border flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium active:scale-95 transition-transform touch-none cursor-pointer ${
              flashlightOn
                ? 'bg-[#EAE6DF] text-[#07080A] border-white'
                : 'bg-[#090a0d]/85 text-[#c4beb4] border-white/25'
            }`}
          >
            <Flashlight className="w-4 h-4" />
            <span>{flashlightOn ? 'Light' : 'Off'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

