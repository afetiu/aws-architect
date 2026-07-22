/* Animated / visual simulators, wave 2. Same registry contract as widgets.js.
 * Animated widgets self-stop when their DOM is detached (root.isConnected). */
(function () {
  "use strict";
  function h(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function slider(root, label, min, max, step, value, fmt) {
    var row = h('<div class="w-row"><label>' + esc(label) + '</label><input type="range"><span class="w-val"></span></div>');
    var inp = row.querySelector("input"), val = row.querySelector(".w-val");
    inp.min = min; inp.max = max; inp.step = step; inp.value = value;
    var api = { el: row, get: function () { return +inp.value; }, onchange: null };
    function refresh() { val.textContent = fmt(+inp.value); }
    inp.addEventListener("input", function () { refresh(); if (api.onchange) api.onchange(); });
    refresh();
    root.appendChild(row);
    return api;
  }
  function chips(root, label, options, selIdx) {
    var wrap = h('<div class="w-row"><label>' + esc(label) + '</label><div class="w-chip-row"></div></div>');
    var box = wrap.querySelector(".w-chip-row");
    var api = { idx: selIdx, onchange: null };
    options.forEach(function (o, i) {
      var c = h('<span class="w-chip' + (i === selIdx ? " sel" : "") + '">' + esc(o) + "</span>");
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
  function verdict(root, kind, html) { root.appendChild(h('<div class="w-verdict ' + kind + '">' + html + "</div>")); }
  function out(root) { var d = h("<div></div>"); root.appendChild(d); return d; }
  var W = function (s) { window.COURSE.registerWidget(s); };

  /* ================================================================
   * Subnet carver (vpc) — click blocks to split CIDR space visually
   * ================================================================ */
  W({
    id: "subnet-carver",
    moduleId: "vpc",
    title: "Subnet carver",
    sub: "Start with a /16 and carve it like address-space butter. Click a block to split it in half; watch usable IPs shrink (AWS eats 5 per subnet).",
    render: function (root) {
      var BASE = (10 << 24); // 10.0.0.0
      var blocks = [{ base: 0, prefix: 16 }];
      var stage = h('<div class="sim-stage"><div class="carve" style="display:flex;gap:3px;align-items:stretch"></div></div>');
      root.appendChild(stage);
      var res = out(root);
      var btns = h('<div class="row" style="margin-top:0.6rem"><button id="resetc">Reset to /16</button></div>');
      root.appendChild(btns);
      btns.querySelector("#resetc").onclick = function () { blocks = [{ base: 0, prefix: 16 }]; draw(); };
      function ip(n) {
        var v = BASE + n;
        return ((v >>> 24) & 255) + "." + ((v >>> 16) & 255) + "." + ((v >>> 8) & 255) + "." + (v & 255);
      }
      function draw() {
        var box = stage.querySelector(".carve");
        box.innerHTML = "";
        blocks.forEach(function (b, i) {
          var frac = Math.pow(2, 16 - (b.prefix - 16)) / Math.pow(2, 16) * 100 * Math.pow(2, 16); // simplify below
          var widthPct = 100 / Math.pow(2, b.prefix - 16);
          var usable = Math.pow(2, 32 - b.prefix) - 5;
          var el2 = h('<div class="subnet-block" style="width:' + widthPct + '%"><span>/' + b.prefix + "</span>" +
            (widthPct > 8 ? '<span class="cnt">' + ip(b.base) + "</span><span class='cnt'>" + usable.toLocaleString() + " usable</span>" : "") + "</div>");
          el2.title = ip(b.base) + "/" + b.prefix + " — " + usable.toLocaleString() + " usable IPs (=" + Math.pow(2, 32 - b.prefix).toLocaleString() + " − 5 reserved)";
          el2.onclick = function () {
            if (b.prefix >= 24 || blocks.length >= 24) return;
            var half = Math.pow(2, 32 - b.prefix - 1);
            blocks.splice(i, 1, { base: b.base, prefix: b.prefix + 1 }, { base: b.base + half, prefix: b.prefix + 1 });
            draw();
          };
          box.appendChild(el2);
        });
        res.innerHTML = "";
        var smallest = Math.max.apply(null, blocks.map(function (b) { return b.prefix; }));
        verdict(res, "info", blocks.length === 1
          ? "One /16 = 65,536 addresses. Click it. Notice every split halves the space and costs you 5 more reserved IPs per subnet — subnetting is never free."
          : blocks.length + " subnets. Smallest is /" + smallest + " (" + (Math.pow(2, 32 - smallest) - 5).toLocaleString() + " usable). Real-world rule: <strong>carve big</strong> (/20s per AZ-tier), because EKS pods, ALB nodes, interface endpoints and Lambda ENIs all quietly eat IPs — and you cannot resize a subnet, ever.");
      }
      draw();
    }
  });

  /* ================================================================
   * DynamoDB hot partition visualizer (dynamodb)
   * ================================================================ */
  W({
    id: "ddb-partitions",
    moduleId: "dynamodb",
    title: "Hot partition visualizer",
    sub: "Fire 200 writes at 8 partitions with different partition-key designs. Watch where they land — and which key melts a partition.",
    render: function (root) {
      var strat = chips(root, "Partition key design", ["userId (high cardinality)", "tenantId (one big tenant)", "date (today)"], 0);
      var stage = h('<div class="sim-stage"><div class="part-wrap"></div><div style="display:flex;gap:6px"></div></div>');
      root.appendChild(stage);
      var res = out(root);
      var runBtn = h('<div class="row" style="margin-top:0.6rem"><button class="primary" id="fire">Fire 200 writes</button></div>');
      root.appendChild(runBtn);
      var N = 8, CAP = 40;
      var counts, throttles, timer = null;
      function reset() {
        counts = []; throttles = 0;
        for (var i = 0; i < N; i++) counts.push(0);
        draw();
        res.innerHTML = "";
      }
      function draw() {
        var wrap = stage.querySelector(".part-wrap");
        wrap.innerHTML = "";
        var labels = stage.querySelector("div:last-child");
        labels.innerHTML = "";
        counts.forEach(function (c, i) {
          var hpx = Math.min(150, c / CAP * 110);
          var col = h('<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:150px">' +
            '<div class="part-bar' + (c > CAP ? " hot" : "") + '" style="height:' + Math.max(2, hpx) + 'px"></div></div>');
          wrap.appendChild(col);
          labels.appendChild(h('<div class="part-label" style="flex:1">P' + i + "<br>" + c + (c > CAP ? " 🔥" : "") + "</div>"));
        });
      }
      runBtn.querySelector("#fire").onclick = function () {
        reset();
        var sent = 0;
        var hotIdx = 3; // deterministic "hash" of the big tenant / today's date
        clearInterval(timer);
        timer = setInterval(function () {
          if (!root.isConnected || sent >= 200) {
            clearInterval(timer);
            if (root.isConnected) finish();
            return;
          }
          for (var k = 0; k < 8 && sent < 200; k++, sent++) {
            var p;
            if (strat.idx === 0) p = Math.floor(Math.random() * N);
            else if (strat.idx === 1) p = Math.random() < 0.8 ? hotIdx : Math.floor(Math.random() * N);
            else p = hotIdx;
            counts[p]++;
            if (counts[p] > CAP) throttles++;
          }
          draw();
        }, 90);
      };
      function finish() {
        res.innerHTML = "";
        if (strat.idx === 0) verdict(res, "ok", "Uniform spread — every partition under capacity. High-cardinality, evenly-accessed partition keys are the whole game. This is why <strong>userId</strong> beats <strong>status</strong> or <strong>date</strong> as a key.");
        else if (strat.idx === 1) verdict(res, "no", throttles + " throttled writes. Adaptive capacity shifts unused throughput toward the hot partition, but it cannot exceed the per-partition ceiling (~1000 WCU/s, 3000 RCU/s). Fix: <strong>write sharding</strong> — suffix the key (tenantA#0…tenantA#9) and fan reads back in.");
        else verdict(res, "no", throttles + " throttled writes and 7 idle partitions you are still paying for. A date/time partition key means today IS one partition — the classic time-series anti-pattern. Fix: shard the hot day, or model time in the SORT key under a higher-cardinality partition key.");
      }
      reset();
    }
  });

  /* ================================================================
   * SQS visibility timeout & poison pill (messaging)
   * ================================================================ */
  W({
    id: "sqs-visibility",
    moduleId: "messaging",
    title: "SQS visibility timeout & the poison pill",
    sub: "Twelve messages, one of them poisoned. Watch delivery, failure, redelivery, and the DLQ do its job. Dots: blue=queued, yellow=in flight, green=done, red=poison, dark=DLQ.",
    render: function (root) {
      var failRate = slider(root, "Consumer failure rate", 0, 60, 10, 20, function (v) { return v + "%"; });
      var maxRecv = slider(root, "maxReceiveCount (DLQ threshold)", 1, 5, 1, 3, function (v) { return v + ""; });
      var stage = h('<div class="sim-stage">' +
        '<div class="lane"><span class="lane-label">Queue</span><span class="l q"></span></div>' +
        '<div class="lane"><span class="lane-label">In flight</span><span class="l f"></span></div>' +
        '<div class="lane"><span class="lane-label">Processed</span><span class="l d"></span></div>' +
        '<div class="lane"><span class="lane-label">DLQ</span><span class="l x"></span></div></div>');
      root.appendChild(stage);
      var res = out(root);
      var btn = h('<div class="row" style="margin-top:0.6rem"><button class="primary" id="run">Run</button></div>');
      root.appendChild(btn);
      var timer = null;
      btn.querySelector("#run").onclick = function () {
        clearInterval(timer);
        var msgs = [];
        for (var i = 0; i < 12; i++) msgs.push({ state: "q", recv: 0, poison: i === 4, ticksLeft: 0 });
        res.innerHTML = "";
        function draw() {
          ["q", "f", "d", "x"].forEach(function (lane) {
            var box = stage.querySelector(".l." + lane);
            box.innerHTML = "";
            msgs.forEach(function (m) {
              if (m.state !== lane) return;
              var cls = "msg-dot" + (m.state === "f" ? " inflight" : m.state === "d" ? " done" : m.state === "x" ? " dlq" : "");
              if (m.poison && m.state !== "x") cls += " poison";
              var dot = h('<span class="' + cls + '"></span>');
              dot.title = (m.poison ? "poison message" : "message") + " · receives: " + m.recv;
              box.appendChild(dot);
            });
          });
        }
        timer = setInterval(function () {
          if (!root.isConnected) { clearInterval(timer); return; }
          // consumers pick up to 3 queued messages
          var picked = 0;
          msgs.forEach(function (m) {
            if (m.state === "q" && picked < 3) { m.state = "f"; m.recv++; m.ticksLeft = 2; picked++; }
          });
          // process in-flight
          msgs.forEach(function (m) {
            if (m.state !== "f") return;
            m.ticksLeft--;
            if (m.ticksLeft <= 0) {
              var fails = m.poison || Math.random() * 100 < failRate.get();
              if (!fails) m.state = "d";
              else if (m.recv >= maxRecv.get()) m.state = "x";
              else m.state = "q"; // visibility timeout expired → redelivered
            }
          });
          draw();
          if (msgs.every(function (m) { return m.state === "d" || m.state === "x"; })) {
            clearInterval(timer);
            var dlq = msgs.filter(function (m) { return m.state === "x"; }).length;
            var redeliveries = msgs.reduce(function (a, m) { return a + m.recv; }, 0) - msgs.length;
            verdict(res, dlq && dlq < 4 ? "ok" : dlq >= 4 ? "no" : "info",
              msgs.filter(function (m) { return m.state === "d"; }).length + " processed, " + redeliveries + " redeliveries, " + dlq + " in the DLQ. " +
              (dlq === 0 ? "No DLQ arrivals — but note the poison message only survived because failure rate rescued it randomly; run again." :
                "The poison message failed " + maxRecv.get() + " times and was quarantined instead of looping forever — that loop is exactly what burns Lambda concurrency and money when there is no DLQ. Also notice healthy messages that failed once got <strong>redelivered</strong>: SQS is at-least-once, so consumers must be idempotent."));
          }
        }, 450);
        draw();
      };
    }
  });

  /* ================================================================
   * Lambda concurrency rainfall (serverless)
   * ================================================================ */
  W({
    id: "lambda-concurrency",
    moduleId: "serverless",
    title: "Lambda concurrency, live",
    sub: "Concurrency = arrival rate × duration (Little's law). Watch execution environments spin up cold, go warm, and throttle at the limit.",
    render: function (root) {
      var rps = slider(root, "Requests per second", 1, 40, 1, 10, function (v) { return v + " rps"; });
      var dur = slider(root, "Function duration", 200, 3000, 100, 1000, function (v) { return v + " ms"; });
      var limit = slider(root, "Concurrency limit (reserved)", 2, 60, 1, 15, function (v) { return v + ""; });
      var stage = h('<div class="sim-stage"><div class="envs" style="display:flex;flex-wrap:wrap;gap:3px;min-height:60px"></div>' +
        '<div class="muted" style="margin-top:0.5rem;font-size:0.8rem" id="stats"></div></div>');
      root.appendChild(stage);
      var res = out(root);
      var btn = h('<div class="row" style="margin-top:0.6rem"><button class="primary" id="go">Run 10 seconds</button></div>');
      root.appendChild(btn);
      var timer = null;
      btn.querySelector("#go").onclick = function () {
        clearInterval(timer);
        var envs = [], throttled = 0, done = 0, acc = 0, t = 0, peak = 0;
        res.innerHTML = "";
        timer = setInterval(function () {
          if (!root.isConnected || t >= 100) {
            clearInterval(timer);
            if (root.isConnected) finish();
            return;
          }
          t++;
          var now = t * 100;
          acc += rps.get() / 10;
          while (acc >= 1) {
            acc -= 1;
            var e = envs.find(function (x) { return x.busyUntil <= now; });
            if (e) { e.busyUntil = now + dur.get(); e.warm = true; }
            else if (envs.length < limit.get()) {
              envs.push({ coldUntil: now + 700, busyUntil: now + 700 + dur.get(), warm: false });
            } else throttled++;
          }
          envs.forEach(function (e2) { if (e2.busyUntil <= now && e2.busyUntil > now - 100) done++; });
          var active = envs.filter(function (e2) { return e2.busyUntil > now; }).length;
          if (active > peak) peak = active;
          var box = stage.querySelector(".envs");
          box.innerHTML = "";
          envs.forEach(function (e2) {
            var cls = e2.coldUntil > now ? "background:var(--yellow-soft);border-color:var(--yellow)" :
              e2.busyUntil > now ? "background:var(--blue-soft);border-color:var(--blue)" :
                "background:var(--green-soft);border-color:var(--green)";
            box.appendChild(h('<span style="display:inline-block;width:22px;height:22px;border-radius:5px;border:1.5px solid;' + cls + '"></span>'));
          });
          document.getElementById("stats") && (stage.querySelector("#stats").textContent =
            "envs: " + envs.length + " · active: " + active + " · throttled (429): " + throttled + " · t=" + (now / 1000).toFixed(1) + "s  (yellow=cold-starting, blue=busy, green=warm idle)");
        }, 100);
        function finish() {
          var need = Math.ceil(rps.get() * dur.get() / 1000);
          verdict(res, throttled ? "no" : "ok",
            "Little's law says steady-state concurrency ≈ " + rps.get() + " rps × " + (dur.get() / 1000).toFixed(1) + "s = <strong>" + need + "</strong>. Your limit was " + limit.get() + " → " + (throttled ? throttled + " requests throttled with 429s. Raise the limit, shorten the function, or queue the work (SQS in front absorbs bursts)." : "no throttling, peak concurrency " + peak + ". Note the yellow cold starts at ramp-up — provisioned concurrency pre-bakes those environments when p99 latency matters."));
        }
      };
    }
  });

  /* ================================================================
   * Aurora quorum game (rds-aurora)
   * ================================================================ */
  W({
    id: "aurora-quorum",
    moduleId: "rds-aurora",
    title: "Aurora quorum: kill things",
    sub: "Six storage nodes, three AZs, 4/6 write quorum, 3/6 read quorum. Click nodes (or nuke a whole AZ) and see what survives.",
    render: function (root) {
      var stage = h('<div class="sim-stage"><div style="display:flex;gap:1.6rem;justify-content:center" class="azs"></div></div>');
      root.appendChild(stage);
      var res = out(root);
      var btns = h('<div class="row" style="margin-top:0.6rem"><button id="killaz">💥 Kill AZ-a</button><button id="reset2">Reset</button></div>');
      root.appendChild(btns);
      var dead = {};
      function draw() {
        var box = stage.querySelector(".azs");
        box.innerHTML = "";
        ["a", "b", "c"].forEach(function (az) {
          var col = h('<div style="text-align:center"><div class="muted" style="font-size:0.72rem;margin-bottom:0.3rem">AZ-' + az + '</div><div style="display:flex;gap:0.4rem"></div></div>');
          [1, 2].forEach(function (n) {
            var id = az + n;
            var node = h('<span class="q-node' + (dead[id] ? " dead" : "") + '">' + id + "</span>");
            node.onclick = function () { dead[id] = !dead[id]; draw(); };
            col.querySelector("div:last-child").appendChild(node);
          });
          box.appendChild(col);
        });
        var alive = 6 - Object.keys(dead).filter(function (k) { return dead[k]; }).length;
        res.innerHTML = "";
        var writes = alive >= 4, reads = alive >= 3;
        verdict(res, writes ? "ok" : "no", "<strong>Writes " + (writes ? "OK" : "BLOCKED") + "</strong> — " + alive + "/6 nodes alive, write quorum needs 4/6." + (writes ? "" : " The cluster stalls writes but loses nothing; when nodes return, gossip + repair catch them up from peers."));
        verdict(res, reads ? "ok" : "no", "<strong>Reads " + (reads ? "OK" : "BLOCKED") + "</strong> — read quorum needs 3/6." + (alive === 3 ? " This is the design point: a whole AZ gone (2 nodes) PLUS one more node (AZ+1 failure) still serves reads." : ""));
        if (alive === 4) verdict(res, "info", "Exactly at write quorum: one entire AZ is gone and writes still flow. This is why Aurora's storage replicates 6 ways across 3 AZs while the redo-log-only writes keep network cost sane.");
      }
      btns.querySelector("#killaz").onclick = function () { dead.a1 = dead.a2 = true; draw(); };
      btns.querySelector("#reset2").onclick = function () { dead = {}; draw(); };
      draw();
    }
  });
})();
