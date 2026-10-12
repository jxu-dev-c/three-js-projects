import * as THREE from "three";
import { COLOR } from "./palette";

// Hybrid tactical surface: keeps the photoreal maps of a MeshStandardMaterial,
// grades them toward steel blue and layers holographic line work on top
// (graticule, coastline / contour lines, scan sweep) as emissive light so the
// lines stay readable on the night side and get picked up by bloom.

export interface TacticalSurfaceOptions {
  mode: "coast" | "contour";
  // coast mode: land/ocean mask is read from the green channel
  mask?: THREE.Texture;
  maskThreshold?: [number, number];
  maskTexel?: [number, number];
  // contour mode: number of contour bands across the luminance range
  contourDensity?: number;
  grade?: number;
  tint?: THREE.Color;
  lineColor?: THREE.Color;
  lineIntensity?: number;
  gridIntensity?: number;
  scanSpeed?: number;
  scanIntensity?: number;
  nightFill?: number;
  // emissive map (city lights) is only visible on the night side
  nightEmissiveOnly?: boolean;
}

export type TacticalUniforms = Record<string, THREE.IUniform>;

const HEADER = /* glsl */ `
uniform float uTime;
uniform float uGrade;
uniform vec3 uTint;
uniform vec3 uLineColor;
uniform float uLineIntensity;
uniform float uGridIntensity;
uniform float uScanSpeed;
uniform float uScanIntensity;
uniform float uNightFill;
uniform float uHighlight;
uniform sampler2D uMask;
uniform vec2 uMaskThreshold;
uniform vec2 uMaskTexel;
uniform float uContourDensity;

// anti-aliased line at every integer of v
float tacLine(float v, float width) {
  // smoothstep with equal edges is undefined, so keep the width above zero
  float w = max(fwidth(v) * width, 1e-4);
  float d = abs(fract(v - 0.5) - 0.5);
  return 1.0 - smoothstep(0.0, w, d);
}

float tacMask(vec2 uv) {
  return smoothstep(uMaskThreshold.x, uMaskThreshold.y, texture2D(uMask, uv).g);
}
`;

const AFTER_MAP = /* glsl */ `
#include <map_fragment>
vec2 tacUv = vMapUv;
float tacLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
diffuseColor.rgb = mix(diffuseColor.rgb, tacLum * uTint, uGrade);

// graticule every 15 degrees, faded toward the poles where meridians converge
float tacPoleFade = smoothstep(0.0, 0.08, min(tacUv.y, 1.0 - tacUv.y));
float tacGrid = max(tacLine(tacUv.x * 24.0, 1.0), tacLine(tacUv.y * 12.0, 1.0)) * tacPoleFade;
float tacEquator = tacLine(tacUv.y * 2.0, 1.6) * step(0.25, tacUv.y) * step(tacUv.y, 0.75);
tacGrid = max(tacGrid * 0.6, tacEquator * 0.75);

#ifdef TAC_COAST
  float tacLand = tacMask(tacUv);
  float tacEdge =
    abs(tacMask(tacUv + vec2(uMaskTexel.x, 0.0)) - tacMask(tacUv - vec2(uMaskTexel.x, 0.0))) +
    abs(tacMask(tacUv + vec2(0.0, uMaskTexel.y)) - tacMask(tacUv - vec2(0.0, uMaskTexel.y)));
  float tacFeature = smoothstep(0.1, 0.9, tacEdge);
  // dark oceans, lighter land — the briefing-map look
  diffuseColor.rgb *= mix(0.45, 1.2, tacLand);
#else
  float tacHeight = dot(texture2D(map, tacUv, 3.0).rgb, vec3(0.299, 0.587, 0.114));
  float tacFeature = tacLine(tacHeight * uContourDensity, 1.2) * 0.7;
#endif

float tacScanD = tacUv.y - fract(uTime * uScanSpeed);
// soft, wide sweep: a quiet sense of activity that stays behind the sites
float tacScanK = tacScanD * 18.0;
float tacScan = exp(-tacScanK * tacScanK) * uScanIntensity;

vec3 tacGlow = uLineColor * uLineIntensity *
  (tacFeature * (1.0 + tacScan) + tacGrid * uGridIntensity + tacScan * 0.05);
`;

const EMISSIVE = /* glsl */ `
#ifdef USE_EMISSIVEMAP
  vec4 emissiveColor = texture2D(emissiveMap, vEmissiveMapUv);
  totalEmissiveRadiance *= emissiveColor.rgb;
#endif
#if NUM_DIR_LIGHTS > 0
  float tacSun = dot(nonPerturbedNormal, directionalLights[0].direction);
#else
  float tacSun = 0.0;
#endif
float tacNight = 1.0 - smoothstep(-0.2, 0.15, tacSun);
#ifdef TAC_NIGHT_EMISSIVE
  totalEmissiveRadiance *= tacNight;
#endif
totalEmissiveRadiance += tacGlow * mix(0.7, 1.0, tacNight) * (1.0 + uHighlight);
totalEmissiveRadiance += diffuseColor.rgb * uNightFill * tacNight;
`;

const blankMask = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
blankMask.needsUpdate = true;

export function applyTacticalSurface(
  material: THREE.MeshStandardMaterial,
  opts: TacticalSurfaceOptions
): TacticalUniforms {
  const uniforms: TacticalUniforms = {
    uTime: { value: 0 },
    uGrade: { value: opts.grade ?? 0.7 },
    uTint: { value: (opts.tint ?? COLOR.steel).clone() },
    uLineColor: { value: (opts.lineColor ?? COLOR.ice).clone() },
    uLineIntensity: { value: opts.lineIntensity ?? 1 },
    uGridIntensity: { value: opts.gridIntensity ?? 0.22 },
    uScanSpeed: { value: opts.scanSpeed ?? 0.03 },
    uScanIntensity: { value: opts.scanIntensity ?? 0.35 },
    uNightFill: { value: opts.nightFill ?? 0.08 },
    uHighlight: { value: 0 },
    uMask: { value: opts.mask ?? blankMask },
    uMaskThreshold: {
      value: new THREE.Vector2(...(opts.maskThreshold ?? [0.4, 0.6])),
    },
    uMaskTexel: {
      value: new THREE.Vector2(...(opts.maskTexel ?? [1 / 1024, 1 / 1024])),
    },
    uContourDensity: { value: opts.contourDensity ?? 14 },
  };

  material.defines = {
    ...material.defines,
    ...(opts.mode === "coast" ? { TAC_COAST: "" } : {}),
    ...(opts.nightEmissiveOnly ? { TAC_NIGHT_EMISSIVE: "" } : {}),
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${HEADER}`)
      .replace("#include <map_fragment>", AFTER_MAP)
      .replace("#include <emissivemap_fragment>", EMISSIVE);
  };
  material.customProgramCacheKey = () =>
    `tactical-${opts.mode}-${opts.nightEmissiveOnly ? 1 : 0}`;

  return uniforms;
}
