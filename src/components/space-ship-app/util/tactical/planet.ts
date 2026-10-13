import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { TacticalUniforms } from "./tacticalSurface";
import { buildStations, StationData, Surface } from "./stations";

// Shared wiring for every planet group: spin, shader clock, stations, and the
// per-frame userData.update hook that initThree calls while the group is visible.

export type PlanetUpdate = (dt: number, elapsed: number, camera: THREE.Camera) => void;

export interface PlanetRig {
  group: THREE.Group;
  surface: THREE.Mesh;
  surfaceSpeed?: number;
  clouds?: THREE.Mesh;
  cloudSpeed?: number;
  uniforms: TacticalUniforms[];
  stations?: StationData[];
  extraSurfaces?: Record<string, Surface>;
  radius: number;
  extraUpdate?: PlanetUpdate;
}

export async function rigPlanet({
  group,
  surface,
  surfaceSpeed = 0.03,
  clouds,
  cloudSpeed = 0.05,
  uniforms,
  stations = [],
  extraSurfaces = {},
  radius,
  extraUpdate,
}: PlanetRig) {
  surface.name = "surface";
  if (clouds) clouds.name = "clouds";
  const { registry, update: updateStations, setFocus } = await buildStations(
    group,
    { planet: { mesh: surface, radius }, ...extraSurfaces },
    stations
  );

  const update: PlanetUpdate = (dt, elapsed, camera) => {
    surface.rotation.y += surfaceSpeed * dt;
    if (clouds) clouds.rotation.y += cloudSpeed * dt;
    uniforms.forEach((u) => (u.uTime.value = elapsed));
    extraUpdate?.(dt, elapsed, camera);
    updateStations(dt, camera);
  };

  // distant (inactive) planets drop their site markers, labels and grid
  const setDetail = (on: boolean) => {
    group.traverse((child) => {
      if (child instanceof CSS2DObject) child.visible = on;
      if (child.name === "stations" || child.name === "orbital-plane") child.visible = on;
    });
  };

  group.userData.update = update;
  group.userData.setDetail = setDetail;
  group.userData.stations = registry;
  group.userData.setFocus = setFocus;
  group.userData.radius = radius;
  return group;
}
