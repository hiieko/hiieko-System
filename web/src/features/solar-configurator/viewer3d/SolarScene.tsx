'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ModulePlacement, ObstacleModel, Point3D, RoofSectionModel, roofLocalToWorld } from '@solar/shared';

const MM_TO_M = 1 / 1000;
const MODULE_THICKNESS_M = 0.03;

function toWorldMeters(roof: RoofSectionModel, p: Point3D): THREE.Vector3 {
  const w = roofLocalToWorld(
    { origin: roof.origin, slopeDeg: roof.slopeDeg, azimuthDeg: roof.azimuthDeg },
    p,
  );
  return new THREE.Vector3(w.x * MM_TO_M, w.y * MM_TO_M, w.z * MM_TO_M);
}

function RoofGroup({
  roof,
  modules,
  obstacles,
}: {
  roof: RoofSectionModel;
  modules: ModulePlacement[];
  obstacles: ObstacleModel[];
}) {
  const groupRef = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    const o = toWorldMeters(roof, { x: 0, y: 0, z: 0 });
    const x = toWorldMeters(roof, { x: 1, y: 0, z: 0 }).sub(o);
    const y = toWorldMeters(roof, { x: 0, y: 1, z: 0 }).sub(o);
    const z = toWorldMeters(roof, { x: 0, y: 0, z: 1 }).sub(o);
    const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(o);
    g.matrix.copy(m);
    g.matrixAutoUpdate = false;
  }, [roof]);

  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const pts = roof.polygon;
    if (pts.length === 0) return s;
    s.moveTo(pts[0].x * MM_TO_M, pts[0].y * MM_TO_M);
    for (let i = 1; i < pts.length; i++) {
      s.lineTo(pts[i].x * MM_TO_M, pts[i].y * MM_TO_M);
    }
    s.closePath();
    return s;
  }, [roof]);

  const obstacleShapes = useMemo(
    () =>
      obstacles.map((o) => {
        const s = new THREE.Shape();
        const pts = o.polygon;
        if (pts.length === 0) return s;
        s.moveTo(pts[0].x * MM_TO_M, pts[0].y * MM_TO_M);
        for (let i = 1; i < pts.length; i++) {
          s.lineTo(pts[i].x * MM_TO_M, pts[i].y * MM_TO_M);
        }
        s.closePath();
        return s;
      }),
    [obstacles],
  );

  return (
    <group ref={groupRef}>
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#94a3b8" side={THREE.DoubleSide} />
      </mesh>
      {modules.map((m, i) => (
        <mesh
          key={`${m.row}-${m.column}-${i}`}
          position={[
            (m.localX + m.widthMm / 2) * MM_TO_M,
            (m.localY + m.heightMm / 2) * MM_TO_M,
            MODULE_THICKNESS_M / 2 + m.localZ * MM_TO_M,
          ]}
        >
          <boxGeometry args={[m.widthMm * MM_TO_M, m.heightMm * MM_TO_M, MODULE_THICKNESS_M]} />
          <meshStandardMaterial color="#1e3a8a" />
        </mesh>
      ))}
      {obstacleShapes.map((s, i) => (
        <mesh key={`obs-${i}`} position={[0, 0, 0.02]}>
          <shapeGeometry args={[s]} />
          <meshStandardMaterial color="#dc2626" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

export function SolarScene({
  roofSections,
  placements,
  obstacles,
}: {
  roofSections: RoofSectionModel[];
  placements: ModulePlacement[];
  obstacles: ObstacleModel[];
}) {
  const byRoof = useMemo(() => {
    const map = new Map<string, ModulePlacement[]>();
    for (const p of placements) {
      const list = map.get(p.roofSectionId) ?? [];
      list.push(p);
      map.set(p.roofSectionId, list);
    }
    return map;
  }, [placements]);

  const byRoofObstacles = useMemo(() => {
    const map = new Map<string, ObstacleModel[]>();
    for (const o of obstacles) {
      const list = map.get(o.roofSectionId) ?? [];
      list.push(o);
      map.set(o.roofSectionId, list);
    }
    return map;
  }, [obstacles]);

  return (
    <Canvas camera={{ position: [12, 9, 12], fov: 45 }}>
      <color attach="background" args={['#f8fafc']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 20, 10]} intensity={1.2} />
      <OrbitControls makeDefault />
      <Grid
        args={[40, 40]}
        cellSize={1}
        sectionSize={5}
        cellColor="#cbd5e1"
        sectionColor="#94a3b8"
        infiniteGrid
      />
      {roofSections.map((roof) => (
        <RoofGroup
          key={roof.id}
          roof={roof}
          modules={byRoof.get(roof.id) ?? []}
          obstacles={byRoofObstacles.get(roof.id) ?? []}
        />
      ))}
    </Canvas>
  );
}
