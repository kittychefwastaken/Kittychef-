import { DifficultyMode, HudSnapshot } from '../game/types';

interface PauseOverlayProps {
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export function PauseOverlay({
  hud,
  onResume,
  onRestart,
  onReturnTitle,
}: PauseOverlayProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-5 bg-[#060709]/85 overflow-y-auto touch-pan-y">
      <div className="max-w-md w-full bg-[#0e1015] border border-white/15 rounded-md p-6 sm:p-7">
        <p className="text-xs uppercase tracking-[0.16em] text-[#9c968c] mb-2">
          Cabin Watch Suspended
        </p>
        <h2 className="font-display text-3xl font-semibold text-[#EAE6DF] mb-2">
          Paused
        </h2>
        <p className="text-sm text-[#b5afa5] mb-6">
          Night <span className="font-mono-tabular text-[#EAE6DF]">{hud.night}/{hud.maxNights}</span>
          {' · '}
          Boards <span className="font-mono-tabular text-[#EAE6DF]">{hud.intactBarricades}/{hud.totalBarricadeSlots}</span>
          {' · '}
          <span className="text-[#EAE6DF]">{hud.locationLabel}</span>
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onResume}
            className="w-full min-h-[46px] py-2.5 px-4 text-sm font-semibold text-[#07080A] bg-[#EAE6DF] rounded-md hover:bg-white transition-colors cursor-pointer"
          >
            Resume
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full min-h-[46px] py-2.5 px-4 text-sm font-medium text-[#EAE6DF] bg-[#181b22] border border-white/12 rounded-md hover:bg-[#222630] transition-colors cursor-pointer"
          >
            Restart Night 1
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="w-full min-h-[46px] py-2.5 px-4 text-sm font-medium text-[#b5afa5] bg-transparent border border-white/10 rounded-md hover:text-[#EAE6DF] hover:border-white/25 transition-colors cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}

interface EndOverlayProps {
  hud: HudSnapshot;
  onReplay: (difficulty: DifficultyMode) => void;
  onReturnTitle: () => void;
}

export function EndOverlay({ hud, onReplay, onReturnTitle }: EndOverlayProps) {
  const survivedAll = hud.phase === 'survived';
  const frozeToDeath = !survivedAll && hud.deathReason === 'frost';

  return (
    <div
      className={`fixed inset-0 z-30 flex items-center justify-center p-5 overflow-y-auto touch-pan-y ${
        survivedAll
          ? 'bg-gradient-to-t from-[#060709] via-[#060709]/85 to-[#060709]/70'
          : frozeToDeath
            ? 'bg-gradient-to-t from-[#07131d]/95 via-[#060c14]/85 to-[#060709]/80'
            : 'bg-gradient-to-t from-[#140505]/95 via-[#090405]/85 to-[#060709]/80'
      }`}
    >
      <div className="max-w-lg w-full bg-[#0e1015]/95 border border-white/15 rounded-md p-6 sm:p-8">
        <p
          className={`text-xs uppercase tracking-[0.16em] mb-2 ${
            survivedAll ? 'text-[#34d399]' : frozeToDeath ? 'text-[#7dd3fc]' : 'text-[#f87171]'
          }`}
        >
          {survivedAll
            ? 'Dawn of Day 51 · Rescue Reached'
            : frozeToDeath
              ? `Frozen on Night ${hud.night} of ${hud.maxNights}`
              : `Fallen on Night ${hud.night} of ${hud.maxNights}`}
        </p>

        <h2 className="font-display text-3xl sm:text-5xl font-semibold text-[#EAE6DF] mb-4 text-balance">
          {survivedAll
            ? 'You Survived All 50 Nights'
            : frozeToDeath
              ? 'Claimed by the Frost'
              : 'The Cabin Was Breached'}
        </h2>

        <p className="text-sm text-[#c4beb4] leading-relaxed mb-6">
          {survivedAll
            ? 'Morning sun broke through the ridge pines as the forest went silent. You kept the stove lit, held every barricade, and outlasted fifty nights.'
            : frozeToDeath
              ? 'Sub-zero night winds overwhelmed you. Get inside before frostbite hits 100%, seal broken windows, and stoke the wood stove with firewood.'
              : 'Aim your flashlight beam directly through breached windows to drive the stalkers back while you nail fresh planks across the frame.'}
        </p>

        {/* Clean tabular run summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-y border-white/10 py-4 mb-6">
          <div>
            <p className="text-xs text-[#9c968c] mb-1">Nights Survived</p>
            <p className="font-mono-tabular text-lg font-semibold text-[#EAE6DF]">
              {hud.totalNightsSurvived}/{hud.maxNights}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#9c968c] mb-1">Best Record</p>
            <p className="font-mono-tabular text-lg font-semibold text-[#EAE6DF]">
              Night {hud.bestNight}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#9c968c] mb-1">Planks Nailed</p>
            <p className="font-mono-tabular text-lg font-semibold text-[#EAE6DF]">
              {hud.planksPlaced}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#9c968c] mb-1">Close Calls</p>
            <p className="font-mono-tabular text-lg font-semibold text-[#EAE6DF]">
              {hud.closeCalls}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onReplay(hud.difficulty)}
            className="min-h-[44px] px-6 py-2.5 text-sm font-semibold text-[#07080A] bg-[#EAE6DF] rounded-md hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={() =>
              onReplay(hud.difficulty === 'standard' ? 'nightmare' : 'standard')
            }
            className="min-h-[44px] px-5 py-2.5 text-sm font-medium text-[#EAE6DF] bg-[#181b22] border border-white/12 rounded-md hover:bg-[#222630] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Try {hud.difficulty === 'standard' ? 'Nightmare' : 'Standard'}
          </button>
          <button
            type="button"
            onClick={onReturnTitle}
            className="min-h-[44px] px-4 py-2.5 text-sm font-medium text-[#b5afa5] hover:text-[#EAE6DF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}
