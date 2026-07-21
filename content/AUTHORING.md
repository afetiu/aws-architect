# Content authoring spec

Every module is one JS file in `content/modules/` that calls `window.COURSE.register({...})`.
Every practice exam is one JS file in `content/exams/` that calls `window.COURSE.registerExam({...})`.
Files are loaded as plain `<script>` tags — no modules, no build step.

## Module schema

```js
window.COURSE.register({
  id: "s3",                 // stable slug, matches filename topic
  order: 6,                 // number from the filename prefix
  track: "saa",             // "saa" or "sap"
  title: "S3 Deep Dive",
  description: "1-3 sentence HTML string shown on the module page.",
  examWeight: "Short note on where this shows up on the exam(s).",
  lessons: [
    { id: "slug", title: "Lesson title", html: LESSON_HTML_STRING },
    // 5–8 lessons per module
  ],
  quiz: [
    {
      q: "Plain-text question (no HTML).",
      options: ["A", "B", "C", "D"],       // 4-6 options, plain text
      answer: [2],                          // array of correct option indices
      multi: false,                         // true => "select N" question, answer has 2+ indices
      explanation: "HTML string. Explain why the right answer is right AND why each tempting wrong answer is wrong."
    },
    // 12–15 questions per module
  ],
  flashcards: [
    { front: "Plain-text prompt", back: "HTML answer, concise" },
    // 15–25 cards per module
  ],
  lab: {   // or null for modules where a lab makes no sense
    title: "Lab: build X",
    html: LAB_HTML_STRING
  }
});
```

## Exam schema

```js
window.COURSE.registerExam({
  id: "saa-1",
  track: "saa",             // or "sap"
  title: "SAA-C03 Practice Exam 1",
  timeMinutes: 130,          // 130 for SAA, 180 for SAP
  questions: [
    {
      q: "Scenario-style plain-text question.",
      options: [...], answer: [...], multi: false,
      domain: "Design Secure Architectures",   // official exam domain name
      explanation: "HTML, thorough."
    }
  ]
});
```

## HTML string rules (CRITICAL — the app breaks otherwise)

- Lesson/lab/explanation HTML lives in JS **template literals** (backtick strings).
- **NEVER use the backtick character or `${` inside any template literal.** For inline
  code use `<code>...</code>`; for blocks use `<pre><code>...</code></pre>`.
- Inside `<pre>`/`<code>`, HTML-escape `<` as `&lt;` and `>` as `&gt;` (shell redirects, JSON, YAML examples).
- `q`, `options`, and flashcard `front` are PLAIN TEXT (they get HTML-escaped by the app).
- Allowed lesson tags: `h2 h3 h4 p ul ol li strong em code pre table thead tbody tr th td a`.
- Callout divs (use them often — they carry the senior-level voice):
  - `<div class="callout exam">…</div>` — how the exam tests this, trap patterns, keyword→answer mappings.
  - `<div class="callout deep">…</div>` — internals: how it actually works under the hood.
  - `<div class="callout war">…</div>` — production gotchas / real-world failure modes.
  - `<div class="callout limits">…</div>` — quotas, hard limits, and numbers worth memorizing.

## Voice and depth

Audience: a senior engineer with 10 years of experience. Therefore:

- **No cloud-101 filler.** Never explain what a server, VM, or API is. Assume fluency in
  Linux, networking (TCP/IP, DNS, TLS, BGP basics), distributed systems, and databases.
- Lead with the **mental model**, then mechanics, then trade-offs, then exam relevance.
- Compare against what a senior engineer already knows ("an NLB is roughly an L4
  pass-through like LVS/IPVS; an ALB terminates and re-originates like nginx/envoy").
- Always cover: failure modes, consistency semantics, scaling knobs, hard limits,
  pricing model shape (what dimension you pay on), and when NOT to use the service.
- Tables for service comparisons. Concrete numbers (limits, SLAs, latencies) where stable.
- Quiz questions must be **scenario-based** in the style of the real exam, with plausible
  distractors — not trivia. Explanations must dissect every option.
- Each lesson: roughly 700–1400 words of substance. No padding.

## Labs

- Assume a real AWS account, admin access, AWS CLI v2 configured, and comfort with a terminal.
- Prefer CLI over console clicks; show console path only when it teaches something.
- Structure: Goal → Architecture (1 short paragraph) → Steps (numbered, with commands in
  pre/code blocks) → Verify → **Teardown** (complete, ordered, so nothing keeps billing).
- Stay in free tier / pennies where possible; call out anything that costs real money.

## Validation

Run `node tools/validate.js` from the repo root. It loads every content file and checks
the schema. Your file must pass with zero errors.
