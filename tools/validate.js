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

/* Each course has its own content root and track vocabulary. */
const COURSE_ROOTS = [
  { root: "content", tracks: ["saa", "sap"] },
  { root: "content-ai", tracks: ["core", "applied"] },
];
function allowedTracks(file) {
  const rel = path.relative(root, file);
  for (const c of COURSE_ROOTS) {
    if (rel === c.root || rel.startsWith(c.root + path.sep)) return c.tracks;
  }
  return COURSE_ROOTS[0].tracks;
}
function listContentFiles() {
  const out = [];
  const subdirs = ["", "modules", "exams", "diagrams", "explainers", "missions"];
  for (const c of COURSE_ROOTS) {
    for (const sub of subdirs) {
      const abs = path.join(root, c.root, sub);
      if (!fs.existsSync(abs)) continue;
      for (const f of fs.readdirSync(abs).sort()) {
        if (f.endsWith(".js") && !f.startsWith("_")) out.push(path.join(abs, f));
      }
    }
  }
  return out;
}

function loadFile(file) {
  const registered = { modules: [], exams: [], diagrams: [], widgets: [], explainers: [], drills: [], missions: [] };
  const sandbox = {
    window: {},
    console,
    document: undefined, // widgets touch DOM only inside render(); registration must not
  };
  sandbox.window.COURSE = {
    register: (m) => registered.modules.push(m),
    registerExam: (e) => registered.exams.push(e),
    registerDiagram: (d) => registered.diagrams.push(d),
    registerWidget: (w) => registered.widgets.push(w),
    registerExplainer: (x) => registered.explainers.push(x),
    registerDrills: (arr) => { registered.drills = registered.drills.concat(arr); },
    registerMission: (m) => registered.missions.push(m),
  };
  sandbox.COURSE = sandbox.window.COURSE;
  const src = fs.readFileSync(file, "utf8");
  if (src.includes("placeholder — content being authored")) { console.log("  skip (placeholder): " + path.basename(file)); return { modules: [], exams: [], diagrams: [], widgets: [], explainers: [], drills: [], missions: [], placeholder: true }; }
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
  const tracks = allowedTracks(file);
  if (!tracks.includes(m.track)) err(file, "track must be one of: " + tracks.join(", "));
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
  const etracks = allowedTracks(file);
  if (!etracks.includes(e.track)) err(file, "track must be one of: " + etracks.join(", "));
  if (!Array.isArray(e.questions) || e.questions.length < 30) err(file, "exam needs 30+ questions (has " + (e.questions || []).length + ")");
  else e.questions.forEach((q, i) => checkQuestion(file, "exam q[" + i + "]", q, true));
}

function checkDiagram(file, d) {
  for (const k of ["id", "moduleId", "title", "w", "h", "nodes"]) if (!(k in d)) err(file, "diagram missing field: " + k);
  if (!Array.isArray(d.nodes) || d.nodes.length < 3) return err(file, "diagram '" + d.id + "': needs 3+ nodes");
  const ids = new Set();
  for (const n of d.nodes) {
    if (!n.id) { err(file, "diagram '" + d.id + "': node without id"); continue; }
    if (ids.has(n.id)) err(file, "diagram '" + d.id + "': duplicate node id " + n.id);
    ids.add(n.id);
    for (const k of ["x", "y", "w", "h"]) if (typeof n[k] !== "number") err(file, "diagram '" + d.id + "' node " + n.id + ": missing numeric " + k);
    if (n.x < 0 || n.y < 0 || n.x + n.w > d.w || n.y + n.h > d.h) err(file, "diagram '" + d.id + "' node " + n.id + ": out of canvas bounds");
    if (!n.zone && (typeof n.info !== "string" || n.info.length < 30)) err(file, "diagram '" + d.id + "' node " + n.id + ": clickable nodes need a substantive info string");
    if (!n.label) err(file, "diagram '" + d.id + "' node " + n.id + ": missing label");
  }
  const edgeKeys = new Set();
  for (const e of d.edges || []) {
    if (!ids.has(e.from) || !ids.has(e.to)) err(file, "diagram '" + d.id + "': edge " + e.from + "->" + e.to + " references unknown node");
    edgeKeys.add(e.from + "->" + e.to);
  }
  for (const f of d.flows || []) {
    if (!f.title || !Array.isArray(f.steps) || f.steps.length < 2) err(file, "diagram '" + d.id + "': flow needs title and 2+ steps");
    for (const s of f.steps || []) {
      if (typeof s.text !== "string" || s.text.length < 30) err(file, "diagram '" + d.id + "' flow '" + f.title + "': step needs substantive text");
      for (const k of s.lit || []) {
        if (!ids.has(k) && !edgeKeys.has(k)) err(file, "diagram '" + d.id + "' flow '" + f.title + "': lit ref '" + k + "' matches no node or edge");
      }
    }
  }
}

