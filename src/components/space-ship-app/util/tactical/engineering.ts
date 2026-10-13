import * as THREE from "three";

// Structural vocabulary taken from docs/concept-art. Parts use local +Y as
// their working axis; callers orient whole assemblies, including their detail.
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const mesh = (g: THREE.BufferGeometry) => new THREE.Mesh(g);
const box = (x: number, y: number, z: number) => mesh(new THREE.BoxGeometry(x, y, z));
const place = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => {
  o.position.set(x, y, z);
  return o;
};
const rod = (a: THREE.Vector3, b: THREE.Vector3, r = 0.035) => {
  const o = mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6));
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize());
  return o;
};
const strokes = (points: THREE.Vector3[]) => {
  const o = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points));
  o.userData.holoLine = true;
  return o;
};
const loop = (r: number, y: number, n = 24) => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n, b = (i + 1) * Math.PI * 2 / n;
    pts.push(v(r * Math.cos(a), y, r * Math.sin(a)), v(r * Math.cos(b), y, r * Math.sin(b)));
  }
  return strokes(pts);
};

const dockingPort = (radius = 0.3, length = 0.35) => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(radius, radius * 0.85, length, 12, 1, true)));
  g.add(loop(radius * 1.12, length / 2), loop(radius, -length / 2));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    g.add(place(box(radius * 0.3, length * 0.6, radius * 0.3), Math.cos(a) * radius, length / 2, Math.sin(a) * radius));
  }
  return g;
};

export const nozzle = (radius: number, length: number) => {
  const g = new THREE.Group();
  // +Y is the open exhaust mouth. A frustum retains an actual throat.
  g.add(mesh(new THREE.CylinderGeometry(radius, radius * 0.38, length, 12, 1, true)));
  g.add(loop(radius, length / 2), loop(radius * 0.5, -length * 0.25));
  return g;
};

const radiator = (width: number, height: number, leaves = 4) => {
  const g = new THREE.Group();
  for (let i = 0; i < leaves; i++) {
    const x = -width / 2 + width * (i + 0.5) / leaves;
    g.add(place(box(width / leaves * 0.86, height, 0.035), x, 0, 0));
  }
  g.add(rod(v(-width / 2, -height / 2, 0), v(width / 2, -height / 2, 0)));
  g.add(rod(v(-width / 2, height / 2, 0), v(width / 2, height / 2, 0)));
  return g;
};

function pressureDetail(radius: number, length: number) {
  const g = new THREE.Group();
  [-0.42, 0, 0.42].forEach(t => g.add(loop(radius * 1.015, length * t, 16)));
  const lines: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    lines.push(v(Math.cos(a) * radius * 1.015, -length * 0.42, Math.sin(a) * radius * 1.015), v(Math.cos(a) * radius * 1.015, length * 0.42, Math.sin(a) * radius * 1.015));
  }
  g.add(strokes(lines));
  return g;
}

// Ring detail is built around +Y, matching the resort. Ark rings rotate the
// entire detail group to +X, so ribs, accommodation and supports spin together.
function habitatDetail(radius: number, tube: number, sectors: number) {
  const g = new THREE.Group();
  for (let i = 0; i < sectors; i++) {
    const a = i * Math.PI * 2 / sectors;
    const rib = loop(tube * 1.05, 0, 8);
    rib.rotation.z = Math.PI / 2;
    rib.rotation.y = -a;
    rib.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
    g.add(rib);
    if (i % 2 === 0) {
      const pod = box(tube * 1.3, tube * 1.1, tube * 1.5);
      pod.position.set(Math.cos(a) * (radius + tube * 0.65), 0, Math.sin(a) * (radius + tube * 0.65));
      pod.rotation.y = -a;
      g.add(pod);
    }
  }
  return g;
}

export function detailResort(root: THREE.Group, wheel: THREE.Group) {
  wheel.add(habitatDetail(2.6, 0.4, 24));
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const c = Math.cos(a), s = Math.sin(a);
    wheel.add(rod(v(c * 0.55, 0.45, s * 0.55), v(c * 2.3, 0, s * 2.3)));
    wheel.add(rod(v(c * 0.55, -0.45, s * 0.55), v(c * 2.3, 0, s * 2.3)));
  }
  root.add(pressureDetail(0.56, 2.6));
  [-1, 1].forEach(s => {
    const port = dockingPort(0.28, 0.5);
    port.rotation.z = -s * Math.PI / 2;
    root.add(place(port, s * 0.8, 0.95, 0));
    const panel = radiator(1.1, 0.7, 3);
    root.add(place(panel, s * 0.9, -1.7, 0));
  });
}

