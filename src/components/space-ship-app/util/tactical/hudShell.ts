import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { vertexShader } from "../shaders/vertex";
import { fragmentShader } from "../shaders/fragment";
import { COLOR, glow } from "./palette";

const DEG = Math.PI / 180;

// Fresnel rim shell (shadow cast by atmosphere, and halo from refracted light)
export function createAtmosphere(
  radius: number,
  {
    tint = new THREE.Color(0.32, 0.42, 0.62),
    opacity = 0.5,
    powFactor = 5.2,
    multiplier = 7.3,
  } = {}
) {
  const material = new THREE.ShaderMaterial({
    vertexShader: vertexShader as string,
    fragmentShader: fragmentShader as string,
    uniforms: {
      atmOpacity: { value: opacity },
      atmPowFactor: { value: powFactor },
      atmMultiplier: { value: multiplier },
      atmTint: { value: tint },
    },
    // additive blending avoids a dark edge around the planet
    blending: THREE.AdditiveBlending,
    // back side so it does not overlay the planet itself
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 64), material);
  mesh.name = "atmosphere";
  return mesh;
}

const lineMat = (color: THREE.Color, opacity: number) =>
  new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

const circle = (r: number, segments = 180) => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
};

// Briefing-table polar grid on the planet's equatorial plane: range rings,
// bearing spokes, a fine degree scale and cardinal bearing labels.
export function createOrbitalPlane(planetRadius: number, { labels = true } = {}) {
  const group = new THREE.Group();
  group.name = "orbital-plane";
  const steel = COLOR.steel;
  const rings = [1.3, 1.65, 2.0].map((k) => planetRadius * k);
  const outer = rings[rings.length - 1];

  rings.forEach((r, i) => {
    group.add(new THREE.Line(circle(r), lineMat(steel, i === rings.length - 1 ? 0.32 : 0.16)));
  });

  const spokes: THREE.Vector3[] = [];
  for (let deg = 0; deg < 360; deg += 30) {
    const dir = new THREE.Vector3(Math.cos(deg * DEG), 0, Math.sin(deg * DEG));
    spokes.push(dir.clone().multiplyScalar(rings[0]), dir.clone().multiplyScalar(outer));
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spokes), lineMat(steel, 0.12)));

  const ticks: THREE.Vector3[] = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const dir = new THREE.Vector3(Math.cos(deg * DEG), 0, Math.sin(deg * DEG));
    const len = deg % 30 === 0 ? 2.2 : 0.9;
    ticks.push(dir.clone().multiplyScalar(outer), dir.clone().multiplyScalar(outer + len));
  }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), lineMat(glow(steel, 1.2), 0.4)));

  if (labels) {
    [0, 90, 180, 270].forEach((deg) => {
      const el = document.createElement("div");
      el.className = "hud-bearing";
      el.textContent = String(deg).padStart(3, "0");
      const label = new CSS2DObject(el);
      label.position.set(Math.cos(deg * DEG) * (outer + 4.5), 0, Math.sin(deg * DEG) * (outer + 4.5));
      group.add(label);
    });
  }

  // tilt toward the camera (which sits a little below) so the rings open into
  // ellipses instead of collapsing into one bright edge-on line
  group.rotation.x = 16 * DEG;
  return group;
}
