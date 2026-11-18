// Paint actions shared by the in-world controller and the paint panel UI.
import type { PaintMsg, PaintOp, RegionId } from '@shared/types';
import { REGIONS, REGION_IDS } from '@shared/constants';
import { useStore } from '../store/useStore';
import { emit } from '../multiplayer/net';
import { paintFor, savePreset, loadPreset } from '../characters/paint';
import { sfx } from '../audio/sound';

let groupCounter = Math.floor(Math.random() * 1e6);
export const nextGroup = () => ++groupCounter;

export function canPaintNow(): boolean {
  const s = useStore.getState();
  const me = s.room?.players.find((p) => p.id === s.myId);
  return !!me && me.team === 'hider' && s.room?.phase === 'prep';
}

export function sendPaint(msg: PaintMsg) {
  const s = useStore.getState();
  if (!s.myId || !canPaintNow()) return;
  paintFor(s.myId).apply(msg);
  emit('paint', msg);
}

export function regionAt(u: number, v: number): RegionId {
  for (const r of REGION_IDS) {
    const [u0, v0, u1, v1] = REGIONS[r].rect;
    if (u >= u0 && u <= u1 && v >= v0 && v <= v1) return r;
  }
  return 'body';
}

export function fill(region: RegionId | 'all') {
  const s = useStore.getState();
  sendPaint({ k: 'op', op: { t: 'f', g: nextGroup(), r: region, c: s.color, pat: s.pattern } });
  s.pushColor(s.color);
  sfx('paint');
}
export const undo = () => { sendPaint({ k: 'undo' }); sfx('click'); };
export const redo = () => { sendPaint({ k: 'redo' }); sfx('click'); };
export const clearPaint = () => { sendPaint({ k: 'op', op: { t: 'x', g: nextGroup() } }); sfx('whoosh'); };

export function savePresetNow() {
  const s = useStore.getState();
  if (!s.myId) return;
  const ops = paintFor(s.myId).ops;
  if (!ops.length) return s.toast('Paint something first!', 'bad');
  savePreset(ops.slice(-1500) as PaintOp[]);
  s.toast('Camouflage saved for Quick Disguise!', 'good');
}
export function applyPresetNow() {
  const ops = loadPreset();
  const s = useStore.getState();
  if (!ops) return s.toast('No saved preset yet', 'bad');
  sendPaint({ k: 'replace', ops });
}
