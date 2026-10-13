import * as THREE from "three";
import PlanetBase from "../../../../asset/earth/Earth_baseColor.jpeg";
import PlanetMetalic from "../../../../asset/earth/Earth_metallicRoughness.jpeg";
import Normal from "../../../../asset/earth/Earth_normal.jpeg";
import Emissive from "../../../../asset/earth/Earth_emissive.jpeg";
import PlanetCloudBase from "../../../../asset/earth/Clouds.jpeg";

import { loadTexture } from "../texture/loadTexture";
import { applyTacticalSurface } from "../tactical/tacticalSurface";
import { createSurfaceAtmosphere } from "../tactical/atmosphere";
import { createOrbitalPlane } from "../tactical/hudShell";
import { rigPlanet } from "../tactical/planet";
import { StationData } from "../tactical/stations";
import { COLOR } from "../tactical/palette";

const RADIUS = 25;

export const Earth = async (
  { Px = 0, Py = 0, Pz = 0 },
  stations: StationData[] = []
): Promise<THREE.Group> => {
  const group = new THREE.Group();
  const [base, roughnessMap, normalMap, emissive, clouds] = await Promise.all(
    [PlanetBase, PlanetMetalic, Normal, Emissive, PlanetCloudBase].map((url) =>
      loadTexture(url)
    )
  );
  base.colorSpace = THREE.SRGBColorSpace;
  emissive.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshStandardMaterial({
    map: base,
    metalness: 0,
    // roughen the oceans: a bright sun glint pulls focus from the sites
    roughness: 1,
    normalMap,
    normalScale: new THREE.Vector2(1, 1),
    roughnessMap,
    emissiveMap: emissive,
    emissiveIntensity: 1.4,
    emissive: COLOR.ice,
  });
  // ocean mask lives in the green channel of the roughness map
  const uniforms = applyTacticalSurface(material, {
    mode: "coast",
    mask: roughnessMap,
    maskThreshold: [0.68, 0.78],
    maskTexel: [0.0005, 0.001],
    grade: 0.75,
    lineIntensity: 0.5,
    nightEmissiveOnly: true,
    oceanRoughnessFloor: 0.8,
  });
  const surface = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 96, 96), material);

  const cloudsMesh = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS + 0.6, 64, 64),
    new THREE.MeshStandardMaterial({
      alphaMap: clouds,
      color: COLOR.steel.clone().multiplyScalar(0.5),
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    })
  );

  group.add(surface, cloudsMesh, createSurfaceAtmosphere(RADIUS), createOrbitalPlane(RADIUS));
  group.position.set(Px, Py, Pz);

  return rigPlanet({
    group,
    surface,
    clouds: cloudsMesh,
    uniforms: [uniforms],
    stations,
    radius: RADIUS,
  });
};
