# Interactive explanatory visualization — research report for the AWS SA learning app redesign

Scope: vanilla JS, no build step, GitHub Pages, mobile-first. Every item below was checked via live fetch/search on 2026-10-25; star counts are GitHub's rounded figures on that date unless noted. Where a claim could not be verified it is flagged.

---

## 1. Explorable explanations / interactive essays

### 1.1 Sam Rose — samwho.dev (Load Balancing, Queueing, Hashing, Memory Allocation, Bloom Filters, Retries, Turing Machines, Reservoir Sampling, Big O)
- URLs: https://samwho.dev/load-balancing/ , https://samwho.dev/hashing/ , https://samwho.dev/memory-allocation/ , https://samwho.dev/bloom-filters/ , https://encore.dev/blog/queueing , https://encore.dev/blog/retries
- What: the single best model for this project. Each post is a live simulation that escalates "one problem → one fix" per section, ending in a free playground.
- Interaction pattern (verified from the posts): requests are coloured shapes travelling from client to server; waiting requests change colour the longer they wait; a request "shrinks like a clock" as its timeout approaches; hollow = timed out; priority requests have stripes. Every sim has pause/play, a speed slider, reset (with randomised params). The Queueing post makes *you* the client — you spam a "Send" button to overload the server, which motivates the queue; later sections set small goals ("fill the queue", "let one time out", "send a priority request") then show FIFO/LIFO/Priority/RED side by side with percentile charts. Hashing uses clickable grids where each hashed value darkens a square (clumps = bad hash) plus an avalanche-bit display.
- Tech: V1 used PixiJS + Plotly; V2 is a **Lit web component rendering SVG** for both sims and charts — i.e. no framework needed, directly portable to vanilla + `<svg>`.
- License: content is his; not a library. Steal the pattern, not the code.
- AWS idea: **SQS lesson = the Queueing post re-skinned.** Button = producer; queue = row of slots; Lambda = consumer. Add a "visibility timeout" slider: a consumed message turns ghosted and a ring drains; if the consumer doesn't delete in time the message reappears — the learner *sees* duplicate delivery. Then DLQ after N receives. Same engine for ELB (load-balancing post → ALB round robin vs least outstanding requests).

### 1.2 Bartosz Ciechanowski — ciechanow.ski
- URL: https://ciechanow.ski/archives/ (Mechanical Watch, GPS, Sound, Cameras and Lenses, Bicycle, Airfoil, Moon, Internal Combustion Engine, etc.)
- What: long-form essays where every figure is a draggable/scrubbable 3D or 2D model; text and figure are colour-coded to each other; sliders are placed directly under each figure.
- Pattern: *scrubbable slider under every diagram*, colour-coding between prose and figure, rotatable 3D to "get oriented", never autoplaying — the reader drives. Widely reported to be hand-written vanilla JS + WebGL with no framework (consistent with the site; not independently verified in this research).
- License: all-rights-reserved content.
- AWS idea: a "slice through a Region" figure: slider scrubs from Region → AZ → VPC → subnet → ENI, zooming like a mechanical cutaway; colour-code the words "Availability Zone" in the prose to the AZ blocks in the figure.

### 1.3 Red Blob Games — Amit Patel
- URLs: https://www.redblobgames.com/pathfinding/a-star/introduction.html , https://www.redblobgames.com/grids/hexagons/ , making-of: https://www.redblobgames.com/making-of/circle-drawing/
- What: the canonical reference on *how to author* interactive diagrams. The making-of page lays out the method: start with a static SVG, add one draggable handle, bind sliders and handles to the same state (two-way), convert pointer → SVG → grid coords with pointer capture, clamp/snap, block touch-scroll during drags, and "one diagram = one concept, highlight it". Starter code exists for vanilla JS, lit-html, Preact, Vue, React.
- License: article code MIT or Apache-2.0.
- AWS idea: a CIDR diagram where you drag a handle along a 32-bit ruler to set the prefix length; the subnet count and host count update inline in the sentence ("a /24 gives you **251** usable hosts in AWS").

