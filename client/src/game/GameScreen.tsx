import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MapDef } from '@shared/maps';
import { MAP_LOADERS } from '@shared/maps';
import { MAP_META } from '@shared/constants';
import { useStore, useTouchUI } from '../store/useStore';
import { MapScene } from '../maps/MapScene';
import { LocalPlayer, isSpectating } from './LocalPlayer';
import { RemotePlayers, DecoysAndStatues } from './RemotePlayers';
import { Effects } from './Effects';
import { PaintController } from './PaintController';
import { HUD, activateAbility } from './HUD';
import { installInput, onKey, requestLock, exitLock, input } from '../controls/input';
import { registry } from './registry';
import { Spinner } from '../ui/kit';
import { toggleMic } from '../ui/Voice';

const mapCache = new Map<string, MapDef>();

function FpsMeter() {
  const frames = useRef(0);
  const last = useRef(performance.now());
  useFrame(() => {
    frames.current++;
    const now = performance.now();
    if (now - last.current > 1000) {
      useStore.getState().set({ fps: Math.round((frames.current * 1000) / (now - last.current)) });
      frames.current = 0;
      last.current = now;
    }
  });
  return null;
}

export function GameScreen() {
  const mapId = useStore((s) => s.room?.settings.mapId ?? 'house');
  const quality = useStore((s) => s.settings.quality);
  const [def, setDef] = useState<MapDef | null>(mapCache.get(mapId) ?? null);
  const wrap = useRef<HTMLDivElement>(null);
  const touch = useTouchUI();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    installInput();
    let live = true;
    if (mapCache.has(mapId)) setDef(mapCache.get(mapId)!);
    else {
      setDef(null);
      MAP_LOADERS[mapId]().then((d) => { mapCache.set(mapId, d); if (live) setDef(d); });
    }
    return () => { live = false; };
  }, [mapId]);

  useEffect(() => {
    const h = () => setLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', h);
    return () => { document.removeEventListener('pointerlockchange', h); exitLock(); };
  }, []);

  useEffect(() => onKey((code) => {
    const s = useStore.getState();
    const room = s.room;
    if (!room) return;
    const me = room.players.find((p) => p.id === s.myId);
    if (code === 'Escape') {
      if (s.paintMode) s.set({ paintMode: false });
      else if (s.quickMenu !== 'none') s.set({ quickMenu: 'none' });
      else s.set({ pauseOpen: !s.pauseOpen });
      return;
    }
    if (code === 'KeyP' && me?.team === 'hider' && room.phase === 'prep') {
      const next = !s.paintMode;
      if (next) exitLock();
      s.set({ paintMode: next });
    }
    if (code.startsWith('Digit')) {
      const i = Number(code.slice(5)) - 1;
      const a = s.abilities[i];
      if (a) activateAbility(a.id);
    }
    if (code === 'KeyV' && s.voice.on) void toggleMic();
    if (code === 'KeyT') s.set({ quickMenu: s.quickMenu === 'chat' ? 'none' : 'chat' });
    if (code === 'KeyG') s.set({ quickMenu: s.quickMenu === 'emote' ? 'none' : 'emote' });
    if (code === 'KeyC' && me?.team === 'hider') s.set({ quickMenu: s.quickMenu === 'pose' ? 'none' : 'pose' });
    if (code === 'KeyQ' && isSpectating(me, room.settings.mode)) s.set({ spectateIdx: s.spectateIdx + 1 });
  }), []);

  const onCanvasClick = (e: React.MouseEvent) => {
    // only grab the pointer when the 3D view itself is clicked, never via HUD buttons
    if (!(e.target instanceof HTMLCanvasElement)) return;
    const s = useStore.getState();
    if (touch || s.paintMode || s.pauseOpen || s.room?.phase === 'results') return;
    if (wrap.current && !document.pointerLockElement) requestLock(wrap.current.querySelector('canvas')!);
  };

  const paintMode = useStore((s) => s.paintMode);
  const pauseOpen = useStore((s) => s.pauseOpen);
  const phase = useStore((s) => s.room?.phase);

  useEffect(() => { if (paintMode || pauseOpen) exitLock(); }, [paintMode, pauseOpen]);
  useEffect(() => () => { registry.characters.clear(); registry.extras.clear(); input.keys.clear(); }, []);

  const hi = quality === 'high';
  return (
    <div ref={wrap} className="fixed inset-0 bg-black" onClick={onCanvasClick}>
      <Canvas
        shadows={hi}
        flat
        dpr={hi ? [1, 1.75] : [0.7, 1.1]}
        gl={{ antialias: hi, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
        camera={{ fov: 62, near: 0.08, far: 220, position: [0, 6, 10] }}
        onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFSoftShadowMap; (window as unknown as { __hueRenderInfo: () => unknown }).__hueRenderInfo = () => ({ ...gl.info.render, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures }); }}
      >
        {def && (
          <>
            <MapScene def={def} />
            <LocalPlayer def={def} />
            <RemotePlayers />
            <DecoysAndStatues />
            <Effects />
            <PaintController />
          </>
        )}
        <FpsMeter />
      </Canvas>
      {!def && (
        <div className="absolute inset-0 grid place-items-center game-bg">
          <div className="flex flex-col items-center gap-3 text-white"><Spinner /><span className="font-display text-xl font-bold">Loading {MAP_META[mapId].name}...</span></div>
        </div>
      )}
      <HUD def={def} />
      {!touch && !locked && !paintMode && !pauseOpen && phase !== 'results' && phase !== 'assign' && def && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-sm font-bold text-white">
          Click to control the camera · Esc to release
        </div>
      )}
    </div>
  );
}
