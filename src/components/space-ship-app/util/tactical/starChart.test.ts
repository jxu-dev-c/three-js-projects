import * as THREE from 'three';
import { eclToGal, galacticLatitude, generateStars, GALACTIC_BASIS, STAR_COUNT } from './starChart';
import { buildSystemLayout, ecliptic } from './systemMap';

// systemMap only needs the label class for markers, not for the layout used here
jest.mock('three/examples/jsm/renderers/CSS2DRenderer.js', () => ({ CSS2DObject: class {} }));

const DEG = Math.PI / 180;

test('generates the same unit-length catalog on every load', () => {
  const a = generateStars();
  const b = generateStars();
  expect(a.positions.length).toBe(STAR_COUNT * 3);
  expect(Array.from(a.positions.slice(0, 30))).toEqual(Array.from(b.positions.slice(0, 30)));
  for (let i = 0; i < STAR_COUNT; i += 97) {
    expect(new THREE.Vector3().fromArray(a.positions, i * 3).length()).toBeCloseTo(1, 5);
  }
  const reticles = Array.from(a.magnitudes).filter((m) => m === 3).length;
  expect(reticles).toBeGreaterThan(20);
  expect(reticles).toBeLessThan(70);
});

test('crowds stars toward the galactic plane', () => {
  const { positions } = generateStars();
  let disk = 0;
  for (let i = 0; i < STAR_COUNT; i++) {
    if (Math.abs(galacticLatitude(new THREE.Vector3().fromArray(positions, i * 3))) < 15 * DEG) disk++;
  }
  // a uniform sky would put ~26% of stars within ±15°
  expect(disk / STAR_COUNT).toBeGreaterThan(0.45);
});

test('orients the chart on the real galactic frame', () => {
  const { x, y, z } = GALACTIC_BASIS;
  expect(x.dot(z)).toBeCloseTo(0, 6);
  expect(y.dot(z)).toBeCloseTo(0, 6);
  const centre = ecliptic(1, 266.84, -5.54).normalize().applyMatrix3(eclToGal);
  expect(centre.x).toBeGreaterThan(0.999);
  // Proxima Centauri sits at galactic latitude -1.9°, right on the plotted equator
  const proxima = buildSystemLayout()[0].au;
  expect(Math.abs(galacticLatitude(proxima)) / DEG).toBeLessThan(3);
});
