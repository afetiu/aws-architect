# Craft research: making a vanilla-JS AWS learning app feel like a premium game for adults

Scope: build-free vanilla JS, GitHub Pages, mobile-first, must stay smooth on a mid-range Android. URLs were fetched or search-verified on 2026-10-25.

---

## 1. "Game feel" / juice for non-game UIs

### 1.1 Rauno Freiberg — Invisible Details of Interaction Design
- https://rauno.me/craft/interaction-design
- **Frequency vs novelty**: no animation on things done hundreds of times a day; spend motion on rare moments. Novelty decays into cognitive burden.
- **Origin-aware transitions**: a thing opens from where it was triggered.
- **Gesture timing**: reversible actions fire *during* the gesture; destructive ones wait for release.
- **Interruptibility**: every animation must accept new input mid-flight.
- **Confirmation blink**: flash the accent once on selection, then fade — the cheapest "I heard you".
- **Fidgetability**: repeatable, physical-feeling micro-interactions make a product feel premium.
- **Kinetic physics**: thrown objects keep velocity; lighter objects bounce less.
- Apply: lesson card expands *from its tile* on the board; answer buttons blink the accent once; service icons press with a spring every time. Quiz "next" (frequent) = no animation; "module complete" (rare) = the big moment.

### 1.2 Emil Kowalski — Great Animations
- https://emilkowal.ski/ui/great-animations
- ease-out by default; UI animations under ~300 ms; never animate keyboard-initiated actions; only `transform`/`opacity`; when the main thread is busy use CSS/WAAPI not rAF-driven JS; pair opacity with height for enter/exit; reduced motion → swap bounce for a 0.2 s fade.
- Apply: quiz/lesson transitions = WAAPI/CSS ease-out 180–260 ms; springs only for "physical" moments (tile snap, drag).

### 1.3 Josh Comeau — spring physics and sound
- https://joshwcomeau.com/animation/a-friendly-introduction-to-spring-physics/ , https://joshwcomeau.com/react/announcing-use-sound-react-hook/
- Springs carry velocity so they are interruptible by nature. Spring when something is *placed/released*; eased duration when *revealed*. Sounds accentuate the user's own action, never fire on their own.

### 1.4 Family wallet — Family Values
- https://benji.org/family-values , clips: https://60fps.design/apps/family
- **Dynamic tray system**: one action per tray, each successive tray a different height so you *see* progress; **text morphing** ("Continue" → "Confirm"); **persistent components** travel between screens; entered amount animates into the confirmation; delight reserved for infrequent moments.
- Apply: quiz feedback as a bottom tray that grows on each step; the service icon from the question travels into the explanation; "Check" morphs into "Continue".

### 1.5 Linear — perceived speed
- https://performance.dev/how-is-linear-so-fast-a-technical-breakdown
- Local-first state, optimistic mutation, zero spinners, themed shell painted before JS, durations 0.1–0.25 s, enter instant / exit ~0.15 s, popovers scale out of their trigger.

### 1.6 Juice it or lose it (Jonasson & Purho)
- https://www.youtube.com/watch?v=Fy0aCDmgnxg , summary https://rpgplayground.com/research-making-a-juicy-game/
- Every input produces several simultaneous small responses. For adults: keep the principle at ~20 % amplitude: 1–2 px squash, 60 ms, no screen shake.

### 1.7 Apple Fitness rings
- A ring is *binary* (closed or not); that pull is stronger than a number. Apply: per-domain mastery rings via SVG `stroke-dashoffset`; closing one = a single bright sweep + one soft tone.

### 1.8 Monument Valley — calm feedback
- GDC "Designing Monument Valley: Less" https://www.gdcvault.com/play/1021380/Designing-Monument-Valley-Less
- Musical tones mark valid steps; "the puzzle sings when it is right"; no textual prompts. Apply: correct drop plays a pentatonic note and the slot brightens — no "Correct!" banner.

### 1.9 Confetti alternatives
- Fire once per real milestone; alternatives = number counting up, a checkmark drawing itself, a card settling into place, one line of copy naming the accomplishment. If particles: canvas-confetti 1.9.4, recoloured to 2 brand tones, low gravity, 40 particles, certification-level milestones only.

### 1.10 Odometers / number rolls
- **@kitlangton/rolling-number 0.4.1** https://cdn.jsdelivr.net/npm/@kitlangton/rolling-number/+esm — interruptible digit rolls, spring sampled into CSS `linear()` so no JS loop runs during playback, reduced-motion aware. Premium pick for XP/score counters. HubSpot Odometer is the old fallback. NumberFlow is React-only.

