import * as THREE from "three";
export const loadTexture = async (url: any, type = "regular"):Promise<THREE.Texture> => {
  let textureLoader: any;
  switch (type) {
    case "regular":
      textureLoader = new THREE.TextureLoader();
      break;
    case "cube":
      textureLoader = new THREE.CubeTextureLoader();
      break;
    default:
      break;
  }

  return new Promise((resolve, reject) => {
    textureLoader.load(url, (texture: any) => {
      resolve(texture);
    }, undefined, reject);
  });
};
