'use strict';
// Sonido 100% sintetizado con WebAudio: radio con ritmos originales, motor, sirena y efectos.

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const STATIONS = [
  null, // radio apagada
  { name: 'PALMERA FM 104.5', bpm: 104, swing: 0.06,
    kick:  'x.....x...x.....', snare: '....x.......x..x', hat: 'x.xxx.x.x.xxx.x.', open: '......x.......x.',
    roots: [40, 40, 45, 43], bass: [0, null, 12, null, 0, 0, null, 10, null, 0, null, 7, 10, null, 12, null],
    chordSteps: '...x.....x......', chord: [12, 15, 19, 22], chordType: 'square', bell: '..x.......x.....' },
  { name: 'RITMO CALLEJERO 98.1', bpm: 90, swing: 0.16,
    kick:  'x......xx.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', open: '',
    roots: [38, 38, 41, 36], bass: [0, null, null, null, null, null, null, 0, null, null, 3, null, null, null, -2, null],
    chordSteps: 'x.......x.......', chord: [24, 27, 31, 34], chordType: 'triangle', bell: '' },
  { name: 'BRISA TROPICAL 91.3', bpm: 96, swing: 0.0,
    kick:  'x...x...x...x...', snare: '....x.......x...', hat: '', open: '', guiro: 'x.xxx.xxx.xxx.xx',
    roots: [45, 40, 45, 40], bass: [0, null, null, null, 7, null, null, null, 0, null, null, null, 7, null, 5, null],
    chordSteps: '..x...x...x...x.', chord: [12, 15, 19], chordType: 'sawtooth', bell: '' },
];

