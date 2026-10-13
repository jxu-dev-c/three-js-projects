import * as THREE from "three";
import { yieldToFrame } from "./preparation";
import { COLOR } from "./palette";
import { toHologram, setHighlight, setLineFade } from "./wireframe";
import { createPin, createOrbitPath, createLinkLines, latLonToVec3, Pin } from "./markers";

import {
  detailResort, detailLab, detailShipyard, detailHub,
  detailSatellite, detailSurface, detailArk, nozzle,
} from "./engineering";

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Procedural station models. Built along +x, centred on the origin, then run
// through toHologram for the wireframe look.
// ---------------------------------------------------------------------------

type Spinner = { obj: THREE.Object3D; axis: "x" | "y" | "z"; speed: number };

const mesh = (geometry: THREE.BufferGeometry) => new THREE.Mesh(geometry);

// Smooth surfaces fall under the default 20° edge threshold and would lose
// their lines, so finely tessellated parts carry their own lower threshold.
const fine = <T extends THREE.Object3D>(obj: T, edgeThreshold = 8) => {
  obj.userData.edgeThreshold = edgeThreshold;
  return obj;
};

const beam = (from: THREE.Vector3, to: THREE.Vector3, radius = 0.06) => {
  const length = from.distanceTo(to);
  const m = mesh(new THREE.CylinderGeometry(radius, radius, length, 6, 1));
  m.position.copy(from).add(to).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    to.clone().sub(from).normalize()
  );
  return m;
};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Hairline strut drawn as a single line; thin tubes stack several glowing
// edges on top of each other and bloom them into a solid bar.
const strut = (from: THREE.Vector3, to: THREE.Vector3) => {
  const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([from, to]));
  line.userData.holoLine = true;
  return line;
};

// Box-section truss along +x with diagonal bracing in every bay
const truss = (length: number, size: number, bays: number) => {
  const group = new THREE.Group();
  const h = size / 2;
  const x0 = -length / 2;
  const step = length / bays;
  const corners = [
    [h, h],
    [h, -h],
    [-h, -h],
    [-h, h],
  ];
  corners.forEach(([y, z]) => group.add(strut(v(x0, y, z), v(-x0, y, z))));
  for (let i = 0; i <= bays; i++) {
    const x = x0 + i * step;
    corners.forEach(([y, z], c) => {
      const [ny, nz] = corners[(c + 1) % 4];
      group.add(strut(v(x, y, z), v(x, ny, nz)));
      if (i < bays) group.add(strut(v(x, y, z), v(x + step, ny, nz)));
    });
  }
  return group;
};

// Flat panel with a visible cell grid (EdgesGeometry drops coplanar edges)
const gridPanel = (w: number, h: number, cols: number, rows: number) => {
  const group = new THREE.Group();
  group.add(mesh(new THREE.PlaneGeometry(w, h)));
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= cols; i++) {
    const x = -w / 2 + (w * i) / cols;
    pts.push(v(x, -h / 2, 0), v(x, h / 2, 0));
  }
  for (let j = 0; j <= rows; j++) {
    const y = -h / 2 + (h * j) / rows;
    pts.push(v(-w / 2, y, 0), v(w / 2, y, 0));
  }
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts));
  lines.userData.holoLine = true;
  group.add(lines);
  return group;
};

// Cylinder module with domed end caps
const capsule = (radius: number, length: number, segments = 14) => {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CylinderGeometry(radius, radius, length, segments, 3)));
  [1, -1].forEach((s) => {
    const cap = fine(
      mesh(new THREE.SphereGeometry(radius, segments, 4, 0, Math.PI * 2, 0, Math.PI / 2)),
      12
    );
    cap.position.y = (s * length) / 2;
    if (s < 0) cap.rotation.x = Math.PI;
    group.add(cap);
  });
  return group;
};

