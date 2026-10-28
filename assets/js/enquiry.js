/*!
 * GIO Spark — enquiry page
 * URL prefill (?type= / ?product=), type-specific fields (distributorship, empty PET bottles)
 * and a 3D bottle that follows the size picked in the form.
 */
(function () {
  'use strict';

  var Site = window.GioSite || {};
  var hasGsap = !!window.gsap;
  var reduce = !!Site.reduce;
  var root = document.documentElement;
  var form = document.querySelector('form[data-gio-form]');
  if (!form) return;

  /* ---------------- Prefill from links like enquiry.html?type=distributor&product=500 ---------------- */
  var params = new URLSearchParams(location.search);
  var type = params.get('type');
  if (type) {
    var radio = form.querySelector('input[name="type"][data-key="' + type + '"]');
    if (radio) radio.checked = true;
  }
  var product = params.get('product');
  if (product) {
    var box = form.querySelector('input[name="sizes"][data-size="' + product + '"]');
    if (box) box.checked = true;
    // PET bottles are made to order, so the size is a free-text field there
    var PET_SIZES = { '200': '200 ml', '500': '500 ml', '1000': '1 litre' };
    var petSize = form.querySelector('#pet_size');
    if (type === 'pet' && petSize && PET_SIZES[product]) petSize.value = PET_SIZES[product];
  }

  /* ---------------- Fields that only apply to (or are hidden for) one enquiry type ---------------- */
  var conditionals = Array.prototype.slice.call(document.querySelectorAll('.conditional[data-for]'));
  var hideables = Array.prototype.slice.call(form.querySelectorAll('[data-hide-for]'));
  var refresh = function () { if (window.ScrollTrigger) ScrollTrigger.refresh(); };

  function chosenType() {
    var checked = form.querySelector('input[name="type"]:checked');
    return checked ? checked.dataset.key : '';
  }

  function hiddenFor(el, t) { return el.dataset.hideFor.split(' ').indexOf(t) > -1; }

  function syncConditional(animate) {
    var t = chosenType();
    conditionals.forEach(function (cond) { toggleBlock(cond, cond.dataset.for === t, animate); });
    hideables.forEach(function (el) { toggleBlock(el, !hiddenFor(el, t), animate); });
    // keep the step numbers in order when a step is hidden
    var n = 0;
    form.querySelectorAll('.fieldset').forEach(function (fs) {
      var num = fs.querySelector('.fieldset__legend .num');
      if (num && !(fs.dataset.hideFor && hiddenFor(fs, t))) num.textContent = String(++n);
    });
    if (stage) {
      stage.shared.empty = chosenType() === 'pet' ? 1 : 0;
    } else {
      var img = document.querySelector('.subhero__fallback');
      if (img && current) img.src = fallbackSrc(current);
    }
  }

  function fallbackSrc(id) {
    return chosenType() === 'pet' ? 'assets/img/pet/empty-' + id + '.png' : 'assets/img/bottle-' + id + '.png';
  }

  function toggleBlock(cond, on, animate) {
    // track the wanted state, so switching back mid-animation still lands right
    var shown = cond.dataset.shown ? cond.dataset.shown === '1' : !cond.hidden;
    if (on === shown) return;
    cond.dataset.shown = on ? '1' : '0';
    var fields = cond.querySelectorAll('input, select, textarea');
    var tween = animate && hasGsap && !reduce;
    var settle = function () {
      if (hasGsap) gsap.set(cond, { clearProps: 'height,opacity,visibility,overflow' });
      refresh();
    };
    if (hasGsap) gsap.killTweensOf(cond);
    if (on) {
      var wasHidden = cond.hidden;
      cond.hidden = false;
      fields.forEach(function (f) { f.disabled = false; });
      if (tween) {
        gsap.set(cond, wasHidden ? { height: 0, autoAlpha: 0, overflow: 'hidden' } : { overflow: 'hidden' });
        gsap.to(cond, { height: 'auto', autoAlpha: 1, duration: 0.6, ease: 'power3.out', onComplete: settle });
      } else {
        settle();
      }
    } else {
      fields.forEach(function (f) { f.disabled = true; });
      var done = function () { cond.hidden = true; settle(); };
      if (tween) {
        gsap.set(cond, { overflow: 'hidden' });
        gsap.to(cond, { height: 0, autoAlpha: 0, duration: 0.45, ease: 'power3.inOut', onComplete: done });
      } else {
        done();
      }
    }
  }
  /* ---------------- 3D bottle in the hero ---------------- */
  var ORDER = ['200', '500', '1000'];
  var canvas = document.getElementById('enquiryStage');
  var art = document.querySelector('.subhero__art');
  var stage = null;
  var current = null;

  syncConditional(false);

  function chosenSize() {
    var checked = form.querySelector('input[name="sizes"]:checked');
    return checked ? checked.dataset.size : '500';
  }

  function showSize(id, instant) {
    if (id === current) return;
    var prev = current;
    current = id;
    if (!stage) {
      var img = document.querySelector('.subhero__fallback');
      if (img) img.src = fallbackSrc(id);
      return;
    }
    var next = stage.bottles[id].off;
    if (instant || !hasGsap || reduce) {
      ORDER.forEach(function (k) { stage.bottles[k].off.visible = k === id; });
      return;
    }
    if (prev) {
      var old = stage.bottles[prev].off;
      gsap.killTweensOf(old);
      gsap.to(old, { y: 1.3, spin: '+=' + Math.PI * 1.2, scale: 0.72, duration: 0.6, ease: 'power3.in', onComplete: function () { gsap.set(old, { visible: false, y: 0, spin: 0, scale: 1 }); } });
    }
    gsap.killTweensOf(next);
    gsap.set(next, { visible: true, y: -1.3, spin: -Math.PI * 1.4, scale: 0.72 });
    gsap.to(next, { y: 0, spin: 0, scale: 1, duration: 1.1, ease: 'back.out(1.25)', delay: prev ? 0.4 : 0 });
  }

  form.addEventListener('change', function (e) {
    if (e.target.name === 'type') syncConditional(true);
    if (e.target.name === 'sizes') showSize(chosenSize());
  });

  var canGL = hasGsap && !reduce && window.GioBottle && window.GioBottle.supported();
  if (!canGL) {
    root.classList.add('no-webgl');
    showSize(chosenSize());
    return;
  }

  window.GioBottle.create(canvas, { sizes: ORDER }).then(function (s) {
    stage = s;
    var S = stage.shared;
    var I = stage.intro;
    gsap.set(S, { x: 0, y: -0.02, h: 0.74, tiltZ: 0, tiltX: 0.03, sway: 1, follow: 1 });
    S.empty = chosenType() === 'pet' ? 1 : 0;
    gsap.ticker.add(stage.tick);

    // drop in, then fill + cap like on the home page (shorter)
    gsap.set(I, { y: -1.2, spin: -Math.PI, fill: 0.15, capLift: 3, capSpin: Math.PI * 4, tilt: 0 });
    showSize(chosenSize(), true);
    gsap.timeline({ delay: 0.25 })
      .to(I, { y: 0, spin: 0, duration: 1.2, ease: 'power3.out' })
      .to(I, { fill: 1, duration: 1.1, ease: 'power1.inOut' }, 0.5)
      .to(I, { capLift: 0, capSpin: 0, duration: 0.8, ease: 'power3.out' }, 1.4);

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    }, { passive: true });

    // drag to spin
    var dragging = false;
    var lastX = 0;
    art.style.touchAction = 'pan-y';
    art.addEventListener('pointerdown', function (e) { dragging = true; stage.dragging = true; lastX = e.clientX; });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX;
      lastX = e.clientX;
      stage.dragAngle += dx * 0.011;
      stage.dragVel = dx * 0.011;
    }, { passive: true });
    var end = function () { dragging = false; stage.dragging = false; };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);

    // only render while the hero is on screen
    if (window.ScrollTrigger) {
      ScrollTrigger.create({
        trigger: '.subhero', start: 'top top', end: 'bottom top',
        onLeave: function () { stage.stop(); }, onEnterBack: function () { stage.start(); }
      });
    }
  }).catch(function () {
    root.classList.add('no-webgl');
    showSize(chosenSize());
  });
})();
