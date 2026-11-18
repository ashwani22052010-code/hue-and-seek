import { useEffect, useRef } from 'react';
import type { MapDef } from '@shared/maps';
import { propAABB } from '@shared/maps';
import { useStore } from '../store/useStore';
import { registry } from './registry';
import { sampleRemote } from '../multiplayer/net';

/** Top-down minimap: static layout pre-rendered once, dynamic markers redrawn ~8x per second. */
export function Minimap({ def, size = 150 }: { def: MapDef; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const base = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const b = def.bounds;
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    const scale = size / Math.max(w, d);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = def.floor.c;
    ctx.fillRect(0, 0, size, size);
    const sorted = def.props.map((p, i) => ({ p, i, bb: propAABB(p) })).filter((x) => x.p.solid !== false || x.p.d[1] < 0.05).sort((a, b) => a.bb.max[1] - b.bb.max[1]);
    for (const { p, bb } of sorted) {
      ctx.fillStyle = p.c;
      ctx.globalAlpha = p.solid === false ? 0.6 : 1;
      ctx.fillRect((bb.min[0] - b.minX) * scale, (bb.min[2] - b.minZ) * scale, Math.max(1, (bb.max[0] - bb.min[0]) * scale), Math.max(1, (bb.max[2] - bb.min[2]) * scale));
    }
    ctx.globalAlpha = 1;
    base.current = c;
  }, [def, size]);

  useEffect(() => {
    const id = setInterval(() => {
      const c = ref.current, bc = base.current;
      if (!c || !bc) return;
      const ctx = c.getContext('2d')!;
      const s = useStore.getState();
      const b = def.bounds;
      const scale = size / Math.max(b.maxX - b.minX, b.maxZ - b.minZ);
      const X = (x: number) => (x - b.minX) * scale, Z = (z: number) => (z - b.minZ) * scale;
      ctx.drawImage(bc, 0, 0);
      const room = s.room;
      const me = room?.players.find((p) => p.id === s.myId);
      // teammates only (hiders see hiders, seekers see seekers)
      for (const p of room?.players ?? []) {
        if (p.id === s.myId || !me || p.team !== me.team || p.caught) continue;
        const r = sampleRemote(p.id);
        if (!r) continue;
        ctx.fillStyle = p.team === 'seeker' ? '#ef4444' : '#22c55e';
        ctx.beginPath();
        ctx.arc(X(r.p[0]), Z(r.p[2]), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      const sc = s.effects.scanner;
      if (sc && sc.until > Date.now()) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        for (const z of sc.zones) { ctx.beginPath(); ctx.arc(X(z.p[0]), Z(z.p[2]), z.r * scale, 0, Math.PI * 2); ctx.stroke(); }
      }
      for (const st of s.statues) {
        if (st.ownerId !== s.myId) continue;
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(X(st.p[0]) - 3, Z(st.p[2]) - 3, 6, 6);
      }
      // me
      const lp = registry.local.p;
      ctx.save();
      ctx.translate(X(lp[0]), Z(lp[2]));
      ctx.rotate(-registry.local.yaw + Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }, 125);
    return () => clearInterval(id);
  }, [def, size]);

  return <canvas ref={ref} width={size} height={size} className="rounded-2xl border-4 border-white/80 shadow-lg" style={{ width: size, height: size }} />;
}
