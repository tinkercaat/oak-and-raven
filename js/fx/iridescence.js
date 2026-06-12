// Raven feather — a procedural feather behind the Philosophy quote.
// Quill enters just off the bottom-right of the section; the vane sweeps
// diagonally up-left, tip resolving inside the section. Anatomy (shaft
// curve, lopsided vane, barbs, splits, rachis) is built in the fragment
// shader; the sheen shifts green -> teal-blue -> violet with viewing
// angle, monotonically, the way light plays across a raven's feather.

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
        // (kept shallow — a feather lies sleeker than silk)
        p.z += fbm(suv * vec2(3.0, 1.4) + vec2(-t * 0.05, t * 0.02)) * 1.1;
        p.z += sin(suv.x * 5.5 + t * 0.12) * 0.28;
        p.y += sin(suv.x * 2.5 - t * 0.05) * 0.2;
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

      // ---- feather anatomy --------------------------------------------------
      // One oversized feather: the quill enters just off the bottom-right
      // edge; the vane sweeps up-left, tip resolving inside the section.
      const vec2 FUV_SCALE = vec2(3.81, 1.0); // aspect-correct (16 / 4.2)
      const float QUILL_X = 4.05; // quill base, hidden just off the right edge
      const float TIP_X   = 0.18; // tip, reaching into the left of the section

      float shaftCurve(float t) {
        // rachis centreline in uv.y: enters low at the bottom-right and
        // rises toward the midline, bowing through midspan
        return 0.15 + 0.5 * t + 0.14 * sin(3.14159 * t);
      }
      float xFromT(float t) { return QUILL_X + (TIP_X - QUILL_X) * t; }

      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorld);
        float ndv = abs(dot(N, V));

        vec2 fuv = vUv * FUV_SCALE;
        float t = (QUILL_X - fuv.x) / (QUILL_X - TIP_X); // 0 at quill .. 1 at tip
        float ys = shaftCurve(t);
        float q = fuv.y - ys;               // signed offset from the shaft
        float side = sign(q);

        // shaft tangent (pointing tipward by construction), and barbs
        // sweeping tipward ~40deg off it per side
        vec2 shaftA = vec2(xFromT(t), shaftCurve(t));
        vec2 shaftB = vec2(xFromT(t + 0.01), shaftCurve(t + 0.01));
        vec2 tangent = normalize(shaftB - shaftA);
        float ba = radians(40.0) * side;
        vec2 barbDir = mat2(cos(ba), -sin(ba), sin(ba), cos(ba)) * tangent;
        vec2 barbPerp = vec2(-barbDir.y, barbDir.x);

        // vane silhouette: long bare quill, then a strongly lopsided vane —
        // broad trailing edge below the shaft, tight leading edge above.
        // The fractional outer pow rounds the tip instead of needling it.
        float prof = pow(sin(3.14159 * pow(clamp(t, 0.0, 1.0), 0.6)), 0.4);
        prof *= smoothstep(0.10, 0.30, t);
        float wSide = (side > 0.0 ? 0.15 : 0.33) * prof;

        // ragged outline: barb-tip fingers serrate the edge
        float serr = vnoise(vec2(t * 55.0, side > 0.0 ? 1.3 : 5.1));
        float wEff = wSide * (0.84 + 0.20 * serr);
        float vane = 1.0 - smoothstep(wEff * 0.70, wEff, abs(q));

        // vane splits: deeper, more frequent V-shaped separations
        float spn = vnoise(vec2(t * 18.0, side > 0.0 ? 3.7 : 8.9));
        float cut = smoothstep(0.68, 0.88, spn)
                  * smoothstep(0.25, 0.9, abs(q) / max(wSide, 1e-4));
        vane *= 1.0 - cut;

        // filaments along the barb direction
        float fiber  = vnoise(vec2(dot(fuv, barbPerp) * 170.0, dot(fuv, barbDir) * 2.5));
        float fiber2 = vnoise(vec2(dot(fuv, barbPerp) * 430.0 + 7.0, dot(fuv, barbDir) * 5.0));
        float barbs = smoothstep(0.25, 0.85, fiber * 0.65 + fiber2 * 0.35);

        // Feather sheen: hue shifts MONOTONICALLY with viewing angle
        // (green facing -> teal-blue glancing -> violet at grazing extreme)
        float grazing = 1.0 - ndv;
        vec3 sheenColor = mix(uIrid * 1.45, vec3(0.30, 0.42, 0.62),
                              smoothstep(0.35, 0.85, grazing));
        sheenColor = mix(sheenColor, vec3(0.44, 0.38, 0.64),
                         smoothstep(0.85, 1.0, grazing) * 0.6);

        // fibres vary in BRIGHTNESS (gloss), drifting slowly with time
        float shimmer = 0.55 + 0.45 * vnoise(vec2(dot(fuv, barbDir) * 3.0 + uTime * 0.15,
                                                  dot(fuv, barbPerp) * 24.0));

        // like the reference: near-black at the base, blue richest past midspan
        sheenColor = mix(sheenColor, vec3(0.30, 0.42, 0.66),
                         0.4 * smoothstep(0.4, 0.9, t));
        float bloom = 0.45 + 0.75 * smoothstep(0.2, 0.7, t);

        vec3 base = vec3(0.055, 0.062, 0.082) * (0.7 + 0.3 * barbs);
        float fres = pow(grazing, 3.0);
        vec3 col = base + sheenColor * (0.05 + fres * 1.15) * (0.25 + 0.75 * barbs)
                 * shimmer * bloom;

        // rachis: a thin lit ridge along the longer bare quill that melts
        // into the plumage once the vane develops (barbs cover the shaft)
        float rw = 0.007 * (1.0 - t * 0.5) + 0.002;
        float rachis = 1.0 - smoothstep(rw * 0.45, rw, abs(q));
        rachis *= smoothstep(0.0, 0.04, t) * (1.0 - smoothstep(0.38, 0.75, t));
        col = mix(col, vec3(0.15, 0.155, 0.185) + sheenColor * fres * 0.35, rachis * 0.85);

        // canvas-edge safety fade (the silhouette does the real shaping now)
        float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x)
                   * smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);

        float alpha = max(vane, rachis) * edge * 0.92;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const ribbon = new THREE.Mesh(geometry, material);
  ribbon.rotation.set(-0.5, 0, -0.2); // z-tilt drops the right side: the quill enters low
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
