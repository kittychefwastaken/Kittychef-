import { Brain, Flame, Flashlight, Gamepad2, Hammer, Pause, ShieldCheck, Snowflake, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface HorrorHudProps {
  hud: HudSnapshot;
  touchControlsEnabled: boolean;
  onToggleTouchControls: () => void;
  onToggleMute: () => void;
  onPause: () => void;
}

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function HorrorHud({
  hud,
  touchControlsEnabled,
  onToggleTouchControls,
  onToggleMute,
  onPause,
}: HorrorHudProps) {
  const vignetteOpacity = Math.min(0.85, hud.threatLevel * 0.8);
  const frostVignetteOpacity =
    hud.frost > 15 ? Math.min(0.75, ((hud.frost - 15) / 85) * 0.72) : 0;
  const madness = hud.sanity < 65 ? Math.min(1, (65 - hud.sanity) / 65) : 0;
  const lowBattery = hud.battery <= 20;
  const lowWarmth = hud.warmth <= 25;
  const highFrost = hud.frost >= 65;
  const lowSanity = hud.sanity <= 35;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none overflow-hidden">
      {/* Low-Sanity Visual Distortion Layers (zero backdrop-blur) */}
      {madness > 0.02 && (
        <>
          <div
            className={`absolute -inset-4 transition-opacity duration-300 ${
              lowSanity ? 'animate-sanity-drift' : ''
            }`}
            style={{
              opacity: madness * 0.88,
              background:
                'radial-gradient(circle at center, transparent 30%, rgba(28, 12, 46, 0.45) 72%, rgba(4, 2, 10, 0.94) 100%)',
              boxShadow: `inset ${Math.round(madness * 14)}px 0 ${Math.round(
                madness * 34,
              )}px rgba(220, 38, 38, ${madness * 0.35}), inset -${Math.round(
                madness * 14,
              )}px 0 ${Math.round(madness * 34)}px rgba(56, 189, 248, ${
                madness * 0.35
              })`,
            }}
          />
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              opacity: madness * 0.28,
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 4px)',
            }}
          />
        </>
      )}

      {/* Brief Phantom Hallucination Flash */}
      {hud.hallucinationFlash > 0.02 && (
        <div
          className="absolute inset-0"
          style={{
            opacity: Math.min(0.65, hud.hallucinationFlash * 0.65),
            background:
              'radial-gradient(circle at center, rgba(226, 232, 240, 0.22) 0%, rgba(15, 23, 42, 0.72) 60%, rgba(0, 0, 0, 0.96) 100%)',
          }}
        />
      )}

      {/* Dynamic Icy Frost Vignette */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: frostVignetteOpacity,
          background:
            'radial-gradient(circle at center, transparent 48%, rgba(125, 211, 252, 0.34) 84%, rgba(186, 230, 253, 0.72) 100%)',
        }}
      />

      {/* Dynamic Proximity Threat Vignette */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: vignetteOpacity,
          background:
            'radial-gradient(circle at center, transparent 42%, rgba(127, 29, 29, 0.55) 85%, rgba(69, 10, 10, 0.92) 100%)',
        }}
      />

      {/* Top Row: Night Counter & Utility Controls */}
      <div className="relative z-20 flex items-start justify-between gap-2 p-3 sm:p-5 md:p-6">
        {/* Top-Left Night & Cabin Status */}
        <div className="bg-[#090a0d]/88 border border-white/12 rounded-md px-3 py-2.5 sm:px-4 sm:py-3 min-w-[175px] sm:min-w-[230px]">
          <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs text-[#a69f93] mb-1">
            <span className="truncate max-w-[100px] sm:max-w-none">{hud.locationLabel}</span>
            <span className="font-mono-tabular whitespace-nowrap">
              {hud.timeOfDay === 'dawn' ? 'Day' : hud.isBloodMoon ? 'Blood Moon' : 'Night'}{' '}
              {formatCountdown(hud.phaseSecondsLeft)}
            </span>
          </div>

          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium text-[#EAE6DF] whitespace-nowrap">
              Night{' '}
              <span className="font-mono-tabular font-semibold text-[#fbbf24]">
                {hud.night}
              </span>
              <span className="font-mono-tabular text-[#8f8a80]">/{hud.maxNights}</span>
            </span>
            <span className="text-[11px] sm:text-xs text-[#b5afa5] font-mono-tabular whitespace-nowrap">
              Boards {hud.intactBarricades}/{hud.totalBarricadeSlots}
            </span>
          </div>

          {/* Phase progress bar */}
          <div className="mt-1.5 h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                hud.timeOfDay === 'dawn'
                  ? 'bg-[#60a5fa]'
                  : hud.isBloodMoon
                    ? 'bg-[#dc2626]'
                    : 'bg-[#f59e0b]'
              }`}
              style={{ width: `${Math.round(hud.phaseProgress * 100)}%` }}
            />
          </div>

          {/* Compact mobile-only / touch-mode inline resources + frost & sanity bars */}
          {touchControlsEnabled && (
            <div className="mt-2 pt-1.5 border-t border-white/10 space-y-1.5">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono-tabular text-[#d4cfc6]">
                <span className={lowWarmth ? 'text-[#f87171]' : ''}>
                  Heat {hud.warmth}%
                </span>
                <span className={highFrost ? 'text-[#7dd3fc] font-semibold' : 'text-[#93c5fd]'}>
                  Frost {hud.frost}%
                </span>
                <span className={lowSanity ? 'text-[#e879f9] font-semibold' : 'text-[#c084fc]'}>
                  San {hud.sanity}%
                </span>
                <span className={lowBattery ? 'text-[#f87171]' : ''}>
                  Bat {hud.battery}%
                </span>
                <span>Wood {hud.firewoodCount}</span>
                <span>Plk {hud.planksCount}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      highFrost ? 'bg-[#bae6fd]' : 'bg-[#38bdf8]'
                    }`}
                    style={{ width: `${hud.frost}%` }}
                  />
                </div>
                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      lowSanity ? 'bg-[#e879f9]' : 'bg-[#a855f7]'
                    }`}
                    style={{ width: `${hud.sanity}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {hud.inSafeZone && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-[#34d399]">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Safe Zone · {hud.safeZoneSource} (Sanity +)</span>
            </p>
          )}

          {hud.stalkerState === 'hunt' ? (
            <p className="mt-1.5 text-[11px] sm:text-xs font-medium text-[#f87171]">
              Danger: The Watcher is hunting you
            </p>
          ) : hud.stalkerState === 'siege' && hud.timeOfDay === 'night' ? (
            <p className="mt-1.5 text-[11px] sm:text-xs font-medium text-[#fbbf24]">
              Alert: The Watcher is outside
            </p>
          ) : null}
        </div>

        {/* Top-Right Utility Controls (44x44px minimum touch targets) */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
          {!touchControlsEnabled && !hud.pointerLocked && (
            <span className="hidden lg:inline-block px-3 py-2 text-xs text-[#c4beb4] bg-[#090a0d]/88 border border-white/12 rounded-md whitespace-nowrap">
              Click viewport to lock mouse · Drag or Q/R to look
            </span>
          )}
          <button
            type="button"
            onClick={onToggleTouchControls}
            aria-label={touchControlsEnabled ? 'Hide touch controls' : 'Show touch controls'}
            className={`min-h-[44px] min-w-[44px] px-2.5 sm:px-3 flex items-center justify-center gap-1.5 text-xs font-medium border rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              touchControlsEnabled
                ? 'bg-[#EAE6DF] text-[#07080A] border-white'
                : 'bg-[#090a0d]/88 text-[#EAE6DF] border-white/12 hover:bg-[#171a21]'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span className="hidden sm:inline">Touch</span>
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
            className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3 flex items-center justify-center gap-1.5 text-xs font-medium text-[#EAE6DF] bg-[#090a0d]/88 border border-white/12 rounded-md hover:bg-[#171a21] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {hud.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{hud.muted ? 'Muted' : 'Sound'}</span>
          </button>
          <button
            type="button"
            onClick={onPause}
            aria-label="Pause game"
            className="min-h-[44px] min-w-[44px] px-2.5 sm:px-3 flex items-center justify-center gap-1.5 text-xs font-medium text-[#EAE6DF] bg-[#090a0d]/88 border border-white/12 rounded-md hover:bg-[#171a21] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Pause className="w-4 h-4" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        </div>
      </div>

      {/* Center Reticle & Desktop Interaction Prompt (touch mode shows interact CTA in right thumb zone) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-[#EAE6DF]/75" />
        {!touchControlsEnabled && hud.interactPrompt && (
          <div className="mt-6 px-4 py-2 text-xs font-medium text-[#EAE6DF] bg-[#090a0d]/92 border border-white/20 rounded-md">
            {hud.interactPrompt}
          </div>
        )}
      </div>

      {/* Status Notice Toast */}
      {hud.statusMessage && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 px-3.5 py-2 text-xs font-medium text-[#EAE6DF] bg-[#090a0d]/92 border border-white/15 rounded-md max-w-[90vw] text-center ${
            touchControlsEnabled ? 'bottom-40' : 'bottom-28'
          }`}
        >
          {hud.statusMessage}
        </div>
      )}

      {/* Desktop Bottom-Left Survival Meters (hidden in touch mode so thumbstick stays unobstructed) */}
      {!touchControlsEnabled && (
        <div className="absolute bottom-5 left-5 md:bottom-6 md:left-6 bg-[#090a0d]/88 border border-white/12 rounded-md px-4 py-3 w-72 space-y-2.5">
          <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
            <span className="flex items-center gap-1.5 text-[#EAE6DF]">
              <Flame className="w-3.5 h-3.5 text-[#f59e0b]" />
              <span>Firewood</span>
              <span className="font-mono-tabular font-semibold">{hud.firewoodCount}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[#EAE6DF]">
              <Hammer className="w-3.5 h-3.5 text-[#cbd5e1]" />
              <span>Planks</span>
              <span className="font-mono-tabular font-semibold">{hud.planksCount}</span>
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#c4beb4]">Cabin Warmth</span>
              <span
                className={`font-mono-tabular font-medium ${
                  lowWarmth ? 'text-[#f87171]' : 'text-[#EAE6DF]'
                }`}
              >
                {hud.warmth}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  lowWarmth ? 'bg-[#ef4444]' : 'bg-[#f97316]'
                }`}
                style={{ width: `${hud.warmth}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-[#c4beb4]">
                <Snowflake className="w-3.5 h-3.5 text-[#7dd3fc]" />
                <span>Frost</span>
              </span>
              <span
                className={`font-mono-tabular font-medium ${
                  highFrost ? 'text-[#bae6fd]' : 'text-[#EAE6DF]'
                }`}
              >
                {hud.frost}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  highFrost ? 'bg-[#bae6fd]' : 'bg-[#38bdf8]'
                }`}
                style={{ width: `${hud.frost}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-[#c4beb4]">
                <Brain className="w-3.5 h-3.5 text-[#c084fc]" />
                <span>Sanity</span>
              </span>
              <span
                className={`font-mono-tabular font-medium ${
                  lowSanity ? 'text-[#e879f9]' : 'text-[#EAE6DF]'
                }`}
              >
                {hud.sanity}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  lowSanity ? 'bg-[#e879f9]' : 'bg-[#a855f7]'
                }`}
                style={{ width: `${hud.sanity}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-[#c4beb4]">
                <Flashlight className="w-3.5 h-3.5" />
                <span>Flashlight ({hud.flashlightOn ? 'On' : 'Off'})</span>
              </span>
              <span
                className={`font-mono-tabular font-medium ${
                  lowBattery ? 'text-[#f87171]' : 'text-[#EAE6DF]'
                }`}
              >
                {hud.battery}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  lowBattery ? 'bg-[#ef4444]' : 'bg-[#fbbf24]'
                }`}
                style={{ width: `${hud.battery}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-[#c4beb4]">Stamina</span>
              <span className="font-mono-tabular font-medium text-[#EAE6DF]">
                {hud.stamina}%
              </span>
            </div>
            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ${
                  hud.stamina < 25 ? 'bg-[#d97706]' : 'bg-[#cbd5e1]'
                }`}
                style={{ width: `${hud.stamina}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop Bottom-Right Compact Keybind Reminder */}
      {!touchControlsEnabled && (
        <div className="hidden md:flex absolute bottom-6 right-6 bg-[#090a0d]/85 border border-white/12 rounded-md px-3.5 py-2.5 text-xs text-[#a69f93] gap-3">
          <span>[F] Light</span>
          <span aria-hidden="true">·</span>
          <span>[Shift] Sprint</span>
          <span aria-hidden="true">·</span>
          <span>[E] Board / Stoke / Collect</span>
        </div>
      )}
    </div>
  );
}
