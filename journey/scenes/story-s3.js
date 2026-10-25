/* scene: story-s3 — "How S3 keeps your data" as a figure you step through (port of lab/story).
   The prototype was a scroll-driven story; inside the reel that would be a nested scroll, so
   here it is one SVG figure on top and a beat caption below: tap the chips inside the sentence,
   step with prev/next or the beat dots, or swipe the figure left/right (touch-action: pan-y,
   so vertical page scrolling still works over it). The quiz and end card are dropped —
   the journey has its own checks and closer. */
(function () {
  "use strict";
  var J = window.JOURNEY, LAB = window.LAB;
  var S_ = ".scene-story-s3";

  var CSS = `
${S_} .st { margin-top: 18px; }
${S_} .st-fig { position: relative; touch-action: pan-y; user-select: none; -webkit-user-select: none; padding: 10px 6px 4px; border-radius: var(--r);
  border: 1px solid var(--line); background: radial-gradient(ellipse 80% 70% at 50% 40%, rgba(223,122,76,0.05), rgba(22,22,22,0.5) 75%); }
${S_} .st-fig svg { display: block; width: 100%; height: auto; max-height: min(42vh, 360px); margin: 0 auto; overflow: visible; }
${S_} .st-cap { min-height: 36px; margin-top: 4px; padding: 0 8px; text-align: center; font-family: var(--mono); font-size: 11px; line-height: 17px; color: var(--ink-dim); transition: opacity .25s; }
${S_} .st-cap.swap { opacity: 0; }
${S_} .st-hud { position: absolute; right: 12px; top: 10px; text-align: right; pointer-events: none; opacity: 0; transform: translateY(-6px); transition: opacity .3s, transform .35s var(--ease-out); }
${S_} .st-hud.show { opacity: 1; transform: none; }
${S_} .st-hud .k { display: block; }
${S_} .st-hud b { display: block; font-family: var(--mono); font-size: 22px; font-weight: 600; letter-spacing: -0.02em; color: var(--accent-2); line-height: 1.1; }
${S_} .st-hud i { display: block; font-style: normal; font-family: var(--mono); font-size: 10px; color: var(--ink-dim); }
/* beats: all stacked in one grid cell so the block keeps the height of the longest one */
${S_} .st-beats { display: grid; margin-top: 12px; }
${S_} .st-beat { grid-area: 1 / 1; opacity: 0; transform: translateX(18px); visibility: hidden; pointer-events: none;
  transition: opacity .35s var(--ease-out), transform .5s var(--ease-out), visibility 0s linear .5s; }
${S_} .st-beat.back { transform: translateX(-18px); }
${S_} .st-beat.on { opacity: 1; transform: none; visibility: visible; pointer-events: auto; transition: opacity .4s var(--ease-out) .05s, transform .55s var(--ease-out), visibility 0s; }
${S_} .st-beat .k { margin-bottom: 6px; color: var(--accent); }
${S_} .st-beat h3 { font-size: clamp(18px, 4.8vw, 22px); line-height: 1.25; margin-bottom: 8px; text-wrap: balance; }
${S_} .st-beat p { font-size: 15.5px; line-height: 1.75; }
${S_} .st-beat p .chip { position: relative; vertical-align: middle; margin: 0 1px; min-height: 32px; padding: 0 11px;
  font-family: var(--mono); font-size: 12.5px; font-weight: 600; letter-spacing: 0;
  background: rgba(223,122,76,.10); border-color: rgba(223,122,76,.45); color: var(--accent-2);
  user-select: none; -webkit-user-select: none; touch-action: pan-y; }
${S_} .st-beat p .chip::before { content: ""; position: absolute; inset: -7px -4px; }
${S_} .st-beat p .chip.on { background: var(--accent); border-color: transparent; color: #1a0d04; }
${S_} .st-beat p .chip.drag { cursor: ew-resize; }
${S_} .st-beat.trap { padding: 14px 16px; border-radius: 16px; border: 1px solid rgba(215,119,109,.35); background: linear-gradient(180deg, rgba(215,119,109,.08), var(--panel)); }
${S_} .st-beat.trap .k { color: var(--bad); }
${S_} .trap ul { list-style: none; margin-top: 6px; display: grid; gap: 6px; }
${S_} .trap li { display: flex; gap: 10px; font-size: 14px; color: var(--ink-2); }
${S_} .trap li b { font-family: var(--mono); font-weight: 600; color: var(--bad); flex: none; width: 16px; }
${S_} .trap .alt { margin-top: 10px; font-family: var(--mono); font-size: 12.5px; color: var(--ink); }
${S_} .trap .alt span { color: var(--ok); }
${S_} .st-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
${S_} .st-nav .btn { min-width: 44px; min-height: 44px; }
${S_} .st-dots { display: flex; justify-content: center; flex: 1; }
${S_} .st-dots button { width: 30px; height: 44px; display: grid; place-items: center; }
${S_} .st-dots i { display: block; width: 6px; height: 6px; border-radius: 3px; background: var(--line-strong); transition: transform .35s var(--spring), background .2s, width .35s var(--spring); }
${S_} .st-dots button.cur i { background: var(--accent); width: 18px; }
${S_} .st-dots button.seen i { background: rgba(223,122,76,.45); }
/* SVG figure */
${S_} svg text { font-family: var(--body); font-size: 10px; fill: var(--ink-2); }
${S_} svg .m { font-family: var(--mono); }
${S_} svg .dim { fill: var(--ink-dim); } ${S_} svg .ok { fill: var(--ok); } ${S_} svg .bad { fill: var(--bad); } ${S_} svg .acc { fill: var(--accent-2); } ${S_} svg .flow { fill: var(--flow); } ${S_} svg .warn { fill: var(--warn); }
${S_} .layer { transition: opacity .35s var(--ease-out), transform .4s var(--ease-out); transform-box: fill-box; transform-origin: center; }
${S_} .layer.hid { opacity: 0; pointer-events: none; transform: scale(.94); }
${S_} #st-gRegion.hid.zoom { transform: scale(.38); }
${S_} #st-gWorld.hid { transform: scale(1.18); }
${S_} .region { fill: none; stroke: var(--line-strong); }
${S_} .az rect { fill: rgba(255,255,255,.03); stroke: var(--line); transition: opacity .35s; }
${S_} .az text { transition: opacity .35s; }
${S_} .az.down rect { opacity: .22; } ${S_} .az.down text { opacity: .3; }
${S_} .bucket { fill: none; stroke: var(--accent); stroke-opacity: .45; stroke-dasharray: 4 4; }
${S_} .copy { transition: transform .4s var(--ease-out), opacity .3s var(--ease-out); transform-box: fill-box; transform-origin: center; }
${S_} .copy .obj { fill: var(--accent); transition: fill .3s; }
${S_} .copy .ln { stroke: #1a0d04; stroke-width: 2; stroke-linecap: round; opacity: .5; }
${S_} .copy .body { transition: opacity .3s; }
${S_} .copy.grey .obj { fill: var(--ink-dim); } ${S_} .copy.grey .body { opacity: .4; }
${S_} .ghost { opacity: 0; transform: translate(0,0); transition: opacity .3s, transform .35s var(--ease-out); }
${S_} .ghost rect { fill: var(--accent); opacity: .3; }
${S_} .copy.ver .ghost { opacity: 1; } ${S_} .copy.ver .g1 { transform: translate(7px,7px); } ${S_} .copy.ver .g2 { transform: translate(14px,14px); }
${S_} .ghost text { font-size: 7px; fill: var(--ink); font-family: var(--mono); }
${S_} .marker { opacity: 0; transform: translate(-12px,-30px); transition: opacity .3s, transform .35s var(--ease-out); }
${S_} .marker rect { fill: var(--bg-2); stroke: var(--warn); stroke-dasharray: 3 3; }
${S_} .marker text { fill: var(--warn); font-family: var(--mono); font-size: 9px; }
${S_} .copy.del .marker { opacity: 1; transform: translate(-12px,-22px); }
${S_} .copy.del .body { opacity: .55; }
${S_} .tag { transition: opacity .3s var(--ease-out), transform .35s var(--ease-out); }
${S_} .tag.hid { opacity: 0; transform: translateY(4px); }
${S_} .tag rect { fill: var(--bg-2); stroke: var(--line-strong); }
${S_} .tag text { font-family: var(--mono); }
${S_} #st-okTag { font-family: var(--mono); font-weight: 600; transition: opacity .3s; } ${S_} #st-okTag.hid { opacity: 0; }
${S_} #st-azDownTag { transition: opacity .3s; } ${S_} #st-azDownTag.hid { opacity: 0; }
${S_} #st-src .lbl { font-family: var(--mono); fill: var(--flow); }
${S_} .stair { fill: none; stroke: var(--line-strong); stroke-width: 2; stroke-linejoin: round; }
${S_} .shelf text { transition: opacity .3s; }
${S_} .shelf .nm { font-size: 9px; fill: var(--ink); }
${S_} .shelf .pr { font-family: var(--mono); font-size: 9px; fill: var(--accent-2); }
${S_} .shelf .mn { font-size: 8px; fill: var(--ink-dim); }
${S_} .shelf .itl, ${S_} #st-gTiers .ttl.itl { opacity: 0; }
${S_} #st-gTiers.it .shelf .lc, ${S_} #st-gTiers.it .ttl.lc { opacity: 0; }
${S_} #st-gTiers.it .shelf .itl, ${S_} #st-gTiers.it .ttl.itl { opacity: 1; }
${S_} #st-gTiers.it .s3, ${S_} #st-gTiers.it .s4 { opacity: .35; }
${S_} .s3, ${S_} .s4 { transition: opacity .3s; }
${S_} #st-gTiers .ttl { transition: opacity .3s; }
${S_} .rg .box { fill: rgba(255,255,255,.02); stroke: var(--line-strong); }
${S_} .rg .azt { fill: rgba(255,255,255,.035); stroke: var(--line); }
${S_} .rg .bk { fill: none; stroke: var(--accent); stroke-opacity: .45; stroke-dasharray: 4 4; }
${S_} .rg .o { fill: var(--accent); }
${S_} .rg .rep { transition: opacity .3s, transform .4s var(--spring); transform-box: fill-box; transform-origin: center; opacity: 0; transform: scale(.5); }
${S_} .rg.on .rep { opacity: 1; transform: none; }
${S_} #st-crrPath { fill: none; stroke: var(--flow); stroke-width: 1.5; stroke-opacity: .8; transition: stroke-dashoffset .9s linear; }
${S_} #st-dot { fill: var(--flow); opacity: 0; transition: opacity .2s; }
@media (min-width: 900px) { ${S_} .st-fig svg { max-height: min(36vh, 320px); } ${S_} .st-cap { font-size: 12px; } ${S_} .st-beat p { font-size: 16px; } }
`;

  function injectCSS() {
    if (document.getElementById("css-story-s3")) return;
    var s = document.createElement("style"); s.id = "css-story-s3"; s.textContent = CSS; document.head.appendChild(s);
  }

  var COPY = '<g class="ghost g2"><rect width="40" height="28" rx="6"/><text x="32" y="25">v1</text></g><g class="ghost g1"><rect width="40" height="28" rx="6"/><text x="32" y="25">v2</text></g><g class="body"><rect class="obj" width="40" height="28" rx="6"/><path class="ln" d="M9 10h22M9 16h14M9 22h18"/></g><g class="marker"><rect width="40" height="28" rx="6"/><text x="20" y="18" text-anchor="middle">0 B</text></g>';
  var SVG =
    '<svg viewBox="0 0 360 272" role="img" aria-label="S3 Region with three Availability Zones">' +
    '<g id="st-gRegion" class="layer">' +
      '<text class="dim" x="10" y="16">Region · eu-central-1</text>' +
      '<text id="st-okTag" class="ok hid" x="350" y="16" text-anchor="end">200 OK</text>' +
      '<rect class="region" x="6" y="24" width="348" height="236" rx="14"/>' +
      '<g id="st-az0" class="az"><rect x="20" y="40" width="100" height="200" rx="10"/><text class="dim" x="30" y="230">AZ a</text></g>' +
      '<g id="st-az1" class="az" transform="translate(110,0)"><rect x="20" y="40" width="100" height="200" rx="10"/><text class="dim" x="30" y="230">AZ b</text></g>' +
      '<g id="st-az2" class="az" transform="translate(220,0)"><rect x="20" y="40" width="100" height="200" rx="10"/><text class="dim" x="30" y="230">AZ c</text></g>' +
      '<text id="st-azDownTag" class="m bad hid" x="180" y="62" text-anchor="middle">AZ b down</text>' +
      '<rect class="bucket" x="14" y="100" width="332" height="70" rx="12"/>' +
      '<text class="acc" x="338" y="112" text-anchor="end" style="font-size:9px">bucket</text>' +
      '<g id="st-c0" class="copy">' + COPY + '</g><g id="st-c1" class="copy">' + COPY + '</g><g id="st-c2" class="copy">' + COPY + '</g>' +
      '<g id="st-src" class="copy"><text class="lbl" x="20" y="-7" text-anchor="middle">PUT</text><rect class="obj" width="40" height="28" rx="6"/><path class="ln" d="M9 10h22M9 16h14M9 22h18"/></g>' +
      '<g id="st-served" class="tag hid"><rect x="36" y="178" width="68" height="18" rx="9"/><text class="ok" x="70" y="191" text-anchor="middle">served ✓</text></g>' +
      '<g id="st-note" class="tag hid"><rect id="st-noteR" x="80" y="182" width="200" height="20" rx="10"/><text id="st-noteT" x="180" y="196" text-anchor="middle"></text></g>' +
    '</g>' +
    '<g id="st-gTiers" class="layer hid">' +
      '<text class="ttl lc dim" x="10" y="16">Lifecycle · older → cheaper → slower</text>' +
      '<text class="ttl itl dim" x="10" y="16">Intelligent-Tiering · S3 moves it for you</text>' +
      '<path class="stair" d="M12 56 H80 V96 H148 V136 H216 V176 H284 V216 H352"/>' +
      '<g class="shelf s0" transform="translate(16,56)"><text class="nm lc" y="13">Standard</text><text class="nm itl" y="13">Frequent</text><text class="pr" y="25">$0.023 /GB</text><text class="mn lc" y="36">no minimum</text><text class="mn itl" y="36">no minimum</text></g>' +
      '<g class="shelf s1" transform="translate(84,96)"><text class="nm lc" y="13">Standard-IA</text><text class="nm itl" y="13">Infrequent</text><text class="pr" y="25">$0.0125 /GB</text><text class="mn lc" y="36">30 d min</text><text class="mn itl" y="36">30 d idle</text></g>' +
      '<g class="shelf s2" transform="translate(152,136)"><text class="nm lc" y="13">Glacier Instant</text><text class="nm itl" y="13">Archive Inst.</text><text class="pr" y="25">$0.004 /GB</text><text class="mn lc" y="36">90 d min</text><text class="mn itl" y="36">90 d idle</text></g>' +
      '<g class="shelf s3" transform="translate(220,176)"><text class="nm lc" y="13">Glacier Flex.</text><text class="nm itl" y="13">Archive opt-in</text><text class="pr" y="25">$0.0036 /GB</text><text class="mn lc" y="36">90 d · min–h</text><text class="mn itl" y="36">async restore</text></g>' +
      '<g class="shelf s4" transform="translate(288,216)"><text class="nm lc" y="13">Deep Archive</text><text class="nm itl" y="13">Deep opt-in</text><text class="pr" y="25">$0.00099</text><text class="mn lc" y="36">180 d · 12–48 h</text><text class="mn itl" y="36">async restore</text></g>' +
      '<g id="st-tObj" class="copy"><rect class="obj" width="36" height="24" rx="5"/><path class="ln" d="M8 8h20M8 13h12M8 18h16"/></g>' +
    '</g>' +
    '<g id="st-gWorld" class="layer hid">' +
      '<g class="rg" transform="translate(8,92)"><text class="dim" y="-7">eu-central-1</text><rect class="box" width="150" height="130" rx="12"/>' +
        '<rect class="azt" x="8" y="10" width="38" height="100" rx="6"/><rect class="azt" x="56" y="10" width="38" height="100" rx="6"/><rect class="azt" x="104" y="10" width="38" height="100" rx="6"/>' +
        '<rect class="bk" x="6" y="36" width="138" height="40" rx="10"/>' +
        '<rect class="o" x="14" y="47" width="26" height="18" rx="5"/><rect class="o" x="62" y="47" width="26" height="18" rx="5"/><rect class="o" x="110" y="47" width="26" height="18" rx="5"/>' +
        '<text class="m ok" x="8" y="123" style="font-size:9px">versioning ✓</text><text class="dim" x="142" y="123" text-anchor="end" style="font-size:9px">source</text></g>' +
      '<g class="rg" id="st-rgUS" transform="translate(202,92)"><text class="dim" x="150" y="-7" text-anchor="end">us-east-1</text><rect class="box" width="150" height="130" rx="12"/>' +
        '<rect class="azt" x="8" y="10" width="38" height="100" rx="6"/><rect class="azt" x="56" y="10" width="38" height="100" rx="6"/><rect class="azt" x="104" y="10" width="38" height="100" rx="6"/>' +
        '<rect class="bk" x="6" y="36" width="138" height="40" rx="10"/>' +
        '<rect class="o rep" x="14" y="47" width="26" height="18" rx="5"/><rect class="o rep" x="62" y="47" width="26" height="18" rx="5"/><rect class="o rep" x="110" y="47" width="26" height="18" rx="5"/>' +
        '<text class="m ok" x="8" y="123" style="font-size:9px">versioning ✓</text><text class="dim" x="142" y="123" text-anchor="end" style="font-size:9px">replica</text></g>' +
      '<path id="st-crrPath" d="M83 126 C 110 40, 250 40, 277 126"/>' +
      '<circle id="st-dot" r="5"/>' +
      '<text class="m flow" x="180" y="34" text-anchor="middle">CRR · async · RTC ≤ 15 min</text>' +
      '<text class="m dim" x="180" y="244" text-anchor="middle" style="font-size:9px">only new writes · old objects need Batch Replication</text>' +
    '</g>' +
    '</svg>';

  var BEATS = [
    { k: "The write", h: "Every object you upload is copied before S3 says 200.",
      p: 'One PUT lands as copies in <button class="chip" data-c="copies" type="button">3 AZs</button> of the Region. Only once every copy is written does S3 answer <span class="mono">200 OK</span>. Tap the chip to see what One Zone-IA keeps instead.' },
    { k: "Two promises", h: "11 nines durability, 99.99 % availability: not the same thing.",
      p: 'Now <button class="chip" data-c="az" type="button">lose an AZ</button>. The copies there go dark, the others still serve the read. Durability is about bytes surviving for years; availability is about answering right now, and S3 may say 503 while it heals.' },
    { k: "Versioning", h: "S3 never loses bytes. It cheerfully deletes what you tell it to.",
      p: 'Tap <button class="chip" data-c="del" type="button">delete</button>. With <button class="chip on" data-c="ver" type="button">versioning on</button> the delete only drops a 0-byte marker on top; the old version sits behind it, still billed, one call from undeleted. Turn versioning off and try again.' },
    { k: "Storage classes", h: "Same bytes, five prices.",
      p: 'Age the object with <button class="chip drag" data-c="age" type="button">age: 0 d</button> (tap or drag). Lifecycle rules walk it downstairs; every shelf below Standard has a minimum stay you pay for even if you delete early, and the cheaper shelves charge to read or make you wait.' },
    { k: "Intelligent-Tiering", h: "Don't know the access pattern? Let S3 move it.",
      p: 'After 30 idle days the object drops to Infrequent, after 90 to Archive Instant. Now <button class="chip" data-c="access" type="button">access it</button>: it climbs straight back to Frequent, with no retrieval fee and no minimum stay. You pay a small monitoring fee per object instead of guessing.' },
    { k: "Replication", h: "Copy to another Region for disaster recovery.",
      p: 'Turn on <button class="chip" data-c="crr" type="button">CRR</button>: every new version is copied, asynchronously, to a bucket in us-east-1. It needs versioning on both buckets, an IAM role, and if the business wants a number, RTC promises 99.99 % within 15 minutes.' },
    { k: "Exam trap", h: "When S3 is the wrong answer.", trap: true,
      p: '<ul><li><b>✕</b><span>Edit part of a file in place</span></li><li><b>✕</b><span>Rename a folder atomically</span></li><li><b>✕</b><span>Per-folder file permissions</span></li></ul><div class="alt">→ <span>EBS</span> (one instance) · <span>EFS</span> (many Linux) · <span>FSx</span> (Windows / Lustre)</div>' }
  ];

  J.registerScene("story-s3", {
    label: function () { return "Figure · how S3 keeps your data"; },
    render: function (root, sc, ctx) {
      injectCSS();
      root.innerHTML =
        '<div class="eyebrow rv"><span>Figure</span><span class="dim">how S3 keeps your data</span></div>' +
        '<h2 class="rv">Where your bytes actually live.</h2>' +
        '<p class="lead rv">Tap the chips inside each sentence. Swipe the figure or use the arrows to step through it.</p>' +
        '<div class="st rv">' +
          '<div class="st-fig">' + SVG +
            '<div class="st-hud"><span class="k">1 TB · month</span><b class="st-cost">$23.6</b><i class="st-hudnote"></i></div>' +
            '<div class="st-cap" aria-live="polite"></div>' +
          '</div>' +
          '<div class="st-nav"><button class="btn sm ghost st-prev" aria-label="Previous">←</button><div class="st-dots" role="tablist"></div><button class="btn sm st-next">Next</button></div>' +
          '<div class="st-beats">' + BEATS.map(function (b, i) {
            return '<section class="st-beat' + (b.trap ? " trap" : "") + '" data-i="' + i + '" aria-hidden="true"><div class="k">' + (i + 1) + " / " + BEATS.length + " · " + b.k + "</div><h3>" + b.h + "</h3>" + (b.trap ? b.p : "<p>" + b.p + "</p>") + "</section>";
          }).join("") + "</div>" +
        "</div>";

      var $ = function (s) { return root.querySelector(s); };
      var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };

      /* ---------- truth ---------- */
      var TIERS = [
        { p: 0.023,   fee: "no retrieval fee" },
        { p: 0.0125,  fee: "+ $0.01 /GB to read" },
        { p: 0.004,   fee: "+ $0.03 /GB to read" },
        { p: 0.0036,  fee: "restore 1 min – 12 h" },
        { p: 0.00099, fee: "restore 12 – 48 h" }
      ];
      var AGES = [0, 30, 90, 180, 365];
      var HOME = [[50, 121], [160, 121], [270, 121]];
      var MODE = ["region", "region", "region", "tiers", "it", "world", "region"];
      var CAPS3 = [
        "day 0 · Standard · no minimum, no retrieval fee",
        "day 30 → Standard-IA · 30-day minimum · reads cost $0.01 /GB",
        "day 90 → Glacier Instant · 90-day minimum · still millisecond reads",
        "day 180 → Glacier Flexible · 90-day minimum · restore first, 1 min – 12 h",
        "day 365 → Deep Archive · 180-day minimum · restore 12 – 48 h"
      ];
      var NOTES = { 6: "whole objects only · no partial writes" };

      /* ---------- state ---------- */
      var P = { copies: 3, azDown: false, deleted: false, versioning: true, ageI: 0, accessed: false, crr: false };
      var cur = 0, arrived = false, animating = false, timers = [], crrRun = 0, crrDone = false;

      var gRegion = $("#st-gRegion"), gTiers = $("#st-gTiers"), gWorld = $("#st-gWorld");
      var copies = [$("#st-c0"), $("#st-c1"), $("#st-c2")];
      var src = $("#st-src"), okTag = $("#st-okTag"), served = $("#st-served"), azDownTag = $("#st-azDownTag");
      var note = $("#st-note"), noteT = $("#st-noteT"), noteR = $("#st-noteR");
      var tObj = $("#st-tObj"), hud = $(".st-hud"), cost = $(".st-cost"), hudNote = $(".st-hudnote"), cap = $(".st-cap");
      var crrPath = $("#st-crrPath"), dot = $("#st-dot"), rgUS = $("#st-rgUS");
      var L = crrPath.getTotalLength();
      crrPath.style.strokeDasharray = L; crrPath.style.strokeDashoffset = L;
      var sampler = LAB.pathSampler(crrPath);

      function tf(el, x, y, s) { el.style.transform = "translate(" + x + "px," + y + "px) scale(" + (s == null ? 1 : s) + ")"; }
      function later(ms, fn) { timers.push(setTimeout(fn, ms)); }
      function clearTimers() { timers.forEach(clearTimeout); timers = []; }
      function tap() { LAB.haptic("tap"); LAB.sound.play("tap"); }

      /* ---------- figure: region ---------- */
      function placeCopies(n) {
        copies.forEach(function (c, i) {
          var on = i < n;
          tf(c, HOME[i][0], HOME[i][1], on ? 1 : 0.6);
          c.style.opacity = on ? 1 : 0;
        });
      }
      function arrive(n) {
        clearTimers(); animating = true;
        okTag.classList.add("hid");
        src.style.transition = "none"; tf(src, 160, -44, 1); src.style.opacity = 1;
        copies.forEach(function (c) { c.style.transition = "none"; tf(c, 160, 121, 0.6); c.style.opacity = 0; });
        void src.getBoundingClientRect();
        src.style.transition = ""; copies.forEach(function (c) { c.style.transition = ""; });
        requestAnimationFrame(function () { tf(src, 160, 121, 1); });
        later(430, function () { src.style.opacity = 0; placeCopies(n); LAB.haptic("tick"); LAB.sound.play("whoosh"); });
        later(820, function () { animating = false; okTag.classList.toggle("hid", cur !== 0); LAB.haptic("ok"); LAB.sound.play("ok"); render(); });
      }
      function setNote(txt) {
        if (!txt) { note.classList.add("hid"); return; }
        noteT.textContent = txt;
        var w = Math.round(txt.length * 6.1 + 18);
        noteR.setAttribute("width", w); noteR.setAttribute("x", 180 - w / 2);
        note.classList.remove("hid");
      }

      /* ---------- figure: replication ---------- */
      function runCRR() {
        if (crrDone) return;
        var id = ++crrRun;
        crrPath.style.strokeDashoffset = 0; dot.style.opacity = 1;
        LAB.sound.play("whoosh");
        LAB.tween(900, function (t) {
          if (id !== crrRun) return;
          var p = sampler.at(t); dot.setAttribute("transform", "translate(" + p.x + " " + p.y + ")");
        }, LAB.ease.inOutCubic, function () {
          if (id !== crrRun) return;
          dot.style.opacity = 0; rgUS.classList.add("on"); crrDone = true;
          LAB.haptic("pop"); LAB.sound.play("pop");
        });
      }
      function resetCRR() {
        crrRun++; crrDone = false;
        crrPath.style.strokeDashoffset = L; dot.style.opacity = 0; rgUS.classList.remove("on");
      }

      /* ---------- captions ---------- */
      function caption() {
        switch (cur) {
          case 0: return P.copies === 3 ? "PUT → copies in ≥ 3 AZs → 200 OK · Standard, IA and Glacier all do this" : "One Zone-IA: 1 copy in 1 AZ · lose the AZ, lose the data · only for re-creatable files";
          case 1: return P.azDown ? "AZ b down · still served · 11 nines: with 10 M objects, lose 1 every 10,000 years" : "99.99 % available ≈ 53 min / year unreachable · 11 nines durable ≈ never lost";
          case 2: return !P.deleted ? (P.versioning ? "every overwrite keeps the old version (v1, v2 …) · each one is billed" : "versioning off · a delete or overwrite is final") : (P.versioning ? "delete marker on top (0 B) · data stays below · delete the marker to undelete" : "versioning off · gone for good · 11 nines did not help");
          case 3: return CAPS3[P.ageI];
          case 4: return P.accessed ? "accessed → back to Frequent · no retrieval fee · no minimum stay" : "idle 30 d → Infrequent · idle 90 d → Archive Instant · monitoring ≈ $0.0025 / 1,000 objects";
          case 5: return P.crr ? "async copy of every new version · RTC: 99.99 % within 15 min · deletes of versions never copy" : "needs versioning on both buckets · only new writes replicate";
          case 6: return "no partial writes · no renames · no per-folder ACLs → EBS / EFS / FSx";
        }
        return "";
      }

      /* ---------- render ---------- */
      function render() {
        var mode = MODE[cur];
        gRegion.classList.toggle("hid", mode !== "region"); gRegion.classList.toggle("zoom", mode === "world");
        gTiers.classList.toggle("hid", mode !== "tiers" && mode !== "it"); gTiers.classList.toggle("it", mode === "it");
        gWorld.classList.toggle("hid", mode !== "world");
        hud.classList.toggle("show", mode === "tiers" || mode === "it");

        if (mode === "region") {
          var n = cur === 0 ? P.copies : 3;
          if (!animating) { placeCopies(n); src.style.opacity = 0; okTag.classList.toggle("hid", cur !== 0); }
          var down = cur === 1 && P.azDown;
          $("#st-az1").classList.toggle("down", down); copies[1].classList.toggle("grey", down);
          served.classList.toggle("hid", !down); azDownTag.classList.toggle("hid", !down);
          var del = cur === 2 && P.deleted, ver = cur === 2 && P.versioning;
          copies.forEach(function (c) { c.classList.toggle("del", del && ver); c.classList.toggle("ver", ver); });
          if (del && !ver && !animating) copies.forEach(function (c) { c.style.opacity = 0; });
          setNote(NOTES[cur]);
        }
        if (mode === "tiers" || mode === "it") {
          var i = mode === "tiers" ? P.ageI : (P.accessed ? 0 : 2);
          tf(tObj, 12 + 68 * i + 16, 56 + 40 * i - 26, 1);
          LAB.count(cost, TIERS[i].p * 1024, { fmt: LAB.money, ms: 500 });
          hudNote.textContent = mode === "it" ? "+ $0.0025 / 1,000 objects" : TIERS[i].fee;
        }
        if (mode === "world") { if (P.crr) runCRR(); else resetCRR(); }
        cap.textContent = caption();
      }

      /* ---------- beats: prev / next / dots / swipe ---------- */
      var beatEls = $$(".st-beat"), dotsEl = $(".st-dots"), prevB = $(".st-prev"), nextB = $(".st-next"), seen = {};
      BEATS.forEach(function (b, i) {
        var bt = document.createElement("button"); bt.type = "button"; bt.innerHTML = "<i></i>"; bt.setAttribute("role", "tab");
        bt.setAttribute("aria-label", "Part " + (i + 1) + ": " + b.k); bt.onclick = function () { go(i); };
        dotsEl.appendChild(bt);
      });
      var dots = $$(".st-dots button");
      function go(i, quiet) {
        i = LAB.clamp(i, 0, BEATS.length - 1);
        var prev = cur; cur = i; seen[i] = 1;
        beatEls.forEach(function (b, j) {
          b.classList.toggle("on", j === i); b.classList.toggle("back", j < i);
          b.setAttribute("aria-hidden", String(j !== i));
          b.querySelectorAll("button").forEach(function (c) { c.tabIndex = j === i ? 0 : -1; });
        });
        dots.forEach(function (d, j) { d.classList.toggle("cur", j === i); d.classList.toggle("seen", !!seen[j] && j !== i); d.setAttribute("aria-selected", String(j === i)); });
        prevB.disabled = i === 0;
        nextB.textContent = i === BEATS.length - 1 ? "Done" : "Next";
        cap.classList.add("swap"); setTimeout(function () { cap.classList.remove("swap"); }, 160);
        render();
        if (!quiet && prev !== i) { LAB.haptic("tick"); LAB.sound.play("tick"); }
      }
      prevB.onclick = function () { go(cur - 1); };
      nextB.onclick = function () {
        if (cur === BEATS.length - 1) { LAB.haptic("ok"); LAB.sound.play("ok"); if (ctxNext) ctxNext(); return; }
        go(cur + 1);
      };
      var fig = $(".st-fig"), sw = null;
      fig.addEventListener("pointerdown", function (e) { sw = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
      fig.addEventListener("pointercancel", function () { sw = null; });
      fig.addEventListener("pointerup", function (e) {
        if (!sw || e.pointerId !== sw.id) return;
        var dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
        if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) go(cur + (dx < 0 ? 1 : -1));
      });

      /* ---------- chips ---------- */
      function chip(name) { return root.querySelector('[data-c="' + name + '"]'); }
      chip("copies").onclick = function () {
        P.copies = P.copies === 3 ? 1 : 3;
        this.textContent = P.copies === 3 ? "3 AZs" : "1 AZ";
        this.classList.toggle("on", P.copies === 1);
        tap(); arrive(P.copies); cap.textContent = caption();
      };
      chip("az").onclick = function () { P.azDown = !P.azDown; this.classList.toggle("on", P.azDown); LAB.haptic(P.azDown ? "bad" : "tap"); LAB.sound.play(P.azDown ? "bad" : "tap"); render(); };
      chip("del").onclick = function () { P.deleted = !P.deleted; this.classList.toggle("on", P.deleted); this.textContent = P.deleted ? "undelete" : "delete"; tap(); render(); };
      chip("ver").onclick = function () { P.versioning = !P.versioning; this.classList.toggle("on", P.versioning); this.textContent = P.versioning ? "versioning on" : "versioning off"; tap(); render(); };
      chip("access").onclick = function () { P.accessed = !P.accessed; this.classList.toggle("on", P.accessed); this.textContent = P.accessed ? "let it idle" : "access it"; LAB.haptic(P.accessed ? "pop" : "tap"); LAB.sound.play(P.accessed ? "pop" : "tap"); render(); };
      chip("crr").onclick = function () { P.crr = !P.crr; this.classList.toggle("on", P.crr); tap(); render(); };

      var chAge = chip("age"), dragX = null, dragI = 0, moved = false;
      function setAge(i) {
        i = LAB.clamp(i, 0, 4); if (i === P.ageI) return;
        P.ageI = i; chAge.textContent = "age: " + AGES[i] + " d"; chAge.classList.toggle("on", i > 0);
        LAB.haptic("tick"); LAB.sound.play("tick"); render();
      }
      chAge.addEventListener("pointerdown", function (e) { dragX = e.clientX; dragI = P.ageI; moved = false; try { chAge.setPointerCapture(e.pointerId); } catch (x) {} });
      chAge.addEventListener("pointermove", function (e) { if (dragX == null) return; var d = Math.round((e.clientX - dragX) / 40); if (d !== 0) moved = true; setAge(dragI + d); });
      chAge.addEventListener("pointerup", function () { if (dragX == null) return; if (!moved) setAge((P.ageI + 1) % 5); dragX = null; });
      chAge.addEventListener("pointercancel", function () { dragX = null; });
      chAge.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setAge((P.ageI + 1) % 5); } });

      var ctxNext = ctx && ctx.next;
      placeCopies(3); src.style.opacity = 0;
      go(0, true);

      return {
        enter: function () {
          // the PUT lands the first time the figure goes live
          if (!arrived && cur === 0) { arrived = true; arrive(P.copies); }
        },
        leave: function () { clearTimers(); if (animating) { animating = false; render(); } crrRun++; if (!crrDone) { dot.style.opacity = 0; } },
        destroy: function () { clearTimers(); crrRun++; }
      };
    }
  });

  J.cast("s3", [{ type: "story-s3", id: "story", after: "object-model", label: "Figure · how S3 keeps your data" }]);
})();