const Sound = {
  ctx: null, station: 1, inCar: false, step: 0, nextT: 0, hornNodes: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.7; this.master.connect(c.destination);
    this.music = c.createGain(); this.music.gain.value = 0; this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.master);
    const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    // motor
    this.engOsc = c.createOscillator(); this.engOsc.type = 'sawtooth';
    this.engOsc2 = c.createOscillator(); this.engOsc2.type = 'square';
    this.engFilt = c.createBiquadFilter(); this.engFilt.type = 'lowpass'; this.engFilt.frequency.value = 500;
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.engOsc.connect(this.engFilt); this.engOsc2.connect(this.engFilt); this.engFilt.connect(this.engGain); this.engGain.connect(this.sfx);
    this.engOsc.start(); this.engOsc2.start();
    // sirena
    this.sirOsc = c.createOscillator(); this.sirOsc.type = 'square'; this.sirOsc.frequency.value = 760;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.8; const lg = c.createGain(); lg.gain.value = 260;
    lfo.connect(lg); lg.connect(this.sirOsc.frequency); lfo.start();
    const sf = c.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 1600;
    this.sirGain = c.createGain(); this.sirGain.gain.value = 0;
    this.sirOsc.connect(sf); sf.connect(this.sirGain); this.sirGain.connect(this.sfx); this.sirOsc.start();
    this.nextT = c.currentTime + 0.1;
    setInterval(() => this.tick(), 25);
  },
  tick() {
    const c = this.ctx; if (!c) return;
    const st = STATIONS[this.station];
    if (!st || !this.inCar) { this.nextT = c.currentTime + 0.05; return; }
    if (this.nextT < c.currentTime) this.nextT = c.currentTime + 0.05;
    const spb = 60 / st.bpm / 4;
    while (this.nextT < c.currentTime + 0.12) {
      this.playStep(st, this.step, this.nextT);
      this.nextT += spb * (this.step % 2 ? 1 - st.swing : 1 + st.swing);
      this.step = (this.step + 1) % 64;
    }
  },
  playStep(st, step, t) {
    const s = step % 16, bar = Math.floor(step / 16), root = st.roots[bar];
    const has = (p) => p && p[s] === 'x';
    if (has(st.kick)) this.kick(t);
    if (has(st.snare)) this.snare(t, st.guiro ? 0.35 : 0.6);
    if (has(st.hat)) this.hat(t, 0.18, false);
    if (has(st.open)) this.hat(t, 0.15, true);
    if (has(st.guiro)) this.hat(t, 0.12, false, 3500);
    if (has(st.bell)) this.bell(t);
    const bn = st.bass[s];
    if (bn !== null && bn !== undefined) this.bass(t, root + bn, st.bpm < 95 ? 0.4 : 0.18);
    if (has(st.chordSteps)) this.chord(t, st.chord.map(n => root + n), st.chordType === 'triangle' ? 1.2 : 0.14, st.chordType);
  },
  env(g, t, v, dur) { g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); },
  kick(t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.9, 0.32); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.35);
  },
  noise(t, dur, type, freq, v, dest) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    f.type = type; f.frequency.value = freq; this.env(g, t, v, dur);
    s.connect(f); f.connect(g); g.connect(dest || this.music); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  snare(t, v) {
    this.noise(t, 0.17, 'bandpass', 1900, v);
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = 190;
    this.env(g, t, v * 0.5, 0.08); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.1);
  },
  hat(t, v, open, freq) { this.noise(t, open ? 0.22 : 0.04, freq ? 'bandpass' : 'highpass', freq || 7500, v); },
  bell(t) {
    const c = this.ctx;
    [560, 845].forEach(f => { const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.value = f;
      this.env(g, t, 0.04, 0.12); o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.14); });
  },
  bass(t, m, dur) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = mtof(m);
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + dur); f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
    o.connect(f); f.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.1);
  },
  chord(t, notes, dur, type) {
    const c = this.ctx;
    notes.forEach(n => {
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = type; o.frequency.value = mtof(n + 24); f.type = 'lowpass'; f.frequency.value = 2200;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(type === 'triangle' ? 0.07 : 0.035, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(f); f.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.05);
    });
  },
  setInCar(v) {
    this.inCar = v; if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(v && this.station ? 0.42 : 0, t, 0.2);
    if (!v) this.engGain.gain.setTargetAtTime(0, t, 0.1);
  },
  nextStation() {
    this.station = (this.station + 1) % STATIONS.length;
    this.setInCar(this.inCar);
    return STATIONS[this.station] ? STATIONS[this.station].name : 'RADIO APAGADA';
  },
  engine(speed, max, throttle) {
    if (!this.ctx || !this.inCar) return;
    const a = Math.abs(speed), gear = Math.min(4, Math.floor(a / (max / 5)));
    const frac = (a - gear * max / 5) / (max / 5);
    const f = 38 + frac * 70 + gear * 9 + (throttle ? 6 : 0);
    const t = this.ctx.currentTime;
    this.engOsc.frequency.setTargetAtTime(f, t, 0.05); this.engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engFilt.frequency.setTargetAtTime(300 + frac * 600 + (throttle ? 300 : 0), t, 0.05);
    this.engGain.gain.setTargetAtTime(0.09 + (throttle ? 0.05 : 0), t, 0.1);
  },
  siren(vol) { if (this.ctx) this.sirGain.gain.setTargetAtTime(vol * 0.06, this.ctx.currentTime, 0.2); },
  crash(v) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.noise(t, 0.35, 'lowpass', 900, Math.min(1, v), this.sfx);
    this.noise(t, 0.12, 'highpass', 3000, Math.min(0.5, v * 0.5), this.sfx);
  },
  thud() { if (this.ctx) this.noise(this.ctx.currentTime, 0.15, 'lowpass', 400, 0.8, this.sfx); },
  horn(on) {
    if (!this.ctx) return;
    if (on && !this.hornNodes) {
      const c = this.ctx, g = c.createGain(); g.gain.value = 0.08; g.connect(this.sfx);
      const os = [392, 494].map(f => { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(g); o.start(); return o; });
      this.hornNodes = { g, os };
    } else if (!on && this.hornNodes) { this.hornNodes.os.forEach(o => o.stop()); this.hornNodes = null; }
  },
  tones(notes, gap, type, v) {
    if (!this.ctx) return; const c = this.ctx, t0 = c.currentTime;
    notes.forEach((n, i) => {
      const o = c.createOscillator(), g = c.createGain(), t = t0 + i * gap;
      o.type = type || 'square'; o.frequency.value = mtof(n);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v || 0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + gap * 1.8);
      o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + gap * 2);
    });
  },
  pickup() { this.tones([84, 88, 91, 96], 0.06, 'square', 0.07); },
  checkpoint() { this.tones([79, 86], 0.08, 'triangle', 0.18); },
  pass() { this.tones([67, 71, 74, 79, 83, 86, 91], 0.11, 'square', 0.09); },
  fail() { this.tones([67, 63, 60, 55], 0.2, 'sawtooth', 0.08); },
};
