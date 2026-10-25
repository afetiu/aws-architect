/* ============================================================
   scene: diagram — "living diagrams"
   Renders COURSE.diagrams as a dark SVG in the kit palette. Packets (≤ 12 dots,
   one rAF loop via LAB.loop) trickle along every edge while idle; running a
   flow lights the step's nodes/edges and sends brighter packets only along the
   lit edges, in the step's direction. Flow chips + cross-fading caption +
   prev / play / next + a step scrubber sit under the diagram. Tap a node for
   its sheet. Animation only runs between enter() and leave().
   ============================================================ */
(function () {
  "use strict";
  var LAB = window.LAB, J = window.JOURNEY;
  var h = LAB.h, esc = LAB.esc, NS = "http://www.w3.org/2000/svg";
  var PAL = { orange: "#ff8a3d", blue: "#5ad1ff", green: "#4ade80", yellow: "#f5c054", red: "#ff6b6b", purple: "#b69cff", violet: "#b69cff", pink: "#ff7aa8" };
  var NEUTRAL = "#9aa3b2";
  var MIN_FONT = 10.5;   // smallest SVG font (sub, edge + zone labels), in viewBox units
  var READABLE = 8.6;     // smallest on-screen px we accept before switching to a pan frame
  var MAX_DOTS = 12;
  var STEP_MS = 4000;
  var uid = 0;

  var CSS = [
    ".scene-diagram .sc > h2, .scene-diagram .sc > .lead { max-width: 680px; }",
    ".scene-diagram .lead { font-size: clamp(15px, 4vw, 17px); margin-bottom: 18px; }",
    ".dgx-frame { position: relative; border-radius: 20px; border: 1px solid var(--line); background: radial-gradient(ellipse 90% 70% at 50% 0%, rgba(255,255,255,0.035), transparent 70%), rgba(13,17,24,0.88);",
    "  box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -34px rgba(0,0,0,0.9); overflow: hidden; }",
    ".dgx-scroll { overflow-x: auto; overflow-y: hidden; touch-action: pan-x pan-y; -webkit-overflow-scrolling: touch; scrollbar-width: none; overscroll-behavior-x: contain; }",
    ".dgx-scroll::-webkit-scrollbar { display: none; }",
    ".dgx-inner { padding: 10px; }",
    ".dgx-frame.pan .dgx-scroll { -webkit-mask-image: linear-gradient(to right, transparent 0, #000 var(--fl, 0px), #000 calc(100% - var(--fr, 0px)), transparent 100%); mask-image: linear-gradient(to right, transparent 0, #000 var(--fl, 0px), #000 calc(100% - var(--fr, 0px)), transparent 100%); }",
    ".dgx-hint { display: none; position: absolute; right: 10px; bottom: 8px; font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-dim); background: rgba(11,14,20,0.85); border: 1px solid var(--line); padding: 4px 8px; border-radius: 999px; pointer-events: none; transition: opacity .5s var(--ease-out); }",
    ".dgx-frame.pan .dgx-hint { display: block; }",
    ".dgx-frame.pan .dgx-inner { padding-bottom: 36px; }",
    ".dgx-frame.panned .dgx-hint { opacity: 0; }",
    ".dgx svg { display: block; width: 100%; height: auto; overflow: visible; -webkit-user-select: none; user-select: none; }",
    ".dgx text { font-family: var(--body); }",
    ".dgx .z-plate { transition: opacity .5s var(--ease-out); }",
    ".dgx .z-plate rect.zb { stroke: rgba(255,255,255,0.11); stroke-width: 1; stroke-dasharray: 4 5; }",
    ".dgx .z-plate text { font-family: var(--mono); font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; fill: var(--ink-dim); }",
    ".dgx .z-plate.lit rect.zb { stroke: var(--accent); stroke-dasharray: none; stroke-opacity: .7; }",
    ".dgx .z-plate.lit text { fill: var(--accent-2); }",
    ".dgx .e-path { fill: none; stroke: rgba(205,214,228,0.34); stroke-width: 1.4; transition: opacity .45s var(--ease-out), stroke .3s; }",
    ".dgx .e-path.dashed { stroke-dasharray: 5 5; }",
    ".dgx .e-lab { transition: opacity .45s var(--ease-out); }",
    ".dgx .e-lab rect { fill: rgba(11,14,20,0.92); stroke: var(--line); }",
    ".dgx .e-lab text { font-family: var(--mono); font-size: 10.5px; fill: var(--ink-2); }",
    ".dgx .n { cursor: pointer; transition: opacity .45s var(--ease-out); outline: none; }",
    ".dgx .n .lab { font-size: 12.5px; font-weight: 600; fill: var(--ink); }",
    ".dgx .n .sub { font-size: 10.5px; fill: var(--ink-dim); }",
    ".dgx .n .ring { fill: none; stroke: var(--accent); stroke-width: 1.6; opacity: 0; transition: opacity .4s var(--ease-out); filter: drop-shadow(0 0 6px rgba(255,138,61,0.75)); }",
    ".dgx .n.lit .ring { opacity: 1; animation: dgx-ring 1.8s var(--ease-in-out) infinite; }",
    ".dgx .n:focus-visible .ring { opacity: .8; stroke: var(--flow); }",
    "@keyframes dgx-ring { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }",
    ".dgx .n .tapdot { opacity: .85; }",
    ".dgx svg.running .n:not(.lit):not(.near) { opacity: .35; }",
    ".dgx svg.running .n.near { opacity: .75; }",
    ".dgx svg.running .z-plate:not(.lit) { opacity: .55; }",
    ".dgx svg.running .e-path:not(.lit) { opacity: .2; }",
    ".dgx svg.running .e-lab:not(.lit) { opacity: .3; }",
    ".dgx .e-path.lit { stroke: var(--flow); stroke-width: 2; opacity: 1; }",
    ".dgx .e-lab.lit rect { stroke: rgba(90,209,255,0.45); }",
    ".dgx .e-lab.lit text { fill: var(--ink); }",
    ".dgx .pk circle { fill: var(--flow); }",
    /* flow UI */
    ".dgx-ui { margin-top: 16px; display: grid; gap: 12px; }",
    ".dgx-ui .chips .chip { min-height: 40px; flex: none; }",
    "@media (max-width: 640px) { .dgx-flows { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin: 0 -20px; padding: 0 20px; touch-action: pan-x pan-y; } .dgx-flows::-webkit-scrollbar { display: none; } }",
    ".dgx-cap { padding: 14px 16px; min-height: 96px; }",
    ".dgx-meta { font-family: var(--mono); font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 6px; display: flex; gap: 8px; flex-wrap: wrap; }",
    ".dgx-meta b { color: var(--flow); font-weight: 600; }",
    ".dgx-txt { display: grid; }",
    ".dgx-txt > div { grid-area: 1 / 1; font-size: 15px; line-height: 1.6; color: var(--ink-2); transition: opacity .35s var(--ease-out), transform .45s var(--ease-out); }",
    ".dgx-txt > div strong { color: var(--ink); font-weight: 600; }",
    ".dgx-txt > div code { font-family: var(--mono); font-size: .9em; color: var(--accent-2); }",
    ".dgx-txt > div.in { opacity: 0; transform: translateY(6px); }",
    ".dgx-txt > div.out { opacity: 0; transform: translateY(-6px); }",
    ".dgx-ctl { display: flex; align-items: center; gap: 8px; }",
    ".dgx-ctl .btn { min-width: 44px; padding: 0 12px; }",
    ".dgx-ctl .btn svg { flex: none; }",
    ".dgx-ctl .dgx-play { min-width: 96px; }",
    ".dgx-ctl input[type=range] { flex: 1; min-width: 0; touch-action: pan-y; }",
    ".dgx-ctl .dgx-count { font-family: var(--mono); font-size: 12px; color: var(--ink-dim); min-width: 30px; text-align: right; font-variant-numeric: tabular-nums; }",
    ".sheet .dgx-sub { font-family: var(--mono); font-size: 12px; color: var(--ink-dim); margin: 0 0 6px; }",
    ".sheet .dgx-in { margin-top: 14px; }",
    ".sheet .dgx-in .k { display: block; margin-bottom: 2px; }",
    ".sheet .dgx-in .btn { justify-content: flex-start; text-align: left; font-weight: 500; font-size: 13.5px; }",
    "@media (prefers-reduced-motion: reduce) { .dgx .n.lit .ring { animation: none; } }"
  ].join("\n");
  function injectCss() {
    if (document.getElementById("dgx-css")) return;
    var s = document.createElement("style"); s.id = "dgx-css"; s.textContent = CSS; document.head.appendChild(s);
  }

  function S(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function edgeKey(e) { return e.from + "->" + e.to; }
  function colorOfNode(n) { return PAL[n.color] || NEUTRAL; }
  /* anchor on the side of a facing b, plus the outward normal (for smooth curves) */
  function anchor(a, b) {
    var ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2, dx = bx - ax, dy = by - ay;
    if (Math.abs(dx) * a.h > Math.abs(dy) * a.w) return { x: dx > 0 ? a.x + a.w : a.x, y: ay, nx: dx > 0 ? 1 : -1, ny: 0 };
    return { x: ax, y: dy > 0 ? a.y + a.h : a.y, nx: 0, ny: dy > 0 ? 1 : -1 };
  }
  function curve(p1, p2) {
    var dist = Math.hypot(p2.x - p1.x, p2.y - p1.y), k = LAB.clamp(dist * 0.38, 14, 80);
    var c1 = { x: p1.x + p1.nx * k, y: p1.y + p1.ny * k }, c2 = { x: p2.x + p2.nx * k, y: p2.y + p2.ny * k };
    return "M" + p1.x + " " + p1.y + " C" + c1.x.toFixed(1) + " " + c1.y.toFixed(1) + " " + c2.x.toFixed(1) + " " + c2.y.toFixed(1) + " " + p2.x + " " + p2.y;
  }
  function chev(dir) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="' + (dir < 0 ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6") + '"/></svg>';
  }
  var PLAY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>';
  var PAUSE_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';

  J.registerScene("diagram", {
    wide: true,
    label: function (sc) { return "Diagram · " + sc.data.title; },
    render: function (el, sc, ctx) {
      injectCss();
      var d = sc.data, flows = d.flows || [], id = "dgx" + (++uid);
      var dom = ctx.colorOf(sc.m.id);
      el.innerHTML =
        '<div class="eyebrow rv"><span>Diagram</span><span class="dim">' + esc(sc.m.title) + "</span></div>" +
        '<h2 class="rv">' + esc(d.title) + "</h2>" +
        (d.sub ? '<p class="lead rv">' + esc(d.sub) + "</p>" : "") +
        '<div class="dgx dgx-frame rv"><div class="dgx-scroll"><div class="dgx-inner"></div></div><div class="dgx-hint">Swipe to pan ⇆</div></div>' +
        '<div class="dgx-ui rv"></div>';
      var frame = el.querySelector(".dgx-frame"), scroller = el.querySelector(".dgx-scroll"), inner = el.querySelector(".dgx-inner"), ui = el.querySelector(".dgx-ui");

      /* ---------- SVG ---------- */
      var svg = S("svg", { viewBox: "0 0 " + d.w + " " + d.h, role: "img", "aria-label": d.title });
      svg.innerHTML = "<defs>" +
        '<marker id="' + id + '-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1.5 L9 5 L1 8.5 z" fill="rgba(205,214,228,0.6)"/></marker>' +
        '<marker id="' + id + '-al" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1.5 L9 5 L1 8.5 z" fill="#5ad1ff"/></marker>' +
        "</defs>";
      inner.appendChild(svg);
      var gZ = S("g", {}, svg), gE = S("g", {}, svg), gP = S("g", { class: "pk" }, svg), gN = S("g", {}, svg), gL = S("g", { "pointer-events": "none" }, svg);

      var byId = {}, nodeEls = {}, edges = [], edgeByKey = {};
      d.nodes.forEach(function (n) { byId[n.id] = n; });

      // zones: soft plates tinted with the chapter colour
      d.nodes.filter(function (n) { return n.zone; }).forEach(function (n) {
        var g = S("g", { class: "z-plate" }, gZ);
        S("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: 14, fill: dom, "fill-opacity": 0.045 }, g);
        S("rect", { class: "zb", x: n.x + 0.5, y: n.y + 0.5, width: n.w - 1, height: n.h - 1, rx: 14, fill: "none" }, g);
        var t = S("text", { x: n.x + 12, y: n.y + 18 }, g); t.textContent = n.label;
        nodeEls[n.id] = g;
        if (n.info) { t.style.cursor = "pointer"; t.addEventListener("click", function () { nodeSheet(n); }); }
      });

      // edges: smooth cubic paths with arrowheads, mono labels on a pill
      (d.edges || []).forEach(function (e) {
        var a = byId[e.from], b = byId[e.to];
        if (!a || !b) return;
        var p1 = anchor(a, b), p2 = anchor(b, a);
        var path = S("path", { class: "e-path" + (e.dashed ? " dashed" : ""), d: curve(p1, p2), "marker-end": "url(#" + id + "-a)" }, gE);
        var rec = { e: e, key: edgeKey(e), path: path, lab: null, pts: null };
        if (e.label) {
          var lg = S("g", { class: "e-lab" }, gL);
          var tw = e.label.length * 6.35 + 12;
          rec.labRect = S("rect", { width: tw.toFixed(1), height: 17, rx: 8.5 }, lg);
          rec.labText = S("text", { "text-anchor": "middle" }, lg); rec.labText.textContent = e.label;
          rec.lab = lg; rec.labW = tw;
          var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;   // fallback until measured
          placeLabel(rec, mx, my);
        }
        edges.push(rec); edgeByKey[rec.key] = rec;
      });
      function placeLabel(r, mx, my) {
        r.labRect.setAttribute("x", (mx - r.labW / 2).toFixed(1)); r.labRect.setAttribute("y", (my - 8.5).toFixed(1));
        r.labText.setAttribute("x", mx.toFixed(1)); r.labText.setAttribute("y", (my + 3.6).toFixed(1));
      }

      // nodes: rounded plates tinted by colour, label + sub, tap for the sheet
      d.nodes.filter(function (n) { return !n.zone; }).forEach(function (n) {
        var c = colorOfNode(n);
        var g = S("g", { class: "n", tabindex: "0", role: "button", "aria-label": n.label + (n.sub ? ", " + n.sub : "") }, gN);
        S("rect", { class: "ring", x: n.x - 4, y: n.y - 4, width: n.w + 8, height: n.h + 8, rx: 13 }, g);
        S("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: 10, fill: "#121722" }, g);
        S("rect", { x: n.x + 0.5, y: n.y + 0.5, width: n.w - 1, height: n.h - 1, rx: 9.5, fill: c, "fill-opacity": 0.12, stroke: c, "stroke-opacity": 0.5 }, g);
        S("rect", { x: n.x + 10, y: n.y + 0.5, width: Math.min(28, n.w - 20), height: 2, rx: 1, fill: c, "fill-opacity": 0.9 }, g);
        var cx = n.x + n.w / 2, cy = n.y + n.h / 2;
        var lab = S("text", { class: "lab", "text-anchor": "middle", x: cx, y: cy + (n.sub ? -2.5 : 4.5) }, g); lab.textContent = n.label;
        var sb = null;
        if (n.sub) { sb = S("text", { class: "sub", "text-anchor": "middle", x: cx, y: cy + 12 }, g); sb.textContent = n.sub; }
        if (n.info) S("circle", { class: "tapdot", cx: n.x + n.w - 8, cy: n.y + 8, r: 2.6, fill: c }, g);
        g.addEventListener("click", function () { nodeSheet(n); });
        g.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); nodeSheet(n); } });
        nodeEls[n.id] = g;
        g._lab = lab; g._sub = sb; g._n = n;
      });

      /* measure once laid out: shrink overflowing labels, place edge labels on the curve, sample paths */
      var measured = false;
      function measure() {
        if (measured || !svg.isConnected) return;
        var probe = 0;
        try { probe = edges.length ? edges[0].path.getTotalLength() : 1; } catch (e) { return; }
        if (!probe) return;
        measured = true;
        Object.keys(nodeEls).forEach(function (k) {
          var g = nodeEls[k]; if (!g._n) return;
          [[g._lab, 12.5], [g._sub, 10.5]].forEach(function (p) {
            var t = p[0]; if (!t) return;
            var w = 0; try { w = t.getComputedTextLength(); } catch (e) {}
            var room = g._n.w - 14;
            if (w > room) t.style.fontSize = Math.max(p[1] > 12 ? MIN_FONT : 9.5, p[1] * room / w).toFixed(2) + "px";
          });
        });
        // obstacles for edge labels: boxes, zone titles, and labels already placed
        var obst = [];
        d.nodes.forEach(function (n) {
          if (n.zone) obst.push({ x: n.x + 8, y: n.y + 4, w: n.label.length * 7.2 + 10, h: 20 });
          else obst.push({ x: n.x - 2, y: n.y - 2, w: n.w + 4, h: n.h + 4 });
        });
        function hits(b) {
          var a = 0;
          for (var i = 0; i < obst.length; i++) { var o = obst[i]; var ox = Math.min(b.x + b.w, o.x + o.w) - Math.max(b.x, o.x), oy = Math.min(b.y + b.h, o.y + o.h) - Math.max(b.y, o.y); if (ox > 0 && oy > 0) a += ox * oy; }
          if (b.x < 0 || b.x + b.w > d.w) a += 400;
          return a;
        }
        var TRY = [24, 20, 28, 16, 32, 13, 35, 10, 38];
        edges.forEach(function (r) {
          var len = r.path.getTotalLength(), pts = [];
          for (var i = 0; i <= 48; i++) { var q = r.path.getPointAtLength(len * i / 48); pts.push(q.x, q.y); }
          r.pts = pts;
          if (!r.lab) return;
          var best = null;
          [0, -14, 14].forEach(function (dy) {
            TRY.forEach(function (t) {
              if (best && best.score === 0) return;
              var x = pts[t * 2], y = pts[t * 2 + 1] + dy;
              var sc2 = hits({ x: x - r.labW / 2 - 2, y: y - 10.5, w: r.labW + 4, h: 21 }) + (dy ? 30 : 0);
              if (!best || sc2 < best.score) best = { x: x, y: y, score: sc2 };
            });
          });
          placeLabel(r, best.x, best.y);
          obst.push({ x: best.x - r.labW / 2 - 2, y: best.y - 10.5, w: r.labW + 4, h: 21 });
        });
      }

      /* ---------- responsive: fit width, or pan when text would drop under 9px ---------- */
      var minW = Math.ceil(d.w * READABLE / MIN_FONT);
      function fit() {
        var cw = scroller.clientWidth - 20; if (cw <= 0) return;
        var pan = cw < minW;
        frame.classList.toggle("pan", pan);
        inner.style.width = pan ? (minW + 20) + "px" : "";
        if (pan && !panInit) { panInit = true; initialPan(); }
        edgeFade();
      }
      var panInit = false, initX = 0;
      /* first view on a phone: frame the boxes (not the empty margins of the canvas) */
      function initialPan() {
        var x0 = Infinity, x1 = -Infinity;
        d.nodes.forEach(function (n) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x + n.w); });
        if (!isFinite(x0)) return;
        var k = minW / d.w, view = scroller.clientWidth;
        var a = 10 + x0 * k, b = 10 + x1 * k;
        var target = Math.min(a - 14, (a + b) / 2 - view / 2);
        scroller.scrollLeft = LAB.clamp(target, 0, Math.max(0, minW + 20 - view)); initX = scroller.scrollLeft;
      }
      function edgeFade() {
        var max = scroller.scrollWidth - scroller.clientWidth, x = scroller.scrollLeft;
        scroller.style.setProperty("--fl", x > 4 ? "26px" : "0px");
        scroller.style.setProperty("--fr", x < max - 4 ? "40px" : "0px");
        if (Math.abs(x - initX) > 12) frame.classList.add("panned");
      }
      scroller.addEventListener("scroll", edgeFade, { passive: true });
      var ro = new ResizeObserver(function () { fit(); measure(); });
      ro.observe(scroller);
      fit(); measure();

      /* ---------- packets: ≤ 12 dots, one loop ---------- */
      var dots = [];
      for (var i = 0; i < MAX_DOTS; i++) {
        var pg = S("g", { opacity: 0 }, gP);
        dots.push({ g: pg, halo: S("circle", { r: 7, opacity: 0.22 }, pg), core: S("circle", { r: 2.6 }, pg), mode: "off", edge: null, t: 0, wait: 0, dur: 2.6, rev: false, vis: -1 });
      }
      var idleCursor = 0;
      function hide(p) { if (p.vis !== 0) { p.g.setAttribute("opacity", 0); p.vis = 0; } }
      function idlePlan() {
        var n = Math.min(8, edges.length);
        dots.forEach(function (p, k) {
          p.mode = k < n ? "idle" : "off";
          p.edge = k < n ? edges[(idleCursor++) % edges.length] : null;
          p.t = 0; p.wait = k * 0.55 + Math.random() * 0.4; p.dur = 2.4 + Math.random() * 0.8; p.rev = false;
          p.core.setAttribute("r", 2.4); p.halo.setAttribute("r", 6); p.halo.setAttribute("opacity", 0.16);
          hide(p);
        });
      }
      function flowPlan(lit) {
        var per = lit.length ? Math.min(3, Math.floor(MAX_DOTS / lit.length)) : 0, k = 0;
        dots.forEach(function (p) { p.mode = "off"; p.edge = null; hide(p); });
        lit.forEach(function (L) {
          for (var j = 0; j < per; j++, k++) {
            var p = dots[k]; p.mode = "flow"; p.edge = L.r; p.rev = L.rev; p.dur = 1.5; p.t = -j / per; p.wait = 0;
            p.core.setAttribute("r", 3.4); p.halo.setAttribute("r", 9); p.halo.setAttribute("opacity", 0.3);
          }
        });
      }
      var liveNow = false;
      function tick(dt) {
        if (!liveNow) return;
        dots.forEach(function (p) {
          if (p.mode === "off" || !p.edge || !p.edge.pts) return hide(p);
          if (p.wait > 0) { p.wait -= dt; return hide(p); }
          p.t += dt / p.dur;
          if (p.t >= 1) {
            if (p.mode === "idle") { p.t = 0; p.wait = 0.6 + Math.random() * 2.2; p.edge = edges[(idleCursor++) % edges.length]; return hide(p); }
            p.t -= 1;
          }
          if (p.t < 0) return hide(p);
          var u = p.rev ? 1 - p.t : p.t, pts = p.edge.pts, f = u * 48, i0 = Math.min(47, Math.floor(f)), fr = f - i0;
          var x = pts[i0 * 2] + (pts[i0 * 2 + 2] - pts[i0 * 2]) * fr, y = pts[i0 * 2 + 1] + (pts[i0 * 2 + 3] - pts[i0 * 2 + 1]) * fr;
          var a = Math.min(1, Math.sin(Math.PI * p.t) * 2.2) * (p.mode === "idle" ? 0.6 : 1);
          p.g.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")");
          p.g.setAttribute("opacity", a.toFixed(2)); p.vis = a;
        });
      }

      /* ---------- flows ---------- */
      var fi = 0, si = -1, playing = false, playT = 0, loop = null;
      ui.innerHTML =
        (flows.length ? '<div class="chips dgx-flows" role="tablist" aria-label="Flows"></div>' : "") +
        '<div class="panel dgx-cap" aria-live="polite"><div class="dgx-meta"></div><div class="dgx-txt"></div></div>' +
        (flows.length ? '<div class="dgx-ctl"><button class="btn dgx-prev" aria-label="Previous step">' + chev(-1) + "</button>" +
          '<button class="btn primary dgx-play"></button>' +
          '<button class="btn dgx-next" aria-label="Next step">' + chev(1) + "</button>" +
          '<input type="range" class="dgx-scrub" min="0" step="1" aria-label="Step"><span class="dgx-count"></span></div>' : "");
      var chipsEl = ui.querySelector(".dgx-flows"), meta = ui.querySelector(".dgx-meta"), txt = ui.querySelector(".dgx-txt");
      var prevB = ui.querySelector(".dgx-prev"), nextB = ui.querySelector(".dgx-next"), playB = ui.querySelector(".dgx-play"), scrub = ui.querySelector(".dgx-scrub"), count = ui.querySelector(".dgx-count");
      flows.forEach(function (f, k) {
        var c = h('<button class="chip" role="tab"></button>'); c.textContent = f.title;
        c.onclick = function () { stopPlay(); if (fi === k && si >= 0) setStep(-1); else { fi = k; setStep(0); } };
        chipsEl.appendChild(c);
      });
      var lastTxt = null;
      function caption(metaHtml, html) {
        meta.innerHTML = metaHtml;
        if (lastTxt === html) return; lastTxt = html;
        var old = txt.lastElementChild;
        var n = document.createElement("div"); n.className = "in"; n.innerHTML = html; txt.appendChild(n);
        requestAnimationFrame(function () { requestAnimationFrame(function () { n.classList.remove("in"); }); });
        if (old) { old.classList.add("out"); setTimeout(function () { if (old.parentNode) old.remove(); }, 400); }
      }
      function applyLit(lit) {
        Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove("lit", "near"); });
        edges.forEach(function (r) { r.path.classList.remove("lit"); r.path.setAttribute("marker-end", "url(#" + id + "-a)"); if (r.lab) r.lab.classList.remove("lit"); });
        svg.classList.toggle("running", !!lit);
        if (!lit) return [];
        var litEdges = [];
        lit.forEach(function (k) {
          if (nodeEls[k]) { nodeEls[k].classList.add("lit"); return; }
          var r = edgeByKey[k], rev = false;
          if (!r) { var ab = k.split("->"); r = edgeByKey[ab[1] + "->" + ab[0]]; rev = !!r; }
          if (!r) return;
          r.path.classList.add("lit"); r.path.setAttribute("marker-end", "url(#" + id + "-al)");
          if (r.lab) r.lab.classList.add("lit");
          litEdges.push({ r: r, rev: rev });
        });
        litEdges.forEach(function (L) { [L.r.e.from, L.r.e.to].forEach(function (nid) { var g = nodeEls[nid]; if (g && !g.classList.contains("lit")) g.classList.add("near"); }); });
        autoPan(lit, litEdges);
        return litEdges;
      }
      /* in pan mode, bring the lit part of the diagram into view */
      function autoPan(lit, litEdges) {
        if (!frame.classList.contains("pan")) return;
        var ids = lit.filter(function (k) { return byId[k] && !byId[k].zone; });
        litEdges.forEach(function (L) { ids.push(L.r.e.from, L.r.e.to); });
        if (!ids.length) ids = lit.filter(function (k) { return byId[k]; });
        if (!ids.length) return;
        var x0 = Infinity, x1 = -Infinity;
        ids.forEach(function (k) { var n = byId[k]; if (!n) return; x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x + n.w); });
        var k2 = svg.getBoundingClientRect().width / d.w, view = scroller.clientWidth;
        var a = 10 + x0 * k2, b = 10 + x1 * k2, cur = scroller.scrollLeft;
        if (a >= cur + 8 && b <= cur + view - 8) return;
        var target = b - a > view - 24 ? a - 12 : (a + b) / 2 - view / 2;
        scroller.scrollTo({ left: LAB.clamp(target, 0, scroller.scrollWidth - view), behavior: LAB.reducedMotion ? "auto" : "smooth" });
      }
      function setStep(k, quiet) {
        var f = flows[fi];
        si = f ? LAB.clamp(k, -1, f.steps.length - 1) : -1;
        if (chipsEl) [].forEach.call(chipsEl.children, function (c, j) { var on = si >= 0 && j === fi; c.classList.toggle("on", on); c.setAttribute("aria-selected", String(on)); });
        if (si < 0) {
          applyLit(null); idlePlan();
          caption("<span>Overview</span>" + (flows.length ? "<span>· " + flows.length + " flows</span>" : ""),
            "Tap any part to see what it does." + (flows.length ? " Pick a flow, or press <strong>Play</strong>, to watch the packets take the path step by step." : ""));
        } else {
          var st = f.steps[si];
          flowPlan(applyLit(st.lit || []));
          caption("<b>Step " + (si + 1) + " / " + f.steps.length + "</b><span>" + esc(f.title) + "</span>", st.text);
          if (!quiet) { LAB.haptic("tick"); LAB.sound.play("tick"); }
        }
        if (scrub) {
          scrub.max = f ? f.steps.length : 0; scrub.value = si + 1;
          count.textContent = (si + 1) + "/" + (f ? f.steps.length : 0);
          prevB.disabled = si < 0;
          nextB.disabled = !!f && si >= f.steps.length - 1;
        }
      }
      function paintPlay() { if (!playB) return; playB.innerHTML = playing ? PAUSE_ICON + "Pause" : PLAY_ICON + "Play"; playB.setAttribute("aria-pressed", String(playing)); }
      function stopPlay() { if (!playing) return; playing = false; clearInterval(playT); paintPlay(); }
      function startPlay() {
        if (!flows.length) return;
        var f = flows[fi];
        if (si < 0 || si >= f.steps.length - 1) setStep(0); else setStep(si + 1);
        playing = true; paintPlay();
        clearInterval(playT);
        playT = setInterval(function () {
          if (si >= flows[fi].steps.length - 1) { stopPlay(); return; }
          setStep(si + 1);
          if (si >= flows[fi].steps.length - 1) stopPlay();
        }, STEP_MS);
      }
      if (playB) {
        playB.onclick = function () { if (playing) stopPlay(); else startPlay(); };
        prevB.onclick = function () { stopPlay(); setStep(si - 1); };
        nextB.onclick = function () { stopPlay(); setStep(si + 1); };
        scrub.addEventListener("input", function () { stopPlay(); var v = +scrub.value - 1; if (v !== si) setStep(v); });
        paintPlay();
      }

      /* ---------- node sheet ---------- */
      function nodeSheet(n) {
        stopPlay();
        var uses = [];
        flows.forEach(function (f, a) { f.steps.forEach(function (s, b) { if ((s.lit || []).indexOf(n.id) >= 0) uses.push({ f: a, s: b, t: f.title }); }); });
        var html = '<div class="eyebrow">' + esc(d.title) + "</div><h3>" + esc(n.label) + "</h3>" +
          (n.sub ? '<p class="dgx-sub">' + esc(n.sub) + "</p>" : "") +
          "<p>" + (n.info || "Part of the " + esc(d.title) + " picture. Run a flow to see where it sits on the path.") + "</p>" +
          (uses.length ? '<div class="dgx-in"><span class="k">See it in a flow</span>' + uses.slice(0, 4).map(function (u, i) {
            return '<button class="btn" data-i="' + i + '">' + esc(u.t) + " · step " + (u.s + 1) + "</button>";
          }).join("") + "</div>" : "");
        var sh = LAB.sheet(html);
        sh.querySelectorAll(".dgx-in .btn").forEach(function (b) {
          b.onclick = function () { var u = uses[+b.dataset.i]; LAB.closeSheet(); fi = u.f; setStep(u.s); };
        });
      }

      setStep(-1, true);

      return {
        enter: function () {
          liveNow = true; fit(); measure();
          if (!LAB.reducedMotion && !loop) loop = LAB.loop(tick);
        },
        leave: function () {
          liveNow = false; stopPlay();
          if (loop) { loop.stop(); loop = null; }
          dots.forEach(hide);
        },
        destroy: function () { liveNow = false; stopPlay(); if (loop) loop.stop(); loop = null; ro.disconnect(); }
      };
    }
  });
})();