function ringResort() {
  const root = new THREE.Group();
  const wheel = new THREE.Group();
  const torus = mesh(new THREE.TorusGeometry(2.6, 0.34, 10, 64));
  torus.rotation.x = Math.PI / 2;
  // window band and inner service ring
  const band = mesh(new THREE.TorusGeometry(2.6, 0.38, 3, 64));
  band.rotation.x = Math.PI / 2;
  band.scale.z = 0.25;
  const inner = mesh(new THREE.TorusGeometry(1.2, 0.08, 6, 48));
  inner.rotation.x = Math.PI / 2;
  wheel.add(torus, band, inner);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const dir = v(Math.cos(a), 0, Math.sin(a));
    wheel.add(beam(dir.clone().multiplyScalar(0.6), dir.clone().multiplyScalar(2.3), 0.07));
    // habitat pods where spokes meet the ring
    const pod = mesh(new THREE.BoxGeometry(0.5, 0.5, 0.36));
    pod.position.copy(dir.clone().multiplyScalar(2.6));
    pod.rotation.y = -a;
    if (i % 2 === 0) wheel.add(pod);
  }
  const hub = mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 16, 4));
  const spire = mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.6, 8));
  const dish = fine(mesh(new THREE.SphereGeometry(0.5, 16, 4, 0, Math.PI * 2, 0, Math.PI / 3)), 12);
  dish.position.y = -2.3;
  dish.rotation.x = Math.PI;
  const docks = [2.1, 1.5].map((y, i) => {
    const dock = mesh(new THREE.TorusGeometry(0.45 - i * 0.12, 0.07, 6, 24));
    dock.position.y = y;
    dock.rotation.x = Math.PI / 2;
    return dock;
  });
  const hubPanels = [-1, 1].map((s) => {
    const panel = gridPanel(1.6, 0.5, 6, 2);
    panel.position.set(0, -1.6, s * 1.05);
    return panel;
  });
  root.add(wheel, hub, spire, dish, ...docks, ...hubPanels);
  detailResort(root, wheel);
  root.rotation.z = 0.35;
  return { root, spinners: [{ obj: wheel, axis: "y", speed: 0.5 }] as Spinner[] };
}

function modularLab() {
  const root = new THREE.Group();
  root.add(truss(6, 0.36, 8));
  [-1.5, 0, 1.5].forEach((x, i) => {
    const mod = capsule(0.42, 1.5);
    mod.position.set(x, i === 1 ? 0 : 0.95, i === 1 ? 0.95 : 0);
    if (i === 1) mod.rotation.x = Math.PI / 2;
    root.add(mod);
    // docking collar between module and truss
    const collar = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 12));
    collar.position.set(x, i === 1 ? 0 : 0.35, i === 1 ? 0.35 : 0);
    if (i === 1) collar.rotation.x = Math.PI / 2;
    root.add(collar);
  });
  [-3.6, 3.6].forEach((x) => {
    [-0.7, 0.7].forEach((z) => {
      const panel = gridPanel(2.2, 1.1, 8, 3);
      panel.position.set(x, 0, z);
      panel.rotation.x = Math.PI / 2;
      root.add(panel);
    });
    root.add(beam(v(Math.sign(x) * 3, 0, 0), v(Math.sign(x) * 4.7, 0, 0), 0.05));
  });
  const radiator = gridPanel(1.6, 0.7, 6, 2);
  radiator.position.set(0, -0.9, 0);
  root.add(radiator);
  const mast = strut(v(1.5, 1.6, 0), v(1.5, 2.8, 0));
  const antenna = fine(mesh(new THREE.ConeGeometry(0.35, 0.22, 16, 1, true)), 12);
  antenna.position.set(1.5, 2.8, 0);
  root.add(mast, antenna);
  detailLab(root);
  return { root, spinners: [] as Spinner[] };
}

