/* Futureproof LAB kit — tiny motion + feedback toolkit (global `LAB`).
 * Spring physics, odometers, haptics, subtle UI sound, bottom sheet, rAF loop,
 * SVG path sampling for particle flows. Vanilla, no build. */
(function () {
  "use strict";
  var LAB = {};
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  LAB.reducedMotion = reduced;

  /* ---------- easing ---------- */
  LAB.ease = {
    outExpo: function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outBack: function (t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    linear: function (t) { return t; }
  };
  LAB.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  LAB.lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ---------- rAF loop with dt (seconds), pauses when hidden ---------- */
  LAB.loop = function (fn) {
    var last = 0, id = 0, running = true, stopped = false;
    function tick(now) {
      if (!running) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
      last = now; fn(dt, now / 1000); id = requestAnimationFrame(tick);
    }
    id = requestAnimationFrame(tick);
    function onVis() {
      if (document.hidden) { running = false; cancelAnimationFrame(id); }
      else if (!running && !stopped) { running = true; last = 0; id = requestAnimationFrame(tick); }
    }
    document.addEventListener("visibilitychange", onVis);
    return { stop: function () { stopped = true; running = false; cancelAnimationFrame(id); document.removeEventListener("visibilitychange", onVis); } };
  };

  /* ---------- tween: LAB.tween(ms, fn(t), ease, done) ---------- */
  LAB.tween = function (ms, fn, ease, done) {
    ease = ease || LAB.ease.outCubic;
    if (reduced) { fn(1); if (done) done(); return; }
    var t0 = performance.now();
    (function step(now) {
      var t = LAB.clamp((now - t0) / ms, 0, 1);
      fn(ease(t));
      if (t < 1) requestAnimationFrame(step); else if (done) done();
    })(t0);
  };

  /* ---------- spring: a value that chases a target ---------- */
  LAB.spring = function (value, opts) {
    opts = opts || {};
    var s = { value: value, target: value, velocity: 0, stiffness: opts.stiffness || 170, damping: opts.damping || 22 };
    s.set = function (t) { s.target = t; return s; };
    s.snap = function (v) { s.value = s.target = v; s.velocity = 0; return s; };
    s.step = function (dt) {
      if (reduced) { s.value = s.target; s.velocity = 0; return s.value; }
      var k = -s.stiffness * (s.value - s.target), d = -s.damping * s.velocity;
      s.velocity += (k + d) * dt; s.value += s.velocity * dt;
      if (Math.abs(s.velocity) < 0.0005 && Math.abs(s.value - s.target) < 0.0005) { s.value = s.target; s.velocity = 0; }
      return s.value;
    };
    s.settled = function () { return s.value === s.target; };
    return s;
  };

  /* ---------- odometer-ish number: LAB.count(el, to, {fmt, ms, from}) ---------- */
  var counters = new WeakMap();
  LAB.count = function (el, to, o) {
    o = o || {}; var fmt = o.fmt || function (n) { return Math.round(n).toLocaleString(); };
    var from = counters.has(el) ? counters.get(el) : (o.from != null ? o.from : to);
    counters.set(el, to);
    LAB.tween(o.ms || 700, function (t) { el.textContent = fmt(LAB.lerp(from, to, t)); }, LAB.ease.outExpo);
  };
  LAB.money = function (n) { return n >= 1000 ? "$" + Math.round(n).toLocaleString() : n >= 10 ? "$" + n.toFixed(1) : "$" + n.toFixed(2); };

  /* ---------- haptics ---------- */
  LAB.haptic = function (kind) {
    if (!navigator.vibrate) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    var p = { tap: 8, tick: 4, ok: [10, 30, 18], bad: [30, 40, 30], pop: 14 }[kind || "tap"];
    try { navigator.vibrate(p); } catch (e) {}
  };

  /* ---------- subtle UI sound (off until the user turns it on) ---------- */
  var ac = null, soundOn = false;
  try { soundOn = localStorage.getItem("lab-sound") === "1"; } catch (e) {}
  function ctx() { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === "suspended") ac.resume(); return ac; }
  function blip(f, dur, type, gain, when) {
    var c = ctx(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime + (when || 0);
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain || 0.08, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  LAB.sound = {
    enabled: function () { return soundOn; },
    toggle: function () { soundOn = !soundOn; try { localStorage.setItem("lab-sound", soundOn ? "1" : "0"); } catch (e) {} if (soundOn) LAB.sound.play("tick"); return soundOn; },
    play: function (name) {
      if (!soundOn) return;
      try {
        if (name === "tick") blip(1400, 0.05, "sine", 0.05);
        else if (name === "tap") blip(620, 0.07, "triangle", 0.06);
        else if (name === "ok") { blip(660, 0.12, "sine", 0.07); blip(990, 0.16, "sine", 0.06, 0.08); }
        else if (name === "bad") { blip(220, 0.18, "sawtooth", 0.05); blip(180, 0.2, "sawtooth", 0.04, 0.1); }
        else if (name === "whoosh") blip(300, 0.25, "triangle", 0.03);
        else if (name === "pop") blip(880, 0.06, "square", 0.03);
      } catch (e) {}
    }
  };

  /* ---------- top bar ---------- */
  LAB.topbar = function (title, sub, backHref) {
    var el = document.createElement("header"); el.className = "lab-top";
    el.innerHTML = '<a class="back" href="' + (backHref || "../") + '" aria-label="Back to lab">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></a>' +
      '<div class="t"><b></b><span></span></div>' +
      '<button class="snd" aria-pressed="' + soundOn + '" aria-label="UI sound">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg></button>';
    el.querySelector("b").textContent = title; el.querySelector("span").textContent = sub || "";
    var b = el.querySelector(".snd");
    b.onclick = function () { b.setAttribute("aria-pressed", String(LAB.sound.toggle())); LAB.haptic("tap"); };
    document.body.prepend(el);
    return el;
  };

  /* ---------- bottom sheet ---------- */
  var sheetEl = null, sheetBg = null;
  LAB.sheet = function (html) {
    if (!sheetEl) {
      sheetBg = document.createElement("div"); sheetBg.className = "sheet-bg";
      sheetEl = document.createElement("div"); sheetEl.className = "sheet";
      document.body.append(sheetBg, sheetEl);
      sheetBg.onclick = LAB.closeSheet;
      var sy = 0;
      sheetEl.addEventListener("touchstart", function (e) { sy = e.touches[0].clientY; }, { passive: true });
      sheetEl.addEventListener("touchend", function (e) { if (e.changedTouches[0].clientY - sy > 70 && sheetEl.scrollTop <= 0) LAB.closeSheet(); });
    }
    sheetEl.innerHTML = '<div class="grab"></div>' + html;
    sheetEl.scrollTop = 0;
    requestAnimationFrame(function () { sheetEl.classList.add("show"); sheetBg.classList.add("show"); });
    LAB.haptic("tap"); LAB.sound.play("tap");
    return sheetEl;
  };
  LAB.closeSheet = function () { if (sheetEl) { sheetEl.classList.remove("show"); sheetBg.classList.remove("show"); } };

  /* ---------- SVG path sampler for particles ---------- */
  LAB.pathSampler = function (pathEl) {
    var len = pathEl.getTotalLength();
    return { length: len, at: function (t) { return pathEl.getPointAtLength(LAB.clamp(t, 0, 1) * len); } };
  };

  /* ---------- HiDPI canvas ---------- */
  LAB.canvas = function (cv) {
    var g = cv.getContext("2d");
    function fit() {
      var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: r.width, h: r.height };
    }
    var size = fit();
    var ro = new ResizeObserver(function () { size = fit(); });
    ro.observe(cv);
    return { g: g, size: function () { return size; } };
  };

  LAB.h = function (html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  LAB.esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  window.LAB = LAB;
})();