### 1.11 Haptics on the web
- Android: `navigator.vibrate(8)` on correct, `[10,30,10]` on wrong — dependency-free. iOS Safari needs the hidden `<input type="checkbox" switch>` trick (17.4+), reportedly patched later; test on device. Library: https://github.com/lochie/web-haptics.

### 1.12 UI sound guidelines
- Material "Applying sound to UI": frequent sounds simple and understated; vary pitch ±3 % to avoid fatigue; default muted with a visible toggle; unlock AudioContext on first tap.

---

## 2. Smooth-on-mobile motion tech (status Oct 2026)

| Tech | Status | Notes |
|---|---|---|
| **Web Animations API** | 97 % global, Baseline | Compositor-driven for transform/opacity; `finished`, `commitStyles()`, `playbackRate`. Default engine. |
| **CSS scroll-driven animations** | Chrome 115+, Safari 26+, Firefox 159+, ~88 % global; Interop 2026 | Zero-JS, off-main-thread. Wrap in `@supports (animation-timeline: scroll())`. |
| **View Transitions (same-document)** | Chrome 111+, Safari 18+, Firefox 144+ (Baseline) | `document.startViewTransition()`; `view-transition-name: match-element` (Chrome 137, FF 144, Safari 18.4). Use for map ⇄ lesson morphs. |
| **View Transitions (cross-document)** | Chrome 126+, Safari 18.2+, Firefox in progress | Only matters with multiple HTML pages. |
| **Motion 14.6** | `https://cdn.jsdelivr.net/npm/motion@14.6.0/+esm`, mini build ~3 KB | `animate`, `spring`, `stagger`, `scroll`, `inView`. Pin the version. |
| **anime.js 4.5** | `https://cdn.jsdelivr.net/npm/animejs@4.5.0/+esm`, 24.5 KB modular | Timeline + `createSpring()` + **Draggable with snap/flick and spring release**. Pick Motion or anime, not both. |
| **GSAP 3.15** | 100 % free incl. ex-Club plugins; ~70 KB core | Heaviest; Flip superseded by View Transitions. Only for MorphSVG/DrawSVG. |
| **Lenis** | — | **Do not use on mobile** — fights native momentum scroll. |

