// Звуки-заглушки, синтезированные WebAudio: выстрел, удар, щелчок, ветер.
// Позже заменим на настоящие сэмплы.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let windStarted = false;

function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(c: AudioContext, sec: number) {
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * sec)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function burst(freq: number, sec: number, vol: number, type: BiquadFilterType = 'lowpass') {
  const c = ac();
  if (!c || !master) return;
  const src = noise(c, sec);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + sec);
  src.connect(f).connect(g).connect(master);
  src.start();
}

function tone(freq: number, sec: number, vol: number, type: OscillatorType = 'square') {
  const c = ac();
  if (!c || !master) return;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + sec);
  o.connect(g).connect(master);
  o.start();
  o.stop(c.currentTime + sec);
}

export const sfx = {
  shot() { burst(2200, 0.35, 0.9); burst(400, 0.25, 0.8); },
  punch() { burst(600, 0.12, 0.7); },
  sting() { burst(3000, 0.15, 0.4, 'highpass'); tone(180, 0.1, 0.15, 'sawtooth'); },
  hit() { burst(900, 0.1, 0.5); },
  click() { tone(1400, 0.03, 0.08); },
  denied() { tone(140, 0.15, 0.12); },
  levelUp() { tone(523, 0.12, 0.1); setTimeout(() => tone(659, 0.12, 0.1), 120); setTimeout(() => tone(784, 0.25, 0.1), 240); },
  combat() { tone(110, 0.4, 0.15, 'sawtooth'); },
  unlock() { tone(900, 0.05, 0.1); setTimeout(() => tone(1200, 0.06, 0.1), 80); },
  wind() {
    const c = ac();
    if (!c || !master || windStarted) return;
    windStarted = true;
    const src = noise(c, 4);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 380;
    f.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = 0.07;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.08;
    const lg = c.createGain();
    lg.gain.value = 160;
    lfo.connect(lg).connect(f.frequency);
    src.connect(f).connect(g).connect(master);
    src.start();
    lfo.start();
  },
};
