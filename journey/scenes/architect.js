/* ============================================================
   Scene: architect — fill-the-gap architecture puzzles (from lab/architect).
   One scene per scenario, cast just before each chapter's decisions.
   The diagram has a glowing slot; the learner drags (or taps) one of four
   service cards into it. Right card → the slot fills, the old path fades,
   new connectors draw in, packets flow, and a consequence meter + why
   appear in an in-flow tray. Results: JSTORE.S.journey.seen["arch:<id>"]
   = 1 (solved first try) | 2 (solved after retries).
   ============================================================ */
(function () {
  "use strict";
  var LABK = window.LAB, ST = window.JSTORE, J = window.JOURNEY;
  if (!J || !LABK) return;
  var esc = LABK.esc;

  /* ---------- styles (scoped, injected once) ---------- */
  var CSS = [
    ".scene-architect .ar-q { font-family: var(--display); font-weight: 600; font-size: clamp(17px, 4.5vw, 22px); line-height: 1.35; letter-spacing: -0.015em; color: var(--ink); margin-bottom: 6px; }",
    ".scene-architect .ar-diagram { margin-top: 8px; position: relative; }",
    ".scene-architect .ar-diagram svg { display: block; width: 100%; height: auto; max-height: 330px; overflow: visible; }",
    ".scene-architect .nd rect.box { fill: rgba(30,30,30,0.92); stroke: var(--line-strong); stroke-width: 1; }",
    ".scene-architect .nd text.l { font-family: var(--display); font-size: 11.5px; font-weight: 600; fill: var(--ink); }",
    ".scene-architect .nd text.s { font-family: var(--mono); font-size: 8.8px; fill: var(--ink-dim); }",
    ".scene-architect .nd.zone rect.box { fill: rgba(255,255,255,0.02); stroke: var(--line); stroke-dasharray: 4 4; }",
    ".scene-architect .nd.zone text.l { font-family:var(--body); font-size: 8.5px; font-weight: 600; letter-spacing:0; text-transform:none; fill: var(--ink-dim); }",
    ".scene-architect .nd.warn rect.box { stroke: rgba(210,173,94,0.55); }",
    ".scene-architect .nd.bad rect.box { stroke: rgba(215,119,109,0.5); }",
    ".scene-architect .nd, .scene-architect .ed { transition: opacity .7s; }",
    ".scene-architect .nd.off, .scene-architect .ed.off { opacity: .14; }",
    ".scene-architect .ed path.ln { fill: none; stroke: rgba(255,255,255,0.22); stroke-width: 1.5; }",
    ".scene-architect .ed.warn path.ln { stroke: rgba(210,173,94,0.65); }",
    ".scene-architect .ed.bad path.ln { stroke: rgba(215,119,109,0.55); stroke-dasharray: 3 4; }",
    ".scene-architect .ed.pend path.ln { stroke: var(--accent); stroke-dasharray: 3 5; opacity: .35; }",
    ".scene-architect .ed.drawn path.ln { stroke: rgba(127,166,214,0.5); transition: stroke-dashoffset .8s var(--ease-out), opacity .3s; }",
    ".scene-architect .ed text { font-family: var(--mono); font-size: 8.5px; fill: var(--ink-dim); paint-order: stroke; stroke: var(--bg); stroke-width: 3px; stroke-linejoin: round; transition: opacity .4s; }",
    ".scene-architect .ed.pend text { opacity: 0; }",
    ".scene-architect .slot { cursor: pointer; outline: none; }",
    ".scene-architect .slot:focus-visible rect.box { stroke-width: 3; }",
    ".scene-architect .slot rect.halo { fill: none; stroke: var(--accent); stroke-width: 5; opacity: .25; animation: arHalo 1.5s var(--ease-in-out) infinite alternate; }",
    "@keyframes arHalo { from { opacity: .12; } to { opacity: .5; } }",
    ".scene-architect .slot rect.box { fill: rgba(223,122,76,0.06); stroke: var(--accent); stroke-dasharray: 5 4; stroke-width: 1.5; transition: fill .2s; }",
    ".scene-architect .slot text.q { font-family: var(--display); font-size: 18px; font-weight: 700; fill: var(--accent); }",
    ".scene-architect .slot text.s { font-family: var(--mono); font-size: 8.5px; fill: var(--accent-2); opacity: .85; }",
    ".scene-architect .slot.hover rect.halo { opacity: .95; animation: none; }",
    ".scene-architect .slot.hover rect.box { fill: rgba(223,122,76,0.2); }",
    ".scene-architect .slot.armed rect.halo { opacity: .8; }",
    ".scene-architect .slot.bad rect.box, .scene-architect .slot.bad rect.halo { stroke: var(--bad); animation: arSlotBad .55s var(--ease-out) both; }",
    "@keyframes arSlotBad { 0% { opacity: 1; } 100% { opacity: .3; } }",
    ".scene-architect .slot.filled rect.halo { stroke: var(--accent); animation: arBlink .7s var(--ease-out) both; }",
    "@keyframes arBlink { 0% { opacity: 1; } 100% { opacity: 0; } }",
    ".scene-architect .slot.filled rect.box { stroke-dasharray: none; fill: rgba(223,122,76,0.16); }",
    ".scene-architect .slot.filled text.q { font-size: 11.5px; fill: var(--ink); }",
    ".scene-architect .slot.filled text.s { fill: var(--ink-dim); }",
    ".scene-architect .slot.quiet rect.halo { animation: none; opacity: 0; }",
    ".scene-architect .pk { fill: var(--flow); stroke: var(--flow-glow); stroke-width: 3; opacity: 0; transition: opacity .5s; }",
    ".scene-architect .pk.warn { fill: var(--warn); stroke: rgba(210,173,94,0.35); }",
    ".scene-architect .pk.on { opacity: 1; }",
    /* hand */
    ".scene-architect .ar-hand { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 10px auto 0; max-width: 520px; min-height: 104px; }",
    ".scene-architect .card { height: 100px; padding: 9px 4px 8px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; text-align: center;",
    "  border-radius: 14px; position: relative; touch-action: none; user-select: none; -webkit-user-select: none; cursor: grab; transition: box-shadow .25s, border-color .25s, opacity .4s; }",
    ".scene-architect .card svg { width: 26px; height: 26px; color: var(--ink-2); flex: none; }",
    ".scene-architect .card .n { font-family: var(--display); font-size: 12px; font-weight: 600; line-height: 1.12; color: var(--ink); }",
    ".scene-architect .card .t { font-family: var(--mono); font-size: 9.5px; color: var(--ink-dim); white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em; }",
    ".scene-architect .card.lift { box-shadow: 0 22px 44px -12px rgba(0,0,0,0.95), 0 0 0 1px var(--accent-glow); z-index: 5; cursor: grabbing; }",
    ".scene-architect .card.lift svg, .scene-architect .card.sel svg { color: var(--accent-2); }",
    ".scene-architect .card.sel { border-color: var(--accent-glow); box-shadow: 0 0 0 3px rgba(223,122,76,0.16); }",
    ".scene-architect .card.tried { opacity: .32; pointer-events: none; }",
    ".scene-architect .card.gone { opacity: 0; pointer-events: none; }",
    ".scene-architect .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }",
    ".scene-architect .ar-note { min-height: 40px; margin-top: 8px; font-size: 13.5px; line-height: 1.45; color: var(--ink-dim); transition: opacity .3s, transform .3s; }",
    ".scene-architect .ar-note.hide { opacity: 0; transform: translateY(-4px); }",
    ".scene-architect .ar-note.bad { color: var(--ink-2); } .scene-architect .ar-note.bad b { color: var(--bad); }",
    ".scene-architect .ar-note.sel b { color: var(--accent-2); }",
    ".scene-architect .ar-note.ok b { color: var(--ok); }",
    /* tray (in flow) */
    ".scene-architect .ar-tray { margin-top: 10px; padding: 16px 18px; border-radius: 20px; background: var(--panel-solid); border: 1px solid var(--line-strong); box-shadow: 0 20px 50px -30px rgba(0,0,0,0.9); }",
    ".scene-architect .ar-tray[hidden], .scene-architect .ar-hand[hidden] { display: none; }",
    ".scene-architect .ar-tray.show { animation: arTray .6s var(--spring) both; }",
    "@keyframes arTray { from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: none; } }",
    ".scene-architect .meter .vals { display: flex; align-items: baseline; gap: 10px; margin-top: 4px; flex-wrap: wrap; }",
    ".scene-architect .meter .from { font-family: var(--mono); font-size: 14px; color: var(--ink-dim); text-decoration: line-through; }",
    ".scene-architect .meter .arrow { color: var(--ink-dim); font-size: 13px; }",
    ".scene-architect .meter .v { font-family: var(--mono); font-weight: 600; font-size: 28px; letter-spacing: -0.02em; color: var(--ok); font-variant-numeric: tabular-nums; }",
    ".scene-architect .meter .sub { font-family: var(--mono); font-size: 11px; color: var(--ink-dim); margin-top: 2px; }",
    ".scene-architect .meter .mbar { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08); margin-top: 10px; overflow: hidden; }",
    ".scene-architect .meter .mbar i { display: block; height: 100%; border-radius: 3px; background: var(--warn); transform-origin: left; transition: transform 1.1s var(--ease-out), background .5s; }",
    ".scene-architect .meter .mbar i.good { background: var(--ok); }",
    ".scene-architect .ar-why { margin-top: 12px; font-size: 14.5px; color: var(--ink-2); line-height: 1.55; }",
    ".scene-architect .ar-why b { color: var(--accent-2); }",
    ".scene-architect .ar-acts { margin-top: 14px; display: flex; justify-content: flex-end; align-items: center; gap: 10px; flex-wrap: wrap; }",
    ".scene-architect .ar-acts .mono { font-size: 11.5px; color: var(--ink-dim); margin-right: auto; }",
    "@media (prefers-reduced-motion: reduce) { .scene-architect .slot rect.halo { animation: none; opacity: .4; } }"
  ].join("\n");
  if (!document.getElementById("css-scene-architect")) {
    var stl = document.createElement("style"); stl.id = "css-scene-architect"; stl.textContent = CSS; document.head.appendChild(stl);
  }

  /* ---------- service glyphs: simple geometry, stroke only ---------- */
  var G = {
    gwep: '<rect x="3" y="7" width="18" height="10" rx="3"/><path d="M8 12h8M13.5 9.5 16 12l-2.5 2.5"/>',
    ifep: '<rect x="5" y="5" width="14" height="14" rx="3"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    natinst: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 10v9M3 14.5h18"/>',
    cdn: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c-3.2 3.2-3.2 13.8 0 17M12 3.5c3.2 3.2 3.2 13.8 0 17"/>',
    multiaz: '<rect x="2" y="7" width="8" height="10" rx="2"/><rect x="14" y="7" width="8" height="10" rx="2"/><path d="M10 10.5h4M10 13.5h4"/>',
    replica: '<rect x="3" y="3" width="11" height="11" rx="2"/><rect x="10" y="10" width="11" height="11" rx="2" stroke-dasharray="2 2"/>',
    snapshot: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    proxy: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
    sns: '<circle cx="5" cy="12" r="2.3"/><path d="M7.3 12h4.2M11.5 12l5.5-6M11.5 12h5.5M11.5 12l5.5 6"/><circle cx="19" cy="6" r="1.8"/><circle cx="19" cy="12" r="1.8"/><circle cx="19" cy="18" r="1.8"/>',
    sqs: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 12h2M11 12h2M15 12h2"/>',
    kinesis: '<path d="M3 7c3-3 6 3 9 0s6 3 9 0M3 13c3-3 6 3 9 0s6 3 9 0M3 19c3-3 6 3 9 0s6 3 9 0"/>',
    sched: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M12 13v4l2.5 1.5"/>',
    bucket: '<path d="M5 6h14l-1.5 13h-11z"/><path d="M5 6c0 2.2 14 2.2 14 0"/>',
    alb: '<path d="M12 4l8 8-8 8-8-8z"/><path d="M12 8v8M8 12h8"/>',
    ga: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5l3.2 7-3.2-1.6-3.2 1.6z"/>',
    ondemand: '<path d="M13 3 5 14h6l-1 7 9-11h-6z"/>',
    prov: '<path d="M4 20v-8h4v8M10 20V6h4v14M16 20v-5h4v5M3 20h18"/><path d="M3 4h18" stroke-dasharray="2 2"/>',
    dax: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M13 7l-4 5.5h4L12 17l4-5.5h-4z"/>',
    global: '<circle cx="7" cy="12" r="4"/><circle cx="17" cy="12" r="4"/><path d="M11 10.5h2M11 13.5h2"/>',
    savings: '<path d="M3 12 12 3h9v9l-9 9z"/><circle cx="16" cy="8" r="1.4"/><path d="M8 16l5-5"/>',
    spot: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 3"/><circle cx="12" cy="12" r="2.5"/>',
    host: '<rect x="3" y="3" width="18" height="18" rx="3"/><rect x="6.5" y="6.5" width="4.5" height="4.5"/><rect x="13" y="6.5" width="4.5" height="4.5"/><rect x="6.5" y="13" width="4.5" height="4.5"/><rect x="13" y="13" width="4.5" height="4.5"/>',
    bigger: '<rect x="3" y="13" width="6" height="6" rx="1.5"/><rect x="11" y="5" width="10" height="14" rx="2"/><path d="M9 16h2"/>',
    /* new */
    nlb: '<path d="M3 12h5M16 12h5M8 7h8v10H8z"/><path d="M11 10v4M13 10v4"/>',
    gwlb: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 12h16M12 4v16"/><circle cx="12" cy="12" r="2.5"/>',
    failover: '<path d="M4 7h11l-3-3M4 7l0 0"/><path d="M20 17H9l3 3"/><circle cx="18" cy="7" r="2"/><circle cx="6" cy="17" r="2"/>',
    simple: '<rect x="5" y="9" width="14" height="6" rx="3"/>',
    latency: '<circle cx="12" cy="13" r="8"/><path d="M12 13l4-4M12 3v2"/>',
    multivalue: '<path d="M4 6h10M4 12h14M4 18h8"/><circle cx="18" cy="6" r="1.6"/><circle cx="16" cy="18" r="1.6"/>',
    provconc: '<path d="M6 3h12M6 21h12M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/>',
    reserved: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    apicache: '<path d="M4 7c0-2 16-2 16 0v10c0 2-16 2-16 0z"/><path d="M4 7c0 2 16 2 16 0M4 12c0 2 16 2 16 0"/>',
    secrets: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/>',
    param: '<path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    kms: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="11" r="2.5"/><path d="M12 13.5V17"/>',
    envvar: '<path d="M7 5H5v14h2M17 5h2v14h-2"/><path d="M9 12h6"/>',
    backup: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>',
    pilot: '<path d="M12 3c3 4 4 6 4 9a4 4 0 0 1-8 0c0-3 1-5 4-9z"/><path d="M12 15v3"/>',
    warm: '<rect x="3" y="8" width="7" height="10" rx="2"/><rect x="14" y="12" width="7" height="6" rx="2"/><path d="M10 13h4"/>',
    aa: '<rect x="3" y="7" width="7" height="10" rx="2"/><rect x="14" y="7" width="7" height="10" rx="2"/><path d="M10 10h4M14 14h-4"/>',
    tgw: '<circle cx="12" cy="12" r="3"/><circle cx="4" cy="5" r="1.8"/><circle cx="20" cy="5" r="1.8"/><circle cx="4" cy="19" r="1.8"/><circle cx="20" cy="19" r="1.8"/><path d="M5.5 6.3 9.8 10M18.5 6.3 14.2 10M5.5 17.7 9.8 14M18.5 17.7 14.2 14"/>',
    peering: '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><path d="M9 12h6"/>',
    privatelink: '<rect x="3" y="8" width="7" height="8" rx="2"/><path d="M10 12h5"/><circle cx="18" cy="12" r="3"/>',
    vgw: '<path d="M4 18V9l8-5 8 5v9"/><path d="M9 18v-5h6v5"/>'
  };
  function glyph(k) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (G[k] || G.simple) + "</svg>";
  }

  /* ============================================================
     Scenarios. Diagram space is 360 × 260.
     node: {id,x,y,w,h,label,sub,zone,tone,phase,after:{label,sub}}
     edge: {from,to,phase:"before"|"after"|"both",flow,tone,label}
     meter: {label,from,to,fmt,dir,sub,toText,fromText}
     mod: where it is cast (after: "end", just before the decisions)
     ============================================================ */
  var money = function (n) { return "$" + Math.round(n).toLocaleString(); };
  var dur = function (n) { return n >= 7200 ? "≈ " + Math.round(n / 3600) + " h" : n >= 600 ? "≈ " + Math.round(n / 60) + " min" : "≈ " + Math.round(n) + " s"; };
  var SC = [
    {
      id: "nat-endpoint", mod: "vpc", tag: "cost",
      text: "A private-subnet app reads 20 TB a month from S3 through a NAT gateway. Cut the bill without touching the code.",
      slot: { x: 124, y: 186, w: 96, h: 44, hint: "route to S3" },
      nodes: [
        { id: "vpc", x: 8, y: 12, w: 226, h: 240, zone: true, label: "VPC" },
        { id: "app", x: 24, y: 108, w: 92, h: 44, label: "App", sub: "private subnet" },
        { id: "nat", x: 124, y: 30, w: 96, h: 44, label: "NAT gateway", sub: "≈ $0.045 / GB", tone: "warn", phase: "before" },
        { id: "inet", x: 254, y: 30, w: 92, h: 44, label: "Internet", phase: "before" },
        { id: "s3", x: 254, y: 108, w: 92, h: 44, label: "S3 bucket", sub: "20 TB / month" }
      ],
      edges: [
        { from: "app", to: "nat", phase: "before", flow: true, tone: "warn" },
        { from: "nat", to: "inet", phase: "before", flow: true, tone: "warn" },
        { from: "inet", to: "s3", phase: "before", flow: true, tone: "warn" },
        { from: "app", to: "slot", phase: "after", flow: true },
        { from: "slot", to: "s3", phase: "after", flow: true, label: "route table · free" }
      ],
      cards: [
        { id: "gwep", name: "Gateway endpoint", tag: "free", right: true },
        { id: "ifep", name: "Interface endpoint", tag: "hourly + GB", why: "Works, but PrivateLink bills per hour per AZ plus per GB; the gateway endpoint for S3 is free." },
        { id: "natinst", name: "NAT instance", tag: "you manage", why: "Cheaper per hour than a NAT gateway, but every one of those 20 TB still flows through a box you now patch and size." },
        { id: "cdn", name: "CloudFront", tag: "edge cache", why: "A CDN for the public edge. This app sits in a private subnet reading from S3; nobody is serving users here." }
      ],
      why: "A gateway endpoint is a route-table entry (a prefix list) for S3 or DynamoDB: free, no per-GB charge, and the traffic never leaves the AWS network.",
      meter: { label: "NAT data processing · per month", from: 922, to: 0, fmt: money, dir: "down", fromText: "≈ $922", sub: "20,480 GB × ≈ $0.045 / GB → $0" }
    },
    {
      id: "multi-az", mod: "rds-aurora", tag: "availability",
      text: "One RDS MySQL instance in a single AZ runs checkout. An AZ outage must not stop orders: automatic failover, no app changes.",
      slot: { x: 220, y: 160, w: 100, h: 48, hint: "standby" },
      nodes: [
        { id: "app", x: 132, y: 16, w: 96, h: 44, label: "App", sub: "writes + reads" },
        { id: "aza", x: 8, y: 100, w: 164, h: 150, zone: true, label: "AZ a" },
        { id: "azb", x: 188, y: 100, w: 164, h: 150, zone: true, label: "AZ b" },
        { id: "db", x: 40, y: 160, w: 100, h: 48, label: "RDS primary", sub: "MySQL" }
      ],
      edges: [
        { from: "app", to: "db", phase: "both", flow: true },
        { from: "db", to: "slot", phase: "after", flow: true, label: "synchronous" }
      ],
      cards: [
        { id: "multiaz", name: "Multi-AZ", short: "Multi-AZ standby", tag: "standby", right: true },
        { id: "replica", name: "Read replica", tag: "async", why: "Asynchronous and readable, but failover is a manual promotion and the newest writes can be lost." },
        { id: "snapshot", name: "Snapshots", tag: "daily", why: "A restore creates a new instance in tens of minutes and loses every write since the snapshot." },
        { id: "proxy", name: "RDS Proxy", tag: "conn pool", why: "Pools connections and makes a failover faster, but there is no standby to fail over to." }
      ],
      why: "Multi-AZ keeps a synchronous standby in another AZ and flips the DNS endpoint to it in about 60–120 s. The classic standby is never readable; it is for staying up, not for reads.",
      meter: { label: "Recovery after an AZ failure", from: 1800, to: 90, fmt: dur, dir: "down", fromText: "manual · 30 min+", toText: "≈ 60–120 s", sub: "automatic DNS failover · zero lost writes" }
    },
    {
      id: "fanout", mod: "messaging", tag: "decoupling",
      text: "Every new order must reach billing, email and analytics, each reliably, each at its own pace. One publish, three independent consumers.",
      slot: { x: 132, y: 108, w: 96, h: 44, hint: "fan-out" },
      nodes: [
        { id: "orders", x: 12, y: 108, w: 92, h: 44, label: "Order service", sub: "1 event" },
        { id: "q1", x: 256, y: 30, w: 92, h: 44, label: "Billing", sub: "SQS queue" },
        { id: "q2", x: 256, y: 108, w: 92, h: 44, label: "Email", sub: "SQS queue" },
        { id: "q3", x: 256, y: 186, w: 92, h: 44, label: "Analytics", sub: "SQS queue" }
      ],
      edges: [
        { from: "orders", to: "slot", phase: "after", flow: true },
        { from: "slot", to: "q1", phase: "after", flow: true },
        { from: "slot", to: "q2", phase: "after", flow: true },
        { from: "slot", to: "q3", phase: "after", flow: true }
      ],
      cards: [
        { id: "sns", name: "SNS topic", tag: "pub/sub", right: true },
        { id: "sqs", name: "SQS alone", tag: "one queue", why: "One queue: each message goes to one consumer; the other two never see it." },
        { id: "kinesis", name: "Kinesis stream", tag: "shards", why: "Built for streams with many readers, but needs shard cursors and checkpointing: heavy for 'notify three services'." },
        { id: "sched", name: "EventBridge Scheduler", tag: "cron", why: "Fires on a timetable, not when an order happens." }
      ],
      why: "SNS fan-out: one publish, a copy lands in every subscribed SQS queue. Each consumer keeps its own backlog (up to 14 days) and its own retries.",
      meter: { label: "Copies delivered per order event", from: 1, to: 3, fmt: function (n) { return Math.round(n) + " queues"; }, dir: "up", fromText: "1 queue", sub: "SNS → SQS: one queue per consumer, filter policies optional" }
    },
    {
      id: "cloudfront-oac", mod: "caching", tag: "edge + security",
      text: "A static site lives in a private S3 bucket. Serve it over HTTPS on your own domain, fast worldwide, and keep the bucket private.",
      slot: { x: 132, y: 108, w: 96, h: 44, hint: "edge" },
      nodes: [
        { id: "users", x: 12, y: 108, w: 92, h: 44, label: "Users", sub: "worldwide" },
        { id: "acm", x: 132, y: 22, w: 96, h: 40, label: "ACM certificate", sub: "us-east-1" },
        { id: "s3", x: 256, y: 108, w: 92, h: 44, label: "S3 bucket", sub: "private · BPA on" },
        { id: "direct", x: 12, y: 196, w: 92, h: 44, label: "Direct URL", sub: "anyone", tone: "bad" }
      ],
      edges: [
        { from: "users", to: "slot", phase: "after", flow: true, label: "HTTPS" },
        { from: "acm", to: "slot", phase: "after" },
        { from: "slot", to: "s3", phase: "after", flow: true, label: "OAC" },
        { from: "direct", to: "s3", phase: "both", tone: "bad", label: "403" }
      ],
      cards: [
        { id: "cdn", name: "CloudFront + OAC", tag: "edge + HTTPS", right: true },
        { id: "bucket", name: "Public bucket", tag: "HTTP only", why: "The S3 website endpoint is HTTP-only and needs a public bucket, exactly what the brief forbids." },
        { id: "alb", name: "ALB", tag: "L7", why: "An ALB cannot target an S3 bucket; it fronts instances, IPs and Lambda functions." },
        { id: "ga", name: "Global Accelerator", tag: "L4 anycast", why: "Layer 4 anycast IPs with no caching and no S3 origin; it is for TCP/UDP endpoints, not static files." }
      ],
      why: "CloudFront caches at the edge and terminates HTTPS with your ACM certificate (issued in us-east-1 for CloudFront); Origin Access Control lets only this distribution read the private bucket.",
      meter: { label: "Time to first byte, far from the Region", from: 240, to: 40, fmt: function (n) { return "≈ " + Math.round(n) + " ms"; }, dir: "down", sub: "edge cache hit · bucket stays private" }
    },
    {
      id: "on-demand", mod: "dynamodb", tag: "scaling",
      text: "A launch-day table gets spiky, unpredictable traffic: throttled at every peak, idle in between. Stop the throttling without guessing capacity.",
      slot: { x: 256, y: 130, w: 96, h: 44, hint: "capacity mode" },
      nodes: [
        { id: "cl", x: 12, y: 30, w: 92, h: 44, label: "Clients", sub: "spiky" },
        { id: "fn", x: 132, y: 30, w: 96, h: 44, label: "API Lambda" },
        { id: "tb", x: 256, y: 30, w: 96, h: 44, label: "DynamoDB", sub: "throttled at peaks", after: { sub: "no throttles" } },
        { id: "cw", x: 132, y: 130, w: 96, h: 44, label: "CloudWatch", sub: "ThrottledRequests", tone: "bad", phase: "before" }
      ],
      edges: [
        { from: "cl", to: "fn", phase: "both", flow: true },
        { from: "fn", to: "tb", phase: "both", flow: true },
        { from: "fn", to: "cw", phase: "before", tone: "bad", label: "throttle errors" },
        { from: "tb", to: "slot", phase: "after", label: "billing mode" }
      ],
      cards: [
        { id: "ondemand", name: "On-demand", short: "On-demand mode", tag: "per request", right: true },
        { id: "prov", name: "Provisioned ×4", tag: "fixed WCU", why: "You pay for the new ceiling all day, every day, and the first spike above it throttles again." },
        { id: "dax", name: "DAX", tag: "µs reads", why: "Caches reads in microseconds; the writes still hit the table and still throttle." },
        { id: "global", name: "Global table", tag: "2+ Regions", why: "Replicates the table to other Regions; the same capacity problem, now copied." }
      ],
      why: "On-demand bills per request and instantly absorbs up to 2× the previous peak. Nothing to plan, nothing paid for while idle. (If throttling happens while the table is mostly idle, that is a hot key, not a capacity dial.)",
      meter: { label: "Throttled requests at the peak", from: 4800, to: 0, fmt: function (n) { return Math.round(n).toLocaleString() + " / min"; }, dir: "down", sub: "on-demand: up to 2× previous peak, instantly" }
    },
    {
      id: "savings-plan", mod: "cost", tag: "cost",
      text: "Ten EC2 instances run 24/7 for the next three years, same family, same Region. Keep the bill as low as possible, change nothing else.",
      slot: { x: 256, y: 130, w: 96, h: 44, hint: "purchase option" },
      nodes: [
        { id: "users", x: 12, y: 30, w: 92, h: 44, label: "Users" },
        { id: "alb", x: 132, y: 30, w: 96, h: 44, label: "ALB" },
        { id: "fleet", x: 256, y: 30, w: 96, h: 44, label: "EC2 fleet", sub: "10 × 24/7 · 3 yr" },
        { id: "bill", x: 100, y: 130, w: 96, h: 44, label: "Monthly bill", sub: "on-demand rate", after: { sub: "≈ 72 % off" } }
      ],
      edges: [
        { from: "users", to: "alb", phase: "both", flow: true },
        { from: "alb", to: "fleet", phase: "both", flow: true },
        { from: "fleet", to: "slot", phase: "after", label: "commit $/hour" },
        { from: "slot", to: "bill", phase: "after", label: "≈ −72 %" }
      ],
      cards: [
        { id: "savings", name: "Savings Plan", short: "Savings Plan · 3 yr", tag: "3-yr ≈ 72%", right: true },
        { id: "spot", name: "Spot", tag: "≤ 90% off", why: "Up to 90 % off, but AWS can reclaim it with 2 minutes' notice: not for a steady, always-on service." },
        { id: "host", name: "Dedicated Host", tag: "BYOL", why: "A whole physical server for per-socket licences. It costs more, not less." },
        { id: "bigger", name: "Bigger instance", tag: "scale up", why: "Rightsizing goes the other way; a bigger box raises the bill." }
      ],
      why: "A 3-year EC2 Instance Savings Plan (or Standard RI) commits to that family and Region for up to ≈ 72 % off. Same instances, nothing to migrate; a Compute Savings Plan (≈ 66 %) if you might change family.",
      meter: { label: "EC2 bill · per month", from: 1200, to: 336, fmt: money, dir: "down", fromText: "≈ $1,200", toText: "≈ $336", sub: "3-year EC2 Instance SP, all upfront · ≈ 72 % off" }
    },

    /* ---------- six more, one per chapter where the puzzle teaches something real ---------- */
    {
      id: "nlb", mod: "elb-asg", tag: "load balancing",
      text: "Partners must allowlist fixed IP addresses for your game backend, and the game speaks UDP. Put the right load balancer in front of the fleet.",
      slot: { x: 128, y: 106, w: 100, h: 48, hint: "load balancer" },
      nodes: [
        { id: "cl", x: 8, y: 108, w: 96, h: 44, label: "Partner clients", sub: "UDP · allowlist" },
        { id: "asg", x: 244, y: 10, w: 112, h: 242, zone: true, label: "ASG · 3 AZs" },
        { id: "g1", x: 254, y: 34, w: 92, h: 40, label: "Game server", sub: "AZ a · UDP 7777" },
        { id: "g2", x: 254, y: 110, w: 92, h: 40, label: "Game server", sub: "AZ b · UDP 7777" },
        { id: "g3", x: 254, y: 186, w: 92, h: 40, label: "Game server", sub: "AZ c · UDP 7777" }
      ],
      edges: [
        { from: "cl", to: "slot", phase: "after", flow: true },
        { from: "slot", to: "g1", phase: "after", flow: true },
        { from: "slot", to: "g2", phase: "after", flow: true },
        { from: "slot", to: "g3", phase: "after", flow: true }
      ],
      cards: [
        { id: "nlb", name: "Network LB", short: "NLB · static IPs", tag: "L4 · UDP", right: true },
        { id: "alb", name: "Application LB", tag: "L7 HTTP", why: "Layer 7 only: HTTP, HTTPS, gRPC, WebSockets. No UDP listener, and no static IP: its node IPs change as it scales." },
        { id: "gwlb", name: "Gateway LB", tag: "GENEVE 6081", why: "Inserts firewall appliances into the traffic path (GENEVE on UDP 6081). It is not a front door for your app." },
        { id: "cdn", name: "CloudFront", tag: "HTTP edge", why: "An HTTP(S) CDN: no UDP game traffic, and no fixed IP addresses for a partner to allowlist." }
      ],
      why: "NLB works at layer 4: TCP, UDP and TLS listeners, one static IP per enabled AZ (or your own Elastic IP per AZ), client source IP preserved. Partners allowlist three addresses that never change.",
      meter: { label: "Fixed IPs a partner can allowlist", from: 0, to: 3, fmt: function (n) { return Math.round(n) + " IPs"; }, dir: "up", fromText: "0 (ALB IPs change)", sub: "NLB: one static IP or EIP per enabled AZ" }
    },
    {
      id: "failover", mod: "route53", tag: "resilience",
      text: "The shop runs in us-east-1 with a standby copy in eu-west-1. Send everyone to the primary, and to the standby only when the primary is unhealthy. No manual DNS edits.",
      slot: { x: 132, y: 106, w: 96, h: 48, hint: "routing policy" },
      nodes: [
        { id: "users", x: 8, y: 14, w: 96, h: 44, label: "Users", sub: "DNS lookup" },
        { id: "r1", x: 256, y: 14, w: 96, h: 44, label: "us-east-1", sub: "PRIMARY", tone: "bad", after: { sub: "unhealthy" } },
        { id: "r2", x: 256, y: 200, w: 96, h: 44, label: "eu-west-1", sub: "standby", after: { sub: "now serving" } },
        { id: "hc", x: 256, y: 110, w: 96, h: 40, label: "Health check", sub: "30 s × 3 fails" }
      ],
      edges: [
        { from: "users", to: "r1", phase: "before", flow: true, tone: "bad", label: "still resolves here" },
        { from: "hc", to: "r1", phase: "both", tone: "bad", label: "failing" },
        { from: "users", to: "slot", phase: "after", flow: true },
        { from: "slot", to: "r2", phase: "after", flow: true, label: "answer: secondary" }
      ],
      cards: [
        { id: "failover", name: "Failover routing", short: "Failover routing", tag: "2 roles", right: true },
        { id: "simple", name: "Simple routing", tag: "no checks", why: "Returns the same record every time and cannot use health checks: users keep resolving to the dead Region." },
        { id: "latency", name: "Latency routing", tag: "nearest", why: "Sends European users to eu-west-1 even while us-east-1 is healthy. That is active-active, not 'standby only on failure'." },
        { id: "multivalue", name: "Multivalue answer", tag: "up to 8 IPs", why: "Returns up to 8 healthy records at random: traffic is spread over both Regions, not held on the primary." }
      ],
      why: "Failover routing has exactly two roles, PRIMARY and SECONDARY. When the primary's health check fails (30 s interval × 3 failures ≈ 90 s), Route 53 stops answering with it and returns the secondary. Keep the TTL near 60 s so clients follow quickly.",
      meter: { label: "Time until users reach the standby", from: 1800, to: 150, fmt: dur, dir: "down", fromText: "someone edits DNS · 30 min+", toText: "≈ 90 s + 60 s TTL", sub: "detection (30 s × 3) + TTL · no human in the loop" }
    },
    {
      id: "sqs-buffer", mod: "serverless", tag: "spikes",
      text: "A webhook API (API Gateway → Lambda → RDS) gets 50× spikes. At each spike the database runs out of connections and orders fail. Orders may be processed seconds later, but none may be lost.",
      slot: { x: 256, y: 22, w: 96, h: 48, hint: "decouple" },
      nodes: [
        { id: "src", x: 8, y: 24, w: 96, h: 44, label: "Webhooks", sub: "50× spikes" },
        { id: "api", x: 132, y: 24, w: 96, h: 44, label: "API Gateway", sub: "sync invoke", after: { sub: "returns 202" } },
        { id: "fn", x: 256, y: 128, w: 96, h: 44, label: "Worker Lambda", sub: "scales with spike", after: { sub: "max conc. 10" } },
        { id: "db", x: 132, y: 128, w: 96, h: 44, label: "RDS MySQL", sub: "connections maxed", tone: "warn", after: { sub: "steady load" } },
        { id: "lost", x: 8, y: 200, w: 96, h: 44, label: "Failed orders", sub: "429s + timeouts", tone: "bad", phase: "before" }
      ],
      edges: [
        { from: "src", to: "api", phase: "both", flow: true },
        { from: "api", to: "fn", phase: "before", flow: true, tone: "warn", side: "v" },
        { from: "fn", to: "db", phase: "both", flow: true },
        { from: "db", to: "lost", phase: "before", tone: "bad", label: "too many connections" },
        { from: "api", to: "slot", phase: "after", flow: true },
        { from: "slot", to: "fn", phase: "after", flow: true, label: "poll" }
      ],
      cards: [
        { id: "sqs", name: "SQS queue", short: "SQS queue", tag: "buffer", right: true },
        { id: "provconc", name: "Provisioned concurrency", tag: "warm Lambdas", why: "Removes cold starts. More warm Lambdas at the spike means more database connections, not fewer." },
        { id: "reserved", name: "Reserved concurrency", tag: "hard cap", why: "Caps the Lambdas hitting RDS, but synchronous calls over the cap are throttled with 429: those orders still fail unless the sender retries." },
        { id: "apicache", name: "API cache", tag: "stage cache", why: "Caches repeated responses. Every webhook is a unique write; there is nothing to serve from a cache." }
      ],
      why: "API Gateway writes each order straight into SQS (a direct service integration, no Lambda in front) and returns 202. The queue absorbs the spike; the Lambda event source mapping drains it with a maximum concurrency, so RDS sees a steady number of connections.",
      meter: { label: "DB connections at the peak", from: 1000, to: 10, fmt: function (n) { return Math.round(n).toLocaleString(); }, dir: "down", fromText: "up to 1,000 (account concurrency)", toText: "10", sub: "orders wait in SQS · none dropped" }
    },
    {
      id: "secrets", mod: "security-services", tag: "secrets",
      text: "A Lambda reads the RDS password from a plain environment variable. Security wants it stored encrypted and rotated every 30 days automatically, with no custom rotation code.",
      slot: { x: 132, y: 22, w: 96, h: 48, hint: "secret store" },
      nodes: [
        { id: "fn", x: 8, y: 110, w: 96, h: 44, label: "Lambda", sub: "env var secret", after: { sub: "fetches at runtime" } },
        { id: "env", x: 8, y: 200, w: 96, h: 44, label: "Env variable", sub: "never rotated", tone: "bad", phase: "before" },
        { id: "db", x: 256, y: 110, w: 96, h: 44, label: "RDS MySQL", sub: "user: app" }
      ],
      edges: [
        { from: "env", to: "fn", phase: "before", tone: "bad", label: "baked in at deploy" },
        { from: "fn", to: "db", phase: "both", flow: true, label: "login" },
        { from: "fn", to: "slot", phase: "after", flow: true, label: "GetSecretValue" },
        { from: "slot", to: "db", phase: "after", label: "rotates · 30 d" }
      ],
      cards: [
        { id: "secrets", name: "Secrets Manager", tag: "auto-rotate", right: true },
        { id: "param", name: "Parameter Store", tag: "SecureString", why: "Encrypted with KMS and free in the standard tier, but no built-in rotation: you would write and schedule the rotation Lambda yourself." },
        { id: "kms", name: "KMS key rotation", tag: "key material", why: "Rotates the KMS key's backing material (yearly by default). Your database password stays exactly the same." },
        { id: "envvar", name: "Env var + KMS", tag: "deploy-time", why: "Lambda already encrypts environment variables at rest. The value is still fixed at deploy time: nothing rotates it, and changing it means redeploying." }
      ],
      why: "Secrets Manager stores the credential encrypted with KMS and runs managed rotation for RDS: a rotation Lambda creates, sets, tests and promotes a new password on schedule. ≈ $0.40 per secret per month. Fetch the secret at runtime, not at deploy time.",
      meter: { label: "How long a leaked password stays valid", from: 365, to: 30, fmt: function (n) { return Math.round(n) + " days"; }, dir: "down", fromText: "forever (never rotated)", toText: "≤ 30 days", sub: "managed rotation · ≈ $0.40 / secret / month" }
    },
    {
      id: "pilot-light", mod: "ha-dr", tag: "disaster recovery",
      text: "An order system in us-east-1 needs a plan for losing the whole Region: RPO of seconds, RTO under an hour, and the smallest DR bill that meets both.",
      slot: { x: 204, y: 92, w: 132, h: 56, hint: "DR posture" },
      nodes: [
        { id: "pz", x: 8, y: 10, w: 164, h: 242, zone: true, label: "us-east-1 · primary" },
        { id: "dz", x: 188, y: 10, w: 164, h: 242, zone: true, label: "us-west-2 · DR" },
        { id: "app", x: 24, y: 46, w: 132, h: 44, label: "App fleet", sub: "full size" },
        { id: "db", x: 24, y: 170, w: 132, h: 44, label: "Aurora", sub: "writer" },
        { id: "bk", x: 204, y: 170, w: 132, h: 44, label: "Nightly snapshot", sub: "copied once a day", tone: "warn", phase: "before" }
      ],
      edges: [
        { from: "app", to: "db", phase: "both", flow: true },
        { from: "db", to: "bk", phase: "before", tone: "warn", label: "every 24 h" },
        { from: "db", to: "slot", phase: "after", flow: true, label: "replicates · seconds" }
      ],
      cards: [
        { id: "pilot", name: "Pilot light", tag: "data live", right: true },
        { id: "backup", name: "Backup & restore", tag: "hours", why: "The cheapest tier, but the RPO is the backup interval and a restore takes hours: both targets missed." },
        { id: "warm", name: "Warm standby", tag: "scaled down", why: "Meets both targets, but a scaled-down fleet runs 24/7: you pay for more than a one-hour RTO needs." },
        { id: "aa", name: "Active-active", tag: "all live", why: "Near-zero RTO you were not asked for, at the highest cost, plus multi-Region writes to design for." }
      ],
      why: "Pilot light keeps the data layer live in the DR Region (replication, so RPO is seconds to minutes) and the compute defined but stopped or scaled to zero. Recovery is boot, scale and promote: tens of minutes, inside a one-hour RTO, for little more than the replication cost.",
      meter: { label: "Orders lost if the Region dies (RPO)", from: 86400, to: 5, fmt: dur, dir: "down", fromText: "≈ 24 h (nightly snapshot)", toText: "seconds", sub: "RTO tens of minutes · cost: replication + idle footprint" }
    },
    {
      id: "transit-gateway", mod: "adv-networking", tag: "networking at scale",
      text: "Thirty VPCs and the on-prem data centre (one VPN) must all reach each other, with central control over who routes where. Today it is a growing mesh of peerings.",
      slot: { x: 132, y: 96, w: 96, h: 52, hint: "hub" },
      nodes: [
        { id: "v1", x: 8, y: 18, w: 84, h: 40, label: "VPC 1" },
        { id: "v2", x: 8, y: 102, w: 84, h: 40, label: "VPC 2" },
        { id: "v3", x: 8, y: 186, w: 84, h: 40, label: "VPC 3" },
        { id: "v4", x: 268, y: 18, w: 84, h: 40, label: "VPC 4" },
        { id: "v5", x: 268, y: 102, w: 84, h: 40, label: "… VPC 30" },
        { id: "onp", x: 268, y: 186, w: 84, h: 40, label: "On-prem", sub: "1 VPN" }
      ],
      edges: [
        { from: "v1", to: "v2", phase: "before", tone: "warn", side: "v" },
        { from: "v2", to: "v3", phase: "before", tone: "warn", side: "v" },
        { from: "v4", to: "v5", phase: "before", tone: "warn", side: "v", label: "435 peerings" },
        { from: "v1", to: "v4", phase: "before", tone: "warn" },
        { from: "v3", to: "onp", phase: "before", tone: "bad", label: "no transit to the VPN" },
        { from: "v1", to: "slot", phase: "after" },
        { from: "v2", to: "slot", phase: "after", flow: true },
        { from: "v3", to: "slot", phase: "after" },
        { from: "v4", to: "slot", phase: "after" },
        { from: "v5", to: "slot", phase: "after" },
        { from: "slot", to: "onp", phase: "after", flow: true, label: "VPN attachment" }
      ],
      cards: [
        { id: "tgw", name: "Transit Gateway", tag: "hub router", right: true },
        { id: "peering", name: "More peering", tag: "1:1 links", why: "Peering is not transitive: 30 VPCs need 30 × 29 / 2 = 435 peerings, and no VPC can reach the VPN through a peer." },
        { id: "privatelink", name: "PrivateLink", tag: "one service", why: "Exposes one service behind an NLB, consumer to provider. It does not route whole networks to each other." },
        { id: "vgw", name: "VPN gateway", tag: "one VPC", why: "A virtual private gateway attaches the VPN to a single VPC; the other 29 still cannot reach on-prem." }
      ],
      why: "Transit Gateway is a regional hub router: each VPC and the VPN is one attachment, routing is transitive, and TGW route tables (association + propagation) control who reaches whom. ≈ $0.05 per attachment-hour plus per-GB processing.",
      meter: { label: "Connections to build and manage", from: 435, to: 31, fmt: function (n) { return Math.round(n).toLocaleString(); }, dir: "down", fromText: "435 peerings", toText: "31 attachments", sub: "30 VPCs + 1 VPN · transitive, centrally routed" }
    }
  ];

  /* ---------- diagram geometry ---------- */
  function anchor(a, b, side) {
    var ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2, dx = bx - ax, dy = by - ay;
    var vertical = side ? side === "v" : Math.abs(dy) > 0.6 * Math.abs(dx);
    if (vertical) { var s = dy > 0 ? 1 : -1; return { x1: ax, y1: s > 0 ? a.y + a.h : a.y, x2: bx, y2: s > 0 ? b.y : b.y + b.h, v: true }; }
    var hh = dx > 0 ? 1 : -1; return { x1: hh > 0 ? a.x + a.w : a.x, y1: ay, x2: hh > 0 ? b.x : b.x + b.w, y2: by, v: false };
  }
  function pathD(p) {
    var k, s;
    if (p.v) { k = Math.max(16, Math.abs(p.y2 - p.y1) * 0.5); s = p.y2 > p.y1 ? 1 : -1; return "M" + p.x1 + " " + p.y1 + " C" + p.x1 + " " + (p.y1 + s * k) + " " + p.x2 + " " + (p.y2 - s * k) + " " + p.x2 + " " + p.y2; }
    k = Math.max(16, Math.abs(p.x2 - p.x1) * 0.5); s = p.x2 > p.x1 ? 1 : -1;
    return "M" + p.x1 + " " + p.y1 + " C" + (p.x1 + s * k) + " " + p.y1 + " " + (p.x2 - s * k) + " " + p.y2 + " " + p.x2 + " " + p.y2;
  }
  function nodeSVG(n) {
    var cx = n.x + n.w / 2, cy = n.y + n.h / 2, cls = "nd" + (n.zone ? " zone" : "") + (n.tone ? " " + n.tone : "");
    var s = '<g class="' + cls + '" data-id="' + n.id + '"><rect class="box" x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="' + (n.zone ? 14 : 10) + '"/>';
    if (n.zone) s += '<text class="l" x="' + (n.x + 10) + '" y="' + (n.y + 14) + '">' + esc(n.label) + "</text>";
    else if (n.sub) s += '<text class="l" x="' + cx + '" y="' + (cy - 1) + '" text-anchor="middle">' + esc(n.label) + '</text><text class="s" x="' + cx + '" y="' + (cy + 11) + '" text-anchor="middle">' + esc(n.sub) + "</text>";
    else s += '<text class="l" x="' + cx + '" y="' + (cy + 4) + '" text-anchor="middle">' + esc(n.label) + "</text>";
    return s + "</g>";
  }
  function slotSVG(sl) {
    var cx = sl.x + sl.w / 2, cy = sl.y + sl.h / 2;
    return '<g class="slot" role="button" tabindex="0" aria-label="Empty slot: ' + esc(sl.hint) + '">' +
      '<rect class="halo" x="' + (sl.x - 3) + '" y="' + (sl.y - 3) + '" width="' + (sl.w + 6) + '" height="' + (sl.h + 6) + '" rx="13"/>' +
      '<rect class="box" x="' + sl.x + '" y="' + sl.y + '" width="' + sl.w + '" height="' + sl.h + '" rx="10"/>' +
      '<text class="q" x="' + cx + '" y="' + (cy + 3) + '" text-anchor="middle">?</text>' +
      '<text class="s" x="' + cx + '" y="' + (cy + 16) + '" text-anchor="middle">' + esc(sl.hint) + "</text></g>";
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var uidN = 0;

  /* ============================================================
     One scenario scene
     ============================================================ */
  function mount(el, sc, ctx) {
    var cur = sc.data, uid = "ar" + (++uidN) + "-", key = "arch:" + cur.id;
    var right = cur.cards.filter(function (c) { return c.right; })[0];
    el.innerHTML =
      '<div class="eyebrow rv"><span>Architect · ' + esc(cur.tag) + '</span><span class="dim">fill the gap</span></div>' +
      '<p class="ar-q rv"></p>' +
      '<section class="ar-diagram rv" aria-label="Architecture diagram"></section>' +
      '<section class="ar-hand rv" aria-label="Service cards"></section>' +
      '<div class="ar-note rv" aria-live="polite"></div>' +
      '<div class="ar-tray" hidden aria-live="polite"><div class="meter"></div><div class="ar-why"></div>' +
        '<div class="ar-acts"><span class="mono"></span><button class="btn sm ghost again">Play again</button><button class="btn primary cont">Continue</button></div></div>';
    el.querySelector(".ar-q").textContent = cur.text;
    var diagEl = el.querySelector(".ar-diagram"), handEl = el.querySelector(".ar-hand"), noteEl = el.querySelector(".ar-note"), tray = el.querySelector(".ar-tray");
    tray.querySelector(".cont").onclick = function () { LABK.haptic("tap"); ctx.next(); };
    tray.querySelector(".again").onclick = function () { LABK.haptic("tap"); LABK.sound.play("tap"); fresh(); };

    var svgEl, slotG, slotBox, afterEdges = [], packets = [], cards = [], selected = null, drag = null, locked = false, wrongs = 0, hovering = false, isLive = false;
    function $e(i) { return svgEl.querySelector('[id="' + uid + "e" + i + '"]'); }

    /* ---------- diagram ---------- */
    function renderDiagram() {
      var byId = {}; cur.nodes.forEach(function (n) { byId[n.id] = n; }); byId.slot = cur.slot;
      var defs = "<defs>" + ["line", "warn", "bad", "flow"].map(function (k) {
        var c = { line: "rgba(255,255,255,0.35)", warn: "rgba(210,173,94,0.8)", bad: "rgba(215,119,109,0.7)", flow: "rgba(127,166,214,0.7)" }[k];
        return '<marker id="' + uid + "m-" + k + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="' + c + '"/></marker>';
      }).join("") + "</defs>";
      var edges = cur.edges.map(function (e, i) {
        var an = anchor(byId[e.from], byId[e.to], e.side), d = pathD(an); e._v = an.v;
        var cls = "ed" + (e.tone ? " " + e.tone : "") + (e.phase === "after" ? " pend" : "");
        var mk = e.phase === "after" ? "" : ' marker-end="url(#' + uid + "m-" + (e.tone || "line") + ')"';
        return '<g class="' + cls + '" data-i="' + i + '"><path class="ln" id="' + uid + "e" + i + '" d="' + d + '"' + mk + "/>" + (e.label ? '<text data-label text-anchor="middle">' + esc(e.label) + "</text>" : "") + "</g>";
      }).join("");
      diagEl.innerHTML = '<svg viewBox="0 0 360 260" preserveAspectRatio="xMidYMid meet">' + defs + edges + cur.nodes.map(nodeSVG).join("") + slotSVG(cur.slot) + '<g class="pkh"></g></svg>';
      svgEl = diagEl.firstElementChild; slotG = svgEl.querySelector(".slot"); slotBox = slotG.querySelector("rect.box");
      afterEdges = [];
      cur.edges.forEach(function (e, i) {
        var p = $e(i), gg = p.parentNode, Lp = p.getTotalLength();
        var t = gg.querySelector("[data-label]");
        if (t) {
          var mm = p.getPointAtLength(Lp / 2);
          if (e._v) { var rt = mm.x > 290; t.setAttribute("x", mm.x + (rt ? -7 : 7)); t.setAttribute("y", mm.y + 3); t.setAttribute("text-anchor", rt ? "end" : "start"); }
          else { t.setAttribute("x", mm.x); t.setAttribute("y", mm.y - 5); }
        }
        if (e.phase === "after") afterEdges.push({ e: e, p: p, g: gg, L: Lp });
      });
      slotG.addEventListener("click", function () { if (selected && !locked) attempt(selected); });
      slotG.addEventListener("keydown", function (ev) { if ((ev.key === "Enter" || ev.key === " ") && selected && !locked) { ev.preventDefault(); attempt(selected); } });
      if (!isLive) try { svgEl.pauseAnimations(); } catch (e) {}
    }
    function clearPackets() { packets.forEach(function (c) { c.remove(); }); packets = []; }
    function spawnPackets(phase) {
      if (LABK.reducedMotion) return;
      var flows = cur.edges.map(function (e, i) { return { e: e, i: i }; }).filter(function (x) { return x.e.flow && (phase === "after" ? x.e.phase === "after" : (x.e.phase === "before" || x.e.phase === "both")); });
      var per = flows.length > 3 ? 2 : 3, host = svgEl.querySelector(".pkh"), NS = "http://www.w3.org/2000/svg";
      flows.forEach(function (x) {
        var p = $e(x.i), Lp = p.getTotalLength(), d = LABK.clamp(Lp / 60, 1.3, 3.2);
        for (var k = 0; k < per; k++) {
          var c = document.createElementNS(NS, "circle");
          c.setAttribute("r", "3.2"); c.setAttribute("class", "pk" + (x.e.tone === "warn" || x.e.tone === "bad" ? " warn" : ""));
          var am = document.createElementNS(NS, "animateMotion");
          am.setAttribute("dur", d + "s"); am.setAttribute("repeatCount", "indefinite"); am.setAttribute("begin", (k * d / per).toFixed(2) + "s");
          var mp = document.createElementNS(NS, "mpath"); mp.setAttribute("href", "#" + uid + "e" + x.i); mp.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#" + uid + "e" + x.i);
          am.appendChild(mp); c.appendChild(am); host.appendChild(c); packets.push(c);
          (function (cc) { requestAnimationFrame(function () { cc.classList.add("on"); }); })(c);
        }
      });
    }
    function fillSlot(card) {
      slotG.classList.remove("hover", "bad", "armed"); slotG.classList.add("filled");
      var q = slotG.querySelector("text.q"); q.textContent = card.short || card.name;
      var maxW = cur.slot.w - 12, len = 0;
      try { len = q.getComputedTextLength(); } catch (e) {}
      if (len > maxW) q.style.fontSize = Math.max(8.5, 11.5 * maxW / len) + "px";
      slotG.querySelector("text.s").textContent = card.tag;
      slotG.setAttribute("aria-label", "Slot filled: " + (card.short || card.name));
    }
    function revealAfter(card, instant) {
      fillSlot(card);
      if (instant) slotG.classList.add("quiet");
      clearPackets();
      svgEl.querySelectorAll(".nd").forEach(function (gn) {
        var n = cur.nodes.filter(function (x) { return x.id === gn.dataset.id; })[0];
        if (n.phase === "before") gn.classList.add("off");
        if (n.after) {
          if (n.after.sub) { var t = gn.querySelector("text.s"); if (t) t.textContent = n.after.sub; }
          if (n.after.label) gn.querySelector("text.l").textContent = n.after.label;
          if (n.tone) gn.classList.remove(n.tone);
        }
      });
      cur.edges.forEach(function (e, i) { if (e.phase === "before") $e(i).parentNode.classList.add("off"); });
      afterEdges.forEach(function (a, i) {
        a.g.classList.remove("pend");
        if (instant) { a.g.classList.add("drawn"); a.p.setAttribute("marker-end", "url(#" + uid + "m-flow)"); return; }
        a.p.style.strokeDasharray = a.L; a.p.style.strokeDashoffset = a.L;
        a.p.getBoundingClientRect();
        setTimeout(function () { a.g.classList.add("drawn"); a.p.style.strokeDashoffset = 0; a.p.setAttribute("marker-end", "url(#" + uid + "m-flow)"); }, 40 + i * 120);
      });
      if (instant) spawnPackets("after");
      else setTimeout(function () { spawnPackets("after"); }, 500 + afterEdges.length * 120);
    }

    /* ---------- hand: drag starts only after the pointer moves; tap selects ---------- */
    function renderHand() {
      handEl.innerHTML = ""; cards = []; selected = null; drag = null;
      shuffle(cur.cards.slice()).forEach(function (d) {
        var b = LABK.h('<button class="card panel" type="button" aria-label="' + esc(d.name) + ", " + esc(d.tag) + '">' + glyph(d.id) + '<span class="n">' + esc(d.name) + '</span><span class="t">' + esc(d.tag) + "</span></button>");
        var c = { el: b, data: d, sx: LABK.spring(0, { stiffness: 420, damping: 30 }), sy: LABK.spring(0, { stiffness: 420, damping: 30 }), sc: LABK.spring(1, { stiffness: 300, damping: 22 }), lifted: false, lastT: "" };
        handEl.appendChild(b); cards.push(c); bindCard(c);
      });
    }
    function slotRect() { var r = slotBox.getBoundingClientRect(); return { l: r.left - 16, t: r.top - 16, r: r.right + 16, b: r.bottom + 16, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }
    function inRect(x, y, r) { return x >= r.l && x <= r.r && y >= r.t && y <= r.b; }
    function setHover(on) { if (on === hovering) return; hovering = on; slotG.classList.toggle("hover", on); if (on) { LABK.haptic("tick"); LABK.sound.play("tick"); } }
    var noteT = 0;
    function note(html, cls) { noteEl.classList.add("hide"); clearTimeout(noteT); noteT = setTimeout(function () { noteEl.innerHTML = html; noteEl.className = "ar-note rv" + (cls ? " " + cls : ""); }, 160); }
    function hint() { note("Drag a card into the glowing slot, or tap a card and then tap the slot."); }
    function toggleSelect(c) {
      if (selected === c) { attempt(c); return; }
      if (selected) selected.el.classList.remove("sel");
      selected = c; c.el.classList.add("sel"); slotG.classList.add("armed"); LABK.haptic("tap"); LABK.sound.play("tap");
      note("<b>" + esc(c.data.name) + "</b> selected. Tap the slot to place it, or tap the card again.", "sel");
    }
    function bindCard(c) {
      var b = c.el;
      b.addEventListener("pointerdown", function (e) {
        if (locked || drag || b.classList.contains("tried")) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        drag = { c: c, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
      });
      b.addEventListener("pointermove", function (e) {
        if (!drag || drag.c !== c || drag.id !== e.pointerId) return;
        var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
        if (!drag.moved) {
          if (Math.hypot(dx, dy) < 7) return;
          // the pointer moved on the card: now it is a drag
          drag.moved = true; drag.slot = slotRect();
          try { b.setPointerCapture(e.pointerId); } catch (err) {}
          if (selected) { selected.el.classList.remove("sel"); selected = null; slotG.classList.remove("armed"); }
          c.sx.stiffness = c.sy.stiffness = 420; c.sx.damping = c.sy.damping = 30;
          c.sc.set(1.06); c.lifted = true; b.classList.add("lift");
          LABK.haptic("tap"); LABK.sound.play("whoosh");
        }
        e.preventDefault();
        c.sx.set(dx); c.sy.set(dy); setHover(inRect(e.clientX, e.clientY, drag.slot));
      });
      function up(e) {
        if (!drag || drag.c !== c) return;
        var d = drag; drag = null; setHover(false);
        if (!d.moved) { toggleSelect(c); return; }
        if (inRect(e.clientX, e.clientY, d.slot)) attempt(c); else release(c);
      }
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", function () { if (drag && drag.c === c) { var mv = drag.moved; drag = null; setHover(false); if (mv) release(c); } });
      b.addEventListener("pointerleave", function () { if (drag && drag.c === c && !drag.moved) drag = null; });
      b.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && !locked) { e.preventDefault(); toggleSelect(c); } });
    }
    function release(c) { c.sx.stiffness = c.sy.stiffness = 160; c.sx.damping = c.sy.damping = 12; c.sx.set(0); c.sy.set(0); c.sc.set(1); }
    function tick(dt) {
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        c.sx.step(dt); c.sy.step(dt); c.sc.step(dt);
        var rot = LABK.clamp(c.sx.velocity * 0.012, -7, 7);
        var t = (c.sx.value === 0 && c.sy.value === 0 && c.sc.value === 1 && rot === 0) ? "" : "translate3d(" + c.sx.value.toFixed(2) + "px," + c.sy.value.toFixed(2) + "px,0) scale(" + c.sc.value.toFixed(3) + ") rotate(" + rot.toFixed(2) + "deg)";
        if (t !== c.lastT) { c.el.style.transform = t; c.lastT = t; }
        if (c.lifted && !(drag && drag.c === c) && c.sx.settled() && c.sy.settled() && c.sc.settled()) { c.lifted = false; c.el.classList.remove("lift"); }
      }
    }
    var handle = null;
    function start() {
      if (handle) return;
      var mine = {};
      mine.h = LABK.loop(function (dt) { if (handle !== mine.h) { if (mine.h) mine.h.stop(); return; } tick(dt); });
      handle = mine.h;
    }
    function stop() { if (handle) { var h0 = handle; handle = null; h0.stop(); } }

    /* ---------- attempts ---------- */
    function attempt(c) {
      if (locked) return;
      if (selected) { selected.el.classList.remove("sel"); selected = null; slotG.classList.remove("armed"); }
      if (c.data.right) correct(c); else wrong(c);
    }
    function wrong(c) {
      slotG.classList.remove("bad"); void slotG.getBoundingClientRect(); slotG.classList.add("bad");
      setTimeout(function () { slotG.classList.remove("bad"); }, 600);
      release(c); c.el.classList.add("tried"); c.el.setAttribute("aria-disabled", "true");
      wrongs++;
      note("<b>" + esc(c.data.name) + "</b> · " + esc(c.data.why), "bad");
      LABK.haptic("bad"); LABK.sound.play("bad");
    }
    function record() {
      var S = ST.S, v = wrongs ? 2 : 1, old = S.journey.seen[key];
      if (!old || v < old) { S.journey.seen[key] = v; ST.save(true); }
    }
    function correct(c) {
      locked = true; drag = null; setHover(false);
      var r = slotRect(), cr = c.el.getBoundingClientRect();
      var ccx = cr.left + cr.width / 2 - c.sx.value, ccy = cr.top + cr.height / 2 - c.sy.value;
      c.sx.stiffness = c.sy.stiffness = 260; c.sx.damping = c.sy.damping = 24; c.lifted = true; c.el.classList.add("lift");
      c.sx.set(r.cx - ccx); c.sy.set(r.cy - ccy); c.sc.set(0.5);
      if (!handle) { c.sx.snap(r.cx - ccx); c.sy.snap(r.cy - ccy); }
      cards.forEach(function (o) { if (o !== c) o.el.classList.add("gone"); });
      record();
      note(wrongs ? "<b>Solved</b> after " + wrongs + (wrongs === 1 ? " miss." : " misses.") : "<b>Solved first try.</b>", "ok");
      setTimeout(function () { c.el.classList.add("gone"); revealAfter(c.data, false); LABK.haptic("ok"); LABK.sound.play("ok"); }, 360);
      setTimeout(function () { showTray(false); }, 620);
      setTimeout(function () { handEl.hidden = true; }, 700);
    }

    /* ---------- consequence tray (in flow) ---------- */
    function showTray(instant) {
      var m = cur.meter, down = m.dir === "down", met = tray.querySelector(".meter");
      met.innerHTML = '<div class="k">' + esc(m.label) + '</div><div class="vals"><span class="from">' + esc(m.fromText || m.fmt(m.from)) + '</span><span class="arrow">→</span><span class="v"></span></div><div class="sub">' + esc(m.sub || "") + '</div><div class="mbar"><i></i></div>';
      var v = met.querySelector(".v"), bar = met.querySelector(".mbar i");
      var r0 = down ? 1 : (m.to ? m.from / m.to : 0), r1 = down ? m.to / m.from : 1;
      tray.querySelector(".ar-why").innerHTML = "<b>Why</b> " + esc(cur.why);
      var res = ST.S.journey.seen[key];
      tray.querySelector(".mono").textContent = res === 1 ? "solved first try" : res ? "solved" : "";
      tray.hidden = false;
      if (instant) {
        v.textContent = m.toText || m.fmt(m.to); bar.style.transform = "scaleX(" + Math.max(r1, 0.012) + ")"; bar.classList.add("good");
        return;
      }
      v.textContent = m.fmt(m.from); bar.style.transform = "scaleX(" + r0 + ")";
      tray.classList.remove("show"); void tray.offsetWidth; tray.classList.add("show");
      setTimeout(function () {
        LABK.count(v, m.to, { from: m.from, fmt: m.fmt, ms: 1200 });
        bar.style.transform = "scaleX(" + Math.max(r1, 0.012) + ")"; bar.classList.add("good");
        if (m.toText) setTimeout(function () { v.textContent = m.toText; }, 1250);
      }, 380);
      // bring the tray into view inside the reel (never jumps if it is already visible)
      setTimeout(function () { try { tray.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {} }, 700);
    }

    /* ---------- states ---------- */
    function fresh() {
      locked = false; wrongs = 0; hovering = false; selected = null; drag = null;
      tray.hidden = true; tray.classList.remove("show"); handEl.hidden = false;
      clearPackets(); renderDiagram(); renderHand(); hint();
      spawnPackets("before");
    }
    function solved() {
      locked = true; tray.classList.remove("show");
      clearPackets(); renderDiagram(); handEl.innerHTML = ""; handEl.hidden = true;
      revealAfter(right, true);
      noteEl.innerHTML = ST.S.journey.seen[key] === 1 ? "<b>Solved first try.</b> Here is the design you built." : "<b>Solved.</b> Here is the design you built.";
      noteEl.className = "ar-note rv ok";
      showTray(true);
    }
    if (ST.S.journey.seen[key]) solved(); else fresh();

    return {
      enter: function () { isLive = true; try { svgEl.unpauseAnimations(); } catch (e) {} start(); },
      leave: function () { isLive = false; stop(); try { svgEl.pauseAnimations(); } catch (e) {} },
      destroy: function () { isLive = false; stop(); clearPackets(); }
    };
  }

  J.registerScene("architect", {
    label: function (sc) { return "Architect · " + sc.data.tag; },
    render: function (el, sc, ctx) { return mount(el, sc, ctx); }
  });

  // one scene per scenario, just before each chapter's decisions
  SC.forEach(function (s) {
    J.cast(s.mod, [{ type: "architect", id: s.id, after: "end", data: s, label: "Architect · fill the gap" }]);
  });
  J.architectScenarios = SC;
})();
