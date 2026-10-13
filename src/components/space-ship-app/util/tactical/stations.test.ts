import * as THREE from 'three';
import { buildStations, pickStation, StationData } from './stations';

jest.mock('./preparation', () => ({ yieldToFrame: () => Promise.resolve() }));
jest.mock('three/examples/jsm/renderers/CSS2DRenderer.js', () => {
  const THREE = require('three');
  return { CSS2DObject: class extends THREE.Object3D {
    center = new THREE.Vector2();
    element: HTMLElement;
    constructor(element: HTMLElement) { super(); this.element = element; }
  } };
});

const data = ['a', 'b'].map(id => ({
  id, name: id, type: 'relaySat', kind: 'orbit', readout: { alt: 'orbit', status: 'online' },
})) as StationData[];

test('hover transfers between sites without clearing the selected highlight or a newer hover', async () => {
  const planet = new THREE.Group();
  const { registry, setFocus } = await buildStations(planet, { planet: { mesh: planet, radius: 25 } }, data);
  const a = registry.get('a')!;
  const b = registry.get('b')!;
  setFocus('a');
  b.hover(true);
  a.hover(false);
  expect(a.pin.element.classList.contains('is-active')).toBe(true);
  expect(b.pin.element.classList.contains('is-active')).toBe(true);
  b.hover(false);
  expect(a.pin.element.classList.contains('is-active')).toBe(true);
  expect(b.pin.element.classList.contains('is-active')).toBe(false);
  setFocus(null);
  a.pin.element.dispatchEvent(new Event('mouseenter'));
  expect(a.pin.element.classList.contains('is-active')).toBe(true);
  b.hover(true);
  a.pin.element.dispatchEvent(new Event('mouseleave'));
  expect(b.pin.element.classList.contains('is-active')).toBe(true);
  expect(a.pin.element.classList.contains('is-active')).toBe(false);
});

test('picking ignores hidden sites and sites behind the camera', async () => {
  const planet = new THREE.Group();
  const { registry } = await buildStations(planet, { planet: { mesh: planet, radius: 25 } }, data.slice(0, 1));
  const entry = registry.get('a')!;
  const object = entry.objects[0];
  object.removeFromParent();
  object.position.set(0, 0, -10);
  object.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 100);
  expect(pickStation(registry, camera, innerWidth / 2, innerHeight / 2)).toBe('a');
  entry.pin.label.visible = false;
  expect(pickStation(registry, camera, innerWidth / 2, innerHeight / 2)).toBeNull();
  entry.pin.label.visible = true;
  object.position.z = 10;
  object.updateMatrixWorld(true);
  expect(pickStation(registry, camera, innerWidth / 2, innerHeight / 2)).toBeNull();
});
