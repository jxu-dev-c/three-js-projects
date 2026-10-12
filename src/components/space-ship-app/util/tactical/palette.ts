import * as THREE from "three";

// Shared tactical palette — mirrors the CSS tokens in index.css
export const HEX = {
  ice: "#dbe9ff",
  steel: "#8fb3d9",
  steelDeep: "#3d5a80",
  accent: "#ff7a2f",
  ok: "#7fe0b0",
};

export const COLOR = {
  ice: new THREE.Color(HEX.ice),
  steel: new THREE.Color(HEX.steel),
  steelDeep: new THREE.Color(HEX.steelDeep),
  accent: new THREE.Color(HEX.accent),
  ok: new THREE.Color(HEX.ok),
};

// Bloom only catches values above its threshold, so line colors are pushed into HDR
export const glow = (color: THREE.Color, intensity: number) =>
  color.clone().multiplyScalar(intensity);
