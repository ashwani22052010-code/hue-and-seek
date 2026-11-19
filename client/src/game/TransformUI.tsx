// HUD for object transformation: current form, target preview, TRANSFORM / cancel / change back.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PROPS } from '@shared/props/registry';
import { useStore } from '../store/useStore';
import { PropView } from '../props/PropView';
import { cancelTarget, doRevert, doTransform } from './transform';

function Spin({ type, color, scale }: { type: string; color?: string | null; scale?: number }) {
  const g = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { g.current.rotation.y += dt * 1.2; });
  const t = PROPS[type];
  const h = t ? Math.max(t.size[0], t.size[1], t.size[2]) * (scale ?? 1) : 0.5;
  const k = 0.9 / Math.max(0.15, h);
  return (
    <group ref={g} scale={k} position={[0, -0.42, 0]}>
      <PropView type={type} color={color} scale={scale} animate={false} />
    </group>
  );
}

/** Small spinning 3D preview of an object. */
export function PropPreview({ type, color, scale, className = '' }: { type: string; color?: string | null; scale?: number; className?: string }) {
  return (
    <div className={className}>
      <Canvas flat dpr={[1, 1.5]} camera={{ position: [0, 0.35, 1.6], fov: 40 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={1.0} />
        <directionalLight position={[2, 3, 2]} intensity={1.6} />
        <Spin type={type} color={color} scale={scale} />
      </Canvas>
    </div>
  );
}

export function TransformPanel({ touch, extra }: { touch: boolean; extra?: ReactNode }) {
  const target = useStore((s) => s.propTarget);
  const locked = useStore((s) => s.propLocked);
  const readyAt = useStore((s) => s.transformReadyAt);
  const me = useStore((s) => s.room?.players.find((p) => p.id === s.myId));
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(id); }, []);
  const cd = Math.max(0, readyAt - now);
  const current = me?.disguise ? PROPS[me.disguise] : null;
  const tType = target ? PROPS[target.type] : null;

  return (
    <div className="pointer-events-auto flex w-[230px] flex-col gap-2 rounded-3xl bg-white/90 p-2.5 text-indigo-950 shadow-xl backdrop-blur" onPointerDown={(e) => e.stopPropagation()} data-testid="transform-panel">
      <div className="flex items-center gap-2 text-xs font-bold">
        <span className="min-w-0 truncate rounded-full bg-sky-100 px-2 py-0.5">You are: {current ? `${current.icon} ${current.name}` : '🙂 Hueling'}</span>
        {extra && <span className="ml-auto shrink-0">{extra}</span>}
      </div>
      {target && tType ? (
        <div className={`flex items-center gap-2 rounded-2xl p-1.5 ${target.valid ? 'bg-emerald-50' : 'bg-rose-50'}`}>
          <PropPreview type={target.type} className="h-16 w-16 shrink-0 rounded-xl bg-white" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold" data-testid="target-name">{tType.icon} {tType.name}</div>
            <div className={`text-[11px] font-bold ${target.valid ? 'text-emerald-700' : 'text-rose-600'}`}>{target.valid ? (locked ? 'Selected' : 'In range') : target.reason}</div>
          </div>
          {locked && <button aria-label="Cancel target" onClick={cancelTarget} className="grid h-7 w-7 place-items-center rounded-full bg-indigo-100 text-sm font-bold">✕</button>}
        </div>
      ) : (
        <div className="rounded-2xl bg-indigo-50 p-2 text-[11px] font-bold opacity-80">{touch ? 'Tap an object (or aim the reticle) to select it' : 'Aim at an object to select it'}</div>
      )}
      <div className="flex gap-1.5">
        <button
          data-testid="transform-btn"
          disabled={!target?.valid || cd > 0}
          onClick={() => void doTransform()}
          className="relative flex-1 overflow-hidden rounded-2xl bg-sky-500 py-2.5 font-display text-base font-bold text-white shadow-[0_4px_0_#0369a1] active:translate-y-0.5 disabled:opacity-50"
        >
          {cd > 0 && <span className="absolute inset-y-0 left-0 bg-black/25" style={{ width: `${Math.min(100, (cd / 6000) * 100)}%` }} />}
          <span className="relative">✨ TRANSFORM {!touch && <span className="rounded bg-white/30 px-1 text-xs">R</span>}</span>
        </button>
        {current && (
          <button data-testid="revert-btn" disabled={cd > 0} onClick={() => void doRevert()} title="Change back (X)" className="rounded-2xl bg-indigo-100 px-3 text-lg font-bold disabled:opacity-50">↩</button>
        )}
      </div>
      {cd > 0 && <div className="text-center text-[10px] font-bold opacity-60">Recharging {(cd / 1000).toFixed(1)}s</div>}
    </div>
  );
}

/** Centre reticle for transform targeting (green when a valid object is under it). */
export function TransformReticle() {
  const target = useStore((s) => s.propTarget);
  const locked = useStore((s) => s.propLocked);
  if (locked) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
      <div className={`h-6 w-6 rounded-full border-[3px] transition ${target?.valid ? 'scale-125 border-emerald-400 bg-emerald-300/30' : target ? 'border-rose-300' : 'border-white/80'}`} />
    </div>
  );
}
