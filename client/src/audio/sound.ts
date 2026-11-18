// All audio is synthesised at runtime with WebAudio: original SFX and procedural music loops.
import type { Vec3 } from '@shared/types';
import { useStore } from '../store/useStore';
import { registry } from '../game/registry';

let ctx: AudioContext | null = null;
let master: GainNode, musicGain: GainNode, sfxGain: GainNode, uiGain: GainNode;
let noiseBuf: AudioBuffer;

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  } catch {
    return null;
  }
  master = ctx.createGain();
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  sfxGain = ctx.createGain();
  uiGain = ctx.createGain();
  for (const g of [musicGain, sfxGain, uiGain]) g.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
  return ctx;
}

function applyVolumes() {
  if (!ctx) return;
  const s = useStore.getState().settings;
  master.gain.value = s.master;
  musicGain.gain.value = s.music * 0.5;
  sfxGain.gain.value = s.sfx;
  uiGain.gain.value = s.ui;
}
useStore.subscribe((s, p) => { if (s.settings !== p.settings) applyVolumes(); });

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
}
if (typeof window !== 'undefined') {
  const un = () => { unlockAudio(); if (pendingTrack) startTrack(pendingTrack); };
  window.addEventListener('pointerdown', un);
  window.addEventListener('keydown', un);
}

type Wave = OscillatorType;
function tone(out: AudioNode, f: number, dur: number, type: Wave = 'sine', vol = 0.3, at = 0, slide?: number, attack = 0.005) {
  const c = ctx!;
  const t = c.currentTime + at;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise(out: AudioNode, dur: number, freq: number, vol = 0.2, at = 0, q = 1, type: BiquadFilterType = 'bandpass') {
  const c = ctx!;
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

export type SfxName =
  | 'click' | 'hover' | 'jump' | 'step' | 'caught' | 'miss' | 'boing' | 'ability' | 'scan' | 'chaos' | 'door' | 'toy' | 'pop' | 'notify'
  | 'whoosh' | 'start' | 'hunt' | 'victory' | 'defeat' | 'paint' | 'tick' | 'squeak' | 'bell' | 'horn' | 'chime' | 'piano' | 'land' | 'error';

/** Play a sound effect; with a world position it is attenuated and panned relative to the local player. */
export function sfx(name: SfxName, pos?: Vec3, volume = 1) {
  const c = ensure();
  if (!c || c.state !== 'running') return;
  let out: AudioNode = ['click', 'hover', 'pop', 'notify', 'error'].includes(name) ? uiGain : sfxGain;
  if (pos) {
    const me = registry.local.p;
    const dx = pos[0] - me[0], dz = pos[2] - me[2];
    const d = Math.hypot(dx, dz);
    const att = Math.max(0, 1 - d / 28) ** 1.5;
    if (att < 0.02) return;
    const g = c.createGain();
    g.gain.value = att * volume;
    const pan = c.createStereoPanner();
    const ang = Math.atan2(dx, dz) - registry.local.camYaw - Math.PI;
    pan.pan.value = Math.max(-1, Math.min(1, Math.sin(ang) * -0.8));
    g.connect(pan).connect(out);
    out = g;
  } else if (volume !== 1) {
    const g = c.createGain();
    g.gain.value = volume;
    g.connect(out);
    out = g;
  }
  switch (name) {
    case 'click': tone(out, 660, 0.07, 'triangle', 0.25); tone(out, 990, 0.06, 'sine', 0.12, 0.03); break;
    case 'hover': tone(out, 880, 0.04, 'sine', 0.06); break;
    case 'pop': tone(out, 520, 0.08, 'sine', 0.25, 0, 900); break;
    case 'notify': [660, 880, 1320].forEach((f, i) => tone(out, f, 0.18, 'triangle', 0.18, i * 0.08)); break;
    case 'error': tone(out, 220, 0.18, 'square', 0.08, 0, 160); break;
    case 'jump': tone(out, 300, 0.18, 'square', 0.06, 0, 620); break;
    case 'land': noise(out, 0.08, 300, 0.12, 0, 0.8, 'lowpass'); break;
    case 'step': noise(out, 0.06, 900 + Math.random() * 400, 0.1, 0, 2); break;
    case 'caught': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(out, f, 0.25, 'triangle', 0.2, i * 0.06)); noise(out, 0.4, 5000, 0.08, 0, 0.5, 'highpass'); break;
    case 'miss': tone(out, 160, 0.15, 'sine', 0.3, 0, 90); noise(out, 0.1, 400, 0.15); break;
    case 'boing': tone(out, 180, 0.4, 'sine', 0.35, 0, 520); tone(out, 520, 0.3, 'sine', 0.15, 0.12, 200); break;
    case 'ability': noise(out, 0.35, 1800, 0.18, 0, 0.6); tone(out, 400, 0.3, 'sine', 0.15, 0, 1200); break;
    case 'scan': for (let i = 0; i < 3; i++) tone(out, 1200, 0.35, 'sine', 0.12, i * 0.22, 600); break;
    case 'chaos': tone(out, 110, 0.9, 'sawtooth', 0.12, 0, 55); tone(out, 165, 0.9, 'sawtooth', 0.08, 0.1, 82); noise(out, 0.8, 700, 0.1, 0, 0.3); break;
    case 'door': tone(out, 140, 0.35, 'sawtooth', 0.05, 0, 95); noise(out, 0.3, 500, 0.08, 0, 3); break;
    case 'squeak': case 'toy': tone(out, 900, 0.15, 'square', 0.1, 0, 1500); tone(out, 1500, 0.15, 'square', 0.08, 0.13, 800); break;
    case 'bell': for (let i = 0; i < 6; i++) { tone(out, 1318, 0.12, 'triangle', 0.18, i * 0.13); tone(out, 2636, 0.1, 'sine', 0.06, i * 0.13); } break;
    case 'horn': tone(out, 220, 1.0, 'sawtooth', 0.12, 0, undefined, 0.05); tone(out, 277, 1.0, 'sawtooth', 0.1, 0, undefined, 0.05); break;
    case 'chime': [988, 784, 659].forEach((f, i) => tone(out, f, 0.5, 'sine', 0.2, i * 0.25)); break;
    case 'piano': [523, 659, 784, 659, 523].forEach((f, i) => tone(out, f * (1 + Math.floor(Math.random() * 2) * 0.5), 0.35, 'triangle', 0.18, i * 0.14)); break;
    case 'whoosh': noise(out, 0.5, 1200, 0.2, 0, 0.4); break;
    case 'start': [392, 523, 659].forEach((f, i) => tone(out, f, 0.22, 'triangle', 0.2, i * 0.1)); break;
    case 'hunt': tone(out, 196, 0.6, 'sawtooth', 0.12); tone(out, 233, 0.6, 'sawtooth', 0.1, 0.05); noise(out, 0.6, 200, 0.2, 0, 0.5, 'lowpass'); break;
    case 'victory': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(out, f, 0.3, 'triangle', 0.2, i * 0.11)); break;
    case 'defeat': [392, 349, 311, 262].forEach((f, i) => tone(out, f, 0.4, 'triangle', 0.18, i * 0.2)); break;
    case 'paint': noise(out, 0.12, 2400 + Math.random() * 800, 0.06, 0, 1.5); break;
    case 'tick': tone(out, 1046, 0.08, 'square', 0.08); break;
  }
}