function shipyard() {
  const root = new THREE.Group();
  const L = 7;
  const h = 1.3;
  const corners = [
    [h, h],
    [h, -h],
    [-h, -h],
    [-h, h],
  ];
  corners.forEach(([y, z]) => root.add(beam(v(-L / 2, y, z), v(L / 2, y, z), 0.07)));
  const bays = 6;
  for (let i = 0; i <= bays; i++) {
    const x = -L / 2 + (L * i) / bays;
    corners.forEach(([y, z], c) => {
      const [ny, nz] = corners[(c + 1) % 4];
      root.add(strut(v(x, y, z), v(x, ny, nz)));
      // cross-bracing on the outer faces
      if (i < bays) root.add(strut(v(x, y, z), v(x + L / bays, ny, nz)));
    });
  }
  // gantry crane riding the top rails
  const gantry = new THREE.Group();
  gantry.add(beam(v(0, h + 0.3, -h), v(0, h + 0.3, h), 0.07));
  gantry.add(strut(v(0, h + 0.3, 0), v(0, 0.9, 0)));
  gantry.position.x = 0.8;
  root.add(gantry);
  // half-built hull: spine plus tapering ribs
  root.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, L * 0.8, 8)).rotateZ(Math.PI / 2));
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const r = 0.35 + Math.sin(t * Math.PI) * 0.6;
    const rib = mesh(new THREE.TorusGeometry(r, 0.03, 4, 32));
    rib.rotation.y = Math.PI / 2;
    rib.position.x = -L * 0.38 + t * L * 0.76;
    root.add(rib);
  }
  // finished bow section with keel stringers
  const bow = mesh(new THREE.ConeGeometry(0.55, 1.6, 16, 3, true));
  bow.rotation.z = -Math.PI / 2;
  bow.position.x = L * 0.46;
  root.add(bow);
  [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach((a) => {
    root.add(strut(v(-L * 0.38, Math.cos(a) * 0.36, Math.sin(a) * 0.36), v(L * 0.38, Math.cos(a) * 0.36, Math.sin(a) * 0.36)));
  });
  detailShipyard(root);
  return { root, spinners: [] as Spinner[] };
}

function transferHub() {
  const root = new THREE.Group();
  // detail 1 keeps the geodesic readable at overview distance without blooming solid
  root.add(fine(mesh(new THREE.IcosahedronGeometry(1.2, 1)), 6));
  const ports = [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0)];
  ports.forEach((dir) => {
    const tunnel = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.9, 10, 3));
    tunnel.position.copy(dir.clone().multiplyScalar(2.05));
    tunnel.quaternion.setFromUnitVectors(v(0, 1, 0), dir);
    root.add(tunnel);
    [3, 2.4].forEach((d, i) => {
      const ring = mesh(new THREE.TorusGeometry(0.42 - i * 0.12, 0.07, 6, 28));
      ring.position.copy(dir.clone().multiplyScalar(d));
      ring.quaternion.setFromUnitVectors(v(0, 0, 1), dir);
      root.add(ring);
    });
  });
  const shuttle = new THREE.Group();
  shuttle.add(mesh(new THREE.BoxGeometry(1.2, 0.35, 0.6, 3, 1, 2)));
  const nose = mesh(new THREE.ConeGeometry(0.3, 0.6, 10));
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 0.9;
  const wings = mesh(new THREE.BoxGeometry(0.6, 0.05, 1.5));
  wings.position.x = -0.2;
  const engines = [-0.18, 0.18].map((z) => {
    const e = mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 10));
    e.rotation.z = Math.PI / 2;
    e.position.set(-0.75, 0, z);
    return e;
  });
  shuttle.add(nose, wings, ...engines);
  shuttle.position.set(3.9, 0, 0);
  root.add(shuttle);
  const ring = new THREE.Group();
  ring.add(mesh(new THREE.TorusGeometry(2.1, 0.06, 4, 72)));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const tick = mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08));
    tick.position.set(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0);
    tick.rotation.z = a;
    ring.add(tick);
  }
  root.add(ring);
  detailHub(root, shuttle);
  return { root, spinners: [{ obj: ring, axis: "z", speed: 0.3 }] as Spinner[] };
}

function relaySat() {
  const root = new THREE.Group();
  root.add(mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6, 2, 2, 2)));
  const profile = Array.from({ length: 7 }, (_, i) => {
    const r = i * 0.1;
    return new THREE.Vector2(r, 0.48 + r * r * 0.7);
  });
  root.add(mesh(new THREE.LatheGeometry(profile, 24)));
  root.add(beam(v(0, 0.3, 0), v(0, 0.48, 0), 0.08));
  [-1.25, 1.25].forEach((x) => {
    const panel = gridPanel(1.6, 0.55, 6, 2);
    panel.position.x = x;
    root.add(panel);
    root.add(beam(v(Math.sign(x) * 0.3, 0, 0), v(Math.sign(x) * 0.45, 0, 0), 0.03));
  });
  const thruster = mesh(new THREE.ConeGeometry(0.12, 0.25, 10, 1, true));
  thruster.position.y = -0.42;
  root.add(thruster);
  detailSatellite(root);
  return { root, spinners: [] as Spinner[] };
}

