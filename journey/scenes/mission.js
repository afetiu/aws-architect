/* scene: mission — real-AWS field missions, offered after the chapter that
 * prepares for them. Brief in the scene, the full mission (situation, acceptance
 * criteria, hints, walkthrough, teardown) in the reader. Optional by design.
 * "Mark mission done" → S.journey.seen["mission:<id>"]. */
(function () {
  "use strict";
  var LAB = window.LAB, ST = window.JSTORE, h = LAB.h, esc = LAB.esc;
  var LEVEL = { 1: "Base camp", 2: "Ascent", 3: "Summit" };

  if (!document.getElementById("scene-mission-css")) {
    var st = document.createElement("style"); st.id = "scene-mission-css";
    st.textContent = [
      ".scene-mission .mi-card{position:relative;padding:20px 20px 18px;border-radius:22px;overflow:hidden}",
      ".scene-mission .mi-card::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 70% at 100% 0%,color-mix(in srgb,var(--mc) 14%,transparent),transparent 60%)}",
      ".scene-mission .mi-pills{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}",
      ".scene-mission .mi-pills .fact-pill{display:inline-flex;align-items:center;gap:6px}",
      ".scene-mission .mi-pills svg{flex:none;color:var(--ink-dim)}",
      ".scene-mission .mi-svc{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 18px}",
      ".scene-mission .mi-svc span{font-family:var(--mono);font-size:11.5px;padding:5px 9px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid var(--line);color:var(--ink-2)}",
      ".scene-mission .mi-brief{position:relative;max-height:300px;overflow:hidden;transition:max-height .6s var(--ease-out)}",
      ".scene-mission .mi-brief::after{content:'';position:absolute;left:0;right:0;bottom:0;height:90px;background:linear-gradient(rgba(30,30,30,0),#1e1e1e);pointer-events:none;transition:opacity .4s}",
      ".scene-mission .mi-brief.short::after{display:none}",
      ".scene-mission .mi-brief .prose{font-size:15px;line-height:1.65}",
      ".scene-mission .mi-cost{font-size:13px;line-height:1.55;color:var(--ink-2);padding:12px 14px;border-radius:14px;border:1px solid rgba(210,173,94,0.28);background:rgba(210,173,94,0.05);margin:16px 0 0}",
      ".scene-mission .mi-cost b{display:block;font-family:var(--body);font-size:10.5px;letter-spacing:0;text-transform:none;color:var(--warn);margin-bottom:4px;font-weight:500}",
      ".scene-mission .mi-acts{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:18px}",
      ".scene-mission .mi-done{display:inline-flex;align-items:center;gap:10px;min-height:44px;padding:0 6px;background:none;color:var(--ink-2);font-size:14px}",
      ".scene-mission .mi-done .bx{width:24px;height:24px;border-radius:8px;border:1.5px solid var(--line-strong);display:grid;place-items:center;transition:background .25s,border-color .25s,transform .4s var(--spring)}",
      ".scene-mission .mi-done .bx svg{opacity:0;transform:scale(.4);transition:opacity .2s,transform .4s var(--spring)}",
      ".scene-mission .mi-done[aria-checked=true]{color:var(--ink)}",
      ".scene-mission .mi-done[aria-checked=true] .bx{background:var(--ok);border-color:var(--ok);color:#06210f}",
      ".scene-mission .mi-done[aria-checked=true] .bx svg{opacity:1;transform:none}",
      ".scene-mission .mi-opt{font-size:13px;color:var(--ink-dim);margin:14px 0 0;line-height:1.5}",
      ".scene-mission .mi-stamp{font-family:var(--body);font-size:11px;letter-spacing:0;text-transform:none;color:var(--ok)}",
      /* the full mission inside the reader (not inside the scene) */
      ".mission-doc .md-k{font-family:var(--body);font-size:11px;letter-spacing:0;text-transform:none;color:var(--accent);margin:30px 0 10px}",
      ".mission-doc .md-meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}",
      ".mission-doc .md-meta span{font-family:var(--mono);font-size:12px;padding:6px 10px;border-radius:999px;border:1px solid var(--line);color:var(--ink-2)}",
      ".mission-doc ol.md-tasks{list-style:none;margin:0;padding:0;counter-reset:t}",
      ".mission-doc ol.md-tasks>li{counter-increment:t;position:relative;padding:14px 14px 4px 48px;margin:0 0 10px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,0.02)}",
      ".mission-doc ol.md-tasks>li::before{content:counter(t,decimal-leading-zero);position:absolute;left:14px;top:15px;font-family:var(--mono);font-size:12px;color:var(--accent)}",
      ".mission-doc details{margin:0 0 12px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,0.02)}",
      ".mission-doc details>summary{cursor:pointer;list-style:none;padding:14px 16px;min-height:48px;font-family:var(--display);font-weight:600;color:var(--ink);display:flex;justify-content:space-between;gap:10px}",
      ".mission-doc details>summary::-webkit-details-marker{display:none}",
      ".mission-doc details>summary::after{content:'+';font-family:var(--mono);color:var(--ink-dim)}",
      ".mission-doc details[open]>summary::after{content:'\\2212'}",
      ".mission-doc details>div{padding:0 16px 6px}",
      ".mission-doc details.td{border-color:rgba(215,119,109,0.35)}"
    ].join("\n");
    document.head.appendChild(st);
  }

  // pill-sized cost (≈ us-east-1); the full cost note from the mission is shown below the brief
  var COST = {
    "static-site": "&lt; $1 if torn down same day", "three-tier-vpc": "≈ $0.15/hr · &lt; $2", "serverless-api": "&lt; $0.50",
    "event-pipeline": "&lt; $0.50", "bedrock-rag": "≈ $2–4 in one sitting", "broken-vpc": "≈ $0.06/hr · &lt; $1",
    "runaway-bill": "≈ $5 worst case", "dr-drill": "&lt; $1", "locked-out": "≈ $0", "throttled-api": "&lt; $1"
  };
  function byId(id) { return (window.COURSE.missions || []).find(function (m) { return m.id === id; }); }
  function fullHtml(mi) {
    return '<div class="mission-doc">' +
      '<div class="md-meta"><span>' + esc(LEVEL[mi.level] || "Level " + mi.level) + "</span><span>~" + esc(mi.time) + "</span><span>" + esc((mi.services || []).join(" · ")) + "</span></div>" +
      '<div class="callout war"><p>This runs in <strong>your own AWS account</strong> and creates real, billable resources. Cost: ' + mi.cost + ". Set a budget alarm first, and run the teardown at the end, no exceptions.</p></div>" +
      '<div class="md-k">The situation</div>' + (mi.brief || "") +
      ((mi.tasks || []).length ? '<div class="md-k">Acceptance criteria · verify each one</div><ol class="md-tasks">' + mi.tasks.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ol>" : "") +
      '<div class="md-k">When you are stuck</div>' +
      (mi.hints ? "<details><summary>Hints (try without them first)</summary><div>" + mi.hints + "</div></details>" : "") +
      (mi.walkthrough ? "<details><summary>Full walkthrough (the answer key)</summary><div>" + mi.walkthrough + "</div></details>" : "") +
      (mi.teardown ? '<div class="md-k">Teardown · run it when done</div><details class="td" open><summary>Teardown checklist</summary><div>' + mi.teardown + "</div></details>" : "") +
      "</div>";
  }

  JOURNEY.registerScene("mission", {
    label: function (sc) { var mi = byId(sc.data.missionId); return "Field mission" + (mi ? " · " + mi.title : ""); },
    render: function (el, sc, ctx) {
      var mi = byId(sc.data.missionId);
      if (!mi) { el.innerHTML = '<div class="eyebrow">Field mission</div><p class="dim">This mission is not loaded.</p>'; return {}; }
      var key = "mission:" + mi.id;
      var costShort = COST[mi.id] || String(mi.cost).split(/ \(|; |\. | — /)[0];
      if (costShort.length > 44) costShort = costShort.slice(0, 42).replace(/\s+\S*$/, "") + "…";
      el.style.setProperty("--mc", ctx.colorOf(sc.m.id));
      el.parentNode.classList.add("tall");
      el.innerHTML =
        '<div class="eyebrow rv"><span>Field mission · level ' + (mi.level || 1) + '</span><span class="dim">' + esc(LEVEL[mi.level] || "") + " · optional</span></div>" +
        '<h2 class="rv">' + esc(mi.title) + "</h2>" +
        '<div class="mi-pills rv"><span class="fact-pill"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><b>~' + esc(mi.time) + '</b></span>' +
        '<span class="fact-pill"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v18M16.5 7.5C16 6 14.3 5 12 5s-4.5 1.2-4.5 3.3S9.6 11 12 11.5s4.5 1.2 4.5 3.3S14.3 19 12 19s-4-1-4.5-2.5"/></svg><b>' + costShort + "</b></span></div>" +
        '<div class="mi-svc rv">' + (mi.services || []).map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("") + "</div>" +
        '<div class="panel mi-card rv"><div class="mi-brief"></div><div class="mi-cost"><b>Cost</b>' + mi.cost + "</div></div>" +
        '<div class="mi-acts rv"><button class="btn primary open">Open the full mission</button>' +
        '<button class="mi-done" role="checkbox" aria-checked="false"><span class="bx"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></span><span class="lb">Mark mission done</span></button></div>' +
        '<p class="mi-opt rv">Optional. A real brief from a real-shaped company, built in your own AWS account with acceptance criteria and a teardown. Skip it now and it waits here; the route carries on below.</p>';
      var brief = el.querySelector(".mi-brief");
      brief.appendChild(ctx.prose(mi.brief || ""));
      var openB = el.querySelector(".open"), done = el.querySelector(".mi-done");
      openB.onclick = function () { ctx.openReader(mi.title, fullHtml(mi), "Field mission · level " + (mi.level || 1) + " · real AWS"); };
      brief.onclick = openB.onclick;
      brief.style.cursor = "pointer";
      function paint() {
        var on = !!ST.S.journey.seen[key];
        done.setAttribute("aria-checked", String(on));
        done.querySelector(".lb").textContent = on ? "Mission done" : "Mark mission done";
      }
      done.onclick = function () {
        var on = !ST.S.journey.seen[key];
        if (on) ST.S.journey.seen[key] = Date.now(); else delete ST.S.journey.seen[key];
        ST.save(); paint();
        LAB.haptic(on ? "ok" : "tap"); LAB.sound.play(on ? "ok" : "tick");
        if (on) ctx.toast("Mission logged. Did you run the teardown? Check the bill in two days anyway.");
      };
      paint();
      return {
        enter: function () {
          // short briefs need no fade
          var p = brief.firstChild; if (p && p.scrollHeight <= 300) brief.classList.add("short");
        }
      };
    }
  });

  /* ---------- casting: each mission after the chapter that prepares for it ---------- */
  var WHERE = {
    "static-site": "route53",          // S3 + CloudFront + ACM + Route 53 → after DNS, the last of the four
    "three-tier-vpc": "elb-asg",       // VPC + EC2 + ALB → once load balancers are known
    "broken-vpc": "ec2",               // VPC troubleshooting with instances in it
    "serverless-api": "serverless",    // API Gateway + Lambda + DynamoDB canary
    "event-pipeline": "messaging",     // S3 → SQS → Lambda → DynamoDB with a DLQ
    "locked-out": "security-services", // IAM deny debugging + CloudTrail forensics
    "throttled-api": "observability",  // p99 hunt with CloudWatch metrics
    "runaway-bill": "cost",            // Cost Explorer / Budgets / Anomaly Detection
    "dr-drill": "ha-dr",               // DynamoDB global tables + S3 CRR, measured RTO
    "bedrock-rag": "ai-ml"             // Bedrock Knowledge Bases
  };
  var ids = ST.MODULES.map(function (m) { return m.id; });
  (window.COURSE.missions || []).slice().sort(function (a, b) { return (a.level || 1) - (b.level || 1); }).forEach(function (mi) {
    var mod = WHERE[mi.id];
    if (!mod || ids.indexOf(mod) < 0) mod = ids[Math.min(ids.length - 1, (mi.level || 1) * 6)];
    var entry = { type: "mission", after: "post", id: mi.id, data: { missionId: mi.id }, label: "Field mission · " + mi.title };
    // missions sit right after the closer, before any reflex interlude or trial on the same chapter
    var list = JOURNEY.casting[mod] = JOURNEY.casting[mod] || [];
    var at = list.findIndex(function (c) { return c.after === "post" && (c.type === "reflex" || c.type === "trial"); });
    if (at < 0) list.push(entry); else list.splice(at, 0, entry);
  });
})();