### 1.4 Josh W. Comeau — joshwcomeau.com
- URL: https://www.joshwcomeau.com/svg/friendly-introduction-to-svg/ (2025)
- What: interactive widgets with sliders that emit a subtle click sound as you adjust them (noted by Simon Willison); "playgrounds you can drag, poke and break deliberately". Playground built on Sandpack (open source, CodeSandbox).
- Pattern worth stealing: **audio micro-feedback on sliders and completions**, inline live-value sentences, "break it on purpose" prompts.
- AWS idea: a bucket-policy toggle widget where flipping "Block Public Access" plays a soft latch click and the S3 object instantly flips from "403" to "200" in a mini preview.

### 1.5 explorabl.es — Nicky Case
- URL: https://explorabl.es/ , source https://github.com/explorableexplanations/explorableexplanations.github.io (520 stars, CC0). Related: Parable of the Polygons, Evolution of Trust (Nicky Case).
- What: curated index of 100+ explorables + a "make your own" section; hosting advice literally is GitHub Pages.
- Pattern: each explorable is a self-contained playable toy embedded mid-text; reader manipulates, then the text asks a question that the toy answers.
- AWS idea: the "IAM evaluation" toy — a small world of principals/resources/policies you drag together; the decision (Allow / Explicit Deny / Implicit Deny) is announced as you drop a policy on a role.

### 1.6 The Pudding (process notes) and Distill.pub
- Pudding scrollytelling guide: https://pudding.cool/process/how-to-implement-scrollytelling and https://pudding.cool/process/introducing-scrollama/ (sticky-graphic pattern; they warn the desktop example needs extra mobile work).
- Distill.pub: https://distill.pub/ (on hiatus since 2021, still the reference for "figure-first" technical essays; e.g. https://distill.pub/2019/activation-atlas/ , https://distill.pub/2018/building-blocks/ ).
- Pattern: sticky figure on the left/top that mutates as text steps scroll past; margin-note style footnotes.
- AWS idea: "Life of a request" scrolly — the diagram stays pinned while steps light Route 53 → CloudFront → ALB → EC2 → RDS; on mobile the figure pins to the top 40 % and steps scroll beneath.

### 1.7 howdns.works / howhttps.works comics (DNSimple) and Julia Evans' zines
- URLs: https://howdns.works/ (comic; verified via DNSimple's comics page https://dnsimple.com/comics ), https://wizardzines.com/comics/life-of-a-dns-query/
- Pattern: character-driven packets (the resolver "TinyP" on a quest), one panel per hop, swipeable.
- AWS idea: the Route 53 lesson as a 6-panel swipe-comic on mobile where the "query" character visits the resolver, the TLD server, and the hosted zone, with alias records as a shortcut door.

---

## 2. Animated system / network / packet-flow visualization

### 2.1 SVG `<animateMotion>` + `<mpath>` (the mechanism behind React Flow's "Animated SVG Edge")
- Reference: https://reactflow.dev/ui/components/animated-svg-edge (React), but the mechanism is plain SVG:
  ```html
  <path id="route" d="M50,150 C150,50 250,250 350,150" fill="none" stroke="#ccc"/>
  <circle r="4" fill="#ff9900"><animateMotion dur="2s" repeatCount="indefinite"><mpath href="#route"/></animateMotion></circle>
  ```
- Why: zero dependencies, GPU-friendly, works on every mobile browser, and the packet follows any bezier edge. React Flow's own note: `stroke-dasharray` "marching ants" on many edges is CPU-heavy — prefer a few moving dots.
- AWS idea: every architecture diagram in the app gets live "packets" on its edges; pausing a packet shows its payload (HTTP method, SQS message body, IAM request context).

