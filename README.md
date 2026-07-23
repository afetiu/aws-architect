# Futureproof — Interactive Course Hub

A hub of free, self-contained interactive courses written for **senior engineers** —
mental models, internals, trade-offs, limits, and failure modes instead of intro fluff.

**Live courses:**

| Course | Path | What's inside |
|---|---|---|
| AWS Solutions Architect | [`/aws/`](aws/) | SAA-C03 → SAP-C02: 26 modules, 22 interactive diagrams, 16 simulators, timed practice exams, 10 real-AWS missions |
| AI Engineer | [`/ai/`](ai/) | LLM internals, tokens & sampling, prompting, model APIs & tool calling, embeddings, RAG, context engineering, agents, MCP & agent security, evals & observability |

The landing page (`index.html`) is the public front door; each course lives under its
own path and shares one engine.

## Run it

No build step, no dependencies:

```bash
# either just open index.html in a browser, or:
python3 -m http.server 8080
# → http://localhost:8080          (landing)
# → http://localhost:8080/aws/     (AWS course)
# → http://localhost:8080/ai/      (AI course)
```

## Architecture

- `index.html` + `landing.css` — the landing page
- `app.js` + `styles.css` — the shared course engine (vanilla JS, hash router,
  localStorage store). Each course page defines `window.COURSE_META` (id, title,
  tracks, store key…) before loading the engine.
- `aws/index.html`, `ai/index.html` — course pages; each loads only its own content
- `content/` — AWS course content · `content-ai/` — AI Engineer course content
- `firebase-config.js` — shared Firebase project config

Every course gives you: deep lessons in collapsible sections (with "Under the hood",
"Production gotcha", "Limits that matter" callouts), intuition builders, scenario
quizzes, Leitner spaced-repetition flashcards, notes with select-to-capture, a
"pick up where you left off" resume card, and (per course) simulators, clickable
diagrams, speed drills, missions, and timed practice exams.

## Progress & sync

Progress is stored per course in the browser's `localStorage` and syncs **live**
across devices via Google sign-in (Firebase): every change pushes to Firestore
automatically, and a real-time listener adopts changes from other devices as they
happen. All courses share one Firestore doc per user (`progress/{uid}`, one field
per course), so the original security rules work unchanged:

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

## Adding a course

1. Create `content-<x>/modules/*.js` following [`content/AUTHORING.md`](content/AUTHORING.md)
   (register into `window.COURSE`).
2. Add the content root and its track vocabulary to `COURSE_ROOTS` in
   [`tools/validate.js`](tools/validate.js).
3. Copy a course page (`ai/index.html`), adjust `COURSE_META` and the script list.
4. Add a course card to the landing page.
5. Validate: `node tools/validate.js`

## Deployment

Pushes to the working branch run content validation and publish to GitHub Pages
(`gh-pages` branch) automatically via `.github/workflows/deploy-pages.yml`.
To attach a custom domain later: add a `CNAME` file at the repo root and configure
the domain in the repo's Pages settings — one domain covers the landing page and
every course path.
