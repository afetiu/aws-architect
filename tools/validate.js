#!/usr/bin/env node
/* Validates all content files against the schema in content/AUTHORING.md.
 * Usage: node tools/validate.js [file.js ...]   (no args = validate everything) */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
let errors = 0;
const err = (f, msg) => { errors++; console.error("  ERROR " + path.basename(f) + ": " + msg); };

function listContentFiles() {
  const out = [];
  for (const dir of ["content/modules", "content/exams"]) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).sort()) {
      if (f.endsWith(".js") && !f.startsWith("_")) out.push(path.join(abs, f));
    }
  }
  return out;
}

function loadFile(file) {
  const registered = { modules: [], exams: [] };
  const sandbox = {
    window: {},
    console,
  };
  sandbox.window.COURSE = {
    register: (m) => registered.modules.push(m),
    registerExam: (e) => registered.exams.push(e),
  };
  sandbox.COURSE = sandbox.window.COURSE;
  const src = fs.readFileSync(file, "utf8");
  if (/\$\{/.test(src)) err(file, "contains ${ interpolation — forbidden in content template literals");
  try {
    vm.runInNewContext(src, sandbox, { filename: file, timeout: 5000 });
  } catch (e) {
    err(file, "failed to execute: " + e.message);
    return null;
  }
  return registered;
}

const BANNED_TAGS = /<(script|iframe|img|style|link|form|input|button)\b/i;
function checkHtml(file, label, html) {
  if (typeof html !== "string" || html.trim().length === 0) return err(file, label + ": empty or non-string html");
  if (BANNED_TAGS.test(html)) err(file, label + ": contains banned tag (script/iframe/img/style/link/form/input/button)");
}
function checkQuestion(file, label, q, needDomain) {
  if (typeof q.q !== "string" || q.q.length < 20) err(file, label + ": question text missing/too short");
  if (/[<>]/.test(q.q || "")) err(file, label + ": question text must be plain text (no HTML)");
  if (!Array.isArray(q.options) || q.options.length < 3) err(file, label + ": needs 3+ options");
  else {
    q.options.forEach((o, i) => {
      if (typeof o !== "string" || !o.trim()) err(file, label + " option " + i + ": empty");
      if (/[<>]/.test(o || "")) err(file, label + " option " + i + ": must be plain text");
    });
  }
  if (!Array.isArray(q.answer) || q.answer.length === 0) err(file, label + ": answer must be a non-empty array of indices");
  else {
    q.answer.forEach((a) => {
      if (!Number.isInteger(a) || a < 0 || a >= (q.options || []).length) err(file, label + ": answer index " + a + " out of range");
    });
    if (q.answer.length > 1 && !q.multi) err(file, label + ": multiple answers but multi !== true");
    if (q.multi && q.answer.length < 2) err(file, label + ": multi:true but fewer than 2 answers");
  }
  checkHtml(file, label + " explanation", q.explanation);
  if (needDomain && (typeof q.domain !== "string" || !q.domain.trim())) err(file, label + ": missing exam domain");
}

function checkModule(file, m) {
  const need = ["id", "order", "track", "title", "description", "lessons", "quiz", "flashcards"];
  for (const k of need) if (!(k in m)) err(file, "module missing field: " + k);
  if (m.track !== "saa" && m.track !== "sap") err(file, "track must be 'saa' or 'sap'");
  if (!Array.isArray(m.lessons) || m.lessons.length < 4) err(file, "needs 4+ lessons (has " + (m.lessons || []).length + ")");
  else m.lessons.forEach((l, i) => {
    if (!l.id || !l.title) err(file, "lesson " + i + ": missing id/title");
    checkHtml(file, "lesson '" + (l.id || i) + "'", l.html);
    if ((l.html || "").length < 2500) err(file, "lesson '" + (l.id || i) + "': too thin (" + (l.html || "").length + " chars, want 2500+)");
  });
  const seen = new Set();
  (m.lessons || []).forEach((l) => {
    if (seen.has(l.id)) err(file, "duplicate lesson id: " + l.id);
    seen.add(l.id);
  });
  if (!Array.isArray(m.quiz) || m.quiz.length < 10) err(file, "needs 10+ quiz questions (has " + (m.quiz || []).length + ")");
  else m.quiz.forEach((q, i) => checkQuestion(file, "quiz[" + i + "]", q, false));
  if (!Array.isArray(m.flashcards) || m.flashcards.length < 12) err(file, "needs 12+ flashcards (has " + (m.flashcards || []).length + ")");
  else m.flashcards.forEach((c, i) => {
    if (typeof c.front !== "string" || !c.front.trim()) err(file, "flashcard " + i + ": empty front");
    if (/[<>]/.test(c.front || "")) err(file, "flashcard " + i + ": front must be plain text");
    checkHtml(file, "flashcard " + i + " back", c.back);
  });
  if (m.lab != null) {
    if (!m.lab.title) err(file, "lab missing title");
    checkHtml(file, "lab", m.lab.html);
    if (!/teardown/i.test(m.lab.html || "")) err(file, "lab has no teardown section");
  }
}

function checkExam(file, e) {
  for (const k of ["id", "track", "title", "timeMinutes", "questions"]) if (!(k in e)) err(file, "exam missing field: " + k);
  if (e.track !== "saa" && e.track !== "sap") err(file, "track must be 'saa' or 'sap'");
  if (!Array.isArray(e.questions) || e.questions.length < 30) err(file, "exam needs 30+ questions (has " + (e.questions || []).length + ")");
  else e.questions.forEach((q, i) => checkQuestion(file, "exam q[" + i + "]", q, true));
}

const files = process.argv.length > 2 ? process.argv.slice(2).map((f) => path.resolve(f)) : listContentFiles();
if (!files.length) { console.log("No content files found yet."); process.exit(0); }
let modules = 0, exams = 0, qs = 0, cards = 0;
for (const f of files) {
  const reg = loadFile(f);
  if (!reg) continue;
  if (reg.modules.length + reg.exams.length === 0) err(f, "file registered nothing");
  for (const m of reg.modules) { checkModule(f, m); modules++; qs += (m.quiz || []).length; cards += (m.flashcards || []).length; }
  for (const e of reg.exams) { checkExam(f, e); exams++; qs += (e.questions || []).length; }
}
console.log("\nValidated " + files.length + " file(s): " + modules + " modules, " + exams + " exams, " + qs + " questions, " + cards + " flashcards.");
if (errors) { console.error(errors + " error(s)."); process.exit(1); }
console.log("All good ✔");
