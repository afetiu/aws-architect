# Futureproof LAB — prototype brief (shared by every prototype)

The AWS Solutions Architect course (`/aws/`) today is a clean but static card-and-text
app. The lab explores a new direction: **a living cloud you can touch** — game-like
fluidity for adults, infographic-style explanation, and live simulations of what AWS
services *are*, so the learner feels the service before reading about it.

## Non-negotiables
- **Vanilla JS, no build step, no npm.** One `index.html` per prototype under `lab/<name>/`,
  loading `../kit.css` and `../kit.js` (global `LAB`). Inline `<style>`/`<script>` is fine.
- **Phone-first.** Design at 390×844, must also look right at 1280 wide. Big touch
  targets (≥ 44px), bottom sheets instead of hover tooltips, no horizontal page scroll.
- **Smooth on a mid-range Android.** Animate only `transform`/`opacity` in the DOM; use
  one `<canvas>` (via `LAB.canvas`) for anything with more than ~30 moving things;
  `requestAnimationFrame` through `LAB.loop` (pauses when the tab is hidden). Never
  animate layout properties. 60 fps or it is wrong.
- **Not childish.** No confetti, no cartoon mascots, no emoji as UI. Calm dark palette
  from `kit.css`, Sora display + Inter body + JetBrains Mono numbers. "Juice" comes
  from springs (`LAB.spring`, `var(--spring)`), odometers (`LAB.count`), glow, haptics
  (`LAB.haptic`) and *optional* subtle sound (`LAB.sound.play`, off by default; the
  toggle lives in `LAB.topbar`).
- **Real AWS truth.** Every number and behaviour must be correct (us-east-1 approx
  pricing is fine, label it "≈"). The point is to teach: every interaction must reveal
  a real property of the service, with a one-line "why" the learner can read.
- **Infographic voice.** Short labels, direct annotation on the picture, numbers set in
  mono, one idea per screen. Explanations go in `LAB.sheet(html)` bottom sheets:
  `<div class="eyebrow">…</div><h3>…</h3><p>…</p><div class="fact"><b>Exam tip</b>…</div>`.
- Start every page with `LAB.topbar("Title", "subtitle")`.
- Respect `prefers-reduced-motion` (the kit already shortens CSS animation; keep canvas
  motion minimal when `LAB.reducedMotion` is true).
- Self-contained: no network calls besides Google Fonts from the kit.

## Kit API (lab/kit.js)
- `LAB.loop(fn(dt, t))` → `{stop}`
- `LAB.tween(ms, fn(t01), ease?, done?)`, `LAB.ease.{outExpo,outCubic,inOutCubic,outBack,linear}`
- `LAB.spring(value, {stiffness, damping})` → `.set(target)`, `.step(dt)`, `.value`, `.snap(v)`
- `LAB.count(el, number, {fmt, ms})` animated number · `LAB.money(n)`
- `LAB.haptic("tap"|"tick"|"ok"|"bad"|"pop")`, `LAB.sound.play("tick"|"tap"|"ok"|"bad"|"whoosh"|"pop")`
- `LAB.topbar(title, sub)`, `LAB.sheet(html)`, `LAB.closeSheet()`
- `LAB.canvas(canvasEl)` → `{g, size()}` HiDPI-ready 2D context · `LAB.pathSampler(svgPath)` → `.at(t)`
- `LAB.h(html)` element from string · `LAB.esc(s)`
- CSS: `.panel.pad`, `.btn[.primary|.ghost|.sm]`, `.chip[.on]`, `.toggle[aria-checked]`,
  `.row > label + input[type=range] + .val`, `.stat > .k + .v[.ok|.bad|.warn|.flow]`,
  `.rise[.d1-.d4]`, `.popin`, `.shake`, `.pulse`, `.glow-accent`, `.glow-flow`, `.k`, `.mono`, `.dim`

## Done means
- Loads with zero console errors from `file://` and from a static server.
- Looks finished at 390×844: nothing clipped, nothing overlapping, nothing default-styled.
- Every control changes something visible within 100 ms.
- A learner who knows nothing about the service can say in one sentence what it does
  after 60 seconds of playing.
