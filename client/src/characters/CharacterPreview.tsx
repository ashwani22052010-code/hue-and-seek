import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import type { Cosmetics, PoseId } from '@shared/types';
import { Hueling, newLive } from './Hueling';
import { Label } from '../game/RemotePlayers';

function Spinning({ cosmetics, anim, pose, spin, x = 0, name, ready, host }: { cosmetics: Cosmetics; anim?: string | null; pose?: PoseId; spin?: boolean; x?: number; name?: string; ready?: boolean; host?: boolean }) {
  const g = useRef<THREE.Group>(null!);
  const live = useMemo(() => newLive(), []);
  useEffect(() => {
    live.anim = anim ?? null;
    live.animStart = performance.now() / 1000;
  }, [anim, live]);
  useFrame((st, dt) => {
    if (spin) g.current.rotation.y += dt * 0.6;
    else g.current.rotation.y = Math.sin(st.clock.elapsedTime * 0.7 + x) * 0.35;
    live.eyesClosed = Math.sin(st.clock.elapsedTime * 1.3 + x * 3) > 0.985; // occasional blink
  });
  return (
    <group position={[x, 0, 0]}>
      <group ref={g}>
        <Hueling look={{ pose: pose ?? 'stand', shape: 'normal' }} cosmetics={cosmetics} showCosmetics paint={null} live={live} />
      </group>
      {name && <Label text={`${host ? '👑 ' : ''}${name}`} bg={ready ? 'rgba(16,185,129,0.95)' : 'rgba(30,27,75,0.85)'} y={1.75} />}
    </group>
  );
}

export function CharacterPreview({ cosmetics, anim, orbit, className = '', pose, zoom = 3.1 }: { cosmetics: Cosmetics; anim?: string | null; orbit?: boolean; className?: string; pose?: PoseId; zoom?: number }) {
  return (
    <div className={className}>
      <Canvas flat dpr={[1, 1.75]} camera={{ position: [0, 0.9, zoom], fov: 38 }} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 3]} intensity={1.6} />
        <hemisphereLight args={['#fdf4ff', '#7c3aed', 0.5]} />
        <group position={[0, -0.45, 0]}>
          <Spinning cosmetics={cosmetics} anim={anim} spin={!orbit} pose={pose} />
          <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={3} blur={2.2} far={1.5} />
        </group>
        {orbit && <OrbitControls enablePan={false} enableZoom={false} target={[0, 0.05, 0]} minPolarAngle={0.6} maxPolarAngle={1.7} />}
      </Canvas>
    </div>
  );
}

export function LobbyLineup({ players }: { players: { id: string; name: string; cosmetics: Cosmetics; ready: boolean; host: boolean }[] }) {
  const n = players.length;
  const spacing = 1.15;
  const width = Math.max(3.4, n * spacing + 0.6);
  return (
    <Canvas flat dpr={[1, 1.5]} camera={{ position: [0, 1.5, width * 1.05 + 1.2], fov: 40 }} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 5, 4]} intensity={1.6} />
      <hemisphereLight args={['#fdf4ff', '#7c3aed', 0.5]} />
      <group position={[0, -0.2, 0]}>
        {players.map((p, i) => (
          <Spinning key={p.id} cosmetics={p.cosmetics} x={(i - (n - 1) / 2) * spacing} name={p.name} ready={p.ready} host={p.host} anim={p.ready ? 'em_dance' : null} />
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
          <circleGeometry args={[width / 2 + 0.6, 48]} />
          <meshLambertMaterial color="#c4b5fd" />
        </mesh>
      </group>
    </Canvas>
  );
}
