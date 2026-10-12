import * as THREE from "three";
import { Body } from "./systemMap";
import { createAtmosphere } from "./hudShell";
import { COLOR } from "./palette";
import { StationRegistry } from "./stations";

// A body that renders as a cheap procedural stand-in (no textures, no
// network) until its full planet is requested. The wrapper exposes the same
// userData API as a full planet group, delegating once the real one arrives.

export const PLANET_LOADED_EVENT = "planet-loaded";

export interface LazyPlanetOptions {
  body: Body;
  tint: THREE.Color;
  load: () => Promise<THREE.Group>;
}

const EMPTY_REGISTRY: StationRegistry = new Map();

// tinted sphere + lat/long line work + rim glow: reads as a planet at range
function createProxy(radius: number, tint: THREE.Color) {
  const group = new THREE.Group();
  group.name = "proxy";
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(radius, 48, 32),
      new THREE.MeshStandardMaterial({ color: tint, roughness: 1, metalness: 0 })
    )
  );

  const points: THREE.Vector3[] = [];
  const r = radius * 1.003;
  const segments = 64;
  // parallels every 30°, meridians every 30°
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = r * Math.sin((lat * Math.PI) / 180);
    const ring = r * Math.cos((lat * Math.PI) / 180);
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(Math.cos(a0) * ring, y, Math.sin(a0) * ring),
        new THREE.Vector3(Math.cos(a1) * ring, y, Math.sin(a1) * ring)
      );
    }
  }
  for (let lon = 0; lon < 360; lon += 30) {
    const a = (lon * Math.PI) / 180;
    for (let i = 0; i < segments / 2; i++) {
      const t0 = (i / (segments / 2)) * Math.PI - Math.PI / 2;
      const t1 = ((i + 1) / (segments / 2)) * Math.PI - Math.PI / 2;
      points.push(
        new THREE.Vector3(Math.cos(t0) * Math.cos(a) * r, Math.sin(t0) * r, Math.cos(t0) * Math.sin(a) * r),
        new THREE.Vector3(Math.cos(t1) * Math.cos(a) * r, Math.sin(t1) * r, Math.cos(t1) * Math.sin(a) * r)
      );
    }
  }
  group.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({
        color: COLOR.steel,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  group.add(createAtmosphere(radius * 1.34, { opacity: 0.4 }));
  return group;
}

export function createLazyPlanet({ body, tint, load }: LazyPlanetOptions) {
  const wrapper = new THREE.Group();
  wrapper.position.copy(body.position);
  wrapper.rotation.y = body.yaw;
  const proxy = createProxy(body.radius, tint);
  wrapper.add(proxy);

  let full: THREE.Group | null = null;
  let pending: Promise<THREE.Group> | null = null;
  let detail = false;

  const ensureLoaded = () => {
    if (!pending) {
      pending = load().then((group) => {
        group.position.set(0, 0, 0);
        wrapper.add(group);
        group.userData.setDetail(detail);
        wrapper.remove(proxy);
        full = group;
        window.dispatchEvent(new CustomEvent(PLANET_LOADED_EVENT, { detail: { num: body.num } }));
        return group;
      });
    }
    return pending;
  };

  wrapper.userData = {
    radius: body.radius,
    get stations(): StationRegistry {
      return full?.userData.stations ?? EMPTY_REGISTRY;
    },
    get isLoaded() {
      return full !== null;
    },
    ensureLoaded,
    update: (dt: number, elapsed: number, camera: THREE.Camera) => {
      if (full) full.userData.update(dt, elapsed, camera);
      else proxy.rotation.y += 0.03 * dt;
    },
    setDetail: (on: boolean) => {
      detail = on;
      full?.userData.setDetail(on);
    },
    setFocus: (id: string | null) => full?.userData.setFocus(id),
  };

  return wrapper;
}
