# Journey scenes — brief for scene builders

The AWS course at `/aws/` is now **one continuous journey** (no tabs, no menus, no lab page).
Read `journey/journey.js` top comment + its core scenes before writing anything — your scene
must feel like it belongs to the same film.

## How the journey works
- `#world` canvas = the route of stations (one per module). `#reel` = the current chapter as a
  sequence of scenes shown one at a time. The learner moves only with the Back / Continue buttons (or arrow keys), never by scrolling; a scene taller than the screen scrolls its own content (`<section class="scene">` > `<div class="sc">`).
- Chapter = `opener → per lesson (idea → analogy → check) with interactive scenes woven in → decisions → closer`.
- Between chapters the camera flies and a title card plays. The orb (top-left) opens the atlas
  (the whole route); from there the learner flies back to any lesson.
- Progress store: `JSTORE` (journey/store.js) — same shape as the old engine (`S.lessons`, `S.quizBest`,
  `S.quizAttempts`, `S.examAttempts`, `S.flash`, `S.checks`), plus `S.journey`. Always `JSTORE.save()` after writes.

## Scene API
```js
JOURNEY.registerScene("my-type", {
  wide: false,                 // true → .sc max-width 980px instead of 680px
  label: function (sc) { return "HUD subtitle"; },
  render: function (el, sc, ctx) {
    // el = the .sc container (centered column). Build DOM here.
    // sc = { type, key, m (module), ci, data, l?, li?, x? }
    // ctx = { m, data, store, save, markLesson, openReader(title, html, eyebrow), toast(html),
    //         next(), jump(sceneKey), goTo(chapterIndex, sceneKey), colorOf(moduleId),
    //         prose(html) -> styled element, questionBlock(q, onAnswer) }
    return { enter() {}, leave() {}, destroy() {} };   // all optional
  }
});
JOURNEY.cast("moduleId", [{ type: "my-type", after: "lessonId" | "opener" | "end" | "post", data: {...}, id: "unique", replaces: "diagram:<id>" | "widget:<id>", label: "HUD text" }]);
```
- `after` omitted → spread evenly between lessons together with the module's auto diagrams/widgets.
- Diagrams (`COURSE.diagrams`) and widgets (`COURSE.widgets`) are auto-placed as scene types
  `diagram` (sc.data = diagram object) and `widget` (sc.data = widget object).
- Helpers: `JOURNEY.lastOfTrack("saa"|"sap")` → last module of a track.
- Scenes render lazily (when ~1 screen away). **Start rAF loops / canvas sims in `enter()`, stop them in
  `leave()`** — several scenes exist at once and only the live one may animate. Use `LAB.loop` and keep the
  returned handle; stop it in leave.

## Style + feel (non-negotiable)
- Use the kit: `journey/kit.css` tokens/classes + `journey/journey.css` (`.eyebrow`, `h2`, `.lead`, `.tip`,
  `.opt`, `.why`, `.qcount`, `.chips/.chip`, `.btn`, `.panel`, `.stat`, `.rv` reveal-on-live). Kit JS:
  `LAB.spring/tween/count/money/haptic/sound/sheet/canvas/pathSampler/h/esc` (see journey/kit.js).
- Every scene opens with `<div class="eyebrow rv">…</div>` and usually an `<h2 class="rv">`. Children with
  `.rv` fade/slide in when the scene goes live.
- Dark, calm, premium, game-like for adults. No confetti, no emoji, no mascots. Springs, glow, odometers,
  haptics, optional sound (`LAB.sound.play`) — sound is off by default.
- Phone first (390×844) and must look right at 1280×800. Touch targets ≥ 44px.
- **Scroll safety:** a long scene scrolls vertically inside itself. Canvases/SVGs that need drag must set
  `touch-action: pan-y` (horizontal drags) or only capture the pointer after an explicit press on a handle.
  Never block vertical scrolling of the page with a big full-width drag surface.
- No `position: fixed` inside scenes (the reel is the scroll container). Bottom sheets: `LAB.sheet(html)`.
- Performance: animate transform/opacity only; > 30 moving things → one canvas; DPR capped at 2.
- AWS facts must be correct (≈ us-east-1 prices labelled "≈").

## Testing
```
cd /c/Users/Agon-MiniPc/AppData/Local/Temp/awsshots
node jshot.cjs "#/<moduleId>/<sceneKey>" out        # phone; add 'wide' as 3rd arg for 1280
```
Scene keys: `opener`, `l:<lessonId>`, `a:<lessonId>`, `q:<lessonId>`, `explainer`, `decisions`, `closer`,
cast scenes `<type>:<id>` (id = cast `id` or `data.id`). Read the PNGs with the Read tool. Write your own
Playwright scripts next to jshot.cjs for interaction tests (copy its launch code; always pass the
executablePath it uses). Run screenshot scripts one at a time (concurrent runs kill each other —
other builders are working in parallel, so retry if a run dies). Must end with `no errors`.

Only edit your own files under `journey/scenes/`. Do not edit journey.js, journey.css, kit.*, store.js or
aws/index.html — if you need an engine change, describe it in your report instead.
