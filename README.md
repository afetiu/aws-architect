# AWS Solutions Architect — Interactive Course

A self-contained interactive course for the **AWS Certified Solutions Architect** path:
**SAA-C03 (Associate)** first, then **SAP-C02 (Professional)** — written for a senior
engineer, so it skips cloud-101 and goes straight to mental models, internals,
trade-offs, limits, and failure modes.

## Run it

No build step, no dependencies:

```bash
# either just open index.html in a browser, or:
python3 -m http.server 8080
# → http://localhost:8080
```

## What's inside

- **26 modules** — 21 Associate (including AI/ML on AWS: Bedrock, RAG patterns,
  SageMaker, and the exam's service-picker ML services) + 5 Professional — each with:
  - deep lessons (with "Exam lens", "Under the hood", "Production gotcha", and
    "Limits that matter" callouts)
  - a 12–15 question scenario-based quiz with full answer dissections
  - flashcards on a Leitner spaced-repetition schedule (1/3/7/14 days)
  - a hands-on lab for a real AWS account (CLI-first, with full teardown)
- **Timed practice exams** for both certs with per-domain score breakdowns
- **Dashboard** — progress, streaks, and a readiness estimate per cert

## Progress & data

Progress (lessons, quiz bests, exam attempts, flashcard scheduling) is stored in your
browser's `localStorage`. Use **Settings & data** in the app to export/import it as JSON
when switching machines.

## Suggested study loop

1. Work through modules in order; mark lessons complete as you go.
2. Take the module quiz until you clear **80%**.
3. Clear due flashcards **daily** (the sidebar shows the count).
4. Do the labs — reading about VPC routing is not the same as debugging it.
5. When module progress is high, grind timed practice exams until you consistently
   score **72%+**, then book the real thing.

## Content development

Content files live in `content/modules/` and `content/exams/` and follow the schema in
[`content/AUTHORING.md`](content/AUTHORING.md). Validate with:

```bash
node tools/validate.js
```
