export type GamePhase = 'title' | 'playing' | 'paused' | 'caught' | 'survived';

export type DifficultyMode = 'standard' | 'nightmare';

export type TimeOfDay = 'dawn' | 'night';

export type StalkerBehavior = 'lurk' | 'siege' | 'hunt' | 'recoil';

export type DeathReason = 'stalker' | 'frost' | null;

export interface HudSnapshot {
  phase: GamePhase;
  deathReason: DeathReason;
  difficulty: DifficultyMode;
  night: number;
  maxNights: number;
  timeOfDay: TimeOfDay;
  isBloodMoon: boolean;
  phaseSecondsLeft: number;
  phaseProgress: number;
  warmth: number;
  frost: number;
  sanity: number;
  hallucinationFlash: number;
  battery: number;
  stamina: number;
  flashlightOn: boolean;
  firewoodCount: number;
  planksCount: number;
  doorOpen: boolean;
  intactBarricades: number;
  totalBarricadeSlots: number;
  threatLevel: number;
  stalkerState: StalkerBehavior;
  locationLabel: string;
  interactPrompt: string | null;
  statusMessage: string | null;
  inSafeZone: boolean;
  safeZoneSource: string | null;
  pointerLocked: boolean;
  muted: boolean;
  bestNight: number;
  planksPlaced: number;
  totalNightsSurvived: number;
  closeCalls: number;
}
