/* scene: reflex — "Reflex · 60 seconds", speed drills as interludes.
 * Cast after the closer of every 4th SAA chapter and the 3rd SAP chapter.
 * Keyword in, service out: random items from COURSE.drills against a draining
 * time bar. Tap → instant green/red + the one-line why for 1.2 s (clock paused),
 * next. +10 per hit plus 2 x streak; a miss costs 3 s. Best score lives in
 * S.journey.seen["reflex:best"]. */
(function () {
  "use strict";
  var LAB = window.LAB, ST = window.JSTORE, h = LAB.h, esc = LAB.esc;
  var SECONDS = 60, REVEAL_MS = 1200, PENALTY = 3;

  if (!document.getElementById("scene-reflex-css")) {
    var st = document.createElement("style"); st.id = "scene-reflex-css";
    st.textContent = [
      ".scene-reflex .rx-intro{text-align:left}",
      ".scene-reflex .rx-best{display:flex;gap:26px;margin:20px 0 30px}",
      ".scene-reflex .rx-best .k{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-dim)}",
      ".scene-reflex .rx-go{position:relative;width:148px;height:148px;border-radius:50%;display:grid;place-items:center;margin:4px auto 6px;color:#1a0d04;font-family:var(--display);font-weight:700;font-size:20px;letter-spacing:-0.01em;" +
        "background:radial-gradient(circle at 50% 35%,#ffb27a,var(--accent) 62%,#e0661c);box-shadow:0 0 0 1px rgba(255,255,255,0.12) inset,0 18px 60px -12px var(--accent-glow);transition:transform .45s var(--spring)}",
      ".scene-reflex .rx-go:active{transform:scale(.93)}",
      ".scene-reflex .rx-go::before{content:'';position:absolute;inset:-12px;border-radius:50%;border:1px solid var(--accent-glow);animation:rxPulse 2.4s var(--ease-out) infinite}",
      ".scene-reflex .rx-go small{display:block;font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;opacity:.7;margin-top:2px}",
      "@keyframes rxPulse{0%{transform:scale(.92);opacity:.9}100%{transform:scale(1.18);opacity:0}}",
      ".scene-reflex .rx-gocap{text-align:center;font-size:13px;color:var(--ink-dim);margin-top:14px}",
      ".scene-reflex .rx-top{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:10px}",
      ".scene-reflex .rx-score{font-family:var(--mono);font-weight:600;font-size:40px;line-height:1;letter-spacing:-0.03em;font-variant-numeric:tabular-nums;color:var(--ink)}",
      ".scene-reflex .rx-score small{display:block;font-size:10.5px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-dim);margin-bottom:6px}",
      ".scene-reflex .rx-streak{font-family:var(--mono);font-size:12px;color:var(--accent);opacity:0;transform:translateY(6px);transition:opacity .25s,transform .4s var(--spring)}",
      ".scene-reflex .rx-streak.on{opacity:1;transform:none}",
      ".scene-reflex .rx-secs{font-family:var(--mono);font-size:13px;color:var(--ink-2);font-variant-numeric:tabular-nums;text-align:right}",
      ".scene-reflex .rx-secs.low{color:var(--bad)}",
      ".scene-reflex .rx-bar{height:6px;border-radius:3px;background:rgba(255,255,255,0.08);overflow:hidden;margin-bottom:26px}",
      ".scene-reflex .rx-bar i{display:block;height:100%;width:100%;transform-origin:left center;background:linear-gradient(90deg,var(--accent),var(--warn));will-change:transform}",
      ".scene-reflex .rx-bar.low i{background:linear-gradient(90deg,var(--bad),var(--accent))}",
      ".scene-reflex .rx-bar.hit{animation:rxHit .45s var(--ease-out)}",
      "@keyframes rxHit{0%{transform:scaleY(2.2)}100%{transform:none}}",
      ".scene-reflex .rx-q{font-family:var(--display);font-weight:500;font-size:clamp(21px,5.8vw,30px);line-height:1.3;letter-spacing:-0.015em;color:var(--ink);min-height:2.6em;margin-bottom:18px}",
      ".scene-reflex .rx-card{animation:rxIn .42s var(--ease-out) both}",
      "@keyframes rxIn{from{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}",
      ".scene-reflex .rx-opts{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
      ".scene-reflex .rx-opts .opt{min-height:64px;align-items:center;font-size:14.5px;color:var(--ink)}",
      ".scene-reflex .rx-why{min-height:66px;margin-top:14px;font-size:14px;line-height:1.5;color:var(--ink-2);opacity:0;transform:translateY(-4px);transition:opacity .2s,transform .3s var(--ease-out)}",
      ".scene-reflex .rx-why.on{opacity:1;transform:none}",
      ".scene-reflex .rx-why b{font-family:var(--display);margin-right:6px}.scene-reflex .rx-why.ok b{color:var(--ok)}.scene-reflex .rx-why.bad b{color:var(--bad)}",
      ".scene-reflex .rx-end .big{font-family:var(--mono);font-weight:600;font-size:clamp(64px,20vw,96px);line-height:1;letter-spacing:-0.04em;font-variant-numeric:tabular-nums;margin:6px 0 10px}",
      ".scene-reflex .rx-end .big.pb{color:var(--accent);text-shadow:0 0 40px var(--accent-glow)}",
      ".scene-reflex .rx-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0 18px}",
      ".scene-reflex .rx-stats .panel{padding:12px 14px}",
      ".scene-reflex .rx-stats .k{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-dim)}",
      ".scene-reflex .rx-stats .v{font-size:22px}",
      ".scene-reflex .rx-miss{display:grid;gap:8px;margin:6px 0 20px}",
      ".scene-reflex .rx-miss div{padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,0.03);font-size:13.5px;line-height:1.5;color:var(--ink-2)}",
      ".scene-reflex .rx-miss b{color:var(--ink);font-weight:600}.scene-reflex .rx-miss em{font-style:normal;color:var(--ok)}",
      ".scene-reflex .rx-h3{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-dim);margin-top:4px}",
      "@media (max-width:360px){.scene-reflex .rx-opts{grid-template-columns:1fr}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  function best() { return +(ST.S.journey.seen["reflex:best"] || 0); }

  JOURNEY.registerScene("reflex", {
    label: function () { return "Reflex · 60 seconds"; },
    render: function (el, sc, ctx) {
      var pool = (window.COURSE.drills || []).slice();
      var run = null, loop = null, live = false;
      var section = el.parentNode;

      function isLast() { return !section.nextElementSibling; }
      function cont() {
        LAB.haptic("tap");
        if (isLast()) ctx.goTo(sc.ci + 1, "opener"); else ctx.next();
      }

      function intro() {
        stop();
        var b = best();
        el.innerHTML =
          '<div class="eyebrow rv"><span>Reflex · 60 seconds</span><span class="dim">interlude</span></div>' +
          '<h2 class="rv">Keyword in, service out.</h2>' +
          '<p class="lead rv">The exam hides the answer in one phrase: <strong>static IP</strong>, <strong>exactly-once</strong>, <strong>sub-millisecond</strong>. Train the reflex. A hit scores 10 plus a streak bonus; a miss costs 3 seconds and shows you why.</p>' +
          '<div class="rx-best rv"><div class="stat"><span class="k">Your best</span><span class="v ' + (b ? "warn" : "") + '">' + b + '</span></div><div class="stat"><span class="k">Pool</span><span class="v">' + pool.length + "</span></div></div>" +
          '<div class="rv"><button class="rx-go" aria-label="Start the 60 second reflex round"><span>Start<small>60 s</small></span></button><div class="rx-gocap">Optional. Skip it by scrolling on.</div></div>' +
          '<div class="row-btns rv" style="justify-content:center;margin-top:18px"><button class="btn sm ghost skip">Continue without playing</button></div>';
        el.querySelector(".rx-go").onclick = start;
        el.querySelector(".skip").onclick = cont;
      }

      function start() {
        LAB.haptic("pop"); LAB.sound.play("whoosh");
        run = { order: ST.shuffle(pool), k: 0, score: 0, streak: 0, bestStreak: 0, hits: 0, seen: 0, misses: [], left: SECONDS, locked: false, over: false };
        el.innerHTML =
          '<div class="eyebrow"><span>Reflex · 60 seconds</span><span class="dim">keyword → service</span></div>' +
          '<div class="rx-top"><div class="rx-score"><small>Score</small><span class="n">0</span></div><div><div class="rx-streak">streak x2</div><div class="rx-secs">60.0 s</div></div></div>' +
          '<div class="rx-bar"><i></i></div><div class="rx-slot"></div>';
        question();
        if (live) tickStart();
      }
      function question() {
        var d = run.order[run.k % run.order.length];
        var slot = el.querySelector(".rx-slot");
        slot.innerHTML = "";
        var card = h('<div class="rx-card"><div class="rx-q"></div><div class="rx-opts"></div><div class="rx-why"></div></div>');
        card.querySelector(".rx-q").textContent = d.q;
        var box = card.querySelector(".rx-opts");
        d.options.forEach(function (o, i) {
          var b = h('<button class="opt"><span class="l">' + "ABCD"[i] + "</span><span></span></button>");
          b.lastChild.textContent = o;
          b.onclick = function () { answer(d, i, box, card); };
          box.appendChild(b);
        });
        slot.appendChild(card);
      }
      function answer(d, i, box, card) {
        if (!run || run.locked || run.over) return;
        run.locked = true; run.seen++;
        var ok = i === d.answer;
        [].forEach.call(box.children, function (b, k) {
          if (k === d.answer) b.classList.add("right"); else if (k === i) b.classList.add("wrong"); else b.classList.add("fade");
        });
        box.classList.add("locked");
        var why = card.querySelector(".rx-why");
        why.className = "rx-why on " + (ok ? "ok" : "bad");
        why.innerHTML = "<b>" + (ok ? "Yes." : "No: " + esc(d.options[d.answer]) + ".") + "</b>" + (d.why || "");
        var sEl = el.querySelector(".rx-score .n"), stk = el.querySelector(".rx-streak");
        if (ok) {
          run.score += 10 + 2 * run.streak; run.streak++; run.hits++;
          if (run.streak > run.bestStreak) run.bestStreak = run.streak;
          LAB.count(sEl, run.score, { ms: 500 });
          var bar = el.querySelector(".rx-bar"); bar.classList.remove("hit"); void bar.offsetWidth; bar.classList.add("hit");
          LAB.haptic("ok"); LAB.sound.play("ok");
        } else {
          run.streak = 0; run.left = Math.max(0.5, run.left - PENALTY); run.misses.push(d);
          box.classList.add("shake");
          LAB.haptic("bad"); LAB.sound.play("bad");
        }
        stk.textContent = "streak x" + run.streak; stk.classList.toggle("on", run.streak >= 2);
        paintTime();
        var r = run;
        setTimeout(function () { if (run !== r || r.over) return; r.locked = false; r.k++; question(); }, REVEAL_MS);
      }
      function paintTime() {
        if (!run) return;
        var i = el.querySelector(".rx-bar i"), s = el.querySelector(".rx-secs"), bar = el.querySelector(".rx-bar");
        if (!i) return;
        var f = Math.max(0, run.left / SECONDS);
        i.style.transform = "scaleX(" + f.toFixed(4) + ")";
        s.textContent = Math.max(0, run.left).toFixed(1) + " s";
        var low = run.left <= 10; s.classList.toggle("low", low); bar.classList.toggle("low", low);
      }
      function tickStart() {
        if (loop || !run || run.over) return;
        loop = LAB.loop(function (dt) {
          if (!run || run.over) return;
          if (!run.locked) run.left -= dt;  // the clock pauses while the why is on screen
          paintTime();
          if (run.left <= 0) finish();
        });
      }
      function stop() { if (loop) { loop.stop(); loop = null; } }

      function finish() {
        if (!run || run.over) return;
        run.over = true; stop();
        var prev = best(), pb = run.score > prev;
        if (pb) { ST.S.journey.seen["reflex:best"] = run.score; ST.save(); }
        LAB.haptic(pb ? "ok" : "pop"); LAB.sound.play(pb ? "ok" : "pop");
        var acc = run.seen ? Math.round(100 * run.hits / run.seen) : 0;
        var misses = run.misses.slice(0, 4);
        el.innerHTML =
          '<div class="rx-end"><div class="eyebrow"><span>Reflex · time</span><span class="dim">' + (pb ? "new personal best" : "best " + Math.max(prev, run.score)) + "</span></div>" +
          '<div class="big ' + (pb ? "pb" : "") + '">0</div>' +
          '<p class="lead">' + (run.hits >= 12 ? "That is exam speed. The phrase-to-service reflex is there." : run.hits >= 6 ? "Solid. The misses below are the phrases worth one more look." : "Warm-up round. Every miss below is one phrase you will now recognise.") + "</p>" +
          '<div class="rx-stats"><div class="panel stat"><span class="k">Hits</span><span class="v ok">' + run.hits + "/" + run.seen + '</span></div><div class="panel stat"><span class="k">Accuracy</span><span class="v">' + acc + '%</span></div><div class="panel stat"><span class="k">Streak</span><span class="v flow">' + run.bestStreak + "</span></div></div>" +
          (misses.length ? '<div class="rx-h3">The ones that got you</div><div class="rx-miss">' + misses.map(function (d) { return "<div><b>" + esc(d.q) + "</b> → <em>" + esc(d.options[d.answer]) + "</em></div>"; }).join("") + "</div>" : "") +
          '<div class="row-btns"><button class="btn primary cont">Continue</button><button class="btn again">Go again</button></div></div>';
        LAB.count(el.querySelector(".big"), run.score, { from: 0, ms: 1100 });
        el.querySelector(".cont").onclick = cont;
        el.querySelector(".again").onclick = start;
      }

      intro();
      return {
        enter: function () { live = true; if (run && !run.over) tickStart(); },
        leave: function () { live = false; stop(); },  // scrolling away pauses the clock
        destroy: function () { live = false; stop(); run = null; }
      };
    }
  });

  /* ---------- casting: every 4th SAA chapter + the 3rd SAP chapter ---------- */
  var saa = ST.MODULES.filter(function (m) { return m.track === "saa"; });
  var sap = ST.MODULES.filter(function (m) { return m.track === "sap"; });
  var targets = [];
  saa.forEach(function (m, i) { if (i % 4 === 3) targets.push(m); });
  if (sap[2]) targets.push(sap[2]);
  targets.forEach(function (m) {
    JOURNEY.cast(m.id, [{ type: "reflex", after: "post", id: m.id, data: { id: m.id }, label: "Reflex · 60 seconds" }]);
  });
})();