### 2.2 Isoflow (library) + FossFLOW (app)
- https://github.com/markmanx/isoflow — 1.7k stars, MIT (Community Edition), React component for isometric network diagrams, exports JSON/image. https://github.com/akx/FossFLOW — Unlicense PWA built on it, works offline.
- Why: the Cloudcraft look (isometric AWS boxes, animated connectors) without Cloudcraft. React-only, so for vanilla you would either embed a pre-built FossFLOW bundle in an iframe or borrow its isometric icon/grid math and draw with SVG.
- AWS idea: an isometric "build a 3-tier app" sandbox: drag ALB/EC2/RDS tiles onto a 2.5D grid, draw the connectors, and the app animates traffic and scores the design (public subnet? DB in private subnet?).

### 2.3 vasturiano force-graph / 3d-force-graph (`linkDirectionalParticles`)
- https://github.com/vasturiano/force-graph (2D canvas) and https://github.com/vasturiano/3d-force-graph — MIT, CDN script-tag usable, `.linkDirectionalParticles(n)` draws equi-spaced particles travelling source → target with speed/colour/size setters.
- Why: the fastest route to "requests flowing between nodes" with no build; 2D canvas version is light enough for phones.
- AWS idea: a VPC peering vs Transit Gateway comparison — toggle, and particles reroute from a mesh (N² peering links) to a hub-and-spoke; the learner sees why TGW scales.

### 2.4 Raft visualizer (Raminshiraz) and distributed-systems-visualizer
- https://github.com/Raminshiraz/raft-visualizer — 59 stars, MIT, live at https://raminshiraz.github.io/raft-visualizer/ , vendored React, no bundler; crash nodes, partition network, cut single links one-way, packet loss and jitter sliders, pause/step/jump-to-next-event, hover in-flight RPCs to inspect payloads.
- https://github.com/sandeepkv93/distributed-systems-visualizer — MIT, Next.js, 22 sims (CAP, quorum, consistent hashing, sharding + rebalancing, 2PC, Paxos, Raft), live at https://sandeepkv93.github.io/distributed-systems-visualizer/
- Why: the control vocabulary is exactly right for AWS failure-mode teaching: "kill an AZ", "partition", "add latency", "step one event".
- AWS idea: Multi-AZ RDS failover sim — tap the primary AZ to kill it, watch DNS CNAME flip and writes resume on the standby after ~60s of (sped-up) sim time; contrast with a Read Replica that does *not* auto-promote.

### 2.5 Motion Canvas, Theatre.js (authoring-grade, heavier)
- https://github.com/motion-canvas/motion-canvas — 19.5k stars, MIT, TypeScript + Canvas API; aimed at programmatic explainer videos but ships a `player` custom element for in-browser playback.
- https://github.com/theatre-js/theatre — 12.8k stars, core Apache-2.0 / studio AGPL-3.0; a keyframe editor for the web, but README says dev has "temporarily moved to a private repo" — maintenance risk.
- Why: for 3–4 hero sequences (e.g. "what happens when you upload to S3") a pre-authored Motion Canvas animation played in `<motion-canvas-player>` gives 3Blue1Brown-level polish; not for the everyday widgets.
- AWS idea: a 20-second Motion Canvas intro per service page, scrubbable by the learner, then the hands-on sim below.

### 2.6 GSAP (+ ScrollTrigger, MotionPath, Flip), anime.js v4
- GSAP: https://gsap.com — now 100 % free incl. all former Club plugins (Webflow acquisition), "no charge" standard license (free for commercial use; not OSI open source). Current 3.15.x, CDN-loadable.
- anime.js: https://github.com/juliangarnier/anime — 73.8k stars, MIT, v4, lightweight, animates CSS/SVG/DOM/JS objects, has `svg.createMotionPath` for "packet along a path".
- Why: both are drop-in `<script>` libraries; GSAP's MotionPathPlugin + Flip plugin cover packets-on-paths and "state A → state B" layout morphs (e.g., a single-AZ diagram re-flowing into Multi-AZ).
- AWS idea: Flip-animate the architecture when the learner toggles "Enable Multi-AZ" — nodes slide, duplicates appear, edges re-route — rather than swapping two static images.

