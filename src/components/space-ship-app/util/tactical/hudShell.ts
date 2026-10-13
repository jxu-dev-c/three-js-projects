import * as THREE from "three";
import { vertexShader } from "../shaders/vertex";
import { fragmentShader } from "../shaders/fragment";
import { COLOR } from "./palette";

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

// A single quiet reference ring gives the orbital scene a plane without
// competing with the actual station paths or their labels.
export function createOrbitalPlane(planetRadius: number) {
  const group = new THREE.Group();
  group.name = "orbital-plane";
  group.add(new THREE.Line(circle(planetRadius * 1.65), lineMat(COLOR.steel, 0.14)));

  // A slight tilt keeps the ring legible from the overview camera.
  group.rotation.x = 16 * DEG;
  return group;
}
