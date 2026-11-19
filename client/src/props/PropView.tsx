// A player (or decoy / statue / preview) transformed into a real 3D object, with a motion style
// derived from the registry (roll, tip, hop, waddle, slide, upright) and a transformation "pop".
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { PROPS } from '@shared/props/registry';
import { useStore } from '../store/useStore';
import { coloredModel, propMaterial } from './models';

const qOf = (quality: string) => (quality === 'low' ? 0.6 : quality === 'medium' ? 0.85 : 1);
const meshCache = new Map<string, Map<string, THREE.BufferGeometry>>();

function geometries(type: string, color: string, q: number) {
  const key = `${type}|${color}|${q}`;
  let g = meshCache.get(key);
  if (!g) {
    g = coloredModel(type, color, q) as Map<string, THREE.BufferGeometry>;
    meshCache.set(key, g);
  }
  return g;
}

export interface PropLive { opacity: number; tint: string | null; tintAmt: number }

interface Props {
  type: string;
  color?: string | null;
  scale?: number;
  /** Animate movement style from the object's own world motion. */
  animate?: boolean;
  onMeshes?: (m: THREE.Mesh[]) => void;
  userData?: Record<string, unknown>;
  opacity?: number;
}

export function PropView({ type, color, scale = 1, animate = true, onMeshes, userData, opacity = 1 }: Props) {
  const quality = useStore((s) => s.settings.quality);
  const t = PROPS[type];
  const main = color ?? t?.color ?? '#cccccc';
  const geos = useMemo(() => geometries(type, main, qOf(quality)), [type, main, quality]);
  const outer = useRef<THREE.Group>(null!);
  const inner = useRef<THREE.Group>(null!);
  const meshes = useRef<THREE.Mesh[]>([]);
  const st = useRef({ prev: new THREE.Vector3(), init: false, phase: 0, roll: 0, speed: 0, pop: 0 });
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const radius = t ? Math.max(0.04, t.size[1] / 2) * scale : 0.15;

  useEffect(() => {
    st.current.pop = 0; // play the transformation pop whenever the object changes
  }, [type]);
  useEffect(() => {
    const list = meshes.current.filter(Boolean);
    for (const m of list) m.userData = { ...m.userData, ...userData };
    onMeshes?.(list);
  }, [onMeshes, userData, geos]);

  const mats = useMemo(() => {
    const out = new Map<string, THREE.Material>();
    for (const kind of geos.keys()) {
      const base = propMaterial(kind as never, () => null, quality === 'low' ? 'low' : quality === 'medium' ? 'medium' : 'high');
      if (opacity < 1) {
        const m = base.clone();
        m.transparent = true;
        (m as THREE.MeshStandardMaterial).opacity = opacity;
        out.set(kind, m);
      } else out.set(kind, base);
    }
    return out;
  }, [geos, quality, opacity]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = st.current;
    // transformation pop: grow from small with a little overshoot and spin
    s.pop = Math.min(1, s.pop + dt * 3.2);
    const e = s.pop;
    const popScale = e >= 1 ? 1 : 1 + Math.sin(e * Math.PI) * 0.25 - (1 - e) * 0.75;
    outer.current.scale.setScalar(scale * Math.max(0.05, popScale));
    outer.current.rotation.y = (1 - e) * (1 - e) * 3;
    if (!animate || !t) return;
    // derive movement from our world position (works for local, remote and interpolated players)
    outer.current.getWorldPosition(tmp);
    if (!s.init) { s.prev.copy(tmp); s.init = true; }
    const dx = tmp.x - s.prev.x, dz = tmp.z - s.prev.z;
    const dist = Math.hypot(dx, dz);
    const airborne = tmp.y - s.prev.y;
    s.prev.copy(tmp);
    s.speed = THREE.MathUtils.lerp(s.speed, dist / Math.max(dt, 1e-3), Math.min(1, dt * 8));
    const moving = s.speed > 0.25;
    const amt = Math.min(1, s.speed / 3);
    s.phase += dt * (4 + s.speed * 4);
    const g = inner.current;
    g.position.set(0, 0, 0);
    g.rotation.set(0, 0, 0);
    switch (t.move.style) {
      case 'roll':
        s.roll += dist / radius;
        g.position.y = radius;
        g.rotation.x = s.roll;
        g.position.y -= radius;
        break;
      case 'tip':
        if (moving) { g.rotation.z = Math.sin(s.phase) * 0.14 * amt; g.position.y = Math.abs(Math.sin(s.phase)) * 0.035; }
        break;
      case 'hop':
        if (moving) { g.position.y = Math.abs(Math.sin(s.phase * 1.2)) * 0.14 * Math.min(1, amt * 1.5); g.rotation.x = -Math.sin(s.phase * 1.2) * 0.12; }
        break;
      case 'waddle':
        if (moving) { g.rotation.z = Math.sin(s.phase) * 0.17 * amt; g.rotation.y = Math.sin(s.phase) * 0.12 * amt; }
        break;
      case 'slide':
        if (moving) g.rotation.y = Math.sin(s.phase * 0.7) * 0.06;
        break;
      default: // upright
        if (moving) { g.rotation.x = 0.08 * amt; g.rotation.z = Math.sin(s.phase * 1.4) * 0.06 * amt; g.position.y = Math.abs(Math.sin(s.phase * 1.4)) * 0.02; }
    }
    if (airborne > 0.002) g.rotation.x -= 0.15;
  });

  // roll pivots around the object's centre
  const pivotY = t?.move.style === 'roll' ? radius / scale : 0;
  let i = 0;
  return (
    <group ref={outer}>
      <group position={[0, pivotY, 0]}>
        <group ref={inner}>
          <group position={[0, -pivotY, 0]}>
            {[...geos.entries()].map(([kind, geo]) => {
              const idx = i++;
              return (
                <mesh key={kind} ref={(m) => { if (m) meshes.current[idx] = m; }} geometry={geo} material={mats.get(kind)} castShadow={kind !== 'glass'} receiveShadow />
              );
            })}
          </group>
        </group>
      </group>
    </group>
  );
}
