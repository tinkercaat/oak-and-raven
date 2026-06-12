// Ambient motes — sparse copper/cloud dust drifting up through dark sections.
// Bigger motes render softer (fake bokeh), everything twinkles gently.
// Attach to any section by giving its canvas the data-motes attribute.

import * as THREE from 'three';
import { makeRenderer, autoSize, renderLoop, PALETTE, IS_MOBILE } from './utils.js';

export function initMotes(canvas) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 30);
  camera.position.z = 10;

  const COUNT = IS_MOBILE ? 60 : 130;
  const seeds = new Float32Array(COUNT * 4);
  for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));

  const uniforms = {
    uTime: { value: 0 },
    uPx: { value: renderer.getPixelRatio() },
    uHalf: { value: new THREE.Vector2(8, 4.66) }, // world half-extent at z=0
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
      uniform vec2 uHalf;
      varying float vSoft;
      varying float vSeed;
      varying float vTwinkle;

      void main() {
        float t = uTime;
        vec3 pos = vec3(0.0);

        // slow rise with a sideways sway; wraps top-to-bottom
        pos.x = (aSeed.x * 2.0 - 1.0) * uHalf.x
              + sin(t * (0.07 + aSeed.y * 0.12) + aSeed.z * 6.28318) * 0.5;
        float h2 = uHalf.y * 2.0;
        pos.y = mod(aSeed.y * h2 + t * (0.10 + aSeed.z * 0.22), h2) - uHalf.y;

        vSoft = aSeed.w;
        vSeed = aSeed.x;
        vTwinkle = 0.65 + 0.35 * sin(t * (0.4 + aSeed.x) + aSeed.w * 6.28318);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = mix(2.0, 9.0, aSeed.w * aSeed.w) * uPx;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCopper;
      uniform vec3 uCloud;
      varying float vSoft;
      varying float vSeed;
      varying float vTwinkle;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        float soft = mix(0.12, 0.42, vSoft); // big motes blur wide open
        float disc = 1.0 - smoothstep(0.5 - soft, 0.5, d);
        if (disc < 0.01) discard;

        vec3 col = mix(uCloud, uCopper, step(0.45, vSeed));
        float alpha = disc * mix(0.26, 0.09, vSoft) * vTwinkle;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  autoSize(canvas, renderer, camera, () => {
    uniforms.uPx.value = renderer.getPixelRatio();
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    uniforms.uHalf.value.set(halfH * camera.aspect, halfH);
  });

  renderLoop(canvas, (t) => {
    uniforms.uTime.value = t;
    renderer.render(scene, camera);
  });
}
