/* ============================================================
   THE JOURNEY — the AWS course as one continuous experience.
   No tabs, no menus. A world (canvas) you travel through; each module is a
   chapter you scroll through as a reel of scenes; between chapters the
   camera flies to the next station. Tap the orb to zoom out to the whole
   journey (the atlas) and fly back to anything you have learned.

   Scene API (for scenes/*.js):
     JOURNEY.registerScene(type, { render(el, scene, ctx) -> ctrl? , label?(scene) })
       el    : <div class="sc"> inside the scene <section>
       ctrl  : optional { enter(), leave(), destroy() } — enter/leave fire when the
               scene becomes / stops being the live scene (start/stop canvases there)
     JOURNEY.cast(moduleId, [{ type, after?, data?, replaces?, label? }])
       after   : lessonId | "opener" | "end" (before decisions) | "post" (after closer)
                 omitted → spread evenly between lessons with the module's diagrams/widgets
       replaces: "diagram:<id>" | "widget:<id>" — suppress the auto-placed scene
   ============================================================ */
(function () {
  "use strict";
  var ST = window.JSTORE, LABK = window.LAB;
  var MODULES = ST.MODULES, LEARN = ST.LEARN;
  var COURSE = window.COURSE;
  var h = LABK.h, esc = LABK.esc;

  var J = window.JOURNEY = window.JOURNEY || {};
  J.types = J.types || {};
  J.casting = J.casting || {};
  J.registerScene = function (type, def) { J.types[type] = def; };
  J.cast = function (moduleId, list) { (J.casting[moduleId] = J.casting[moduleId] || []).push.apply(J.casting[moduleId], list); };
  J.lastOfTrack = function (t) { var ms = MODULES.filter(function (m) { return m.track === t; }); return ms[ms.length - 1]; };

  /* ---------- domains (colour of each station) ---------- */
  var DOMAIN = {
    core: { c: "#ff8a3d", ids: ["foundations", "iam"] },
    net: { c: "#5ad1ff", ids: ["vpc", "elb-asg", "route53", "adv-networking"] },
    compute: { c: "#b69cff", ids: ["ec2", "serverless", "containers"] },
    data: { c: "#4ade80", ids: ["s3", "block-file", "rds-aurora", "dynamodb", "caching"] },
    flow: { c: "#f5c054", ids: ["messaging", "analytics", "migration", "migration-pro", "ai-ml"] },
    ops: { c: "#ff7aa8", ids: ["security-services", "observability", "cost", "ha-dr", "multi-account", "devops-iac", "pro-scenarios"] }
  };
  function colorOf(id) { for (var k in DOMAIN) if (DOMAIN[k].ids.indexOf(id) >= 0) return DOMAIN[k].c; return "#ff8a3d"; }
  J.colorOf = colorOf;

  /* ---------- helpers ---------- */
  function learnOf(m) { return LEARN[m.id] || null; }
  function lx(m, l) { var L = LEARN[m.id]; return L && L.lessons ? L.lessons[l.id] || null : null; }
  function minutes(m, l) { var x = lx(m, l); if (x && x.minutes) return x.minutes; var words = (l.html || "").replace(/<[^>]+>/g, " ").split(/\s+/).length; return Math.max(3, Math.round(words / 220)); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function actOf(m) { return m.track === "saa" ? "Act I · Associate" : "Act II · Professional"; }
  function totalLessons() { return MODULES.reduce(function (a, m) { return a + m.lessons.length; }, 0); }
  function doneLessons() { var S = ST.S, n = 0; MODULES.forEach(function (m) { m.lessons.forEach(function (l) { if (S.lessons[ST.lessonKey(m, l)]) n++; }); }); return n; }
  var toastT = 0;
  function toast(msg) {
    var t = document.getElementById("jtoast"); t.innerHTML = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }
  J.toast = toast;
  function prose(html) {
    var d = document.createElement("div"); d.className = "prose"; d.innerHTML = html;
    d.querySelectorAll("table").forEach(function (t) { var w = document.createElement("div"); w.className = "tw"; t.parentNode.insertBefore(w, t); w.appendChild(t); });
    return d;
  }
  J.prose = prose;

  /* ---------- the reader (full deep lesson, slides over the reel) ---------- */
  var readerEl;
  function openReader(title, html, eyebrow) {
    readerEl.querySelector(".rhead b").textContent = title;
    var body = readerEl.querySelector(".rbody"); body.innerHTML = "";
    if (eyebrow) body.appendChild(h('<div class="eyebrow">' + esc(eyebrow) + "</div>"));
    body.appendChild(h('<h2 style="font-family:var(--display);font-size:clamp(24px,6vw,34px);letter-spacing:-0.02em;line-height:1.15;margin-bottom:18px">' + esc(title) + "</h2>"));
    body.appendChild(prose(html));
    readerEl.scrollTop = 0;
    readerEl.classList.add("show");
    LABK.haptic("tap"); LABK.sound.play("whoosh");
  }
  function closeReader() { readerEl.classList.remove("show"); }
  J.openReader = openReader;

  /* ============================================================
     CHAPTERS: each module becomes a list of scenes
     ============================================================ */
  function buildChapter(ci) {
    var m = MODULES[ci], L = learnOf(m), out = [];
    var cast = (J.casting[m.id] || []).slice();
    var replaced = {};
    cast.forEach(function (c) { if (c.replaces) [].concat(c.replaces).forEach(function (r) { replaced[r] = true; }); });
    function at(where) { return cast.filter(function (c) { return c.after === where; }); }
    function push(type, extra) { var s = { type: type, m: m, ci: ci }; for (var k in extra) s[k] = extra[k]; s.key = s.key || type; out.push(s); return s; }
    function pushCast(c, i) { push(c.type, { key: c.type + ":" + (c.id || (c.data && c.data.id) || i), data: c.data, label: c.label }); }

    push("opener");
    at("opener").forEach(pushCast);

    // interactive pieces to spread between lessons
    var floating = [];
    COURSE.diagrams.filter(function (d) { return d.moduleId === m.id && !replaced["diagram:" + d.id]; }).forEach(function (d) { floating.push({ type: "diagram", data: d, id: d.id }); });
    COURSE.widgets.filter(function (w) { return w.moduleId === m.id && !replaced["widget:" + w.id]; }).forEach(function (w) { floating.push({ type: "widget", data: w, id: w.id }); });
    cast.filter(function (c) { return !c.after; }).forEach(function (c) { floating.push(c); });
    var nL = m.lessons.length, slots = {};
    floating.forEach(function (f, k) {
      var after = Math.min(nL - 1, Math.max(0, Math.round((k + 1) * nL / (floating.length + 1)) - 1));
      (slots[after] = slots[after] || []).push(f);
    });
    var explainer = COURSE.explainers.find(function (x) { return x.moduleId === m.id; });

    m.lessons.forEach(function (l, li) {
      var x = lx(m, l), base = { l: l, li: li, x: x };
      push("idea", Object.assign({ key: "l:" + l.id }, base));
      if (x && (x.analogy || x.examTip)) push("analogy", Object.assign({ key: "a:" + l.id }, base));
      if (x && x.check && x.check.length) push("check", Object.assign({ key: "q:" + l.id }, base));
      if (li === 0 && explainer) push("explainer", { key: "explainer", data: explainer });
      at(l.id).forEach(pushCast);
      (slots[li] || []).forEach(pushCast);
    });
    at("end").forEach(pushCast);
    if (m.quiz && m.quiz.length) push("decisions", { key: "decisions" });
    push("closer", { key: "closer" });
    at("post").forEach(pushCast);
    out.forEach(function (s, i) { s.i = i; });
    return out;
  }

  /* ============================================================
     CORE SCENES
     ============================================================ */
  J.registerScene("opener", {
    label: function () { return "Chapter opening"; },
    render: function (el, sc) {
      var m = sc.m, L = learnOf(m), mins = m.lessons.reduce(function (a, l) { return a + minutes(m, l); }, 0);
      var weight = (m.examWeight || "").split(/(?<=\.)\s/)[0];
      el.innerHTML =
        '<div class="num rv">' + pad2(sc.ci + 1) + "</div>" +
        '<div class="eyebrow rv"><span>Chapter ' + (sc.ci + 1) + '</span><span class="dim">' + esc(actOf(m)) + "</span></div>" +
        '<h1 class="rv">' + esc(m.title) + "</h1>" +
        '<p class="lead rv">' + (L && L.bigPicture ? L.bigPicture : esc(m.description || "")) + "</p>" +
        '<div class="facts rv"><span class="fact-pill"><b>' + m.lessons.length + "</b> lessons</span><span class=\"fact-pill\"><b>" + mins + "</b> min</span>" +
        (m.quiz ? '<span class="fact-pill"><b>' + m.quiz.length + "</b> decisions</span>" : "") +
        (ST.S.quizBest[m.id] ? '<span class="fact-pill">best <b>' + ST.S.quizBest[m.id] + "%</b></span>" : "") + "</div>" +
        (weight ? '<p class="rv" style="margin-top:18px;font-size:13.5px;color:var(--ink-dim);max-width:52ch">' + esc(weight) + "</p>" : "") +
        
        (sc.ci > 0 ? '<button class="backlink rv">← back to ' + esc(MODULES[sc.ci - 1].title) + "</button>" : "");
      var b = el.querySelector(".backlink");
      if (b) b.onclick = function () { goTo(sc.ci - 1, "closer"); };
      el.parentNode.style.setProperty("--dom", colorOf(m.id));
    }
  });

  J.registerScene("idea", {
    label: function (sc) { return "Lesson " + (sc.li + 1) + "/" + sc.m.lessons.length + " · " + sc.l.title; },
    render: function (el, sc) {
      var m = sc.m, l = sc.l, x = sc.x, done = !!ST.S.lessons[ST.lessonKey(m, l)];
      var bullets = x && x.tldr ? x.tldr : [];
      if (!bullets.length) { var d = document.createElement("div"); d.innerHTML = l.html; var p = d.querySelector("p"); if (p) bullets = [p.innerHTML]; }
      el.innerHTML =
        '<div class="eyebrow rv"><span>Lesson ' + (sc.li + 1) + " of " + m.lessons.length + '</span><span class="dim">' + minutes(m, l) + " min" + (done ? " · ✓ learned" : "") + "</span></div>" +
        '<h2 class="rv">' + esc(l.title) + "</h2>" +
        '<ul class="tldr rv">' + bullets.map(function (b) { return "<li>" + b + "</li>"; }).join("") + "</ul>" +
        '<div class="row-btns rv"><button class="btn sm deeper">Read the full lesson</button></div>';
      el.querySelector(".deeper").onclick = function () { openReader(l.title, l.html, m.title + " · Lesson " + (sc.li + 1)); };
      // stagger bullets after the scene goes live
      var lis = el.querySelectorAll(".tldr li");
      lis.forEach(function (li, i) { li.style.transition = "opacity .6s var(--ease-out) " + (0.25 + i * 0.12) + "s, transform .7s var(--ease-out) " + (0.25 + i * 0.12) + "s"; li.classList.add("rv"); });
    }
  });

  J.registerScene("analogy", {
    label: function (sc) { return "Lesson " + (sc.li + 1) + " · think of it like"; },
    render: function (el, sc) {
      var x = sc.x;
      el.innerHTML =
        '<div class="eyebrow rv">Think of it like</div>' +
        (x.analogy ? '<div class="quote rv">' + x.analogy + "</div>" : "") +
        (x.examTip ? '<div class="tip rv"><span class="k">Exam tip</span>' + x.examTip + "</div>" : "") +
        (x.terms && x.terms.length ? '<div class="terms rv">' + x.terms.map(function (t, i) { return '<button class="chip" data-i="' + i + '">' + esc(t.t) + "</button>"; }).join("") + "</div>" : "");
      el.querySelectorAll(".terms .chip").forEach(function (b) {
        b.onclick = function () { var t = x.terms[+b.dataset.i]; LABK.sheet('<div class="eyebrow">Key term</div><h3>' + esc(t.t) + "</h3><p>" + t.d + "</p>"); };
      });
    }
  });

  /* question block used by quick checks and decisions */
  function questionBlock(q, onAnswer, opts) {
    opts = opts || {};
    var answers = [].concat(q.answer), multi = !!q.multi;
    var wrap = h('<div><div class="q"></div><div class="opts"></div></div>');
    wrap.querySelector(".q").textContent = q.q;
    var box = wrap.querySelector(".opts"), picked = [];
    q.options.forEach(function (o, i) {
      var b = h('<button class="opt"><span class="l">' + "ABCDEFGH"[i] + "</span><span></span></button>");
      b.lastChild.textContent = o;
      b.onclick = function () {
        if (box.classList.contains("locked")) return;
        LABK.haptic("tap"); LABK.sound.play("tick");
        if (multi) {
          var k = picked.indexOf(i); if (k >= 0) picked.splice(k, 1); else picked.push(i);
          b.classList.toggle("pick", picked.indexOf(i) >= 0);
          lock.disabled = picked.length !== answers.length;
          return;
        }
        picked = [i]; reveal();
      };
      box.appendChild(b);
    });
    var lock = null;
    if (multi) {
      lock = h('<button class="btn sm primary" disabled style="margin-top:12px">Lock in ' + answers.length + " answers</button>");
      lock.onclick = reveal; wrap.appendChild(lock);
    }
    function reveal() {
      box.classList.add("locked"); if (lock) lock.remove();
      var right = picked.length === answers.length && picked.every(function (p) { return answers.indexOf(p) >= 0; });
      [].forEach.call(box.children, function (b, i) {
        b.classList.remove("pick");
        if (answers.indexOf(i) >= 0) b.classList.add("right");
        else if (picked.indexOf(i) >= 0) b.classList.add("wrong");
        else b.classList.add("fade");
      });
      if (!right) box.classList.add("shake");
      var why = q.why || q.explanation || "";
      wrap.appendChild(h('<div class="why ' + (right ? "ok" : "bad") + '"><b class="v">' + (right ? "Right." : "Not quite.") + "</b>" + why + "</div>"));
      LABK.haptic(right ? "ok" : "bad"); LABK.sound.play(right ? "ok" : "bad");
      onAnswer(right, picked.slice());
    }
    if (opts.preset != null) { picked = [].concat(opts.preset); setTimeout(reveal, 0); }
    return wrap;
  }
  J.questionBlock = questionBlock;

  J.registerScene("check", {
    label: function (sc) { return "Lesson " + (sc.li + 1) + " · quick check"; },
    render: function (el, sc) {
      var m = sc.m, l = sc.l, x = sc.x, key = ST.lessonKey(m, l);
      el.innerHTML = '<div class="eyebrow rv"><span>Quick check</span><span class="dim">' + esc(l.title) + '</span></div><div class="qs" style="display:grid;gap:34px"></div>';
      var qs = el.querySelector(".qs");
      var st = ST.S.checks[key] || {};
      x.check.forEach(function (c, qi) {
        var q = { q: c.q, options: c.options, answer: [c.answer], why: c.why };
        var blk = questionBlock(q, function (right, picked) {
          st[qi] = picked[0]; ST.S.checks[key] = st;
          if (Object.keys(st).length === x.check.length) markLesson(m, l);
          ST.save();
        }, { preset: st[qi] });
        blk.classList.add("rv"); qs.appendChild(blk);
      });
    }
  });

  J.registerScene("explainer", {
    label: function (sc) { return "Intuition · " + sc.data.title; },
    render: function (el, sc) {
      var x = sc.data, lv = 0;
      el.innerHTML = '<div class="eyebrow rv">Build the intuition</div><h2 class="rv">' + esc(x.title) + '</h2><div class="chips rv lv"></div><div class="rv body" style="margin-top:16px"></div><div class="row-btns rv" style="margin-top:16px"><button class="btn sm primary nx">Go one level deeper</button></div>';
      var chips = el.querySelector(".lv"), body = el.querySelector(".body"), nx = el.querySelector(".nx");
      x.levels.forEach(function (L, i) { var c = h('<button class="chip">' + (i + 1) + " · " + esc(L.name) + "</button>"); c.onclick = function () { show(i); }; chips.appendChild(c); });
      function show(i) {
        lv = i; [].forEach.call(chips.children, function (c, k) { c.classList.toggle("on", k === i); });
        body.innerHTML = ""; var p = prose(x.levels[i].html); p.classList.add("popin"); body.appendChild(p);
        nx.style.display = i < x.levels.length - 1 ? "" : "none"; LABK.haptic("tick");
      }
      nx.onclick = function () { show(Math.min(lv + 1, x.levels.length - 1)); };
      show(0);
    }
  });

  J.registerScene("decisions", {
    label: function (sc) { return "Decisions · " + sc.m.quiz.length + " scenarios"; },
    render: function (el, sc) {
      var m = sc.m, qs = m.quiz, i = 0, right = 0, results = [];
      el.parentNode.classList.add("tall");
      function frame() {
        el.innerHTML =
          '<div class="eyebrow rv"><span>Decisions</span><span class="dim">' + esc(m.title) + "</span></div>" +
          '<div class="qhead rv"><h2>' + (i < qs.length ? "Scenario " + (i + 1) + " of " + qs.length : "Your call, scored") + '</h2><span class="score">' + right + "/" + results.length + "</span></div>" +
          '<div class="qcount rv">' + qs.map(function (_, k) { return "<i class=\"" + (k < results.length ? (results[k] ? "ok" : "bad") : k === i ? "on" : "") + "\"></i>"; }).join("") + "</div>" +
          '<div class="slot rv"></div>';
        var slot = el.querySelector(".slot");
        if (i < qs.length) {
          var blk = questionBlock(qs[i], function (ok) {
            results.push(ok); if (ok) right++;
            el.querySelector(".score").textContent = right + "/" + results.length;
            el.querySelectorAll(".qcount i")[i].className = ok ? "ok" : "bad";
            var nb = h('<button class="btn primary" style="margin-top:16px">' + (i < qs.length - 1 ? "Next scenario" : "See your score") + "</button>");
            nb.onclick = function () { i++; frame(); el.parentNode.scrollTop = 0; if (i === qs.length) finish(); };
            blk.appendChild(nb);
          });
          slot.appendChild(blk);
        }
      }
      function finish() {
        var pct = Math.round(right / qs.length * 100), S = ST.S;
        if (pct > (S.quizBest[m.id] || 0)) S.quizBest[m.id] = pct;
        (S.quizAttempts[m.id] = S.quizAttempts[m.id] || []).push({ date: new Date().toISOString(), pct: pct });
        ST.save();
        var slot = el.querySelector(".slot");
        slot.innerHTML = '<div class="stat" style="margin:8px 0 14px"><span class="k">This run</span><span class="v ' + (pct >= 72 ? "ok" : "warn") + '" style="font-size:44px">' + pct + '%</span></div>' +
          '<p class="lead">' + (pct >= 72 ? "Above the pass line. The decisions you missed are worth one more look." : "Below the 72% pass line. The chapter is still here: fly back to the lessons behind the misses, then try again.") + "</p>" +
          '<div class="row-btns" style="margin-top:16px"><button class="btn again">Run the decisions again</button></div>';
        slot.querySelector(".again").onclick = function () { i = 0; right = 0; results = []; frame(); };
        LABK.haptic(pct >= 72 ? "ok" : "tap"); LABK.sound.play(pct >= 72 ? "ok" : "tap");
      }
      frame();
    }
  });

  J.registerScene("closer", {
    label: function () { return "Chapter complete"; },
    render: function (el, sc) {
      var m = sc.m, L = learnOf(m), S = ST.S;
      var done = m.lessons.filter(function (l) { return S.lessons[ST.lessonKey(m, l)]; }).length;
      var next = MODULES[sc.ci + 1];
      var cheats = (L && L.cheatsheet) || [];
      el.parentNode.classList.add("tall");
      el.innerHTML =
        '<svg class="ring-big rv" viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" cx="60" cy="60" r="52" stroke-dasharray="326.7" stroke-dashoffset="326.7"/>' +
        '<text x="60" y="66" text-anchor="middle" fill="#eef1f6" font-family="JetBrains Mono, monospace" font-size="20" font-weight="600">' + done + "/" + m.lessons.length + "</text></svg>" +
        '<div class="eyebrow rv"><span>Chapter ' + (sc.ci + 1) + " complete</span></div>" +
        '<h2 class="rv">' + esc(m.title) + ', in your pocket.</h2>' +
        (cheats.length ? '<p class="lead rv" style="margin-bottom:12px">Your field card. The exam gives you the clue; tap it for the answer.</p><div class="fieldcard rv"></div>' : "") +
        '<div class="row-btns rv" style="margin-bottom:18px">' + (m.lab ? '<button class="btn sm lab">Hands-on lab in real AWS</button>' : "") + "</div>" +
        (next ? '<button class="nextcard rv"><div class="t"><span>Next station · Chapter ' + (sc.ci + 2) + "</span><b>" + esc(next.title) + '</b></div><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>'
          : '<p class="lead rv">That was the last station. The whole journey stays open: tap the orb to fly anywhere.</p>');
      var fc = el.querySelector(".fieldcard");
      if (fc) cheats.forEach(function (c) {
        var b = h('<button class="fc"><span class="q2"></span><span class="a"></span></button>');
        b.querySelector(".q2").textContent = c.k; b.querySelector(".a").innerHTML = c.v;
        b.onclick = function () { b.classList.toggle("open"); LABK.haptic("tick"); LABK.sound.play("tick"); };
        fc.appendChild(b);
      });
      var lb = el.querySelector(".lab"); if (lb) lb.onclick = function () { openReader(m.lab.title, m.lab.html, "Hands-on · real AWS · run the teardown at the end"); };
      var nc = el.querySelector(".nextcard"); if (nc) nc.onclick = function () { goTo(sc.ci + 1, "opener"); };
      return {
        enter: function () {
          var d2 = m.lessons.filter(function (l) { return ST.S.lessons[ST.lessonKey(m, l)]; }).length;
          el.querySelector("text").textContent = d2 + "/" + m.lessons.length;
          el.querySelector(".fg").style.strokeDashoffset = 326.7 * (1 - d2 / m.lessons.length);
          if (d2 === m.lessons.length && !S.journey.seen["closed:" + m.id]) { S.journey.seen["closed:" + m.id] = 1; ST.save(true); LABK.haptic("ok"); LABK.sound.play("ok"); }
        }
      };
    }
  });

  J.registerScene("__missing", {
    render: function (el, sc) {
      el.innerHTML = '<div class="sc-frame" style="padding:20px"><div class="eyebrow">Interactive</div><h3>' + esc(sc.type) + "</h3><p class=\"dim\">This scene type is not loaded.</p></div>";
    }
  });

  /* ============================================================
     LESSON COMPLETION — you learn a lesson by travelling through it
     ============================================================ */
  function markLesson(m, l) {
    var k = ST.lessonKey(m, l);
    if (ST.S.lessons[k]) return;
    ST.S.lessons[k] = Date.now(); ST.save();
    updateOrb(true);
    toast("<b style=\"color:var(--ok)\">Learned</b> · " + esc(l.title));
  }
  J.markLesson = markLesson;

  /* ============================================================
     THE WORLD — stations on a winding route through the cloud
     ============================================================ */
  var stations = MODULES.map(function (m, i) {
    var gap = m.track === "sap" && MODULES[i - 1] && MODULES[i - 1].track === "saa" ? 1.6 : 1;
    return { m: m, i: i, gap: gap };
  });
  (function layout() {
    var y = 0;
    stations.forEach(function (s, i) {
      y += i ? 300 * s.gap : 0;
      s.x = Math.sin(i * 0.82) * 120 + Math.sin(i * 0.29 + 1) * 70;
      s.y = y; s.c = colorOf(s.m.id);
    });
  })();
  var worldCv, wctx, W = 0, H = 0, DPR = 1, stars = null;
  var cam = { x: LABK.spring(0, { stiffness: 70, damping: 17 }), y: LABK.spring(0, { stiffness: 70, damping: 17 }), z: LABK.spring(1, { stiffness: 70, damping: 17 }), xs: LABK.spring(0.15, { stiffness: 70, damping: 17 }), sx: LABK.spring(0.9, { stiffness: 70, damping: 17 }) };
  var atlas = false, curCi = 0, curProg = 0, tNow = 0;
  var glints = [];
  function fitWorld() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    worldCv.width = Math.round(W * DPR); worldCv.height = Math.round(H * DPR);
    wctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // star tile, drawn once
    stars = document.createElement("canvas"); stars.width = 512 * DPR; stars.height = 512 * DPR;
    var g = stars.getContext("2d"); g.scale(DPR, DPR);
    var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 160; i++) { var a = rnd(); g.fillStyle = "rgba(255,255,255," + (0.08 + a * 0.4) + ")"; g.beginPath(); g.arc(rnd() * 512, rnd() * 512, a < 0.92 ? 0.6 : 1.2, 0, Math.PI * 2); g.fill(); }
  }
  function toScreen(x, y) { var z = cam.z.value; return { x: (x * cam.xs.value - cam.x.value) * z + W * cam.sx.value, y: (y - cam.y.value) * z + H * (atlas ? 0.5 : 0.36) }; }
  function stationState(s) { var p = ST.modulePct(s.m); return p >= 1 ? 2 : p > 0 ? 1 : 0; }
  function curvePts(a, b) { var my = (a.y + b.y) / 2; return [a.x, a.y, a.x, my, b.x, my, b.x, b.y]; }
  function bez(p, t) {
    var u = 1 - t;
    return { x: u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6], y: u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7] };
  }
  function drawWorld(dt) {
    tNow += dt;
    cam.x.step(dt); cam.y.step(dt); cam.z.step(dt); cam.xs.step(dt); cam.sx.step(dt);
    var g = wctx, z = cam.z.value;
    g.clearRect(0, 0, W, H);
    // stars, two parallax layers
    [0.15, 0.4].forEach(function (par, li) {
      var ox = -((cam.x.value * par * z) % 512) - 512, oy = -((cam.y.value * par * z) % 512) - 512;
      g.globalAlpha = li ? 0.9 : 0.5;
      for (var x = ox; x < W; x += 512) for (var y = oy; y < H; y += 512) g.drawImage(stars, x, y, 512, 512);
    });
    g.globalAlpha = 1;
    // route
    for (var i = 0; i < stations.length - 1; i++) {
      var a = stations[i], b = stations[i + 1];
      var sa = toScreen(a.x, a.y), sb = toScreen(b.x, b.y);
      if (Math.max(sa.y, sb.y) < -60 || Math.min(sa.y, sb.y) > H + 60) continue;
      var p = curvePts(sa, sb);
      var lit = stationState(a) === 2 || i < curCi;
      g.beginPath(); g.moveTo(p[0], p[1]); g.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]);
      g.strokeStyle = lit ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.08)"; g.lineWidth = lit ? 1.6 : 1;
      g.setLineDash(lit ? [] : [3, 6]); g.stroke(); g.setLineDash([]);
      if (lit && !LABK.reducedMotion) {
        var t = ((tNow * 0.18 + i * 0.37) % 1);
        var q = bez(p, t); g.fillStyle = a.c; g.globalAlpha = 0.9; g.beginPath(); g.arc(q.x, q.y, 2, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      }
      if (atlas && b.m.track === "sap" && a.m.track === "saa") {
        var mid = toScreen((a.x + b.x) / 2, (a.y + b.y) / 2);
        g.font = "600 " + Math.max(10, 11 * Math.min(1.2, z * 1.6)) + "px JetBrains Mono, monospace"; g.textAlign = "center"; g.fillStyle = "rgba(255,255,255,0.45)";
        g.fillText("ACT II · PROFESSIONAL", mid.x, mid.y);
      }
    }
    // stations
    stations.forEach(function (s) {
      var p = toScreen(s.x, s.y);
      if (p.y < -80 || p.y > H + 80) return;
      var st = stationState(s), here = s.i === curCi, rail = !atlas && W <= 900, r = rail ? (here ? 5 : 3.5) : (here ? 13 : 9) * Math.max(0.7, Math.min(1.25, z));
      if (st === 2 || here) {
        var grd = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4.5);
        grd.addColorStop(0, s.c + (here ? "66" : "40")); grd.addColorStop(1, s.c + "00");
        g.fillStyle = grd; g.beginPath(); g.arc(p.x, p.y, r * 4.5, 0, Math.PI * 2); g.fill();
      }
      g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2);
      if (st === 2) { g.fillStyle = s.c; g.fill(); }
      else if (st === 1) {
        g.fillStyle = "rgba(11,14,20,0.9)"; g.fill();
        var pct = ST.modulePct(s.m);
        g.beginPath(); g.moveTo(p.x, p.y); g.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2); g.closePath(); g.fillStyle = s.c; g.fill();
      } else { g.fillStyle = "rgba(11,14,20,0.9)"; g.fill(); }
      g.strokeStyle = st ? s.c : "rgba(255,255,255,0.3)"; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.stroke();
      if (here && !LABK.reducedMotion) {
        var k = (tNow * 0.7) % 1; g.strokeStyle = s.c; g.globalAlpha = 1 - k; g.beginPath(); g.arc(p.x, p.y, r + 4 + k * 22, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
      }
      // labels: always in atlas; in the reel only for the neighbours (they peek behind the content)
      if (atlas && cam.xs.value > 0.6) {
        var left = p.x > W * 0.55;
        g.font = (here ? "600 " : "500 ") + (atlas ? 13 : 12) + "px Sora, Inter, sans-serif";
        g.textAlign = left ? "right" : "left"; g.textBaseline = "middle";
        g.fillStyle = atlas ? (st || here ? "#eef1f6" : "rgba(238,241,246,0.55)") : "rgba(238,241,246,0.35)";
        var tx = p.x + (left ? -1 : 1) * (r + 12);
        g.fillText(s.m.title, tx, p.y - (atlas ? 7 : 0));
        if (atlas) {
          g.font = "500 10.5px JetBrains Mono, monospace"; g.fillStyle = "rgba(125,134,148,0.95)";
          var dn = s.m.lessons.filter(function (l) { return ST.S.lessons[ST.lessonKey(s.m, l)]; }).length;
          g.fillText(pad2(s.i + 1) + " · " + dn + "/" + s.m.lessons.length + (ST.S.quizBest[s.m.id] ? " · " + ST.S.quizBest[s.m.id] + "%" : ""), tx, p.y + 9);
        }
      }
    });
  }
  function aimCamera() {
    if (atlas) return;
    var s = stations[curCi], n = stations[curCi + 1] || s;
    var t = LABK.clamp(curProg, 0, 1) * 0.85;
    cam.xs.set(W > 900 ? 0.35 : 0); cam.sx.set(W > 900 ? 0.86 : (W - 9) / W);
    cam.x.set(LABK.lerp(s.x, n.x, t) * cam.xs.target);
    cam.y.set(LABK.lerp(s.y, n.y, t));
    cam.z.set(W > 900 ? 0.9 : 0.62);
  }

  /* ---------- atlas: zoom out, pan the whole route, tap a station ---------- */
  function openAtlas() {
    if (atlas) return closeAtlas();
    atlas = true; document.body.classList.add("atlas");
    var s = stations[curCi];
    cam.z.set(W > 900 ? 0.5 : 0.42); cam.xs.set(1); cam.sx.set(0.5); cam.x.set(0); cam.y.set(s.y);
    LABK.haptic("tap"); LABK.sound.play("whoosh");
    renderAtlasUI();
  }
  function closeAtlas() {
    atlas = false; document.body.classList.remove("atlas"); LABK.closeSheet(); aimCamera();
  }
  function renderAtlasUI() {
    var dn = doneLessons(), tot = totalLessons();
    var a = document.getElementById("atlasui");
    a.querySelector(".bar b").textContent = "Your journey";
    a.querySelector(".bar span").textContent = dn + " of " + tot + " lessons learned · tap a station to fly there";
    var foot = a.querySelector(".foot"); foot.innerHTML = "";
    var due = ST.dueCards(null).length;
    var b1 = h('<button class="btn sm">Back to ' + esc(MODULES[curCi].title) + "</button>"); b1.onclick = closeAtlas; foot.appendChild(b1);
    if (due && J.types.echo) { var b2 = h('<button class="btn sm">Echoes · ' + due + " due</button>"); b2.onclick = function () { closeAtlas(); playEcho(); }; foot.appendChild(b2); }
    var b3 = h('<button class="btn sm ghost">Settings</button>'); b3.onclick = settingsSheet; foot.appendChild(b3);
  }
  function stationSheet(s) {
    var m = s.m, S = ST.S, pct = ST.modulePct(m);
    var rows = m.lessons.map(function (l, li) {
      var d = !!S.lessons[ST.lessonKey(m, l)];
      return '<button data-l="' + esc(l.id) + '" class="' + (d ? "done" : "") + '"><i>' + (d ? "✓" : "") + "</i><span>" + (li + 1) + ". " + esc(l.title) + "</span></button>";
    }).join("");
    var el = LABK.sheet(
      '<div class="eyebrow">Chapter ' + (s.i + 1) + " · " + esc(actOf(m)) + "</div><h3>" + esc(m.title) + "</h3>" +
      '<div class="bar2"><i style="width:' + Math.round(pct * 100) + '%"></i></div><p style="font-size:13px;color:var(--ink-dim)">' + Math.round(pct * 100) + "% learned" + (S.quizBest[m.id] ? " · decisions best " + S.quizBest[m.id] + "%" : "") + "</p>" +
      '<div class="lessons">' + rows + "</div>" +
      '<button class="btn primary go">' + (pct > 0 && pct < 1 ? "Continue this chapter" : pct >= 1 ? "Fly back to the beginning" : "Fly here") + "</button>" +
      (m.quiz ? '<button class="btn dec">Go to the decisions</button>' : "") + '<button class="btn ghost fc">Field card</button>');
    el.querySelectorAll(".lessons button").forEach(function (b) { b.onclick = function () { closeAtlas(); goTo(s.i, "l:" + b.dataset.l); }; });
    el.querySelector(".go").onclick = function () {
      closeAtlas();
      var firstOpen = m.lessons.find(function (l) { return !S.lessons[ST.lessonKey(m, l)]; });
      goTo(s.i, pct > 0 && pct < 1 && firstOpen ? "l:" + firstOpen.id : "opener");
    };
    var dec = el.querySelector(".dec"); if (dec) dec.onclick = function () { closeAtlas(); goTo(s.i, "decisions"); };
    el.querySelector(".fc").onclick = function () { closeAtlas(); goTo(s.i, "closer"); };
  }
  function settingsSheet() {
    var u = ST.user;
    var el = LABK.sheet('<div class="eyebrow">Settings</div><h3>Your progress</h3>' +
      '<p>' + (ST.native ? "Saved on this phone in an on-device database." : "Saved in this browser" + (ST.hasCloud ? " and synced live across devices when you sign in." : ".")) + "</p>" +
      (ST.hasCloud ? (u ? '<p style="font-size:13px;color:var(--ink-dim)">Signed in as ' + esc(u.displayName || u.email || "you") + " · " + esc(ST.syncState) + '</p><button class="btn so">Sign out</button>' : '<button class="btn primary si">Sign in with Google to sync</button>') : "") +
      '<button class="btn snd">UI sound: ' + (LABK.sound.enabled() ? "on" : "off") + "</button>" +
      (ST.native ? '<button class="btn ex">Export database file</button>' : "") +
      '<button class="btn ghost rs" style="color:var(--bad)">Reset all progress</button>');
    var si = el.querySelector(".si"); if (si) si.onclick = function () { si.textContent = "Opening Google…"; ST.signIn().then(function () { toast("Signed in. Progress syncs live."); settingsSheet(); }).catch(function (e) { toast("Sign-in failed: " + esc(e.message)); }); };
    var so = el.querySelector(".so"); if (so) so.onclick = function () { ST.signOut().then(settingsSheet); };
    el.querySelector(".snd").onclick = function () { LABK.sound.toggle(); settingsSheet(); };
    var ex = el.querySelector(".ex"); if (ex) ex.onclick = function () { ST.flushNative(); ST.native.exportDb(); };
    el.querySelector(".rs").onclick = function () { if (confirm("Wipe ALL progress? This cannot be undone.")) { ST.reset(); LABK.closeSheet(); closeAtlas(); goTo(0, "opener"); } };
  }

  /* ============================================================
     THE REEL — the current chapter as a scroll of scenes
     ============================================================ */
  var reel, scenes = [], sceneEls = [], ctrls = [], live = -1, visited = {}, dwellT = 0;
  function ctxFor(sc) {
    return { m: sc.m, l: sc.l, x: sc.x, data: sc.data, store: ST, save: ST.save, markLesson: markLesson, openReader: openReader, toast: toast, next: function () { advance(1); }, jump: function (key) { showScene(indexOfKey(key)); }, goTo: goTo, colorOf: colorOf, prose: prose, questionBlock: questionBlock };
  }
  function renderScene(i) {
    if (!sceneEls[i] || sceneEls[i].dataset.r) return;
    sceneEls[i].dataset.r = "1";
    var sc = scenes[i], def = J.types[sc.type] || J.types.__missing;
    var inner = sceneEls[i].querySelector(".sc");
    try { ctrls[i] = def.render(inner, sc, ctxFor(sc)) || null; }
    catch (e) { console.error("scene " + sc.type + " failed", e); inner.innerHTML = '<div class="sc-frame" style="padding:20px"><p class="dim">This scene failed to load: ' + esc(e.message) + "</p></div>"; }
  }
  function buildReel(ci) {
    ctrls.forEach(function (c) { if (c && c.destroy) try { c.destroy(); } catch (e) {} });
    curCi = ci; scenes = buildChapter(ci); ctrls = []; live = -1; visited = {};
    if (pendingEcho && J.types.echo) { scenes.unshift({ type: "echo", key: "echo", m: MODULES[ci], ci: ci, data: { then: pendingEcho === true ? "opener" : pendingEcho } }); scenes.forEach(function (s, i) { s.i = i; }); pendingEcho = false; }
    reel.innerHTML = "";
    sceneEls = scenes.map(function (sc) {
      var s = document.createElement("section");
      s.className = "scene scene-" + sc.type + (J.types[sc.type] && J.types[sc.type].wide ? " wide" : "");
      s.dataset.key = sc.key;
      s.appendChild(h('<div class="sc"></div>'));
      reel.appendChild(s); return s;
    });
    sceneEls.forEach(function (s, i) { s.dataset.i = i; });
  }
  function indexOfKey(key) { for (var i = 0; i < scenes.length; i++) if (scenes[i].key === key) return i; return 0; }
  /* one scene on screen at a time; you move with the buttons */
  function showScene(i, dir) {
    if (!scenes.length) return;
    i = LABK.clamp(i, 0, scenes.length - 1);
    if (dir == null) dir = live < 0 ? 0 : i > live ? 1 : i < live ? -1 : 0;
    for (var k = Math.max(0, i - 1); k <= Math.min(scenes.length - 1, i + 1); k++) renderScene(k);
    var prevEl = live >= 0 ? sceneEls[live] : null, el = sceneEls[i];
    if (prevEl && prevEl !== el) {
      prevEl.classList.remove("on", "from-up", "from-down");
      prevEl.classList.add(dir >= 0 ? "out-up" : "out-down");
      (function (p) { setTimeout(function () { p.classList.remove("out-up", "out-down"); }, 520); })(prevEl);
    }
    el.classList.remove("out-up", "out-down", "from-up", "from-down");
    if (dir) { el.classList.add(dir > 0 ? "from-down" : "from-up"); void el.offsetWidth; }
    el.scrollTop = 0;
    el.classList.add("on");
    requestAnimationFrame(function () { el.classList.remove("from-up", "from-down"); });
    curProg = scenes.length > 1 ? i / (scenes.length - 1) : 0;
    aimCamera();
    document.querySelector("#prog i").style.width = ((i + 1) / scenes.length * 100).toFixed(1) + "%";
    if (i !== live) setLive(i);
    updateNav();
  }
  function advance(d) {
    if (flying || !scenes.length) return;
    var n = live + d;
    if (n >= scenes.length) { if (curCi < MODULES.length - 1) goTo(curCi + 1, "opener"); return; }
    if (n < 0) { if (curCi > 0) goTo(curCi - 1, "closer", { back: true }); return; }
    LABK.sound.play(d > 0 ? "tap" : "tick");
    showScene(n, d);
  }
  J.advance = advance;
  var NEXTWORD = { idea: "Next lesson", analogy: "Think of it like", check: "Quick check", explainer: "Build the intuition", diagram: "See it live", widget: "Try the simulator",
    decisions: "To the decisions", closer: "Finish the chapter", "board-vpc": "Watch it run", "sandbox-s3": "Open the sandbox", "story-s3": "See the figure", queue: "Run the simulation",
    architect: "Solve the puzzle", echo: "Echoes", reflex: "Reflex round", trial: "The trial", mission: "Field mission" };
  function nextLabel() {
    var sc = scenes[live], nx = scenes[live + 1];
    if (!nx) return MODULES[curCi + 1] ? "Fly to " + MODULES[curCi + 1].title : "End of the journey";
    if (sc.type === "opener") return "Begin";
    if (nx.type === "idea") return "Lesson " + (nx.li + 1) + " of " + nx.m.lessons.length;
    return NEXTWORD[nx.type] || "Continue";
  }
  function updateNav() {
    var nav = document.getElementById("nav"); if (!nav) return;
    var nb = nav.querySelector(".nx"), bb = nav.querySelector(".bk");
    nb.querySelector("span").textContent = nextLabel();
    nb.classList.toggle("fly", live === scenes.length - 1);
    nb.disabled = live === scenes.length - 1 && curCi === MODULES.length - 1;
    bb.disabled = live === 0 && curCi === 0;
    nav.querySelector(".pos").textContent = (live + 1) + " / " + scenes.length;
  }
  function setLive(idx) {
    var prev = live; live = idx;
    if (prev >= 0 && sceneEls[prev]) { sceneEls[prev].classList.remove("live"); sceneEls[prev].classList.add("seen"); var pc = ctrls[prev]; if (pc && pc.leave) try { pc.leave(); } catch (e) {} }
    renderScene(idx); if (idx + 1 < scenes.length) renderScene(idx + 1);
    var el = sceneEls[idx]; el.classList.add("live");
    var sc = scenes[idx], def = J.types[sc.type] || {};
    var where = document.getElementById("where");
    where.querySelector("b").textContent = pad2(curCi + 1) + " · " + sc.m.title;
    where.querySelector("span").textContent = sc.label || (def.label ? def.label(sc) : sc.type);
    // dwell → visited; passing a fully visited lesson marks it learned
    clearTimeout(dwellT);
    dwellT = setTimeout(function () { visited[sc.key] = true; }, 900);
    scenes.forEach(function (s, i) {
      if (i >= idx || !s.l) return;
      var lastOfLesson = !scenes[i + 1] || scenes[i + 1].l !== s.l;
      if (!lastOfLesson) return;
      var all = scenes.filter(function (t) { return t.l === s.l && t.type !== "check"; }).every(function (t) { return visited[t.key]; });
      if (all) markLesson(s.m, s.l);
    });
    // remember where we are (resume + deep link)
    ST.S.journey.at = { c: sc.m.id, s: sc.key, t: Date.now() };
    ST.S.resume = { hash: "#/module/" + sc.m.id + (sc.l ? "/lesson/" + sc.l.id : ""), title: sc.m.title, at: Date.now() };
    saveSoon();
    history.replaceState(null, "", "#/" + sc.m.id + "/" + encodeURIComponent(sc.key));
    if (idx > prev && prev >= 0) LABK.haptic("tick");
    var c = ctrls[idx]; if (c && c.enter) try { c.enter(); } catch (e) { console.error(e); }
  }
  var saveT = 0;
  function saveSoon() { clearTimeout(saveT); saveT = setTimeout(function () { ST.save(true); }, 1500); }

  /* ---------- flying between chapters ---------- */
  var flying = false;
  function goTo(ci, key, opts) {
    opts = opts || {};
    ci = LABK.clamp(ci, 0, MODULES.length - 1);
    if (ci === curCi && scenes.length && !opts.rebuild) { showScene(indexOfKey(key || "opener")); return; }
    if (flying) return; flying = true;
    var m = MODULES[ci], tc = document.getElementById("titlecard");
    tc.querySelector(".eyebrow").innerHTML = "<span>Chapter " + (ci + 1) + '</span><span class="dim">' + esc(actOf(m)) + "</span>";
    tc.querySelector("h1").textContent = m.title;
    document.body.classList.add("flying");
    LABK.sound.play("whoosh"); LABK.haptic("pop");
    curCi = ci; curProg = 0;
    var s = stations[ci];
    cam.x.set(s.x * cam.xs.target); cam.y.set(s.y); cam.z.set(W > 900 ? 1.3 : 1.1);
    setTimeout(function () { tc.classList.add("show"); }, opts.instant ? 0 : 380);
    setTimeout(function () {
      buildReel(ci);
      var idx = indexOfKey(key || "opener");
      live = -1; showScene(idx, 0);
    }, opts.instant ? 200 : 900);
    setTimeout(function () {
      tc.classList.remove("show");
      document.body.classList.remove("flying"); flying = false;
      updateOrb(); updateNav();
    }, opts.instant ? 900 : 1900);
  }
  J.goTo = goTo;
  J._debug = { stations: stations, toScreen: function (s) { return toScreen(s.x, s.y); }, cam: cam };

  /* ---------- echoes: spaced review woven into the journey ---------- */
  var pendingEcho = false;
  function playEcho() { pendingEcho = (scenes[live] && scenes[live].key) || "opener"; goTo(curCi, "echo", { rebuild: true }); }

  /* ---------- the orb (overall progress; opens the atlas) ---------- */
  function updateOrb(pulse) {
    var p = doneLessons() / totalLessons();
    var orb = document.getElementById("orb");
    orb.querySelector(".fg").style.strokeDashoffset = (138.2 * (1 - p)).toFixed(1);
    orb.querySelector(".pct").textContent = Math.round(p * 100) + "%";
    if (pulse) { orb.classList.remove("popin"); void orb.offsetWidth; orb.classList.add("popin"); LABK.sound.play("pop"); }
  }

  /* ============================================================
     BOOT
     ============================================================ */
  function shell() {
    document.getElementById("app").innerHTML = "";
    document.body.insertAdjacentHTML("beforeend",
      '<canvas id="world" aria-hidden="true"></canvas><div id="veil"></div>' +
      '<main id="reel" aria-live="polite"></main>' +
      '<div id="hud"><button id="orb" aria-label="Open the journey map"><svg viewBox="0 0 46 46"><circle cx="23" cy="23" r="22" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>' +
      '<circle class="fg" cx="23" cy="23" r="22" fill="none" stroke="#ff8a3d" stroke-width="2" stroke-linecap="round" stroke-dasharray="138.2" stroke-dashoffset="138.2" transform="rotate(-90 23 23)" style="transition:stroke-dashoffset 1s var(--ease-out)"/></svg><span class="pct">0%</span></button>' +
      '<div id="where"><b></b><span></span></div></div>' +
      '<div id="prog"><i></i></div>' +
      '<nav id="nav"><button class="btn bk" aria-label="Back"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<span class="pos mono"></span><button class="btn primary nx"><span>Continue</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></nav>' +
      '<div id="titlecard"><div class="in"><div class="eyebrow"></div><h1></h1></div></div>' +
      '<div id="atlasui"><div class="bar"><b></b><span></span></div><div class="foot"></div></div>' +
      '<div id="reader"><div class="rhead"><b></b><button class="btn sm" id="rclose">Back to the journey</button></div><div class="rbody"></div></div>' +
      '<div id="jtoast"></div>');
    reel = document.getElementById("reel");
    readerEl = document.getElementById("reader");
    document.getElementById("rclose").onclick = closeReader;
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { if (readerEl.classList.contains("show")) closeReader(); else if (atlas) closeAtlas(); return; }
      var tg = e.target, typing = tg && (/INPUT|TEXTAREA|SELECT/.test(tg.tagName) || tg.isContentEditable);
      if (typing || atlas || readerEl.classList.contains("show") || document.body.classList.contains("in-trial")) return;
      if (e.key === "ArrowRight") { e.preventDefault(); advance(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); advance(-1); }
    });
    document.getElementById("orb").onclick = openAtlas;
    document.querySelector("#nav .nx").onclick = function () { LABK.haptic("tap"); advance(1); };
    document.querySelector("#nav .bk").onclick = function () { LABK.haptic("tick"); advance(-1); };
    worldCv = document.getElementById("world"); wctx = worldCv.getContext("2d");
    fitWorld(); window.addEventListener("resize", function () { fitWorld(); aimCamera(); });
    LABK.loop(drawWorld);
    wireAtlasGestures();
    ST.on(function (kind) { if (kind === "remote") { updateOrb(); toast("Progress updated from another device"); } });
  }
  function wireAtlasGestures() {
    var down = null, moved = false, vy = 0, lastY = 0, lastT = 0;
    worldCv.style.touchAction = "none";
    function nearest(px, py) {
      var best = null, bd = 44;
      stations.forEach(function (s) { var p = toScreen(s.x, s.y); var d = Math.hypot(p.x - px, p.y - py); if (d < bd) { bd = d; best = s; } });
      return best;
    }
    // the world canvas sits under the reel; in atlas mode the reel is click-through
    worldCv.addEventListener("pointerdown", function (e) {
      if (!atlas) return; down = { y: e.clientY, x: e.clientX, cy: cam.y.target, cx: cam.x.target }; moved = false; lastY = e.clientY; lastT = performance.now(); vy = 0;
      worldCv.setPointerCapture(e.pointerId);
    });
    worldCv.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dy = e.clientY - down.y, dx = e.clientX - down.x;
      if (Math.hypot(dx, dy) > 6) moved = true;
      if (moved) {
        var z = cam.z.value;
        cam.y.snap(down.cy - dy / z); cam.x.snap(down.cx - dx / z);
        var now = performance.now(); vy = (e.clientY - lastY) / Math.max(1, now - lastT); lastY = e.clientY; lastT = now;
      }
    });
    worldCv.addEventListener("pointerup", function (e) {
      if (!down) return;
      if (!moved) { var s = nearest(e.clientX, e.clientY); if (s) { LABK.haptic("tap"); stationSheet(s); } }
      else { cam.y.set(cam.y.value - vy * 320 / cam.z.value); }
      down = null;
    });
    worldCv.addEventListener("wheel", function (e) { if (!atlas) return; e.preventDefault(); cam.y.set(cam.y.target + e.deltaY / cam.z.value); }, { passive: false });
  }
  function resumeTarget() {
    var hm = (location.hash || "").match(/^#\/([^/]+)\/(.+)$/);
    if (hm) {
      var ci = MODULES.findIndex(function (m) { return m.id === hm[1]; });
      if (ci >= 0) return { ci: ci, key: decodeURIComponent(hm[2]) };
    }
    var at = ST.S.journey.at;
    if (at) { var c2 = MODULES.findIndex(function (m) { return m.id === at.c; }); if (c2 >= 0) return { ci: c2, key: at.s }; }
    // returning learner from the classic course: first unlearned lesson
    var S = ST.S;
    if (Object.keys(S.lessons).length) {
      for (var i = 0; i < MODULES.length; i++) {
        var l = MODULES[i].lessons.find(function (x) { return !S.lessons[ST.lessonKey(MODULES[i], x)]; });
        if (l) return { ci: i, key: "l:" + l.id };
      }
    }
    return { ci: 0, key: "opener" };
  }
  J.start = function () {
    if (!MODULES.length) { document.getElementById("app").textContent = "No course content loaded."; return; }
    ST.loadNative().then(function () {
      shell();
      var t = resumeTarget();
      var due = ST.dueCards(null).length;
      pendingEcho = due >= 3 && !!J.types.echo ? t.key : false;
      var s = stations[t.ci]; cam.y.snap(s.y - 500); cam.z.snap(0.5);
      updateOrb();
      goTo(t.ci, pendingEcho ? "echo" : t.key, {});
      ST.startCloud();
    });
  };
})();
