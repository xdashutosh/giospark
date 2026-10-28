/*!
 * GIO Spark — home page choreography
 * Preloader → 3D bottle fill intro → size switcher → pinned "from source to sealed" story.
 */
(function () {
  'use strict';

  var Site = window.GioSite || {};
  var root = document.documentElement;
  if (!window.gsap || !window.ScrollTrigger) return;

  var reduce = !!Site.reduce;
  var TAU = Math.PI * 2;
  var ORDER = ['200', '500', '1000'];
  var THEMES = {
    '200': { top: '#5fd592', bottom: '#e6fbeb', ink: '#06392a', accent: '#1fa463' },
    '500': { top: '#37c6f1', bottom: '#def6ff', ink: '#062f5e', accent: '#0b8ff0' },
    '1000': { top: '#ffc93f', bottom: '#fff4d4', ink: '#13265c', accent: '#e9a70b' }
  };
  // copy from the GIO Spark posters
  var COPY = {
    '200': {
      size: '200 ml',
      sticker: 'Easy to carry anywhere!',
      f: [['Pocket size purity', 'Perfect for every moment — small enough to carry anywhere.'],
          ['Events & meetings', 'A neat, compact serve for functions, conferences and hospitality.']]
    },
    '500': {
      size: '500 ml',
      sticker: 'Stay refreshed, stay energized!',
      f: [['Stay refreshed', 'Stay refreshed, stay energized — the everyday grab-and-go size.'],
          ['Made for retail', 'Easy to stock for general stores, kiosks, counters and canteens.']]
    },
    '1000': {
      size: '1 litre',
      sticker: 'Perfect for the whole family!',
      f: [['More goodness', 'More purity, more goodness, for you and yours.'],
          ['Home & office', 'A larger bottle for dining tables, desks and long drives.']]
    }
  };

  var hero = document.querySelector('.hero');
  var canvas = document.getElementById('stage');
  var pre = document.getElementById('preloader');
  var first = root.classList.contains('is-first') && !reduce;

  var index = 1;
  var busy = true;
  var stage = null, S = null, I = null;

  /* ------------------------------------------------------------------ */
  /* Boot                                                                 */
  /* ------------------------------------------------------------------ */

  var canGL = !reduce && window.GioBottle && window.GioBottle.supported();
  var stageReady = canGL
    ? window.GioBottle.create(canvas, { sizes: ORDER }).catch(function (e) { if (window.console) console.warn('3D stage unavailable:', e); return null; })
    : Promise.resolve(null);
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready.catch(function () {}) : Promise.resolve();
  var ready = Promise.all([stageReady, fontsReady]).then(function (r) { return r[0]; });

  ready.then(function (s) {
    stage = s;
    if (stage) setupStage();
    else root.classList.add('no-webgl', 'is-static');
    setupHeroUI();
    setupScroll();
    setupSections();
    setupCampaign();
    if (stage) {
      // stop rendering once later sections fully cover the bottle
      ScrollTrigger.create({
        trigger: '.ticker', start: 'top top',
        onEnter: function () { stage.stop(); canvas.style.visibility = 'hidden'; },
        onLeaveBack: function () { stage.start(); canvas.style.visibility = ''; }
      });
    }
    // triggers created earlier (reveals, marquees) must be measured after the pins
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    if (location.hash && location.hash.length > 1 && document.querySelector(location.hash)) {
      setTimeout(function () { Site.scrollTo(location.hash, { immediate: true }); }, 60);
    }
  });

  runPreloader(ready).then(function () { ready.then(intro); });

  /* ------------------------------------------------------------------ */
  /* Preloader                                                            */
  /* ------------------------------------------------------------------ */

  function lockScroll(on) {
    if (Site.lenis) { if (on) Site.lenis.stop(); else Site.lenis.start(); }
    root.style.overflow = on ? 'hidden' : '';
  }

  function runPreloader(until) {
    return new Promise(function (resolve) {
      if (!first || !pre) {
        if (pre) pre.remove();
        resolve();
        return;
      }
      lockScroll(true);
      window.scrollTo(0, 0);
      var num = pre.querySelector('.preloader__num');
      var fill = pre.querySelector('.preloader__fill');
      var wave = pre.querySelector('.preloader__wave');
      var p = { v: 0 };
      var render = function () {
        num.textContent = Math.round(p.v);
        fill.setAttribute('transform', 'translate(0 ' + (160 - p.v * 1.62).toFixed(2) + ')');
      };
      var waveTween = gsap.to(wave, { x: 120, duration: 1.1, ease: 'none', repeat: -1 });
      var crawl = gsap.to(p, { v: 88, duration: 2.4, ease: 'power2.out', onUpdate: render });
      var minTime = new Promise(function (r) { setTimeout(r, 1300); });

      Promise.all([until, minTime]).then(function () {
        crawl.kill();
        gsap.to(p, { v: 100, duration: 0.55, ease: 'power2.inOut', onUpdate: render, onComplete: exit });
      });

      function exit() {
        gsap.timeline({ onComplete: function () { waveTween.kill(); pre.remove(); } })
          .to(pre.querySelector('.preloader__inner'), { y: -50, autoAlpha: 0, duration: 0.5, ease: 'power2.in' })
          .fromTo(pre, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'water' }, 0.2)
          .add(function () { lockScroll(false); resolve(); }, 0.35);
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 3D stage                                                             */
  /* ------------------------------------------------------------------ */

  function setupStage() {
    S = stage.shared;
    I = stage.intro;
    ORDER.forEach(function (id, i) { stage.bottles[id].off.visible = i === index; });
    // hidden until the intro brings the bottle in
    gsap.set(I, { y: -1.2, spin: -Math.PI * 1.3, fill: 0, pour: 0, streamCut: 0, capLift: 4.5, capSpin: TAU * 2, bubbles: 0, tilt: 0 });
    gsap.ticker.add(stage.tick);

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    }, { passive: true });

    initDrag();
  }

  function initDrag() {
    var dragging = false;
    var lastX = 0;
    var hint = document.querySelector('.hero__hint');
    var hintGone = false;
    var hideHint = function () {
      if (hintGone || !hint) return;
      hintGone = true;
      gsap.to(hint, { autoAlpha: 0, y: -10, duration: 0.5 });
    };
    hero.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target.closest('a, button')) return;
      dragging = true;
      stage.dragging = true;
      lastX = e.clientX;
      hideHint();
      autoHold(true);
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      lastX = e.clientX;
      stage.dragAngle += dx * 0.011;
      stage.dragVel = dx * 0.011;
    }, { passive: true });
    var end = function () { if (!dragging) return; dragging = false; stage.dragging = false; autoHold(false); };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    setTimeout(hideHint, 9000);
  }

  /* ------------------------------------------------------------------ */
  /* Hero UI: sizes, arrows, decorations                                  */
  /* ------------------------------------------------------------------ */

  var sizesWrap = document.querySelector('.hero__sizes');
  var pill = document.querySelector('.hero__sizes-pill');
  var tabs = gsap.utils.toArray('.hero__sizes [role="tab"]');
  var decor = gsap.utils.toArray('.hero .decor');
  var drops = gsap.utils.toArray('.splash__drop');
  var splashEl = document.querySelector('.splash');

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hasTheme(d, id) { return !d.dataset.theme || d.dataset.theme.split(' ').indexOf(id) >= 0; }

  function movePill(animate) {
    var active = sizesWrap.querySelector('[aria-selected="true"]');
    if (!active) return;
    var props = { x: active.offsetLeft, width: active.offsetWidth };
    if (animate) gsap.to(pill, Object.assign({ duration: 0.6, ease: 'power3.inOut' }, props));
    else gsap.set(pill, props);
  }

  function setupHeroUI() {
    document.querySelectorAll('.hero__controls [data-dir]').forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = parseInt(b.dataset.dir, 10);
        go(index + dir, dir);
        autoSchedule();
      });
    });
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { go(ORDER.indexOf(t.dataset.size)); autoSchedule(); });
    });
    document.addEventListener('keydown', function (e) {
      if (window.scrollY > window.innerHeight * 0.5 || e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { go(index + 1, 1); autoSchedule(); }
      else if (e.key === 'ArrowLeft') { go(index - 1, -1); autoSchedule(); }
    });
    window.addEventListener('resize', function () { movePill(false); });
    setupAuto();

    if (reduce) return;

    // parallax + idle float for decorations
    var movers = decor.map(function (d) {
      var depth = parseFloat(d.dataset.depth) || 0.3;
      var inner = d.querySelector('.decor__in');
      if (!inner.classList.contains('decor__sun')) {
        gsap.to(inner, {
          y: gsap.utils.random(-22, -10), rotation: '+=' + gsap.utils.random(-8, 8),
          duration: gsap.utils.random(2.2, 3.8), ease: 'sine.inOut', yoyo: true, repeat: -1, delay: gsap.utils.random(0, 1.5)
        });
      }
      gsap.to(d, {
        yPercent: -depth * 160, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
      });
      return {
        depth: depth,
        x: gsap.quickTo(d, 'x', { duration: 1.1, ease: 'power3' }),
        y: gsap.quickTo(d, 'y', { duration: 1.1, ease: 'power3' })
      };
    });
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var nx = e.clientX / window.innerWidth - 0.5;
      var ny = e.clientY / window.innerHeight - 0.5;
      movers.forEach(function (m) { m.x(-nx * 70 * m.depth); m.y(-ny * 46 * m.depth); });
    }, { passive: true });

    gsap.to('.decor__sun', { rotation: 360, duration: 40, ease: 'none', repeat: -1 });
    gsap.to('.hero__badge-ring', { rotation: 360, duration: 16, ease: 'none', repeat: -1 });

    // headline drifts apart as the hero scrolls away
    gsap.to('.hero__line--front', { yPercent: -45, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__line--back', { yPercent: 35, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__intro, .hero__controls, .hero__badge, .hero__features, .hero__sizes, .hero__hint, .hero__sticker', {
      autoAlpha: 0, y: -40, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: '45% top', scrub: true }
    });
  }

  /* ---------------- Size slideshow: 200 ml → 500 ml → 1 litre, 5 s each, looping ---------------- */
  var AUTO_MS = 5000;
  var auto = { timer: null, bar: null, started: false, paused: false, held: false, inView: true };
  var autoBtn = document.querySelector('.hero__auto');
  var autoProgress = document.querySelector('.hero__sizes-progress');

  function autoAllowed() {
    return !!stage && !reduce && auto.started && !auto.paused && !auto.held && auto.inView && !document.hidden;
  }

  function autoSchedule() {
    clearTimeout(auto.timer);
    if (auto.bar) auto.bar.kill();
    gsap.set(autoProgress, { scaleX: 0 });
    if (!autoAllowed()) return;
    auto.bar = gsap.to(autoProgress, { scaleX: 1, duration: AUTO_MS / 1000, ease: 'none' });
    auto.timer = setTimeout(function () {
      if (!autoAllowed()) return;
      go(index + 1, 1);
      autoSchedule();
    }, AUTO_MS);
  }

  function autoHold(on) {
    auto.held = on;
    autoSchedule();
  }

  function autoStart() {
    auto.started = true;
    autoSchedule();
  }

  function setupAuto() {
    if (autoBtn) {
      autoBtn.addEventListener('click', function () {
        auto.paused = !auto.paused;
        autoBtn.setAttribute('aria-pressed', String(auto.paused));
        autoBtn.setAttribute('aria-label', auto.paused ? 'Play the size slideshow' : 'Pause the size slideshow');
        autoSchedule();
      });
    }
    document.addEventListener('visibilitychange', autoSchedule);
    // pause once most of the hero has scrolled away
    ScrollTrigger.create({
      trigger: hero, start: 'top bottom', end: 'bottom 40%',
      onToggle: function (self) { auto.inView = self.isActive; autoSchedule(); }
    });
  }

  function splash(where) {
    if (!S || reduce) return;
    var spec = window.GioBottle.SPECS[ORDER[index]];
    var vh = window.innerHeight;
    var hh = S.h * spec.heroScale * vh;
    var rect = hero.getBoundingClientRect();
    var cx = window.innerWidth * (0.5 + S.x) - rect.left;
    var cy = vh * (0.5 - S.y) + (where === 'top' ? -hh / 2 + 6 : hh / 2 - 14) - rect.top;
    gsap.set(splashEl, { x: cx, y: cy });
    drops.forEach(function (d, i) {
      var ang = -Math.PI + ((i + 0.5) / drops.length) * Math.PI + gsap.utils.random(-0.18, 0.18);
      var dist = gsap.utils.random(where === 'top' ? 50 : 80, where === 'top' ? 130 : 190);
      var r0 = ((ang * 180) / Math.PI + 270 + 180) % 360 - 180;
      gsap.timeline()
        .set(d, { x: 0, y: 0, scale: gsap.utils.random(0.45, 1.05), rotation: r0, autoAlpha: 1 })
        .to(d, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, duration: 0.55, ease: 'power2.out' })
        .to(d, { y: '+=' + gsap.utils.random(90, 170), rotation: 0, autoAlpha: 0, duration: 0.7, ease: 'power2.in' });
    });
  }

  function go(next, dir) {
    next = (next + ORDER.length) % ORDER.length;
    if (busy || next === index) return;
    busy = true;
    if (dir === undefined) dir = next > index ? 1 : -1;
    var fromId = ORDER[index];
    var toId = ORDER[next];
    index = next;
    var th = THEMES[toId];
    var copy = COPY[toId];
    var tl = gsap.timeline({ onComplete: function () { busy = false; } });

    tl.to(root, { '--bg-top': th.top, '--bg-bottom': th.bottom, '--hero-ink': th.ink, '--accent': th.accent, duration: 1.1, ease: 'power2.inOut' }, 0);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', th.top);

    if (stage) {
      var a = stage.bottles[fromId].off;
      var b = stage.bottles[toId].off;
      gsap.killTweensOf([a, b]);
      tl.to(a, { y: 1.3 * dir, spin: '+=' + Math.PI * 1.2 * dir, scale: 0.72, duration: 0.7, ease: 'power3.in' }, 0)
        .set(a, { visible: false, y: 0, spin: 0, scale: 1 }, 0.72)
        .set(b, { visible: true, y: -1.3 * dir, spin: -Math.PI * 1.4 * dir, scale: 0.72 }, 0.5)
        .to(b, { y: 0, spin: 0, scale: 1, duration: 1.15, ease: 'back.out(1.25)' }, 0.5)
        .add(function () { splash('base'); }, 1.12);
    } else {
      var img = document.querySelector('.hero__fallback');
      tl.to(img, { autoAlpha: 0, y: -40, duration: 0.35, onComplete: function () { img.src = 'assets/img/bottle-' + toId + '.png'; img.alt = 'GIO Spark ' + copy.size + ' packaged drinking water bottle'; } }, 0)
        .to(img, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'back.out(1.5)' }, 0.4);
    }

    // size tabs
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.size === toId)); });
    movePill(true);

    // counter + vertical size label
    var cur = document.querySelector('.hero__count-cur');
    var sizeText = document.querySelector('.hero__size-text');
    tl.to([cur, sizeText], { yPercent: -110 * dir, autoAlpha: 0, duration: 0.25, ease: 'power2.in' }, 0)
      .add(function () { cur.textContent = pad(index + 1); sizeText.textContent = copy.size; }, 0.26)
      .fromTo([cur, sizeText], { yPercent: 110 * dir, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out', immediateRender: false }, 0.27);

    // feature copy
    var feats = gsap.utils.toArray('.hero__features .feature');
    tl.to(feats, { autoAlpha: 0, y: -14, stagger: 0.05, duration: 0.3, ease: 'power2.in' }, 0)
      .add(function () {
        feats.forEach(function (f, i) {
          f.querySelector('.feature__title').textContent = copy.f[i][0];
          f.querySelector('.feature__text').textContent = copy.f[i][1];
        });
      }, 0.4)
      .to(feats, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.6, ease: 'power3.out' }, 0.7);

    // poster sticker
    var sticker = document.querySelector('.hero__sticker');
    tl.to(sticker, { scale: 0, rotation: -30, duration: 0.35, ease: 'back.in(2)' }, 0)
      .add(function () { sticker.querySelector('.hero__sticker-text').textContent = copy.sticker; }, 0.4)
      .to(sticker, { scale: 1, rotation: 0, duration: 1, ease: 'elastic.out(1, 0.5)' }, 0.95);

    // themed decorations
    var outs = decor.filter(function (d) { return d.dataset.theme && d.classList.contains('is-on') && !hasTheme(d, toId); });
    var ins = decor.filter(function (d) { return d.dataset.theme && hasTheme(d, toId); });
    if (outs.length) tl.to(outs, { scale: 0, rotation: '-=30', autoAlpha: 0, duration: 0.45, ease: 'back.in(1.7)', stagger: 0.04 }, 0);
    tl.add(function () {
      outs.forEach(function (d) { d.classList.remove('is-on'); });
      ins.forEach(function (d) { d.classList.add('is-on'); });
    }, 0.5);
    if (ins.length) tl.fromTo(ins, { scale: 0, rotation: -30, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 1.2, ease: 'elastic.out(1, 0.55)', stagger: 0.07, immediateRender: false }, 0.55);
  }

  /* ------------------------------------------------------------------ */
  /* Intro                                                                */
  /* ------------------------------------------------------------------ */

  function intro() {
    var els = '.hero__title, .hero__intro, .hero__controls, .hero__badge, .hero__features, .hero__sizes, .hero__hint, .hero__decor, .hero__sticker';
    gsap.set(els, { visibility: 'visible' });
    var activeDecor = decor.filter(function (d) { return hasTheme(d, ORDER[index]); });
    activeDecor.forEach(function (d) { d.classList.add('is-on'); });
    movePill(false);

    if (reduce) {
      busy = false;
      if (stage) gsap.set(I, { y: 0, spin: 0, fill: 1, capLift: 0, capSpin: 0, tilt: 0 });
      return;
    }

    var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: function () { busy = false; autoStart(); } });

    if (window.SplitText) {
      var top = SplitText.create('.hero__line--front', { type: 'chars', mask: 'chars' });
      var bottom = SplitText.create('.hero__line--back', { type: 'chars', mask: 'chars' });
      tl.from(top.chars, { yPercent: 115, duration: 1.15, stagger: 0.045, ease: 'power4.out' }, 0.15)
        .from(bottom.chars, { yPercent: -115, duration: 1.15, stagger: 0.04, ease: 'power4.out' }, 0.32);
    }
    tl.from('.site-header .nav', { y: -26, autoAlpha: 0, duration: 0.9 }, 0.2)
      .from('.hero__intro', { y: 26, autoAlpha: 0, duration: 0.9 }, 0.75)
      .from('.hero__controls > *', { scale: 0.5, autoAlpha: 0, stagger: 0.08, duration: 0.8, ease: 'back.out(1.8)' }, 0.85)
      .from('.hero__features .feature', { y: 26, autoAlpha: 0, stagger: 0.1, duration: 0.9 }, 0.95)
      .from('.hero__sizes', { y: 34, autoAlpha: 0, duration: 0.9 }, 1.05)
      .from('.hero__badge', { scale: 0, rotation: -140, duration: 1.4, ease: 'back.out(1.4)' }, 1.05)
      .from('.hero__sticker', { scale: 0, rotation: -40, duration: 1.3, ease: 'elastic.out(1, 0.5)' }, 2.2)
      .from(activeDecor, { scale: 0, autoAlpha: 0, duration: 1.4, ease: 'elastic.out(1, 0.55)', stagger: 0.05 }, 0.55)
      .from('.hero__hint', { y: -12, autoAlpha: 0, duration: 0.6 }, 3.4);

    if (stage) {
      // bottle rises, a stream fills it, the cap spins down and seals it
      tl.to(I, { y: 0, spin: 0, duration: 1.4, ease: 'power3.out' }, 0)
        .to(I, { pour: 1, duration: 0.25, ease: 'power1.out' }, 0.95)
        .to(I, { fill: 1, duration: 1.6, ease: 'power1.inOut' }, 1.0)
        .to(I, { bubbles: 0.85, duration: 0.4 }, 1.05)
        .to(I, { streamCut: 1, duration: 0.35, ease: 'power2.in' }, 2.55)
        .set(I, { pour: 0, streamCut: 0 }, 2.92)
        .to(I, { bubbles: 0, duration: 1.4 }, 2.8)
        .to(I, { capLift: 0, duration: 0.85, ease: 'power3.out' }, 2.7)
        .to(I, { capSpin: 0, duration: 0.85, ease: 'power2.out' }, 2.7)
        .add(function () { splash('top'); }, 3.42);
    } else {
      tl.from('.hero__fallback', { yPercent: 30, autoAlpha: 0, duration: 1.2 }, 0.2);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Scroll story                                                         */
  /* ------------------------------------------------------------------ */

  function setupScroll() {
    var mm = gsap.matchMedia();
    mm.add({ desk: '(min-width: 900px)', mob: '(max-width: 899px)' }, function (ctx) {
      if (!stage || reduce) return;
      var desk = ctx.conditions.desk;
      var L = desk
        ? { hero: { x: 0, y: -0.106, h: 0.72 }, proc: { x: 0.215, y: -0.02, h: 0.8 } }
        : { hero: { x: 0, y: 0.075, h: 0.5 }, proc: { x: 0, y: 0.06, h: 0.42 } };

      gsap.set(S, {
        x: L.hero.x, y: L.hero.y, h: L.hero.h, tiltZ: 0, tiltX: 0.03, sway: 1, float: 1, follow: 1,
        spin: 0, wrap: 1, capLift: 0, capSpin: 0, uv: 0, uvY: 0, ro: 0, bubbles: 0, minerals: 0
      });

      // hero → process: the bottle glides aside while the world turns deep blue
      gsap.timeline({ scrollTrigger: { trigger: '.process', start: 'top bottom', end: 'top top', scrub: 0.6 } })
        .to(S, { x: L.proc.x, y: L.proc.y, h: L.proc.h, tiltZ: 0, tiltX: 0.04, sway: 0.1, follow: 0.35, ease: 'power1.inOut' }, 0)
        .to('.page-bg__dark', { opacity: 1, ease: 'none' }, 0);

      buildProcess(desk);
    });
  }

  function buildProcess(desk) {
    var steps = gsap.utils.toArray('.process .step');
    var bars = gsap.utils.toArray('.rail__bar i');
    var items = gsap.utils.toArray('.rail__item');
    var active = -2;

    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: function () {
        var t = this.time();
        var k = t < 1 ? -1 : Math.min(4, Math.floor((t - 1) / 2));
        if (k !== active) {
          active = k;
          items.forEach(function (it, i) { it.classList.toggle('is-active', i === k); });
        }
      },
      scrollTrigger: {
        trigger: '.process', start: 'top top', end: '+=' + (desk ? 620 : 540) + '%',
        pin: true, scrub: 0.9, anticipatePin: 1
      }
    });

    // open the bottle: label peels away, cap unscrews and lifts off
    tl.to(S, { wrap: 0, duration: 1, ease: 'power1.inOut' }, 0)
      .to(S, { capLift: 4.6, capSpin: TAU * 1.5, duration: 0.95, ease: 'power2.in' }, 0)
      .to(S, { spin: Math.PI, duration: 1, ease: 'power1.inOut' }, 0);

    for (var k = 1; k < steps.length; k++) {
      var at = 1 + (k - 1) * 2;
      tl.to(steps[k - 1], { autoAlpha: 0, y: -36, duration: 0.35, ease: 'power2.in' }, at - 0.05)
        .fromTo(steps[k], { autoAlpha: 0, y: 46 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' }, at + 0.2)
        .to(bars[k - 1], { scaleX: 1, duration: 1.9 }, at);
    }

    // 01 RO — membrane + impurities held back
    tl.to(S, { ro: 1, duration: 0.45 }, 1.15)
      .to(S, { spin: Math.PI * 1.5, duration: 2 }, 1)
      .to(S, { ro: 0, duration: 0.35 }, 2.6);
    // 02 UV — a ring of ultraviolet light scans the bottle
    tl.to(S, { uv: 1, duration: 0.3 }, 3.1)
      .fromTo(S, { uvY: 0 }, { uvY: 1, duration: 1.4, ease: 'power1.inOut' }, 3.2)
      .to(S, { uv: 0, duration: 0.3 }, 4.6);
    // 03 Ozonation — fine bubbles rise through the water
    tl.to(S, { bubbles: 1, duration: 0.4 }, 5.1)
      .to(S, { spin: TAU, duration: 2 }, 5)
      .to(S, { bubbles: 0, duration: 0.35 }, 6.6);
    // 04 Minerals — sparkles spiral in and dissolve
    tl.to(S, { minerals: 1, duration: 1.85, ease: 'power1.inOut' }, 7.05);
    // 05 Sealed — label wraps back, cap screws on, bottle turns to face you
    tl.to(S, { wrap: 1, duration: 0.9, ease: 'power2.inOut' }, 9.05)
      .to(S, { capLift: 0, duration: 1, ease: 'power3.out' }, 9.3)
      .to(S, { capSpin: 0, duration: 1, ease: 'power2.out' }, 9.3)
      .to(S, { spin: TAU * 2, duration: 1.3, ease: 'power2.inOut' }, 9.05)
      .to(S, { sway: 0.3, duration: 0.8 }, 10.2)
      .to({}, { duration: 0.6 }, 11);
  }

  /* ------------------------------------------------------------------ */
  /* Other home sections                                                  */
  /* ------------------------------------------------------------------ */

  // size posters: the stack fans out on scroll; click to view full size
  function setupCampaign() {
    var box = document.getElementById('posterBox');
    var posters = gsap.utils.toArray('.poster');
    if (box && typeof box.showModal === 'function') {
      var boxImg = box.querySelector('img');
      posters.forEach(function (btn) {
        btn.addEventListener('click', function () {
          boxImg.src = btn.dataset.full;
          boxImg.alt = btn.querySelector('img').alt;
          box.showModal();
          if (Site.lenis) Site.lenis.stop();
          if (!reduce) gsap.fromTo(box, { scale: 0.86, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.55, ease: 'back.out(1.6)' });
        });
      });
      box.querySelector('.lightbox__close').addEventListener('click', function () { box.close(); });
      box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
      box.addEventListener('close', function () { if (Site.lenis) Site.lenis.start(); });
    } else {
      posters.forEach(function (btn) {
        btn.addEventListener('click', function () { window.open(btn.dataset.full, '_blank', 'noopener'); });
      });
    }
    if (reduce) return;

    var deck = document.querySelector('.campaign__deck');
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', function () {
      var fan = [-9, 0, 9];
      var rest = [-2, 0, 2];
      gsap.fromTo(posters, {
        x: function (i, el) { return deck.offsetWidth / 2 - (el.offsetLeft + el.offsetWidth / 2); },
        y: function (i) { return 50 + Math.abs(i - 1) * 26; },
        rotation: function (i) { return fan[i]; },
        scale: 0.84
      }, {
        x: 0, y: 0, scale: 1, ease: 'none',
        rotation: function (i) { return rest[i]; },
        scrollTrigger: { trigger: deck, start: 'top 95%', end: 'top 38%', scrub: 0.8, invalidateOnRefresh: true }
      });
    });
    mm.add('(max-width: 899px)', function () {
      gsap.from(posters, {
        y: 60, autoAlpha: 0, rotation: function (i) { return i % 2 ? 4 : -4; }, duration: 1, ease: 'power3.out', stagger: 0.1,
        scrollTrigger: { trigger: deck, start: 'top 85%', once: true }
      });
    });
  }

  function setupSections() {
    if (reduce) return;

    // horizontal "moments" gallery
    var mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', function () {
      var track = document.querySelector('.moments__track');
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: { trigger: '.moments', start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: 0.8, invalidateOnRefresh: true }
      });
    });
    gsap.from('.moment', {
      y: 80, autoAlpha: 0, duration: 1.1, ease: 'power3.out', stagger: 0.1,
      scrollTrigger: { trigger: '.moments', start: 'top 70%', once: true }
    });
    gsap.from('.moment__art svg', {
      scale: 0.3, rotation: -25, autoAlpha: 0, duration: 1.2, ease: 'back.out(1.7)', stagger: 0.12, delay: 0.3,
      scrollTrigger: { trigger: '.moments', start: 'top 70%', once: true }
    });

    // products: bottles drop in, idle float, tilt on hover
    gsap.utils.toArray('.product').forEach(function (p, i) {
      var img = p.querySelector('.product__img');
      var stageEl = p.querySelector('.product__stage');
      gsap.from(img, {
        yPercent: -70, rotation: -10, autoAlpha: 0, duration: 1.4, ease: 'bounce.out', delay: i * 0.12,
        scrollTrigger: { trigger: p, start: 'top 80%', once: true }
      });
      gsap.to(img, { y: -12, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * 0.35 });
      if (!window.matchMedia('(hover: hover)').matches) return;
      var ry = gsap.quickTo(img, 'rotationY', { duration: 0.7, ease: 'power3' });
      var rz = gsap.quickTo(img, 'rotation', { duration: 0.7, ease: 'power3' });
      var x = gsap.quickTo(img, 'x', { duration: 0.7, ease: 'power3' });
      stageEl.addEventListener('pointermove', function (e) {
        var r = stageEl.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5;
        ry(nx * 30); rz(nx * 6); x(nx * 18);
      });
      stageEl.addEventListener('pointerleave', function () { ry(0); rz(0); x(0); });
    });

    gsap.to('.about__sticker .ring', { rotation: 360, duration: 18, ease: 'none', repeat: -1 });
  }
})();
