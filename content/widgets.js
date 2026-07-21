/* Interactive simulators. Each widget: { id, moduleId, title, sub, render(root) }.
 * Prices are approximate us-east-1 figures for intuition-building — always verify
 * current pricing before real decisions. All charts label every mark directly. */
(function () {
  "use strict";

  /* ---------- tiny helpers ---------- */
  function h(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function money(n) { return n >= 100 ? "$" + Math.round(n).toLocaleString() : "$" + n.toFixed(2); }
  function slider(root, label, min, max, step, value, fmt) {
    var row = h('<div class="w-row"><label>' + esc(label) + '</label><input type="range"><span class="w-val"></span></div>');
    var inp = row.querySelector("input"), val = row.querySelector(".w-val");
    inp.min = min; inp.max = max; inp.step = step; inp.value = value;
    var api = {
      el: row,
      get: function () { return +inp.value; },
      onchange: null,
      refresh: function () { val.textContent = fmt(+inp.value); }
    };
    inp.addEventListener("input", function () { api.refresh(); if (api.onchange) api.onchange(); });
    api.refresh();
    root.appendChild(row);
    return api;
  }
  function chips(root, label, options, selIdx) {
    var wrap = h('<div class="w-row"><label>' + esc(label) + '</label><div class="w-chip-row"></div></div>');
    var box = wrap.querySelector(".w-chip-row");
    var api = { el: wrap, idx: selIdx, onchange: null, get: function () { return options[api.idx]; } };
    options.forEach(function (o, i) {
      var c = h('<span class="w-chip' + (i === selIdx ? " sel" : "") + '">' + esc(o.label || o) + "</span>");
      c.onclick = function () {
        api.idx = i;
        box.querySelectorAll(".w-chip").forEach(function (x, j) { x.classList.toggle("sel", j === i); });
        if (api.onchange) api.onchange();
      };
      box.appendChild(c);
    });
    root.appendChild(wrap);
    return api;
  }
  function toggle(root, label, on) {
    var t = h('<span class="w-toggle' + (on ? " on" : "") + '"><span>' + esc(label) + "</span></span>");
    var api = { el: t, on: on, onchange: null };
    t.onclick = function () {
      api.on = !api.on;
      t.classList.toggle("on", api.on);
      if (api.onchange) api.onchange();
    };
    root.appendChild(t);
    return api;
  }
  function bars(root, rows, fmt) {
    // rows: [{label, value, cls ('best'|'worst'|''), note}] — every bar direct-labeled
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; })) || 1;
    var box = h('<div class="w-bars"></div>');
    rows.forEach(function (r) {
      var pct = Math.max(2, 100 * r.value / max);
      box.appendChild(h('<div class="w-bar-row ' + (r.cls || "") + '"><span class="w-bar-label">' + esc(r.label) + '</span>' +
        '<span class="w-bar-track"><span class="w-bar-fill" style="width:' + pct + '%"></span></span>' +
        '<span class="w-bar-num">' + fmt(r.value) + (r.note ? ' <span class="muted">' + esc(r.note) + "</span>" : "") + "</span></div>"));
    });
    root.appendChild(box);
  }
  function trace(root, steps) {
    // steps: [{ok: true|false|null, text}]
    var box = h('<div class="w-trace"></div>');
    steps.forEach(function (s) {
      var cls = s.ok === true ? "ok" : s.ok === false ? "no" : "";
      var ico = s.ok === true ? "✓" : s.ok === false ? "✕" : "·";
      box.appendChild(h('<div class="t-step ' + cls + '"><span class="t-ico">' + ico + "</span><span>" + s.text + "</span></div>"));
    });
    root.appendChild(box);
  }
  function verdict(root, kind, html) {
    root.appendChild(h('<div class="w-verdict ' + kind + '">' + html + "</div>"));
  }
  function out(root) {
    var d = h('<div></div>');
    root.appendChild(d);
    return d;
  }

  var W = function (spec) { window.COURSE.registerWidget(spec); };

  /* ================================================================
   * 1. Availability math builder (module: ha-dr)
   * ================================================================ */
  W({
    id: "availability-calc",
    moduleId: "ha-dr",
    title: "Availability math builder",
    sub: "Chain components in series, add parallel redundancy, watch the nines compose. Serial dependencies multiply; redundancy fights back.",
    render: function (root) {
      var LEVELS = [0.99, 0.995, 0.999, 0.9995, 0.9999, 0.99999];
      var tiers = [
        { name: "Load balancer", a: 4, n: 1 },
        { name: "App tier", a: 1, n: 2 },
        { name: "Database", a: 3, n: 1 }
      ];
      var listEl = out(root), res = out(root);
      var addBtn = h('<button style="margin-top:0.5rem">+ Add a dependency</button>');
      root.appendChild(addBtn);
      addBtn.onclick = function () { tiers.push({ name: "Dependency " + (tiers.length + 1), a: 2, n: 1 }); draw(); };
      function draw() {
        listEl.innerHTML = "";
        tiers.forEach(function (t, i) {
          var row = h('<div class="w-row"><label>' + esc(t.name) + "</label>" +
            '<select class="lv"></select><select class="rd"></select><button class="rm" title="remove">✕</button></div>');
          var lv = row.querySelector(".lv"), rd = row.querySelector(".rd");
          LEVELS.forEach(function (a, j) {
            lv.appendChild(h("<option value='" + j + "'" + (j === t.a ? " selected" : "") + ">" + (a * 100).toFixed(3).replace(/\.?0+$/, "") + "% each</option>"));
          });
          [1, 2, 3].forEach(function (n) {
            rd.appendChild(h("<option value='" + n + "'" + (n === t.n ? " selected" : "") + ">" + (n === 1 ? "single instance" : n + "x parallel") + "</option>"));
          });
          lv.onchange = function () { t.a = +lv.value; calc(); };
          rd.onchange = function () { t.n = +rd.value; calc(); };
          row.querySelector(".rm").onclick = function () { tiers.splice(i, 1); draw(); };
          listEl.appendChild(row);
        });
        calc();
      }
      function calc() {
        var total = 1;
        tiers.forEach(function (t) {
          var a = LEVELS[t.a];
          total *= 1 - Math.pow(1 - a, t.n);
        });
        var downMin = (1 - total) * 525600;
        res.innerHTML = "";
        var r = h('<div class="w-result"><span class="big">' + (total * 100).toFixed(4).replace(/\.?0+$/, "") + "%</span> composite availability" +
          '<div class="muted" style="margin-top:0.3rem">≈ ' + (downMin >= 60 ? (downMin / 60).toFixed(1) + " hours" : downMin.toFixed(1) + " minutes") + " of expected downtime per year</div></div>");
        res.appendChild(r);
        if (tiers.some(function (t) { return t.n === 1 && LEVELS[t.a] < 0.999; })) {
          verdict(res, "no", "A single-instance dependency below 99.9% dominates the whole chain — this is why the exam answer to almost everything is <strong>redundancy in the weakest serial tier</strong>, not more nines in the strongest one.");
        } else if (total >= 0.9999) {
          verdict(res, "ok", "Four nines composite. Notice you got here with redundancy, not with any single perfect component.");
        }
      }
      draw();
    }
  });

  /* ================================================================
   * 2. DR strategy picker (module: ha-dr)
   * ================================================================ */
  W({
    id: "dr-picker",
    moduleId: "ha-dr",
    title: "DR strategy explorer",
    sub: "Set the business requirements, see which of the four DR strategies fits — and what it costs you to over- or under-shoot.",
    render: function (root) {
      var RTO_STEPS = [1, 5, 30, 60, 240, 720, 1440, 2880]; // minutes
      var RPO_STEPS = [0, 1, 5, 15, 60, 240, 1440];
      function tf(m) { return m >= 1440 ? (m / 1440) + " d" : m >= 60 ? (m / 60) + " h" : m + " min"; }
      var rto = slider(root, "RTO — how fast must you be back?", 0, RTO_STEPS.length - 1, 1, 4, function (i) { return tf(RTO_STEPS[i]); });
      var rpo = slider(root, "RPO — how much data can you lose?", 0, RPO_STEPS.length - 1, 1, 3, function (i) { return tf(RPO_STEPS[i]); });
      var res = out(root);
      var STRATS = [
        { name: "Backup & restore", rto: 1440, rpo: 1440, cost: 1, note: "Backups copied cross-region; rebuild with IaC on demand" },
        { name: "Pilot light", rto: 240, rpo: 15, cost: 3, note: "Data live-replicated; core services provisioned but scaled to zero" },
        { name: "Warm standby", rto: 30, rpo: 5, cost: 8, note: "Scaled-down full stack always running; scale up + fail over" },
        { name: "Active-active", rto: 1, rpo: 0, cost: 20, note: "Full capacity in both regions; traffic shifts, nothing to start" }
      ];
      function calc() {
        var needRto = RTO_STEPS[rto.get()], needRpo = RPO_STEPS[rpo.get()];
        var pick = STRATS.length - 1;
        for (var i = 0; i < STRATS.length; i++) {
          if (STRATS[i].rto <= needRto && STRATS[i].rpo <= needRpo) { pick = i; break; }
        }
        res.innerHTML = "";
        bars(res, STRATS.map(function (s, i) {
          return { label: s.name, value: s.cost, cls: i === pick ? "best" : "", note: i === pick ? "← fits" : "" };
        }), function (v) { return "~" + v + "x cost"; });
        var s = STRATS[pick];
        verdict(res, "ok", "<strong>" + s.name + "</strong> is the cheapest strategy that meets RTO ≤ " + tf(needRto) + " and RPO ≤ " + tf(needRpo) + ". " + s.note + ".");
        if (pick < STRATS.length - 1) {
          verdict(res, "info", "Exam trap: <strong>" + STRATS[STRATS.length - 1].name + "</strong> also meets the requirement — but when the question says “MOST cost-effective”, picking more DR than the RTO/RPO demands is the wrong answer.");
        }
        if (pick === 0 && needRpo < 1440) {
          verdict(res, "no", "Careful: plain backup & restore cannot honestly hit an RPO under your backup frequency. Continuous replication (pilot light and up) is what buys tight RPO.");
        }
      }
      rto.onchange = rpo.onchange = calc;
      calc();
    }
  });

  /* ================================================================
   * 3. VPC packet-flow simulator (module: vpc)
   * ================================================================ */
  W({
    id: "vpc-packet",
    moduleId: "vpc",
    title: "VPC packet-flow simulator",
    sub: "Send a packet from an EC2 instance and trace every hop that can kill it: routes, gateways, security groups, NACLs. Flip the toggles and watch where it dies.",
    render: function (root) {
      var src = chips(root, "Source instance lives in", [{ label: "Public subnet" }, { label: "Private subnet" }], 1);
      var dst = chips(root, "Destination", [
        { label: "Internet (api.stripe.com)" },
        { label: "S3 bucket (same region)" },
        { label: "Instance in a peered VPC" }
      ], 0);
      var tgRow = h('<div class="w-row"><label>Network configuration</label><div class="w-chip-row tg"></div></div>');
      root.appendChild(tgRow);
      var tgBox = tgRow.querySelector(".tg");
      var tIgw = toggle(tgBox, "Public route table → IGW", true);
      var tNat = toggle(tgBox, "NAT Gateway in public subnet", false);
      var tEp = toggle(tgBox, "S3 gateway endpoint", false);
      var tPeer = toggle(tgBox, "Peering + routes configured", false);
      var tSgOut = toggle(tgBox, "Source SG allows egress", true);
      var tSgIn = toggle(tgBox, "Dest SG allows source", false);
      var tNacl = toggle(tgBox, "Custom NACL blocks ephemeral return ports", false);
      var res = out(root);
      function calc() {
        var steps = [], ok = true, note = null;
        var isPublic = src.idx === 0;
        function step(pass, text) { steps.push({ ok: pass, text: text }); if (pass === false) ok = false; return pass; }
        step(tSgOut.on, "<strong>Security group egress</strong> — " + (tSgOut.on ? "outbound rule allows the flow. SGs are stateful: the reply will be allowed automatically." : "no egress rule matches. The packet never leaves the ENI."));
        if (ok) {
          if (dst.idx === 0) { // internet
            if (isPublic) {
              step(tIgw.on, "<strong>Route lookup</strong> — public subnet's route table " + (tIgw.on ? "has 0.0.0.0/0 → IGW. The IGW does a 1:1 NAT to the instance's public IP." : "has no internet route. Local route only ⇒ destination unreachable."));
            } else {
              step(tNat.on, "<strong>Route lookup</strong> — private subnet " + (tNat.on ? "routes 0.0.0.0/0 → NAT Gateway in the public subnet, which SNATs to its Elastic IP and forwards via the IGW." : "has no route to the internet (no NAT). This is the classic private-subnet dead end."));
              if (tNat.on) note = "Works — but every GB through the NAT Gateway bills ~$0.045 processing. Watch the cost simulator in the cost module.";
            }
          } else if (dst.idx === 1) { // S3
            if (tEp.on) {
              step(true, "<strong>Route lookup</strong> — the S3 prefix list routes to the <strong>gateway endpoint</strong>: traffic stays on the AWS network, no IGW/NAT needed, $0 data processing.");
            } else if (isPublic ? tIgw.on : tNat.on) {
              step(true, "<strong>Route lookup</strong> — no S3 endpoint, so this rides the internet path (" + (isPublic ? "IGW" : "NAT → IGW") + ") to S3's public endpoint.");
              note = "It works, but this is the <strong>NAT-for-S3 anti-pattern</strong>: you are paying NAT/egress processing for traffic that a free gateway endpoint would carry. Favorite exam cost question.";
            } else {
              step(false, "<strong>Route lookup</strong> — no S3 endpoint and no internet path. S3's endpoint is unreachable from here.");
            }
          } else { // peered VPC
            step(tPeer.on, "<strong>Route lookup</strong> — " + (tPeer.on ? "route table has the peer CIDR → pcx-… peering connection. Remember: peering is never transitive." : "no route to the peer CIDR. A peering connection without routes in BOTH VPCs' route tables carries nothing."));
            if (ok) step(tSgIn.on, "<strong>Destination security group</strong> — " + (tSgIn.on ? "inbound rule allows the source (by CIDR, or by SG reference since same-region peering supports it)." : "nothing allows the source. SGs default-deny inbound; the SYN dies at the destination ENI."));
          }
        }
        if (ok && dst.idx !== 2) {
          step(!tNacl.on, "<strong>NACL on the return path</strong> — " + (tNacl.on ? "the custom NACL doesn't allow ephemeral ports (1024-65535) back in. NACLs are <strong>stateless</strong>: the reply is dropped even though the request got out." : "default NACL allows all; stateless return traffic on ephemeral ports comes back fine."));
        }
        res.innerHTML = "";
        trace(res, steps);
        if (ok) verdict(res, "ok", "<strong>Packet delivered.</strong>" + (note ? " " + note : ""));
        else verdict(res, "no", "<strong>Packet dropped</strong> at the step marked ✕. In real life this is a VPC Reachability Analyzer / flow-logs debugging session.");
      }
      [src, dst].forEach(function (c) { c.onchange = calc; });
      [tIgw, tNat, tEp, tPeer, tSgOut, tSgIn, tNacl].forEach(function (t) { t.onchange = calc; });
      calc();
    }
  });

  /* ================================================================
   * 4. IAM policy evaluator (module: iam)
   * ================================================================ */
  W({
    id: "iam-eval",
    moduleId: "iam",
    title: "IAM policy evaluation, step by step",
    sub: "Toggle which policies say what, then watch AWS's actual evaluation order decide. Explicit deny beats everything; SCPs and boundaries only filter; resource policies can grant on their own — sometimes.",
    render: function (root) {
      var cross = chips(root, "Request is", [{ label: "Same-account" }, { label: "Cross-account" }], 0);
      var box = h('<div class="w-row"><label>Policies in play</label><div class="w-chip-row tg"></div></div>');
      root.appendChild(box);
      var tg = box.querySelector(".tg");
      var tDeny = toggle(tg, "An explicit Deny matches (anywhere)", false);
      var tScp = toggle(tg, "SCP allows the action", true);
      var tIdent = toggle(tg, "Identity policy allows", true);
      var tRes = toggle(tg, "Resource policy allows the principal", false);
      var tBound = toggle(tg, "Permission boundary allows", true);
      var tHasBound = toggle(tg, "Boundary attached at all", false);
      var res = out(root);
      function calc() {
        var steps = [], allowed = null, why = "";
        function step(ok, text) { steps.push({ ok: ok, text: text }); }
        // 1 explicit deny
        if (tDeny.on) {
          step(false, "<strong>1. Explicit deny check</strong> — a matching Deny statement exists. Evaluation stops immediately; nothing can override an explicit deny.");
          allowed = false; why = "explicit deny";
        } else {
          step(true, "<strong>1. Explicit deny check</strong> — no Deny matches. Continue.");
          // 2 SCP
          if (!tScp.on) {
            step(false, "<strong>2. Organizations SCP</strong> — the SCP does not allow this action. SCPs are a filter on the maximum: no allow inside the SCP boundary ⇒ implicit deny, regardless of IAM policies.");
            allowed = false; why = "SCP filter";
          } else {
            step(true, "<strong>2. Organizations SCP</strong> — action is inside the SCP boundary. SCPs never grant — they only failed to block.");
            var isCross = cross.idx === 1;
            if (isCross) {
              step(tRes.on, "<strong>3. Resource policy (cross-account)</strong> — " + (tRes.on ? "the resource policy trusts the caller's account/principal." : "the resource policy does not allow the external principal — cross-account access requires BOTH sides to allow."));
              step(tIdent.on, "<strong>4. Caller's identity policy</strong> — " + (tIdent.on ? "the caller's own policy allows the action on that resource." : "the caller has no identity-policy allow. Cross-account needs an allow on both sides."));
              allowed = tRes.on && tIdent.on;
              why = allowed ? "both sides allow" : "cross-account requires both the resource policy AND the caller's identity policy";
            } else {
              if (tRes.on) {
                step(true, "<strong>3. Resource policy (same-account)</strong> — allows the principal. Same-account, a resource-policy allow is sufficient on its own (boundaries/SCPs still filter).");
              } else {
                step(null, "<strong>3. Resource policy</strong> — none/no allow. Fall through to identity policy.");
              }
              if (tHasBound.on) {
                step(tBound.on, "<strong>4. Permission boundary</strong> — " + (tBound.on ? "the boundary includes the action. Boundaries don't grant; the effective permission is the INTERSECTION of boundary ∩ identity policy." : "the boundary does not include the action ⇒ implicit deny, even though the identity policy allows it. This is the classic boundary gotcha."));
              } else {
                step(null, "<strong>4. Permission boundary</strong> — none attached; skip.");
              }
              var boundOk = !tHasBound.on || tBound.on;
              if (boundOk) {
                step(tIdent.on || tRes.on, "<strong>5. Identity policy</strong> — " + (tIdent.on ? "an Allow matches." : tRes.on ? "no identity allow, but the same-account resource policy already granted it." : "no Allow anywhere ⇒ implicit deny (the default)."));
              }
              allowed = boundOk && (tIdent.on || tRes.on);
              why = allowed ? "" : (!boundOk ? "permission boundary intersection" : "no allow anywhere → implicit deny");
            }
          }
        }
        res.innerHTML = "";
        trace(res, steps);
        if (allowed) verdict(res, "ok", "<strong>ALLOWED.</strong> An allow survived every filter (deny → SCP → boundary), which is the only way a request ever succeeds.");
        else verdict(res, "no", "<strong>DENIED</strong> — " + why + ". Note how many distinct mechanisms can produce the same AccessDenied; knowing WHICH one is the whole game in multi-account debugging (and on the SAP exam).");
      }
      cross.onchange = calc;
      [tDeny, tScp, tIdent, tRes, tBound, tHasBound].forEach(function (t) { t.onchange = calc; });
      calc();
    }
  });

  /* ================================================================
   * 5. DynamoDB capacity & cost (module: dynamodb)
   * ================================================================ */
  W({
    id: "ddb-capacity",
    moduleId: "dynamodb",
    title: "DynamoDB capacity math & the on-demand crossover",
    sub: "The RCU/WCU arithmetic the exam loves, plus where on-demand stops being cheaper than provisioned. Approximate us-east-1 pricing.",
    render: function (root) {
      var size = slider(root, "Item size", 0, 6, 1, 2, function (i) { return [0.5, 1, 2, 4, 8, 16, 64][i] + " KB"; });
      var SIZES = [0.5, 1, 2, 4, 8, 16, 64];
      var reads = slider(root, "Reads per second", 0, 40, 1, 10, function (v) { return expScale(v) + "/s"; });
      var writes = slider(root, "Writes per second", 0, 40, 1, 8, function (v) { return expScale(v) + "/s"; });
      function expScale(v) { return Math.round(Math.pow(10, v / 10)); }
      var rc = chips(root, "Read consistency", [{ label: "Eventually consistent" }, { label: "Strongly consistent" }, { label: "Transactional" }], 0);
      var wc = chips(root, "Write type", [{ label: "Standard" }, { label: "Transactional" }], 0);
      var res = out(root);
      function calc() {
        var kb = SIZES[size.get()], rps = expScale(reads.get()), wps = expScale(writes.get());
        var rUnits = Math.ceil(kb / 4);
        var rcuPer = rc.idx === 0 ? rUnits * 0.5 : rc.idx === 1 ? rUnits : rUnits * 2;
        var wUnits = Math.ceil(kb / 1);
        var wcuPer = wc.idx === 0 ? wUnits : wUnits * 2;
        var rcu = Math.ceil(rps * rcuPer), wcu = Math.ceil(wps * wcuPer);
        var provCost = rcu * 0.00013 * 730 + wcu * 0.00065 * 730;
        var monthlyReads = rps * 2592000, monthlyWrites = wps * 2592000;
        var odCost = (monthlyReads * rcuPer / 0.5) * 0.125 / 1e6 * 0.5 * 2 / 2; // read request units priced per unit
        odCost = monthlyReads * (rc.idx === 0 ? rUnits * 0.5 : rc.idx === 1 ? rUnits : rUnits * 2) * 0.125 / 1e6;
        var odw = monthlyWrites * wcuPer * 0.625 / 1e6;
        odCost += odw;
        res.innerHTML = "";
        res.appendChild(h('<div class="w-result">' +
          "<div><strong>Read math:</strong> ceil(" + kb + " KB / 4 KB) = " + rUnits + " unit(s) × " + (rc.idx === 0 ? "0.5 (eventual)" : rc.idx === 1 ? "1 (strong)" : "2 (transactional)") + " × " + rps + "/s ⇒ <span class='big'>" + rcu + " RCU</span></div>" +
          "<div style='margin-top:0.4rem'><strong>Write math:</strong> ceil(" + kb + " KB / 1 KB) = " + wUnits + " unit(s) × " + (wc.idx === 0 ? "1" : "2 (transactional)") + " × " + wps + "/s ⇒ <span class='big'>" + wcu + " WCU</span></div></div>"));
        bars(res, [
          { label: "Provisioned (steady 24/7)", value: provCost, cls: provCost <= odCost ? "best" : "" },
          { label: "On-demand", value: odCost, cls: odCost < provCost ? "best" : "" }
        ], money);
        var ratio = odCost / Math.max(provCost, 0.01);
        verdict(res, "info", ratio > 1
          ? "At a <strong>steady</strong> 24/7 load, on-demand costs ~" + ratio.toFixed(1) + "x provisioned. On-demand wins when traffic is spiky or idle most of the day — the crossover is roughly at <strong>~30-35% average utilization</strong> of what you'd provision for peak."
          : "On-demand is cheaper here — your throughput is low enough that provisioned minimums dominate. Also note items > 4 KB scale RCU linearly: big items quietly multiply cost.");
      }
      [size, reads, writes].forEach(function (s) { s.onchange = calc; });
      [rc, wc].forEach(function (c) { c.onchange = calc; });
      calc();
    }
  });

  /* ================================================================
   * 6. S3 storage class cost race (module: s3)
   * ================================================================ */
  W({
    id: "s3-classes",
    moduleId: "s3",
    title: "S3 storage class cost race",
    sub: "Same data, seven storage classes. Slide the access pattern and watch the cheapest class change — including the retrieval-fee ambushes. Approximate pricing.",
    render: function (root) {
      var gb = slider(root, "Data stored", 0, 40, 1, 20, function (v) { return fmtGb(gbScale(v)); });
      function gbScale(v) { return Math.round(Math.pow(10, 1 + v / 10)); }
      function fmtGb(g) { return g >= 1000 ? (g / 1000).toFixed(1) + " TB" : g + " GB"; }
      var access = slider(root, "% of data read back per month", 0, 100, 5, 10, function (v) { return v + "%"; });
      var res = out(root);
      var CLASSES = [
        { name: "Standard", store: 0.023, ret: 0, minDays: 0 },
        { name: "Intelligent-Tiering", store: 0.023, ret: 0, minDays: 0, it: true },
        { name: "Standard-IA", store: 0.0125, ret: 0.01, minDays: 30 },
        { name: "One Zone-IA", store: 0.01, ret: 0.01, minDays: 30, oz: true },
        { name: "Glacier Instant", store: 0.004, ret: 0.03, minDays: 90 },
        { name: "Glacier Flexible", store: 0.0036, ret: 0.01, minDays: 90, slow: "mins-hours" },
        { name: "Deep Archive", store: 0.00099, ret: 0.02, minDays: 180, slow: "hours" }
      ];
      function calc() {
        var g = gbScale(gb.get()), pct = access.get() / 100;
        var rows = CLASSES.map(function (c) {
          var storeCost = g * (c.it && pct < 0.1 ? 0.0135 : c.store); // IT blends toward archive tiers when cold
          var retCost = g * pct * c.ret;
          return { c: c, total: storeCost + retCost };
        });
        var best = rows.reduce(function (a, b) { return b.total < a.total ? b : a; });
        res.innerHTML = "";
        bars(res, rows.map(function (r) {
          var notes = [];
          if (r.c.slow) notes.push("retrieval " + r.c.slow);
          if (r.c.minDays) notes.push(r.c.minDays + "d min");
          return { label: r.c.name, value: r.total, cls: r === best ? "best" : "", note: notes.join(", ") };
        }), function (v) { return money(v) + "/mo"; });
        var b = best.c;
        verdict(res, "ok", "<strong>" + b.name + "</strong> wins at this access pattern." +
          (b.oz ? " But One Zone-IA lives in a single AZ — it is only correct for re-creatable data. Classic exam disqualifier." : "") +
          (b.slow ? " Retrieval takes " + b.slow + " — only valid if the scenario tolerates that." : ""));
        if (access.get() >= 30) {
          verdict(res, "no", "See how IA/Glacier stop winning as access rises? Retrieval fees ($/GB read) are the ambush: “cheap storage” classes get expensive fast for warm data. If access is unpredictable, Intelligent-Tiering is the safe default — that's usually the exam answer for “unknown access pattern”.");
        }
      }
      gb.onchange = access.onchange = calc;
      calc();
    }
  });

  /* ================================================================
   * 7. ASG scaling simulator (module: elb-asg)
   * ================================================================ */
  W({
    id: "asg-sim",
    moduleId: "elb-asg",
    title: "Auto Scaling simulator",
    sub: "Pick a traffic pattern, tune target tracking and warmup, and watch capacity chase demand. Red zones = users feeling it.",
    render: function (root) {
      var pattern = chips(root, "Traffic pattern", [{ label: "Sudden spike" }, { label: "Daily wave" }, { label: "Steady ramp" }], 0);
      var target = slider(root, "Target CPU utilization", 30, 90, 5, 60, function (v) { return v + "%"; });
      var warm = slider(root, "Instance warmup", 0, 10, 1, 4, function (v) { return v + " min"; });
      var maxI = slider(root, "Max instances", 2, 30, 1, 12, function (v) { return v + ""; });
      var res = out(root);
      function demandAt(t, p) { // load units, 0..120 min
        if (p === 0) return t >= 40 && t < 75 ? 900 : 180;
        if (p === 1) return 400 + 350 * Math.sin((t - 20) / 120 * Math.PI * 2);
        return 150 + t * 6;
      }
      function calc() {
        var tg = target.get(), wu = warm.get(), mx = maxI.get(), p = pattern.idx;
        var perInst = 100; // load units at 100% CPU
        var eff = 2, pending = []; // [readyAt]
        var effSeries = [], demSeries = [], breach = [];
        for (var t = 0; t < 120; t++) {
          pending = pending.filter(function (r) { if (r <= t) { eff++; return false; } return true; });
          var d = Math.max(50, demandAt(t, p));
          var totalSoon = eff + pending.length;
          var desired = Math.min(mx, Math.max(2, Math.ceil(d / (perInst * tg / 100))));
          if (desired > totalSoon) for (var k = 0; k < desired - totalSoon; k++) pending.push(t + wu);
          else if (desired < eff && pending.length === 0) eff = Math.max(desired, eff - 1); // gentle scale-in
          var cpu = d / (eff * perInst) * 100;
          demSeries.push(d); effSeries.push(eff);
          breach.push(cpu > 95);
        }
        res.innerHTML = "";
        var wpx = 640, hpx = 110, pad = 30;
        function panel(series, ymax, color, label, breaches) {
          var pts = series.map(function (v, i) {
            return (pad + i / 119 * (wpx - pad - 8)).toFixed(1) + "," + (hpx - 18 - v / ymax * (hpx - 30)).toFixed(1);
          }).join(" ");
          var br = "";
          if (breaches) {
            var runs = [], start = null;
            for (var i = 0; i < 120; i++) {
              if (breaches[i] && start === null) start = i;
              if ((!breaches[i] || i === 119) && start !== null) { runs.push([start, i]); start = null; }
            }
            runs.forEach(function (r) {
              var x1 = pad + r[0] / 119 * (wpx - pad - 8), x2 = pad + r[1] / 119 * (wpx - pad - 8);
              br += '<rect x="' + x1.toFixed(1) + '" y="10" width="' + Math.max(2, x2 - x1).toFixed(1) + '" height="' + (hpx - 28) + '" fill="#b04a42" opacity="0.15"></rect>';
            });
          }
          return '<svg class="w-svg-chart" viewBox="0 0 ' + wpx + " " + hpx + '" role="img" aria-label="' + label + '">' + br +
            '<line x1="' + pad + '" y1="' + (hpx - 18) + '" x2="' + (wpx - 8) + '" y2="' + (hpx - 18) + '" stroke="#ddd0b8"></line>' +
            '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="2"></polyline>' +
            '<text x="' + pad + '" y="12" font-size="11" fill="#8a7f6a">' + label + "</text>" +
            '<text x="' + (wpx - 8) + '" y="' + (hpx - 4) + '" font-size="10" fill="#8a7f6a" text-anchor="end">0 → 120 min</text></svg>';
        }
        var dmax = Math.max.apply(null, demSeries) * 1.1;
        res.appendChild(h("<div>" + panel(demSeries, dmax, "#2c6c9e", "Demand (load units)", breach) + panel(effSeries, mx * 1.15, "#c4690a", "Running instances (max " + mx + ")", breach) + "</div>"));
        var breachMin = breach.filter(Boolean).length;
        if (breachMin) verdict(res, "no", "<strong>" + breachMin + " minutes over 95% CPU</strong> (red zones) — capacity arrived too late. Lower the target (more headroom), cut warmup (faster AMIs / warm pools), or for the spike pattern accept that reactive scaling can never beat a step function — that's what scheduled/predictive scaling or over-provisioned headroom are for.");
        else verdict(res, "ok", "No saturation. Now notice the cost angle: headroom (low target) buys resilience with idle capacity — the target utilization IS the cost/resilience dial.");
      }
      pattern.onchange = calc;
      [target, warm, maxI].forEach(function (s) { s.onchange = calc; });
      calc();
    }
  });

  /* ================================================================
   * 8. Lambda vs always-on cost (module: serverless)
   * ================================================================ */
  W({
    id: "lambda-cost",
    moduleId: "serverless",
    title: "Lambda vs always-on: the crossover",
    sub: "Serverless is not free compute — it's compute billed at request grain. Find where per-invocation pricing loses to a boring instance. Approximate pricing.",
    render: function (root) {
      var inv = slider(root, "Invocations / month", 0, 50, 1, 25, function (v) { return fmtN(invScale(v)); });
      function invScale(v) { return Math.round(Math.pow(10, 3 + v / 10)); }
      function fmtN(n) { return n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "k" : n; }
      var dur = slider(root, "Avg duration", 0, 12, 1, 4, function (i) { return [10, 25, 50, 100, 200, 350, 500, 750, 1000, 2000, 5000, 10000, 15000][i] + " ms"; });
      var DUR = [10, 25, 50, 100, 200, 350, 500, 750, 1000, 2000, 5000, 10000, 15000];
      var mem = slider(root, "Memory", 0, 6, 1, 2, function (i) { return [128, 256, 512, 1024, 2048, 4096, 10240][i] + " MB"; });
      var MEM = [128, 256, 512, 1024, 2048, 4096, 10240];
      var res = out(root);
      function calc() {
        var n = invScale(inv.get()), ms = DUR[dur.get()], mb = MEM[mem.get()];
        var gbs = n * (ms / 1000) * (mb / 1024);
        var lam = n / 1e6 * 0.20 + gbs * 0.0000166667;
        var t4g = 12.3; // t4g.small on-demand ~$0.0168/hr
        var fargate = 0.25 * 0.04048 * 730 + 0.5 * 0.004445 * 730; // 0.25 vCPU / 0.5GB
        res.innerHTML = "";
        bars(res, [
          { label: "Lambda", value: lam, cls: lam <= Math.min(t4g, fargate) ? "best" : "" },
          { label: "1× t4g.small 24/7", value: t4g, cls: t4g < lam && t4g <= fargate ? "best" : "", note: "no autoscaling story" },
          { label: "Fargate 0.25 vCPU 24/7", value: fargate, cls: fargate < lam && fargate < t4g ? "best" : "" }
        ], function (v) { return money(v) + "/mo"; });
        var util = gbs / (730 * 3600 * (mb / 1024)) * 100;
        verdict(res, "info", "Your function is 'busy' the equivalent of <strong>" + util.toFixed(2) + "%</strong> of one always-on instance of that size. Rule of thumb: Lambda wins hands-down below ~10-15% sustained utilization, gets debatable in the middle, and loses on raw $ at high, steady load — where its remaining value is ops (no patching, scaling, AZ spread for free). Also remember: cutting memory can RAISE cost when CPU-bound duration stretches — tune with Power Tuning, don't guess.");
      }
      [inv, dur, mem].forEach(function (s) { s.onchange = calc; });
      calc();
    }
  });

  /* ================================================================
   * 9. Data-transfer cost traps (module: cost)
   * ================================================================ */
  W({
    id: "transfer-cost",
    moduleId: "cost",
    title: "Data-transfer cost traps",
    sub: "The same gigabyte costs wildly different money depending on the path. This is the #1 real-world AWS bill surprise. Approximate pricing.",
    render: function (root) {
      var gb = slider(root, "Traffic volume / month", 0, 40, 1, 20, function (v) { return fmtGb(gbScale(v)); });
      function gbScale(v) { return Math.round(Math.pow(10, 1 + v / 10)); }
      function fmtGb(g) { return g >= 1000 ? (g / 1000).toFixed(1) + " TB" : g + " GB"; }
      var res = out(root);
      function calc() {
        var g = gbScale(gb.get());
        var rows = [
          { label: "Same-AZ, private IP", value: 0, note: "free" },
          { label: "S3 via gateway endpoint", value: 0, note: "free" },
          { label: "Cross-AZ (both directions)", value: g * 0.02 },
          { label: "Through NAT Gateway", value: g * 0.045, note: "+ $33/mo per NAT" },
          { label: "Cross-region (us→eu)", value: g * 0.02 },
          { label: "Egress via CloudFront", value: g * 0.085 },
          { label: "Egress direct to internet", value: g * 0.09 }
        ];
        res.innerHTML = "";
        bars(res, rows.map(function (r, i) {
          return { label: r.label, value: r.value, cls: r.value === 0 ? "best" : i === rows.length - 1 ? "worst" : "", note: r.note || "" };
        }), function (v) { return v === 0 ? "$0" : money(v) + "/mo"; });
        verdict(res, "info", "Three lessons the exam and your CFO agree on: <strong>(1)</strong> keep chatty traffic inside one AZ or behind private IPs, <strong>(2)</strong> S3/DynamoDB traffic should never traverse a NAT Gateway — gateway endpoints are free, <strong>(3)</strong> internet egress goes out through CloudFront slightly cheaper than raw EC2 egress, plus caching cuts the volume itself.");
      }
      gb.onchange = calc;
      calc();
    }
  });

  /* ================================================================
   * 10. Kinesis shard calculator (module: messaging)
   * ================================================================ */
  W({
    id: "kinesis-shards",
    moduleId: "messaging",
    title: "Kinesis shard calculator",
    sub: "Shards are the unit of everything in Kinesis: ordering, throughput, and cost. Size a stream and see when enhanced fan-out — or plain SQS — is the right call.",
    render: function (root) {
      var rate = slider(root, "Records per second", 0, 40, 1, 20, function (v) { return fmtN(rScale(v)) + "/s"; });
      function rScale(v) { return Math.round(Math.pow(10, 1 + v / 10)); }
      function fmtN(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? (n / 1e3).toFixed(0) + "k" : n; }
      var sz = slider(root, "Record size", 0, 6, 1, 2, function (i) { return [0.2, 1, 5, 25, 100, 500, 1000][i] + " KB"; });
      var SZ = [0.2, 1, 5, 25, 100, 500, 1000];
      var cons = slider(root, "Consumer applications", 1, 6, 1, 2, function (v) { return v + ""; });
      var res = out(root);
      function calc() {
        var rps = rScale(rate.get()), kb = SZ[sz.get()], nc = cons.get();
        var mbps = rps * kb / 1024;
        var ingestShards = Math.max(Math.ceil(mbps / 1), Math.ceil(rps / 1000));
        var egressNeed = mbps * nc;
        var sharedShards = Math.ceil(egressNeed / 2);
        var shards = Math.max(ingestShards, sharedShards);
        var shardsEfo = ingestShards;
        var costShared = shards * 0.015 * 730 + rps * 2592000 / 1e6 * Math.ceil(kb / 25) * 0.014;
        var costEfo = shardsEfo * 0.015 * 730 + rps * 2592000 / 1e6 * Math.ceil(kb / 25) * 0.014 + shardsEfo * nc * 0.015 * 730 + egressNeed * 0.0000 /* retrieval approx omitted */ + mbps * 2592000 / 1024 * nc * 0.013;
        res.innerHTML = "";
        res.appendChild(h('<div class="w-result"><div><strong>Ingress:</strong> ' + mbps.toFixed(2) + " MB/s and " + fmtN(rps) + " rec/s ⇒ needs <span class='big'>" + ingestShards + "</span> shard(s) (1 MB/s or 1000 rec/s each)</div>" +
          "<div style='margin-top:0.4rem'><strong>Egress:</strong> " + nc + " consumer(s) × " + mbps.toFixed(2) + " MB/s = " + egressNeed.toFixed(2) + " MB/s vs shared 2 MB/s per shard ⇒ shared fan-out needs <strong>" + shards + "</strong> shard(s); enhanced fan-out keeps it at <strong>" + shardsEfo + "</strong> (dedicated 2 MB/s per consumer per shard)</div></div>"));
        bars(res, [
          { label: "Shared fan-out (" + shards + " shards)", value: costShared, cls: costShared <= costEfo ? "best" : "" },
          { label: "Enhanced fan-out (" + shardsEfo + " shards)", value: costEfo, cls: costEfo < costShared ? "best" : "", note: "+ ~70ms → ~30ms latency" }
        ], function (v) { return money(v) + "/mo"; });
        if (nc === 1 && rps < 3000) {
          verdict(res, "info", "One consumer, modest rate: ask the exam question — do you need <strong>replay, strict ordering, or multiple readers</strong>? If not, SQS is simpler, scales without shard math, and is almost always the intended answer for plain decoupling.");
        } else if (sharedShards > ingestShards) {
          verdict(res, "no", "Notice: your consumer count forced MORE shards than ingest needs — you're paying for shards just to multiply read bandwidth. That is exactly the problem enhanced fan-out exists to solve.");
        } else {
          verdict(res, "ok", "Ingest-bound sizing. Remember each shard is an ordered lane: your partition key choice decides whether these shards are actually load-balanced or one hot key melts a single shard.");
        }
      }
      [rate, sz, cons].forEach(function (s) { s.onchange = calc; });
      calc();
    }
  });

  /* ================================================================
   * 11. EBS gp3 tuner (module: block-file)
   * ================================================================ */
  W({
    id: "gp3-tuner",
    moduleId: "block-file",
    title: "EBS volume tuner: gp3 vs gp2 vs io2",
    sub: "gp3 decoupled size from performance — most gp2 volumes are now overpaying. Tune a volume and see. Approximate pricing.",
    render: function (root) {
      var size = slider(root, "Volume size", 0, 30, 1, 15, function (v) { return szScale(v) + " GB"; });
      function szScale(v) { return Math.round(Math.pow(10, 1 + v / 10) / 10) * 10; }
      var iops = slider(root, "IOPS needed", 0, 13, 1, 3, function (i) { return fmtN(IOPS[i]); });
      var IOPS = [500, 1000, 3000, 4000, 6000, 8000, 12000, 16000, 20000, 32000, 48000, 64000, 128000, 256000];
      function fmtN(n) { return n >= 1000 ? (n / 1000) + "k" : n; }
      var tput = slider(root, "Throughput needed", 0, 8, 1, 1, function (i) { return TPUT[i] + " MB/s"; });
      var TPUT = [125, 250, 400, 500, 700, 1000, 2000, 3000, 4000];
      var res = out(root);
      function calc() {
        var g = szScale(size.get()), io = IOPS[iops.get()], tp = TPUT[tput.get()];
        var gp3 = null, gp3note = "";
        if (io <= 16000 && tp <= 1000) {
          gp3 = g * 0.08 + Math.max(0, io - 3000) * 0.005 + Math.max(0, tp - 125) * 0.04;
        } else gp3note = "exceeds gp3 limits (16k IOPS / 1000 MB/s)";
        var gp2g = Math.max(g, Math.ceil(io / 3)); // gp2 IOPS = 3x GB
        var gp2 = gp2g * 0.10;
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
        bars(res, rows, function (v) { return money(v) + "/mo"; });
        if (gp3note) verdict(res, "info", "gp3 " + gp3note + " — this requirement is io2 Block Express (or striping multiple volumes) territory.");
        else if (best.label.indexOf("gp3") === 0) verdict(res, "ok", "gp3 wins — and its baseline 3000 IOPS / 125 MB/s is independent of size, unlike gp2 where IOPS = 3× GB and people bought empty terabytes just for IOPS. That gp2→gp3 migration is a free ~20% saving and a favorite exam cost answer.");
        else verdict(res, "info", "io2 earns its premium only for sustained high IOPS with durability requirements (databases). For everything else, tuned gp3 is the default.");
      }
      [size, iops, tput].forEach(function (s) { s.onchange = calc; });
      calc();
    }
  });
})();
