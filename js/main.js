// Oak and Raven — interactions & scroll choreography
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const preloader = document.querySelector('.preloader');

  // ---------------------------------------------------------------------------
  // Reduced motion: show everything, skip the choreography
  // ---------------------------------------------------------------------------
  if (reduceMotion || typeof gsap === 'undefined') {
    document.documentElement.classList.add('reduced-motion');
    if (preloader) preloader.remove();
    initNav(null);
    initMenu(null);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // ---------------------------------------------------------------------------
  // Lenis smooth scroll
  // ---------------------------------------------------------------------------
  const lenis = new Lenis({
    duration: 1.15,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  });
  window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // Anchor links scroll smoothly, offset for the fixed nav
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (window.__closeMenu) window.__closeMenu();
      lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    });
  });

  // ---------------------------------------------------------------------------
  // Intro: preloader wordmark -> hero reveal
  // ---------------------------------------------------------------------------
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });

  intro
    .to('.preloader__word', { y: 0, duration: 0.8, stagger: 0.09 })
    .to('.preloader__rule', { scaleX: 1, duration: 0.6, ease: 'power2.inOut' }, '-=0.35')
    .to('.preloader', {
      yPercent: -100,
      duration: 0.9,
      ease: 'power4.inOut',
      delay: 0.35,
      onComplete: () => preloader && preloader.remove(),
    })
    .from('.hero__eyebrow', { opacity: 0, y: 18, duration: 0.8 }, '-=0.45')
    .from('.hero .line__inner', { yPercent: 110, duration: 1.1, stagger: 0.12 }, '-=0.55')
    .from('[data-hero-fade]', { opacity: 0, y: 24, duration: 0.9, stagger: 0.12 }, '-=0.6')
    .from('.nav__inner', { opacity: 0, y: -16, duration: 0.8 }, '-=0.7');

  // Debug: load /?intro=hold to freeze the preloader fully drawn (wordmark up,
  // copper rule at scaleX 1) so it can be inspected in DevTools.
  // Resume from the console with __intro.play().
  if (new URLSearchParams(location.search).has('intro')) {
    intro.pause(1.6);
    window.__intro = intro;
  }

  // ---------------------------------------------------------------------------
  // Scroll reveals
  // ---------------------------------------------------------------------------

  // Headline line masks
  document.querySelectorAll('.reveal-lines').forEach((el) => {
    if (el.closest('.hero')) return; // hero handled by intro
    gsap.from(el.querySelectorAll('.line__inner'), {
      yPercent: 110,
      duration: 1.1,
      ease: 'power3.out',
      stagger: 0.12,
      scrollTrigger: { trigger: el, start: 'top 82%' },
    });
  });

  // Generic fade-up reveals; group containers stagger their children
  document.querySelectorAll('[data-reveal-group]').forEach((group) => {
    gsap.from(group.querySelectorAll('[data-reveal]'), {
      opacity: 0,
      y: 36,
      duration: 1,
      ease: 'power3.out',
      stagger: 0.14,
      scrollTrigger: { trigger: group, start: 'top 82%' },
    });
  });
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (el.closest('[data-reveal-group]')) return;
    gsap.from(el, {
      opacity: 0,
      y: 28,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 86%' },
    });
  });

  // Copper hairlines draw in
  document.querySelectorAll('.hairline').forEach((line) => {
    gsap.from(line, {
      scaleX: 0,
      duration: 1.2,
      ease: 'power3.inOut',
      scrollTrigger: { trigger: line, start: 'top 88%' },
    });
  });

  // ---------------------------------------------------------------------------
  // Philosophy quote: words brighten as you scroll through, accents turn copper
  // ---------------------------------------------------------------------------
  const quote = document.getElementById('philosophy-quote');
  if (quote) {
    const accents = ['raven', 'oak'];
    quote.querySelectorAll('.philosophy__line').forEach((lineEl) => {
      const words = lineEl.textContent.trim().split(/\s+/);
      lineEl.innerHTML = words
        .map((w) => {
          const isAccent = accents.includes(w.replace(/[^a-z]/gi, '').toLowerCase());
          return `<span class="word${isAccent ? ' word--accent' : ''}">${w}</span>`;
        })
        .join(' ');
    });
    gsap.fromTo(
      quote.querySelectorAll('.word'),
      { opacity: 0.14 },
      {
        opacity: 1,
        stagger: 0.08,
        ease: 'none',
        scrollTrigger: {
          trigger: quote,
          start: 'top 75%',
          end: 'bottom 45%',
          scrub: 0.6,
        },
      }
    );
  }

  // ---------------------------------------------------------------------------
  // Stat counters
  // ---------------------------------------------------------------------------
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    const obj = { v: 0 };
    gsap.to(obj, {
      v: end,
      duration: 1.6,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
      onUpdate: () => { el.textContent = Math.round(obj.v); },
    });
  });

  // ---------------------------------------------------------------------------
  // About portrait parallax
  // ---------------------------------------------------------------------------
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    gsap.fromTo(
      el,
      { yPercent: 6 },
      {
        yPercent: -6,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      }
    );
  });

  // ---------------------------------------------------------------------------
  // Magnetic buttons (fine pointers only)
  // ---------------------------------------------------------------------------
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('[data-magnetic]').forEach((btn) => {
      const strength = 18;
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width - 0.5) * strength;
        const y = ((e.clientY - r.top) / r.height - 0.5) * strength;
        gsap.to(btn, { x, y, duration: 0.4, ease: 'power3.out' });
      });
      btn.addEventListener('pointerleave', () => {
        gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      });
    });
  }

  initNav(lenis);

  // ---------------------------------------------------------------------------
  // Nav behavior + mobile menu
  // ---------------------------------------------------------------------------
  function initNav(lenisInstance) {
    const nav = document.getElementById('nav');
    let lastY = 0;

    function onScroll(y) {
      nav.classList.toggle('is-scrolled', y > 40);
      const menuOpen = document.getElementById('mobile-menu').classList.contains('is-open');
      if (!menuOpen) {
        nav.classList.toggle('is-hidden', y > 160 && y > lastY);
      }
      lastY = y;
    }

    if (lenisInstance) {
      lenisInstance.on('scroll', ({ scroll }) => onScroll(scroll));
    } else {
      window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
    }
  }

  initMenu(lenis);

  function initMenu(lenisInstance) {
    const burger = document.getElementById('nav-burger');
    const menu = document.getElementById('mobile-menu');
    const hasGsap = typeof gsap !== 'undefined' && !reduceMotion;

    window.__closeMenu = close;

    function open() {
      const nav = document.getElementById('nav');
      nav.classList.remove('is-hidden');
      nav.classList.add('menu-open');
      menu.classList.add('is-open');
      burger.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      if (lenisInstance) lenisInstance.stop();
      if (hasGsap) {
        gsap.timeline()
          .set(menu, { visibility: 'visible' })
          .fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out' })
          .fromTo('.mobile-menu__link', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.07 }, '-=0.15')
          .fromTo('.mobile-menu__cta, .mobile-menu__tag', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.08 }, '-=0.3');
      }
    }

    function close() {
      if (!menu.classList.contains('is-open')) return;
      document.getElementById('nav').classList.remove('menu-open');
      menu.classList.remove('is-open');
      burger.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      if (lenisInstance) lenisInstance.start();
      if (hasGsap) {
        gsap.to(menu, {
          opacity: 0,
          duration: 0.35,
          ease: 'power2.in',
          onComplete: () => gsap.set(menu, { visibility: 'hidden', clearProps: 'visibility,opacity' }),
        });
      }
    }

    burger.addEventListener('click', () => {
      menu.classList.contains('is-open') ? close() : open();
    });

    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  }
})();
