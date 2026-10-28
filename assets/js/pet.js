/*!
 * GIO Spark — PET bottles page
 * Pinned 3D story (a preform heats up and is blown into an empty bottle) and the
 * blowing-line video with chapter captions.
 */
(function () {
  'use strict';

  var Site = window.GioSite || {};
  var root = document.documentElement;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var reduce = !!Site.reduce;
  var TAU = Math.PI * 2;

  /* ---------------- Blowing-line video: captions, chapters, pause ---------------- */
  var CHAPTERS = [
    { t: 0, text: 'Preforms load from the hopper' },
    { t: 4.3, text: 'Preforms feed into the blowing machine' },
    { t: 8.4, text: 'Infrared heaters soften each preform' },
    { t: 14.9, text: 'Blown bottles leave the machine' }
  ];

  function initReel() {
    var reel = document.querySelector('.reel');
    if (!reel) return;
    var video = reel.querySelector('video');
    var num = reel.querySelector('.reel__num');
    var text = reel.querySelector('.reel__text');
    var bar = reel.querySelector('.reel__progress i');
    var toggle = reel.querySelector('.reel__toggle');
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.reel__chapters button'));
    var current = -1;

    function show(i) {
      if (i === current) return;
      current = i;
      buttons.forEach(function (b, k) { b.classList.toggle('is-active', k === i); });
      var apply = function () { num.textContent = '0' + (i + 1); text.textContent = CHAPTERS[i].text; };
      if (hasGsap && !reduce) {
        gsap.to([num, text], {
          autoAlpha: 0, y: -8, duration: 0.2, ease: 'power2.in',
          onComplete: function () { apply(); gsap.fromTo([num, text], { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power3.out' }); }
        });
      } else {
        apply();
      }
    }

    video.addEventListener('timeupdate', function () {
      var t = video.currentTime;
      var i = 0;
      for (var k = 0; k < CHAPTERS.length; k++) if (t >= CHAPTERS[k].t) i = k;
      show(i);
      if (bar && video.duration) bar.style.transform = 'scaleX(' + (t / video.duration) + ')';
    });

    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () {
        video.currentTime = CHAPTERS[i].t + 0.05;
        show(i);
        if (video.paused && !video.dataset.userPaused) video.play().catch(function () {});
      });
    });

    toggle.addEventListener('click', function () {
      if (video.paused) {
        delete video.dataset.userPaused;
        video.play().catch(function () {});
      } else {
        video.dataset.userPaused = '1';
        video.pause();
      }
    });
    var sync = function () {
      var paused = video.paused;
      reel.classList.toggle('is-paused', paused);
      toggle.setAttribute('aria-label', paused ? 'Play video' : 'Pause video');
      toggle.setAttribute('aria-pressed', String(paused));
    };
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    sync();
    show(0);
  }

  /* ---------------- Preform → bottle (pinned) ---------------- */
  function initBlow() {
    var section = document.querySelector('.blow');
    var canvas = document.getElementById('petStage');
    if (!section || !canvas) return;

    var canGL = hasGsap && !reduce && window.GioBottle && window.GioBottle.supported();
    if (!canGL) {
      root.classList.add('blow-static');
      return;
    }

    window.GioBottle.create(canvas, { sizes: ['500'] }).then(function (stage) {
      var S = stage.shared;
      var I = stage.intro;
      var bottle = stage.bottles['500'];
      bottle.off.visible = true;
      gsap.set(I, { fill: 0 });
      var mm = gsap.matchMedia();
      mm.add({ desk: '(min-width: 900px)', mob: '(max-width: 899px)' }, function (ctx) {
        var desk = ctx.conditions.desk;
        // start close on the small preform, pull back as it is blown into a full bottle
        var near = desk ? { y: -0.28, h: 1.2 } : { y: -0.08, h: 0.7 };
        var far = desk ? { y: 0, h: 0.78 } : { y: 0.05, h: 0.39 };
        var glow = document.querySelector('.blow__glow');
        gsap.set(S, {
          empty: 1, inflate: 0, heat: 0, wrap: 0,
          x: desk ? 0.2 : 0, y: near.y, h: near.h,
          tiltZ: 0, tiltX: 0.03, sway: 0.35, float: 1, follow: 0.6, spin: 0
        });
        gsap.set(glow, { opacity: 0 });

        var steps = gsap.utils.toArray('.blow .step');
        var bars = gsap.utils.toArray('.blow .rail__bar i');
        var items = gsap.utils.toArray('.blow .rail__item');
        var active = -1;
        var tl = gsap.timeline({
          defaults: { ease: 'none' },
          onUpdate: function () {
            var k = Math.min(4, Math.floor(this.time() / 2));
            if (k !== active) {
              active = k;
              items.forEach(function (it, i) { it.classList.toggle('is-active', i === k); });
            }
          },
          scrollTrigger: { trigger: section, start: 'top top', end: '+=' + (desk ? 420 : 380) + '%', pin: '.blow__pin', scrub: 0.8, anticipatePin: 1 }
        });

        // text: one step per 2 units of timeline
        for (var k = 0; k < steps.length; k++) {
          var at = k * 2;
          if (k > 0) {
            tl.to(steps[k - 1], { autoAlpha: 0, y: -30, duration: 0.3, ease: 'power2.in' }, at - 0.1)
              .fromTo(steps[k], { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }, at + 0.15);
          }
          tl.to(bars[k], { scaleX: 1, duration: 2 }, at);
        }

        // 01 preform turns slowly · 02 it glows as it heats · 03 stretch & blow
        // 04 it cools clear · 05 a finished bottle turns to face you
        tl.to(S, { spin: Math.PI, duration: 2 }, 0)
          .to(S, { heat: 1, duration: 1.2, ease: 'power1.inOut' }, 2.1)
          .to(glow, { opacity: 1, duration: 1.2 }, 2.1)
          .to(S, { spin: TAU, duration: 2 }, 2)
          .to(S, { inflate: 1, y: far.y, h: far.h, duration: 1.5, ease: 'power2.inOut' }, 4.2)
          .to(S, { heat: 0.6, duration: 1.5 }, 4.2)
          .to(S, { heat: 0, duration: 1.2, ease: 'power1.out' }, 6.1)
          .to(glow, { opacity: 0, duration: 1.2 }, 6.1)
          .to(S, { spin: TAU * 2, duration: 2.2, ease: 'power2.inOut' }, 6)
          .to(S, { spin: TAU * 3, duration: 2, ease: 'power2.inOut' }, 8)
          .to({}, { duration: 0.5 }, 9.8);
      });

      gsap.ticker.add(stage.tick);
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch') return;
        stage.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
      }, { passive: true });

      // only render while the story is on screen
      ScrollTrigger.create({
        trigger: section, start: 'top bottom', end: 'bottom top',
        onToggle: function (self) { if (self.isActive) stage.start(); else stage.stop(); }
      });
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    }).catch(function () {
      root.classList.add('blow-static');
    });
  }

  /* ---------------- Custom bottles banner: the shapes pop up one by one ---------------- */
  function initCustom() {
    var art = document.querySelector('.pet-custom__art');
    if (!art || !hasGsap || reduce) return;
    gsap.from(art.querySelectorAll('.pet-custom__bottle'), {
      y: 60, autoAlpha: 0, duration: 0.9, ease: 'back.out(1.7)', stagger: 0.1,
      scrollTrigger: { trigger: art, start: 'top 85%', once: true }
    });
  }

  initReel();
  initBlow();
  initCustom();
})();
