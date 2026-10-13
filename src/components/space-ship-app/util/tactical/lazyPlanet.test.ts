import * as THREE from 'three';
import { createLazyPlanet, PLANET_LOADED_EVENT } from './lazyPlanet';
import { Body } from './systemMap';

jest.mock('./hudShell', () => ({ createAtmosphere: () => new (require('three').Group)() }));

const body = { num: 1, radius: 25, position: new THREE.Vector3(), yaw: 0 } as Body;
const fullPlanet = () => {
  const group = new THREE.Group();
  group.userData.setDetail = jest.fn();
  return group;
};

test('deduplicates loading and keeps the proxy until preparation finishes, using latest detail state', async () => {
  const full = fullPlanet();
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  const load = jest.fn(async () => full);
  const prepare = jest.fn(() => ready);
  const loaded = jest.fn();
  window.addEventListener(PLANET_LOADED_EVENT, loaded);
  const planet = createLazyPlanet({ body, tint: new THREE.Color(), load, prepare });
  const first = planet.userData.ensureLoaded();
  expect(planet.userData.ensureLoaded()).toBe(first);
  await Promise.resolve();
  await Promise.resolve();
  expect(prepare).toHaveBeenCalledWith(full);
  expect(planet.getObjectByName('proxy')).toBeDefined();
  expect(planet.userData.isLoaded).toBe(false);
  planet.userData.setDetail(true);
  planet.userData.setDetail(false);
  release();
  await first;
  expect(full.userData.setDetail).toHaveBeenCalledWith(false);
  expect(planet.getObjectByName('proxy')).toBeUndefined();
  expect(planet.userData.isLoaded).toBe(true);
  expect(load).toHaveBeenCalledTimes(1);
  expect(loaded).toHaveBeenCalledTimes(1);
  window.removeEventListener(PLANET_LOADED_EVENT, loaded);
});

test('failed downloads retain the proxy and can be retried', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const load = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(fullPlanet());
  const planet = createLazyPlanet({ body, tint: new THREE.Color(), load });
  expect(await planet.userData.ensureLoaded()).toBeNull();
  expect(planet.userData.isLoaded).toBe(false);
  expect(planet.getObjectByName('proxy')).toBeDefined();
  await planet.userData.ensureLoaded();
  expect(planet.userData.isLoaded).toBe(true);
  warn.mockRestore();
});

test('GPU preparation can retry without rebuilding the planet', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const load = jest.fn(async () => fullPlanet());
  const prepare = jest.fn().mockRejectedValueOnce(new Error('prepare failed')).mockResolvedValueOnce(undefined);
  const planet = createLazyPlanet({ body, tint: new THREE.Color(), load, prepare });
  await planet.userData.ensureLoaded();
  expect(planet.getObjectByName('proxy')).toBeDefined();
  await planet.userData.ensureLoaded();
  expect(load).toHaveBeenCalledTimes(1);
  expect(planet.userData.isLoaded).toBe(true);
  warn.mockRestore();
});
