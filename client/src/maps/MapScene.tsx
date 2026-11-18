import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { MapDef } from '@shared/maps';
import { useStore } from '../store/useStore';
import { applyPropColors, buildMap } from './buildMap';
import { registry } from '../game/registry';

export function MapScene({ def }: { def: MapDef }) {
  const quality = useStore((s) => s.settings.quality);
  const shadows = quality === 'high';
  const built = useMemo(() => buildMap(def, shadows), [def, shadows]);
  const interactables = useStore((s) => s.room?.interactables);
  const propColors = useStore((s) => s.room?.propColors);
  const chaos = useStore((s) => s.chaosFx);
  const { scene, camera } = useThree();
  const amb = useRef<THREE.AmbientLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const sun = useRef<THREE.DirectionalLight>(null!);
  const flashlight = useRef<THREE.SpotLight>(null!);
  const pointRefs = useRef<(THREE.PointLight | null)[]>([]);
  const fogRef = useRef(new THREE.Fog(def.fog, 40, 140));

  useEffect(() => {
    registry.built = built;
    registry.mapMeshes = [...built.chunks.map((c) => c.mesh), ...[...built.interactive.values()].flatMap((e) => e.meshes), built.group.children[built.group.children.length - 1]];
    return () => {
      registry.mapMeshes = [];
      registry.built = null;
      built.dispose();
    };
  }, [built]);

  useEffect(() => {
    scene.background = new THREE.Color(def.sky);
    scene.fog = fogRef.current;
    fogRef.current.color.set(def.fog);
    return () => { scene.fog = null; };
  }, [def, scene]);

  useEffect(() => {
    if (propColors) applyPropColors(built, def, propColors);
  }, [propColors, built, def]);

  useEffect(() => {
    if (!sun.current) return;
    const b = def.bounds;
    const cam = sun.current.shadow.camera as THREE.OrthographicCamera;
    const half = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 2;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.near = 1; cam.far = 120;
    cam.updateProjectionMatrix();
    const d = new THREE.Vector3(...def.sun.dir).normalize();
    sun.current.position.set((b.minX + b.maxX) / 2 - d.x * 50, -d.y * 50, (b.minZ + b.maxZ) / 2 - d.z * 50);
    sun.current.target.position.set((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
    sun.current.target.updateMatrixWorld();
  }, [def]);

  useFrame((_, dt) => {
    const now = Date.now();
    const ch = chaos && chaos.until > now ? chaos.event : null;
    const dark = ch === 'lights_out';
    const k = Math.min(1, dt * 3);
    amb.current.intensity = THREE.MathUtils.lerp(amb.current.intensity, dark ? 0.04 : def.ambient, k);
    hemi.current.intensity = THREE.MathUtils.lerp(hemi.current.intensity, dark ? 0.05 : def.hemi[2], k);
    sun.current.intensity = THREE.MathUtils.lerp(sun.current.intensity, dark ? 0.02 : def.sun.i, k);
    const fogFar = ch === 'fog' ? 9 : dark ? 22 : 140;
    fogRef.current.far = THREE.MathUtils.lerp(fogRef.current.far, fogFar, k);
    fogRef.current.near = Math.min(fogRef.current.far * 0.3, 40);
    fogRef.current.color.set(dark ? '#05050c' : ch === 'fog' ? '#d4d4d8' : def.fog);
    if (scene.background instanceof THREE.Color) scene.background.set(dark ? '#05050c' : ch === 'fog' ? '#d4d4d8' : def.sky);
    // flashlight follows the camera during blackouts
    flashlight.current.intensity = THREE.MathUtils.lerp(flashlight.current.intensity, dark ? 40 : 0, k);
    flashlight.current.position.copy(camera.position);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    flashlight.current.target.position.copy(camera.position).add(dir.multiplyScalar(10));
    flashlight.current.target.updateMatrixWorld();
    // interactive objects
    for (const [id, entry] of built.interactive) {
      const it = def.interactables.find((i) => i.id === id);
      const active = interactables?.[id] ?? it?.defaultActive ?? false;
      if (it?.kind === 'door') {
        entry.group.rotation.y = THREE.MathUtils.lerp(entry.group.rotation.y, active ? it.openAngle ?? Math.PI / 2 : 0, Math.min(1, dt * 6));
      } else if (it?.kind === 'lamp') {
        for (const m of entry.meshes) {
          const mat = m.material as THREE.MeshBasicMaterial;
          mat.color.setScalar(active ? 1 : 0.25);
        }
      }
    }
    def.lights.forEach((l, i) => {
      const pl = pointRefs.current[i];
      if (!pl) return;
      const on = l.group ? interactables?.[l.group] ?? true : true;
      pl.intensity = THREE.MathUtils.lerp(pl.intensity, on ? l.i : 0, k);
    });
    registry.disabledGroups = new Set(Object.entries(interactables ?? {}).filter(([id, v]) => v && def.interactables.find((i) => i.id === id)?.kind === 'door').map(([id]) => id));
  });

  return (
    <>
      <ambientLight ref={amb} intensity={def.ambient} />
      <hemisphereLight ref={hemi} args={[def.hemi[0], def.hemi[1], def.hemi[2]]} />
      <directionalLight
        ref={sun}
        color={def.sun.c}
        intensity={def.sun.i}
        castShadow={shadows}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
      <spotLight ref={flashlight} intensity={0} angle={0.5} penumbra={0.6} distance={22} decay={1.2} color="#fff7d6" />
      {def.lights.map((l, i) => (
        <pointLight key={i} ref={(r) => (pointRefs.current[i] = r)} position={l.p} color={l.c} intensity={l.i} distance={l.dist} decay={1.4} />
      ))}
      <primitive object={built.group} />
    </>
  );
}
