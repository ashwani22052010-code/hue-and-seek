// Object transformation (prop hunt): targeting + actions. The server re-validates everything.
import * as THREE from 'three';
import type { Vec3 } from '@shared/types';
import { TRANSFORM_RANGE, TRANSFORM_COOLDOWN_HUNT_MS, TRANSFORM_COOLDOWN_PREP_MS, canTransformStyle } from '@shared/constants';
import { PROPS, propCollider } from '@shared/props/registry';
import { SHAPES } from '@shared/constants';
import { hasLineOfSight } from '@shared/game-rules/physics';
import { useStore } from '../store/useStore';
import { registry } from './registry';
import { itemAtHit } from '../maps/buildMap';
import { request } from '../multiplayer/net';
import { sfx } from '../audio/sound';
import { fx } from './fxBus';

export interface PropTarget {
  index: number;
  type: string;
  valid: boolean;
  reason: string | null;
}

const ray = new THREE.Raycaster();

/** Can the local player use transformation right now? */
export function transformEnabled(): boolean {
  const s = useStore.getState();
  const room = s.room;
  const me = room?.players.find((p) => p.id === s.myId);
  if (!room || !me || me.team !== 'hider' || me.caught) return false;
  if (!canTransformStyle(room.settings.hideStyle)) return false;
  return room.phase === 'prep' || room.phase === 'hunt';
}

function eyePos(): Vec3 {
  const s = useStore.getState();
  const me = s.room?.players.find((p) => p.id === s.myId);
  const h = me?.disguise ? propCollider(me.disguise, me.dLook?.s ?? 1).height : SHAPES[me?.look.shape ?? 'normal'].height;
  const p = registry.local.p;
  return [p[0], p[1] + Math.max(0.15, h * 0.8), p[2]];
}

/** Evaluate a possible target under the given screen point (NDC). Mirrors the server's rules. */
export function targetUnder(camera: THREE.Camera, ndc: THREE.Vector2): PropTarget | null {
  ray.setFromCamera(ndc, camera);
  ray.far = 30;
  const hit = ray.intersectObjects(registry.mapMeshes, false)[0];
  if (!hit) return null;
  const index = itemAtHit(hit);
  if (index === undefined || !registry.map) return null;
  const it = registry.map.items[index];
  const type = PROPS[it.t];
  if (!type) return null;
  if (!type.transformable) return { index, type: it.t, valid: false, reason: "Can't transform into this" };
  const s = it.s ?? 1;
  const center: Vec3 = [it.p[0], it.p[1] + (type.size[1] * s) / 2, it.p[2]];
  const eye = eyePos();
  const reach = Math.max(type.size[0], type.size[2]) * s * 0.5;
  const d = Math.hypot(center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]);
  if (d > TRANSFORM_RANGE + reach) return { index, type: it.t, valid: false, reason: 'Too far - get closer' };
  if (registry.world && !hasLineOfSight(registry.world, eye, center, registry.disabledGroups, reach + 0.25)) return { index, type: it.t, valid: false, reason: 'Blocked by a wall' };
  return { index, type: it.t, valid: true, reason: null };
}

export function setTarget(t: PropTarget | null, lock = false) {
  const s = useStore.getState();
  const cur = s.propTarget;
  if (s.propLocked && !lock && t?.index !== cur?.index) return; // a tapped/selected target stays until cancelled
  if (cur?.index === t?.index && cur?.valid === t?.valid && s.propLocked === (lock || s.propLocked)) return;
  s.set({ propTarget: t, propLocked: lock ? !!t : s.propLocked && !!t });
}

export function cancelTarget() {
  useStore.getState().set({ propTarget: null, propLocked: false });
  sfx('click');
}

export async function doTransform() {
  const s = useStore.getState();
  const t = s.propTarget;
  if (!transformEnabled()) return;
  if (!t) { s.toast('Aim at an object first', 'info'); sfx('error'); return; }
  if (!t.valid) { s.toast(t.reason ?? "Can't transform", 'bad'); sfx('error'); return; }
  if (Date.now() < s.transformReadyAt) { s.toast('Transform is recharging...', 'info'); sfx('error'); return; }
  const r = await request('transform', { item: t.index });
  if (!r.ok) { s.toast(r.error ?? 'Transform failed', 'bad'); sfx('error'); return; }
  const prep = s.room?.phase === 'prep';
  s.set({ transformReadyAt: Date.now() + (prep ? TRANSFORM_COOLDOWN_PREP_MS : TRANSFORM_COOLDOWN_HUNT_MS), propTarget: null, propLocked: false });
}

export async function doRevert() {
  const s = useStore.getState();
  if (!transformEnabled()) return;
  if (Date.now() < s.transformReadyAt) { s.toast('Transform is recharging...', 'info'); sfx('error'); return; }
  const r = await request('transform', { revert: true });
  if (!r.ok) { s.toast(r.error ?? 'Could not change back', 'bad'); sfx('error'); return; }
  const prep = s.room?.phase === 'prep';
  s.set({ transformReadyAt: Date.now() + (prep ? TRANSFORM_COOLDOWN_PREP_MS : TRANSFORM_COOLDOWN_HUNT_MS) });
}

/** Called for every 'transform' event: sound + sparkle where it happened. */
export function onTransformEvent(p: Vec3) {
  sfx('transform', p);
  fx.emit({ kind: 'poof', p: [p[0], p[1] + 0.4, p[2]] });
}
