import * as THREE from "three";

// Damped camera that idles on the planet overview and flies in to frame a
// selected site. Framing works in screen space: UI insets describe the free
// region (between header, panel, sheet...), a lens shift centres the subject
// in that region, and the focus distance makes the model fit inside it.

export interface FocusTarget {
  object: THREE.Object3D;
  radius: number;
  planet: THREE.Object3D;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Travel {
  from: THREE.Vector3;
  fromTarget: THREE.Vector3;
  t: number;
  // wall-clock start, so slow frames (shader compiles) cannot stretch a flight
  startedAt: number;
  duration: number;
}
const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
// share of the free region's smaller side that the subject's radius spans
const FOCUS_FILL = 0.4;
// phones leave only a short strip above the sheet, so the model fills more of it
const FOCUS_FILL_COMPACT = 0.52;
const OVERVIEW_FILL = 0.42;

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  basePosition: THREE.Vector3;
  baseTarget: THREE.Vector3;
  mouse = { x: 0, y: 0 };
  // planet radius to keep in frame on the overview (narrow screens back off)
  overviewRadius = 0;
  insets: { overview: Insets; focus: Insets } = { overview: NO_INSETS, focus: NO_INSETS };

  private focus: FocusTarget | null = null;
  private travel: Travel | null = null;
  private baseFov: number;
  private control = new THREE.Vector3();
  private pullBack = new THREE.Vector3();
  private flightLook = new THREE.Vector3();
  private position = new THREE.Vector3();
  private target = new THREE.Vector3();
  private goalPosition = new THREE.Vector3();
  private goalTarget = new THREE.Vector3();
  private shift = new THREE.Vector2();
  private goalShift = new THREE.Vector2();
  private site = new THREE.Vector3();
  private planetCenter = new THREE.Vector3();
  private outward = new THREE.Vector3();
  private toCamera = new THREE.Vector3();
  private parallax = new THREE.Vector3();
  private baseDirection = new THREE.Vector3();
  private clock = new THREE.Clock();

  constructor(
    camera: THREE.PerspectiveCamera,
    basePosition: THREE.Vector3,
    baseTarget: THREE.Vector3
  ) {
    this.camera = camera;
    this.baseFov = camera.fov;
    this.basePosition = basePosition.clone();
    this.baseTarget = baseTarget.clone();
    this.position.copy(basePosition);
    this.target.copy(baseTarget);
    camera.position.copy(basePosition);
    camera.lookAt(baseTarget);
  }

  // fly to another planet's overview along an arc
  travelTo(target: THREE.Vector3, position: THREE.Vector3, duration: number) {
    this.travel = {
      from: this.position.clone(),
      fromTarget: this.target.clone(),
      t: 0,
      startedAt: performance.now(),
      duration,
    };
    this.baseTarget.copy(target);
    this.basePosition.copy(position);
  }

  // 0 → 1 across a flight, 1 when parked
  get progress() {
    return this.travel ? this.travel.t : 1;
  }

  get lookTarget() {
    return this.target;
  }

  setFocus(focus: FocusTarget | null) {
    this.focus = focus;
  }

  setInsets(insets: { overview: Insets; focus: Insets }) {
    this.insets = insets;
  }

  // pixel offset from the viewport centre to the free region's centre
  private regionShift(insets: Insets, out: THREE.Vector2) {
    return out.set((insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2);
  }

  // distance at which a sphere of `radius` spans `fill` of the free region
  private fitDistance(radius: number, insets: Insets, fill: number) {
    const width = window.innerWidth - insets.left - insets.right;
    const height = window.innerHeight - insets.top - insets.bottom;
    const targetPx = Math.max(Math.min(width, height), 120) * fill;
    const pxPerUnitAtOne =
      window.innerHeight / 2 / Math.tan(THREE.MathUtils.degToRad(this.baseFov / 2));
    return Math.max((radius * pxPerUnitAtOne) / targetPx, radius * 1.6, 4);
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.1);

    if (this.focus) {
      const { object, radius, planet } = this.focus;
      object.getWorldPosition(this.site);
      planet.getWorldPosition(this.planetCenter);
      const fill = window.innerWidth < 992 ? FOCUS_FILL_COMPACT : FOCUS_FILL;
      const distance = this.fitDistance(radius, this.insets.focus, fill);

      // approach from outside the orbit, biased toward the overview camera
      this.outward.copy(this.site).sub(this.planetCenter).normalize();
      this.toCamera.copy(this.basePosition).sub(this.site).normalize();
      this.goalPosition
        .copy(this.outward)
        .multiplyScalar(0.55)
        .addScaledVector(this.toCamera, 0.45)
        .addScaledVector(UP, 0.18)
        .normalize()
        .multiplyScalar(distance)
        .add(this.site);
      this.goalTarget.copy(this.site);
      this.regionShift(this.insets.focus, this.goalShift);
    } else {
      // keep the authored overview, backing off only when the planet would not fit
      this.baseDirection.copy(this.basePosition).sub(this.baseTarget);
      const distance = Math.max(
        this.baseDirection.length(),
        this.overviewRadius
          ? this.fitDistance(this.overviewRadius, this.insets.overview, OVERVIEW_FILL)
          : 0
      );
      this.goalPosition
        .copy(this.baseTarget)
        .addScaledVector(this.baseDirection.normalize(), distance);
      this.goalTarget
        .copy(this.baseTarget)
        .add(this.parallax.set(this.mouse.x * -2.5, this.mouse.y * -2, 0));
      this.regionShift(this.insets.overview, this.goalShift);
    }

    const k = 1 - Math.exp(-dt * (this.focus ? 2.6 : 3.5));
    this.shift.lerp(this.goalShift, k);

    if (this.travel) {
      const travel = this.travel;
      travel.t = Math.min((performance.now() - travel.startedAt) / 1000 / travel.duration, 1);
      const e = easeInOutCubic(travel.t);
      const span = travel.from.distanceTo(this.goalPosition);

      // arc: rise above the line and pull back from both planets mid-flight
      this.pullBack
        .copy(travel.from)
        .sub(travel.fromTarget)
        .normalize()
        .add(this.flightLook.copy(this.goalPosition).sub(this.goalTarget).normalize());
      this.control
        .copy(travel.from)
        .add(this.goalPosition)
        .multiplyScalar(0.5)
        .addScaledVector(UP, span * 0.12)
        .addScaledVector(this.pullBack, span * 0.12);
      const a = (1 - e) * (1 - e);
      const b = 2 * (1 - e) * e;
      const c = e * e;
      this.position
        .copy(travel.from)
        .multiplyScalar(a)
        .addScaledVector(this.control, b)
        .addScaledVector(this.goalPosition, c);

      // swing toward the destination early so the flight reads as heading somewhere
      this.target.lerpVectors(travel.fromTarget, this.goalTarget, easeInOutCubic(Math.min(travel.t / 0.55, 1)));
      this.camera.fov = this.baseFov + 9 * Math.sin(Math.PI * e);
      if (travel.t >= 1) {
        this.travel = null;
        this.camera.fov = this.baseFov;
      }
    } else {
      this.position.lerp(this.goalPosition, k);
      this.target.lerp(this.goalTarget, k);
    }

    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
    // lens shift: the look target lands at the free region's centre
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.setViewOffset(w, h, this.shift.x, this.shift.y, w, h);
  }
}
