import * as THREE from "three";
import { COLOR } from "./palette";
import { ecliptic } from "./systemMap";

// The sky as the ship's star tracker plots it rather than as a photograph:
// catalog points in a few magnitude classes, the Milky Way as a halftone band,
// and a faint ecliptic/galactic reference grid. Oriented on the real sky, so
// Proxima sits on the plotted galactic equator.

const DEG = Math.PI / 180;
// inside the camera's far plane; the group rides with the camera so it reads as infinity
const RADIUS = 9000;
export const STAR_COUNT = 2600;
// share of stars drawn toward the galactic plane rather than uniformly
const DISK_SHARE = 0.4;
const DISK_SIGMA = 12 * DEG;
// power-up: the chart comes on in discrete steps once the scene starts rendering
const REVEAL_DELAY = 0.3;
const REVEAL_LENGTH = 1.3;
const REVEAL_STEPS = 6;

// Galactic frame in scene (ecliptic) coordinates: x to the galactic centre,
// z to the north galactic pole. The scene's axes are a mirror of the true
// ecliptic frame, so y comes from x × z instead of z × x.
const galacticPole = ecliptic(1, 180.02, 29.81).normalize();
const galacticCentre = ecliptic(1, 266.84, -5.54);
galacticCentre.addScaledVector(galacticPole, -galacticCentre.dot(galacticPole)).normalize();
const galacticY = galacticCentre.clone().cross(galacticPole).normalize();

export const GALACTIC_BASIS = { x: galacticCentre, y: galacticY, z: galacticPole };

// rows are the galactic axes, so eclToGal * dir gives galactic coordinates
export const eclToGal = new THREE.Matrix3().set(
  galacticCentre.x, galacticCentre.y, galacticCentre.z,
  galacticY.x, galacticY.y, galacticY.z,
  galacticPole.x, galacticPole.y, galacticPole.z
);

export const galacticLatitude = (dir: THREE.Vector3) =>
  Math.asin(THREE.MathUtils.clamp(dir.clone().normalize().dot(galacticPole), -1, 1));

// mulberry32: small seeded PRNG so the sky is identical on every load
const prng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function generateStars(count = STAR_COUNT, seed = 1977) {
  const rand = prng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
  const positions = new Float32Array(count * 3);
  const magnitudes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const dir = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    if (rand() < DISK_SHARE) {
      // half the disk stars crowd toward the galactic centre
      const l = rand() < 0.5 ? rand() * Math.PI * 2 : gauss() * 60 * DEG;
      const b = gauss() * DISK_SIGMA;
      dir
        .set(0, 0, 0)
        .addScaledVector(galacticCentre, Math.cos(b) * Math.cos(l))
        .addScaledVector(galacticY, Math.cos(b) * Math.sin(l))
        .addScaledVector(galacticPole, Math.sin(b));
    } else {
      const z = rand() * 2 - 1;
      const phi = rand() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      dir.set(r * Math.cos(phi), z, r * Math.sin(phi));
    }
    dir.toArray(positions, i * 3);
    // magnitude classes 0 (faint) .. 3 (tracker reference star)
    const m = rand();
    magnitudes[i] = m < 0.015 ? 3 : m < 0.07 ? 2 : m < 0.25 ? 1 : 0;
    seeds[i] = rand();
  }
  return { positions, magnitudes, seeds };
}

const NOISE = /* glsl */ `
  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x),
          mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
          mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  float fbm(vec3 p) {
    return 0.55 * noise3(p) + 0.3 * noise3(p * 2.1) + 0.15 * noise3(p * 4.3);
  }
`;

function createDome(uniforms: Record<string, THREE.IUniform>) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      eclToGal: { value: eclToGal },
      gridColor: { value: COLOR.steel },
      galColor: { value: COLOR.ice },
      bandColor: { value: COLOR.steel },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      #define DEG 0.017453292
      uniform mat3 eclToGal;
      uniform float pixelRatio;
      uniform float reveal;
      uniform vec3 gridColor;
      uniform vec3 galColor;
      uniform vec3 bandColor;
      varying vec3 vDir;
      ${NOISE}

      // angular distance to the nearest multiple of spacing, as a ~1px line
      float gridLine(float angle, float spacing, float stretch, float px) {
        float d = abs(fract(angle / spacing + 0.5) - 0.5) * spacing * stretch;
        return 1.0 - smoothstep(0.4 * px, 1.3 * px, d);
      }

      void main() {
        vec3 dir = normalize(vDir);
        // angle covered by one pixel; continuous across the atan seam, unlike fwidth(lon)
        float px = max(length(dFdx(dir)), length(dFdy(dir)));

        // ecliptic reference grid, 30° both ways, meridians fading at the poles
        float lat = asin(clamp(dir.y, -1.0, 1.0));
        float lon = atan(dir.z, dir.x);
        float cosLat = cos(lat);
        float grid = max(
          gridLine(lat, 30.0 * DEG, 1.0, px),
          gridLine(lon, 30.0 * DEG, cosLat, px) * smoothstep(0.08, 0.35, cosLat)
        );
        // the ecliptic itself, dashed every 5°
        float ecl = gridLine(lat, 360.0 * DEG, 1.0, px) * step(0.45, fract(lon / (5.0 * DEG)));

        // galactic equator, dashed every 2°, with ticks every 10° of longitude
        // and a longer one marking the galactic centre
        vec3 g = eclToGal * dir;
        float b = asin(clamp(g.z, -1.0, 1.0));
        float l = atan(g.y, g.x);
        float cosB = cos(b);
        float gal = gridLine(b, 360.0 * DEG, 1.0, px) * step(0.35, fract(l / (2.0 * DEG)));
        float tickLength = abs(l) < 1.0 * DEG ? 2.6 * DEG : 0.9 * DEG;
        float ticks = gridLine(l, 10.0 * DEG, cosB, px) * (1.0 - step(tickLength, abs(b)));

        // Milky Way as screen-space halftone: dot size follows disk density
        float width = 8.0 * DEG + 6.0 * DEG * exp(-l * l / 0.5);
        float density = exp(-b * b / (width * width));
        density *= smoothstep(0.25, 0.75, fbm(g * 3.2 + 7.0));
        float cell = 4.0 * pixelRatio;
        vec2 cellUv = fract(gl_FragCoord.xy / cell) - 0.5;
        float dotRadius = sqrt(density) * cell * 0.42;
        float halftone = clamp(dotRadius - length(cellUv) * cell + 0.5, 0.0, 1.0);

        vec3 color = gridColor * grid * 0.035
          + gridColor * ecl * 0.09
          + galColor * (gal * 0.1 + ticks * 0.14)
          + bandColor * halftone * 0.07;
        gl_FragColor = vec4(color * reveal, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 64, 32), material);
  dome.name = "star-chart-grid";
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  return dome;
}

