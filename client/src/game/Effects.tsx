import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Vec3 } from '@shared/types';
import { useStore } from '../store/useStore';
import { fx } from './fxBus';
import { sampleRemote } from '../multiplayer/net';
import { registry } from './registry';

// ---------- pooled particles ----------
const MAX = 400;
const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];

function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const pool = useMemo(() => ({
    pos: new Float32Array(MAX * 3), vel: new Float32Array(MAX * 3), life: new Float32Array(MAX), size: new Float32Array(MAX), next: 0,
  }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    for (let i = 0; i < MAX; i++) mesh.current.setColorAt(i, color.set('#ffffff'));
    const burst = (p: Vec3, n: number, speed: number, colors: string[], size: number, up = 2) => {
      for (let k = 0; k < n; k++) {
        const i = pool.next;
        pool.next = (pool.next + 1) % MAX;
        pool.pos.set(p, i * 3);
        const a = Math.random() * Math.PI * 2, e = Math.random() * speed;
        pool.vel[i * 3] = Math.cos(a) * e;
        pool.vel[i * 3 + 1] = up + Math.random() * speed;
        pool.vel[i * 3 + 2] = Math.sin(a) * e;
        pool.life[i] = 0.8 + Math.random() * 0.6;
        pool.size[i] = size * (0.6 + Math.random() * 0.8);
        mesh.current.setColorAt(i, color.set(colors[Math.floor(Math.random() * colors.length)]));
      }
      if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    };
    const posOf = (id: string): Vec3 | null => {
      if (id === useStore.getState().myId) return registry.local.p;
      return sampleRemote(id)?.p ?? null;
    };
    return fx.on((e) => {
      if (e.kind === 'poke') burst(e.p, 8, 1.5, ['#ffffff', '#e2e8f0'], 0.06, 1);
      if (e.kind === 'caught') { const p = posOf(e.id); if (p) burst([p[0], p[1] + 0.6, p[2]], 70, 4, COLORS, 0.09, 3); }
      if (e.kind === 'decoy') {
        const d = useStore.getState().decoys.find((x) => x.id === e.id);
        if (d) burst([d.p[0], d.p[1] + 0.5, d.p[2]], 40, 2.5, ['#e2e8f0', '#cbd5e1', '#94a3b8'], 0.14, 1.5);
      }
      if (e.kind === 'paint') burst(e.p, 3, 0.6, [e.color], 0.04, 0.5);
    });
  }, [pool, color]);

  useFrame((_, dt) => {
    let alive = 0;
    for (let i = 0; i < MAX; i++) {
      if (pool.life[i] <= 0) { dummy.scale.setScalar(0); dummy.updateMatrix(); mesh.current.setMatrixAt(i, dummy.matrix); continue; }
      alive++;
      pool.life[i] -= dt;
      pool.vel[i * 3 + 1] -= 9 * dt;
      for (let a = 0; a < 3; a++) pool.pos[i * 3 + a] += pool.vel[i * 3 + a] * dt;
      if (pool.pos[i * 3 + 1] < 0.02) { pool.pos[i * 3 + 1] = 0.02; pool.vel[i * 3 + 1] *= -0.3; pool.vel[i * 3] *= 0.6; pool.vel[i * 3 + 2] *= 0.6; }
      dummy.position.set(pool.pos[i * 3], pool.pos[i * 3 + 1], pool.pos[i * 3 + 2]);
      dummy.rotation.set(pool.life[i] * 7, pool.life[i] * 5, 0);
      dummy.scale.setScalar(pool.size[i] * Math.min(1, pool.life[i] * 2));
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.visible = alive > 0;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, MAX]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

// ---------- footprints ----------
const FP_MAX = 400;
function Footprints() {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const fp = useStore((s) => s.effects.footprints);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => { const g = new THREE.CircleGeometry(0.1, 10); g.rotateX(-Math.PI / 2); g.scale(1, 1, 1.7); return g; }, []);
  useEffect(() => {
    const m = mesh.current;
    let n = 0;
    for (const p of fp?.prints ?? []) {
      for (const side of [-1, 1]) {
        if (n >= FP_MAX) break;
        dummy.position.set(p.p[0] + Math.cos(p.r) * side * 0.12, p.p[1] + 0.03, p.p[2] - Math.sin(p.r) * side * 0.12);
        dummy.rotation.set(0, p.r, 0);
        dummy.scale.setScalar(1 - Math.min(0.6, p.age / 30000));
        dummy.updateMatrix();
        m.setMatrixAt(n++, dummy.matrix);
      }
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  }, [fp, dummy]);
  useFrame(() => {
    const on = !!fp && fp.until > Date.now();
    mesh.current.visible = on;
    (mesh.current.material as THREE.MeshBasicMaterial).opacity = on ? 0.55 + Math.sin(Date.now() / 200) * 0.2 : 0;
  });
  return (
    <instancedMesh ref={mesh} args={[geo, undefined, FP_MAX]} frustumCulled={false}>
      <meshBasicMaterial color="#f43f5e" transparent depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

// ---------- scanner zones ----------
function ScannerZones() {
  const sc = useStore((s) => s.effects.scanner);
  const group = useRef<THREE.Group>(null!);
  useFrame(() => {
    const on = !!sc && sc.until > Date.now();
    group.current.visible = on;
    const t = Date.now() / 1000;
    group.current.children.forEach((c, i) => {
      const s = 1 + ((t * 0.8 + i * 0.3) % 1) * 0.35;
      c.scale.set(s, 1, s);
    });
  });
  return (
    <group ref={group}>
      {(sc?.zones ?? []).map((z, i) => (
        <group key={i} position={[z.p[0], z.p[1] + 0.05, z.p[2]]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[z.r - 0.15, z.r, 40]} />
            <meshBasicMaterial color="#facc15" transparent opacity={0.85} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[z.r, 40]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.16} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 2.5, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 5, 6]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.4} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Effects() {
  return (
    <>
      <Particles />
      <Footprints />
      <ScannerZones />
    </>
  );
}
