/* scene: echo — "Echoes", spaced review woven into the journey.
 * Prepended to the reel by the engine when >= 3 cards are due (sc.data.then = the
 * scene key to continue to). A stack of up to 8 due flashcards: tap to flip (3D,
 * transform only), grade Again / Good / Easy (JSTORE.gradeCard), the card flies off
 * on a spring and the next one rises. On a flipped card: swipe right = Good,
 * swipe left = Again (horizontal drag only, touch-action: pan-y). */
(function () {
  "use strict";
  var LAB = window.LAB, ST = window.JSTORE, h = LAB.h;
  var MAX = 8;

  if (!document.getElementById("scene-echo-css")) {
    var st = document.createElement("style"); st.id = "scene-echo-css";
    st.textContent = [
      ".scene-echo .ec-dots{display:flex;gap:6px;margin:2px 0 18px;flex-wrap:wrap}",
      ".scene-echo .ec-dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.12);transition:background .3s,transform .45s var(--spring)}",
      ".scene-echo .ec-dots i.on{background:var(--ink);transform:scale(1.3)}",
      ".scene-echo .ec-dots i.again{background:var(--bad)}.scene-echo .ec-dots i.good{background:var(--ok)}.scene-echo .ec-dots i.easy{background:var(--flow)}",
      ".scene-echo h2 em{font-style:normal;color:var(--accent)}",
      ".scene-echo .ec-stack{position:relative;height:clamp(290px,44svh,400px);margin:0 0 30px}",
      ".scene-echo .ec-slot{position:absolute;inset:0;transition:transform .6s var(--spring),opacity .4s var(--ease-out)}",
      ".scene-echo .ec-slot.d0{z-index:3}",
      ".scene-echo .ec-slot.d1{z-index:2;transform:translateY(13px) scale(.95);opacity:.6}",
      ".scene-echo .ec-slot.d2{z-index:1;transform:translateY(26px) scale(.9);opacity:.3}",
      ".scene-echo .ec-slot.enter{transform:translateY(44px) scale(.85);opacity:0}",
      ".scene-echo .ec-drag{position:absolute;inset:0;perspective:1400px;touch-action:pan-y;cursor:pointer;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}",
      ".scene-echo .ec-inner{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .75s var(--spring)}",
      ".scene-echo .ec-slot.flipped .ec-inner{transform:rotateY(180deg)}",
      ".scene-echo .ec-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:22px;border:1px solid var(--line-strong);" +
        "background:linear-gradient(160deg,#1d2331,#141922);box-shadow:0 30px 60px -30px rgba(0,0,0,0.9);padding:20px 20px 18px 22px;display:flex;flex-direction:column;overflow:hidden}",
      ".scene-echo .ec-face::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--mc)}",
      ".scene-echo .ec-face::after{content:'';position:absolute;inset:0;border-radius:22px;pointer-events:none;background:radial-gradient(120% 60% at 0% 0%,color-mix(in srgb,var(--mc) 15%,transparent),transparent 62%)}",
      ".scene-echo .ec-back{transform:rotateY(180deg)}",
      ".scene-echo .ec-mod{display:flex;align-items:center;gap:8px;font-family:var(--body);font-size:11px;letter-spacing:0;text-transform:none;color:var(--mc);margin-bottom:14px;position:relative;z-index:1}",
      ".scene-echo .ec-mod i{width:7px;height:7px;border-radius:50%;background:var(--mc);box-shadow:0 0 12px var(--mc);flex:none}",
      ".scene-echo .ec-mod span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".scene-echo .ec-front-t{flex:1;display:flex;align-items:center;font-family:var(--display);font-weight:500;font-size:clamp(19px,5.2vw,25px);line-height:1.35;letter-spacing:-0.01em;color:var(--ink);position:relative;z-index:1}",
      ".scene-echo .ec-hint{font-family:var(--body);font-size:11px;letter-spacing:0;text-transform:none;color:var(--ink-dim);position:relative;z-index:1}",
      ".scene-echo .ec-back-t{flex:1;overflow-y:auto;overscroll-behavior:contain;font-size:15.5px;line-height:1.6;color:var(--ink-2);position:relative;z-index:1;padding-right:4px}",
      ".scene-echo .ec-back-t strong{color:var(--ink)}.scene-echo .ec-back-t code{font-family:var(--mono);font-size:.88em;color:var(--accent-2)}",
      ".scene-echo .ec-back-t p{margin:0 0 10px}.scene-echo .ec-back-t ul{margin:0 0 10px 18px}",
      ".scene-echo .ec-q{font-size:13px;color:var(--ink-dim);margin-bottom:10px;line-height:1.45;position:relative;z-index:1}",
      ".scene-echo .ec-stamp{position:absolute;top:18px;z-index:4;font-family:var(--body);font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;padding:6px 10px;border-radius:10px;border:1.5px solid;opacity:0;pointer-events:none;background:rgba(22,22,22,0.6)}",
      ".scene-echo .ec-stamp.g{right:18px;color:var(--ok);border-color:var(--ok);transform:rotate(8deg)}",
      ".scene-echo .ec-stamp.a{left:18px;color:var(--bad);border-color:var(--bad);transform:rotate(-8deg)}",
      ".scene-echo .ec-grades{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;transition:opacity .35s,transform .45s var(--spring)}",
      ".scene-echo .ec-grades.off{opacity:0;transform:translateY(8px);pointer-events:none}",
      ".scene-echo .ec-grades .btn{min-height:54px;flex-direction:column;gap:1px;font-size:14.5px}",
      ".scene-echo .ec-grades .btn small{font-family:var(--mono);font-size:10px;font-weight:500;color:var(--ink-dim);letter-spacing:.04em}",
      ".scene-echo .ec-grades .again{border-color:rgba(215,119,109,0.4)}.scene-echo .ec-grades .good{border-color:rgba(109,186,136,0.45)}.scene-echo .ec-grades .easy{border-color:rgba(127,166,214,0.45)}",
      ".scene-echo .ec-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:8px;min-height:44px}",
      ".scene-echo .ec-foot .left{font-family:var(--mono);font-size:11.5px;color:var(--ink-dim)}",
      ".scene-echo .ec-skip{background:none;color:var(--ink-dim);font-size:13px;text-decoration:underline;text-underline-offset:3px;min-height:44px;padding:0 4px}",
      ".scene-echo .ec-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0 22px}",
      ".scene-echo .ec-sum .panel{padding:14px}",
      ".scene-echo .ec-sum .k{font-family:var(--body);font-size:11px;letter-spacing:0;text-transform:none;color:var(--ink-dim)}",
      ".scene-echo .ec-done{animation:ecIn .7s var(--ease-out) both}",
      ".scene-echo .ec-done.d2{animation-delay:.12s}",
      "@keyframes ecIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}",
      "@media (min-width:900px){.scene-echo .ec-stack{height:330px}}"
    ].join("\n");
    document.head.appendChild(st);
  }

  JOURNEY.registerScene("echo", {
    label: function () { return "Echoes"; },
    render: function (el, sc, ctx) {
      var then = (sc.data && sc.data.then) || "opener";
      if (then === "echo") then = "opener";
      var queue = ST.dueCards(null).slice(0, MAX).map(function (x, k) { return { m: x.m, i: x.i, c: x.c, dot: k, again: 0 }; });
      var total = queue.length, tally = { again: 0, good: 0, easy: 0 }, reviewed = 0;
      var slots = [], top = null, busy = false, finished = false, keyOn = false;

      function onKey(e) {
        if (finished) return;
        if (e.code === "Space" && top && !top.classList.contains("flipped")) { e.preventDefault(); flip(); }
        else if (e.key === "1" || e.key === "ArrowLeft") grade("again");
        else if (e.key === "2" || e.key === "ArrowRight") grade("good");
        else if (e.key === "3") grade("easy");
      }
      var ctrl = {
        enter: function () { if (!keyOn) { document.addEventListener("keydown", onKey); keyOn = true; } },
        leave: function () { if (keyOn) { document.removeEventListener("keydown", onKey); keyOn = false; } },
        destroy: function () { ctrl.leave(); }
      };
      if (!total) { summary(true); return ctrl; }

      el.innerHTML =
        '<div class="eyebrow rv"><span>Echoes</span><span class="dim">from earlier stations</span></div>' +
        '<h2 class="rv">Before we go on: <em>' + total + "</em> thing" + (total === 1 ? " you learned is" : "s you learned are") + " fading.</h2>" +
        '<div class="ec-dots rv">' + queue.map(function () { return "<i></i>"; }).join("") + "</div>" +
        '<div class="rv"><div class="ec-stack"></div>' +
        '<div class="ec-grades off"><button class="btn again" data-g="again">Again<small>tomorrow</small></button><button class="btn good" data-g="good">Good<small>in days</small></button><button class="btn easy" data-g="easy">Easy<small>in weeks</small></button></div>' +
        '<div class="ec-foot"><span class="left">Tap to flip · swipe to grade</span><button class="ec-skip">Skip for now</button></div></div>';
      var stack = el.querySelector(".ec-stack"), grades = el.querySelector(".ec-grades"), dots = el.querySelectorAll(".ec-dots i");

      function cardEl(item) {
        var m = item.m;
        var s = h('<div class="ec-slot enter"><div class="ec-drag"><div class="ec-inner">' +
          '<div class="ec-face ec-front"><div class="ec-mod"><i></i><span></span></div><div class="ec-front-t"></div><div class="ec-hint">Tap to reveal</div></div>' +
          '<div class="ec-face ec-back"><div class="ec-mod"><i></i><span></span></div><div class="ec-q"></div><div class="ec-back-t"></div></div>' +
          '</div><div class="ec-stamp g">Good</div><div class="ec-stamp a">Again</div></div></div>');
        s.style.setProperty("--mc", ctx.colorOf(m.id));
        s.querySelectorAll(".ec-mod span").forEach(function (x) { x.textContent = m.title; });
        s.querySelector(".ec-front-t").textContent = item.c.front;
        s.querySelector(".ec-q").textContent = item.c.front;
        s.querySelector(".ec-back-t").innerHTML = item.c.back;
        s._item = item;
        wireDrag(s);
        return s;
      }
      function layout() {
        // the top three cards live in the DOM; depth classes spring them into place
        while (slots.length < Math.min(3, queue.length)) { var s = cardEl(queue[slots.length]); stack.appendChild(s); slots.push(s); }
        void stack.offsetWidth;
        slots.forEach(function (s, d) { s.classList.remove("enter", "d0", "d1", "d2"); s.classList.add("d" + d); });
        top = slots[0] || null;
        dots.forEach(function (d) { d.classList.remove("on"); });
        if (top) { var dt = dots[top._item.dot]; if (dt && !dt.className) dt.classList.add("on"); }
        grades.classList.toggle("off", !(top && top.classList.contains("flipped")));
      }
      function flip() {
        if (!top || busy || top.classList.contains("flipped")) return;
        top.classList.add("flipped"); grades.classList.remove("off");
        LAB.haptic("tap"); LAB.sound.play("tap");
      }
      function grade(g, vx) {
        if (!top || busy || !top.classList.contains("flipped")) return;
        busy = true;
        var s = top, item = s._item;
        ST.gradeCard(item.m, item.i, g);
        tally[g]++; reviewed++;
        if (dots[item.dot]) dots[item.dot].className = g;
        LAB.haptic(g === "again" ? "bad" : "ok"); LAB.sound.play(g === "again" ? "tick" : "ok");
        queue.shift(); slots.shift();
        if (g === "again" && item.again < 1) { item.again++; queue.push(item); } // one more look this session
        flyOff(s, g === "again" ? -1 : 1, vx);
        setTimeout(function () { busy = false; if (!queue.length) summary(false); else layout(); }, 170);
      }
      function flyOff(s, dir, vx) {
        var drag = s.querySelector(".ec-drag"), gone = false;
        var x = LAB.spring(s._dx || 0, { stiffness: 80, damping: 12 });
        x.velocity = vx || dir * 1100; x.set(dir * (window.innerWidth + 400));
        s.style.zIndex = 6; s.style.transition = "opacity .55s"; s.style.opacity = "0";
        function done() { if (gone) return; gone = true; lp.stop(); s.remove(); }
        var lp = LAB.loop(function (dt) {
          var v = x.step(dt);
          drag.style.transform = "translateX(" + v.toFixed(1) + "px) translateY(" + (-Math.abs(v) / 14).toFixed(1) + "px) rotate(" + (v / 24).toFixed(2) + "deg)";
          if (Math.abs(v) > window.innerWidth + 150) done();
        });
        setTimeout(done, 1200);
      }
      function wireDrag(s) {
        var drag = s.querySelector(".ec-drag"), sg = s.querySelector(".ec-stamp.g"), sa = s.querySelector(".ec-stamp.a");
        var down = null;
        function paint(v) {
          drag.style.transform = "translateX(" + v.toFixed(1) + "px) rotate(" + (v / 24).toFixed(2) + "deg)";
          sg.style.opacity = LAB.clamp(v / 90, 0, 1); sa.style.opacity = LAB.clamp(-v / 90, 0, 1);
        }
        drag.addEventListener("pointerdown", function (e) {
          if (s !== top || busy) return;
          down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, cap: false, moved: false }; s._dx = 0;
        });
        drag.addEventListener("pointermove", function (e) {
          if (!down || e.pointerId !== down.id) return;
          var dx = e.clientX - down.x, dy = e.clientY - down.y;
          if (!down.cap) {
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) down.moved = true;
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { down = null; return; } // vertical: the reel scrolls
            if (Math.abs(dx) < 8 || !s.classList.contains("flipped")) return;
            down.cap = true;
            try { drag.setPointerCapture(e.pointerId); } catch (er) {}
          }
          s._dx = dx; paint(dx);
        });
        function end(e) {
          if (!down) return;
          var d = down; down = null;
          if (!d.cap) { if (!d.moved && e.type === "pointerup") flip(); return; }
          var dx = s._dx || 0, vx = dx / Math.max(1, performance.now() - d.t) * 1000;
          if (Math.abs(dx) > 90 || (Math.abs(dx) > 40 && Math.abs(vx) > 700)) { grade(dx > 0 ? "good" : "again", vx); return; }
          var x = LAB.spring(dx, { stiffness: 260, damping: 20 }); x.set(0);
          var lp = LAB.loop(function (dt) { var v = x.step(dt); paint(v); if (x.settled()) { lp.stop(); drag.style.transform = ""; s._dx = 0; } });
        }
        drag.addEventListener("pointerup", end);
        drag.addEventListener("pointercancel", end);
      }
      grades.querySelectorAll(".btn").forEach(function (b) { b.onclick = function () { grade(b.dataset.g); }; });
      el.querySelector(".ec-skip").onclick = function () { LAB.haptic("tap"); summary(false); };

      function summary(empty) {
        finished = true;
        var html = '<div class="eyebrow ' + (empty ? "rv" : "ec-done") + '"><span>Echoes</span><span class="dim">from earlier stations</span></div>';
        if (empty) {
          html += '<h2 class="rv">Nothing is fading right now.</h2><p class="lead rv">Cards return here when they are due: tomorrow for the shaky ones, up to two weeks out for the ones you know cold.</p>';
        } else {
          var head = !reviewed ? "Saved for later." : tally.again ? "Refreshed. The shaky ones return tomorrow." : "Refreshed. All of it held.";
          var sub = !reviewed ? "The fading cards will wait for you at the next stop on the route."
            : reviewed + " review" + (reviewed === 1 ? "" : "s") + " done. Good pushes a card out by days, Easy by weeks, Again brings it back tomorrow.";
          html += '<div class="ec-done"><h2>' + head + '</h2><p class="lead">' + sub + "</p>" +
            (reviewed ? '<div class="ec-sum"><div class="panel stat"><span class="k">Again</span><span class="v bad">' + tally.again + '</span></div><div class="panel stat"><span class="k">Good</span><span class="v ok">' + tally.good + '</span></div><div class="panel stat"><span class="k">Easy</span><span class="v flow">' + tally.easy + "</span></div></div>" : "") +
            "</div>";
        }
        html += '<div class="row-btns ' + (empty ? "rv" : "ec-done d2") + '" style="margin-top:' + (empty ? "22px" : "4px") + '"><button class="btn primary cont">Continue the journey</button></div>';
        el.innerHTML = html;
        el.querySelector(".cont").onclick = function () { LAB.haptic("tap"); ctx.jump(then); };
        if (!empty) { LAB.haptic("ok"); }
      }
      layout();
      return ctrl;
    }
  });
})();