function createStars(uniforms: Record<string, THREE.IUniform>) {
  const { positions, magnitudes, seeds } = generateStars();
  const geometry = new THREE.BufferGeometry();
  const scaled = positions.map((v) => v * RADIUS * 0.98);
  geometry.setAttribute("position", new THREE.BufferAttribute(scaled, 3));
  geometry.setAttribute("aMag", new THREE.BufferAttribute(magnitudes, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...uniforms,
      faintColor: { value: COLOR.steel },
      brightColor: { value: COLOR.ice },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float pixelRatio;
      uniform float time;
      attribute float aMag;
      attribute float aSeed;
      varying float vMag;
      varying float vSize;
      varying float vLevel;
      varying float vSeed;

      float hash11(float p) {
        p = fract(p * 0.1031);
        p *= p + 33.33;
        p *= p + p;
        return fract(p);
      }

      void main() {
        vMag = aMag;
        vSeed = aSeed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        float size = aMag > 2.5 ? 11.0 : 1.3 + aMag * 0.85;
        vSize = size * pixelRatio;
        gl_PointSize = vSize;

        // brightness per magnitude class, kept under the bloom threshold
        vLevel = aMag > 2.5 ? 0.85 : aMag > 1.5 ? 0.62 : aMag > 0.5 ? 0.42 : 0.26;
        // a few stars drop out in quantized steps, like a noisy sensor readout
        if (fract(aSeed * 91.7) > 0.92) {
          float tick = floor(time * (0.6 + aSeed * 1.8) + aSeed * 40.0);
          vLevel *= hash11(tick + aSeed * 113.0) < 0.3 ? 0.3 : 1.0;
        }
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float pixelRatio;
      uniform float reveal;
      uniform vec3 faintColor;
      uniform vec3 brightColor;
      varying float vMag;
      varying float vSize;
      varying float vLevel;
      varying float vSeed;

      void main() {
        float alpha = 1.0;
        if (vMag > 2.5) {
          // tracker reference star: solid core inside an open "+" reticle
          vec2 q = abs(gl_PointCoord - 0.5) * vSize;
          float core = step(max(q.x, q.y), 1.1 * pixelRatio);
          float arm = step(min(q.x, q.y), 0.5 * pixelRatio)
            * step(2.6 * pixelRatio, max(q.x, q.y))
            * step(max(q.x, q.y), 5.0 * pixelRatio);
          alpha = max(core, arm * 0.45);
          if (alpha <= 0.0) discard;
        }
        vec3 color = mix(faintColor, brightColor, vMag / 3.0);
        // the faintest hint of spectral class, nowhere near photographic colour
        color *= 1.0 + (vSeed - 0.5) * vec3(0.06, 0.0, -0.06);
        gl_FragColor = vec4(color * vLevel * alpha * reveal, 1.0);
      }
    `,
  });
  const stars = new THREE.Points(geometry, material);
  stars.name = "star-chart-stars";
  stars.renderOrder = -1;
  stars.frustumCulled = false;
  return stars;
}

export function createStarChart() {
  // shared uniform objects, so one write updates both materials
  const uniforms = {
    time: { value: 0 },
    reveal: { value: 0 },
    // matches the renderer's clamp in initThree
    pixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
  };
  const group = new THREE.Group();
  group.name = "star-chart";
  group.add(createDome(uniforms), createStars(uniforms));

  let shown = 0;
  group.userData.update = (dt: number, elapsed: number, camera: THREE.Camera) => {
    group.position.copy(camera.position);
    uniforms.time.value = elapsed;
    shown += dt;
    const t = THREE.MathUtils.clamp((shown - REVEAL_DELAY) / REVEAL_LENGTH, 0, 1);
    uniforms.reveal.value = Math.ceil(t * REVEAL_STEPS) / REVEAL_STEPS;
  };
  return group;
}
