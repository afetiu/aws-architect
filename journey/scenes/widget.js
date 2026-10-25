/* ============================================================
   scene: widget — the 16 simulators (content/widgets.js + widgets2.js)
   Mounts w.render(frame) inside a kit .panel and restyles every class the
   widgets use (w-row, w-chip, w-toggle, w-bars, w-trace, w-verdict, w-result,
   w-svg-chart, sim-stage, subnet-block, part-*, lane/msg-dot, q-node, plain
   buttons/selects) so they look native to the journey. Hard-coded light
   colours in widget SVG are overridden with attribute selectors; chart text is
   re-sized to stay readable at phone width (see fixCharts).
   ============================================================ */
(function () {
  "use strict";
  var LAB = window.LAB, J = window.JOURNEY, esc = LAB.esc;

  var CSS = [
    /* palette the widgets reference (inline styles use var(--yellow-soft) etc.) */
    ".wgx { --blue: #5ad1ff; --blue-soft: rgba(90,209,255,0.10); --green: #4ade80; --green-soft: rgba(74,222,128,0.10);",
    "  --yellow: #f5c054; --yellow-soft: rgba(245,192,84,0.12); --red: #ff6b6b; --red-soft: rgba(255,107,107,0.10);",
    "  --purple: #b69cff; --purple-soft: rgba(182,156,255,0.12); --accent-soft: rgba(255,138,61,0.14); --accent-ink: var(--accent-2);",
    "  --text: var(--ink); --text-dim: var(--ink-dim); --bg2: rgba(255,255,255,0.03); --bg3: rgba(255,255,255,0.07); --border: var(--line-strong); --border-soft: var(--line); --card: var(--panel-solid); }",
    ".wgx { padding: 16px; font-size: 14.5px; line-height: 1.5; color: var(--ink-2); overflow: hidden; }",
    ".wgx strong { color: var(--ink); font-weight: 600; }",
    ".wgx .muted { color: var(--ink-dim); font-size: 12.5px; }",
    "@keyframes wgx-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }",
    /* rows, sliders, values */
    ".wgx .w-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin: 0 0 12px; }",
    ".wgx .w-row > label { flex: 1 1 100%; font-size: 13px; color: var(--ink-2); line-height: 1.35; }",
    ".wgx .w-row > input[type=range] { flex: 1 1 0; min-width: 0; touch-action: pan-y; }",
    ".wgx .w-row .w-val { font-family: var(--mono); font-size: 14px; font-weight: 600; color: var(--ink); min-width: 74px; text-align: right; font-variant-numeric: tabular-nums; }",
    "@media (min-width: 640px) { .wgx .w-row > label { flex: 0 0 200px; } }",
    /* plain controls */
    ".wgx button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; padding: 0 16px; border-radius: 13px; font-weight: 600; font-size: 13.5px;",
    "  background: var(--panel-solid); border: 1px solid var(--line-strong); color: var(--ink); transition: transform .3s var(--spring), background .2s, border-color .2s; }",
    ".wgx button:active { transform: scale(0.96); }",
    ".wgx button.primary { background: linear-gradient(180deg, #ff9a55, var(--accent)); border-color: transparent; color: #1a0d04; box-shadow: 0 8px 24px -10px var(--accent-glow); }",
    ".wgx button.rm { min-width: 44px; padding: 0; color: var(--ink-dim); }",
    ".wgx .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }",
    ".wgx select { -webkit-appearance: none; appearance: none; min-height: 44px; min-width: 0; flex: 1 1 0; padding: 0 26px 0 10px; border-radius: 12px; font: 500 13px var(--body); text-overflow: ellipsis; color: var(--ink);",
    "  background: rgba(255,255,255,0.04) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237d8694' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\") no-repeat right 10px center;",
    "  border: 1px solid var(--line-strong); }",
    ".wgx select:focus { outline: none; border-color: var(--accent-glow); }",
    ".wgx select option { background: var(--panel-solid); color: var(--ink); }",
    /* chips + toggles */
    ".wgx .w-chip-row { display: flex; flex-wrap: wrap; gap: 8px; flex: 1 1 100%; }",
    ".wgx .w-chip, .wgx .w-toggle { min-height: 40px; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px;",
    "  background: rgba(255,255,255,0.04); border: 1px solid var(--line); color: var(--ink-2); cursor: pointer; -webkit-user-select: none; user-select: none; line-height: 1.25;",
    "  transition: transform .3s var(--spring), background .2s, color .2s, border-color .2s; }",
    ".wgx .w-chip:active, .wgx .w-toggle:active { transform: scale(0.95); }",
    ".wgx .w-chip.sel { background: rgba(255,138,61,0.14); border-color: var(--accent-glow); color: var(--accent-2); }",
    ".wgx .w-toggle { padding: 8px 14px 8px 10px; text-align: left; }",
    ".wgx .w-toggle::before { content: ''; flex: none; width: 26px; height: 16px; border-radius: 8px; background: rgba(255,255,255,0.12) radial-gradient(circle at 8px 8px, #cfd5df 5px, transparent 5.5px); transition: background .25s; }",
    ".wgx .w-toggle.on { background: rgba(74,222,128,0.09); border-color: rgba(74,222,128,0.4); color: var(--ink); }",
    ".wgx .w-toggle.on::before { background: var(--ok) radial-gradient(circle at 18px 8px, #06210f 5px, transparent 5.5px); }",
    /* result + verdicts + trace */
    ".wgx .w-result { margin-top: 12px; padding: 14px 16px; border-radius: 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--line); font-size: 14px; color: var(--ink-2); animation: wgx-in .35s var(--ease-out) both; }",
    ".wgx .w-result .big { font-family: var(--mono); font-size: 24px; font-weight: 600; color: var(--ink); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }",
    ".wgx .w-verdict { margin-top: 10px; padding: 12px 14px 12px 16px; border-radius: 14px; font-size: 14px; line-height: 1.55; color: var(--ink-2); border: 1px solid var(--line); border-left-width: 3px; background: rgba(255,255,255,0.03); animation: wgx-in .35s var(--ease-out) both; }",
    ".wgx .w-verdict.ok { border-color: rgba(74,222,128,0.3); border-left-color: var(--ok); background: rgba(74,222,128,0.06); }",
    ".wgx .w-verdict.no { border-color: rgba(255,107,107,0.3); border-left-color: var(--bad); background: rgba(255,107,107,0.06); }",
    ".wgx .w-verdict.info { border-color: rgba(90,209,255,0.25); border-left-color: var(--flow); background: rgba(90,209,255,0.05); }",
    ".wgx .w-trace { margin-top: 12px; display: grid; gap: 6px; }",
    ".wgx .t-step { display: flex; gap: 10px; padding: 10px 12px; border-radius: 12px; font-size: 13.5px; line-height: 1.5; background: rgba(255,255,255,0.03); border: 1px solid var(--line); color: var(--ink-2); animation: wgx-in .3s var(--ease-out) both; }",
    ".wgx .t-step:nth-child(2) { animation-delay: .05s; } .wgx .t-step:nth-child(3) { animation-delay: .1s; } .wgx .t-step:nth-child(4) { animation-delay: .15s; } .wgx .t-step:nth-child(5) { animation-delay: .2s; } .wgx .t-step:nth-child(6) { animation-delay: .25s; }",
    ".wgx .t-step .t-ico { flex: none; width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; font-family: var(--mono); font-size: 11px; font-weight: 700; color: var(--ink-dim); border: 1px solid var(--line-strong); margin-top: 1px; }",
    ".wgx .t-step.ok { border-color: rgba(74,222,128,0.25); }",
    ".wgx .t-step.ok .t-ico { background: var(--ok); border-color: var(--ok); color: #06210f; }",
    ".wgx .t-step.no { border-color: rgba(255,107,107,0.35); background: rgba(255,107,107,0.06); }",
    ".wgx .t-step.no .t-ico { background: var(--bad); border-color: var(--bad); color: #2a0606; }",
    /* bars: label + number on one line, the track full width under it */
    ".wgx .w-bars { margin-top: 12px; display: grid; gap: 10px; }",
    ".wgx .w-bar-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'l n' 't t'; column-gap: 10px; row-gap: 5px; align-items: baseline; }",
    ".wgx .w-bar-label { grid-area: l; font-size: 13px; color: var(--ink-2); min-width: 0; }",
    ".wgx .w-bar-num { grid-area: n; font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--ink); text-align: right; font-variant-numeric: tabular-nums; max-width: 62vw; }",
    ".wgx .w-bar-row { position: relative; }",
    ".wgx .w-bar-row:has(.w-bar-num .muted) { padding-bottom: 17px; }",
    ".wgx .w-bar-num .muted { position: absolute; left: 0; right: 0; bottom: 0; text-align: left; font-weight: 400; font-size: 11px; font-family: var(--mono); color: var(--ink-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
    ".wgx .envs:empty::before { content: 'Press Run: each square will be one execution environment.'; font-family: var(--mono); font-size: 11.5px; color: var(--ink-dim); align-self: center; }",
    ".wgx .w-bar-track { grid-area: t; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.07); overflow: hidden; }",
    ".wgx .w-bar-fill { display: block; height: 100%; border-radius: 4px; background: linear-gradient(90deg, rgba(90,209,255,0.55), var(--flow)); transform-origin: left; animation: wgx-grow .6s var(--ease-out) both; }",
    "@keyframes wgx-grow { from { transform: scaleX(0.4); opacity: .4; } to { transform: none; opacity: 1; } }",
    ".wgx .w-bar-row.best .w-bar-label { color: var(--ink); }",
    ".wgx .w-bar-row.best .w-bar-num { color: var(--ok); }",
    ".wgx .w-bar-row.best .w-bar-fill { background: linear-gradient(90deg, rgba(74,222,128,0.55), var(--ok)); box-shadow: 0 0 12px rgba(74,222,128,0.45); }",
    ".wgx .w-bar-row.worst .w-bar-num { color: var(--bad); }",
    ".wgx .w-bar-row.worst .w-bar-fill { background: linear-gradient(90deg, rgba(255,107,107,0.55), var(--bad)); }",
    /* svg charts (hard-coded light colours in the widget source) */
    ".wgx .w-svg-chart { display: block; width: 100%; height: auto; margin-top: 12px; overflow: visible; border-radius: 12px; background: rgba(255,255,255,0.02); }",
    ".wgx .w-svg-chart [stroke='#ddd0b8'] { stroke: rgba(255,255,255,0.14); }",
    ".wgx .w-svg-chart [fill='#8a7f6a'] { fill: var(--ink-dim); font-family: var(--mono); }",
    ".wgx .w-svg-chart [fill='#b04a42'] { fill: var(--bad); opacity: .16; }",
    ".wgx .w-svg-chart [stroke='#2c6c9e'] { stroke: var(--flow); }",
    ".wgx .w-svg-chart [stroke='#c4690a'] { stroke: var(--accent); }",
    ".wgx .w-svg-chart polyline, .wgx .w-svg-chart line { vector-effect: non-scaling-stroke; stroke-width: 2px; stroke-linejoin: round; }",
    ".wgx .w-svg-chart line { stroke-width: 1px; }",
    /* animated stages */
    ".wgx .sim-stage { margin-top: 12px; padding: 14px; border-radius: 14px; background: rgba(5,7,11,0.55); border: 1px solid var(--line); position: relative; overflow: hidden; }",
    ".wgx .subnet-block { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-height: 64px; min-width: 0; overflow: hidden; cursor: pointer;",
    "  border-radius: 9px; border: 1px solid rgba(90,209,255,0.45); background: rgba(90,209,255,0.08); font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--ink); text-align: center; line-height: 1.25;",
    "  transition: transform .3s var(--spring), background .2s; animation: wgx-pop .4s var(--spring) both; }",
    "@keyframes wgx-pop { from { opacity: 0; transform: scale(.85); } to { opacity: 1; transform: none; } }",
    ".wgx .subnet-block:active { transform: scale(.95); background: rgba(90,209,255,0.16); }",
    ".wgx .subnet-block .cnt { font-family: var(--body); font-weight: 400; font-size: 9.5px; line-height: 1.15; color: var(--ink-dim); overflow-wrap: anywhere; padding: 0 2px; }",
    ".wgx .carve { gap: 3px; }",
    ".wgx .subnet-block { padding: 4px 0; }",
    ".wgx .part-wrap { display: flex; gap: 6px; align-items: flex-end; height: 150px; }",
    ".wgx .part-bar { border-radius: 6px 6px 2px 2px; background: linear-gradient(180deg, var(--flow), rgba(90,209,255,0.35)); transition: height .2s var(--ease-out); }",
    ".wgx .part-bar.hot { background: linear-gradient(180deg, var(--bad), rgba(255,107,107,0.35)); box-shadow: 0 0 16px rgba(255,107,107,0.5); }",
    ".wgx .part-label { text-align: center; font-family: var(--mono); font-size: 10.5px; color: var(--ink-dim); margin-top: 6px; line-height: 1.3; }",
    ".wgx .lane { display: flex; align-items: center; gap: 10px; margin: 6px 0; min-height: 26px; }",
    ".wgx .lane .lane-label { flex: none; width: 76px; font-family: var(--mono); font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-dim); text-align: right; }",
    ".wgx .lane .l { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; min-height: 18px; padding: 4px 6px; border-radius: 9px; background: rgba(255,255,255,0.03); }",
    ".wgx .msg-dot { display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: var(--flow); box-shadow: 0 0 8px rgba(90,209,255,0.5); animation: wgx-pop .3s var(--spring) both; }",
    ".wgx .msg-dot.inflight { background: var(--warn); box-shadow: 0 0 10px rgba(245,192,84,0.6); transform: scale(1.12); }",
    ".wgx .msg-dot.done { background: var(--ok); box-shadow: 0 0 8px rgba(74,222,128,0.45); }",
    ".wgx .msg-dot.poison { background: var(--bad); box-shadow: 0 0 10px rgba(255,107,107,0.7); }",
    ".wgx .msg-dot.dlq { background: #5b1f24; border: 1px solid var(--bad); box-shadow: none; }",
    ".wgx .envs > span { border-radius: 6px !important; transition: background .2s, border-color .2s; }",
    ".wgx #stats { font-family: var(--mono); font-size: 11.5px !important; line-height: 1.5; color: var(--ink-dim); }",
    ".wgx .azs { gap: 18px !important; flex-wrap: wrap; }",
    ".wgx .azs .muted { font-family: var(--mono); letter-spacing: .08em; text-transform: uppercase; }",
    ".wgx .q-node { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 13px; cursor: pointer;",
    "  border: 1.5px solid rgba(74,222,128,0.6); background: rgba(74,222,128,0.1); color: var(--ink); font-family: var(--mono); font-size: 12px; font-weight: 600;",
    "  box-shadow: 0 0 14px -4px rgba(74,222,128,0.55); transition: transform .3s var(--spring), background .2s, border-color .2s, opacity .2s; }",
    ".wgx .q-node:active { transform: scale(.92); }",
    ".wgx .q-node.dead { border-color: rgba(255,107,107,0.6); background: rgba(255,107,107,0.08); color: var(--bad); opacity: .6; text-decoration: line-through; box-shadow: none; }",
    ".wgx-fail { padding: 18px; color: var(--ink-dim); font-size: 14px; }",
    "@media (max-width: 420px) { .wgx { padding: 14px 12px; } }"
  ].join("\n");
  function injectCss() {
    if (document.getElementById("wgx-css")) return;
    var s = document.createElement("style"); s.id = "wgx-css"; s.textContent = CSS; document.head.appendChild(s);
  }

  /* Widget SVG charts are drawn with an 11px font in a 640-unit viewBox: at phone width that is ~5px.
     Re-size the text to ~10.5 on-screen px and grow the viewBox so the bigger labels still fit. */
  function fixCharts(root) {
    root.querySelectorAll("svg.w-svg-chart:not([data-fx])").forEach(function (svg) {
      var vb = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
      if (vb.length !== 4 || !svg.clientWidth) return;
      svg.setAttribute("data-fx", "1");
      var k = svg.clientWidth / vb[2], fs = Math.max(11, 10.5 / k);
      if (fs <= 11.5) return;
      var grow = fs - 9;
      svg.querySelectorAll("text").forEach(function (t) {
        var y = +t.getAttribute("y");
        t.setAttribute("font-size", fs.toFixed(1));
        if (y < vb[3] / 2) t.setAttribute("y", (y - grow).toFixed(1));    // top label rises above the plot
        else t.setAttribute("y", (y + grow).toFixed(1));                  // axis note drops below it
      });
      svg.setAttribute("viewBox", vb[0] + " " + (vb[1] - grow) + " " + vb[2] + " " + (vb[3] + grow * 2));
    });
  }

  /* ---------- fallbacks for widgets whose content render throws ----------
     gp3-tuner (content/widgets.js) reads its IOPS/TPUT arrays in the slider label callbacks
     before they are assigned (var hoisting → undefined[3]). Same maths, same markup, arrays first. */
  function fh(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function fslider(root, label, min, max, step, value, fmt) {
    var row = fh('<div class="w-row"><label>' + esc(label) + '</label><input type="range"><span class="w-val"></span></div>');
    var inp = row.querySelector("input"), val = row.querySelector(".w-val");
    inp.min = min; inp.max = max; inp.step = step; inp.value = value;
    var api = { get: function () { return +inp.value; }, onchange: null };
    function refresh() { val.textContent = fmt(+inp.value); }
    inp.addEventListener("input", function () { refresh(); if (api.onchange) api.onchange(); });
    refresh(); root.appendChild(row); return api;
  }
  function fmoney(n) { return n >= 100 ? "$" + Math.round(n).toLocaleString() : "$" + n.toFixed(2); }
  function fbars(root, rows, fmt) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1, box = fh('<div class="w-bars"></div>');
    rows.forEach(function (r) {
      box.appendChild(fh('<div class="w-bar-row ' + (r.cls || "") + '"><span class="w-bar-label">' + esc(r.label) + '</span><span class="w-bar-track"><span class="w-bar-fill" style="width:' + Math.max(2, 100 * r.value / max) + '%"></span></span>' +
        '<span class="w-bar-num">' + fmt(r.value) + (r.note ? ' <span class="muted">' + esc(r.note) + "</span>" : "") + "</span></div>"));
    });
    root.appendChild(box);
  }
  function fverdict(root, kind, html) { root.appendChild(fh('<div class="w-verdict ' + kind + '">' + html + "</div>")); }
  var FALLBACK = {
    "gp3-tuner": function (root) {
      var IOPS = [500, 1000, 3000, 4000, 6000, 8000, 12000, 16000, 20000, 32000, 48000, 64000, 128000, 256000];
      var TPUT = [125, 250, 400, 500, 700, 1000, 2000, 3000, 4000];
      function szScale(v) { return Math.round(Math.pow(10, 1 + v / 10) / 10) * 10; }
      function fmtN(n) { return n >= 1000 ? (n / 1000) + "k" : n; }
      var size = fslider(root, "Volume size", 0, 30, 1, 15, function (v) { return szScale(v) + " GB"; });
      var iops = fslider(root, "IOPS needed", 0, 13, 1, 3, function (i) { return fmtN(IOPS[i]); });
      var tput = fslider(root, "Throughput needed", 0, 8, 1, 1, function (i) { return TPUT[i] + " MB/s"; });
      var res = document.createElement("div"); root.appendChild(res);
      function calc() {
        var g = szScale(size.get()), io = IOPS[iops.get()], tp = TPUT[tput.get()];
        var gp3 = null, gp3note = "";
        if (io <= 16000 && tp <= 1000) gp3 = g * 0.08 + Math.max(0, io - 3000) * 0.005 + Math.max(0, tp - 125) * 0.04;
        else gp3note = "exceeds gp3 limits (16k IOPS / 1000 MB/s)";
        var gp2g = Math.max(g, Math.ceil(io / 3)), gp2 = gp2g * 0.10;
        var gp2note = gp2g > g ? "must oversize to " + gp2g + " GB for IOPS" : (g < 1000 && io <= 3000 ? "burst credits carry small vols" : "");
        var io2 = null, io2note = "";
        if (io <= 256000) { io2 = g * 0.125 + Math.min(io, 32000) * 0.065 + Math.max(0, Math.min(io, 64000) - 32000) * 0.046 + Math.max(0, io - 64000) * 0.032; io2note = io > 16000 ? "only option this high (Block Express)" : "99.999% durability"; }
        res.innerHTML = "";
        var rows = [];
        if (gp3 !== null) rows.push({ label: "gp3 (tuned)", value: gp3 });
        rows.push({ label: "gp2 (size-coupled)", value: gp2, note: gp2note });
        if (io2 !== null) rows.push({ label: "io2", value: io2, note: io2note });
        var best = rows.reduce(function (a, b) { return b.value < a.value ? b : a; });
        rows.forEach(function (r) { r.cls = r === best ? "best" : ""; });
        fbars(res, rows, function (v) { return fmoney(v) + "/mo"; });
        if (gp3note) fverdict(res, "info", "gp3 " + gp3note + " — this requirement is io2 Block Express (or striping multiple volumes) territory.");
        else if (best.label.indexOf("gp3") === 0) fverdict(res, "ok", "gp3 wins — and its baseline 3000 IOPS / 125 MB/s is independent of size, unlike gp2 where IOPS = 3× GB and people bought empty terabytes just for IOPS. That gp2→gp3 migration is a free ~20% saving and a favorite exam cost answer.");
        else fverdict(res, "info", "io2 earns its premium only for sustained high IOPS with durability requirements (databases). For everything else, tuned gp3 is the default.");
      }
      size.onchange = iops.onchange = tput.onchange = calc;
      calc();
    }
  };

  J.registerScene("widget", {
    label: function (sc) { return "Simulator · " + sc.data.title; },
    render: function (el, sc) {
      injectCss();
      var w = sc.data;
      el.innerHTML =
        '<div class="eyebrow rv"><span>Simulator</span><span class="dim">' + esc(sc.m.title) + "</span></div>" +
        '<h2 class="rv">' + esc(w.title) + "</h2>" +
        (w.sub ? '<p class="lead rv" style="font-size:clamp(15px,4vw,17px);margin-bottom:18px">' + esc(w.sub) + "</p>" : "") +
        '<div class="panel wgx rv"></div>';
      var frame = el.querySelector(".wgx");
      try {
        try { w.render(frame); }
        catch (e0) { if (!FALLBACK[w.id]) throw e0; console.warn("widget " + w.id + ": using the journey fallback", e0.message); frame.innerHTML = ""; FALLBACK[w.id](frame); }
      }
      catch (e) {
        console.error("widget " + w.id + " failed", e);
        frame.innerHTML = '<div class="wgx-fail">This simulator could not start here (' + esc(e.message) + "). The lesson around it still covers the idea.</div>";
      }
      var raf = 0;
      function schedule() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; fixCharts(frame); }); }
      var mo = new MutationObserver(schedule);
      mo.observe(frame, { childList: true, subtree: true });
      var ro = new ResizeObserver(function () { frame.querySelectorAll("svg.w-svg-chart[data-fx]").forEach(function (s) { s.removeAttribute("data-fx"); }); restoreCharts(frame); schedule(); });
      ro.observe(frame);
      schedule();
      return {
        enter: function () { schedule(); },
        destroy: function () { mo.disconnect(); ro.disconnect(); }
      };
    }
  });

  /* on resize the chart gets re-fixed from its original geometry: keep the original attrs */
  function restoreCharts(root) {
    root.querySelectorAll("svg.w-svg-chart[data-vb0]").forEach(function (svg) {
      svg.setAttribute("viewBox", svg.getAttribute("data-vb0"));
      svg.querySelectorAll("text[data-y0]").forEach(function (t) { t.setAttribute("y", t.getAttribute("data-y0")); t.setAttribute("font-size", t.getAttribute("data-fs0")); });
    });
  }
  var _fix = fixCharts;
  fixCharts = function (root) {
    root.querySelectorAll("svg.w-svg-chart:not([data-vb0])").forEach(function (svg) {
      svg.setAttribute("data-vb0", svg.getAttribute("viewBox"));
      svg.querySelectorAll("text").forEach(function (t) { t.setAttribute("data-y0", t.getAttribute("y")); t.setAttribute("data-fs0", t.getAttribute("font-size") || "11"); });
    });
    _fix(root);
  };
})();
