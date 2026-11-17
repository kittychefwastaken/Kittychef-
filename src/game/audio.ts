/**
 * 100% Procedural Web Audio Forest Horror Sound Engine.
 * Synthesizes nocturnal pine wind, dirt vs wooden floor footsteps, hammer boarding,
 * wood stove stoking, heavy door/window pounding, dawn chimes, heartbeat, and jumpscare.
 */
export class ForestAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private started = false;

  private lastHeartbeatAt = 0;
  private lastPlayerStepAt = 0;
  private lastStalkerStepAt = 0;
  private lastStingAt = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.74, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public initAndResume(): void {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.74;
        this.masterGain.connect(this.ctx.destination);

        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * 2;
        const buf = this.ctx.createBuffer(1, length, sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buf;
      }

      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {});
      }

      if (!this.started && this.ctx && this.masterGain) {
        this.started = true;
        this.startForestAmbience();
      }
    } catch {
      // Audio playback is optional if blocked by browser policy
    }
  }

  private startForestAmbience(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.001, now);
    this.windGain.gain.exponentialRampToValueAtTime(0.12, now + 2.0);
    this.windGain.connect(this.masterGain);

    // Filtered wind howling softly through pines
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noiseBuffer;
    wind.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 280;
    filter.Q.value = 1.4;

    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.14;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 110;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    wind.connect(filter);
    filter.connect(this.windGain);
    wind.start();

    // Deep sub-bass forest dread
    const drone = this.ctx.createOscillator();
    drone.type = 'triangle';
    drone.frequency.value = 38;
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.14;
    drone.connect(droneGain);
    droneGain.connect(this.masterGain);
    drone.start();
  }

  public playFlashlightClick(on: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(on ? 1580 : 1120, now);
    osc.frequency.exponentialRampToValueAtTime(on ? 480 : 320, now + 0.035);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playDoorCreak(opening: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(opening ? 140 : 210, now);
    osc.frequency.linearRampToValueAtTime(opening ? 230 : 115, now + 0.24);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(bp);
    bp.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playHammerPlank(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [0, 0.14].forEach((offset) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(175, now + offset);
      osc.frequency.exponentialRampToValueAtTime(62, now + offset + 0.09);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.24, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.11);
    });
  }

  public playStokeFire(): void {
    if (!this.ctx || !this.masterGain || this.muted || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, now);
    lp.frequency.exponentialRampToValueAtTime(220, now + 0.45);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.5);
  }

  public playPickup(kind: 'wood' | 'plank' | 'battery'): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const f1 = kind === 'battery' ? 380 : kind === 'wood' ? 240 : 300;
    osc.frequency.setValueAtTime(f1, now);
    osc.frequency.exponentialRampToValueAtTime(f1 * 1.45, now + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playWindowPound(splintered = false): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.36, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);

    if (splintered && this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.28, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(this.masterGain);
      src.start(now);
      src.stop(now + 0.26);
    }
  }

  public playDawnChime(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [293.66, 369.99, 440].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.09);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now + i * 0.09);
      g.gain.linearRampToValueAtTime(0.11, now + i * 0.09 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + i * 0.09);
      osc.stop(now + 1.35);
    });
  }

  public playNightHorn(isBloodMoon: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isBloodMoon ? 73.42 : 98.0, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 1.4);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = isBloodMoon ? 380 : 260;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.2, now + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(lp);
    lp.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 1.55);
  }

  public updateFootsteps(moving: boolean, sprinting: boolean, indoors: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted || !moving) return;
    const nowMs = performance.now();
    const interval = sprinting ? 300 : 480;
    if (nowMs - this.lastPlayerStepAt < interval) return;
    this.lastPlayerStepAt = nowMs;

    const now = this.ctx.currentTime;
    if (indoors) {
      // Wooden cabin floorboard thud
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(105, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.07);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(sprinting ? 0.16 : 0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (this.noiseBuffer) {
      // Pine needles / dirt crunch outside
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = sprinting ? 980 : 760;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(sprinting ? 0.16 : 0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      src.start(now, Math.random() * 0.5, 0.1);
    }
  }

  public updateStalkerAudio(distance: number, moving: boolean, hunting: boolean): void {
    if (!this.ctx || !this.masterGain || this.muted || distance > 28) return;
    const nowMs = performance.now();
    const interval = hunting ? 330 : 620;
    if (!moving || nowMs - this.lastStalkerStepAt < interval) return;
    this.lastStalkerStepAt = nowMs;

    const atten = Math.max(0, 1 - distance / 28);
    const vol = atten * atten * (hunting ? 0.42 : 0.22);
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(86, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.16);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public updateThreatHeartbeat(threatLevel: number): void {
    if (!this.ctx || !this.masterGain || this.muted || threatLevel < 0.1) return;
    const nowMs = performance.now();
    const bpm = 64 + threatLevel * 102;
    const interval = (60 / bpm) * 1000;
    if (nowMs - this.lastHeartbeatAt < interval) return;
    this.lastHeartbeatAt = nowMs;

    const now = this.ctx.currentTime;
    const vol = 0.06 + threatLevel * 0.34;
    const beat = (offset: number, pitch: number, gainScale: number) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, now + offset);
      osc.frequency.exponentialRampToValueAtTime(28, now + offset + 0.11);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now + offset);
      g.gain.linearRampToValueAtTime(vol * gainScale, now + offset + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.13);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.14);
    };
    beat(0, 60, 1.0);
    beat(0.14, 50, 0.72);
  }

  public playSpotSting(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastStingAt < 5000) return;
    this.lastStingAt = nowMs;

    const now = this.ctx.currentTime;
    [220, 233.08, 311.13].forEach((freq) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1350, now);
      lp.frequency.exponentialRampToValueAtTime(300, now + 1.0);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.09, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.05);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 1.1);
    });
  }

  public playJumpscare(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [155.56, 207.65, 311.13, 622.25, 880].forEach((freq) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.9);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.24, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 1.0);
    });
    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.45, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      src.connect(g);
      g.connect(this.masterGain);
      src.start(now);
      src.stop(now + 0.8);
    }
  }

  public playSubtleWatcherScare(kind: 'knock' | 'whisper' | 'sting'): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    if (kind === 'knock') {
      [0, 0.14, 0.29].forEach((offset, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(118 - idx * 8, now + offset);
        osc.frequency.exponentialRampToValueAtTime(38, now + offset + 0.12);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.22, now + offset);
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start(now + offset);
        osc.stop(now + offset + 0.15);
      });
      return;
    }

    if (kind === 'whisper' && this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 3.2;
      bp.frequency.setValueAtTime(420, now);
      bp.frequency.exponentialRampToValueAtTime(1450, now + 0.18);
      bp.frequency.exponentialRampToValueAtTime(340, now + 0.55);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.24, now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      src.start(now);
      src.stop(now + 0.58);
      return;
    }

    // Subtle discordant violin-like sting
    [277.18, 293.66].forEach((freq) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.86, now + 0.34);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, now);
      lp.frequency.exponentialRampToValueAtTime(280, now + 0.34);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
