/* مؤثرات صوتية مركّبة بالكامل بـ WebAudio — بلا أي ملفات صوت */
let ctx = null;
let master = null;
let noiseBuf = null;
let volume = 0.7;
let ambientNodes = null;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 6;
  master.connect(comp).connect(ctx.destination);
  const len = Math.floor(ctx.sampleRate * 1.2);
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

export function unlockAudio() {
  ensure();
  if (ctx && ctx.state === "suspended") ctx.resume();
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = volume;
}

function now() { return ctx.currentTime; }

function noise(dur, { freq = 1200, q = 1, gain = 0.3, type = "lowpass", at = 0, curve = 0.02 } = {}) {
  if (!ensure()) return;
  const t = now() + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 1;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + curve);
}

function tone(freq, dur, { type = "sine", gain = 0.2, at = 0, slide = null, detune = 0 } = {}) {
  if (!ensure()) return;
  const t = now() + at;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const GUN = {
  pistol: () => { noise(0.13, { freq: 2100, gain: 0.34 }); tone(120, 0.12, { type: "square", gain: 0.13, slide: 60 }); },
  smg: () => { noise(0.08, { freq: 2600, gain: 0.22 }); tone(160, 0.07, { type: "square", gain: 0.08, slide: 90 }); },
  shotgun: () => { noise(0.26, { freq: 900, gain: 0.42 }); tone(72, 0.22, { type: "sawtooth", gain: 0.18, slide: 40 }); },
  rifle: () => { noise(0.15, { freq: 1700, gain: 0.3 }); tone(95, 0.14, { type: "square", gain: 0.13, slide: 55 }); },
  lmg: () => { noise(0.1, { freq: 1500, gain: 0.26 }); tone(85, 0.1, { type: "square", gain: 0.1, slide: 50 }); },
  railgun: () => { tone(1400, 0.42, { type: "sawtooth", gain: 0.2, slide: 90 }); noise(0.3, { freq: 5200, type: "highpass", gain: 0.16 }); },
  hellfire: () => { noise(0.06, { freq: 3200, gain: 0.18 }); tone(200, 0.05, { type: "square", gain: 0.06, slide: 140 }); },
};

export const sfx = {
  shoot(id) { ensure(); (GUN[id] || GUN.pistol)(); },
  hit() { noise(0.07, { freq: 700, gain: 0.2, type: "bandpass", q: 2 }); },
  headshot() { tone(880, 0.12, { type: "triangle", gain: 0.16, slide: 1500 }); noise(0.06, { freq: 3000, gain: 0.14, type: "highpass" }); },
  kill() { noise(0.22, { freq: 320, gain: 0.22 }); tone(70, 0.2, { type: "sine", gain: 0.1, slide: 40 }); },
  reloadStart() { noise(0.05, { freq: 1600, gain: 0.14, type: "bandpass", q: 3 }); },
  reloadEnd() { noise(0.07, { freq: 2400, gain: 0.16, type: "bandpass", q: 2 }); tone(520, 0.06, { type: "square", gain: 0.08 }); },
  empty() { noise(0.03, { freq: 3800, gain: 0.1, type: "highpass" }); },
  coin() { tone(1180, 0.06, { type: "square", gain: 0.07 }); tone(1760, 0.08, { type: "square", gain: 0.05, at: 0.03 }); },
  gem() { tone(900, 0.14, { type: "triangle", gain: 0.12, slide: 1800 }); tone(1350, 0.2, { type: "sine", gain: 0.08, at: 0.05 }); },
  hurt() { tone(140, 0.18, { type: "sawtooth", gain: 0.18, slide: 70 }); noise(0.14, { freq: 420, gain: 0.16 }); },
  heal() { tone(520, 0.18, { type: "sine", gain: 0.12, slide: 900 }); },
  growl() { tone(60 + Math.random() * 30, 0.5, { type: "sawtooth", gain: 0.07, slide: 42, detune: 30 }); },
  waveStart() { tone(220, 0.25, { type: "square", gain: 0.1 }); tone(330, 0.3, { type: "square", gain: 0.08, at: 0.18 }); },
  levelWin() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, { type: "triangle", gain: 0.11, at: i * 0.11 })); },
  levelLose() { [330, 262, 196].forEach((f, i) => tone(f, 0.5, { type: "sawtooth", gain: 0.1, at: i * 0.18 })); },
  buy() { tone(660, 0.1, { type: "square", gain: 0.09 }); tone(990, 0.14, { type: "square", gain: 0.08, at: 0.08 }); },
  deny() { tone(160, 0.12, { type: "square", gain: 0.1 }); tone(120, 0.16, { type: "square", gain: 0.08, at: 0.1 }); },
  step() { noise(0.05, { freq: 380, gain: 0.05 }); },
};

export function startAmbient(mood = "city") {
  if (!ensure()) return;
  stopAmbient();
  const g = ctx.createGain();
  g.gain.value = 0.0;
  g.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 2);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = mood === "lab" ? 240 : 320;
  const root = mood === "subway" ? 41 : mood === "lab" ? 52 : 46;
  const oscs = [1, 1.5, 2.02].map((mul, i) => {
    const o = ctx.createOscillator();
    o.type = i === 2 ? "triangle" : "sine";
    o.frequency.value = root * mul;
    o.detune.value = i * 7 - 7;
    o.connect(filter);
    o.start();
    return o;
  });
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 60;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  filter.connect(g).connect(master);
  ambientNodes = { g, oscs, lfo };
}

export function stopAmbient() {
  if (!ambientNodes || !ctx) return;
  const { g, oscs, lfo } = ambientNodes;
  ambientNodes = null;
  try {
    g.gain.cancelScheduledValues(ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    setTimeout(() => { oscs.forEach((o) => o.stop()); lfo.stop(); }, 700);
  } catch {}
}
