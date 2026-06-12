// Thin-film iridescence — a dark silk ribbon undulating behind the
// Philosophy quote. The sheen shifts green -> blue -> violet with viewing
// angle, the way light plays across a raven's feather. Normals come from
// screen-space derivatives so the displaced surface shades correctly.

import * as THREE from 'three';
import { makeRenderer, autoSize, renderLoop, GLSL_NOISE, PALETTE, IS_MOBILE, REDUCED_MOTION } from './utils.js';

export function initIridescence(canvas) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 40);
  camera.position.z = 7.5;

  const SEG_X = IS_MOBILE ? 120 : 240;
  const geometry = new THREE.PlaneGeometry(16, 4.2, SEG_X, 40);

  const uniforms = {
    uTime: { value: 0 },
    uIrid: { value: PALETTE.iridescent },
    uCopper: { value: PALETTE.copper },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormal;
      uniform float uTime;
      ${GLSL_NOISE}

      const vec2 PLANE = vec2(16.0, 4.2); // must match PlaneGeometry dims

      // the ribbon surface as a pure function of uv, so we can sample
      // neighbours and build a smooth analytic normal (screen-space
      // derivative normals flat-shade each triangle into visible facets)
      vec3 surfacePoint(vec2 suv) {
        vec3 p = vec3((suv - 0.5) * PLANE, 0.0);
        float t = uTime;
        // layered undulation: broad fbm swell plus a slow travelling wave
        p.z += fbm(suv * vec2(3.0, 1.4) + vec2(-t * 0.05, t * 0.02)) * 1.5;
        p.z += sin(suv.x * 5.5 + t * 0.12) * 0.35;
        p.y += sin(suv.x * 2.5 - t * 0.05) * 0.25;
        return p;
      }

      void main() {
        vUv = uv;
        vec3 p = surfacePoint(uv);

        float e = 0.004;
        vec3 tx = surfacePoint(uv + vec2(e, 0.0)) - p;
        vec3 ty = surfacePoint(uv + vec2(0.0, e)) - p;
        vNormal = normalize(mat3(modelMatrix) * normalize(cross(tx, ty)));

        vec4 w = modelMatrix * vec4(p, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vWorld;
      varying vec3 vNormal;
      uniform float uTime;
      uniform vec3 uIrid;
      uniform vec3 uCopper;
      ${GLSL_NOISE}

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorld);
        float ndv = abs(dot(N, V));

        // interference phase: viewing angle + a drifting "film thickness"
        float phase = (1.0 - ndv) * 6.0 + fbm(vUv * vec2(5.0, 2.5) + uTime * 0.04) * 4.0;
        vec3 w3 = 0.5 + 0.5 * cos(phase + vec3(0.0, 1.35, 2.7));

        // bias the spectrum to the brand: green leads, blue-violet follows,
        // copper only as the faintest warm flash
        vec3 sheen = uIrid * 1.25 * w3.g
                   + vec3(0.30, 0.36, 0.58) * w3.b
                   + uCopper * 0.30 * w3.r;

        vec3 base = vec3(0.075, 0.083, 0.105); // near storm-deep
        float fres = pow(1.0 - ndv, 2.2);
        vec3 col = base + sheen * (0.16 + fres * 0.55);

        float edge = smoothstep(0.0, 0.10, vUv.x) * smoothstep(1.0, 0.90, vUv.x)
                   * smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
        gl_FragColor = vec4(col, edge * 0.85);
      }
    `,
  });

  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.rotation.set(-0.5, 0, -0.14);
  ribbon.position.y = -0.1;
  scene.add(ribbon);

  autoSize(canvas, renderer, camera);

  // gentle parallax against the cursor
  const tilt = { x: 0, y: 0 };
  const tiltTarget = { x: 0, y: 0 };
  if (!IS_MOBILE && !REDUCED_MOTION) {
    window.addEventListener('pointermove', (e) => {
      tiltTarget.x = (e.clientY / window.innerHeight - 0.5) * 0.07;
      tiltTarget.y = (e.clientX / window.innerWidth - 0.5) * 0.10;
    }, { passive: true });
  }

  renderLoop(canvas, (t) => {
    uniforms.uTime.value = t;
    tilt.x += (tiltTarget.x - tilt.x) * 0.04;
    tilt.y += (tiltTarget.y - tilt.y) * 0.04;
    ribbon.rotation.x = -0.5 + tilt.x;
    ribbon.rotation.y = tilt.y;
    renderer.render(scene, camera);
  });
}
