import * as THREE from "three";

// Resume after a paint, rather than running every queued job before that paint.
export const yieldToFrame = () => new Promise<void>((resolve) => {
  requestAnimationFrame(() => window.setTimeout(resolve, 0));
});

export async function preparePlanet(
  group: THREE.Group,
  renderer: THREE.WebGLRenderer,
  camera: THREE.Camera,
  scene: THREE.Scene
) {
  const textures = new Set<THREE.Texture>();
  group.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    if (!material) return;
    (Array.isArray(material) ? material : [material]).forEach((entry) => {
      Object.values(entry).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });
  for (const texture of Array.from(textures)) {
    await yieldToFrame();
    renderer.initTexture(texture);
  }
  await yieldToFrame();
  // Compile with the actual scene lights while the destination is still detached.
  await renderer.compileAsync(group, camera, scene);
}
