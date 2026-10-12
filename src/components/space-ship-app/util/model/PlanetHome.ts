import * as THREE from "three";
import PlanetBase from "../../../../asset/continental/Planet_continental_baseColor.jpeg";
import PlanetMetalic from "../../../../asset/continental/Planet_continental_metallicRoughness.png";
import PlanetNormal from "../../../../asset/continental/Planet_continental_normal.jpeg";
import PlanetCloudBase from "../../../../asset/continental/planet_continental_cloud_baseColor.png";
import PlanetCloudNormal from "../../../../asset/continental/planet_continental_cloud_normal.jpeg";

import { loadTexture } from "../texture/loadTexture";
import { applyTacticalSurface } from "../tactical/tacticalSurface";
import { createAtmosphere, createOrbitalPlane } from "../tactical/hudShell";
import { rigPlanet } from "../tactical/planet";
import { StationData } from "../tactical/stations";
import { COLOR } from "../tactical/palette";

const RADIUS = 25;

// Proxima Centauri B
export const HomePlanet = async (
  { Px = 0, Py = 0, Pz = 0 },
  stations: StationData[] = []
): Promise<THREE.Group> => {
  const group = new THREE.Group();
  const [base, roughnessMap, normalMap, clouds, cloudsNormal] = await Promise.all(
    [PlanetBase, PlanetMetalic, PlanetNormal, PlanetCloudBase, PlanetCloudNormal].map(
      (url) => loadTexture(url)
    )
  );
  base.colorSpace = THREE.SRGBColorSpace;
  clouds.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshStandardMaterial({
    map: base,
    // roughen the oceans: a hot sun glint blooms into a blocky glare
    roughness: 2,
    roughnessMap,
    metalnessMap: roughnessMap,
    normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
  });
  // land/ocean split lives in the green channel of the roughness map
  const uniforms = applyTacticalSurface(material, {
    mode: "coast",
    mask: roughnessMap,
    maskThreshold: [0.35, 0.55],
    maskTexel: [0.0007, 0.0011],
    grade: 0.7,
    lineIntensity: 0.5,
  });
  const surface = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 96, 96), material);

  const cloudsMesh = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS + 0.8, 64, 64),
    new THREE.MeshStandardMaterial({
      map: clouds,
      normalMap: cloudsNormal,
      color: COLOR.steel.clone().multiplyScalar(0.45),
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
    })
  );

  group.add(surface, cloudsMesh, createAtmosphere(34), createOrbitalPlane(RADIUS));
  group.position.set(Px, Py, Pz);

  return rigPlanet({
    group,
    surface,
    surfaceSpeed: 0.025,
    clouds: cloudsMesh,
    cloudSpeed: 0.06,
    uniforms: [uniforms],
    stations,
    radius: RADIUS,
  });
};
