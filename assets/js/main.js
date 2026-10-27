/*!
 * GIO Spark — shared site behaviour (all pages)
 * Smooth scroll, header, mobile menu, page transitions, reveals, marquees,
 * cursor, magnetic buttons, FAQ and form handling.
 */
(function () {
  'use strict';

  var CFG = window.GIOSPARK || {};
  var root = document.documentElement;
  var body = document.body;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var Site = window.GioSite = { reduce: reduce, lenis: null, hasGsap: hasGsap };

  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(SplitText);
    if (window.CustomEase) {
      gsap.registerPlugin(CustomEase);
      CustomEase.create('water', '0.7,0,0.2,1');
    }
    if (reduce) root.classList.add('is-static');
  } else {
    root.classList.add('no-gsap', 'is-static', 'no-webgl');
  }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------------- Smooth scroll ---------------- */
  function initLenis() {
    if (!hasGsap || reduce || !window.Lenis) return;
    var lenis = new Lenis({ lerp: 0.095, smoothWheel: true });
    Site.lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  Site.scrollTo = function (target, opts) {
    opts = opts || {};
    var el = target;
    if (typeof target === 'string') el = target === '#' ? 0 : document.querySelector(target);
    if (el === null || el === undefined) return;
    // resolve to an absolute position from the live scroll value (Lenis can lag behind native scrolls)
    var y = typeof el === 'number' ? el : el.getBoundingClientRect().top + window.scrollY + (opts.offset || 0);
    y = Math.max(0, y);
    if (Site.lenis) {
      Site.lenis.scrollTo(y, {
        immediate: !!opts.immediate,
        force: true,
        duration: 1.5,
        easing: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
      });
    } else {
      window.scrollTo({ top: y, behavior: reduce || opts.immediate ? 'auto' : 'smooth' });
    }
  };

  /* ---------------- Header ---------------- */
  function initHeader() {
    var header = document.getElementById('siteHeader');
    if (!header) return;
    var last = window.scrollY;
    var ticking = false;
    function update() {
      var y = window.scrollY;
      header.classList.toggle('is-solid', y > 30);
      if (Math.abs(y - last) > 6) {
        header.classList.toggle('is-hidden', y > last && y > 480 && !body.classList.contains('menu-open'));
        last = y;
      }
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------------- Mobile menu ---------------- */
  function initMenu() {
    var btn = document.querySelector('.nav__burger');
    var menu = document.getElementById('mobileMenu');
    if (!btn || !menu) return;
    var open = false;
    var tl = null;
    if (hasGsap) {
      tl = gsap.timeline({ paused: true })
        .set(menu, { autoAlpha: 1 })
        .fromTo(menu.querySelector('.mobile-menu__bg'),
          { clipPath: 'circle(0% at calc(100% - 46px) 46px)' },
          { clipPath: 'circle(150% at calc(100% - 46px) 46px)', duration: 0.8, ease: 'power3.inOut' }, 0)
        .from(menu.querySelectorAll('.mobile-menu__nav span, .mobile-menu__nav small'), {
          yPercent: 120, autoAlpha: 0, stagger: 0.04, duration: 0.6, ease: 'power3.out'
        }, 0.3)
        .from(menu.querySelector('.mobile-menu__foot'), { autoAlpha: 0, y: 20, duration: 0.5 }, 0.5);
    }
    function set(v) {
      open = v;
      body.classList.toggle('menu-open', v);
      btn.setAttribute('aria-expanded', String(v));
      btn.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', String(!v));
      if (tl) { if (v) tl.timeScale(1).play(); else tl.timeScale(1.7).reverse(); }
      if (Site.lenis) { if (v) Site.lenis.stop(); else Site.lenis.start(); }
    }
    btn.addEventListener('click', function () { set(!open); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) set(false); });
    Site.closeMenu = function () { if (open) set(false); };
  }

  /* ---------------- Links: smooth anchors + page transitions ---------------- */
  function isHome(path) { return /(^|\/)(index\.html)?$/.test(path); }

  function initLinks() {
    var panel = document.querySelector('.page-transition__panel');

    // page enter
    if (root.classList.contains('is-entering')) {
      try { sessionStorage.removeItem('gio-pt'); } catch (e) {}
      if (panel && hasGsap && !reduce) {
        gsap.set(panel, { yPercent: 0 });
        root.classList.remove('is-entering');
        gsap.to(panel, { yPercent: -112, duration: 1, ease: 'water', delay: 0.12 });
      } else {
        root.classList.remove('is-entering');
      }
    }
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && panel && hasGsap) gsap.set(panel, { yPercent: 105 });
    });

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      var href = a.getAttribute('href');
      if (/^(tel:|mailto:|https?:|\/\/|javascript:)/i.test(href)) return;
      var url = new URL(a.href, location.href);
      var samePage = url.pathname === location.pathname || (isHome(url.pathname) && isHome(location.pathname) && url.pathname.replace(/index\.html$/, '') === location.pathname.replace(/index\.html$/, ''));

      if (samePage && (url.hash || !url.search)) {
        var target = url.hash && url.hash.length > 1 ? document.querySelector(url.hash) : 0;
        if (target === null) return;
        e.preventDefault();
        if (Site.closeMenu) Site.closeMenu();
        Site.scrollTo(target);
        if (url.hash && history.replaceState) history.replaceState(null, '', url.hash);
        return;
      }
      if (!panel || !hasGsap || reduce) return;
      e.preventDefault();
      if (Site.closeMenu) Site.closeMenu();
      try { sessionStorage.setItem('gio-pt', '1'); } catch (err) {}
      gsap.fromTo(panel, { yPercent: 105 }, {
        yPercent: 0, duration: 0.8, ease: 'water',
        onComplete: function () { location.href = a.href; }
      });
    });
  }

  /* ---------------- Reveal animations ---------------- */
  function initReveals() {
    if (!hasGsap) return;
    var els = gsap.utils.toArray('[data-reveal]');
    var groups = gsap.utils.toArray('[data-reveal-group]');
    var splits = gsap.utils.toArray('[data-split]');

    if (reduce) {
      gsap.set(els, { opacity: 1, y: 0 });
      groups.forEach(function (g) { gsap.set(g.children, { opacity: 1, y: 0 }); });
      gsap.set(splits, { visibility: 'visible' });
      return;
    }

    els.forEach(function (el) {
      gsap.to(el, {
        opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', delay: parseFloat(el.dataset.delay) || 0,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });
    groups.forEach(function (g) {
      gsap.to(g.children, {
        opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09,
        scrollTrigger: { trigger: g, start: 'top 88%', once: true }
      });
    });

    var runSplits = function () {
      splits.forEach(function (el) {
        if (!window.SplitText) { el.style.visibility = 'visible'; return; }
        SplitText.create(el, {
          type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
          onSplit: function (self) {
            gsap.set(el, { visibility: 'visible' });
            return gsap.from(self.lines, {
              yPercent: 108, duration: 1.2, stagger: 0.1, ease: 'power4.out',
              scrollTrigger: { trigger: el, start: 'top 88%', once: true }
            });
          }
        });
      });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(runSplits); else runSplits();

    gsap.utils.toArray('[data-parallax]').forEach(function (img) {
      gsap.fromTo(img, { yPercent: -7 }, {
        yPercent: 7, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  /* ---------------- Marquees ---------------- */
  function initMarquees() {
    if (!hasGsap) return;
    var rows = document.querySelectorAll('[data-marquee]');
    if (!rows.length) return;
    var build = function () {
      rows.forEach(function (row) {
        var track = row.querySelector('.marquee__track');
        var item = track.firstElementChild;
        var w = item.getBoundingClientRect().width || 1;
        var copies = Math.max(2, Math.ceil((Math.max(window.innerWidth, 1920) * 2) / w));
        for (var i = 1; i < copies; i++) track.appendChild(item.cloneNode(true));
        var reverse = row.dataset.marquee === 'reverse';
        var speed = parseFloat(row.dataset.speed) || 60;
        var tween = gsap.fromTo(track, { x: reverse ? -w : 0 }, { x: reverse ? 0 : -w, duration: w / speed, ease: 'none', repeat: -1 });
        if (reduce) { tween.pause(); return; }
        ScrollTrigger.create({
          trigger: row, start: 'top bottom', end: 'bottom top',
          onToggle: function (self) { if (self.isActive) tween.play(); else tween.pause(); },
          onUpdate: function (self) {
            var boost = Math.min(Math.abs(self.getVelocity()) / 250, 5);
            gsap.to(tween, { timeScale: 1 + boost, duration: 0.25, overwrite: true });
            gsap.to(tween, { timeScale: 1, duration: 1.4, delay: 0.25, ease: 'power2.out' });
          }
        });
      });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build); else build();
  }

  /* ---------------- Cursor + magnetic ---------------- */
  function initCursor() {
    if (!hasGsap || reduce || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    var c = document.querySelector('.cursor');
    if (!c) return;
    root.classList.add('has-cursor');
    var dot = c.querySelector('.cursor__dot');
    var ring = c.querySelector('.cursor__ring');
    var dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
    var dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
    var rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
    var ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
    gsap.set(c, { autoAlpha: 0 });
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      gsap.to(c, { autoAlpha: 1, duration: 0.3, overwrite: 'auto' });
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    }, { passive: true });
    document.addEventListener('pointerover', function (e) {
      var t = e.target;
      if (!t.closest) return;
      var interactive = t.closest('a, button, label, input, select, textarea, [role="tab"]');
      c.classList.toggle('is-link', !!interactive);
      c.classList.toggle('is-drag', !interactive && !!t.closest('[data-cursor="drag"]'));
      c.classList.toggle('is-dark', !!t.closest('.process, .site-footer, .cta__card, .m-navy, .aside-card--dark, .page-transition'));
    });
    document.documentElement.addEventListener('pointerleave', function () { gsap.to(c, { autoAlpha: 0, duration: 0.3 }); });
  }

  function initMagnetic() {
    if (!hasGsap || reduce || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      var xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.45)' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.45)' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * 0.28);
        yTo((e.clientY - r.top - r.height / 2) * 0.4);
      });
      el.addEventListener('pointerleave', function () { xTo(0); yTo(0); });
    });
  }

  /* ---------------- FAQ ---------------- */
  function initFaq() {
    document.querySelectorAll('.faq__q').forEach(function (q) {
      var a = document.getElementById(q.getAttribute('aria-controls'));
      if (!a) return;
      q.addEventListener('click', function () {
        var open = q.getAttribute('aria-expanded') === 'true';
        q.setAttribute('aria-expanded', String(!open));
        if (hasGsap && !reduce) {
          gsap.to(a, { height: open ? 0 : 'auto', duration: 0.55, ease: 'power3.inOut', onComplete: function () { ScrollTrigger.refresh(); } });
        } else {
          a.style.height = open ? '0' : 'auto';
        }
      });
    });
  }

  /* ---------------- Forms ---------------- */
  var PHONE_RE = /^[6-9]\d{9}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function cleanPhone(v) {
    var d = String(v || '').replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return d;
  }
  Site.cleanPhone = cleanPhone;

  function holderOf(el) {
    if (el.type === 'radio' || el.type === 'checkbox') return el.closest('[data-required-group]') || el.closest('.field');
    return el.closest('.field');
  }

  function setError(holder, el, msg) {
    if (!holder) return;
    holder.classList.toggle('is-invalid', !!msg);
    var err = holder.querySelector('.field__error');
    if (err) err.textContent = msg || '';
    if (el && el.setAttribute) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function validateField(el) {
    if (el.disabled || el.closest('[hidden]')) return true;
    var holder = holderOf(el);
    if (el.type === 'radio' || el.type === 'checkbox') {
      var group = el.closest('[data-required-group]');
      if (!group) {
        if (el.required && !el.checked) { setError(holder, el, el.dataset.msg || 'Please tick this box to continue.'); return false; }
        setError(holder, el, '');
        return true;
      }
      var ok = !!group.querySelector('input[name="' + el.name + '"]:checked');
      setError(group, null, ok ? '' : (group.dataset.msg || 'Please choose an option.'));
      return ok;
    }
    var v = el.value.trim();
    var msg = '';
    if (el.required && !v) msg = el.dataset.msg || 'This field is required.';
    else if (v && el.type === 'tel' && !PHONE_RE.test(cleanPhone(v))) msg = 'Please enter a valid 10-digit mobile number.';
    else if (v && el.type === 'email' && !EMAIL_RE.test(v)) msg = 'Please enter a valid email address.';
    setError(holder, el, msg);
    return !msg;
  }

  function validateForm(form) {
    var first = null;
    var ok = true;
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.classList.contains('hp-input') || el.type === 'submit' || el.type === 'hidden') return;
      var good = validateField(el);
      if (!good && !first) first = el;
      ok = ok && good;
    });
    if (first) {
      var holder = holderOf(first) || first;
      Site.scrollTo(holder, { offset: -130 });
      setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }, 350);
    }
    return ok;
  }

  // lines: labelled values for the WhatsApp / email hand-off
  // fields: one string per field name (multi-selects joined) for the JSON post
  function collect(form) {
    var fd = new FormData(form);
    var lines = [];
    var fields = {};
    var seen = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || seen[el.name] || el.disabled || el.type === 'submit' || el.type === 'hidden') return;
      seen[el.name] = true;
      var vals = fd.getAll(el.name).map(function (v) { return String(v).trim(); }).filter(Boolean);
      if (el.classList.contains('hp-input')) { fields[el.name] = vals.join(''); return; }
      if (!vals.length) return;
      var labelHost = el.closest('[data-label]');
      var label = el.dataset.label || (labelHost && labelHost.dataset.label) || el.name;
      var val = vals.join(', ');
      fields[el.name] = val;
      if (el.type === 'tel') val = '+91 ' + cleanPhone(val);
      lines.push({ label: label, value: val });
    });
    return { lines: lines, fields: fields };
  }

  function messageText(form, data) {
    var title = form.dataset.title || 'Website enquiry';
    return title + ' (GIO Spark website)\n\n' + data.lines.map(function (l) { return l.label + ': ' + l.value; }).join('\n');
  }

  function send(form, data) {
    var url = CFG.formEndpoint;
    if (!url || !/^https?:$/.test(location.protocol) || !window.fetch) return Promise.resolve(false);
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    var payload = Object.assign({}, CFG.formExtra || {}, data.fields, { form: form.dataset.form || 'enquiry' });
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.ok ? r.json() : { ok: false }; })
      .then(function (j) { clearTimeout(timer); return !!(j && (j.ok === true || j.success === true)); })
      .catch(function () { clearTimeout(timer); return false; });
  }

  function fillDrop(result) {
    var fill = result.querySelector('.drop-fill');
    var check = result.querySelector('.drop-check');
    if (!hasGsap || reduce) {
      if (fill) fill.setAttribute('transform', 'translate(0 0)');
      return;
    }
    if (fill) gsap.fromTo(fill, { attr: { transform: 'translate(0 160)' } }, { attr: { transform: 'translate(0 0)' }, duration: 1.4, ease: 'power2.inOut' });
    if (check) {
      var len = check.getTotalLength ? check.getTotalLength() : 100;
      gsap.fromTo(check, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out', delay: 1.1 });
    }
  }

  function showResult(form, sent, data) {
    var card = form.closest('.form-card');
    var result = card.querySelector(sent ? '[data-result="sent"]' : '[data-result="handoff"]');
    var head = card.querySelector('.form-card__head');
    var nameEl = form.querySelector('[name="name"]');
    var name = nameEl ? nameEl.value.trim() : '';
    var msg = messageText(form, data);
    var subject = (form.dataset.title || 'Website enquiry') + (name ? ' from ' + name : '');
    var wa = 'https://wa.me/' + (CFG.whatsapp || '') + '?text=' + encodeURIComponent(msg);
    var mail = 'mailto:' + (CFG.email || '') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(msg);
    result.querySelectorAll('[data-wa]').forEach(function (a) { a.href = wa; });
    result.querySelectorAll('[data-mail]').forEach(function (a) { a.href = mail; });
    result.querySelectorAll('[data-name]').forEach(function (s) { s.textContent = name ? name.split(/\s+/)[0] : 'there'; });

    var swap = function () {
      form.hidden = true;
      if (head) head.hidden = true;
      result.classList.add('is-on');
      if (hasGsap && !reduce) {
        gsap.fromTo(result.children, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.7, ease: 'power3.out' });
      }
      fillDrop(result);
      Site.scrollTo(card, { offset: -120 });
      if (hasGsap) ScrollTrigger.refresh();
      var focusEl = result.querySelector('h3');
      if (focusEl) { focusEl.setAttribute('tabindex', '-1'); focusEl.focus({ preventScroll: true }); }
    };
    if (hasGsap && !reduce) {
      gsap.to(head ? [form, head] : [form], { autoAlpha: 0, y: -20, duration: 0.4, ease: 'power2.in', onComplete: swap });
    } else {
      swap();
    }
  }

  function resetForm(form) {
    var card = form.closest('.form-card');
    var head = card.querySelector('.form-card__head');
    card.querySelectorAll('.form-result').forEach(function (r) { r.classList.remove('is-on'); });
    form.hidden = false;
    if (head) head.hidden = false;
    if (hasGsap) {
      gsap.fromTo(head ? [head, form] : [form], { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' });
      ScrollTrigger.refresh();
    }
    Site.scrollTo(card, { offset: -120 });
  }

  function initForms() {
    document.querySelectorAll('form[data-gio-form]').forEach(function (form) {
      form.setAttribute('novalidate', '');
      var submit = form.querySelector('[type="submit"]');

      form.addEventListener('focusout', function (e) {
        var el = e.target;
        if (!el.name || el.type === 'radio' || el.type === 'checkbox') return;
        if (el.value.trim() || el.closest('.field.is-invalid')) validateField(el);
      });
      form.addEventListener('input', function (e) {
        var holder = holderOf(e.target);
        if (holder && holder.classList.contains('is-invalid')) validateField(e.target);
      });
      form.addEventListener('change', function (e) {
        if (e.target.type === 'radio' || e.target.type === 'checkbox') {
          var holder = holderOf(e.target);
          if (holder && holder.classList.contains('is-invalid')) validateField(e.target);
        }
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var hp = form.querySelector('.hp-input');
        if (hp && hp.value) return;
        if (!validateForm(form)) return;
        var data = collect(form);
        if (submit) { submit.classList.add('is-busy'); submit.setAttribute('aria-busy', 'true'); }
        send(form, data).then(function (ok) {
          if (submit) { submit.classList.remove('is-busy'); submit.removeAttribute('aria-busy'); }
          showResult(form, ok, data);
        });
      });

      var card = form.closest('.form-card');
      if (card) {
        card.querySelectorAll('[data-back]').forEach(function (b) {
          b.addEventListener('click', function () { resetForm(form); });
        });
      }
    });
  }

  /* ---------------- Misc ---------------- */
  function initYear() {
    var y = String(new Date().getFullYear());
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = y; });
  }

  function initFloaters() {
    if (!hasGsap || reduce) return;
    gsap.utils.toArray('[data-spin]').forEach(function (el) {
      gsap.to(el, { rotation: 360, duration: parseFloat(el.dataset.spin) || 16, ease: 'none', repeat: -1 });
    });
    gsap.utils.toArray('[data-float]').forEach(function (el, i) {
      gsap.to(el, { y: -(parseFloat(el.dataset.float) || 14), duration: 2.4 + (i % 3) * 0.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: i * 0.25 });
    });
    gsap.utils.toArray('[data-wave]').forEach(function (el) {
      gsap.to(el, { xPercent: -50, duration: parseFloat(el.dataset.wave) || 12, ease: 'none', repeat: -1 });
    });
    if (document.querySelector('.cta__ripple')) {
      gsap.fromTo('.cta__ripple span', { scale: 0.25, opacity: 0.9 }, { scale: 1.25, opacity: 0, duration: 4.5, stagger: 1.5, repeat: -1, ease: 'sine.out' });
      gsap.from('.cta__bottle', {
        yPercent: 40, autoAlpha: 0, duration: 1.3, ease: 'back.out(1.4)', stagger: 0.12,
        scrollTrigger: { trigger: '.cta__card', start: 'top 75%', once: true }
      });
    }
    if (document.querySelector('.mascot')) {
      gsap.to('.mascot__arm', { rotation: -22, svgOrigin: '168 134', duration: 0.45, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      gsap.timeline({ repeat: -1, repeatDelay: 3.2 })
        .to('.mascot__eye', { scaleY: 0.12, transformOrigin: '50% 50%', duration: 0.08, ease: 'power1.in' })
        .to('.mascot__eye', { scaleY: 1, duration: 0.12, ease: 'power1.out' });
    }
  }

  initLenis();
  initHeader();
  initMenu();
  initLinks();
  initReveals();
  initMarquees();
  initCursor();
  initMagnetic();
  initFaq();
  initForms();
  initYear();
  initFloaters();

  if (hasGsap) {
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
  }
  try { sessionStorage.setItem('gio-loaded', '1'); } catch (e) {}
})();
