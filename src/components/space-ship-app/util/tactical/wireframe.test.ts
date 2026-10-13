import * as THREE from 'three';
import { toHologram, setHighlight, setLineFade } from './wireframe';

test('batches rigid geometry without losing world bounds or moving assemblies', () => {
  const root = new THREE.Group();
  root.position.set(7, 2, -3);
  root.scale.setScalar(0.8);
  const wheel = new THREE.Group();
  wheel.userData.holoMoving = true;
  wheel.position.x = 2;
  root.add(wheel);
  for (let i = 0; i < 8; i++) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.6));
    part.position.set(i / 3, i % 2, 0);
    (i < 4 ? root : wheel).add(part);
  }
  const line = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2, 0, 0), new THREE.Vector3(-2, 3, 0)]));
  line.userData.holoLine = true;
  root.add(line);
  const before = new THREE.Box3().setFromObject(root);
  toHologram(root);
  const after = new THREE.Box3().setFromObject(root);
  expect(before.min.distanceTo(after.min)).toBeLessThan(1e-5);
  expect(before.max.distanceTo(after.max)).toBeLessThan(1e-5);
  let draws = 0;
  root.traverse(o => { if ((o as THREE.Mesh).isMesh || (o as THREE.LineSegments).isLineSegments) draws++; });
  expect(draws).toBe(4);
  const staticBounds = new THREE.Box3().setFromObject(root.children.find(o => (o as THREE.Mesh).isMesh)!);
  const wheelBounds = new THREE.Box3().setFromObject(wheel);
  wheel.rotation.z = Math.PI / 2;
  root.updateMatrixWorld(true);
  expect(new THREE.Box3().setFromObject(wheel).max.y).toBeGreaterThan(wheelBounds.max.y);
  expect(new THREE.Box3().setFromObject(root.children.find(o => (o as THREE.Mesh).isMesh)!)).toEqual(staticBounds);
  setHighlight(root, true);
  expect(root.userData.hologram.fillMat.opacity).toBeGreaterThan(0.1);
  setLineFade(root, 0.5);
  expect(root.userData.hologram.lineMat.opacity).toBeCloseTo(0.225);
  setHighlight(root, false);
  expect(root.userData.hologram.lineMat.color.equals(root.userData.hologram.baseLine)).toBe(true);
});
