// The Hueling: an original bean-shaped, fully paintable character with procedural poses and animations.
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Cosmetics, PlayerLook, PoseId } from '@shared/types';
import { SHAPES, cosmeticColor } from '@shared/constants';
import { characterGeometries, makeCharacterMaterial, EYE_Y } from './geometry';
import { CosmeticsView, ShoeView } from './Cosmetics';

/** Mutable per-frame state supplied by the owner (avoids React re-renders at 60fps). */
export interface HuelingLive {
  moving: boolean;
  sprint: boolean;
  grounded: boolean;
  eyesClosed: boolean;
  anim: string | null; // emote / victory id
  animStart: number;
  tint: string | null;
  tintAmt: number;
  opacity: number;
}
export const newLive = (): HuelingLive => ({
  moving: false, sprint: false, grounded: true, eyesClosed: false, anim: null, animStart: 0, tint: null, tintAmt: 0, opacity: 1,
});

interface Props {
  look: PlayerLook;
  cosmetics: Cosmetics;
  showCosmetics: boolean;
  paint: THREE.Texture | null; // null => outfit colour (seekers / lobby)
  live: HuelingLive;
  /** register meshes for raycasting (painting / tagging / eyedropper) */
  onMeshes?: (meshes: THREE.Mesh[]) => void;
  userData?: Record<string, unknown>;
}

interface PoseT {
  y: number; rx: number; rz: number; sq: [number, number, number];
  aL: [number, number]; aR: [number, number]; fL: [number, number, number]; fR: [number, number, number]; tail: number; limbs: number;
}
const P = (o: Partial<PoseT>): PoseT => ({
  y: 0, rx: 0, rz: 0, sq: [1, 1, 1], aL: [0, 0.25], aR: [0, -0.25], fL: [0.15, 0.05, 0.04], fR: [-0.15, 0.05, 0.04], tail: 0.9, limbs: 1, ...o,
});
const POSE_T: Record<PoseId, PoseT> = {
  stand: P({}),
  sit: P({ y: -0.06, rx: -0.14, sq: [1.05, 0.9, 1.05], aL: [-0.5, 0.35], aR: [-0.5, -0.35], fL: [0.16, 0.08, 0.3], fR: [-0.16, 0.08, 0.3] }),
  crouch: P({ sq: [1.12, 0.66, 1.12], aL: [-0.9, 0.2], aR: [-0.9, -0.2], fL: [0.17, 0.05, 0.1], fR: [-0.17, 0.05, 0.1] }),
  lie: P({ y: 0.34, rx: -Math.PI / 2, aL: [0, 0.6], aR: [0, -0.6], tail: 0 }),
  curl: P({ sq: [1.18, 0.58, 1.18], aL: [-1.4, 0], aR: [-1.4, 0], fL: [0.1, 0.06, 0.12], fR: [-0.1, 0.06, 0.12], tail: 1.6, limbs: 0.35 }),
  starfish: P({ y: 0.33, rx: Math.PI / 2, aL: [0, 1.45], aR: [0, -1.45], fL: [0.32, 0.05, -0.04], fR: [-0.32, 0.05, -0.04], tail: 0.4 }),
  handstand: P({ y: 1.18, rx: Math.PI, aL: [0, 2.9], aR: [0, -2.9], fL: [0.2, 0.0, 0], fR: [-0.2, 0.0, 0], tail: 0.3 }),
  flamingo: P({ rz: 0.06, aL: [0, 1.3], aR: [0, -1.3], fL: [0.12, 0.05, 0.03], fR: [-0.1, 0.38, -0.1] }),
  peek: P({ aL: [-2.5, -0.55], aR: [-2.5, 0.55] }),
};

const lerp = THREE.MathUtils.lerp;

