# Learning layer spec (`content/learn/*.js`)

The lesson HTML in `content/modules/` is the deep reference. The **learning layer** sits
on top of it and is what makes the course easy to learn, especially on a phone. For
every lesson it provides a plain-English summary, an analogy, the one exam line to
remember, key terms, and a two-question self-check. For every module it adds a
"big picture" intro and a one-screen cheat sheet.

One file per module: `content/learn/NN-<module-id>.js` (same NN as the module file).

```js
window.COURSE.registerLearn({
  moduleId: "s3",                 // must match the module's id
  bigPicture: "HTML, 2-4 short sentences. What this module is about, in plain words, and why it matters for the exam and the job.",
  cheatsheet: [                   // 10-20 rows: "if the scenario says X, the answer is Y"
    { k: "Plain text: the clue / requirement", v: "HTML: the answer + 3-8 words of why" }
  ],
  lessons: {
    "storage-classes": {          // key = lesson id from the module file; cover EVERY lesson
      minutes: 7,                 // honest reading time of the full lesson HTML (≈ words / 200)
      tldr: [                     // 3-5 bullets, HTML allowed (strong, em, code). Each ≤ 25 words.
        "..."
      ],
      analogy: "HTML, 1-3 sentences. One everyday comparison that makes the core idea click.",
      examTip: "HTML, 1-2 sentences. The single thing the exam tests here: keyword → answer, or the classic trap.",
      terms: [                    // 3-6 terms introduced in the lesson
        { t: "Plain text term", d: "Plain-English definition, one line, ≤ 20 words (HTML allowed)" }
      ],
      check: [                    // exactly 2 quick recall questions about THIS lesson
        {
          q: "Plain text question, short (≤ 30 words). Scenario-flavoured is good.",
          options: ["plain", "plain", "plain"],   // 3 or 4 options, plain text, short
          answer: 1,                                // single correct index
          why: "HTML, 1-2 sentences: why it's right and why the tempting wrong one is wrong."
        }
      ]
    }
  }
});
```

## Voice — this is the important part

The deep lessons were written for a senior engineer. The learning layer is written for
**someone learning this for the first time on their phone on a bus**:

- Short sentences. Everyday words. Define jargon the first time or avoid it.
- Lead with *what it is* and *why you'd care*, then the rule to remember.
- Numbers only when they're exam-relevant and worth memorising (e.g. "SQS visibility timeout max 12 h").
- Analogies must be concrete and correct — never an analogy that teaches a wrong intuition.
- `check` questions test understanding of the lesson, not trivia; distractors must be plausible.
- No emoji. No "In this lesson we will…". No filler.

## Accuracy

Everything must be correct as of 2026 (SAA-C03 / SAP-C02 exam era). If you find a factual
error or something outdated in the module's lesson HTML while reading it, fix it in the
module file with a minimal edit and mention it in your report.

## HTML rules

Same as `AUTHORING.md`: strings in plain quotes or template literals, **never** a backtick
or `${` inside a template literal, escape `<` `>` inside code. `q`, `options`, `k`, `t` are
plain text. Validate with `node tools/validate.js`.