function surfaceSite() {
  // built with +y as the surface normal
  const root = new THREE.Group();
  const dome = (r: number) =>
    fine(mesh(new THREE.SphereGeometry(r, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2)), 12);
  const d1 = dome(0.7);
  const d2 = dome(0.45);
  d2.position.set(1.2, 0, 0.4);
  const d3 = dome(0.4);
  d3.position.set(-0.9, 0, 0.8);
  // pressurised walkways between domes
  const walk1 = beam(v(0, 0.12, 0), v(1.2, 0.12, 0.4), 0.08);
  const walk2 = beam(v(0, 0.12, 0), v(-0.9, 0.12, 0.8), 0.08);
  const shed = mesh(new THREE.BoxGeometry(1.2, 0.35, 0.5, 3, 1, 1));
  shed.position.set(0.2, 0.18, -1);
  const silos = [-1.5, -1.9].map((x) => {
    const s = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 12, 2));
    s.position.set(x, 0.4, -0.2);
    return s;
  });
  const pad = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 20));
  pad.position.set(1.4, 0.03, -1.2);
  const padRing = mesh(new THREE.TorusGeometry(0.45, 0.02, 3, 32));
  padRing.rotation.x = Math.PI / 2;
  padRing.position.set(1.4, 0.07, -1.2);
  const mast = strut(v(0.6, 0, 0.9), v(0.6, 1.4, 0.9));
  root.add(d1, d2, d3, walk1, walk2, shed, ...silos, pad, padRing, mast);
  detailSurface(root);
  return { root, spinners: [] as Spinner[] };
}

function generationShip() {
  const root = new THREE.Group();
  // open lattice spine; a solid tube here stacks too many edges and blooms white
  root.add(truss(12, 0.6, 16));
  const habitats = new THREE.Group();
  [-2.2, 0, 2.2].forEach((x) => {
    const ring = mesh(new THREE.TorusGeometry(1.8, 0.28, 8, 56));
    ring.rotation.y = Math.PI / 2;
    ring.position.x = x;
    habitats.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      habitats.add(
        beam(v(x, 0, 0), v(x, Math.cos(a) * 1.55, Math.sin(a) * 1.55), 0.05)
      );
    }
  });
  root.add(habitats);
  const engine = mesh(new THREE.CylinderGeometry(1, 1.1, 2, 12, 3));
  engine.rotation.z = Math.PI / 2;
  engine.position.x = -6.5;
  const nozzles = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const n = nozzle(0.45, 1.1);
    n.rotation.z = Math.PI / 2;
    n.position.set(-8, Math.cos(a) * 0.55, Math.sin(a) * 0.55);
    return n;
  });
  const tanks = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2;
    const t = capsule(0.32, 1.6, 8);
    t.rotation.z = Math.PI / 2;
    t.position.set(-4.6, Math.cos(a) * 0.75, Math.sin(a) * 0.75);
    return t;
  });
  const bow = mesh(new THREE.ConeGeometry(0.7, 2, 14, 2));
  bow.rotation.z = -Math.PI / 2;
  bow.position.x = 7;
  const shield = mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.2, 24));
  shield.rotation.z = Math.PI / 2;
  shield.position.x = 6;
  root.add(engine, ...nozzles, ...tanks, bow, shield);
  detailArk(root, habitats);
  return { root, spinners: [{ obj: habitats, axis: "x", speed: 0.25 }] as Spinner[] };
}

const FACTORIES = {
  ringResort,
  modularLab,
  shipyard,
  transferHub,
  relaySat,
  surfaceSite,
  generationShip,
};

export type StationType = keyof typeof FACTORIES;

// ---------------------------------------------------------------------------
// Placement
// ---------------------------------------------------------------------------

export interface StationData {
  id: string;
  name: string;
  type: string;
  kind: string;
  on?: string;
  lat?: number;
  lon?: number;
  scale?: number;
  count?: number;
  links?: boolean;
  orbit?: {
    radius: number;
    inclination?: number;
    roll?: number;
    phase?: number;
    speed?: number;
    planeSpread?: number;
  };
  description?: string;
  readout: { alt: string; status: string; [key: string]: string | number };
}

export interface StationEntry {
  data: StationData;
  objects: THREE.Object3D[];
  pin: Pin;
  // bounding radius of the primary model in world units, used to frame the camera
  radius: number;
  highlight: (on: boolean) => void;
  hover: (on: boolean) => void;
}

export type StationRegistry = Map<string, StationEntry>;

export interface Surface {
  mesh: THREE.Object3D;
  radius: number;
}

