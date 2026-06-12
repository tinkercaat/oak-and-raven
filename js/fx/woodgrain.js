// Wood grain — procedural oak rings inside the service cards, revealed on
// hover. Ring centre sits off the top-right corner so the grain sweeps
// diagonally across the card. Tones stay within the paper/driftwood family
// with a faint copper kiss on the ring crests. Renders only while a card is
// hovered (or fading out), so idle cost is zero. Desktop pointer only.

import * as THREE from 'three';
import { makeRenderer, GLSL_NOISE } from './utils.js';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uHover;
  uniform float uAspect;
  ${GLSL_NOISE}

  void main() {
    vec2 p = vUv - vec2(0.92, 1.18);
    p.x *= uAspect;
    p *= 2.4;

    float n = fbm(p * 1.7 + uTime * 0.03);
    float d = length(p) + n * 0.30;
    float ring = sin(d * 26.0 + n * 2.0);
    float band = smoothstep(-0.6, 0.9, ring);

    vec3 light = vec3(0.949, 0.937, 0.914);
    vec3 dark  = vec3(0.871, 0.831, 0.769);
    vec3 col = mix(dark, light, band);

    // fine longitudinal grain streaks
    col += (vnoise(vec2(p.x * 36.0, p.y * 4.0)) - 0.5) * 0.05;

    // copper kiss on ring crests
    col = mix(col, vec3(0.690, 0.439, 0.220), smoothstep(0.96, 1.0, ring) * 0.16);

    float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x)
               * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
    gl_FragColor = vec4(col, uHover * 0.9 * edge);
  }
`;

export function initWoodgrain(canvases) {
  const cards = [];

  canvases.forEach((canvas) => {
    const renderer = makeRenderer(canvas);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: Math.random() * 20 },
      uHover: { value: 0 },
      uAspect: { value: 1 },
    };
    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms, transparent: true, vertexShader: VERT, fragmentShader: FRAG })
    ));

    function resize() {
      const w = canvas.clientWidth || 1;
      const h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      uniforms.uAspect.value = w / h;
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    const state = { renderer, scene, camera, uniforms, target: 0 };
    const card = canvas.closest('.card');
    card.addEventListener('mouseenter', () => { state.target = 1; });
    card.addEventListener('mouseleave', () => { state.target = 0; });
    cards.push(state);
  });

  let lastNow = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - lastNow) / 1000, 0.1);
    lastNow = now;
    if (document.hidden) return;

    for (const s of cards) {
      s.uniforms.uHover.value += (s.target - s.uniforms.uHover.value) * 0.07;
      if (s.uniforms.uHover.value < 0.004) continue; // idle: skip render entirely
      s.uniforms.uTime.value += dt * s.uniforms.uHover.value; // grain drifts only under the cursor
      s.renderer.render(s.scene, s.camera);
    }
  }
  requestAnimationFrame(frame);
}