### 2.7 Rive and dotLottie
- Rive web runtime: https://github.com/rive-app/rive-wasm — 1.0k stars, MIT; state machines with boolean/number/trigger inputs driven from JS (vector, tiny files). dotLottie: https://github.com/LottieFiles/dotlottie-web — official player, Web Component `<dotlottie-wc>`, renders in a Worker/OffscreenCanvas.
- Why: designer-authored micro-animations (a bucket "accepting" an object, a Lambda "igniting") that respond to app state via inputs — the Duolingo-feel without hand-coding every tween.
- AWS idea: a Rive Lambda icon with inputs `cold`, `warm`, `concurrency`; the first invocation shows a visibly slower "cold start" ignition, subsequent ones are instant — the concept lands in one glance.

### 2.8 Excalidraw / tldraw (note licensing)
- https://github.com/excalidraw/excalidraw — 134.5k stars, MIT, but `@excalidraw/excalidraw` requires React; libraries.excalidraw.com has AWS shape packs. https://github.com/tldraw/tldraw — 51.1k stars, **not** open-source: tldraw license, production requires a key.
- Why: hand-drawn style is a strong "not childish, not corporate" register; but embedding either is heavy for vanilla. Better use: export Excalidraw SVGs as static assets and animate them with SVG `<animateMotion>`.

---

## 3. Game-like learning UIs for technical topics

### 3.1 Learn Git Branching — https://github.com/pcottle/learnGitBranching (34.2k stars, MIT, fully client-side; demo https://pcottle.github.io/learnGitBranching/ )
- What makes it satisfying: every command *immediately* redraws the commit DAG with animation; levels have a target state shown side-by-side with yours; "solve in N commands" scoring; a free sandbox; level-select map with ticks.
- AWS idea: "Learn IAM Policies" in the same mould — a live JSON editor on the left, an access matrix (principals × actions × resources) on the right that re-lights green/red on every keystroke, with a target matrix to match in the fewest statements.

### 3.2 Oh My Git! — https://github.com/git-learning-game/oh-my-git (2.9k stars, Blue Oak license, Godot 3, low-maintenance mode)
- What makes it work: commands are **playing cards** you drag onto the repo; real git runs underneath so the visual state is always true; levels with goals and a hint card.
- AWS idea: "service cards" dragged onto an architecture to satisfy a requirement card ("decouple these two services") — this is also exactly AWS Card Clash's loop, so it's a proven mechanic in this domain.

### 3.3 Flexbox Froggy / Grid Garden (Codepip) — https://github.com/thomaspark/flexboxfroggy (7.4k stars, MIT, plain HTML/CSS/JS)
- What makes it work: one tiny input per level; the scene animates to the new state on each keystroke; win = the frogs land on the lily pads (visible, delightful state change); 24 levels; progress in localStorage. Not childish despite frogs because the task is real CSS.
- AWS idea: "Security Group Garden": type one rule per level (`tcp 443 0.0.0.0/0`) and watch the request arrows get through or bounce; win when exactly the allowed traffic reaches the instance.

### 3.4 NandGame — https://nandgame.com/ (free; build a computer from NAND gates up to a CPU and assembler; not open source as far as verified)
- What makes it work: strict dependency ladder — each level's component becomes a draggable part in the next; a truth-table checker gives instant pass/fail; no text walls.
- AWS idea: the same ladder for networking: level 1 CIDR → level 2 subnet → level 3 route table → level 4 IGW/NAT → level 5 full VPC; each completed level becomes a reusable block in the next.

### 3.5 AWS Card Clash and AWS Cloud Quest (AWS's own)
- Card Clash: https://aws.amazon.com/training/digital/aws-card-clash/ — free 3D card game, 57 architecture designs, 4 learning paths incl. Solutions Architect; loop = fill the missing component in an architecture with the right service card; mobile apps updated mid-2026.
- Cloud Quest: https://aws.amazon.com/training/digital/aws-cloud-quest/ — 3D city, 9 roles, AI customer conversations → design → build in real AWS → official badge; mostly behind Skill Builder subscription.
- Why: confirms that "complete the architecture" is the AWS-approved game loop; you can do the web version they don't have.
- AWS idea: "Clash-lite": a diagram with one slot missing and 4 service tiles; instant feedback with a one-line *why* for wrong picks.

