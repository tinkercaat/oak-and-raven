// Murmuration — a raven-flock of particles behind the footer CTA.
// Stateless: every particle's position is a closed-form function of its seed
// and time, computed in the vertex shader, so the CPU does no per-frame work.
// The flock drifts on a slow wandering path and leans toward the cursor.

import * as THREE from 'three';
import { makeRenderer, autoSize, renderLoop, GLSL_NOISE, PALETTE, IS_MOBILE } from './utils.js';

export function initMurmuration(canvas) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
  camera.position.z = 13;

  const COUNT = IS_MOBILE ? 900 : 2200;
  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));

  const uniforms = {
    uTime: { value: 0 },
    uPx: { value: renderer.getPixelRatio() },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uMouseMix: { value: 0 },
    uIrid: { value: PALETTE.iridescent },
    uCopper: { value: PALETTE.copper },
    uCloud: { value: PALETTE.cloud },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uPx;
      uniform float uMouseMix;
      uniform vec2 uMouse;
      varying float vRand;
      varying float vShade;
      varying float vDepth;
      ${GLSL_NOISE}

      void main() {
        float t = uTime;

        // flock centre wanders on a slow lissajous, nudged toward the cursor
        vec3 c = vec3(sin(t * 0.07) * 4.2, sin(t * 0.118 + 1.7) * 1.35, sin(t * 0.049) * 1.2);
        c.xy = mix(c.xy, uMouse, uMouseMix);

        // each bird orbits the centre at its own radius/speed; the radius
        // swells and shrinks with noise so the cloud breathes like a flock
        float th = aSeed.x * 6.28318 + t * (0.10 + aSeed.y * 0.22);
        float swell = 0.62 + 0.45 * vnoise(vec2(aSeed.w * 9.0, t * 0.16));
        float r = (0.35 + aSeed.z * 3.1) * swell;
        float sx = 1.55 + 0.5 * sin(t * 0.09 + aSeed.w * 3.0); // elongation

        vec3 p = vec3(
          cos(th) * r * sx,
          sin(th * 1.31 + aSeed.w * 5.0) * r * 0.5,
          sin(th * 0.71 + aSeed.x * 3.0) * r * 0.8
        );
        p.x += (vnoise(vec2(aSeed.y * 7.0 + t * 0.3, aSeed.z * 5.0)) - 0.5) * 0.7;
        p.y += (vnoise(vec2(aSeed.z * 6.0, aSeed.x * 8.0 + t * 0.27)) - 0.5) * 0.6;

        vec3 world = c + p;
        vShade = vnoise(vec2(th * 0.5, t * 0.2));
        vRand = aSeed.w;

        vec4 mv = modelViewMatrix * vec4(world, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.8 + aSeed.z * 1.3) * uPx * (22.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uIrid;
      uniform vec3 uCopper;
      uniform vec3 uCloud;
      varying float vRand;
      varying float vShade;
      varying float vDepth;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        float disc = smoothstep(0.5, 0.15, d);
        if (disc < 0.01) discard;

        vec3 col = mix(uIrid, uCloud, smoothstep(0.55, 0.95, vShade) * 0.5);
        col = mix(col, uCopper, step(0.94, vRand) * 0.85);

        float alpha = disc * (0.28 + vShade * 0.35) * smoothstep(26.0, 10.0, vDepth);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; // positions live in the shader
  scene.add(points);

  autoSize(canvas, renderer, camera, () => {
    uniforms.uPx.value = renderer.getPixelRatio();
  });

  // Cursor influence: pointer position mapped onto the z=0 world plane.
  const mouseTarget = new THREE.Vector2(0, 0);
  let mixTarget = 0;
  const section = canvas.closest('section') || canvas.parentElement;
  section.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfW = halfH * camera.aspect;
    mouseTarget.set(
      ((e.clientX - r.left) / r.width * 2 - 1) * halfW,
      -((e.clientY - r.top) / r.height * 2 - 1) * halfH
    );
    mixTarget = 0.16;
  }, { passive: true });
  section.addEventListener('pointerleave', () => { mixTarget = 0; });

  renderLoop(canvas, (t) => {
    uniforms.uTime.value = t;
    uniforms.uMouse.value.lerp(mouseTarget, 0.03);
    uniforms.uMouseMix.value += (mixTarget - uniforms.uMouseMix.value) * 0.04;
    renderer.render(scene, camera);
  });
}
