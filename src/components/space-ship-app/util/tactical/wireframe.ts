import * as THREE from "three";
import { COLOR, glow } from "./palette";

// Turns any procedural model into the electronic wireframe look: a faint
// translucent body plus additive edge lines that bloom picks up. Consumes the
// authored meshes/lines and their resources; retain groups for animation, marking
// independent moving groups with userData.holoMoving before conversion.

export interface HologramOptions {
  color?: THREE.Color;
  intensity?: number;
  fillOpacity?: number;
  edgeThreshold?: number;
}

interface HologramState {
  lineMat: THREE.LineBasicMaterial;
  fillMat: THREE.MeshBasicMaterial;
  baseLine: THREE.Color;
  baseFill: THREE.Color;
  baseOpacity: number;
}

export function toHologram<T extends THREE.Object3D>(
  root: T,
  {
    color = COLOR.ice,
    intensity = 1.6,
    fillOpacity = 0.1,
    edgeThreshold = 20,
  }: HologramOptions = {}
): T {
  const lineMat = new THREE.LineBasicMaterial({
    // Dense engineering edges need headroom before additive overlaps hit bloom.
    color: glow(color, intensity * 0.65),
    transparent: true,
    opacity: BASE_LINE_OPACITY,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const fillMat = new THREE.MeshBasicMaterial({
    color: COLOR.steelDeep,
    transparent: true,
    opacity: fillOpacity,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Bake rigid parts into one fill and one edge buffer per moving assembly.
  // Explicit boundaries keep habitat rings and the focus turntable animated.
  root.updateWorldMatrix(true, true);
  type Batch = { fill: number[]; lines: number[] };
  const batches = new Map<THREE.Object3D, Batch>();
  const sources: THREE.Object3D[] = [];
  const transform = new THREE.Matrix4();
  const point = new THREE.Vector3();
  const append = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, target: number[]) => {
    const positions = geometry.getAttribute("position");
    const index = geometry.getIndex();
    for (let i = 0; i < (index?.count ?? positions.count); i++) {
      point.fromBufferAttribute(positions, index ? index.getX(i) : i).applyMatrix4(matrix);
      target.push(point.x, point.y, point.z);
    }
  };
  root.traverse((child) => {
    const part = child as THREE.Mesh;
    if (!part.isMesh && !child.userData.holoLine) return;
    let owner = child.parent ?? root;
    while (owner !== root && !owner.userData.holoMoving) owner = owner.parent ?? root;
    let batch = batches.get(owner);
    if (!batch) {
      batch = { fill: [], lines: [] };
      batches.set(owner, batch);
    }
    transform.copy(owner.matrixWorld).invert().multiply(child.matrixWorld);
    if (part.isMesh) {
      append(part.geometry, transform, batch.fill);
      const edges = new THREE.EdgesGeometry(part.geometry, part.userData.edgeThreshold ?? edgeThreshold);
      append(edges, transform, batch.lines);
      edges.dispose();
    } else {
      append((child as THREE.LineSegments).geometry, transform, batch.lines);
    }
    sources.push(child);
  });
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  sources.forEach((source) => {
    const part = source as THREE.Mesh;
    geometries.add(part.geometry);
    (Array.isArray(part.material) ? part.material : [part.material]).forEach(m => materials.add(m));
    source.removeFromParent();
  });
  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
  const geometry = (positions: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.computeBoundingSphere();
    return g;
  };
  batches.forEach((batch, owner) => {
    if (batch.fill.length) owner.add(new THREE.Mesh(geometry(batch.fill), fillMat));
    if (batch.lines.length) owner.add(new THREE.LineSegments(geometry(batch.lines), lineMat));
  });

  const state: HologramState = {
    lineMat,
    fillMat,
    baseLine: lineMat.color.clone(),
    baseFill: fillMat.color.clone(),
    baseOpacity: fillOpacity,
  };
  root.userData.hologram = state;
  return root;
}

const ACCENT_LINE = glow(COLOR.accent, 0.95);
const BASE_LINE_OPACITY = 0.45;

export function setLineFade(root: THREE.Object3D, fade: number) {
  const state: HologramState | undefined = root.userData.hologram;
  if (state) state.lineMat.opacity = BASE_LINE_OPACITY * fade;
}

export function setHighlight(root: THREE.Object3D, on: boolean) {
  const state: HologramState | undefined = root.userData.hologram;
  if (!state) return;
  state.lineMat.color.copy(on ? ACCENT_LINE : state.baseLine);
  state.fillMat.color.copy(on ? COLOR.accent : state.baseFill);
  state.fillMat.opacity = on ? Math.max(state.baseOpacity * 1.6, 0.12) : state.baseOpacity;
}