export function Hueling({ look, cosmetics, showCosmetics, paint, live, onMeshes, userData }: Props) {
  const geo = useMemo(() => characterGeometries('hi'), []);
  const geoLo = useMemo(() => characterGeometries('lo'), []);
  const mat = useMemo(() => makeCharacterMaterial(), []);
  const eyeMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff' }), []);
  const pupilMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1e1b4b' }), []);
  const poseRef = useRef<THREE.Group>(null!);
  const shapeRef = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const footL = useRef<THREE.Mesh>(null!);
  const footR = useRef<THREE.Mesh>(null!);
  const tail = useRef<THREE.Mesh>(null!);
  const eyes = useRef<THREE.Group>(null!);
  const lids = useRef<THREE.Group>(null!);
  const bodyMesh = useRef<THREE.Mesh>(null!);
  const paintMeshes = useRef<THREE.Mesh[]>([]);
  const cur = useRef<PoseT>({ ...POSE_T.stand });
  const lodLevel = useRef<'hi' | 'lo'>('hi');
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    mat.map = paint;
    mat.color.set(paint ? '#ffffff' : cosmeticColor(cosmetics.color));
    mat.needsUpdate = true;
  }, [paint, cosmetics.color, mat]);

  useEffect(() => {
    const list = paintMeshes.current.filter(Boolean);
    for (const m of list) m.userData = { ...m.userData, ...userData };
    onMeshes?.(list);
  }, [onMeshes, userData]);

  useEffect(() => () => { mat.dispose(); eyeMat.dispose(); pupilMat.dispose(); }, [mat, eyeMat, pupilMat]);

  const reg = (i: number) => (m: THREE.Mesh | null) => { if (m) paintMeshes.current[i] = m; };

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const target = POSE_T[look.pose] ?? POSE_T.stand;
    const c = cur.current;
    const k = Math.min(1, dt * 10);
    c.y = lerp(c.y, target.y, k);
    c.rx = lerp(c.rx, target.rx, k);
    c.rz = lerp(c.rz, target.rz, k);
    for (let i = 0; i < 3; i++) c.sq[i] = lerp(c.sq[i], target.sq[i], k);
    for (let i = 0; i < 2; i++) { c.aL[i] = lerp(c.aL[i], target.aL[i], k); c.aR[i] = lerp(c.aR[i], target.aR[i], k); }
    for (let i = 0; i < 3; i++) { c.fL[i] = lerp(c.fL[i], target.fL[i], k); c.fR[i] = lerp(c.fR[i], target.fR[i], k); }
    c.tail = lerp(c.tail, target.tail, k);
    c.limbs = lerp(c.limbs, target.limbs, k);

    let y = c.y, rx = c.rx, rz = c.rz, ry = 0;
    let sqx = c.sq[0], sqy = c.sq[1], sqz = c.sq[2];
    let aLx = c.aL[0], aLz = c.aL[1], aRx = c.aR[0], aRz = c.aR[1];
    const fL = [...c.fL], fR = [...c.fR];

    // locomotion
    if (live.moving && look.pose === 'stand') {
      const f = live.sprint ? 15 : 10;
      const s = Math.sin(t * f);
      fL[2] += s * 0.13; fR[2] -= s * 0.13;
      fL[1] += Math.max(0, s) * 0.06; fR[1] += Math.max(0, -s) * 0.06;
      aLx += -s * 0.6; aRx += s * 0.6;
      y += Math.abs(s) * 0.045;
      rz += s * 0.03;
    } else if (look.pose === 'stand' || look.pose === 'crouch') {
      sqy *= 1 + Math.sin(t * 2.2) * 0.015; // breathing
    }
    if (!live.grounded) { fL[1] += 0.06; fR[1] += 0.06; aLz += 0.6; aRz -= 0.6; }

    // emotes / victory
    if (live.anim) {
      const a = t - live.animStart;
      switch (live.anim) {
        case 'em_wave': aRx = -2.6; aRz = -0.4 + Math.sin(a * 14) * 0.45; break;
        case 'em_dance': rz += Math.sin(a * 9) * 0.22; y += Math.abs(Math.sin(a * 9)) * 0.12; aLz = 1.2 + Math.sin(a * 9) * 0.5; aRz = -1.2 + Math.sin(a * 9) * 0.5; break;
        case 'em_laugh': sqy *= 1 + Math.sin(a * 30) * 0.05; rx -= 0.2; aLx = -1; aRx = -1; break;
        case 'em_think': aRx = -2.1; aRz = 0.5; rz += 0.12; break;
        case 'em_heart': y += Math.abs(Math.sin(a * 6)) * 0.3; aLz = 2.4; aRz = -2.4; break;
        case 'em_taunt': ry = a * 10; aLz = 1.4; aRz = -1.4; break;
        case 'vic_jump': y += Math.abs(Math.sin(a * 5)) * 0.6; aLz = 2.6; aRz = -2.6; break;
        case 'vic_spin': ry = a * 12; y += 0.15 + Math.sin(a * 6) * 0.05; aLz = 1.5; aRz = -1.5; break;
        case 'vic_flip': { const ph = (a % 1.4) / 1.4; y += Math.sin(ph * Math.PI) * 1.0; rx = -ph * Math.PI * 2; aLz = 2.2; aRz = -2.2; break; }
        case 'vic_wobble': sqy *= 1 + Math.sin(a * 12) * 0.18; sqx *= 1 - Math.sin(a * 12) * 0.1; sqz = sqx; aLz = 1 + Math.sin(a * 12); aRz = -1 - Math.sin(a * 12); break;
      }
    }

    const sh = SHAPES[look.shape].scale;
    shapeRef.current.scale.set(lerp(shapeRef.current.scale.x, sh[0] * sqx, k), lerp(shapeRef.current.scale.y, sh[1] * sqy, k), lerp(shapeRef.current.scale.z, sh[2] * sqz, k));
    const pg = poseRef.current;
    pg.position.y = y * sh[1];
    pg.rotation.set(rx, ry, rz);
    armL.current.rotation.set(aLx, 0, aLz);
    armR.current.rotation.set(aRx, 0, aRz);
    armL.current.scale.setScalar(c.limbs);
    armR.current.scale.setScalar(c.limbs);
    footL.current.position.set(fL[0], fL[1], fL[2]);
    footR.current.position.set(fR[0], fR[1], fR[2]);
    tail.current.rotation.x = -c.tail;

    // eyes: hiders close their eyes when perfectly still (and the lids are painted like the body)
    const closed = live.eyesClosed || look.pose === 'peek';
    lids.current.visible = closed;
    eyes.current.visible = !closed;

    // tint / opacity
    const u = mat.userData;
    if (live.tint) u.tint.value.set(live.tint);
    u.tintAmt.value = lerp(u.tintAmt.value, live.tint ? live.tintAmt : 0, Math.min(1, dt * 4));
    const transparent = live.opacity < 0.999;
    if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
    mat.opacity = live.opacity;

    // level of detail
    bodyMesh.current.getWorldPosition(tmpV);
    const want = tmpV.distanceTo(state.camera.position) > 16 ? 'lo' : 'hi';
    if (want !== lodLevel.current) {
      lodLevel.current = want;
      const g = want === 'lo' ? geoLo : geo;
      bodyMesh.current.geometry = g.body;
      footL.current.geometry = g.foot[0];
      footR.current.geometry = g.foot[1];
    }
  });

  return (
    <group ref={poseRef}>
      <group ref={shapeRef}>
        <mesh ref={(m) => { bodyMesh.current = m!; reg(0)(m); }} geometry={geo.body} material={mat} castShadow receiveShadow />
        <group ref={eyes}>
          {[0.13, -0.13].map((x) => (
            <group key={x} position={[x, EYE_Y, 0.255]}>
              <mesh geometry={geo.eye} material={eyeMat} />
              <mesh geometry={geo.pupil} material={pupilMat} position={[0, 0.005, 0.068]} />
            </group>
          ))}
        </group>
        <group ref={lids}>
          {[0.13, -0.13].map((x, i) => (
            <mesh key={x} ref={reg(7 + i)} geometry={geo.lid} material={mat} position={[x, EYE_Y, 0.255]} scale={[1, 0.95, 0.85]} />
          ))}
        </group>
        <mesh ref={reg(1)} geometry={geo.crest} material={mat} position={[0, 0.99, -0.02]} scale={[0.45, 1.1, 1.1]} rotation={[-0.4, 0, 0]} />
        <mesh ref={(m) => { tail.current = m!; reg(2)(m); }} geometry={geo.tail} material={mat} position={[0, 0.22, -0.34]} />
        <group ref={armL} position={[0.33, 0.56, 0]}>
          <mesh ref={reg(3)} geometry={geo.arm[0]} material={mat} position={[0, -0.16, 0]} />
        </group>
        <group ref={armR} position={[-0.33, 0.56, 0]}>
          <mesh ref={reg(4)} geometry={geo.arm[1]} material={mat} position={[0, -0.16, 0]} />
        </group>
        <mesh ref={(m) => { footL.current = m!; reg(5)(m); }} geometry={geo.foot[0]} material={mat} scale={[1, 0.6, 1.3]}>
          {showCosmetics && <ShoeView id={cosmetics.shoes} />}
        </mesh>
        <mesh ref={(m) => { footR.current = m!; reg(6)(m); }} geometry={geo.foot[1]} material={mat} scale={[1, 0.6, 1.3]}>
          {showCosmetics && <ShoeView id={cosmetics.shoes} />}
        </mesh>
        {showCosmetics && <CosmeticsView c={cosmetics} />}
      </group>
    </group>
  );
}
