export class AudioSys {
  constructor() {
    this.ctx = null;
    this.volume = 0.6;
    this.enabled = true;
  }

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setVolume(v) {
    this.volume = v;
  }

  tone(freq, dur, type = 'square', gain = 0.08, slide = 0) {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
    const vol = Math.max(0.0001, gain * this.volume);
    g.gain.value = vol;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  noise(dur, gain = 0.1, filterFreq = 800) {
    if (!this.enabled || this.volume <= 0) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const n = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = n;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = gain * this.volume;
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }

  break() { this.noise(0.12, 0.18, 900); this.tone(180, 0.08, 'square', 0.04, -80); }
  place() { this.tone(220, 0.07, 'triangle', 0.07, -40); this.noise(0.05, 0.08, 600); }
  jump() { this.tone(320, 0.09, 'sine', 0.05, 80); }
  step() { this.noise(0.04, 0.05, 400); }
  ui() { this.tone(520, 0.05, 'square', 0.04); }
  hurt() { this.tone(140, 0.16, 'sawtooth', 0.1, -60); }
  craft() { this.tone(400, 0.08, 'triangle', 0.06); this.tone(600, 0.1, 'triangle', 0.04); }
  death() { this.tone(90, 0.5, 'sawtooth', 0.12, -50); }
}
