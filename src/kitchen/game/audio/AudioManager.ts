/** Lightweight WebAudio SFX — no external audio files required. */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master = 0.2;
  private sfxScale = 1;
  private enabled = true;
  private stepCooldown = 0;

  setEnabled(on: boolean) {
    this.enabled = on;
  }

  /** masterVolume 0–100 from settings. */
  setMaster(volume01or100: number) {
    const v = volume01or100 > 1 ? volume01or100 / 100 : volume01or100;
    this.master = Math.max(0, Math.min(1, v)) * 0.28;
  }

  /** sfxVolume 0–100 from settings. */
  setSfx(volume01or100: number) {
    const v = volume01or100 > 1 ? volume01or100 / 100 : volume01or100;
    this.sfxScale = Math.max(0, Math.min(1, v));
  }

  applyPrefs(masterVolume: number, sfxVolume: number) {
    this.setMaster(masterVolume);
    this.setSfx(sfxVolume);
    this.enabled = masterVolume > 0 && sfxVolume > 0;
  }

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private beep(freq: number, dur: number, type: OscillatorType = "square", gain = 0.04) {
    const ctx = this.ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const level = gain * this.master * this.sfxScale;
    g.gain.value = level;
    osc.connect(g);
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(level, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.start(now);
    osc.stop(now + dur);
  }

  playBoot() {
    this.beep(220, 0.08, "triangle", 0.05);
    setTimeout(() => this.beep(330, 0.1, "triangle", 0.05), 90);
  }

  playStep(delta: number, moving: boolean) {
    if (!moving) {
      this.stepCooldown = 0;
      return;
    }
    this.stepCooldown -= delta;
    if (this.stepCooldown > 0) return;
    this.stepCooldown = 220;
    this.beep(90 + Math.random() * 30, 0.04, "square", 0.025);
  }

  playInteract() {
    this.beep(440, 0.07, "sine", 0.06);
    this.beep(660, 0.09, "sine", 0.04);
  }

  playPickup() {
    this.beep(520, 0.05, "triangle", 0.05);
  }

  playDrop() {
    this.beep(180, 0.06, "square", 0.035);
  }

  playThrow() {
    this.beep(300, 0.04, "sawtooth", 0.03);
    this.beep(200, 0.08, "triangle", 0.04);
  }

  playChop() {
    this.beep(600, 0.03, "square", 0.04);
    this.beep(400, 0.05, "square", 0.03);
  }

  playWash() {
    this.beep(700, 0.06, "sine", 0.035);
    this.beep(900, 0.08, "sine", 0.03);
  }

  playCookDone() {
    this.beep(520, 0.08, "triangle", 0.05);
    this.beep(780, 0.1, "triangle", 0.05);
  }

  playBurn() {
    this.beep(120, 0.15, "sawtooth", 0.05);
  }

  playServe() {
    this.beep(440, 0.06, "triangle", 0.05);
    this.beep(554, 0.06, "triangle", 0.05);
    this.beep(659, 0.12, "triangle", 0.06);
  }

  playCoin() {
    this.beep(880, 0.05, "sine", 0.045);
    this.beep(1175, 0.08, "sine", 0.04);
  }

  playDing() {
    this.beep(990, 0.1, "triangle", 0.055);
    this.beep(1320, 0.12, "sine", 0.04);
  }

  playSizzle() {
    this.beep(180 + Math.random() * 40, 0.12, "sawtooth", 0.03);
  }

  playLaugh() {
    this.beep(520, 0.05, "sine", 0.03);
    setTimeout(() => this.beep(620, 0.06, "sine", 0.03), 70);
    setTimeout(() => this.beep(700, 0.08, "sine", 0.035), 140);
  }

  playWrong() {
    this.beep(200, 0.08, "square", 0.05);
    this.beep(150, 0.1, "square", 0.04);
  }

  playWalkout() {
    this.beep(180, 0.1, "sawtooth", 0.04);
    this.beep(120, 0.14, "sawtooth", 0.05);
  }

  playArrive() {
    this.beep(360, 0.05, "sine", 0.03);
  }

  destroy() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
