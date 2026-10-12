import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

// Semi-real map of the bodies Cosmodyn operates around. Real positions are
// kept in AU (heliocentric, ecliptic plane = XZ, +Y north) for distance
// readouts; world positions compress them logarithmically so a flight from
// the Moon to Proxima b still fits a few seconds.

const AU_KM = 149_597_870.7;
const LY_AU = 63_241.1;
const DEG = Math.PI / 180;
// world units per log-decade of heliocentric distance
const WORLD_SCALE = 700;
// authored overview: camera offset from the planet, and the sun direction it was lit with
const CAMERA_OFFSET = new THREE.Vector3(0, -8, -95);
const AUTHORED_SUN = new THREE.Vector3(-50, 5, 43).normalize();
export const SECTOR_SELECT_EVENT = "sector-select";
export const SECTOR_PREVIEW_EVENT = "sector-preview";

export interface Body {
  num: number;
  name: string;
  code: string;
  radius: number;
  au: THREE.Vector3;
  position: THREE.Vector3;
  star: THREE.Vector3;
  // heading applied to the authored framing; the planet turns by the same
  // amount so its grid, orbits and sites present exactly as designed
  yaw: number;
  cameraPosition: THREE.Vector3;
}

const ecliptic = (au: number, lonDeg: number, latDeg = 0) =>
  new THREE.Vector3(
    Math.cos(latDeg * DEG) * Math.cos(lonDeg * DEG),
    Math.sin(latDeg * DEG),
    Math.cos(latDeg * DEG) * Math.sin(lonDeg * DEG)
  ).multiplyScalar(au);

const compress = (au: THREE.Vector3) => {
  const r = au.length();
  return r === 0 ? new THREE.Vector3() : au.clone().normalize().multiplyScalar(WORLD_SCALE * Math.log10(1 + r * 9));
};

// heading that keeps each planet's star behind-right of it, as authored
const framingYaw = (position: THREE.Vector3, star: THREE.Vector3) => {
  const toStar = star.clone().sub(position);
  return Math.atan2(toStar.x, toStar.z) - Math.atan2(AUTHORED_SUN.x, AUTHORED_SUN.z);
};
const overviewCamera = (position: THREE.Vector3, star: THREE.Vector3) =>
  CAMERA_OFFSET.clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), framingYaw(position, star))
    .add(position);

export function buildSystemLayout(): Record<number, Body> {
  const sol = new THREE.Vector3();

  const earthAu = ecliptic(1, 20);
  const earth = compress(earthAu);
  const earthCamera = overviewCamera(earth, sol);
  const earthYaw = earthCamera.clone().sub(earth);
  // the Moon hangs upper-left behind Earth in Terra's overview (384,400 km)
  const moonDir = new THREE.Vector3(130, 25, 150)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(earthYaw.x, earthYaw.z) - Math.atan2(0, -95))
    .normalize();
  const moonAu = earthAu.clone().addScaledVector(moonDir, 384_400 / AU_KM);
  const moon = earth.clone().addScaledVector(moonDir, 190);

  const jupiterAu = ecliptic(5.2, 75, 1.3);
  const jupiter = compress(jupiterAu);

  // Proxima Centauri: ~268,000 AU at ecliptic lon 239°, lat -44.8°
  const proximaAu = ecliptic(268_000, 239, -44.8);
  const proxima = compress(proximaAu);
  // its own red dwarf lights it, placed to match the authored composition
  const proximaStar = proxima.clone().addScaledVector(AUTHORED_SUN, 600);

  const body = (num: number, name: string, code: string, radius: number, au: THREE.Vector3, position: THREE.Vector3, star: THREE.Vector3): Body => ({
    num,
    name,
    code,
    radius,
    au,
    position,
    star,
    yaw: framingYaw(position, star),
    cameraPosition: overviewCamera(position, star),
  });

  return {
    0: body(0, "Proxima b", "PRX-B", 25, proximaAu, proxima, proximaStar),
    1: body(1, "Terra", "SOL-3", 25, earthAu, earth, sol),
    2: body(2, "Luna", "SOL-3A", 15, moonAu, moon, sol),
    3: body(3, "Jupiter", "SOL-5", 25, jupiterAu, jupiter, sol),
  };
}

export function formatDistance(a: Body, b: Body) {
  const au = a.au.distanceTo(b.au);
  if (au < 0.05) return `${Math.round(au * AU_KM).toLocaleString("en-US")} KM`;
  if (au < 2000) return `${au.toFixed(2)} AU`;
  return `${(au / LY_AU).toFixed(2)} LY`;
}

// Flight time grows gently with how far the camera travels in world space
export function transitDuration(a: Body, b: Body) {
  const d = a.cameraPosition.distanceTo(b.cameraPosition);
  return 2.2 + 0.6 * Math.log10(1 + d / 50);
}

// Stars and long-range beacons for every body that is not the active sector
export function createSystemMarkers(scene: THREE.Scene, layout: Record<number, Body>) {
  const addStar = (position: THREE.Vector3, radius: number, color: THREE.Color, label: string) => {
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshBasicMaterial({ color })
    );
    star.position.copy(position);
    scene.add(star);
    const el = document.createElement("div");
    el.className = "hud-beacon hud-beacon--star";
    el.innerHTML = `<span class="hud-beacon__name">${label}</span>`;
    const tag = new CSS2DObject(el);
    tag.center.set(0.5, -0.4);
    tag.position.y = -radius;
    star.add(tag);
  };
  addStar(new THREE.Vector3(), 18, new THREE.Color(4, 3.3, 2.4), "SOL");
  addStar(layout[0].star, 8, new THREE.Color(4, 1.5, 0.8), "PROXIMA CENTAURI");

  const beacons = Object.values(layout).map((b) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "hud-beacon";
    el.innerHTML = `<span class="hud-beacon__mark"></span><span class="hud-beacon__name">${b.name}</span><span class="hud-beacon__sub"></span>`;
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      window.dispatchEvent(new CustomEvent(SECTOR_SELECT_EVENT, { detail: { num: b.num } }));
    });
    el.addEventListener("mouseenter", () =>
      window.dispatchEvent(new CustomEvent(SECTOR_PREVIEW_EVENT, { detail: { num: b.num } }))
    );
    const marker = new CSS2DObject(el);
    marker.center.set(0, 1);
    marker.position.copy(b.position).add(new THREE.Vector3(0, b.radius * 1.25, 0));
    scene.add(marker);
    return { body: b, marker, sub: el.querySelector(".hud-beacon__sub") as HTMLElement };
  });

  const setActive = (num: number) => {
    const active = layout[num];
    beacons.forEach(({ body, marker, sub }) => {
      marker.visible = body.num !== num;
      sub.textContent = `${body.code} · ${formatDistance(active, body)}`;
    });
  };

  return { setActive };
}
