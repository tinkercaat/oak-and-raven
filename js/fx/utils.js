// Oak and Raven — shared helpers for the WebGL effects.
// Every effect follows the same contract: alpha canvas, capped pixel ratio,
// rendering paused whenever the canvas is off-screen or the tab is hidden.

import * as THREE from 'three';

export const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const IS_MOBILE = window.matchMedia('(max-width: 760px)').matches;
export const HAS_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

// Keeps the drawing buffer matched to the canvas's CSS size.
export function autoSize(canvas, renderer, camera, onResize) {
  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    if (camera && camera.isPerspectiveCamera) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if (onResize) onResize(w, h);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
}

// rAF loop gated on visibility. Callback receives (elapsed, delta) in seconds.
export function renderLoop(canvas, render) {
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  const clock = new THREE.Clock();
  let last = 0;

  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    const dt = Math.min(t - last, 0.1);
    last = t;
    render(t, dt);
  }
  frame();
}

// Brand palette as THREE colors, shared by every effect.
export const PALETTE = {
  iridescent: new THREE.Color('#426858'),
  copper: new THREE.Color('#B07038'),
  cloud: new THREE.Color('#EDE8E2'),
};

// Cheap value noise + fbm, shared by every shader.
export const GLSL_NOISE = /* glsl */ `
  float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }
`;
