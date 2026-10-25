/* scene: trial — the practice exams as boss stations ("The Trial").
 * Cast after the closer of the last chapter of each track. The exam runs inside
 * the scene as a focused mode: one question at a time, timer, flag for review,
 * question map (bottom sheet), multi-select, submit with confirm. While focused
 * the reel is locked and the HUD hidden (body.in-trial). Run state lives in memory
 * at module scope, so an accidental scroll / chapter rebuild resumes it.
 * Results are saved exactly like app.js: S.examAttempts.push({examId, date, pct,
 * domains: {name: {correct, total}}, durationSec}). */
(function () {
  "use strict";
  var LAB = window.LAB, ST = window.JSTORE, h = LAB.h, esc = LAB.esc;
  var META = window.COURSE_META || {};
  var PASS = META.passMark || 72;
  var RUNS = {};   // examId -> live run (survives scene re-render)

  if (!document.getElementById("scene-trial-css")) {
    var st = document.createElement("style"); st.id = "scene-trial-css";
    st.textContent = [
      "body.in-trial #hud{display:none}",
      "body.in-trial #reel{overflow:hidden;scroll-snap-type:none}",
      "body.in-trial #prog{opacity:0}",
      /* intro */
      ".scene-trial .tr-sigil{width:132px;height:132px;margin-bottom:14px;display:block}",
      ".scene-trial .tr-sigil line{stroke:rgba(255,255,255,0.14);stroke-width:2;stroke-linecap:round}",
      ".scene-trial .tr-sigil line.on{stroke:var(--accent)}",
      ".scene-trial .tr-sigil text{font-family:var(--mono);font-size:10px;fill:var(--ink-dim);letter-spacing:.08em}",
      ".scene-trial .tr-sigil .n{font-size:26px;font-weight:600;fill:var(--ink);letter-spacing:-0.02em}",
      ".scene-trial h1{font-size:clamp(40px,11vw,68px);margin-bottom:12px}",
      ".scene-trial .tr-doms{display:grid;gap:6px;margin:20px 0 4px}",
      ".scene-trial .tr-doms div{display:flex;justify-content:space-between;gap:12px;font-size:13.5px;color:var(--ink-2);padding:8px 0;border-bottom:1px solid var(--line)}",
      ".scene-trial .tr-doms b{font-family:var(--mono);font-weight:500;color:var(--ink-dim);font-size:12px}",
      ".scene-trial .tr-rules{list-style:none;display:grid;gap:8px;margin:18px 0 22px;font-size:14px;color:var(--ink-2);line-height:1.5}",
      ".scene-trial .tr-rules li{padding-left:20px;position:relative}",
      ".scene-trial .tr-rules li::before{content:'';position:absolute;left:2px;top:.62em;width:8px;height:1px;background:var(--accent)}",
      ".scene-trial .tr-k{font-family:var(--body);font-size:11px;letter-spacing:0;text-transform:none;color:var(--ink-dim);margin:22px 0 8px}",
      ".scene-trial .tr-att{display:grid;grid-template-columns:auto 1fr auto;gap:6px 12px;align-items:center;font-family:var(--mono);font-size:12px;color:var(--ink-dim)}",
      ".scene-trial .tr-att .bar{height:6px;border-radius:3px;background:rgba(255,255,255,0.08);overflow:hidden;position:relative}",
      ".scene-trial .tr-att .bar i{position:absolute;inset:0;transform-origin:left;background:var(--warn)}.scene-trial .tr-att .bar i.ok{background:var(--ok)}",
      ".scene-trial .tr-att .bar::after{content:'';position:absolute;top:-2px;bottom:-2px;left:" + PASS + "%;width:1px;background:rgba(255,255,255,0.5)}",
      ".scene-trial .tr-att b{color:var(--ink);font-weight:600}",
      ".scene-trial .tr-begin{min-height:56px;padding:0 26px;font-size:16px;border-radius:16px}",
      ".scene-trial .tr-resume{padding:16px;margin:18px 0 6px;border-color:var(--accent-glow)}",
      ".scene-trial .tr-resume .t{font-family:var(--mono);font-size:12.5px;color:var(--ink-2);margin-bottom:12px}",
      ".scene-trial .tr-resume .t b{color:var(--accent)}",
      /* focused exam */
      ".scene-trial.trial-on{height:100svh;min-height:0;padding:calc(10px + var(--sa-top)) 14px calc(12px + var(--sa-bottom));justify-content:stretch}",
      ".scene-trial.trial-on .sc{height:100%;display:flex;flex-direction:column;max-width:760px}",
      ".scene-trial .tx-top{display:flex;align-items:center;gap:8px;padding-bottom:10px}",
      ".scene-trial .tx-ico{width:44px;height:44px;border-radius:13px;display:grid;place-items:center;background:var(--panel-solid);border:1px solid var(--line-strong);color:var(--ink-2);flex:none;transition:transform .3s var(--spring)}",
      ".scene-trial .tx-ico:active{transform:scale(.92)}",
      ".scene-trial .tx-ttl{flex:1;min-width:0}",
      ".scene-trial .tx-ttl b{display:block;font-family:var(--display);font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".scene-trial .tx-ttl span{display:block;font-family:var(--mono);font-size:11px;color:var(--ink-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".scene-trial .tx-time{font-family:var(--mono);font-size:15px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ink);padding:0 6px}",
      ".scene-trial .tx-time.low{color:var(--bad)}",
      ".scene-trial .tx-prog{height:3px;border-radius:2px;background:rgba(255,255,255,0.07);overflow:hidden;margin-bottom:4px}",
      ".scene-trial .tx-prog i{display:block;height:100%;width:100%;transform-origin:left;background:linear-gradient(90deg,var(--accent),var(--flow));transition:transform .5s var(--ease-out)}",
      ".scene-trial .tx-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:14px 2px 18px;-webkit-overflow-scrolling:touch}",
      ".scene-trial .tx-q{animation:txIn .38s var(--ease-out) both}",
      ".scene-trial .tx-q.back{animation-name:txInB}",
      "@keyframes txIn{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:none}}",
      "@keyframes txInB{from{opacity:0;transform:translateX(-22px)}to{opacity:1;transform:none}}",
      ".scene-trial .tx-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-family:var(--body);font-size:11px;letter-spacing:0;text-transform:none;color:var(--ink-dim);margin-bottom:12px}",
      ".scene-trial .tx-meta .pill{padding:4px 8px;border-radius:8px;border:1px solid var(--line-strong);color:var(--ink-2)}",
      ".scene-trial .tx-meta .pill.multi{border-color:var(--flow-glow);color:var(--flow)}",
      ".scene-trial .tx-meta .pill.flag{border-color:rgba(210,173,94,0.5);color:var(--warn)}",
      ".scene-trial .tx-q .q{font-size:clamp(16px,4.3vw,19px);line-height:1.55;font-weight:500}",
      ".scene-trial .tx-q .opt .l{transition:background .2s,border-color .2s,color .2s}",
      ".scene-trial .tx-q.multi .opt .l{border-radius:6px}",
      ".scene-trial .tx-foot{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;padding-top:10px;border-top:1px solid var(--line)}",
      ".scene-trial .tx-foot .btn{min-height:50px}",
      ".scene-trial .tx-flag[aria-pressed=true]{border-color:rgba(210,173,94,0.6);color:var(--warn);background:rgba(210,173,94,0.08)}",
      /* results */
      ".scene-trial .rs-pct{font-family:var(--mono);font-weight:600;font-size:clamp(72px,22vw,120px);line-height:.95;letter-spacing:-0.05em;font-variant-numeric:tabular-nums;margin:6px 0 8px}",
      ".scene-trial .rs-pct.ok{color:var(--ok);text-shadow:0 0 50px var(--ok-glow)}.scene-trial .rs-pct.bad{color:var(--warn)}",
      ".scene-trial .rs-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0 6px}",
      ".scene-trial .rs-stats .panel{padding:12px 14px}.scene-trial .rs-stats .v{font-size:20px}",
      ".scene-trial .rs-stats .k{font-family:var(--body);font-size:10.5px;letter-spacing:0;text-transform:none;color:var(--ink-dim)}",
      ".scene-trial .rs-dom{display:grid;gap:14px;margin:6px 0 8px}",
      ".scene-trial .rs-dom .r .t{display:flex;justify-content:space-between;gap:10px;font-size:13.5px;color:var(--ink-2);margin-bottom:6px}",
      ".scene-trial .rs-dom .r .t b{font-family:var(--mono);font-weight:600;color:var(--ink)}",
      ".scene-trial .rs-dom .bar{height:8px;border-radius:4px;background:rgba(255,255,255,0.07);overflow:hidden;position:relative}",
      ".scene-trial .rs-dom .bar i{position:absolute;inset:0;transform-origin:left;transform:scaleX(0);transition:transform 1.1s var(--ease-out);background:var(--warn)}",
      ".scene-trial .rs-dom .bar i.ok{background:var(--ok)}.scene-trial .rs-dom .bar i.bad{background:var(--bad)}",
      ".scene-trial .rs-dom .bar::after{content:'';position:absolute;top:0;bottom:0;left:" + PASS + "%;width:1px;background:rgba(255,255,255,0.55)}",
      ".scene-trial .rs-miss{display:grid;gap:8px}",
      ".scene-trial .rs-item{border-radius:16px;border:1px solid var(--line);background:var(--panel);overflow:hidden}",
      ".scene-trial .rs-item>button{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;padding:14px 16px;min-height:52px;background:none;color:var(--ink-2);font-size:14px;line-height:1.45}",
      ".scene-trial .rs-item>button .n{font-family:var(--mono);font-size:11.5px;color:var(--bad);flex:none;margin-top:2px;min-width:30px}",
      ".scene-trial .rs-item>button .s{flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}",
      ".scene-trial .rs-item>button svg{flex:none;margin-top:2px;transition:transform .35s var(--spring);color:var(--ink-dim)}",
      ".scene-trial .rs-item.open>button svg{transform:rotate(180deg)}",
      ".scene-trial .rs-item.open>button .s{display:block}",
      ".scene-trial .rs-item .d{display:none;padding:0 16px 16px}",
      ".scene-trial .rs-item.open .d{display:block;animation:txIn .35s var(--ease-out) both}",
      ".scene-trial .rs-item .dom{font-family:var(--body);font-size:11px;color:var(--ink-dim);margin-bottom:10px;text-transform:none;letter-spacing:0}",
      ".scene-trial .rs-item .opt{pointer-events:none;font-size:14px;padding:11px 13px}",
      ".scene-trial .rs-item .why p{margin:0 0 8px}.scene-trial .rs-item .why p:last-child{margin:0}",
      ".scene-trial .rs-item .why code{font-family:var(--mono);font-size:.88em;color:var(--accent-2)}",
      /* question map sheet (lives in body, scoped by class) */
      ".sheet .tr-map .lg{display:flex;gap:14px;flex-wrap:wrap;font-family:var(--mono);font-size:11px;color:var(--ink-dim);margin:8px 0 14px}",
      ".sheet .tr-map .lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px;border:1px solid var(--line-strong)}",
      ".sheet .tr-map .lg i.a{background:rgba(127,166,214,0.35);border-color:var(--flow)}.sheet .tr-map .lg i.f{background:rgba(210,173,94,0.3);border-color:var(--warn)}",
      ".sheet .tr-map .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(44px,1fr));gap:6px;margin-bottom:14px}",
      ".sheet .tr-map .grid button{height:44px;border-radius:11px;font-family:var(--mono);font-size:13px;color:var(--ink-2);background:rgba(255,255,255,0.03);border:1px solid var(--line);position:relative}",
      ".sheet .tr-map .grid button.a{background:rgba(127,166,214,0.14);border-color:rgba(127,166,214,0.45);color:var(--ink)}",
      ".sheet .tr-map .grid button.f::after{content:'';position:absolute;top:4px;right:4px;width:7px;height:7px;border-radius:50%;background:var(--warn)}",
      ".sheet .tr-map .grid button.f:not(.a){border-color:rgba(210,173,94,0.5)}",
      ".sheet .tr-map .grid button.c{outline:2px solid var(--accent);outline-offset:1px;color:var(--ink)}",
      ".sheet .tr-map .sum{font-family:var(--mono);font-size:12px;color:var(--ink-2);margin-bottom:6px}",
      ".sheet .tr-map .ab{background:none;color:var(--ink-dim);font-size:12.5px;text-decoration:underline;text-underline-offset:3px;min-height:44px;width:100%}",
      ".sheet .tr-map .warn{color:var(--warn)}"
    ].join("\n");
    document.head.appendChild(st);
  }

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var hh = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (hh ? hh + ":" : "") + (m < 10 && hh ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    return a.slice().sort().join(",") === b.slice().sort().join(",");
  }
  function codeOf(e) { var mm = (e.title || "").match(/S[AO][AP]-C0\d/); return mm ? mm[0] : e.track.toUpperCase(); }
  function examById(id) { return (window.COURSE.exams || []).find(function (e) { return e.id === id; }); }
  function domainsOf(e) {
    var d = [], seen = {};
    e.questions.forEach(function (q) { var k = q.domain || "General"; if (!seen[k]) { seen[k] = { name: k, n: 0 }; d.push(seen[k]); } seen[k].n++; });
    return d;
  }
  var ICON = {
    x: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
  };

  /* ---------- run lifecycle (module scope, independent of the DOM) ---------- */
  function newRun(e) {
    var qs = ST.shuffle(e.questions);
    var run = { e: e, qs: qs, answers: qs.map(function () { return []; }), flags: qs.map(function () { return false; }), cur: 0,
      started: Date.now(), deadline: Date.now() + e.timeMinutes * 60000, result: null, onTick: null, timer: 0 };
    run.timer = setInterval(function () {
      if (run.result) return;
      if (run.onTick) run.onTick();
      if (Date.now() >= run.deadline) score(run, "time");
    }, 1000);
    RUNS[e.id] = run;
    return run;
  }
  function left(run) { return (run.deadline - Date.now()) / 1000; }
  function score(run, why) {
    if (run.result) return run.result;
    clearInterval(run.timer);
    var correct = 0, domains = {};
    run.qs.forEach(function (q, qi) {
      var d = q.domain || "General";
      if (!domains[d]) domains[d] = { correct: 0, total: 0 };
      domains[d].total++;
      if (sameSet(run.answers[qi], q.answer)) { correct++; domains[d].correct++; }
    });
    var pct = Math.round(100 * correct / run.qs.length);
    var durationSec = Math.round((Math.min(Date.now(), run.deadline) - run.started) / 1000);
    ST.S.examAttempts.push({ examId: run.e.id, date: new Date().toISOString(), pct: pct, domains: domains, durationSec: durationSec });
    ST.save();
    run.result = { pct: pct, correct: correct, domains: domains, durationSec: durationSec, why: why, shown: false };
    if (run.onScored) run.onScored();
    return run.result;
  }
  function abandon(run) { clearInterval(run.timer); if (RUNS[run.e.id] === run) delete RUNS[run.e.id]; }

  JOURNEY.registerScene("trial", {
    wide: false,
    label: function (sc) { var e = examById(sc.data.examId); return "The Trial · " + (e ? codeOf(e) : ""); },
    render: function (el, sc, ctx) {
      var e = examById(sc.data.examId), section = el.parentNode;
      if (!e) { el.innerHTML = '<div class="eyebrow">The Trial</div><p class="dim">This practice exam is not loaded.</p>'; return {}; }
      var code = codeOf(e), view = "intro", focused = false, interrupted = false, isLive = false, keyOn = false, lastDir = 1;

      /* ===== intro ===== */
      function attempts() { return ST.S.examAttempts.filter(function (a) { return a.examId === e.id; }); }
      function sigil(bestPct) {
        var n = e.questions.length, on = Math.round(n * (bestPct || 0) / 100), s = "";
        for (var i = 0; i < n; i++) {
          var a = (i / n) * Math.PI * 2 - Math.PI / 2, r1 = 56, r2 = i % 5 === 0 ? 46 : 50;
          s += '<line class="' + (i < on ? "on" : "") + '" x1="' + (66 + Math.cos(a) * r1).toFixed(1) + '" y1="' + (66 + Math.sin(a) * r1).toFixed(1) + '" x2="' + (66 + Math.cos(a) * r2).toFixed(1) + '" y2="' + (66 + Math.sin(a) * r2).toFixed(1) + '"/>';
        }
        return '<svg class="tr-sigil rv" viewBox="0 0 132 132">' + s + '<text class="n" x="66" y="70" text-anchor="middle">' + n + '</text><text x="66" y="88" text-anchor="middle">QUESTIONS</text></svg>';
      }
      function intro() {
        view = "intro";
        section.classList.remove("tall");
        var at = attempts(), bestPct = at.reduce(function (b, a) { return Math.max(b, a.pct); }, 0);
        var run = RUNS[e.id] && !RUNS[e.id].result ? RUNS[e.id] : null;
        if (at.length) section.classList.add("tall");
        el.innerHTML =
          sigil(bestPct) +
          '<div class="eyebrow rv"><span>The Trial · ' + esc(code) + '</span><span class="dim">' + (e.track === "saa" ? "end of Act I" : "end of Act II") + "</span></div>" +
          '<h1 class="rv">The Trial.</h1>' +
          '<p class="lead rv">' + esc(e.title) + ". Every station you passed, in one timed sitting. Nothing new is asked here; it only checks what the route has already given you.</p>" +
          '<div class="facts rv"><span class="fact-pill"><b>' + e.questions.length + '</b> questions</span><span class="fact-pill"><b>' + e.timeMinutes + '</b> min</span><span class="fact-pill">pass <b>~' + PASS + "%</b></span></div>" +
          (run ? '<div class="panel tr-resume rv"><div class="t">In progress · question <b>' + (run.cur + 1) + "</b> of " + run.qs.length + " · <b>" + fmt(left(run)) + '</b> left · the clock is running</div><div class="row-btns"><button class="btn primary res">Resume the trial</button><button class="btn ghost ab">Abandon</button></div></div>' : "") +
          '<ul class="tr-rules rv"><li>Timed like the real exam. The clock keeps running if you step out.</li><li>Flag anything you doubt and come back through the question map. Unanswered counts as wrong.</li><li>No explanations until you submit; then every miss is explained.</li>' + (META.passNote ? "<li>Pass line ~" + PASS + "% (" + esc(META.passNote) + ").</li>" : "") + "</ul>" +
          (run ? "" : '<div class="row-btns rv"><button class="btn primary tr-begin">Begin the trial</button></div><p class="rv" style="margin-top:12px;font-size:13px;color:var(--ink-dim)">Optional. Best taken when you have ' + Math.round(e.timeMinutes / 60 * 2) / 2 + " quiet hours.</p>") +
          '<div class="rv"><div class="tr-k">Domains</div><div class="tr-doms" style="margin-top:0">' + domainsOf(e).map(function (d) { return "<div><span>" + esc(d.name) + "</span><b>" + d.n + "</b></div>"; }).join("") + "</div></div>" +
          (at.length ? '<div class="rv"><div class="tr-k">Past attempts · best ' + bestPct + '%</div><div class="tr-att">' + at.slice(-6).reverse().map(function (a) {
            return "<span>" + esc(a.date.slice(0, 10)) + " · " + fmt(a.durationSec || 0) + '</span><span class="bar"><i class="' + (a.pct >= PASS ? "ok" : "") + '" style="transform:scaleX(' + (a.pct / 100) + ')"></i></span><b>' + a.pct + "%</b>";
          }).join("") + "</div></div>" : "");
        var b = el.querySelector(".tr-begin"); if (b) b.onclick = function () { newRun(e); LAB.haptic("pop"); LAB.sound.play("whoosh"); focus(); };
        var r = el.querySelector(".res"); if (r) r.onclick = function () { LAB.haptic("tap"); focus(); };
        var a = el.querySelector(".ab"); if (a) a.onclick = function () { confirmAbandon(); };
      }

      /* ===== focused exam mode ===== */
      function focus() {
        var run = RUNS[e.id]; if (!run) return intro();
        if (run.result) return results();
        focused = true; interrupted = false; view = "exam";
        document.body.classList.add("in-trial");
        section.classList.remove("tall"); section.classList.add("trial-on");
        var reel = document.getElementById("reel"); if (reel) reel.scrollTop = section.offsetTop;
        el.innerHTML =
          '<div class="tx-top"><button class="tx-ico tx-out" aria-label="Step out of the trial">' + ICON.x + '</button>' +
          '<div class="tx-ttl"><b>The Trial · ' + esc(code) + '</b><span class="pos"></span></div>' +
          '<span class="tx-time"></span><button class="tx-ico tx-map" aria-label="Question map">' + ICON.grid + "</button></div>" +
          '<div class="tx-prog"><i></i></div><div class="tx-body"></div>' +
          '<div class="tx-foot"><button class="btn tx-prev">Prev</button><button class="btn tx-flag" aria-pressed="false">Flag</button><button class="btn primary tx-next">Next</button></div>';
        el.querySelector(".tx-out").onclick = stepOut;
        el.querySelector(".tx-map").onclick = openMap;
        el.querySelector(".tx-prev").onclick = function () { go(run.cur - 1); };
        el.querySelector(".tx-next").onclick = function () { if (run.cur === run.qs.length - 1) openMap(); else go(run.cur + 1); };
        el.querySelector(".tx-flag").onclick = function () { run.flags[run.cur] = !run.flags[run.cur]; LAB.haptic("tick"); paintQ(false); };
        run.onTick = tick; run.onScored = function () { if (focused || isLive) results(); };
        paintQ(true); tick(); keys(true);
      }
      function unfocus() {
        focused = false; keys(false);
        document.body.classList.remove("in-trial");
        section.classList.remove("trial-on");
        var run = RUNS[e.id]; if (run) run.onTick = null;
        LAB.closeSheet();
      }
      function stepOut() { LAB.haptic("tap"); unfocus(); intro(); }
      function tick() {
        var run = RUNS[e.id], t = el.querySelector(".tx-time"); if (!run || !t) return;
        var l = left(run); t.textContent = fmt(l); t.classList.toggle("low", l < 300);
      }
      function go(i) {
        var run = RUNS[e.id]; if (!run || i < 0 || i >= run.qs.length) return;
        lastDir = i >= run.cur ? 1 : -1; run.cur = i; LAB.haptic("tick"); paintQ(true);
      }
      function paintQ(fresh) {
        var run = RUNS[e.id], q = run.qs[run.cur], multi = !!q.multi, need = [].concat(q.answer).length, sel = run.answers[run.cur];
        var answered = run.answers.filter(function (a) { return a.length; }).length;
        el.querySelector(".pos").textContent = "Q " + (run.cur + 1) + "/" + run.qs.length + " · " + answered + " answered";
        el.querySelector(".tx-prog i").style.transform = "scaleX(" + (answered / run.qs.length).toFixed(3) + ")";
        var fl = el.querySelector(".tx-flag"); fl.setAttribute("aria-pressed", String(run.flags[run.cur])); fl.textContent = run.flags[run.cur] ? "Flagged" : "Flag";
        el.querySelector(".tx-prev").disabled = run.cur === 0;
        el.querySelector(".tx-next").textContent = run.cur === run.qs.length - 1 ? "Review" : "Next";
        var body = el.querySelector(".tx-body");
        if (!fresh) {
          body.querySelectorAll(".opt").forEach(function (b, i) { b.classList.toggle("pick", sel.indexOf(i) >= 0); });
          var fp = body.querySelector(".pill.flag"); if (fp) fp.style.display = run.flags[run.cur] ? "" : "none";
          var mp = body.querySelector(".pill.multi"); if (mp) mp.textContent = "Choose " + need + " · " + sel.length + " picked";
          return;
        }
        var wrap = h('<div class="tx-q' + (lastDir < 0 ? " back" : "") + (multi ? " multi" : "") + '"><div class="tx-meta"><span>' + esc(q.domain || "General") + "</span>" +
          (multi ? '<span class="pill multi">Choose ' + need + " · " + sel.length + " picked</span>" : "") +
          '<span class="pill flag" style="' + (run.flags[run.cur] ? "" : "display:none") + '">flagged</span></div><div class="q"></div><div class="opts"></div></div>');
        wrap.querySelector(".q").textContent = q.q;
        var box = wrap.querySelector(".opts");
        q.options.forEach(function (o, i) {
          var b = h('<button class="opt' + (sel.indexOf(i) >= 0 ? " pick" : "") + '"><span class="l">' + "ABCDEFGH"[i] + "</span><span></span></button>");
          b.lastChild.textContent = o;
          b.onclick = function () { pick(i); };
          box.appendChild(b);
        });
        body.innerHTML = ""; body.appendChild(wrap); body.scrollTop = 0;
      }
      function pick(i) {
        var run = RUNS[e.id]; if (!run || run.result) return;
        var q = run.qs[run.cur], sel = run.answers[run.cur];
        if (q.multi) { var k = sel.indexOf(i); if (k >= 0) sel.splice(k, 1); else sel.push(i); }
        else run.answers[run.cur] = sel.length === 1 && sel[0] === i ? [] : [i];
        LAB.haptic("tap"); LAB.sound.play("tick");
        paintQ(false);
      }
      function openMap() {
        var run = RUNS[e.id]; if (!run) return;
        var answered = run.answers.filter(function (a) { return a.length; }).length, flagged = run.flags.filter(Boolean).length;
        var sh = LAB.sheet('<div class="tr-map"><div class="eyebrow">The Trial · ' + esc(code) + "</div><h3>Question map</h3>" +
          '<div class="lg"><span><i class="a"></i>answered</span><span><i class="f"></i>flagged</span><span><i></i>open</span></div>' +
          '<div class="grid">' + run.qs.map(function (_, i) { return '<button data-i="' + i + '" class="' + (run.answers[i].length ? "a " : "") + (run.flags[i] ? "f " : "") + (i === run.cur ? "c" : "") + '">' + (i + 1) + "</button>"; }).join("") + "</div>" +
          '<div class="sum">' + answered + " answered · " + flagged + " flagged · " + (run.qs.length - answered) + " open · " + fmt(left(run)) + " left</div>" +
          '<button class="btn primary sub">Submit and score</button><button class="ab">Abandon this attempt</button></div>');
        sh.querySelectorAll(".grid button").forEach(function (b) { b.onclick = function () { LAB.closeSheet(); go(+b.dataset.i); }; });
        sh.querySelector(".sub").onclick = function () { confirmSubmit(); };
        sh.querySelector(".ab").onclick = function () { confirmAbandon(); };
      }
      function confirmSubmit() {
        var run = RUNS[e.id]; if (!run) return;
        var open = run.answers.filter(function (a) { return !a.length; }).length, flagged = run.flags.filter(Boolean).length;
        var sh = LAB.sheet('<div class="tr-map"><div class="eyebrow">Submit</div><h3>Score the trial now?</h3>' +
          "<p>" + (open ? '<span class="warn">' + open + " unanswered question" + (open === 1 ? "" : "s") + " will count as wrong.</span> " : "Every question has an answer. ") +
          (flagged ? flagged + " still flagged. " : "") + fmt(left(run)) + " left on the clock.</p>" +
          '<button class="btn primary yes">Submit and score</button><button class="btn no">Keep going</button></div>');
        sh.querySelector(".yes").onclick = function () { LAB.closeSheet(); score(run, "submit"); results(); };
        sh.querySelector(".no").onclick = function () { LAB.closeSheet(); };
      }
      function confirmAbandon() {
        var run = RUNS[e.id]; if (!run) return;
        var sh = LAB.sheet('<div class="tr-map"><div class="eyebrow">Abandon</div><h3>Leave this attempt?</h3><p>Nothing is scored or saved. You can begin a fresh trial any time.</p>' +
          '<button class="btn yes" style="border-color:rgba(215,119,109,0.5);color:var(--bad)">Abandon the attempt</button><button class="btn primary no">Keep it</button></div>');
        sh.querySelector(".yes").onclick = function () { LAB.closeSheet(); abandon(run); unfocus(); intro(); };
        sh.querySelector(".no").onclick = function () { LAB.closeSheet(); };
      }
      function keys(on) {
        if (on && !keyOn) { document.addEventListener("keydown", onKey); keyOn = true; }
        if (!on && keyOn) { document.removeEventListener("keydown", onKey); keyOn = false; }
      }
      function onKey(ev) {
        if (!focused) return;
        var run = RUNS[e.id]; if (!run) return;
        if (document.querySelector(".sheet.show")) return;
        if (ev.key === "ArrowRight") go(run.cur + 1);
        else if (ev.key === "ArrowLeft") go(run.cur - 1);
        else if (/^[1-6]$/.test(ev.key) && +ev.key <= run.qs[run.cur].options.length) pick(+ev.key - 1);
        else if (ev.key === "f" || ev.key === "F") { run.flags[run.cur] = !run.flags[run.cur]; paintQ(false); }
        else if (ev.key === "m" || ev.key === "M") openMap();
      }

      /* ===== results ===== */
      function results() {
        var run = RUNS[e.id]; if (!run || !run.result) return intro();
        var R = run.result; R.shown = true;
        unfocus(); view = "results";
        section.classList.add("tall");
        var pass = R.pct >= PASS, MODS = ST.MODULES, next = MODS[sc.ci + 1];
        var missed = run.qs.map(function (q, i) { return { q: q, i: i, a: run.answers[i] }; }).filter(function (x) { return !sameSet(x.a, x.q.answer); });
        el.innerHTML =
          '<div class="eyebrow"><span>The Trial · ' + esc(code) + '</span><span class="dim">' + (R.why === "time" ? "time is up" : "result") + "</span></div>" +
          '<div class="rs-pct ' + (pass ? "ok" : "bad") + '">0%</div>' +
          '<h2 style="margin-bottom:8px">' + (pass ? "Above the line." : "Not yet. Close is a direction.") + "</h2>" +
          '<p class="lead">' + (pass ? "This would likely pass. The misses below are still worth reading: each one is a phrase the real exam will reuse." : "The pass line is ~" + PASS + "%. The domain bars show where the next hours go; every miss below links back to an idea you have already met.") + "</p>" +
          '<div class="rs-stats"><div class="panel stat"><span class="k">Correct</span><span class="v">' + R.correct + "/" + run.qs.length + '</span></div><div class="panel stat"><span class="k">Time</span><span class="v">' + fmt(R.durationSec) + '</span></div><div class="panel stat"><span class="k">Missed</span><span class="v ' + (missed.length ? "warn" : "ok") + '">' + missed.length + "</span></div></div>" +
          '<div class="tr-k">By domain</div><div class="rs-dom">' + Object.keys(R.domains).map(function (d) {
            var dd = R.domains[d], p = Math.round(100 * dd.correct / dd.total);
            return '<div class="r"><div class="t"><span>' + esc(d) + "</span><b>" + p + '%</b></div><div class="bar"><i class="' + (p >= PASS ? "ok" : p < 50 ? "bad" : "") + '" data-p="' + p + '"></i></div></div>';
          }).join("") + "</div>" +
          (missed.length ? '<div class="tr-k" style="margin-top:26px">Review the misses · tap to open</div><div class="rs-miss"></div>' : '<p class="lead" style="margin-top:18px">No misses. Nothing to review.</p>') +
          '<div class="row-btns" style="margin-top:24px">' + (next ? '<button class="btn primary cont">Continue to ' + esc(next.title) + "</button>" : "") + '<button class="btn back">Back to the trial</button></div>' +
          (next ? "" : '<p class="lead" style="margin-top:14px">That was the last station. The whole journey stays open: tap the orb to fly anywhere.</p>');
        var list = el.querySelector(".rs-miss");
        missed.forEach(function (x) {
          var q = x.q, it = h('<div class="rs-item"><button><span class="n">Q' + (x.i + 1) + '</span><span class="s"></span>' + ICON.chev + '</button><div class="d"><div class="dom"></div><div class="opts"></div><div class="why bad"></div></div></div>');
          it.querySelector(".s").textContent = q.q;
          it.querySelector(".dom").textContent = (q.domain || "General") + (x.a.length ? "" : " · unanswered");
          var box = it.querySelector(".opts");
          q.options.forEach(function (o, oi) {
            var b = h('<div class="opt ' + (q.answer.indexOf(oi) >= 0 ? "right" : x.a.indexOf(oi) >= 0 ? "wrong" : "fade") + '"><span class="l">' + "ABCDEFGH"[oi] + "</span><span></span></div>");
            b.lastChild.textContent = o; box.appendChild(b);
          });
          it.querySelector(".why").innerHTML = q.explanation || "";
          it.querySelector("button").onclick = function () { it.classList.toggle("open"); LAB.haptic("tick"); };
          list.appendChild(it);
        });
        var c = el.querySelector(".cont"); if (c) c.onclick = function () { LAB.haptic("tap"); ctx.goTo(sc.ci + 1, "opener"); };
        el.querySelector(".back").onclick = function () { delete RUNS[e.id]; intro(); section.scrollIntoView({ block: "start" }); };
        LAB.count(el.querySelector(".rs-pct"), R.pct, { from: 0, ms: 1300, fmt: function (n) { return Math.round(n) + "%"; } });
        requestAnimationFrame(function () { requestAnimationFrame(function () {
          el.querySelectorAll(".rs-dom i").forEach(function (i) { i.style.transform = "scaleX(" + (+i.dataset.p / 100) + ")"; });
        }); });
        LAB.haptic(pass ? "ok" : "pop"); LAB.sound.play(pass ? "ok" : "pop");
        var reel = document.getElementById("reel"); if (reel) reel.scrollTop = section.offsetTop;
      }

      // first paint: a scored-but-unseen run shows its result, otherwise the intro
      var r0 = RUNS[e.id];
      if (r0 && r0.result && !r0.result.shown) results(); else intro();

      return {
        enter: function () {
          isLive = true;
          var run = RUNS[e.id];
          if (run && run.result && !run.result.shown) { results(); return; }
          if (run && !run.result && interrupted) focus();      // knocked away mid-exam → straight back in
          else if (view === "intro") intro();                   // refresh resume panel / attempts
        },
        leave: function () {
          isLive = false;
          if (focused) { interrupted = true; unfocus(); }
        },
        destroy: function () {
          isLive = false;
          if (focused) unfocus();
          var run = RUNS[e.id]; if (run) { run.onTick = null; run.onScored = null; }
        }
      };
    }
  });

  /* ---------- casting: the boss station closes each act ---------- */
  ["saa", "sap"].forEach(function (t) {
    var m = JOURNEY.lastOfTrack(t), ex = (window.COURSE.exams || []).find(function (x) { return x.track === t; });
    if (m && ex) JOURNEY.cast(m.id, [{ type: "trial", after: "post", id: ex.id, data: { examId: ex.id }, label: "The Trial · " + codeOf(ex) }]);
  });
})();
