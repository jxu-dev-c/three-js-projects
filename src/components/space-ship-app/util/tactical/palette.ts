import * as THREE from "three";

// Shared tactical palette — mirrors the CSS tokens in index.css
export const HEX = {
  ice: "#c3ccd3",
  steel: "#8b98a3",
  steelDeep: "#3a4550",
  accent: "#c49a52",
  ok: "#94ab9c",
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
