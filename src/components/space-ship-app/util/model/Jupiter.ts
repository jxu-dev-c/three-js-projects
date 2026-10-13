import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import Jupiter from "../../../../asset/jupiter/Planeta_baseColor.jpg";
import JupiterNormal from "../../../../asset/jupiter/Planeta_normal.jpg";
import MoonColor from "../../../../asset/moon/moon_baseColor.jpeg";

import { loadTexture } from "../texture/loadTexture";
import { applyTacticalSurface } from "../tactical/tacticalSurface";
import { createAtmosphere, createOrbitalPlane } from "../tactical/hudShell";
import { createOrbitPath } from "../tactical/markers";
import { rigPlanet } from "../tactical/planet";
import { StationData } from "../tactical/stations";
import { COLOR } from "../tactical/palette";

const RADIUS = 25;
const EUROPA = { radius: 3, orbit: 42, inclination: -12, roll: 8, speed: 0.035 };
const DEG = Math.PI / 180;

export const JupiterPlanet = async (
  { Px = 0, Py = 0, Pz = 0 },
  stations: StationData[] = []
): Promise<THREE.Group> => {
  const group = new THREE.Group();
  const [planetColor, planetNormal, europaColor] = await Promise.all(
    [Jupiter, JupiterNormal, MoonColor].map((url) => loadTexture(url))
  );
  planetColor.colorSpace = THREE.SRGBColorSpace;
  europaColor.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshStandardMaterial({
    map: planetColor,
    normalMap: planetNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.9,
    metalness: 0,
  });
  // Keep the cloud bands and their natural color ahead of the contour overlay.
  const uniforms = applyTacticalSurface(material, {
    mode: "contour",
    contourDensity: 3,
    grade: 0.4,
    lineIntensity: 0.09,
    gridIntensity: 0.14,
    scanIntensity: 0.12,
    nightFill: 0.1,
  });
  const surface = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 96, 96), material);

  // Europa, carrying the Aristotle Expedition Base
  const europaMaterial = new THREE.MeshStandardMaterial({
    map: europaColor,
    color: COLOR.ice,
    roughness: 0.8,
    metalness: 0,
  });
  const europaUniforms = applyTacticalSurface(europaMaterial, {
    mode: "contour",
    contourDensity: 6,
    grade: 0.8,
    tint: COLOR.ice,
    lineIntensity: 0.6,
    gridIntensity: 0.25,
    nightFill: 0.2,
  });
  const europa = new THREE.Mesh(new THREE.SphereGeometry(EUROPA.radius, 48, 48), europaMaterial);
  const europaRoll = new THREE.Group();
  europaRoll.rotation.z = EUROPA.roll * DEG;
  const europaIncl = new THREE.Group();
  europaIncl.rotation.x = EUROPA.inclination * DEG;
  const europaCarrier = new THREE.Group();
  // start in front of the planet, right of centre in the overview
  europaCarrier.rotation.y = 124 * DEG;
  europa.position.x = EUROPA.orbit;
  europaCarrier.add(europa);
  europaIncl.add(createOrbitPath(EUROPA.orbit), europaCarrier);
  europaRoll.add(europaIncl);

  const tagEl = document.createElement("div");
  tagEl.className = "hud-bearing hud-bearing--tag";
  tagEl.textContent = "EUROPA · J-II";
  const tag = new CSS2DObject(tagEl);
  tag.center.set(0.5, -0.6);
  tag.position.y = -EUROPA.radius;
  europa.add(tag);

  group.add(surface, europaRoll, createAtmosphere(31, { opacity: 0.3 }), createOrbitalPlane(RADIUS));
  group.position.set(Px, Py, Pz);

  return rigPlanet({
    group,
    surface,
    surfaceSpeed: 0.05,
    uniforms: [uniforms, europaUniforms],
    stations,
    radius: RADIUS,
    extraSurfaces: { europa: { mesh: europa, radius: EUROPA.radius } },
    extraUpdate: (dt) => {
      europaCarrier.rotation.y += EUROPA.speed * dt;
      europa.rotation.y += 0.1 * dt;
    },
  });
};
