import * as THREE from "three";
import MoonColor from "../../../../asset/moon/moon_baseColor.jpeg";
import MoonNormal from "../../../../asset/moon/moon_normal.jpeg";
import MoonMetalRoughness from "../../../../asset/moon/moon_metallicRoughness.jpeg";

import { loadTexture } from "../texture/loadTexture";
import { applyTacticalSurface } from "../tactical/tacticalSurface";
import { createAtmosphere, createOrbitalPlane } from "../tactical/hudShell";
import { rigPlanet } from "../tactical/planet";
import { StationData } from "../tactical/stations";

const RADIUS = 15;

export const Moon = async (
  { Px = 0, Py = 0, Pz = 0 },
  stations: StationData[] = []
): Promise<THREE.Group> => {
  const group = new THREE.Group();
  const [moonColor, moonNormal, moonRoughness] = await Promise.all(
    [MoonColor, MoonNormal, MoonMetalRoughness].map((url) => loadTexture(url))
  );
  moonColor.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshStandardMaterial({
    map: moonColor,
    normalMap: moonNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughnessMap: moonRoughness,
    roughness: 0.9,
    metalness: 0,
  });
  // topographic contour lines from surface brightness
  const uniforms = applyTacticalSurface(material, {
    mode: "contour",
    contourDensity: 9,
    grade: 0.55,
    lineIntensity: 0.55,
    nightFill: 0.12,
  });
  const surface = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 96, 96), material);

  group.add(
    surface,
    createAtmosphere(RADIUS * 1.25, { opacity: 0.22 }),
    createOrbitalPlane(RADIUS)
  );
  group.position.set(Px, Py, Pz);

  return rigPlanet({
    group,
    surface,
    surfaceSpeed: 0.04,
    uniforms: [uniforms],
    stations,
    radius: RADIUS,
  });
};
