// Oak and Raven — hero scene
// Concentric "oak growth rings" rendered as a particle field, shimmering with
// the blue-green sheen of a raven's feather and flecks of copper.

import * as THREE from 'three';

const canvas = document.getElementById('hero-canvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function supportsWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!canvas || !supportsWebGL()) {
  if (canvas) canvas.style.display = 'none';
} else {
  init();
}

function init() {
  const isMobile = window.matchMedia('(max-width: 760px)').matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x14161d, 14, 40);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 5.2, 15);
  camera.lookAt(0, -0.5, 0);

  // --- Build growth rings ---------------------------------------------------
  const RING_COUNT = isMobile ? 42 : 64;
  const RING_GAP = 0.42;
  const DENSITY = isMobile ? 2.4 : 4.2; // points per world-unit of circumference

  const positions = [];
  const ringNorm = [];
  const rand = [];

  for (let r = 0; r < RING_COUNT; r++) {
    const radius = 1.2 + r * RING_GAP;
    const count = Math.max(24, Math.floor(2 * Math.PI * radius * DENSITY));
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      // slight organic wobble so rings read as grown, not drafted
      const wobble = (Math.sin(angle * 3 + r * 1.7) + Math.sin(angle * 7 + r * 0.6)) * 0.06;
      const rr = radius + wobble + (Math.random() - 0.5) * 0.1;
      positions.push(Math.cos(angle) * rr, 0, Math.sin(angle) * rr);
      ringNorm.push(r / RING_COUNT);
      rand.push(Math.random());
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aRing', new THREE.Float32BufferAttribute(ringNorm, 1));
  geometry.setAttribute('aRand', new THREE.Float32BufferAttribute(rand, 1));

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uFade: { value: 0 }, // ramped in by main.js intro (or locally)
    uScroll: { value: 0 }, // 0 at hero top -> 1 as the hero scrolls away
    uIridescent: { value: new THREE.Color('#426858') },
    uCopper: { value: new THREE.Color('#B07038') },
    uCloud: { value: new THREE.Color('#EDE8E2') },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aRing;
      attribute float aRand;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uScroll;
      varying float vRing;
      varying float vRand;
      varying float vWave;
      varying float vDepth;

      // simplex-ish cheap noise
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      void main() {
        vRing = aRing;
        vRand = aRand;

        vec3 pos = position;
        float t = uTime * 0.18;

        // slow rotation, outer rings drift slightly faster; on scroll each
        // particle gets its own extra spin so the rings dissolve tangentially
        float spin = t * (0.04 + aRing * 0.05) + uScroll * (0.25 + aRand * 0.9);
        float c = cos(spin), s = sin(spin);
        pos.xz = mat2(c, -s, s, c) * pos.xz;

        // undulating surface — the rings breathe
        float n = noise(pos.xz * 0.16 + vec2(t * 0.35, -t * 0.25));
        float n2 = noise(pos.xz * 0.05 - vec2(t * 0.12));
        pos.y += (n - 0.5) * (1.6 + aRing * 2.2) + (n2 - 0.5) * 2.4;
        vWave = n;

        // scroll exit: the field lifts and spreads like a flock taking off
        pos.y += uScroll * (2.0 + aRand * 8.0);
        pos.xz *= 1.0 + uScroll * (0.12 + aRand * 0.45);

        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.1 + aRand * 1.6) * uPixelRatio * (30.0 / -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uIridescent;
      uniform vec3 uCopper;
      uniform vec3 uCloud;
      uniform float uFade;
      uniform float uScroll;
      varying float vRing;
      varying float vRand;
      varying float vWave;
      varying float vDepth;

      void main() {
        // soft round point
        float d = length(gl_PointCoord - 0.5);
        float disc = smoothstep(0.5, 0.12, d);
        if (disc < 0.01) discard;

        // raven sheen: iridescent green-blue, lifted toward cloud on wave crests
        vec3 col = mix(uIridescent, uCloud, smoothstep(0.45, 0.95, vWave) * 0.55);
        // copper flecks on a small subset of particles
        col = mix(col, uCopper, step(0.93, vRand) * 0.9);

        // fade with distance and at the outermost rings
        float depthFade = smoothstep(34.0, 14.0, vDepth);
        float edgeFade = 1.0 - smoothstep(0.78, 1.0, vRing);
        float alpha = disc * depthFade * edgeFade * (0.5 + vWave * 0.5) * uFade
                    * (1.0 - uScroll * 0.85);

        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.position.y = -2.2;
  scene.add(points);

  // --- Scroll choreography: rings lift, spread, and dissolve as the hero exits
  if (!reduceMotion && window.gsap && window.ScrollTrigger) {
    window.gsap.registerPlugin(window.ScrollTrigger);
    window.gsap.to(uniforms.uScroll, {
      value: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 20%', scrub: 0.5 },
    });
  }

  // --- Mouse parallax --------------------------------------------------------
  const targetTilt = { x: 0, y: 0 };
  const tilt = { x: 0, y: 0 };
  if (!isMobile && !reduceMotion) {
    window.addEventListener('pointermove', (e) => {
      targetTilt.x = (e.clientY / window.innerHeight - 0.5) * 0.12;
      targetTilt.y = (e.clientX / window.innerWidth - 0.5) * 0.25;
    }, { passive: true });
  }

  // --- Sizing ----------------------------------------------------------------
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
  resize();
  window.addEventListener('resize', resize);

  // --- Render loop (paused when hero off-screen or tab hidden) ---------------
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; })
    .observe(canvas);

  const clock = new THREE.Clock();
  let fadeTarget = 1;

  // expose a hook so the intro timeline can sync the fade-in
  window.__heroFadeIn = () => { fadeTarget = 1; };

  function frame() {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;

    const t = clock.getElapsedTime();
    uniforms.uTime.value = reduceMotion ? 12.0 : t;
    uniforms.uFade.value += (fadeTarget - uniforms.uFade.value) * 0.035;

    tilt.x += (targetTilt.x - tilt.x) * 0.04;
    tilt.y += (targetTilt.y - tilt.y) * 0.04;
    points.rotation.x = tilt.x;
    points.rotation.y = tilt.y + (reduceMotion ? 0 : t * 0.012);

    renderer.render(scene, camera);
  }
  frame();
}