### 3.6 Boot.dev gamification and Brilliant.org lesson design (patterns, not code)
- Boot.dev: XP, daily streaks with "embers" to cover missed days, community boss fights every 4–8 weeks ( https://blog.boot.dev/wiki/the-game/ ). Brilliant: "a puzzle that unfolds in layers", "try before the procedure", "mistakes aren't dead-ends" ( https://brilliantorg.notion.site/About-Brilliant-lessons-f90ec481d92c4f0fb28c5f5d346db90d ).
- AWS idea: per-service mastery rings on a progression map (Compute → Storage → Networking…), daily streak with one forgiving "ember", and every quiz asked *before* the explanation.

### 3.7 Killercoda (Katacoda successor) — https://killercoda.com/
- Browser terminal sandboxes, Katacoda-compatible scenario format; freemium. Not embeddable for free and not client-side; relevant only as the "real console" tier to link out to after a simulation.

---

## 4. Scrollytelling + infographic tooling

### 4.1 Scrollama — https://github.com/russellsamora/scrollama (6.0k stars, MIT, v3.2.0, dependency-free, IntersectionObserver-based; `onStepEnter/Exit/Progress`)
- AWS idea: the "sticky diagram + steps" pattern for every "How X works" page; `onStepProgress` drives the packet position so scroll *is* the scrubber on mobile.

### 4.2 CSS scroll-driven animations (`animation-timeline: scroll()/view()`)
- Chrome/Edge 115+, Safari 26, Firefox still behind a flag (per Chrome docs and Mozilla Connect); Chrome 145 adds scroll-*triggered* animations. https://developer.chrome.com/docs/css-ui/scroll-driven-animations
- Why: zero-JS, off-main-thread, perfect for mobile; use with `@supports (animation-timeline: scroll())` and Scrollama as fallback.
- AWS idea: a request's progress bar across the architecture bound to the section's `view()` timeline — it literally moves as you scroll the explanation.

### 4.3 View Transitions API
- Same-document: Chrome/Edge 111+, Safari 18+, Firefox 144 (Baseline Newly Available Oct 2025 per Thinktecture deck; verify on MDN). Cross-document: Chrome 126+, Safari 18.2+, Firefox partial.
- AWS idea: tapping a service tile on the overview expands into its lesson with a shared-element morph (the icon flies to the header) — the "app-like" feel for free with `document.startViewTransition`.

### 4.4 Lenis smooth scroll — https://github.com/darkroomengineering/lenis (16.9k stars, MIT, v1.3.27, wraps native scroll)
- Caution: `syncTouch` is unstable below iOS 16 and smooth-wheel scroll is irrelevant on phones; for mobile-first, probably skip Lenis and rely on native scroll + scroll-driven CSS.

### 4.5 Observable Plot — https://github.com/observablehq/plot (≈4.4k stars, ISC, CDN-loadable, layered grammar on top of D3)
- AWS idea: the percentile/latency charts in a load-balancer sim, or a live cost curve as you drag an EC2 size slider.

### 4.6 Zdog — https://github.com/metafizzy/zdog (≈10k stars, MIT, canvas/SVG pseudo-3D, 2k-ish lines; last commit years ago but stable)
- Why: the "flat, round, designer-friendly" isometric look with no WebGL — ideal for lightweight 3D-ish AWS boxes on phones.
- AWS idea: Zdog isometric VPC cube you can spin with a finger; subnets are inner slabs that slide out on tap.

### 4.7 globe.gl / three-globe / cobe (regions & AZs)
- https://github.com/vasturiano/globe.gl — 3.2k stars, MIT, CDN script-tag, arcs/points/labels/animated rings. https://github.com/shuding/cobe — 6.0k stars, MIT, ~5 KB, zero deps, plain-JS `createGlobe(canvas, config)`, markers/arcs bindable to DOM via CSS anchor positioning. GitHub's own globe write-up: https://github.blog/engineering/how-we-built-the-github-globe/
- AWS idea: cobe globe of Regions; tap a Region to zoom into a ring of AZs; replication arcs show cross-Region S3 CRR or Global Accelerator paths; CloudFront edges as a pulse layer.

---

## 5. AWS service simulation in the browser

### 5.1 Client-side IAM evaluators
- **cloud-copilot/iam-simulate** — https://github.com/cloud-copilot/iam-simulate (106 stars, AGPL-3.0, TypeScript library; identity, resource, SCP, RCP, permission boundaries, all condition operators; hosted tester https://iam.cloudcopilot.io/tools/policy-tester ). AGPL is fine for a GH Pages learning site if you publish source.
- **Offline "IAM Decision Diamond" evaluator** — https://hidekazu-konishi.com/tools/iam_policy_simulator_tool.html (fully client-side, 7-stage trace, same-account vs cross-account, presets for SCP/boundary/RCP denies; no license/source published — pattern reference only).
- **node-pbac** — https://github.com/granodigital/node-pbac (AWS-inspired evaluation engine, npm).
- AWS idea: bundle iam-simulate into an ESM file and build the "decision diamond" as an animated flowchart: drop a policy, watch the token travel Explicit Deny → SCP → Resource policy → Identity policy → Boundary → Session, lighting the stage that decided.

### 5.2 CIDR / subnet visualizers
- **cidr.xyz** — https://github.com/yuvadm/cidr.xyz (854 stars, MIT, live https://cidr.xyz , Astro/React). Octets you scroll/drag, bit ruler shows network vs host bits.
- **visualsubnetcalc** — https://github.com/ckabalan/visualsubnetcalc (367 stars, MIT, live https://visualsubnetcalc.com , has an **AWS mode**: smallest /28, 5 reserved addresses; split/join subnets by clicking; shareable URLs). Fork nickromney/visualsubnetcalc adds auto-allocation and utilisation checks.
- AWS idea: embed the split/join interaction: start with a /16 VPC and tap to split into public/private subnets per AZ; the AWS mode's "5 reserved IPs" becomes a tooltip the learner discovers by counting.

### 5.3 Mock/emulated AWS (for reference and future "real console" tier)
- **Floci** — https://github.com/floci-io/floci (27.1k stars, MIT, Java/Quarkus, LocalStack alternative with a browser console at `/_floci/ui`; S3, SQS, SNS, DynamoDB, Lambda, IAM, …). Server-side, so not for GH Pages, but its console UI is a reference for a believable mock console.
- **fakecloud** — https://github.com/faiscadev/fakecloud (107 services, Smithy-conformant, no auth). Same caveat.
- **Local-AWS-Simulator** — https://github.com/manojbarot1/Local-AWS-Simulator (1 star, Flask; 17 guided labs checked against live state — the *lab-checking* idea is good even if the repo is tiny).
- **spka2yb9/aws-managment-console-learning** — static GH Pages console mimic (Japanese UI) — proves a static mock console is feasible.
- No in-browser LocalStack exists (confirmed); for a static site the realistic path is a **small JS "fake AWS" state machine** per service (bucket map, queue array with visibility timers, Lambda invocations with cold-start flag) feeding the visuals.

### 5.4 AWS pricing data
- **ec2instances.info / instances.vantage.sh** — https://github.com/vantage-sh/ec2instances.info (open source, MIT per mirror — check LICENSE; JSON for EC2/RDS/ElastiCache; TypeScript/Python SDKs).
- AWS idea: a "right-size this workload" slider: drag vCPU/RAM, see the cheapest matching family and the monthly cost live, with Spot/Reserved toggles.

### 5.5 AWS Architecture Icons
- Official: https://aws.amazon.com/architecture/icons/ — quarterly releases (current files suffixed 07312026), ZIP of SVG/PNG + PPTX; terms on page: customers and partners may use them in architecture diagrams, whitepapers, presentations, data sheets, posters. Amazon owns them; keep them unmodified (recolouring is risky), credit AWS.
- npm: `aws-icons` (MKAbuMattar) — MIT wrapper, synced monthly, ships `@aws-icons/svg` optimised SVGs, Iconify JSON and **SVG symbol sprites** (ideal for a no-build site). `aws-svg-icons` is a 2021 snapshot — avoid. draw.io also bundles an aws4 shape set (not confirmed in the folder listing fetched).
- AWS idea: one sprite sheet, `<use href="#Arch_Amazon-S3">`, animated via CSS variables for state (idle/active/error glow).

### 5.6 Networking "game" references
- **NetSim (webdeveden/network-simulator)** — https://github.com/webdeveden/network-simulator (0 stars but complete: Vue Flow canvas, hop-by-hop packet animation with ARP/MAC learning/TTL, missions with budget, par time and star ratings, Cisco-IOS console, 3D server room). **PackeTTrino** — https://github.com/EvilPrime98/PackeTTrino (pure JS, no deps; DHCP/DNS/TCP/ICMP/ARP). **tcp-ip-simulator** — https://github.com/sjanaX01/tcp-ip-simulator (static site, layer-by-layer encapsulation walk-through).
- AWS idea: missions with budget + par (NetSim) map directly onto "build this VPC under $X with ≤N resources, 3-star if you use a NAT gateway only where needed".

---

## Top 10 patterns worth stealing (ranked by impact for a mobile-first vanilla JS site)

1. **"One problem → one fix" escalating live sim with pause/speed/reset (Sam Rose).** Each AWS concept page is a sequence of 4–6 small sims that each add one knob; final section is a free playground. Build once as a Lit-free vanilla `<svg>` engine with a tiny event loop (requests as circles, queues as slot rows, servers as boxes).
2. **Reader-as-client: a big "Send request" button you can spam (Encore Queueing).** Immediate cause→effect on a phone: tap fast, watch the server drop requests, then SQS appears as the fix. Works for SQS, ALB, API Gateway throttling, Lambda concurrency.
3. **Visible timers on objects (shrinking ring / fading colour).** Visibility timeout, TTL, cold start, health-check grace, Spot interruption notice — all become the same "draining ring" idiom.
4. **Packets along paths via SVG `<animateMotion>` + `<mpath>`.** Zero libraries, mobile-cheap, and tappable packets that reveal their payload (headers, IAM context, message body).
5. **Immediate-redraw state diagrams with target state side-by-side (Learn Git Branching).** IAM policy editor → access matrix; route table editor → reachability map; "match the target in N edits".
6. **One-input-per-level ladder where completed parts become next-level blocks (NandGame, Flexbox Froggy).** CIDR → subnet → route → IGW/NAT → VPC. 20–30 second levels suit phones.
7. **Fill-the-missing-component architecture puzzles (AWS Card Clash, Oh My Git cards).** Drag a service tile into the gap; wrong picks get a one-line "why not". Low build cost, high repeat value, directly maps to SA exam questions.
8. **Scroll as the scrubber: sticky figure + Scrollama `onStepProgress`, upgraded to CSS `animation-timeline: view()` where supported.** Turns the explanation into a hand-driven animation without buttons, which is the natural phone gesture.
9. **View Transitions for tile → lesson morphs + Flip-style layout re-flow when toggling an option (Multi-AZ, CRR, Auto Scaling).** Replaces image swaps with motion that *is* the explanation.
10. **Failure-mode knobs (Raft visualizers): "kill this AZ", "partition", "add latency", "step one event".** Every resilience topic (Multi-AZ RDS, ASG, Route 53 failover, DLQ) becomes a tap-to-break toy with a step button, plus a Boot.dev-style streak/mastery map and Comeau-style audio clicks for completion.

Honourable mentions kept out of the top 10 on mobile grounds: Lenis (desktop smooth-scroll), Motion Canvas (authoring-heavy), isometric 3D (Isoflow/Zdog — use for 2–3 hero figures, not everywhere), globe (cobe at 5 KB is the one 3D indulgence that pays off for Regions/AZs/edge locations).