export function detailLab(root: THREE.Group) {
  [-1.5, 0, 1.5].forEach((x, i) => {
    const g = new THREE.Group();
    g.add(pressureDetail(0.42, 1.5));
    g.add(place(dockingPort(0.22), 0, 1.02, 0));
    const hatch = dockingPort(0.18, 0.18);
    hatch.rotation.x = Math.PI / 2;
    g.add(place(hatch, 0, 0.1, 0.48));
    g.add(place(box(0.3, 0.45, 0.14), 0, -0.35, -0.46));
    if (i === 1) g.rotation.x = Math.PI / 2;
    root.add(place(g, x, i === 1 ? 0 : 0.95, i === 1 ? 0.95 : 0));
  });
  [-1, 1].forEach(s => {
    root.add(place(dockingPort(0.24, 0.3).rotateZ(Math.PI / 2), s * 2.9, 0, 0));
    root.add(place(box(0.6, 0.35, 0.5), s * 2.2, 0.38, 0));
    [-0.7, 0.7].forEach(z => root.add(rod(v(s * 3, 0, 0), v(s * 3.6, 0, z), 0.055)));
  });
  root.add(place(radiator(2.4, 0.75, 5), 0, -1, -0.35));
}

export function detailShipyard(root: THREE.Group) {
  [-1, 1].forEach(s => {
    root.add(place(box(6.6, 0.08, 0.65), 0, -1.25, s * 1.55));
    root.add(rod(v(-3.3, -0.7, s * 1.8), v(3.3, -0.7, s * 1.8), 0.025));
    [-2.5, 0, 2.5].forEach(x => {
      root.add(rod(v(x, -1.2, s * 1.8), v(x, -0.7, s * 1.8), 0.025));
      root.add(place(box(0.65, 0.45, 0.42), x, -0.97, s * 1.5));
      root.add(place(box(0.24, 0.3, 0.3), x, 1.3, s * 1.3));
    });
    const elbow = v(-1.6, 0.8, s * 0.7);
    root.add(rod(v(-2, 1.3, s * 1.3), elbow, 0.09));
    root.add(rod(elbow, v(-0.9, 0.25, s * 0.45), 0.065));
    root.add(place(box(0.26, 0.18, 0.3), -0.9, 0.25, s * 0.45));
  });
  root.add(place(box(0.65, 0.25, 0.6), 0.8, 1.6, 0));
  // Sparse fitted hull panels leave the interior ribs visible.
  [0.4, 1.15, 1.9].forEach(x => {
    const skin = mesh(new THREE.CylinderGeometry(0.83, 0.86, 0.58, 8, 1, true, 0, Math.PI * 0.65));
    skin.rotation.z = Math.PI / 2;
    root.add(place(skin, x, 0, 0));
  });
}

export function detailHub(root: THREE.Group, shuttle: THREE.Group) {
  [v(1, 0, 0), v(-1, 0, 0), v(0, 1, 0), v(0, -1, 0)].forEach(dir => {
    const g = new THREE.Group();
    g.add(place(dockingPort(0.4, 0.45), 0, 2.8, 0));
    g.add(place(pressureDetail(0.2, 1.3), 0, 1.9, 0));
    g.quaternion.setFromUnitVectors(v(0, 1, 0), dir);
    root.add(g);
  });
  [-1, 1].forEach(s => {
    root.add(place(radiator(1, 1.25, 3), s * 1.45, 1.4, -0.45));
    root.add(rod(v(s * 0.6, 0.6, 0), v(s * 1.45, 1.4, -0.45), 0.05));
    root.add(place(box(0.55, 0.55, 0.7), s * 1.15, -1.15, -0.15));
    shuttle.add(place(box(0.5, 0.12, 0.15), 0.1, 0.22, s * 0.26));
    shuttle.add(place(nozzle(0.14, 0.32).rotateZ(Math.PI / 2), -0.87, 0, s * 0.18));
    shuttle.add(rod(v(-0.25, -0.15, s * 0.2), v(-0.4, -0.35, s * 0.55), 0.025));
  });
}

export function detailSatellite(root: THREE.Group) {
  [-1, 1].forEach(s => {
    root.add(place(box(0.035, 0.45, 0.4), s * 0.32, 0, 0));
    root.add(place(box(0.38, 0.4, 0.05), 0, 0, s * 0.32));
    root.add(place(dockingPort(0.08, 0.12).rotateZ(Math.PI / 2), s * 0.4, 0, 0));
    root.add(rod(v(s * 0.25, 0.2, -0.2), v(s * 0.8, 0.5, -0.65), 0.02));
    root.add(place(box(0.13, 0.1, 0.12), s * 0.8, 0.5, -0.65));
    root.add(place(nozzle(0.075, 0.15).rotateZ(Math.PI), s * 0.22, -0.38, 0.2));
  });
  // A parabolic dish opens toward +Y; radial ribs and a raised feed make its
  // function readable even with the fill hidden behind the edge overlay.
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    for (let j = 0; j < 4; j++) {
      const r = j * 0.15, r1 = (j + 1) * 0.15;
      pts.push(v(r * Math.cos(a), 0.48 + r * r * 0.7, r * Math.sin(a)), v(r1 * Math.cos(a), 0.48 + r1 * r1 * 0.7, r1 * Math.sin(a)));
    }
    if (i % 2 === 0) root.add(rod(v(0.6 * Math.cos(a), 0.732, 0.6 * Math.sin(a)), v(0, 1.03, 0), 0.015));
  }
  root.add(strokes(pts), loop(0.6, 0.732), place(box(0.09, 0.18, 0.09), 0, 1.02, 0));
}

