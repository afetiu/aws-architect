# The Living Cloud — rethinking the AWS Solutions Architect course

Status: concept + six working prototypes (`/lab/`), 2026-10-25. Nothing in the live course is changed yet.

## 1. The problem with the current course

The course today is honest and dense, but it is a *reading* app: cards of text, collapsible sections, slider simulators that output numbers, diagrams that highlight on click. It explains AWS; it does not let you feel it. On a phone this reads as a well-made document, not an experience you want to come back to.

What the owner asked for: game-like but not childish, fluid and super smooth, highly interactive, infographic-style explanation, and simulations of the services so you immediately get what a thing *is*.

## 2. The idea in one sentence

**Turn the course into a living cloud you can touch: every concept is first a simulation you play with, then a short infographic story, then a puzzle you solve on the architecture itself. Progress is a map that lights up.**

## 3. Design principles (the house rules)

1. **Touch before text.** Every module opens on something running. The explanation comes second and is short.
2. **One idea per screen.** A beat, a figure, a number. No walls of collapsibles.
3. **Numbers you can drag.** Any number in a sentence that matters is a chip you can scrub; the picture follows (Ciechanowski / Red Blob pattern).
4. **The picture is the grade.** Wrong choices show their consequence (cost, latency, a dropped request), not a red "incorrect".
5. **Calm juice.** Springs, glow, odometers, haptics and optional pentatonic sound. No confetti, no mascots, no streak guilt. Delight scales with rarity (Rauno Freiberg / Family rules).
6. **60 fps on a mid-range Android.** DOM animates only transform/opacity; anything with more than ~30 moving parts lives on one canvas; scroll is native.
7. **Real AWS truth.** Every simulated behaviour is a real property of the service with a one-line "why" and an exam tip.

## 4. The six directions (all prototyped in `/lab/`)

| # | Direction | What it replaces | Core pattern | Prototype |
|---|---|---|---|---|
| 01 | **Living Board** — an isometric architecture with live traffic; tap blocks, scrub a request through its path, flip toggles that reroute traffic and move the bill | click-to-highlight diagrams | packets on paths, scrub-as-explanation, consequence as motion | `lab/board/` |
| 02 | **Service Sandbox** — a mini console that is a tiny state machine (S3 first): upload, delete, BPA, versioning, lifecycle over time, presigned URLs, with an "under the hood" API trace | slider simulators | fake-AWS state machine, break it on purpose | `lab/sandbox-s3/` |
| 03 | **Living Sim** — Sam Rose-style escalating simulation (SQS → Lambda): spam the button, add the queue, scale consumers, visibility timeout, DLQ, FIFO | the lesson text for a topic | one problem → one fix chapters, draining-ring timers, you are the client | `lab/queue/` |
| 04 | **Constellation** — the 26 modules as a pannable star chart; mastery lights nodes, lines draw to neighbours, the frontier breathes; six domain rings | module list + "lessons done" counters | Khan mastery levels, Exercism frontier, rings that close | `lab/constellation/` |
| 05 | **Story** — a lesson as a pinned figure that changes as you scroll, with scrubbable terms in the sentences | collapsible text sections | scroll is the scrubber, infographic beats, chips in prose | `lab/story/` |
| 06 | **Architect mode** — scenario + diagram with one glowing gap + four service cards; drag the right one in and traffic flows while a consequence meter moves | multiple-choice scenario quizzes | AWS Card Clash loop, consequence meters, "why not" lines | `lab/architect/` |

Directions considered and parked: a cobe/globe view of Regions, AZs and edge locations (good for one module, not a core pattern); a Route 53 "life of a query" swipe-comic (nice, but the Story pattern covers it); Three.js anything (GPU heat and bundle size on phones for no learning gain).

## 5. How they combine into one app

