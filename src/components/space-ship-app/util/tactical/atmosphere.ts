import * as THREE from "three";

// A thin, light-aware atmosphere, art-directed rather than a full scattering
// simulation. Normal alpha blending keeps its color below the bloom threshold.
export function createSurfaceAtmosphere(
  planetRadius: number,
  {
    thickness = 0.035,
    opacity = 0.55,
    tint = new THREE.Color(0x76baff),
    sunsetTint = new THREE.Color(0xf1bb93),
  } = {}
) {
  const radius = planetRadius * (1 + thickness);
  const material = new THREE.ShaderMaterial({
    lights: true,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.NormalBlending,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.lights,
      {
        planetRadius: { value: planetRadius },
        atmosphereRadius: { value: radius },
        atmosphereOpacity: { value: opacity },
        atmosphereTint: { value: tint },
        sunsetTint: { value: sunsetTint },
      },
    ]),
    vertexShader: /* glsl */ `
      varying vec3 vAtmosphereNormal;
      varying vec3 vAtmospherePosition;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vAtmosphereNormal = normalize(normalMatrix * normal);
        vAtmospherePosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <lights_pars_begin>
      uniform float planetRadius;
      uniform float atmosphereRadius;
      uniform float atmosphereOpacity;
      uniform vec3 atmosphereTint;
      uniform vec3 sunsetTint;
      varying vec3 vAtmosphereNormal;
      varying vec3 vAtmospherePosition;

      void main() {
        vec3 normal = normalize(vAtmosphereNormal);
        vec3 toEye = normalize(-vAtmospherePosition);
        float facing = clamp(dot(normal, toEye), 0.0, 1.0);

        // View-ray distance from the planet center. Density falls away above
        // the solid limb, with a soft outer boundary rather than a bright ring.
        float rayRadius = atmosphereRadius * sqrt(max(1.0 - facing * facing, 0.0));
        float altitude = max((rayRadius - planetRadius) / (atmosphereRadius - planetRadius), 0.0);
        float density = exp(-3.0 * altitude) * (1.0 - smoothstep(0.65, 1.0, altitude));
        float rim = pow(1.0 - facing, 3.0);

        float daylight = 0.0;
        float twilight = 0.0;
        float phase = 1.0;
        #if NUM_DIR_LIGHTS > 0
          vec3 toSun = normalize(directionalLights[0].direction);
          float sunHeight = dot(normal, toSun);
          daylight = smoothstep(-0.18, 0.35, sunHeight);
          daylight *= clamp(length(directionalLights[0].color), 0.0, 1.0);
          twilight = exp(-pow(sunHeight / 0.2, 2.0)) * 0.3;
          float scatteringAngle = dot(toEye, toSun);
          phase = 0.75 * (1.0 + scatteringAngle * scatteringAngle);
        #endif

        vec3 color = mix(atmosphereTint, sunsetTint, twilight);
        float alpha = clamp(atmosphereOpacity * rim * density * daylight * phase, 0.0, 0.65);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), material);
  mesh.name = "atmosphere";
  return mesh;
}
