import { DifficultyMode } from '../game/types';

interface TitleOverlayProps {
  difficulty: DifficultyMode;
  bestNight: number;
  isTouchDevice: boolean;
  onSelectDifficulty: (mode: DifficultyMode) => void;
  onStart: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export function TitleOverlay({
  difficulty,
  bestNight,
  isTouchDevice,
  onSelectDifficulty,
  onStart,
  muted,
  onToggleMute,
}: TitleOverlayProps) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-8 md:p-12 overflow-y-auto touch-pan-y bg-gradient-to-t from-[#060709] via-[#060709]/68 to-[#060709]/58">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 max-w-6xl w-full mx-auto shrink-0">
        <span className="text-xs sm:text-sm font-medium tracking-wide text-[#c5bfb5] whitespace-nowrap shrink-0">
          Pine Creek Timber Cabin
        </span>
        <button
          type="button"
          onClick={onToggleMute}
          className="min-h-[44px] px-4 py-2 text-xs font-medium text-[#EAE6DF] bg-[#111317] border border-white/15 rounded-md hover:bg-[#1a1d24] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {muted ? 'Audio Muted' : 'Audio Enabled'}
        </button>
      </header>

      {/* Main focal anchor */}
      <main className="max-w-2xl w-full mx-auto text-center flex flex-col items-center my-3 sm:my-6">
        <p className="text-[11px] sm:text-xs tracking-[0.16em] uppercase text-[#a69f93] mb-2 sm:mb-4">
          50 Nights · Forest Cabin Survival
          {bestNight > 0 ? ` · Best Night ${bestNight}/50` : ''}
        </p>

        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight text-[#EAE6DF] leading-[1.05] text-balance mb-3 sm:mb-6">
          The Hollow Ward
        </h1>

        <p className="text-xs sm:text-base text-[#c4beb4] leading-relaxed max-w-lg mb-4 sm:mb-8">
          Hold out inside the ranger cabin for fifty nights. At dusk, gather firewood, planks, and
          batteries in the pines. After dark, board windows, keep the stove lit, and repel what
          stalks outside with your flashlight.
        </p>

        {/* Difficulty segmented control */}
        <div
          className="inline-flex items-center gap-1 p-1 bg-[#0d0f13] border border-white/15 rounded-lg mb-4 sm:mb-6"
          role="group"
          aria-label="Difficulty selection"
        >
          <button
            type="button"
            onClick={() => onSelectDifficulty('standard')}
            className={`min-h-[44px] px-5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              difficulty === 'standard'
                ? 'bg-[#EAE6DF] text-[#07080A]'
                : 'text-[#b5afa5] hover:text-[#EAE6DF]'
            }`}
          >
            Standard
          </button>
          <button
            type="button"
            onClick={() => onSelectDifficulty('nightmare')}
            className={`min-h-[44px] px-5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              difficulty === 'nightmare'
                ? 'bg-[#991b1b] text-[#EAE6DF]'
                : 'text-[#b5afa5] hover:text-[#EAE6DF]'
            }`}
          >
            Nightmare
          </button>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="min-h-[48px] px-8 py-3.5 text-sm font-semibold tracking-wide text-[#07080A] bg-[#EAE6DF] rounded-md hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Begin Night 1
        </button>

        <p className="mt-4 text-xs text-[#8f8a80] max-w-md">
          {difficulty === 'nightmare'
            ? 'Faster sieges, steeper warmth & battery drain, aggressive forest hunts.'
            : 'Balanced 50-night escalation, steady foraging respawns every dawn.'}
        </p>
      </main>

      {/* Bottom concise controls legend adapted for touch vs desktop */}
      <footer className="max-w-4xl w-full mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs text-[#9c968c] border-t border-white/10 pt-4 shrink-0">
        {isTouchDevice ? (
          <>
            <span>Left Thumbstick — Move</span>
            <span aria-hidden="true">·</span>
            <span>Right Screen Drag — Look</span>
            <span aria-hidden="true">·</span>
            <span>On-Screen Buttons — Sprint, Light &amp; Board/Collect</span>
          </>
        ) : (
          <>
            <span>WASD / Arrows — Move</span>
            <span aria-hidden="true">·</span>
            <span>Mouse / Drag — Look</span>
            <span aria-hidden="true">·</span>
            <span>Shift — Sprint</span>
            <span aria-hidden="true">·</span>
            <span>F / Right-Click — Flashlight</span>
            <span aria-hidden="true">·</span>
            <span>E — Board / Stoke / Collect</span>
          </>
        )}
      </footer>
    </div>
  );
}
