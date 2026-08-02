/**
 * SOUND EFFECTS — synthesized, not sampled.
 *
 * Every cue is built from oscillators and filtered noise at play time, so
 * there are no audio files: nothing to download, nothing to cache, nothing
 * for Data Saver to worry about, and the PWA sounds the same offline.
 *
 * One shared AudioContext, created lazily on the first play — browsers only
 * allow audio after a user gesture, and every path into these functions
 * (opening a pack) IS a gesture, so a resume() per play is enough.
 *
 * Volume discipline: everything routes through one master gain at 0.3.
 * These are punctuation, not a soundtrack.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const live: AudioScheduledSourceNode[] = [];

function ac(): { c: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { c: ctx, out: master! };
}

/** Track sources so a Skip can silence everything mid-beat. */
function keep(src: AudioScheduledSourceNode) {
  live.push(src);
  src.onended = () => {
    const i = live.indexOf(src);
    if (i >= 0) live.splice(i, 1);
  };
}

export function sfxStop() {
  for (const s of live.splice(0)) {
    try { s.stop(); } catch { /* already ended */ }
  }
}

function noise(c: AudioContext, seconds: number): AudioBufferSourceNode {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

/**
 * THE FALL — a star tearing down through the sky. Filtered noise sweeping
 * from hiss to roar as it closes in, with a faint whistle gliding down
 * underneath. Duration matches the animation's fallMs so the sound lands
 * exactly when the star does.
 */
export function sfxFall(ms: number) {
  const a = ac();
  if (!a) return;
  const { c, out } = a;
  const t = c.currentTime, dur = Math.max(0.4, ms / 1000);

  const n = noise(c, dur + 0.1);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(2800, t);
  bp.frequency.exponentialRampToValueAtTime(240, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + dur * 0.85);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  n.connect(bp).connect(g).connect(out);
  n.start(t); n.stop(t + dur + 0.1); keep(n);

  const w = c.createOscillator();
  w.type = "sine";
  w.frequency.setValueAtTime(1400, t);
  w.frequency.exponentialRampToValueAtTime(170, t + dur);
  const wg = c.createGain();
  wg.gain.setValueAtTime(0.0001, t);
  wg.gain.exponentialRampToValueAtTime(0.07, t + dur * 0.6);
  wg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  w.connect(wg).connect(out);
  w.start(t); w.stop(t + dur); keep(w);
}

/**
 * THE COLLAPSE — the black hole. A sub tone dragged from 200Hz to the floor
 * with the noise field being sucked down after it, then a hard cut to
 * silence just before the detonation — the silence IS the beat.
 */
export function sfxCollapse() {
  const a = ac();
  if (!a) return;
  const { c, out } = a;
  const t = c.currentTime;

  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(200, t);
  o.frequency.exponentialRampToValueAtTime(28, t + 1.0);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55, t + 0.65);
  g.gain.setValueAtTime(0.0001, t + 1.02); // the cut, not a fade
  o.connect(g).connect(out);
  o.start(t); o.stop(t + 1.05); keep(o);

  const n = noise(c, 1.1);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1800, t);
  lp.frequency.exponentialRampToValueAtTime(90, t + 1.0);
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.25, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
  n.connect(lp).connect(ng).connect(out);
  n.start(t); n.stop(t + 1.05); keep(n);
}

/** THE CRASH — a kick-drum thump, a splash of bright debris, a long rumble. */
export function sfxBurst() {
  const a = ac();
  if (!a) return;
  const { c, out } = a;
  const t = c.currentTime;

  const k = c.createOscillator();
  k.type = "sine";
  k.frequency.setValueAtTime(150, t);
  k.frequency.exponentialRampToValueAtTime(42, t + 0.4);
  const kg = c.createGain();
  kg.gain.setValueAtTime(0.85, t);
  kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  k.connect(kg).connect(out);
  k.start(t); k.stop(t + 0.5); keep(k);

  const n = noise(c, 0.5);
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  n.connect(hp).connect(ng).connect(out);
  n.start(t); n.stop(t + 0.5); keep(n);

  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.value = 55;
  const sg = c.createGain();
  sg.gain.setValueAtTime(0.3, t);
  sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  sub.connect(sg).connect(out);
  sub.start(t); sub.stop(t + 0.95); keep(sub);
}

/**
 * THE STING — the hero card takes the screen. A small rising arpeggio in
 * detuned triangles, the only melodic moment in the sequence, which is what
 * makes a legendary FEEL announced rather than merely loud.
 */
export function sfxHero() {
  const a = ac();
  if (!a) return;
  const { c, out } = a;
  const t = c.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => {
    const at = t + i * 0.09;
    for (const detune of [0, 6]) {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.detune.value = detune;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(detune ? 0.05 : 0.14, at + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.85);
      o.connect(g).connect(out);
      o.start(at); o.stop(at + 0.9); keep(o);
    }
  });
}
