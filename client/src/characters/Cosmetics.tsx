// Cosmetic items built from primitives (original designs). Purely visual: no gameplay effect.
import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Cosmetics } from '@shared/types';
import { EYE_Y } from './geometry';

function Hat({ id }: { id: string }) {
  const prop = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (prop.current) prop.current.rotation.y += dt * 14; });
  switch (id) {
    case 'hat_cap':
      return (
        <group position={[0, 0.93, 0]}>
          <mesh scale={[1, 0.55, 1]}><sphereGeometry args={[0.27, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshLambertMaterial color="#ef4444" /></mesh>
          <mesh position={[0, 0.01, 0.2]} scale={[1, 0.15, 1]}><cylinderGeometry args={[0.2, 0.2, 0.1, 16, 1, false, -Math.PI / 2, Math.PI]} /><meshLambertMaterial color="#b91c1c" /></mesh>
        </group>
      );
    case 'hat_beanie':
      return (
        <group position={[0, 0.9, 0]}>
          <mesh scale={[1, 0.75, 1]}><sphereGeometry args={[0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshLambertMaterial color="#0ea5e9" /></mesh>
          <mesh position={[0, 0.23, 0]}><sphereGeometry args={[0.08, 10, 8]} /><meshLambertMaterial color="#f8fafc" /></mesh>
        </group>
      );
    case 'hat_party':
      return (
        <group position={[0, 1.0, 0]} rotation={[0, 0, 0.12]}>
          <mesh position={[0, 0.17, 0]}><coneGeometry args={[0.15, 0.36, 14]} /><meshLambertMaterial color="#f472b6" /></mesh>
          <mesh position={[0, 0.37, 0]}><sphereGeometry args={[0.05, 8, 6]} /><meshLambertMaterial color="#facc15" /></mesh>
        </group>
      );
    case 'hat_propeller':
      return (
        <group position={[0, 0.93, 0]}>
          <mesh scale={[1, 0.5, 1]}><sphereGeometry args={[0.26, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshLambertMaterial color="#facc15" /></mesh>
          <mesh position={[0, 0.17, 0]}><cylinderGeometry args={[0.015, 0.015, 0.1, 6]} /><meshLambertMaterial color="#334155" /></mesh>
          <group ref={prop} position={[0, 0.22, 0]}>
            <mesh><boxGeometry args={[0.42, 0.015, 0.07]} /><meshLambertMaterial color="#ef4444" /></mesh>
            <mesh rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[0.42, 0.015, 0.07]} /><meshLambertMaterial color="#3b82f6" /></mesh>
          </group>
        </group>
      );
    case 'hat_tophat':
      return (
        <group position={[0, 0.98, 0]}>
          <mesh><cylinderGeometry args={[0.3, 0.3, 0.03, 20]} /><meshLambertMaterial color="#111827" /></mesh>
          <mesh position={[0, 0.17, 0]}><cylinderGeometry args={[0.17, 0.18, 0.32, 20]} /><meshLambertMaterial color="#111827" /></mesh>
          <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.185, 0.185, 0.06, 20]} /><meshLambertMaterial color="#dc2626" /></mesh>
        </group>
      );
    case 'hat_bunny':
      return (
        <group position={[0, 0.95, 0]}>
          {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, 0.2, -0.02]} rotation={[0, 0, x * 1.5]} scale={[0.35, 1, 0.2]}><sphereGeometry args={[0.2, 12, 10]} /><meshLambertMaterial color="#fdf2f8" /></mesh>
          ))}
        </group>
      );
    case 'hat_chef':
      return (
        <group position={[0, 0.96, 0]}>
          <mesh position={[0, 0.07, 0]}><cylinderGeometry args={[0.18, 0.2, 0.16, 18]} /><meshLambertMaterial color="#ffffff" /></mesh>
          <mesh position={[0, 0.22, 0]} scale={[1, 0.7, 1]}><sphereGeometry args={[0.24, 14, 10]} /><meshLambertMaterial color="#ffffff" /></mesh>
        </group>
      );
    case 'hat_crown':
      return (
        <group position={[0, 0.98, 0]}>
          <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.19, 0.2, 0.12, 18, 1, true]} /><meshLambertMaterial color="#f59e0b" side={THREE.DoubleSide} emissive="#7c2d12" /></mesh>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i / 6) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.sin(a) * 0.19, 0.17, Math.cos(a) * 0.19]}><coneGeometry args={[0.04, 0.11, 6]} /><meshLambertMaterial color="#fbbf24" /></mesh>
            );
          })}
          <mesh position={[0, 0.07, 0.2]}><sphereGeometry args={[0.035, 8, 6]} /><meshLambertMaterial color="#ef4444" /></mesh>
        </group>
      );
    default:
      return null;
  }
}

