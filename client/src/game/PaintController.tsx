// In-world painting: drag on your own Hueling to paint, drag elsewhere to orbit, tap anything to sample colour.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { PaintOp, RegionId } from '@shared/types';
import { PAINT_MAX_POINTS } from '@shared/constants';
import { useStore } from '../store/useStore';
import { cam } from '../controls/input';
import { registry, raycastTargets } from './registry';
import { sampleMapHit } from '../maps/buildMap';
import { paintFor } from '../characters/paint';
import { emit } from '../multiplayer/net';
import { canPaintNow, fill, nextGroup, regionAt } from './painting';
import { sfx } from '../audio/sound';
import { fx } from './fxBus';

const ray = new THREE.Raycaster();

export function PaintController() {
  const { camera, gl } = useThree();
  const paintMode = useStore((s) => s.paintMode);
  const drag = useRef<null | { mode: 'paint' | 'orbit'; x: number; y: number; region?: RegionId; g?: number; pts: number[]; lastSend: number; lastSound: number }>(null);

  useEffect(() => {
    if (!paintMode) return;
    const el = gl.domElement;
    const ndc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const myMeshes = () => registry.characters.get(useStore.getState().myId ?? '') ?? [];

    const flush = (final: boolean) => {
      const d = drag.current;
      if (!d || d.mode !== 'paint' || d.pts.length < 2) return;
      const s = useStore.getState();
      const op: PaintOp = { t: 's', g: d.g!, r: d.region!, c: s.color, sz: s.brush, pat: s.pattern, pts: d.pts.slice(0, PAINT_MAX_POINTS * 2) };
      paintFor(s.myId!).apply({ k: 'op', op });
      emit('paint', { k: 'op', op });
      // continue the next chunk from the last point so strokes stay connected
      d.pts = final ? [] : d.pts.slice(-2);
      d.lastSend = performance.now();
    };

    const sample = (e: PointerEvent) => {
      const s = useStore.getState();
      ray.setFromCamera(ndc(e), camera);
      const hit = ray.intersectObjects(raycastTargets(null), false)[0];
      if (!hit) return;
      const ud = hit.object.userData as { kind?: string; playerId?: string; ownerId?: string };
      let color: string | null = null;
      let pattern = s.pattern;
      if (ud.kind === 'map' && registry.map) {
        const res = sampleMapHit(registry.map, hit, s.room?.propColors ?? {});
        if (res) {
          if (s.matchTexture && res.pattern !== 'solid') { color = res.base; pattern = res.pattern; }
          else { color = res.flat; pattern = 'solid'; }
        }
      } else if ((ud.kind === 'player' || ud.kind === 'decoy' || ud.kind === 'statue') && hit.uv) {
        const id = ud.playerId ?? ud.ownerId!;
        color = paintFor(id).sample(hit.uv.x, hit.uv.y);
        pattern = 'solid';
      }
      if (color) {
        s.set({ color, pattern, tool: s.tool === 'eyedropper' ? 'brush' : s.tool });
        s.pushColor(color);
        s.toast(`Sampled ${color.toUpperCase()}${pattern !== 'solid' ? ` + ${pattern} pattern` : ''}`, 'good');
        sfx('pop');
      }
    };

    const down = (e: PointerEvent) => {
      if (!useStore.getState().paintMode) return;
      const s = useStore.getState();
      el.setPointerCapture?.(e.pointerId);
      if (e.button === 2 || e.button === 1) { drag.current = { mode: 'orbit', x: e.clientX, y: e.clientY, pts: [], lastSend: 0, lastSound: 0 }; return; }
      if (s.tool === 'eyedropper') { sample(e); return; }
      ray.setFromCamera(ndc(e), camera);
      const hit = ray.intersectObjects(myMeshes(), false)[0];
      if (hit && hit.uv && canPaintNow()) {
        const region = regionAt(hit.uv.x, hit.uv.y);
        if (s.tool === 'fill') { fill(region); return; }
        if (s.tool === 'fillall') { fill('all'); return; }
        drag.current = { mode: 'paint', x: e.clientX, y: e.clientY, region, g: nextGroup(), pts: [], lastSend: performance.now(), lastSound: 0 };
        addPoint(hit);
        s.pushColor(s.color);
        return;
      }
      if (hit && !canPaintNow()) s.toast('You can only paint during the preparation phase', 'info');
      drag.current = { mode: 'orbit', x: e.clientX, y: e.clientY, pts: [], lastSend: 0, lastSound: 0 };
    };

    const addPoint = (hit: THREE.Intersection) => {
      const d = drag.current!;
      if (!hit.uv) return;
      if (regionAt(hit.uv.x, hit.uv.y) !== d.region) return;
      d.pts.push(Math.round(hit.uv.x * 1023), Math.round(hit.uv.y * 1023));
      const now = performance.now();
      if (now - d.lastSound > 90) { d.lastSound = now; sfx('paint'); fx.emit({ kind: 'paint', p: [hit.point.x, hit.point.y, hit.point.z], color: useStore.getState().color }); }
    };

    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.mode === 'orbit') {
        cam.yaw -= (e.clientX - d.x) * 0.008;
        cam.pitch = THREE.MathUtils.clamp(cam.pitch + (e.clientY - d.y) * 0.006, -0.5, 1.2);
        d.x = e.clientX;
        d.y = e.clientY;
        return;
      }
      ray.setFromCamera(ndc(e), camera);
      const hit = ray.intersectObjects(myMeshes(), false)[0];
      if (hit) addPoint(hit);
      if (d.pts.length >= PAINT_MAX_POINTS * 2 - 2 || performance.now() - d.lastSend > 70) flush(false);
    };
    const up = () => {
      flush(true);
      drag.current = null;
    };
    const ctx = (e: Event) => e.preventDefault();
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('contextmenu', ctx);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.removeEventListener('contextmenu', ctx);
    };
  }, [paintMode, camera, gl]);

  return null;
}
