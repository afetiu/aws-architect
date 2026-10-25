/* scene: board-vpc — the living isometric VPC board (port of lab/board).
   Isometric VPC with live packets, a guided step scrubber over three chapters
   (inbound / egress / S3 via endpoint), the gateway-endpoint toggle and the NAT bill.
   Journey rules: the whole VPC is fitted into the frame (no pan), the canvas is
   touch-action: pan-y so the reel keeps scrolling over it, tap a block for its sheet.
   The rAF loop only runs while the scene is live (enter/leave). */
(function () {
  "use strict";
  var J = window.JOURNEY, LAB = window.LAB;

  var CSS = [
    ".scene-board-vpc .bv-stage { position: relative; height: clamp(290px, 40vh, 460px); margin: 18px -20px 0; user-select: none; -webkit-user-select: none; touch-action: pan-y;",
    "  background: radial-gradient(ellipse 90% 70% at 50% 45%, rgba(127,166,214,0.05), rgba(22,22,22,0.55) 70%); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }",
    ".scene-board-vpc .bv-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: pan-y; cursor: pointer; }",
    ".scene-board-vpc .bv-hint { position: absolute; left: 14px; bottom: 10px; font-family:var(--body); font-size: 10.5px; letter-spacing:0; text-transform:none; color: var(--ink-dim); pointer-events: none; transition: opacity .6s; white-space: nowrap; }",
    ".scene-board-vpc .bv-legend { position: absolute; left: 14px; top: 12px; display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--ink-dim); pointer-events: none; }",
    ".scene-board-vpc .bv-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; box-shadow: 0 0 8px currentColor; background: currentColor; }",
    ".scene-board-vpc .bv-side { margin-top: 14px; }",
    ".scene-board-vpc .bv-chapters { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0 10px; scrollbar-width: none; }",
    ".scene-board-vpc .bv-chapters::-webkit-scrollbar { display: none; }",
    ".scene-board-vpc .bv-chapters .chip { flex: none; min-height: 40px; }",
    ".scene-board-vpc .bv-caption { padding: 14px 16px; }",
    ".scene-board-vpc .bv-caption .top { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }",
    ".scene-board-vpc .bv-step { font-family: var(--mono); font-size: 12px; color: var(--accent); }",
    ".scene-board-vpc .bv-caption p { font-size: 14.5px; line-height: 1.5; color: var(--ink); min-height: 6em; transition: opacity .25s; }",
    ".scene-board-vpc .bv-caption p.swap { opacity: 0; }",
    ".scene-board-vpc .bv-caption .nav { display: flex; gap: 8px; }",
    ".scene-board-vpc .bv-caption .nav .btn { min-height: 44px; }",
    ".scene-board-vpc .bv-scrub { margin-top: 4px; touch-action: pan-y; }",
    ".scene-board-vpc .bv-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 10px; }",
    ".scene-board-vpc .bv-stats .panel { padding: 12px 14px; }",
    ".scene-board-vpc .bv-stats .v { font-size: 22px; }",
    ".scene-board-vpc .bv-controls { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 10px; }",
    ".scene-board-vpc .bv-controls .panel { padding: 12px 14px; }",
    ".scene-board-vpc .bv-controls .toggle { width: 100%; justify-content: space-between; min-height: 44px; }",
    ".scene-board-vpc .bv-controls .toggle span:first-child { font-size: 14px; color: var(--ink); font-weight: 500; }",
    ".scene-board-vpc .bv-note { margin-top: 8px; font-size: 13px; color: var(--ink-dim); line-height: 1.5; }",
    ".scene-board-vpc .bv-note b { color: var(--ink-2); font-weight: 500; }",
    ".scene-board-vpc .bv-load { touch-action: pan-y; }",
    "@media (min-width: 560px) { .scene-board-vpc .bv-controls { grid-template-columns: 1fr 1fr; } }",
    "@media (min-width: 900px) {",
    "  .scene-board-vpc .bv-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 14px; align-items: start; margin-top: 18px; }",
    "  .scene-board-vpc .bv-stage { margin: 0; height: 500px; max-height: none; border-radius: var(--r); overflow: hidden; border: 1px solid var(--line); }",
    "  .scene-board-vpc .bv-side { margin-top: 0; }",
    "  .scene-board-vpc .bv-chapters { flex-wrap: wrap; overflow: visible; }",
    "  .scene-board-vpc .bv-controls { grid-template-columns: 1fr; }",
    "  .scene-board-vpc .bv-caption p { min-height: 7.5em; }",
    "}"
  ].join("\n");

  function injectCSS() {
    if (document.getElementById("css-board-vpc")) return;
    var s = document.createElement("style"); s.id = "css-board-vpc"; s.textContent = CSS; document.head.appendChild(s);
  }

  var HTML =
    '<div class="eyebrow rv"><span>Living board</span><span class="dim">your VPC, running</span></div>' +
    '<h2 class="rv">Follow one request through the VPC.</h2>' +
    '<p class="lead rv">Tap any block. Step the request through. Flip the endpoint and watch the bill.</p>' +
    '<div class="bv-grid rv">' +
      '<div class="bv-stage">' +
        '<canvas aria-label="Isometric VPC: internet, internet gateway, ALB and NAT in the public subnet, EC2 and RDS in the private subnet, S3 behind a gateway endpoint"></canvas>' +
        '<div class="bv-legend"><span><i style="color:#7fa6d6"></i>request</span><span><i style="color:#6dba88"></i>reply</span><span><i style="color:#d2ad5e"></i>NAT-billed</span></div>' +
        '<div class="bv-hint">Tap a block</div>' +
      '</div>' +
      '<div class="bv-side">' +
        '<div class="bv-chapters" role="tablist" aria-label="Flows"></div>' +
        '<div class="panel bv-caption">' +
          '<div class="top"><span class="bv-step">Step 1 / 5</span>' +
            '<div class="nav"><button class="btn sm ghost bv-prev" aria-label="Previous step">←</button><button class="btn sm bv-next">Next step</button></div></div>' +
          '<p class="bv-text"></p>' +
          '<input class="bv-scrub" type="range" min="0" max="1000" value="0" aria-label="Scrub the request through the path">' +
        '</div>' +
        '<div class="bv-stats">' +
          '<div class="panel stat"><span class="k">NAT bill / mo</span><span class="v warn bv-cost">$0</span></div>' +
          '<div class="panel stat"><span class="k">In flight</span><span class="v flow bv-inflight">0</span></div>' +
          '<div class="panel stat"><span class="k">Delivered</span><span class="v ok bv-delivered">0</span></div>' +
        '</div>' +
        '<div class="bv-controls">' +
          '<div class="panel">' +
            '<button class="toggle bv-vpce" role="switch" aria-checked="false"><span>S3 gateway endpoint</span><span class="sw"></span></button>' +
            '<div class="bv-note bv-vpcewhy"><b>Off:</b> S3 reads leave through the NAT gateway and the IGW. Every GB is billed by the NAT.</div>' +
          '</div>' +
          '<div class="panel">' +
            '<div class="row"><label>S3 reads per month</label><span class="val bv-loadval">20 TB</span></div>' +
            '<input class="bv-load" type="range" min="1" max="60" value="20" aria-label="S3 reads per month in TB">' +
            '<div class="bv-note">Drag it. Watch the lane and the bill, not the number.</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  J.registerScene("board-vpc", {
    wide: true,
    label: function () { return "Living board · your VPC"; },
    render: function (el) {
      injectCSS();
      el.innerHTML = HTML;
      var $ = function (s) { return el.querySelector(s); };

      /* ---------------- world ---------------- */
      var C = { plate: "rgba(127,166,214,0.06)", plateLine: "rgba(127,166,214,0.28)", sub: "rgba(255,255,255,0.035)", subLine: "rgba(255,255,255,0.14)",
        flow: "#7fa6d6", ok: "#6dba88", warn: "#d2ad5e", bad: "#d7776d", accent: "#df7a4c", ink: "#ecebe8", dim: "#8a8882" };
      var PALETTE = { orange: ["#df7a4c", "#c9601f", "#9a4512"], blue: ["#7fa6d6", "#2f6fc4", "#214f8e"], green: ["#6dba88", "#2e9c5f", "#1e6b42"], yellow: ["#d2ad5e", "#c99a2c", "#8e6a18"], grey: ["#8f98a8", "#5b6473", "#424a57"], cyan: ["#7fa6d6", "#2f9ac4", "#20688a"] };

      var plates = [
        { id: "vpc", x: 0, y: 0, w: 12, d: 9, label: "VPC · 10.0.0.0/16", fill: C.plate, line: C.plateLine },
        { id: "pub", x: 0.8, y: 0.8, w: 10.4, d: 3, label: "Public · 10.0.1.0/24", fill: C.sub, line: C.subLine },
        { id: "priv", x: 0.8, y: 5.2, w: 10.4, d: 3, label: "Private · 10.0.2.0/24", fill: C.sub, line: C.subLine }
      ];
      var nodes = [
        { id: "internet", x: 5.3, y: -4.8, w: 2.4, d: 1.4, h: 0.5, color: "grey", label: "Internet", sub: "untrusted",
          info: "<div class='eyebrow'>Outside</div><h3>The internet</h3><p>Everything out here is untrusted. The only doors into the VPC are the gateways you attach to it.</p><div class='fact'><b>Remember</b><span>No gateway, no door. A VPC with no IGW is unreachable from the internet by construction.</span></div>" },
        { id: "igw", x: 5.3, y: -0.9, w: 2.4, d: 1.4, h: 0.9, color: "orange", label: "IGW", sub: "internet gateway", subUp: true,
          info: "<div class='eyebrow'>VPC edge</div><h3>Internet Gateway</h3><p>A horizontally scaled, highly available 1:1 NAT between public IPs and private IPs. No bandwidth limit, no cost.</p><p>It only works for subnets whose route table sends <span class='mono'>0.0.0.0/0</span> to it. That route is what makes a subnet \"public\".</p><div class='fact'><b>Exam tip</b><span>\"Instance has a public IP but no internet\" → the subnet's route table is missing the IGW route.</span></div>" },
        { id: "alb", x: 1.6, y: 1.5, w: 2.6, d: 1.6, h: 1.1, color: "orange", label: "ALB", sub: "L7 · SG-attached",
          info: "<div class='eyebrow'>Public subnet</div><h3>Application Load Balancer</h3><p>Terminates TLS, evaluates listener rules, then opens a <em>new</em> connection to a healthy target. Lives in at least two subnets across two AZs.</p><p>Its security group is the first policy gate for inbound traffic.</p><div class='fact'><b>Exam tip</b><span>Client IP survives only in <span class='mono'>X-Forwarded-For</span>; the target sees the ALB as the source.</span></div>" },
        { id: "nat", x: 8.2, y: 1.5, w: 2.4, d: 1.6, h: 1.1, color: "yellow", label: "NAT", sub: "per-AZ · $/GB",
          info: "<div class='eyebrow'>Public subnet</div><h3>NAT Gateway</h3><p>Managed source-NAT for private subnets. One per AZ for HA. Inbound connections can never originate through it.</p><p>Bills ≈ $0.045 per hour <em>and</em> ≈ $0.045 per GB processed — the classic surprise line item.</p><div class='fact'><b>Exam tip</b><span>\"S3 traffic through NAT\" is the single most common wasted spend the exam tests. Fix: a gateway endpoint.</span></div>" },
        { id: "ec2", x: 1.6, y: 5.9, w: 2.6, d: 1.6, h: 1.1, color: "green", label: "EC2", sub: "app tier · no public IP",
          info: "<div class='eyebrow'>Private subnet</div><h3>EC2 app tier</h3><p>No route from the internet exists here — only the ALB can reach it, and it reaches out only via NAT or endpoints.</p><p>Admin access: SSM Session Manager, not a bastion with port 22 open.</p><div class='fact'><b>Exam tip</b><span>\"Private\" is not a setting. It is the absence of an IGW route in the subnet's route table.</span></div>" },
        { id: "rds", x: 8.2, y: 5.9, w: 2.4, d: 1.6, h: 1.1, color: "blue", label: "RDS", sub: "SG → SG rule",
          info: "<div class='eyebrow'>Private subnet</div><h3>RDS</h3><p>DB subnet group across AZs. Its security group allows 5432 <em>from the app tier's security group</em> — referencing SGs instead of CIDRs survives autoscaling.</p><div class='fact'><b>Exam tip</b><span>Three nested SG gates (ALB → app → DB) = defense in depth with zero CIDR management.</span></div>" },
        { id: "vpce", x: 11.1, y: 7.5, w: 1.9, d: 1.3, h: 0.7, color: "cyan", label: "VPCE", sub: "gateway endpoint",
          info: "<div class='eyebrow'>Route table entry</div><h3>S3 Gateway Endpoint</h3><p>A prefix-list route, not a device: no ENI, no cost, no bandwidth cap. S3 and DynamoDB only.</p><p>Interface endpoints (PrivateLink) are the ENI-based, per-hour-billed cousins for everything else.</p><div class='fact'><b>Exam tip</b><span>Endpoint policy can pin access to specific buckets — a security <em>and</em> cost win.</span></div>" },
        { id: "s3", x: 14.6, y: 7.3, w: 2.6, d: 1.6, h: 1.1, color: "blue", label: "S3", sub: "regional service",
          info: "<div class='eyebrow'>Outside the VPC</div><h3>S3</h3><p>A regional service that lives outside your VPC. Reached over its public endpoint (via IGW/NAT) or privately through the gateway endpoint.</p><div class='fact'><b>Remember</b><span>Same bucket, two data paths, wildly different cost. The endpoint toggle shows both.</span></div>" }
      ];
      nodes.forEach(function (n) { n.cx = n.x + n.w / 2; n.cy = n.y + n.d / 2; });
      var Z = 1.35; // packet altitude

      function P(list) { return list.map(function (p) { return { x: p[0], y: p[1] }; }); }
      function mkPath(pts) {
        var len = 0, seg = [0];
        for (var i = 1; i < pts.length; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(len); }
        return { pts: pts, len: len, seg: seg };
      }
      var paths = {
        inbound: mkPath(P([[6.5, -4.1], [6.5, -0.2], [6.5, 2.3], [2.9, 2.3], [2.9, 6.7], [9.4, 6.7]])),
        egress: mkPath(P([[2.9, 6.7], [2.9, 4.6], [9.4, 4.6], [9.4, 2.3], [9.4, -0.2], [6.5, -0.2], [6.5, -4.1]])),
        s3direct: mkPath(P([[2.9, 6.7], [2.9, 8.15], [12.05, 8.15], [15.9, 8.15]])),
        // the billed road: out through NAT and IGW to S3's public endpoint, around the VPC
        s3nat: mkPath(P([[2.9, 6.7], [2.9, 4.6], [9.4, 4.6], [9.4, 2.3], [9.4, -0.2], [6.5, -0.2], [6.5, -1.6], [12.7, -1.6], [12.7, 8.15], [15.9, 8.15]]))
      };
      var inboundRev = mkPath(paths.inbound.pts.slice().reverse());
      function pointAt(path, t) {
        var d = LAB.clamp(t, 0, 1) * path.len, pts = path.pts, seg = path.seg;
        for (var i = 1; i < pts.length; i++) {
          if (d <= seg[i]) { var u = (d - seg[i - 1]) / (seg[i] - seg[i - 1] || 1); return { x: LAB.lerp(pts[i - 1].x, pts[i].x, u), y: LAB.lerp(pts[i - 1].y, pts[i].y, u), i: i - 1 }; }
        }
        var l = pts[pts.length - 1]; return { x: l.x, y: l.y, i: pts.length - 2 };
      }

      /* ---------------- chapters (the guided flows) ---------------- */
      var chapters = [
        { id: "inbound", label: "Inbound request", path: "inbound", color: C.flow, steps: [
          { lit: ["internet", "igw"], upto: 1, text: "A client resolves your domain (Route 53 alias → ALB) and sends HTTPS to the ALB's public IPs. The IGW maps those public IPs to the ALB's ENIs." },
          { lit: ["igw", "alb"], upto: 3, text: "First policy gate: the ALB's security group must allow 443 from 0.0.0.0/0. NACLs on the public subnet are evaluated too — stateless, both directions." },
          { lit: ["alb"], upto: 3, text: "The ALB terminates TLS, evaluates listener rules, picks a healthy target and opens a brand-new TCP connection. The client IP now only exists in X-Forwarded-For." },
          { lit: ["alb", "ec2"], upto: 4, text: "Second gate: the app SG allows the app port from the ALB's SG. The instance never sees the internet — no public IP, no IGW route." },
          { lit: ["ec2", "rds"], upto: 5, text: "App queries the DB. Third gate: RDS's SG allows 5432 from the app SG. Three nested SG gates = defense in depth without a single CIDR." }
        ]},
        { id: "egress", label: "Private → internet", path: "egress", color: C.warn, steps: [
          { lit: ["ec2"], upto: 1, text: "The app calls an external API. Its route table: 10.0.0.0/16 → local, 0.0.0.0/0 → nat-…. No IGW route exists here — that absence is what \"private\" means." },
          { lit: ["ec2", "nat"], upto: 3, text: "The NAT Gateway rewrites the source IP to its own Elastic IP and tracks the connection. This hop bills per GB — chatty egress is a budget line." },
          { lit: ["nat", "igw"], upto: 5, text: "NAT forwards through the IGW. Replies come back through the NAT's connection table. Inbound connections can never originate this way — NAT is one-way by design." },
          { lit: ["igw", "internet"], upto: 6, text: "Out to the internet. ≈ $0.045 per GB processed plus ≈ $0.045 per hour, per NAT. Multiply by AZs for HA." }
        ]},
        { id: "s3", label: "S3 via endpoint", path: "s3direct", color: C.flow, steps: [
          { lit: ["ec2"], upto: 1, text: "Same instance, same bucket. With a gateway endpoint the route table also has the S3 prefix list → vpce-…. Traffic to S3's IP ranges takes this route instead of 0.0.0.0/0." },
          { lit: ["ec2", "vpce"], upto: 2, text: "The endpoint is a route, not a box: no ENI, no bandwidth cap, no hourly charge. The endpoint policy can restrict which buckets are reachable." },
          { lit: ["vpce", "s3"], upto: 3, text: "Traffic rides the AWS backbone, never touches IGW or NAT, costs $0 in processing. Flip the endpoint off and watch the same bytes take the long, billed road." }
        ]}
      ];
      var chapterIdx = 0, stepIdx = 0, scrubT = 0, scrubbing = false;

      /* ---------------- state ---------------- */
      var endpointOn = false, loadTB = 20;
      var packets = [], delivered = 0, spawnAcc = { inbound: 0, egress: 0, s3: 0 };
      var glow = {}; nodes.forEach(function (n) { glow[n.id] = LAB.spring(0, { stiffness: 160, damping: 20 }); });
      var costSpring = LAB.spring(0, { stiffness: 60, damping: 14 });
      // ≈ us-east-1: one NAT ≈ $0.045/h (≈ $32.85/mo) + ≈ $0.045/GB processed; 500 GB of other egress
      function monthlyCost() { var egressGB = 500; var s3GB = endpointOn ? 0 : loadTB * 1024; return 32.85 + (egressGB + s3GB) * 0.045; }

      /* ---------------- camera + projection (fitted, no pan) ---------------- */
      var cv = $("canvas"), ctx2 = LAB.canvas(cv), g = ctx2.g;
      var cam = { x: 0, y: 0, s: 20, zoom: 1 }, fitW = -1, fitH = -1;
      var COS = Math.cos(Math.PI / 6), SIN = 0.5;
      function proj(x, y, z) { var s = cam.s * cam.zoom; return { x: (x - y) * COS * s + cam.x, y: (x + y) * SIN * s - (z || 0) * s * 0.9 + cam.y }; }
      // the real extent of what is drawn (blocks incl. height, plates, every lane)
      var extent = (function () {
        var pts = [];
        plates.forEach(function (p) { pts.push([p.x, p.y, 0], [p.x + p.w, p.y, 0], [p.x, p.y + p.d, 0], [p.x + p.w, p.y + p.d, 0]); });
        nodes.forEach(function (n) { [0, n.h].forEach(function (z) { pts.push([n.x, n.y, z], [n.x + n.w, n.y, z], [n.x, n.y + n.d, z], [n.x + n.w, n.y + n.d, z]); }); });
        Object.keys(paths).forEach(function (k) { paths[k].pts.forEach(function (p) { pts.push([p.x, p.y, Z]); }); });
        var e = { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 };
        pts.forEach(function (p) {
          var x = (p[0] - p[1]) * COS, y = (p[0] + p[1]) * SIN - p[2] * 0.9;
          e.minX = Math.min(e.minX, x); e.maxX = Math.max(e.maxX, x); e.minY = Math.min(e.minY, y); e.maxY = Math.max(e.maxY, y);
        });
        return e;
      })();
      function fit() {
        var sz = ctx2.size(), W = sz.w, H = sz.h;
        if (!W || !H) return;
        fitW = W; fitH = H;
        var padX = 14, padTop = 18, padBot = 26; // room for sub labels under lit blocks
        var sW = (W - padX * 2) / (extent.maxX - extent.minX), sH = (H - padTop - padBot) / (extent.maxY - extent.minY);
        cam.s = Math.min(sW, sH); cam.zoom = 1;
        var cx = (extent.minX + extent.maxX) / 2, cy = (extent.minY + extent.maxY) / 2;
        cam.x = W / 2 - cx * cam.s; cam.y = padTop + (H - padTop - padBot) / 2 - cy * cam.s;
      }

      /* ---------------- drawing ---------------- */
      function poly(ptsW, z, fill, stroke, lw) {
        g.beginPath();
        ptsW.forEach(function (p, i) { var q = proj(p[0], p[1], z); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); });
        g.closePath();
        if (fill) { g.fillStyle = fill; g.fill(); }
        if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1; g.stroke(); }
      }
      function drawPlate(p) {
        poly([[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.d], [p.x, p.y + p.d]], 0, p.fill, p.line, 1);
        var a = proj(p.x + (p.id === "vpc" ? 2.4 : 0.3), p.y + p.d - 0.12, 0);
        g.fillStyle = C.dim; g.font = "500 " + Math.max(8.5, cam.s * cam.zoom * 0.5) + "px Inter, sans-serif"; g.textAlign = "left"; g.textBaseline = "bottom";
        g.save(); g.translate(a.x, a.y); g.transform(COS, SIN, -COS, SIN, 0, 0); g.fillText(p.label, 0, 0); g.restore();
      }
      function drawBlock(n) {
        var pal = PALETTE[n.color], x = n.x, y = n.y, w = n.w, d = n.d, h = n.h;
        var gl = glow[n.id].value;
        if (gl > 0.01) { g.save(); g.globalAlpha = Math.min(1, gl) * 0.55; poly([[x - 0.25, y - 0.25], [x + w + 0.25, y - 0.25], [x + w + 0.25, y + d + 0.25], [x - 0.25, y + d + 0.25]], 0.02, C.accent, null); g.restore(); }
        g.beginPath(); var a = proj(x, y + d, 0), b = proj(x + w, y + d, 0), c = proj(x + w, y + d, h), e = proj(x, y + d, h);
        g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(e.x, e.y); g.closePath(); g.fillStyle = pal[2]; g.fill();
        g.beginPath(); a = proj(x + w, y, 0); b = proj(x + w, y + d, 0); c = proj(x + w, y + d, h); e = proj(x + w, y, h);
        g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(e.x, e.y); g.closePath(); g.fillStyle = pal[1]; g.fill();
        poly([[x, y], [x + w, y], [x + w, y + d], [x, y + d]], h, pal[0], "rgba(255,255,255," + Math.min(0.9, 0.25 + gl * 0.6) + ")", 1);
        var cpt = proj(x + w / 2, y + d / 2, h), fs = Math.max(9, cam.s * cam.zoom * 0.62);
        g.fillStyle = "#161616"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = "700 " + fs + "px Sora, Inter, sans-serif";
        var maxW = w * COS * cam.s * cam.zoom * 0.95, tw = g.measureText(n.label).width;
        if (tw > maxW) { fs = Math.max(8, fs * maxW / tw); g.font = "700 " + fs + "px Sora, Inter, sans-serif"; }
        g.fillText(n.label, cpt.x, cpt.y - fs * 0.05);
        if (gl >= 0.25) subs.push(n);
      }
      var subs = [];
      function drawSub(n) {
        var gl = glow[n.id].value, x = n.x, y = n.y, w = n.w, d = n.d;
        var bl = proj(x + w / 2, y + d, 0), fs2 = Math.max(9, cam.s * cam.zoom * 0.46);
        g.save(); g.globalAlpha = Math.min(1, (gl - 0.25) * 2); g.font = "500 " + fs2 + "px Inter, sans-serif"; g.textBaseline = "middle";
        var sw = g.measureText(n.sub).width + 12, sh = fs2 + 7, sy = bl.y + 4;
        if (n.subUp) { var tp = proj(x + w / 2, y + d / 2, n.h); bl = { x: tp.x, y: tp.y }; sy = tp.y - Math.max(9, cam.s * 0.62) - sh - 4; }
        g.fillStyle = "rgba(22,22,22,0.82)"; g.strokeStyle = "rgba(223,122,76,0.45)"; g.lineWidth = 1;
        g.beginPath(); if (g.roundRect) g.roundRect(bl.x - sw / 2, sy, sw, sh, sh / 2); else g.rect(bl.x - sw / 2, sy, sw, sh); g.fill(); g.stroke();
        g.fillStyle = C.accent; g.fillText(n.sub, bl.x, sy + sh / 2 + 0.5); g.restore();
      }
      function drawPath(path, color, alpha, dashed) {
        g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.lineWidth = 1.2; if (dashed) g.setLineDash([4, 5]);
        g.beginPath(); path.pts.forEach(function (p, i) { var q = proj(p.x, p.y, Z); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.stroke(); g.restore();
      }
      var heroPulse = 0;
      function drawPacket(p) {
        var k = LAB.clamp(cam.s / 20, 0.75, 1.3), q = proj(p.x, p.y, Z), r = p.r * k;
        g.save();
        g.shadowColor = p.color; g.shadowBlur = p.hero ? 18 : 8;
        g.fillStyle = p.color; g.beginPath(); g.arc(q.x, q.y, r, 0, Math.PI * 2); g.fill();
        if (p.hero) { g.shadowBlur = 0; g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1.5; g.beginPath(); g.arc(q.x, q.y, r + 4 + Math.sin(heroPulse * 6.25) * 1.2, 0, Math.PI * 2); g.stroke(); }
        g.restore();
        var gq = proj(p.x, p.y, 0); g.save(); g.globalAlpha = 0.25; g.fillStyle = p.color; g.beginPath(); g.arc(gq.x, gq.y, 1.6 * k, 0, Math.PI * 2); g.fill(); g.restore();
      }

      /* ---------------- simulation ---------------- */
      function spawn(kind) {
        var pathKey = kind === "inbound" ? "inbound" : kind === "egress" ? "egress" : (endpointOn ? "s3direct" : "s3nat");
        var color = kind === "inbound" ? C.flow : kind === "egress" ? C.warn : (endpointOn ? C.flow : C.warn);
        packets.push({ kind: kind, path: paths[pathKey], t: 0, speed: 5.2 / paths[pathKey].len * (0.9 + Math.random() * 0.25), color: color, r: 2.6, x: 0, y: 0 });
      }
      function tick(dt) {
        heroPulse += dt;
        var rates = { inbound: 1.4, egress: 0.35, s3: 0.5 + loadTB / 20 };
        rates[chapters[chapterIdx].id] *= 1.8;
        Object.keys(rates).forEach(function (k) { spawnAcc[k] += dt * rates[k]; while (spawnAcc[k] >= 1) { spawnAcc[k] -= 1; if (packets.length < 160) spawn(k); } });
        for (var i = packets.length - 1; i >= 0; i--) {
          var p = packets[i]; p.t += p.speed * dt * (p.kind === "inbound" && p.reply ? 1.15 : 1);
          if (p.t >= 1) {
            if (p.kind === "inbound" && !p.reply) { p.reply = true; p.t = 0; p.color = C.ok; p.path = inboundRev; p.speed = 5.2 / p.path.len; continue; }
            packets.splice(i, 1); delivered++; continue;
          }
          var q = pointAt(p.path, p.t); p.x = q.x; p.y = q.y;
        }
        nodes.forEach(function (n) { glow[n.id].step(dt); });
        costSpring.step(dt);
      }

      /* ---------------- render ---------------- */
      var hero = { x: 0, y: 0, r: 4.2, color: C.accent, hero: true };
      function curPath() { var ch = chapters[chapterIdx]; return ch.id === "s3" ? (endpointOn ? paths.s3direct : paths.s3nat) : paths[ch.path]; }
      function draw() {
        var sz = ctx2.size();
        if (sz.w !== fitW || sz.h !== fitH) fit();
        g.clearRect(0, 0, sz.w, sz.h);
        plates.forEach(drawPlate);
        var ch = chapters[chapterIdx], chPath = curPath();
        drawPath(paths.inbound, C.flow, 0.12); drawPath(paths.egress, C.warn, 0.1); drawPath(endpointOn ? paths.s3direct : paths.s3nat, endpointOn ? C.flow : C.warn, 0.12);
        drawPath(chPath, ch.id === "s3" && !endpointOn ? C.warn : ch.color, 0.45, true);
        var items = nodes.map(function (n) { return { d: n.x + n.y + n.w + n.d, draw: function () { drawBlock(n); } }; });
        packets.forEach(function (p) { items.push({ d: p.x + p.y + 0.6, draw: function () { drawPacket(p); } }); });
        var hq = pointAt(chPath, scrubT); hero.x = hq.x; hero.y = hq.y; items.push({ d: hero.x + hero.y + 0.6, draw: function () { drawPacket(hero); } });
        subs = [];
        items.sort(function (a, b) { return a.d - b.d; }).forEach(function (it) { it.draw(); });
        subs.forEach(drawSub); // labels on top of every block
      }

      /* ---------------- chapter / step UI ---------------- */
      var chaptersEl = $(".bv-chapters"), stepLabel = $(".bv-step"), stepText = $(".bv-text"), scrub = $(".bv-scrub"), nextBtn = $(".bv-next");
      chapters.forEach(function (c, i) {
        var b = LAB.h('<button class="chip" role="tab">' + LAB.esc(c.label) + "</button>");
        b.onclick = function () { setChapter(i); LAB.haptic("tap"); LAB.sound.play("tap"); };
        chaptersEl.appendChild(b); c.el = b;
      });
      function litNodes(ids) { nodes.forEach(function (n) { glow[n.id].set(ids.indexOf(n.id) >= 0 ? 1 : 0); }); }
      function setChapter(i, quiet) {
        chapterIdx = i; chapters.forEach(function (c, j) { c.el.classList.toggle("on", j === i); c.el.setAttribute("aria-selected", String(j === i)); });
        var ce = chapters[i].el;
        if (!quiet) chaptersEl.scrollTo({ left: ce.offsetLeft - chaptersEl.offsetLeft - (chaptersEl.clientWidth - ce.offsetWidth) / 2, behavior: "smooth" });
        setStep(0, true);
      }
      function stepScrubTarget(i) {
        var ch = chapters[chapterIdx], path = curPath();
        var upto = Math.min(ch.steps[i].upto, path.pts.length - 1);
        return path.seg[upto] / path.len;
      }
      var swapT = 0, tweenId = 0;
      function setStep(i, jump) {
        var ch = chapters[chapterIdx]; stepIdx = LAB.clamp(i, 0, ch.steps.length - 1);
        var st = ch.steps[stepIdx];
        stepLabel.textContent = "Step " + (stepIdx + 1) + " / " + ch.steps.length;
        stepText.classList.add("swap");
        clearTimeout(swapT); swapT = setTimeout(function () { stepText.textContent = st.text; stepText.classList.remove("swap"); }, 120);
        litNodes(st.lit);
        nextBtn.textContent = stepIdx === ch.steps.length - 1 ? "Next flow" : "Next step";
        if (!scrubbing) {
          var from = scrubT, to = stepScrubTarget(stepIdx), id = ++tweenId;
          LAB.tween(jump ? 500 : 900, function (t) { if (id !== tweenId) return; scrubT = LAB.lerp(from, to, t); scrub.value = Math.round(scrubT * 1000); }, LAB.ease.inOutCubic);
        }
      }
      function stepForScrub(t) {
        var ch = chapters[chapterIdx], idx = 0;
        for (var i = 0; i < ch.steps.length; i++) { if (t >= stepScrubTarget(i) - 0.001) idx = i; }
        return idx;
      }
      scrub.addEventListener("pointerdown", function () { scrubbing = true; tweenId++; });
      scrub.addEventListener("input", function () {
        scrubbing = true; tweenId++;
        scrubT = scrub.value / 1000; var s = stepForScrub(scrubT);
        if (s !== stepIdx) { setStep(s); LAB.haptic("tick"); LAB.sound.play("tick"); }
      });
      var endScrub = function () { scrubbing = false; };
      scrub.addEventListener("pointerup", endScrub); scrub.addEventListener("pointercancel", endScrub); scrub.addEventListener("change", endScrub);
      nextBtn.onclick = function () {
        var ch = chapters[chapterIdx];
        if (stepIdx === ch.steps.length - 1) { LAB.haptic("ok"); LAB.sound.play("ok"); setChapter((chapterIdx + 1) % chapters.length); return; }
        setStep(stepIdx + 1); LAB.haptic("tap"); LAB.sound.play("tap");
      };
      $(".bv-prev").onclick = function () { setStep(stepIdx - 1); LAB.haptic("tap"); };

      /* ---------------- controls ---------------- */
      var costEl = $(".bv-cost"), inflightEl = $(".bv-inflight"), deliveredEl = $(".bv-delivered");
      var vpceBtn = $(".bv-vpce"), vpceWhy = $(".bv-vpcewhy"), vpceT = 0;
      function refreshCost() { costSpring.set(monthlyCost()); if (!running) { costSpring.snap(monthlyCost()); stats(); } }
      vpceBtn.onclick = function () {
        endpointOn = !endpointOn; vpceBtn.setAttribute("aria-checked", String(endpointOn));
        packets.forEach(function (p) { if (p.kind === "s3") { p.path = endpointOn ? paths.s3direct : paths.s3nat; p.color = endpointOn ? C.flow : C.warn; p.speed = 5.2 / p.path.len; p.t = Math.min(p.t, 0.08); } });
        vpceWhy.innerHTML = endpointOn ? "<b>On:</b> the route table sends S3's prefix list to the endpoint. Same bytes, AWS backbone, $0 processing." : "<b>Off:</b> S3 reads leave through the NAT gateway and the IGW. Every GB is billed by the NAT.";
        glow.vpce.set(endpointOn ? 1 : 0);
        clearTimeout(vpceT); vpceT = setTimeout(function () { if (chapters[chapterIdx].steps[stepIdx].lit.indexOf("vpce") < 0) glow.vpce.set(0); }, 900);
        refreshCost(); LAB.haptic(endpointOn ? "ok" : "bad"); LAB.sound.play(endpointOn ? "ok" : "bad");
        if (chapters[chapterIdx].id === "s3") setStep(stepIdx, true);
      };
      var loadEl = $(".bv-load"), loadVal = $(".bv-loadval");
      loadEl.addEventListener("input", function () { loadTB = +loadEl.value; loadVal.textContent = loadTB + " TB"; refreshCost(); });
      function stats() {
        inflightEl.textContent = packets.length; deliveredEl.textContent = delivered.toLocaleString();
        costEl.textContent = LAB.money(costSpring.value); costEl.className = "v bv-cost " + (costSpring.value < 100 ? "ok" : "warn");
      }

      /* ---------------- pointer: tap only (the page keeps scrolling over the board) ---------------- */
      var hintEl = $(".bv-hint"), down = null;
      cv.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; });
      cv.addEventListener("pointermove", function (e) { if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) down = null; });
      cv.addEventListener("pointercancel", function () { down = null; });
      cv.addEventListener("pointerup", function (e) {
        if (!down || e.pointerId !== down.id) return;
        var quick = performance.now() - down.t < 600; down = null;
        if (quick) tap(e);
      });
      function tap(e) {
        var r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, best = null, bd = 1e9;
        nodes.forEach(function (n) {
          var q = proj(n.cx, n.cy, n.h / 2), d = Math.hypot(q.x - px, q.y - py);
          var radius = Math.max(24, (n.w + n.d) * 0.5 * cam.s * cam.zoom * 0.55);
          if (d < radius && d < bd) { bd = d; best = n; }
        });
        if (!best) return;
        glow[best.id].value = 1.6; // press pulse, springs back to its target
        LAB.sheet(best.info); hintEl.style.opacity = 0;
        if (!running) draw();
      }

      /* ---------------- loop: only while live ---------------- */
      var loopH = null, running = false, statT = 0;
      function start() {
        if (running) return;
        running = true; statT = 0;
        var me = LAB.loop(function (dt) {
          // a stopped kit loop restarts itself on visibilitychange; only the current loop may draw
          if (loopH !== me || !running) { me.stop(); return; }
          tick(dt); draw();
          statT += dt; if (statT > 0.25) { statT = 0; stats(); }
        });
        loopH = me;
      }
      function stop() { running = false; if (loopH) { loopH.stop(); loopH = null; } }

      setChapter(0, true);
      costSpring.snap(monthlyCost());
      // a still frame so the board is not blank while it scrolls into view
      requestAnimationFrame(function () { for (var i = 0; i < 40; i++) tick(0.05); scrubT = stepScrubTarget(0); draw(); stats(); });
      var hintT = 0;

      return {
        enter: function () {
          start();
          clearTimeout(hintT); hintT = setTimeout(function () { hintEl.style.opacity = 0; }, 8000);
        },
        leave: function () { stop(); },
        destroy: function () { stop(); clearTimeout(hintT); clearTimeout(swapT); clearTimeout(vpceT); }
      };
    }
  });

  J.cast("vpc", [{ type: "board-vpc", id: "vpc", after: "nat", replaces: "diagram:vpc-anatomy", label: "Living board · your VPC" }]);
})();
