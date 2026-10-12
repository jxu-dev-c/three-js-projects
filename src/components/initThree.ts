import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { ArcballControls } from "three/examples/jsm/controls/ArcballControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import TWEEN from "@tweenjs/tween.js";

export const initThree = async ({
  camera,
  scene,
  canvas,
  width,
  height,
  mesh,
  showPerformance = false,
  RotateControls = false,
  animation,
  axisHelper = false,
  bloom = false,
  labels = false,
}: {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: any;
  width: number;
  height: number;
  mesh: THREE.Object3D[];
  axisHelper?: boolean;
  showPerformance?: boolean;
  RotateControls?: boolean;
  animation?: () => void;
  bloom?: boolean;
  labels?: boolean;
}) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  mesh.forEach((mesh) => scene.add(mesh));
  if (axisHelper) {
    scene.add(new THREE.AxesHelper(15));
  }
  const stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  canvas.appendChild(renderer.domElement);

  let composer: EffectComposer | null = null;
  if (bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(width, height), 0.7, 0.35, 0.95)
    );
    composer.addPass(new OutputPass());
  }

  let labelRenderer: CSS2DRenderer | null = null;
  if (labels) {
    labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.className = "label-layer";
    canvas.appendChild(labelRenderer.domElement);
  }

  let controls: ArcballControls | null = null;
  if (RotateControls) {
    controls = new ArcballControls(camera, renderer.domElement, scene);
  }

  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsed = clock.elapsedTime;
    TWEEN.update();
    // per-object hooks (planet spin, station orbits, shader clocks)
    mesh.forEach((object) => {
      if (object.visible) object.userData.update?.(dt, elapsed, camera);
    });
    if (animation) {
      animation();
    }
    stats.update();
    if (RotateControls && controls) {
      controls.update();
    }
    if (composer) {
      composer.render(dt);
    } else {
      renderer.render(scene, camera);
    }
    labelRenderer?.render(scene, camera);
  }
  if (showPerformance) {
    canvas.appendChild(stats.dom);
  }

  const resize = (w: number, h: number) => {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer?.setSize(w, h);
    labelRenderer?.setSize(w, h);
  };

  animate();
  return { renderer, scene, camera, controls, stats, mesh, resize };
};