export const STATION_HOVER_EVENT = "station-hover";
export const STATION_SELECT_EVENT = "station-select";

const UP = new THREE.Vector3(0, 1, 0);

export async function buildStations(
  planet: THREE.Group,
  surfaces: Record<string, Surface>,
  data: StationData[]
) {
  const registry: StationRegistry = new Map();
  const spinners: Spinner[] = [];
  const carriers: { obj: THREE.Object3D; speed: number; id: string }[] = [];
  const turntables = new Map<string, THREE.Object3D>();
  let focusedId: string | null = null;
  let hoveredId: string | null = null;
  const pinTargets: { pin: Pin; target: THREE.Object3D; lift: number }[] = [];
  const linkUpdates: (() => void)[] = [];
  const stationsRoot = new THREE.Group();
  stationsRoot.name = "stations";
  planet.add(stationsRoot);

  for (const station of data) {
    await yieldToFrame();
    const factory = FACTORIES[station.type as StationType];
    if (!factory) {
      console.warn(`Unknown station type ${station.type}`);
      continue;
    }
    const accent = station.kind === "surface";
    const objects: THREE.Object3D[] = [];
    const make = () => {
      const { root, spinners: s } = factory();
      const wrapper = new THREE.Group();
      // turntable layer so a focused site can spin in place
      const turntable = new THREE.Group();
      turntable.userData.holoMoving = true;
      s.forEach(({ obj }) => (obj.userData.holoMoving = true));
      turntable.add(root);
      wrapper.add(turntable);
      wrapper.scale.setScalar(station.scale ?? 1);
      toHologram(wrapper, {
        color: accent ? COLOR.accent : COLOR.ice,
        intensity: accent ? 1.4 : 1.05,
      });
      spinners.push(...s);
      if (objects.length === 0) turntables.set(station.id, turntable);
      objects.push(wrapper);
      return wrapper;
    };

    if (station.kind === "surface") {
      const surface = surfaces[station.on ?? "planet"];
      const obj = make();
      obj.position.copy(latLonToVec3(station.lat ?? 0, station.lon ?? 0, surface.radius));
      obj.quaternion.setFromUnitVectors(UP, obj.position.clone().normalize());
      surface.mesh.add(obj);
    } else {
      const orbit = station.orbit ?? { radius: 35 };
      const count = station.count ?? 1;
      for (let i = 0; i < count; i++) {
        if (i > 0) await yieldToFrame();
        const roll = new THREE.Group();
        roll.rotation.z = (orbit.roll ?? 0) * DEG;
        const incl = new THREE.Group();
        // planeSpread fans a fleet across separate orbital planes
        incl.rotation.x = ((orbit.inclination ?? 0) + i * (orbit.planeSpread ?? 0)) * DEG;
        roll.add(incl);
        if (i === 0 || orbit.planeSpread) {
          incl.add(createOrbitPath(orbit.radius));
        }
        const carrier = new THREE.Group();
        carrier.rotation.y = ((orbit.phase ?? 0) + (orbit.planeSpread ? i * 40 : (i * 360) / count)) * DEG;
        incl.add(carrier);
        const obj = make();
        obj.position.x = orbit.radius;
        // face along the direction of travel
        obj.rotation.y = -Math.PI / 2;
        carrier.add(obj);
        carriers.push({ obj: carrier, speed: (orbit.speed ?? 0.05) * (1 + i * 0.03), id: station.id });
        stationsRoot.add(roll);
      }
      if (station.links && objects.length > 1) {
        const link = createLinkLines(stationsRoot, objects);
        stationsRoot.add(link.lines);
        linkUpdates.push(link.update);
      }
    }

    const pin = createPin({
      id: station.id,
      name: station.name,
      sub: `${station.id} · ${station.readout.alt} · ${station.readout.status}`,
      height: accent ? 9 : 6,
      accent,
    });
    stationsRoot.add(pin.group);
    pinTargets.push({ pin, target: objects[0], lift: accent ? 0 : 1.5 });

    // the focused site stays lit while hovers come and go
    const highlight = (on: boolean) => {
      const lit = on || hoveredId === station.id || focusedId === station.id;
      objects.forEach((o) => setHighlight(o, lit));
      pin.setActive(lit);
    };
    const hover = (on: boolean) => {
      if (on) setHover(station.id);
      else if (hoveredId === station.id) setHover(null);
    };
    pin.element.addEventListener("mouseenter", () => hover(true));
    pin.element.addEventListener("mouseleave", () => hover(false));
    pin.element.addEventListener("click", (event) => {
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent(STATION_SELECT_EVENT, { detail: { id: station.id } }));
    });

    const primary = objects[0];
    primary.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(primary);
    const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;

    registry.set(station.id, { data: station, objects, pin, radius, highlight, hover });
  }

  function setHover(id: string | null) {
    if (hoveredId === id) return;
    const previous = hoveredId;
    hoveredId = id;
    if (previous) {
      registry.get(previous)?.highlight(false);
      window.dispatchEvent(new CustomEvent(STATION_HOVER_EVENT, { detail: { id: previous, on: false } }));
    }
    if (id) {
      registry.get(id)?.highlight(true);
      window.dispatchEvent(new CustomEvent(STATION_HOVER_EVENT, { detail: { id, on: true } }));
    }
  }

  const world = new THREE.Vector3();
  const center = new THREE.Vector3();
  const toTarget = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const planetQuat = new THREE.Quaternion();
  const mainRadius = surfaces.planet?.radius ?? 25;

  const update = (dt: number, camera?: THREE.Camera) => {
    spinners.forEach((s) => (s.obj.rotation[s.axis] += s.speed * dt));
    // the focused site holds its orbital position and turns in place instead
    carriers.forEach((c) => {
      if (c.id !== focusedId) c.obj.rotation.y += c.speed * dt;
    });
    if (focusedId) {
      const turntable = turntables.get(focusedId);
      if (turntable) turntable.rotation.y += 0.45 * dt;
    }
    linkUpdates.forEach((fn) => fn());

    planet.getWorldPosition(center);
    planet.getWorldQuaternion(planetQuat);

    // far away, a model's lines crowd into a few pixels and bloom solid white,
    // so line strength eases off with camera distance
    if (camera) {
      registry.forEach((entry) =>
        entry.objects.forEach((object) => {
          object.getWorldPosition(world);
          setLineFade(object, THREE.MathUtils.clamp(26 / world.distanceTo(camera.position), 0.28, 1));
        })
      );
    }
    pinTargets.forEach(({ pin, target, lift }) => {
      target.getWorldPosition(world);
      // pins stand upright in world space regardless of planet spin
      stationsRoot.worldToLocal(pin.group.position.copy(world));
      pin.group.position.y += lift;
      pin.group.quaternion.copy(planetQuat).invert();

      if (camera) {
        // hide labels for sites behind the planet disc
        toTarget.copy(world).sub(camera.position);
        const dist = toTarget.length();
        toTarget.divideScalar(dist);
        const t = center.clone().sub(camera.position).dot(toTarget);
        closest.copy(camera.position).addScaledVector(toTarget, t);
        const hidden = t > 0 && t < dist && closest.distanceTo(center) < mainRadius * 0.98;
        pin.label.visible = !hidden;
      }
    });
  };

  const setFocus = (id: string | null) => {
    setHover(null);
    const previous = focusedId;
    focusedId = id;
    [previous, id].forEach((key) => key && registry.get(key)?.highlight(false));
    registry.forEach((entry, key) => {
      entry.pin.element.classList.toggle("is-focused", key === id);
      entry.pin.element.classList.toggle("is-dimmed", id !== null && key !== id);
      // the panel carries the focused site's details, so its pin steps aside
      entry.pin.group.visible = key !== id;
    });
  };

  return { registry, update, setFocus };
}

// Nearest visible site to a screen point, for clicking the models themselves
export function pickStation(
  registry: StationRegistry,
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
  maxDistance = 56
) {
  const point = new THREE.Vector3();
  let best: { id: string; distance: number } | null = null;
  registry.forEach((entry, id) => {
    if (!entry.pin.label.visible) return;
    entry.objects.forEach((object) => {
      object.getWorldPosition(point).project(camera);
      if (point.z < -1 || point.z > 1) return;
      const x = ((point.x + 1) / 2) * window.innerWidth;
      const y = ((1 - point.y) / 2) * window.innerHeight;
      const distance = Math.hypot(x - clientX, y - clientY);
      if (distance < maxDistance && (!best || distance < best.distance)) {
        best = { id, distance };
      }
    });
  });
  return (best as { id: string; distance: number } | null)?.id ?? null;
}
