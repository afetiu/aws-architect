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

- **Interactive diagrams** — clickable architecture diagrams with step-through
  animated flows (VPC packet paths, Aurora quorum writes, DR failover, envelope
  encryption, RAG pipelines, cross-account CI/CD, …)
- **Simulators** — a Playground of hands-on calculators and simulators: VPC
  packet-flow tracer, IAM policy evaluator, DynamoDB capacity math, S3 storage-class
  cost race, ASG scaling simulator, availability math builder, DR strategy explorer,
  Lambda cost crossover, data-transfer cost traps, Kinesis shard sizing, EBS tuning
- **26 modules** — 21 Associate (including AI/ML on AWS: Bedrock, RAG patterns,
  SageMaker, and the exam's service-picker ML services) + 5 Professional — each with:
  - an **intuition builder**: a 4-level explainer from everyday analogy to sharp edges
  - deep lessons in collapsible sections (with "Exam lens", "Under the hood",
    "Production gotcha", and "Limits that matter" callouts)
  - a 12–15 question scenario-based quiz with full answer dissections
  - flashcards on a Leitner spaced-repetition schedule (1/3/7/14 days)
  - a hands-on lab for a real AWS account (CLI-first, with full teardown)
- **22 interactive diagrams** — clickable components + step-through animated flows
- **16 simulators** and a **Speed Drill** arcade mode (130 keyword→service items)
- **Timed practice exams** for both certs with per-domain score breakdowns
- **My notes** — a capture net for anything you spot and need to come back to:
  select text anywhere in the course and hit **Save note** (or save from the Ask AI
  popup, or jot one down on the Notes page), then mark each note **learned** once
  it has actually stuck. Notes link back to the page they came from.
- **Dashboard** — progress, streaks, and a readiness estimate per cert

## Progress & data

Progress (lessons, quiz bests, exam attempts, flashcard scheduling, notes) is stored in your
browser's `localStorage`, with three sync options in **Settings & data**:

1. **Google sign-in (Firebase)** — one click per device. Requires a one-time Firebase
   project setup: create a project at console.firebase.google.com, enable
   **Authentication → Google**, create a **Firestore** database, add your Pages domain
   under Auth → Authorized domains, paste the web-app config into
   [`firebase-config.js`](firebase-config.js), and set Firestore rules to:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /progress/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

2. **GitHub Gist** — paste a personal-access token (gist scope only) once per device;
   progress auto-syncs to a private gist a few seconds after every change.
3. **Manual export/import** — JSON via the Settings page.

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