export function detailSurface(root: THREE.Group) {
  [[0, 0, 0.7], [1.2, 0.4, 0.45], [-0.9, 0.8, 0.4]].forEach(([x, z, r]) => {
    root.add(place(mesh(new THREE.CylinderGeometry(r * 1.04, r * 1.12, 0.16, 12)), x, 0.04, z));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      for (let j = 0; j < 5; j++) {
        const t = j * Math.PI / 10, t1 = (j + 1) * Math.PI / 10;
        pts.push(v(x + r * Math.cos(t) * Math.cos(a), r * Math.sin(t), z + r * Math.cos(t) * Math.sin(a)), v(x + r * Math.cos(t1) * Math.cos(a), r * Math.sin(t1), z + r * Math.cos(t1) * Math.sin(a)));
      }
      root.add(rod(v(x + r * Math.cos(a), 0.22, z + r * Math.sin(a)), v(x + r * 1.2 * Math.cos(a), 0, z + r * 1.2 * Math.sin(a)), 0.025));
    }
    root.add(strokes(pts));
    const airlock = dockingPort(r * 0.25, r * 0.55).rotateX(Math.PI / 2);
    root.add(place(airlock, x, 0.18, z + r));
  });
  [-1.5, -1.9].forEach(x => {
    root.add(place(pressureDetail(0.185, 0.7), x, 0.4, -0.2));
    root.add(rod(v(x, 0.15, -0.2), v(x, 0.15, -0.9), 0.04));
    root.add(rod(v(x, 0.15, -0.9), v(-0.3, 0.15, -0.9), 0.04));
  });
  [-0.2, 0.25, 0.65].forEach(x => root.add(place(box(0.25, 0.14, 0.4), x, 0.43, -1)));
  root.add(place(box(0.4, 0.08, 0.7), 1.4, 0.045, -1.9));
  [-1, 1].forEach(s => root.add(rod(v(1.4 + s * 0.2, 0.2, -1.55), v(1.4 + s * 0.2, 0.2, -2.15), 0.018)));
  // Open derrick replaces the opaque pyramid with a true load-bearing frame.
  const pts: THREE.Vector3[] = [];
  for (let j = 0; j < 4; j++) {
    const y = j * 0.5, y1 = (j + 1) * 0.5;
    const r = 0.28 - j * 0.05, r1 = r - 0.05;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4, b = a + Math.PI / 2;
      const p = v(-0.8 + r * Math.cos(a), y, -0.6 + r * Math.sin(a));
      pts.push(p, v(-0.8 + r1 * Math.cos(a), y1, -0.6 + r1 * Math.sin(a)), p, v(-0.8 + r * Math.cos(b), y, -0.6 + r * Math.sin(b)), p, v(-0.8 + r1 * Math.cos(b), y1, -0.6 + r1 * Math.sin(b)));
    }
  }
  root.add(strokes(pts), place(box(0.36, 0.08, 0.36), -0.8, 1.55, -0.6));
}

export function detailArk(root: THREE.Group, habitats: THREE.Group) {
  [-2.2, 0, 2.2].forEach(x => {
    const ring = habitatDetail(1.8, 0.3, 18);
    ring.rotation.z = Math.PI / 2;
    habitats.add(place(ring, x, 0, 0));
  });
  [-1, 1].forEach(s => {
    const panel = radiator(2, 2.4, 4);
    root.add(place(panel, -4.4, s * 2.15, 0));
    root.add(rod(v(-4.4, s * 0.5, 0), v(-4.4, s * 2.15, 0), 0.08));
    root.add(rod(v(4.3, s * 0.3, 0), v(5.85, s * 1.2, 0), 0.06));
    root.add(rod(v(4.3, 0, s * 0.3), v(5.85, 0, s * 1.2), 0.06));
  });
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    const bands = pressureDetail(0.33, 1.6).rotateZ(Math.PI / 2);
    root.add(place(bands, -4.6, Math.cos(a) * 0.75, Math.sin(a) * 0.75));
    const e = a + Math.PI / 4;
    root.add(rod(v(-6, Math.cos(e) * 0.5, Math.sin(e) * 0.5), v(-7.5, Math.cos(e) * 0.55, Math.sin(e) * 0.55), 0.09));
  }
  const port = dockingPort(0.3, 0.6).rotateZ(-Math.PI / 2);
  root.add(place(port, 4.2, 0, 0));
}