```
Home ─────────── Constellation (progress map, "Next for you" node)
   │
Module ────────── Living Board of that module's architecture (traffic running)
   │                 ├─ Story beats (plain-English layer → beats with chips)
   │                 ├─ Sandbox / Living Sim for the service
   │                 └─ Architect mode scenarios (replaces the quiz)
   │
Review ────────── Service cards you own (Leitner stays) + mastery that must be proven again
Exams ─────────── unchanged (timed, scaled 720/1000), but each missed question links to its Board/Story
```

- The **engine stays**: hash router, localStorage store, Firebase sync, content registries. New view types are added (`registerBoard`, `registerStory`, `registerSandbox`, `registerScenario`) beside the existing ones; old content keeps working while modules migrate one by one.
- The **learning layer already written** (`content/learn/*.js`: TL;DR, analogy, exam tip, terms, quick check, cheat sheet) maps directly onto Story beats, so migration is mostly re-presentation, not re-writing.
- The **16 widgets** become Sandboxes or Living Sims over time; the Sam Rose engine (requests as shapes, slots, servers, timers) is built once and reused for SQS, ALB, Lambda concurrency, API Gateway throttling, Kinesis shards.
- The **22 diagrams** become Boards: same node/edge/flow data, rendered on the isometric canvas with packets, plus one or two toggles each that change the routing or the bill.

## 6. Visual language

- Dark-first "ops room": deep navy, fine dot grid, glass panels. Light theme later; the simulations read best on dark.
- Type: Sora (display), Inter (body), JetBrains Mono (numbers, keys, API trace). Orange stays the brand anchor; cyan = data in motion; green = reply/healthy; yellow = billed; red = failure.
- Blocks, not icons: services are isometric blocks with the name on the top face. Recognisable, licence-clean, consistent. AWS's flat glyphs can be printed on top faces later if wanted.
- Motion stack (build-free): CSS transitions + `linear()` springs, WAAPI, one canvas per simulation, View Transitions for tile → lesson morphs, `animation-timeline: view()` under `@supports` for scroll reveals. No GSAP, no Lenis, no Three.js. Kit in `lab/kit.js` (springs, tween, count, haptic, sound, sheet, canvas, path sampler).

## 7. Game layer for adults

- **Mastery, not XP.** Familiar → Proficient → Mastered per module; Mastered only after a later mixed review; rings can thin.
- **The map is the progress bar.** Nodes light, lines draw, rings close. No "0/193 lessons done".
- **Weekly rhythm, not daily streak.** "Weeks with ≥ 3 sessions"; grace built in; never a red broken streak.
- **Cards you own.** Each learned service becomes a flip card in the review deck.
- **Signature moments** (rare, so they stay special): a block snapping onto the board after a module, a ring closing, a constellation line drawing itself.

## 8. Phasing (proposal)

1. **Phase A — Engine + two modules (2–3 weeks of focused work).** Port the lab kit into `app.js`; Constellation as the new home; VPC module on a Living Board with Story beats and three Architect scenarios; S3 module with the Sandbox. Old views remain for everything else.
2. **Phase B — Simulation engine.** The reusable request/queue/server sim; migrate SQS, ELB, Lambda, DynamoDB capacity, ASG widgets.
3. **Phase C — Everything else.** Diagrams → Boards, lessons → Stories, quizzes → Architect mode, module by module, SAA track first.
4. **Phase D — Android app** picks the new UI up for free (same code), plus haptics tuned on the real device.

## 9. Open decisions for Agon

- Dark-only for v1, or keep light as a first-class theme from day one?
- Sound: ship it (off by default) or leave it out entirely?
- Should the Constellation replace the Home tab, or sit beside a slimmer dashboard?
- Which module to migrate first for the "wow": VPC (Board) or S3 (Sandbox + Story)?

## 10. Research behind this

- `docs/research/2026-10-25-interactive-visualization-references.md` — explorable explanations, packet-flow and isometric tooling, game-like technical learning UIs, scrollytelling, in-browser AWS simulation options, icon licensing.
- `docs/research/2026-10-25-game-feel-and-motion-craft.md` — game feel for non-game UIs, the mobile motion stack as of Oct 2026, mastery systems that work for adults, infographic layout rules, isometric techniques, eight signature interactions.
