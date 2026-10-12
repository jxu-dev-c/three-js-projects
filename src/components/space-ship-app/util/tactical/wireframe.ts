import * as THREE from "three";
import { COLOR, glow } from "./palette";

// Turns any procedural model into the electronic wireframe look: a faint
// translucent body plus additive edge lines that bloom picks up.

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
    color: glow(color, intensity),
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

  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
    // pre-built line work (e.g. solar panel cell grids) joins the same material
    if (child.userData.holoLine) (child as THREE.LineSegments).material = lineMat;
  });
  meshes.forEach((mesh) => {
    mesh.material = fillMat;
    mesh.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(
          mesh.geometry,
          mesh.userData.edgeThreshold ?? edgeThreshold
        ),
        lineMat
      )
    );
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

const ACCENT_LINE = glow(COLOR.accent, 2.2);
const BASE_LINE_OPACITY = 0.7;

export function setLineFade(root: THREE.Object3D, fade: number) {
  const state: HologramState | undefined = root.userData.hologram;
  if (state) state.lineMat.opacity = BASE_LINE_OPACITY * fade;
}

export function setHighlight(root: THREE.Object3D, on: boolean) {
  const state: HologramState | undefined = root.userData.hologram;
  if (!state) return;
  state.lineMat.color.copy(on ? ACCENT_LINE : state.baseLine);
  state.fillMat.color.copy(on ? COLOR.accent : state.baseFill);
  state.fillMat.opacity = on ? Math.max(state.baseOpacity * 2, 0.18) : state.baseOpacity;
}