Performance rules (https://web.dev/articles/animations-guide):
- Only `transform` and `opacity` (plus `clip-path`/`filter` sparingly).
- `will-change` only right before animating; remove after.
- Blur/backdrop-filter is the budget killer on mid-range Android; one small element max, never over scrolling content.
- DOM collapses at ~20–30 moving nodes on mobile; ≤ 12 animated DOM/SVG nodes per screen; hundreds of particles → one 2D canvas (DPR capped at 2). SVG for tap targets layered *over* canvas for bulk drawing (Red Blob pattern).
- Three.js not justified; fake isometric with CSS/SVG.

---

## 3. Progression / mastery systems for adults

| System | What it does | Verdict |
|---|---|---|
| **Khan Academy mastery levels** | Familiar → Proficient → Mastered (prove it again later in a *mixed-skill* challenge); levels can **drop**; "N skills to finish this unit" instead of a course %. | Mature. The mixed-skill gate is exactly how SAA-C03 works. |
| **Duolingo path (2022)** | One linear path, interleaved concepts, built-in practice nodes. Streaks + freezes = guilt. | Path fine; mascot/guilt layer childish. Steal interleaving + review nodes, drop the owl. |
| **Brilliant** | Guided paths with checkpoints; illustration style borderline schoolish. | Keep illustrations technical, not cartoon. |
| **Exercism concept tree** | Prerequisite DAG; show the *frontier* (what's unlocked now), never the full graph. | Mature. |
| **Oh My Git!** | Commands become **cards** in your hand as you learn them. | Maps 1:1 to "service cards you own". |
| **Obsidian graph view** | Global graph is decoration; the *local graph* (depth 1–2 around current node) is useful. Lib: force-graph (canvas, MIT). | Use local graph as a sidebar. |
| **Cloud-as-a-city** | VPC = district, subnets = streets, IGW = city gate, SG = door guard, NAT = concierge. | Mature as an **isometric blueprint**, childish as a cartoon town. Gives a progression surface: your district fills in as you learn. |

Streaks without guilt: track "weeks with ≥ 3 sessions"; never show a broken streak in red; auto-grace of 1 day; only notifications the user scheduled.

---

## 4. Infographic-style learning layouts

1. **Visual rhythm** (Wait But Why): a visual every ~120–180 words on a phone; single-line paragraphs as beats; bold numbered lead-ins.
2. **Colour-coded vocabulary** (Red Blob Games): the same colour for a concept in diagram, text and code; inline legend glyphs inside sentences; negative space instead of borders; saturated colour only for emphasis; "islands of interactivity" so the page also works static.
3. **Prose that drives the picture** (Ciechanowski): clickable words in the paragraph set the diagram to a state; a slider for the one variable that matters. Highest-leverage trick: **inline scrubbable terms** — tap "3 AZs" and the diagram redistributes.
4. **One idea, one number** (Information is Beautiful, Visual Capitalist): big title, one dominant visual, one key stat, source footer; subdued palette so colour carries meaning.
5. **ByteByteGo style**: 1 px outlined boxes, 4–6 colours, numbered arrows ①②③ animated sequentially with `stroke-dashoffset` and stagger.
6. **Lesson card skeleton**: eyebrow (domain, mono) → one-line claim in display size → diagram → 2–3 "because" bullets with colour chips → one "exam trap" tinted panel → one-question check. `clamp()` type, 1.5 line-height, ≤ 65 ch.
7. **Reveal mechanics**: `animation-timeline: view()` with `animation-range: entry 0% cover 30%` — zero JS, degrades to "just visible".

---

## 5. Isometric / SimCity-style technical visualization

- **Isoflow** (MIT, React) + `@isoflow/isopacks` — the only ready-made isometric AWS icon set found (AWS icons remain Amazon's property). FossFLOW = offline PWA on it; use as a *design tool* to draw diagrams, not as runtime.
- **danieljoos/isometric-cloud-icons** — CC0 but only 9 SVGs; style reference.
- **Cloudcraft's grammar** reads mature: 2:1 diamond grid, tinted VPC "plates", services as low blocks, thin orthogonal connectors.
- Browser techniques: CSS Grid + `skew(30°)`; `rotateX(60deg) rotateZ(-45deg)` on `preserve-3d`; or **pure 2D SVG iso projection** `x' = (x − y)·cos30°, y' = (x + y)·sin30° − z` — cheapest on Android, each service one `<g>`. IsoCity (plain JS) for tile hit-testing.
- No official AWS isometric set exists. Plan: draw ~40 services as own isometric blocks with the flat AWS glyph on the top face.

---

## (a) Recommended motion stack — build-free, vanilla, mobile

Tier 0 (no library): CSS transitions on transform/opacity; WAAPI `el.animate()`; CSS scroll-driven animations under `@supports`; same-document View Transitions; `navigator.vibrate()`.
Tier 1 (one pinned ESM import): Motion 14.6.0 (`/+esm`, or `/mini/+esm` ~3 KB) **or** anime.js 4.5.0 if drag-snap-flick is needed.
Tier 2 (lazy, per screen): rolling-number for counters; force-graph for the local knowledge graph; canvas-confetti only for certification milestones; 2–3 tiny audio clips via Web Audio, muted by default.
Skip: GSAP, Lenis, Popmotion, Three.js.
Guardrails: ≤ 12 animated DOM nodes per screen; one canvas for hundreds; `will-change` applied just-in-time; no `backdrop-filter` over scrolling content; test on the real Android with Chrome's FPS meter.

## (b) Eight signature interactions (game-for-adults)

1. **Snap-to-board**: finishing a lesson slides its service block onto your isometric architecture board, landing with a spring (stiffness ~300, damping ~24), one 8 ms vibration, one pentatonic note. Unlearned services sit as grey wireframes, so the board *is* the progress bar.
2. **Scrubbable sentences**: key numbers/nouns in the explanation are tappable chips that re-render the inline diagram live.
3. **Rings that close**: 6 exam-domain mastery rings; a ring closes only at "Mastered" (proved again in a mixed review); closing = one 600 ms sweep + two-tap haptic. Rings thin if reviews are skipped — honest, not punitive.
4. **Growing tray quiz**: question → answer → explanation → next, each tray taller than the last. Correct = accent blink then tray grows; wrong = 4 px shake + red hairline + immediate "exam trap" panel. "Check" morphs into "Continue".
5. **Request-flow replay**: every diagram has ▶ that animates numbered arrows with stagger, plus a scrubber to drag through the flow.
6. **Architect mode (drag-and-snap)**: drag service blocks onto the iso grid; right slot = block sinks in and the connector draws; wrong = floats back with a damped spring. The diagram is the grade.
7. **Service cards you own**: each learned service becomes a flip card in a deck; swipe-sort "know / shaky" with velocity-preserving fling.
8. **Local constellation**: depth-2 graph around the current service; mastered nodes filled, others hollow; tapping view-transitions into that lesson.

Quiet systems that make it premium rather than gamified: no spinners (local-first), instant navigation, no mascot, no daily-streak guilt, rolling counters instead of popping badges, sound off by default and musical when on, every celebration scaled to rarity.