function Glasses({ id }: { id: string }) {
  const z = 0.37;
  switch (id) {
    case 'gl_round':
      return (
        <group position={[0, EYE_Y, z]}>
          {[0.13, -0.13].map((x) => (
            <mesh key={x} position={[x, 0, 0]}><torusGeometry args={[0.1, 0.014, 6, 18]} /><meshLambertMaterial color="#1f2937" /></mesh>
          ))}
          <mesh><boxGeometry args={[0.07, 0.015, 0.015]} /><meshLambertMaterial color="#1f2937" /></mesh>
        </group>
      );
    case 'gl_shades':
      return (
        <group position={[0, EYE_Y, z]}>
          {[0.13, -0.13].map((x) => (
            <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[0.2, 0.12, 0.03]} /><meshLambertMaterial color="#0f172a" /></mesh>
          ))}
          <mesh><boxGeometry args={[0.1, 0.025, 0.02]} /><meshLambertMaterial color="#0f172a" /></mesh>
        </group>
      );
    case 'gl_star':
      return (
        <group position={[0, EYE_Y, z]}>
          {[0.13, -0.13].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.25, 1]}><cylinderGeometry args={[0.12, 0.12, 0.1, 5]} /><meshLambertMaterial color="#facc15" /></mesh>
          ))}
        </group>
      );
    case 'gl_monocle':
      return (
        <group position={[-0.13, EYE_Y, z]}>
          <mesh><torusGeometry args={[0.105, 0.016, 6, 18]} /><meshLambertMaterial color="#d97706" /></mesh>
          <mesh position={[-0.08, -0.18, -0.03]} rotation={[0, 0, 0.4]}><cylinderGeometry args={[0.006, 0.006, 0.3, 4]} /><meshLambertMaterial color="#d97706" /></mesh>
        </group>
      );
    default:
      return null;
  }
}

function Accessory({ id }: { id: string }) {
  switch (id) {
    case 'ac_scarf':
      return (
        <group position={[0, 0.42, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.8]}><torusGeometry args={[0.34, 0.06, 8, 24]} /><meshLambertMaterial color="#dc2626" /></mesh>
          <mesh position={[0.15, -0.15, 0.3]} rotation={[0.2, 0, 0.1]}><boxGeometry args={[0.1, 0.25, 0.04]} /><meshLambertMaterial color="#dc2626" /></mesh>
        </group>
      );
    case 'ac_bowtie':
      return (
        <group position={[0, 0.45, 0.35]}>
          {[0.06, -0.06].map((x) => (
            <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, x > 0 ? -Math.PI / 2 : Math.PI / 2]}><coneGeometry args={[0.05, 0.12, 4]} /><meshLambertMaterial color="#7c3aed" /></mesh>
          ))}
          <mesh><sphereGeometry args={[0.03, 8, 6]} /><meshLambertMaterial color="#5b21b6" /></mesh>
        </group>
      );
    case 'ac_backpack':
      return (
        <group position={[0, 0.5, -0.33]}>
          <mesh><boxGeometry args={[0.36, 0.38, 0.16]} /><meshLambertMaterial color="#16a34a" /></mesh>
          <mesh position={[0, -0.08, -0.09]}><boxGeometry args={[0.26, 0.14, 0.05]} /><meshLambertMaterial color="#15803d" /></mesh>
        </group>
      );
    case 'ac_cape':
      return (
        <mesh position={[0, 0.48, -0.36]} rotation={[0.12, 0, 0]}><boxGeometry args={[0.55, 0.62, 0.025]} /><meshLambertMaterial color="#be123c" /></mesh>
      );
    default:
      return null;
  }
}

export function ShoeView({ id }: { id: string }) {
  const col = id === 'sh_sneaker' ? '#f8fafc' : id === 'sh_boots' ? '#facc15' : id === 'sh_gold' ? '#f59e0b' : null;
  if (!col) return null;
  return (
    <mesh scale={[1.12, id === 'sh_boots' ? 1.5 : 1.08, 1.08]} position={[0, id === 'sh_boots' ? 0.03 : -0.01, 0]}>
      <sphereGeometry args={[0.13, 12, 8, 0, Math.PI * 2, Math.PI / 2.4, Math.PI / 1.7]} />
      <meshLambertMaterial color={col} side={THREE.DoubleSide} emissive={id === 'sh_gold' ? '#78350f' : '#000000'} />
    </mesh>
  );
}

export function CosmeticsView({ c }: { c: Cosmetics }) {
  return (
    <>
      <Hat id={c.hat} />
      <Glasses id={c.glasses} />
      <Accessory id={c.accessory} />
    </>
  );
}