// ---------------- procedural music ----------------
type Track = 'lobby' | 'prep' | 'hunt' | 'results' | 'none';
const TRACKS: Record<Exclude<Track, 'none'>, { bpm: number; chords: number[][]; arp: boolean; drums: boolean; bass: boolean; wave: Wave }> = {
  lobby: { bpm: 96, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], arp: true, drums: false, bass: true, wave: 'triangle' },
  prep: { bpm: 112, chords: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 67]], arp: true, drums: true, bass: true, wave: 'square' },
  hunt: { bpm: 124, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], arp: true, drums: true, bass: true, wave: 'sawtooth' },
  results: { bpm: 100, chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], arp: true, drums: false, bass: true, wave: 'triangle' },
};
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
let current: Track = 'none';
let pendingTrack: Track | null = null;
let timer: number | null = null;
let step = 0;
let nextTime = 0;

function startTrack(track: Track) {
  pendingTrack = null;
  if (timer !== null) { clearInterval(timer); timer = null; }
  current = track;
  if (track === 'none') return;
  const c = ensure();
  if (!c || c.state !== 'running') { pendingTrack = track; return; }
  step = 0;
  nextTime = c.currentTime + 0.1;
  timer = window.setInterval(schedule, 50);
}

function schedule() {
  if (!ctx || current === 'none') return;
  const tr = TRACKS[current as Exclude<Track, 'none'>];
  const sixteenth = 60 / tr.bpm / 4;
  while (nextTime < ctx.currentTime + 0.25) {
    const at = nextTime - ctx.currentTime;
    const bar = Math.floor(step / 16) % tr.chords.length;
    const chord = tr.chords[bar];
    const s = step % 16;
    if (s === 0) for (const n of chord) tone(musicGain, midi(n), sixteenth * 15, 'sine', 0.05, at, undefined, 0.25);
    if (tr.bass && s % 4 === 0) tone(musicGain, midi(chord[0] - 24), sixteenth * 3, current === 'hunt' ? 'sawtooth' : 'triangle', 0.12, at);
    if (tr.arp && s % 2 === 0) {
      const n = chord[(s / 2) % chord.length] + (s >= 8 ? 12 : 0);
      tone(musicGain, midi(n), sixteenth * 1.6, tr.wave, tr.wave === 'sine' || tr.wave === 'triangle' ? 0.07 : 0.025, at);
    }
    if (tr.drums) {
      if (s % 8 === 0) tone(musicGain, 120, 0.15, 'sine', 0.3, at, 40);
      if (s % 8 === 4) noise(musicGain, 0.12, 1800, 0.1, at, 0.8);
      if (s % 2 === 1) noise(musicGain, 0.03, 8000, 0.04, at, 1, 'highpass');
    }
    nextTime += sixteenth;
    step++;
  }
}

export function playMusic(track: Track) {
  if (track === current && timer !== null) return;
  startTrack(track);
}