function checkExplainer(file, x) {
  for (const k of ["id", "moduleId", "title", "levels"]) if (!(k in x)) err(file, "explainer missing field: " + k);
  if (!Array.isArray(x.levels) || x.levels.length !== 4) return err(file, "explainer '" + x.id + "': needs exactly 4 levels");
  const names = ["The analogy", "The simple model", "How it actually works", "The sharp edges"];
  x.levels.forEach((lv, i) => {
    if (lv.name !== names[i]) err(file, "explainer '" + x.id + "' level " + i + ": name must be '" + names[i] + "'");
    checkHtml(file, "explainer '" + x.id + "' level " + i, lv.html);
    if ((lv.html || "").length < 400) err(file, "explainer '" + x.id + "' level " + i + ": too thin (" + (lv.html || "").length + " chars, want 400+)");
  });
}
function checkDrill(file, d, i) {
  if (typeof d.q !== "string" || d.q.length < 10 || /[<>]/.test(d.q)) err(file, "drill[" + i + "]: q must be plain text 10+ chars");
  if (!Array.isArray(d.options) || d.options.length !== 4) err(file, "drill[" + i + "]: needs exactly 4 options");
  else d.options.forEach((o, j) => { if (typeof o !== "string" || /[<>]/.test(o)) err(file, "drill[" + i + "] option " + j + ": plain text required"); });
  if (!Number.isInteger(d.answer) || d.answer < 0 || d.answer > 3) err(file, "drill[" + i + "]: answer index out of range");
  if (typeof d.why !== "string" || d.why.length < 20) err(file, "drill[" + i + "]: needs a substantive why");
}

function checkMission(file, m) {
  for (const k of ["id", "level", "title", "time", "cost", "services", "brief", "tasks", "hints", "walkthrough", "teardown"]) {
    if (!(k in m)) err(file, "mission missing field: " + k);
  }
  if (![1, 2, 3].includes(m.level)) err(file, "mission '" + m.id + "': level must be 1, 2, or 3");
  if (!Array.isArray(m.services) || m.services.length < 2) err(file, "mission '" + m.id + "': list 2+ services");
  checkHtml(file, "mission '" + m.id + "' brief", m.brief);
  if ((m.brief || "").length < 600) err(file, "mission '" + m.id + "': brief too thin (want a real scenario, 600+ chars)");
  if (!Array.isArray(m.tasks) || m.tasks.length < 4) err(file, "mission '" + m.id + "': needs 4+ acceptance criteria");
  (m.tasks || []).forEach((t, i) => checkHtml(file, "mission '" + m.id + "' task " + i, t));
  checkHtml(file, "mission '" + m.id + "' hints", m.hints);
  checkHtml(file, "mission '" + m.id + "' walkthrough", m.walkthrough);
  if ((m.walkthrough || "").length < 1500) err(file, "mission '" + m.id + "': walkthrough too thin (this is the answer key, 1500+ chars)");
  checkHtml(file, "mission '" + m.id + "' teardown", m.teardown);
  if (!/aws |console|delete|terminate|remove/i.test(m.teardown || "")) err(file, "mission '" + m.id + "': teardown must contain concrete cleanup steps");
}

const files = process.argv.length > 2 ? process.argv.slice(2).map((f) => path.resolve(f)) : listContentFiles();
if (!files.length) { console.log("No content files found yet."); process.exit(0); }
let modules = 0, exams = 0, qs = 0, cards = 0, diagrams = 0, widgets = 0, explainers = 0, drills = 0, missions = 0;
for (const f of files) {
  const reg = loadFile(f);
  if (!reg) continue;
  if (!reg.placeholder && reg.modules.length + reg.exams.length + reg.diagrams.length + reg.widgets.length + reg.explainers.length + reg.drills.length + reg.missions.length === 0) err(f, "file registered nothing");
  for (const m of reg.modules) { checkModule(f, m); modules++; qs += (m.quiz || []).length; cards += (m.flashcards || []).length; }
  for (const e of reg.exams) { checkExam(f, e); exams++; qs += (e.questions || []).length; }
  for (const d of reg.diagrams) { checkDiagram(f, d); diagrams++; }
  for (const x of reg.explainers) { checkExplainer(f, x); explainers++; }
  for (const mi of reg.missions) { checkMission(f, mi); missions++; }
  reg.drills.forEach((d, i) => checkDrill(f, d, i));
  drills += reg.drills.length;
  widgets += reg.widgets.length;
}
console.log("\nValidated " + files.length + " file(s): " + modules + " modules, " + exams + " exams, " + qs + " questions, " + cards + " flashcards, " + diagrams + " diagrams, " + widgets + " widgets, " + explainers + " explainers, " + drills + " drill items, " + missions + " missions.");
if (errors) { console.error(errors + " error(s)."); process.exit(1); }
console.log("All good ✔");
