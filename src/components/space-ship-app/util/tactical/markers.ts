import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { COLOR, glow } from "./palette";

// Briefing-map markers: leader-line pins with floating labels, orbit paths
// and relay links.

const DEG = Math.PI / 180;

const additiveLine = (color: THREE.Color, opacity = 0.85) =>
  new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

// Matches three's SphereGeometry UV layout so lat/lon line up with the textures
export function latLonToVec3(lat: number, lon: number, radius: number) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = (90 - lat) * DEG;
  return new THREE.Vector3(
    -radius * Math.cos(phi) * Math.sin(theta),
    radius * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

export interface PinOptions {
  id: string;
  name: string;
  sub: string;
  height?: number;
  accent?: boolean;
}

export interface Pin {
  group: THREE.Group;
  label: CSS2DObject;
  element: HTMLDivElement;
  setActive: (on: boolean) => void;
}

export function createPin({
  id,
  name,
  sub,
  height = 7,
  accent = false,
}: PinOptions): Pin {
  const group = new THREE.Group();
  group.name = `pin-${id}`;
  const color = accent ? glow(COLOR.accent, 1.8) : glow(COLOR.ice, 1.3);
  const mat = additiveLine(color);

  const stem = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.6, 0),
      new THREE.Vector3(0, height, 0),
    ]),
    mat
  );
  // flag tick at the top of the stem
  const flag = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, height, 0),
      new THREE.Vector3(-1.2, height, 0),
    ]),
    mat
  );
  // diamond at the base
  const s = 0.6;
  const diamond = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, s, 0),
      new THREE.Vector3(s, 0, 0),
      new THREE.Vector3(0, -s, 0),
      new THREE.Vector3(-s, 0, 0),
    ]),
    mat
  );
  group.add(stem, flag, diamond);

  const element = document.createElement("div");
  element.className = `hud-pin ${accent ? "hud-pin--accent" : ""}`;
  element.dataset.stationId = id;
  element.innerHTML = `<span class="hud-pin__name">${name}</span><span class="hud-pin__sub">${sub}</span>`;
  const label = new CSS2DObject(element);
  // camera looks down +z, so world -x is screen-right: label grows rightward from the flag
  label.center.set(0, 1);
  label.position.set(-1.2, height, 0);
  group.add(label);

  const base = color.clone();
  const hot = glow(COLOR.accent, 2.4);
  const setActive = (on: boolean) => {
    element.classList.toggle("is-active", on);
    mat.color.copy(on ? hot : base);
  };

  return { group, label, element, setActive };
}

export interface OrbitPathOptions {
  color?: THREE.Color;
  opacity?: number;
  dashed?: boolean;
  ticks?: number;
}

// Circle in the local XZ plane; the caller tilts it to the orbit inclination
export function createOrbitPath(
  radius: number,
  { color = COLOR.steel, opacity = 0.22, dashed = false, ticks = 0 }: OrbitPathOptions = {}
) {
  const group = new THREE.Group();
  const points: THREE.Vector3[] = [];
  const segments = 160;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = dashed
    ? new THREE.LineDashedMaterial({
        color,
        dashSize: 1.2,
        gapSize: 0.8,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    : additiveLine(color, opacity);
  const ring = new THREE.Line(geometry, material);
  if (dashed) ring.computeLineDistances();
  group.add(ring);

  if (ticks > 0) {
    const tickPoints: THREE.Vector3[] = [];
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      tickPoints.push(dir.clone().multiplyScalar(radius - 0.6));
      tickPoints.push(dir.clone().multiplyScalar(radius + 0.6));
    }
    group.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(tickPoints),
        additiveLine(color, opacity * 1.4)
      )
    );
  }
  return group;
}

// Live lines linking a set of moving objects (relay constellations)
export function createLinkLines(
  space: THREE.Object3D,
  nodes: THREE.Object3D[],
  closed = true
) {
  const count = closed ? nodes.length : nodes.length - 1;
  const positions = new Float32Array(count * 2 * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(
    geometry,
    additiveLine(glow(COLOR.steel, 1.4), 0.55)
  );
  lines.frustumCulled = false;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();

  const update = () => {
    for (let i = 0; i < count; i++) {
      nodes[i].getWorldPosition(a);
      nodes[(i + 1) % nodes.length].getWorldPosition(b);
      space.worldToLocal(a);
      space.worldToLocal(b);
      a.toArray(positions, i * 6);
      b.toArray(positions, i * 6 + 3);
    }
    geometry.attributes.position.needsUpdate = true;
  };
  return { lines, update };
}
