/* AWS Solutions Architect — Interactive Course engine.
 * Vanilla JS, no build step. Content registers into window.COURSE (see index.html).
 * All progress persists to localStorage under STORE_KEY. */
(function () {
  "use strict";

  var STORE_KEY = "awsarch-v1";
  var PASS_MARK = 72; // AWS scaled 720/1000 ≈ 72% raw as a rough bar

  /* ================= store ================= */
  function blankStore() {
    return { lessons: {}, quizBest: {}, quizAttempts: {}, examAttempts: [], flash: {}, notes: [], resume: null, streak: { last: null, count: 0 } };
  }
  var S = loadStore();
  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return blankStore();
      var d = JSON.parse(raw);
      var b = blankStore();
      for (var k in b) if (!(k in d)) d[k] = b[k];
      return d;
    } catch (e) { return blankStore(); }
  }
  function save() {
    touchStreak();
    S.savedAt = Date.now();
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
    renderSidebar();
    scheduleSync();
  }

  /* ================= cloud sync via GitHub Gist =================
   * Optional. A fine-grained PAT with only the "gist" scope, stored locally
   * (never in the exported progress JSON). Last-writer-wins by savedAt. */
  var SYNC_KEY = "awsarch-sync";
  var GIST_FILE = "aws-architect-progress.json";
  function syncCfg() {
    try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || null; } catch (e) { return null; }
  }
  function setSyncCfg(c) {
    if (c) localStorage.setItem(SYNC_KEY, JSON.stringify(c));
    else localStorage.removeItem(SYNC_KEY);
  }
  function gh(path, opts, cfg) {
    opts = opts || {};
    opts.headers = {
      "Authorization": "Bearer " + cfg.token,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json"
    };
    return fetch("https://api.github.com" + path, opts).then(function (r) {
      if (!r.ok) throw new Error("GitHub API " + r.status);
      return r.status === 204 ? null : r.json();
    });
  }
  var syncTimer = null, syncState = "";
  function setSyncState(s) {
    syncState = s;
    var elx = document.getElementById("syncstate");
    if (elx) elx.textContent = s;
  }
  function scheduleSync() {
    if (!fbUser && !syncCfg()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { fbUser ? fbPush() : pushSync(); }, 4000);
  }

  /* ---- Firebase mode ("Sign in with Google") — active when firebase-config.js is filled in ---- */
  var fbUser = null, fbReady = null;
  function loadFirebase() {
    if (fbReady) return fbReady;
    var V = "10.14.1";
    function inject(name) {
      return new Promise(function (res, rej) {
        var s = document.createElement("script");
        s.src = "https://www.gstatic.com/firebasejs/" + V + "/firebase-" + name + "-compat.js";
        s.onload = res; s.onerror = function () { rej(new Error("failed to load firebase-" + name)); };
        document.head.appendChild(s);
      });
    }
    fbReady = inject("app").then(function () { return inject("auth"); }).then(function () { return inject("firestore"); })
      .then(function () {
        window.firebase.initializeApp(window.FIREBASE_CONFIG);
        return new Promise(function (res) {
          var first = true;
          window.firebase.auth().onAuthStateChanged(function (u) {
            fbUser = u;
            if (u) fbPull(function (changed) { if (changed) { renderSidebar(); route(); } });
            setSyncState(u ? "signed in as " + (u.displayName || u.email) : "signed out");
            if (first) { first = false; res(); }
            var st = document.getElementById("fbstate");
            if (st) viewSettings();
          });
        });
      });
    return fbReady;
  }
  function fbDoc() {
    return window.firebase.firestore().collection("progress").doc(fbUser.uid);
  }
  function fbPush() {
    if (!fbUser) return;
    setSyncState("syncing…");
    fbDoc().set({ data: JSON.stringify(S), savedAt: S.savedAt || Date.now() })
      .then(function () { setSyncState("synced " + new Date().toLocaleTimeString()); })
      .catch(function (e) { setSyncState("sync failed: " + e.message); });
  }
  function fbPull(done) {
    if (!fbUser) return done && done(false);
    fbDoc().get().then(function (snap) {
      if (!snap.exists) { fbPush(); return done && done(false); }
      var d = snap.data();
      if ((d.savedAt || 0) > (S.savedAt || 0)) {
        S = JSON.parse(d.data);
        var b = blankStore();
        for (var k in b) if (!(k in S)) S[k] = b[k];
        localStorage.setItem(STORE_KEY, JSON.stringify(S));
        setSyncState("pulled newer progress from cloud");
        return done && done(true);
      }
      done && done(false);
    }).catch(function (e) { setSyncState("sync failed: " + e.message); done && done(false); });
  }
  function pushSync() {
    var cfg = syncCfg();
    if (!cfg || !cfg.gistId) return;
    setSyncState("syncing…");
    var files = {};
    files[GIST_FILE] = { content: JSON.stringify(S) };
    gh("/gists/" + cfg.gistId, { method: "PATCH", body: JSON.stringify({ files: files }) }, cfg)
      .then(function () { cfg.lastSync = Date.now(); setSyncCfg(cfg); setSyncState("synced " + new Date().toLocaleTimeString()); })
      .catch(function (e) { setSyncState("sync failed: " + e.message); });
  }
  function pullSync(done) {
    var cfg = syncCfg();
    if (!cfg || !cfg.gistId) return done && done(false);
    gh("/gists/" + cfg.gistId, {}, cfg).then(function (g) {
      var f = g.files && g.files[GIST_FILE];
      if (!f || !f.content) return done && done(false);
      var remote = JSON.parse(f.content);
      if ((remote.savedAt || 0) > (S.savedAt || 0)) {
        S = remote;
        var b = blankStore();
        for (var k in b) if (!(k in S)) S[k] = b[k];
        localStorage.setItem(STORE_KEY, JSON.stringify(S));
        setSyncState("pulled newer progress from gist");
        return done && done(true);
      }
      done && done(false);
    }).catch(function (e) { setSyncState("sync failed: " + e.message); done && done(false); });
  }
  function enableSync(token, statusEl, onDone) {
    var cfg = { token: token, gistId: null, lastSync: 0 };
    statusEl.textContent = "Looking for an existing progress gist…";
    gh("/gists?per_page=100", {}, cfg).then(function (list) {
      var found = list.find(function (g) { return g.files && g.files[GIST_FILE]; });
      if (found) { cfg.gistId = found.id; setSyncCfg(cfg); return null; }
      var files = {};
      files[GIST_FILE] = { content: JSON.stringify(S) };
      return gh("/gists", {
        method: "POST",
        body: JSON.stringify({ description: "AWS Solutions Architect course progress (auto-synced)", public: false, files: files })
      }, cfg).then(function (g) { cfg.gistId = g.id; setSyncCfg(cfg); });
    }).then(function () {
      statusEl.textContent = "Connected. Pulling remote progress if newer…";
      pullSync(function (changed) { onDone(true, changed); });
    }).catch(function (e) {
      statusEl.textContent = "Failed: " + e.message + " — check the token has the gist scope.";
      onDone(false, false);
    });
  }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function touchStreak() {
    var t = todayStr();
    if (S.streak.last === t) return;
    var y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    S.streak.count = (S.streak.last === y) ? S.streak.count + 1 : 1;
    S.streak.last = t;
  }

  /* ================= course data ================= */
  var MODULES = COURSE.modules.slice().sort(function (a, b) { return a.order - b.order; });
  var EXAMS = COURSE.exams.slice();
  var WIDGETS = COURSE.widgets.slice();
  var DIAGRAMS = COURSE.diagrams.slice();
  var EXPLAINERS = COURSE.explainers.slice();
  var DRILLS = COURSE.drills.slice();
  var MISSIONS = COURSE.missions.slice().sort(function (a, b) { return (a.level || 1) - (b.level || 1); });
  function moduleWidgets(id) { return WIDGETS.filter(function (w) { return w.moduleId === id; }); }
  function moduleDiagrams(id) { return DIAGRAMS.filter(function (d) { return d.moduleId === id; }); }
  function moduleExplainer(id) { return EXPLAINERS.find(function (x) { return x.moduleId === id; }); }
  function mod(id) { return MODULES.find(function (m) { return m.id === id; }); }
  function exam(id) { return EXAMS.find(function (e) { return e.id === id; }); }
  function trackModules(t) { return MODULES.filter(function (m) { return m.track === t; }); }

  /* ================= progress math ================= */
  function lessonKey(m, l) { return m.id + "/" + l.id; }
  function moduleLessonPct(m) {
    if (!m.lessons.length) return 0;
    var done = m.lessons.filter(function (l) { return S.lessons[lessonKey(m, l)]; }).length;
    return Math.round(100 * done / m.lessons.length);
  }
  function modulePct(m) {
    // 70% lessons, 30% best quiz score
    var lp = moduleLessonPct(m);
    var qp = S.quizBest[m.id] || 0;
    return Math.round(lp * 0.7 + qp * 0.3);
  }
  function trackReadiness(t) {
    var ms = trackModules(t);
    if (!ms.length) return { lessons: 0, quiz: 0, exam: 0, overall: 0 };
    var lp = avg(ms.map(moduleLessonPct));
    var qp = avg(ms.map(function (m) { return S.quizBest[m.id] || 0; }));
    var best = 0;
    S.examAttempts.forEach(function (a) {
      var e = exam(a.examId);
      if (e && e.track === t && a.pct > best) best = a.pct;
    });
    return { lessons: Math.round(lp), quiz: Math.round(qp), exam: Math.round(best), overall: Math.round(lp * 0.4 + qp * 0.4 + best * 0.2) };
  }
  function avg(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0; }

  /* ================= flashcards (Leitner) ================= */
  var BOX_DAYS = [0, 0, 1, 3, 7, 14]; // index by box 1..5
  function cardKey(m, i) { return m.id + "/" + i; }
  function cardState(m, i) { return S.flash[cardKey(m, i)] || { box: 1, due: 0 }; }
  function gradeCard(m, i, grade) {
    var st = cardState(m, i);
    if (grade === "again") st.box = 1;
    else if (grade === "good") st.box = Math.min(5, st.box + 1);
    else if (grade === "easy") st.box = Math.min(5, st.box + 2);
    st.due = Date.now() + BOX_DAYS[st.box] * 86400000;
    S.flash[cardKey(m, i)] = st;
    save();
  }
  function dueCards(moduleFilter) {
    var out = [];
    MODULES.forEach(function (m) {
      if (moduleFilter && m.id !== moduleFilter) return;
      (m.flashcards || []).forEach(function (c, i) {
        if (cardState(m, i).due <= Date.now()) out.push({ m: m, i: i, c: c });
      });
    });
    // unseen and lapsed first, shuffle within
    return shuffle(out);
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ================= notes ================= */
  function noteId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function addNote(text, ctx, href) {
    text = (text || "").trim();
    if (!text) return null;
    if (!S.notes) S.notes = [];
    var n = { id: noteId(), text: text, ctx: ctx || "", href: href || "", createdAt: Date.now(), learned: false };
    S.notes.push(n);
    save();
    return n;
  }
  function openNotesCount() {
    return (S.notes || []).filter(function (n) { return !n.learned; }).length;
  }
  /* Exposed so askai.js (and anything else) can capture notes from anywhere. */
  window.NOTES = {
    add: function (text, ctx, href) {
      var n = addNote(text, ctx, href);
      if (n) toast('Note saved — <a href="#/notes">view in My notes</a>');
      return n;
    }
  };

  var toastTimer = null;
  function toast(html) {
    var t = document.querySelector(".toast");
    if (!t) { t = el('<div class="toast"></div>'); document.body.appendChild(t); }
    t.innerHTML = html;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2800);
  }

  /* ================= utils ================= */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html;
    return d.firstElementChild;
  }
  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }
  function letters(i) { return "ABCDEFGH"[i]; }

  /* ================= rendering shell ================= */
  var app = document.getElementById("app");
  var sidebarEl, mainEl;
  function shell() {
    app.innerHTML = "";
    sidebarEl = el('<nav class="sidebar"></nav>');
    mainEl = el('<main class="main"></main>');
    var topbar = el('<div class="mobile-topbar"><button id="menubtn" aria-label="Toggle navigation">☰</button><span class="mt-title">AWS Solutions Architect</span></div>');
    var backdrop = el('<div class="sidebar-backdrop"></div>');
    app.appendChild(topbar);
    app.appendChild(sidebarEl);
    app.appendChild(backdrop);
    app.appendChild(mainEl);
    topbar.querySelector("#menubtn").onclick = function () { document.body.classList.toggle("nav-open"); };
    backdrop.onclick = function () { document.body.classList.remove("nav-open"); };
    sidebarEl.addEventListener("click", function (e) {
      if (e.target.closest("a")) document.body.classList.remove("nav-open");
    });
    renderSidebar();
  }

  function renderSidebar() {
    if (!sidebarEl) return;
    var h = '<div class="brand"><h1>AWS Solutions Architect</h1><div class="sub">SAA-C03 → SAP-C02 · senior track</div></div>';
    h += navItem("#/", "Dashboard", null);
    h += navItem("#/review", "Flashcard review", dueBadge());
    h += navItem("#/notes", "My notes", openNotesCount() ? String(openNotesCount()) : null);
    h += navItem("#/playground", "Playground", WIDGETS.length ? String(WIDGETS.length) : null);
    if (DRILLS.length) h += navItem("#/drill", "Speed drill", S.drillHigh ? "best " + S.drillHigh : null);
    if (MISSIONS.length) h += navItem("#/missions", "Missions (real AWS)", missionsDoneCount() + "/" + MISSIONS.length);
    h += navItem("#/settings", "Settings & data", null);
    h += '<div class="nav-section">Associate · SAA-C03</div>';
    trackModules("saa").forEach(function (m) { h += modNav(m); });
    h += '<div class="nav-section">Professional · SAP-C02</div>';
    trackModules("sap").forEach(function (m) { h += modNav(m); });
    h += '<div class="nav-section">Practice exams</div>';
    EXAMS.forEach(function (e) {
      h += navItem("#/exam/" + e.id, e.title, bestExamPct(e.id));
    });
    sidebarEl.innerHTML = h;
    markActive();
  }
  function dueBadge() {
    var n = dueCards(null).length;
    return n ? String(n) : null;
  }
  function bestExamPct(id) {
    var best = null;
    S.examAttempts.forEach(function (a) { if (a.examId === id && (best === null || a.pct > best)) best = a.pct; });
    return best === null ? null : best + "%";
  }
  function modNav(m) {
    var p = modulePct(m);
    var badge = '<span class="pct' + (p >= 100 ? " done" : "") + '">' + (p > 0 ? p + "%" : "") + "</span>";
    return '<a class="nav-item" data-href="#/module/' + m.id + '" href="#/module/' + m.id + '">' +
      '<span class="num">' + String(m.order).padStart(2, "0") + "</span><span>" + esc(m.title) + "</span>" + badge + "</a>";
  }
  function navItem(href, label, badge) {
    return '<a class="nav-item" data-href="' + href + '" href="' + href + '"><span>' + esc(label) + "</span>" +
      (badge ? '<span class="pct">' + esc(badge) + "</span>" : "") + "</a>";
  }
  function markActive() {
    var hash = location.hash || "#/";
    sidebarEl.querySelectorAll(".nav-item").forEach(function (a) {
      var h = a.getAttribute("data-href");
      var active = (h === "#/") ? (hash === "#/" || hash === "") : hash.indexOf(h) === 0;
      a.classList.toggle("active", active);
    });
  }

  /* ================= resume ("pick up where you left off") ================= */
  /* Label for a resumable location, or null for pages that shouldn't be resumed
   * to (dashboard, settings, unknown routes). */
  function resumeLabel(parts) {
    if (parts[0] === "playground") return "Playground";
    if (parts[0] === "drill") return "Speed drill";
    if (parts[0] === "missions") return "Missions";
    if (parts[0] === "mission" && parts[1]) {
      var mi = MISSIONS.find(function (x) { return x.id === parts[1]; });
      return mi ? "Mission: " + mi.title : null;
    }
    if (parts[0] === "review") return "Flashcard review";
    if (parts[0] === "notes") return "My notes";
    if (parts[0] === "exam" && parts[1]) {
      var e = exam(parts[1]);
      return e ? e.title : null;
    }
    if (parts[0] === "module" && parts[1]) {
      var m = mod(parts[1]);
      if (!m) return null;
      if (parts[2] === "lesson" && parts[3]) {
        var l = m.lessons.find(function (x) { return x.id === parts[3]; });
        return l ? m.title + " — " + l.title : m.title;
      }
      if (parts[2] === "quiz") return m.title + " — quiz";
      if (parts[2] === "cards") return m.title + " — flashcards";
      if (parts[2] === "lab") return m.title + " — lab";
      if (parts[2] === "play") return m.title + " — interactive";
      return m.title;
    }
    return null;
  }
  /* Persist the spot without touchStreak() — just visiting a page isn't studying. */
  function rememberSpot(parts) {
    var label = resumeLabel(parts);
    if (!label) return;
    S.resume = { hash: "#/" + parts.join("/"), title: label, at: Date.now() };
    S.savedAt = Date.now();
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
    scheduleSync();
  }
  function timeAgo(ts) {
    if (!ts) return "";
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    var mn = Math.round(s / 60);
    if (mn < 60) return mn + " min ago";
    var hr = Math.round(mn / 60);
    if (hr < 24) return hr + " hour" + (hr === 1 ? "" : "s") + " ago";
    var d = Math.round(hr / 24);
    return d + " day" + (d === 1 ? "" : "s") + " ago";
  }

  /* ================= router ================= */
  var cleanup = null; // timers etc.
  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    var hash = (location.hash || "#/").slice(2); // drop '#/'
    var parts = hash.split("/").filter(Boolean);
    rememberSpot(parts);
    markActive();
    mainEl.scrollTop = 0;
    window.scrollTo(0, 0);
    mainEl.classList.remove("fade");
    void mainEl.offsetWidth; // restart the entry animation
    mainEl.classList.add("fade");
    if (parts.length === 0) return viewDashboard();
    if (parts[0] === "playground") return viewPlayground();
    if (parts[0] === "drill") return viewDrill();
    if (parts[0] === "missions") return viewMissions();
    if (parts[0] === "mission" && parts[1]) return viewMission(parts[1]);
    if (parts[0] === "review") return viewGlobalReview();
    if (parts[0] === "notes") return viewNotes();
    if (parts[0] === "settings") return viewSettings();
    if (parts[0] === "exam" && parts[1]) return viewExam(parts[1]);
    if (parts[0] === "module" && parts[1]) {
      var m = mod(parts[1]);
      if (!m) return viewDashboard();
      if (parts[2] === "lesson" && parts[3]) return viewLesson(m, parts[3]);
      if (parts[2] === "quiz") return viewQuiz(m);
      if (parts[2] === "cards") return viewCards(m);
      if (parts[2] === "lab") return viewLab(m);
      if (parts[2] === "play") return viewModulePlay(m);
      return viewModule(m);
    }
    viewDashboard();
  }

  /* ================= views ================= */
  function viewDashboard() {
    var saa = trackReadiness("saa"), sap = trackReadiness("sap");
    var totalLessons = 0, doneLessons = 0, totalCards = 0;
    MODULES.forEach(function (m) {
      totalLessons += m.lessons.length;
      doneLessons += m.lessons.filter(function (l) { return S.lessons[lessonKey(m, l)]; }).length;
      totalCards += (m.flashcards || []).length;
    });
    var due = dueCards(null).length;
    var h = '<h2 class="page-title">Dashboard</h2>' +
      '<p class="page-sub">Your path to AWS Certified Solutions Architect — Associate first, then Professional.</p>';

    if (S.resume && S.resume.hash && S.resume.title) {
      h += '<div class="card resume-card"><div class="resume-info">' +
        '<div class="resume-kicker">Pick up where you left off</div>' +
        '<div class="resume-title">' + esc(S.resume.title) + '</div>' +
        '<div class="muted">' + esc(timeAgo(S.resume.at)) + "</div></div>" +
        '<a class="btn primary resume-btn" href="' + esc(S.resume.hash) + '">Continue →</a></div>';
    }

    h += '<div class="grid3">' +
      stat(doneLessons + " / " + totalLessons, "Lessons completed") +
      stat(due, "Flashcards due") +
      stat((S.streak.count || 0) + " day" + (S.streak.count === 1 ? "" : "s"), "Study streak") +
      "</div>";

    h += readinessCard("SAA-C03 Associate readiness", saa, "saa");
    h += readinessCard("SAP-C02 Professional readiness", sap, "sap");

    // next action
    var next = nextAction();
    h += '<div class="card"><h3>Suggested next step</h3><p>' + next.text + '</p><p style="margin-top:0.8rem"><a class="btn primary" href="' + next.href + '">' + esc(next.cta) + "</a></p></div>";

    // recent exams
    if (S.examAttempts.length) {
      h += '<div class="card"><h3>Practice exam history</h3>';
      S.examAttempts.slice(-8).reverse().forEach(function (a) {
        var e = exam(a.examId);
        h += '<div class="domain-row"><span class="dname">' + esc(e ? e.title : a.examId) + ' <span class="muted">· ' + a.date.slice(0, 10) + "</span></span>" +
          '<span class="bar"><i class="' + (a.pct >= PASS_MARK ? "green" : "") + '" style="width:' + a.pct + '%"></i></span><span class="dpct">' + a.pct + "%</span></div>";
      });
      h += "</div>";
    }
    mainEl.innerHTML = h;
  }
  function stat(num, label) {
    return '<div class="card center"><div class="statnum">' + num + '</div><div class="statlabel">' + label + "</div></div>";
  }
  function readinessCard(title, r, track) {
    var verdict = r.overall >= 85 ? "Ready — book the exam." :
      r.overall >= 65 ? "Getting close. Drill weak quizzes and take a timed practice exam." :
        r.overall >= 30 ? "In progress — keep working through the modules." : "Just getting started.";
    return '<div class="card"><h3>' + esc(title) + ' <span class="tag ' + track + '">' + track + "</span></h3>" +
      '<div class="domain-row"><span class="dname">Lessons</span><span class="bar"><i style="width:' + r.lessons + '%"></i></span><span class="dpct">' + r.lessons + "%</span></div>" +
      '<div class="domain-row"><span class="dname">Module quizzes (best)</span><span class="bar"><i class="blue" style="width:' + r.quiz + '%"></i></span><span class="dpct">' + r.quiz + "%</span></div>" +
      '<div class="domain-row"><span class="dname">Practice exam (best)</span><span class="bar"><i class="green" style="width:' + r.exam + '%"></i></span><span class="dpct">' + r.exam + "%</span></div>" +
      '<p class="muted" style="margin-top:0.6rem"><strong style="color:var(--text)">' + r.overall + "% overall</strong> — " + verdict + "</p></div>";
  }
  function nextAction() {
    var due = dueCards(null).length;
    if (due >= 20) return { text: "You have " + due + " flashcards due — clear them before they pile up. Spaced repetition only works if you show up.", href: "#/review", cta: "Review " + due + " cards" };
    for (var i = 0; i < MODULES.length; i++) {
      var m = MODULES[i];
      if (moduleLessonPct(m) < 100) {
        var nl = m.lessons.find(function (l) { return !S.lessons[lessonKey(m, l)]; });
        return { text: "Continue <strong>" + esc(m.title) + "</strong> — next up: “" + esc(nl.title) + "”.", href: "#/module/" + m.id + "/lesson/" + nl.id, cta: "Continue lesson" };
      }
      if ((S.quizBest[m.id] || 0) < 80) {
        return { text: "You finished the lessons in <strong>" + esc(m.title) + "</strong> but haven’t hit 80% on its quiz yet (best: " + (S.quizBest[m.id] || 0) + "%).", href: "#/module/" + m.id + "/quiz", cta: "Take the quiz" };
      }
    }
    return { text: "All modules complete. Time to grind timed practice exams until you consistently clear " + PASS_MARK + "%.", href: EXAMS.length ? "#/exam/" + EXAMS[0].id : "#/", cta: "Take a practice exam" };
  }

  /* ---------- module overview ---------- */
  function viewModule(m) {
    var h = moduleHeader(m);
    h += '<div class="card"><h3>About this module</h3><p>' + m.description + "</p>" +
      (m.examWeight ? '<p class="muted" style="margin-top:0.5rem">Exam relevance: ' + esc(m.examWeight) + "</p>" : "") + "</div>";
    mainEl.innerHTML = h;
    var ex = moduleExplainer(m.id);
    if (ex) renderExplainer(ex, mainEl);
    h = "<h3 style='margin:1.4rem 0 0.7rem'>Lessons</h3>";
    m.lessons.forEach(function (l) {
      var done = !!S.lessons[lessonKey(m, l)];
      h += '<a class="lesson-row' + (done ? " done" : "") + '" href="#/module/' + m.id + "/lesson/" + l.id + '">' +
        '<span class="check">' + (done ? "✓" : "○") + '</span><span class="t">' + esc(l.title) + "</span></a>";
    });
    var nInteractive = moduleWidgets(m.id).length + moduleDiagrams(m.id).length;
    h += '<div class="row" style="margin-top:1.5rem">' +
      (nInteractive ? '<a class="btn primary" href="#/module/' + m.id + '/play">Interactive (' + nInteractive + ")</a>" : "") +
      '<a class="btn' + (nInteractive ? "" : " primary") + '" href="#/module/' + m.id + '/quiz">Quiz (' + m.quiz.length + " questions" + (S.quizBest[m.id] ? " · best " + S.quizBest[m.id] + "%" : "") + ")</a>" +
      '<a class="btn" href="#/module/' + m.id + '/cards">Flashcards (' + (m.flashcards || []).length + ")</a>" +
      (m.lab ? '<a class="btn" href="#/module/' + m.id + '/lab">Hands-on lab</a>' : "") +
      "</div>";
    mainEl.appendChild(el("<div>" + h + "</div>"));
  }

  /* ---------- intuition builder (explainer) ---------- */
  function renderExplainer(ex, container) {
    var card = el('<div class="card explainer"><h3>Build the intuition: ' + esc(ex.title) + '</h3>' +
      '<p class="muted" style="margin-bottom:0.7rem">Start dumb, end deep. Pick your altitude — each level is the truth, just with more resolution.</p>' +
      '<div class="w-chip-row lv"></div><div class="explainer-body lesson-body"></div></div>');
    var chipsBox = card.querySelector(".lv"), body = card.querySelector(".explainer-body");
    var idx = 0;
    function show(i) {
      idx = i;
      chipsBox.querySelectorAll(".w-chip").forEach(function (c, j) { c.classList.toggle("sel", j === i); });
      body.innerHTML = ex.levels[i].html;
    }
    ex.levels.forEach(function (lv, i) {
      var c = el('<span class="w-chip">' + esc(lv.name) + "</span>");
      c.onclick = function () { show(i); };
      chipsBox.appendChild(c);
    });
    container.appendChild(card);
    show(0);
  }

  /* ---------- missions (real-AWS scenarios) ---------- */
  function missionState(id) {
    if (!S.missions) S.missions = {};
    if (!S.missions[id]) S.missions[id] = { tasks: {}, done: false };
    return S.missions[id];
  }
  function missionsDoneCount() {
    if (!S.missions) return 0;
    return MISSIONS.filter(function (m) { return S.missions[m.id] && S.missions[m.id].done; }).length;
  }
  function missionPct(m) {
    var st = missionState(m.id);
    var n = (m.tasks || []).length;
    if (!n) return 0;
    var done = (m.tasks || []).filter(function (_, i) { return st.tasks[i]; }).length;
    return Math.round(100 * done / n);
  }
  var LEVEL_NAMES = { 1: "Base camp", 2: "Ascent", 3: "Summit" };
  function viewMissions() {
    var h = '<h2 class="page-title">Missions — real AWS, real scenarios</h2>' +
      '<p class="page-sub">Project briefs shaped like actual work: greenfield builds, on-call incidents, migrations. You build them in YOUR AWS account, check off acceptance criteria as you verify them, and tear everything down at the end. Hints exist; try without them first.</p>' +
      '<div class="callout war">These create real resources in a real account. Every mission states its worst-case cost and ends with a teardown checklist. Set a budget alarm first (the cost module lab does exactly that).</div>';
    mainEl.innerHTML = h;
    MISSIONS.forEach(function (m) {
      var st = missionState(m.id);
      var pct = missionPct(m);
      var card = el('<a class="lesson-row' + (st.done ? " done" : "") + '" href="#/mission/' + m.id + '" style="align-items:flex-start">' +
        '<span class="check">' + (st.done ? "✓" : "○") + '</span>' +
        '<span class="t"><strong>' + esc(m.title) + '</strong><br><span class="muted">' + esc(LEVEL_NAMES[m.level] || "") + " · ~" + esc(m.time) + " · " + esc(m.cost) + " · " + esc((m.services || []).join(", ")) + "</span></span>" +
        '<span class="pct" style="font-size:0.75rem;color:var(--text-dim)">' + (pct ? pct + "%" : "") + "</span></a>");
      mainEl.appendChild(card);
    });
  }
  function viewMission(id) {
    var m = MISSIONS.find(function (x) { return x.id === id; });
    if (!m) return viewMissions();
    var st = missionState(id);
    var h = '<p class="muted"><a href="#/missions">Missions</a> · ' + esc(LEVEL_NAMES[m.level] || "") + " · ~" + esc(m.time) + " · " + esc(m.cost) + "</p>" +
      '<h2 class="page-title">' + esc(m.title) + "</h2>" +
      '<div class="bar" style="margin:0.6rem 0 1.2rem"><i class="green" style="width:' + missionPct(m) + '%"></i></div>' +
      '<div class="card lesson-body"><h3>The situation</h3>' + m.brief + "</div>";
    mainEl.innerHTML = h;

    var tasksCard = el('<div class="card"><h3>Acceptance criteria — check as you verify</h3><div class="mtasks"></div></div>');
    var tbox = tasksCard.querySelector(".mtasks");
    (m.tasks || []).forEach(function (t, i) {
      var row = el('<div class="lesson-row' + (st.tasks[i] ? " done" : "") + '" style="cursor:pointer"><span class="check">' + (st.tasks[i] ? "✓" : "○") + '</span><span class="t lesson-body">' + t + "</span></div>");
      row.onclick = function () {
        st.tasks[i] = !st.tasks[i];
        st.done = (m.tasks || []).every(function (_, j) { return st.tasks[j]; });
        save();
        viewMission(id);
      };
      tbox.appendChild(row);
    });
    mainEl.appendChild(tasksCard);

    function collapsibleCard(title, html, open) {
      var c = el('<div class="acc' + (open ? " open" : "") + '"><div class="acc-head"><span class="chev">❯</span><span>' + esc(title) + '</span></div><div class="acc-body"><div class="acc-inner lesson-body">' + html + "</div></div></div>");
      c.querySelector(".acc-head").onclick = function () { c.classList.toggle("open"); };
      return c;
    }
    if (m.hints) mainEl.appendChild(collapsibleCard("Hints (try without them first)", m.hints, false));
    if (m.walkthrough) mainEl.appendChild(collapsibleCard("Full walkthrough (last resort — this is the answer key)", m.walkthrough, false));
    mainEl.appendChild(collapsibleCard("Teardown — run this when done, no exceptions", m.teardown, false));
    if (st.done) mainEl.appendChild(el('<div class="w-verdict ok"><strong>Mission complete.</strong> Did you tear it down? Check the bill in two days anyway — that habit is the real lesson.</div>'));
    mainEl.appendChild(el('<p style="margin-top:1.2rem"><a class="btn" href="#/missions">← All missions</a></p>'));
  }

  /* ---------- speed drill ---------- */
  function viewDrill() {
    var h = '<h2 class="page-title">Speed drill</h2>' +
      '<p class="page-sub">Keyword → service, against the clock. This trains the exact reflex the exam rewards: mapping scenario phrases to the right AWS service instantly.</p>' +
      '<div class="card center"><p><strong>75 seconds.</strong> +10 per hit, streak bonus (+2 × streak). Wrong answers cost 3 seconds and show you why.</p>' +
      '<p style="margin:0.8rem 0"><span class="statnum">' + (S.drillHigh || 0) + '</span><br><span class="statlabel">personal best</span></p>' +
      '<button id="startdrill" class="primary" style="font-size:1.05rem;padding:0.7rem 2rem">Start</button></div>';
    mainEl.innerHTML = h;
    document.getElementById("startdrill").onclick = runDrill;
  }
  function runDrill() {
    var pool = shuffle(DRILLS);
    var qi = 0, score = 0, streak = 0, best = 0, hits = 0, misses = [], remaining = 75;
    var locked = false;
    var interval = setInterval(function () {
      remaining--;
      var t = document.getElementById("drilltime");
      if (t) { t.textContent = remaining + "s"; t.classList.toggle("low", remaining <= 10); }
      if (remaining <= 0) finish();
    }, 1000);
    cleanup = function () { clearInterval(interval); };
    function q() { return pool[qi % pool.length]; }
    function render() {
      var d = q();
      var h = '<div class="exam-topbar"><strong>Speed drill</strong>' +
        '<span class="dg-step-pill">score ' + score + '</span>' +
        (streak >= 2 ? '<span class="dg-step-pill">' + streak + ' streak</span>' : "") +
        '<span class="spacer"></span><span class="exam-timer" id="drilltime">' + remaining + 's</span></div>' +
        '<div class="drill-q">' + esc(d.q) + "</div>" +
        '<div class="drill-opts">';
      d.options.forEach(function (o, i) {
        h += '<button class="drill-opt" data-i="' + i + '">' + esc(o) + "</button>";
      });
      h += "</div>" + '<p class="center muted" id="drillwhy" style="min-height:2.2em;margin-top:0.8rem"></p>';
      mainEl.innerHTML = h;
      mainEl.querySelectorAll(".drill-opt").forEach(function (b) {
        b.onclick = function () {
          if (locked) return;
          var i = +b.getAttribute("data-i");
          var d2 = q();
          if (i === d2.answer) {
            score += 10 + 2 * streak;
            streak++; hits++;
            if (streak > best) best = streak;
            b.classList.add("hit");
            qi++;
            setTimeout(render, 180);
          } else {
            locked = true;
            streak = 0;
            remaining = Math.max(1, remaining - 3);
            misses.push(d2);
            b.classList.add("miss");
            mainEl.querySelectorAll(".drill-opt")[d2.answer].classList.add("hit");
            document.getElementById("drillwhy").innerHTML = d2.why || "";
            setTimeout(function () { locked = false; qi++; render(); }, 1600);
          }
        };
      });
    }
    function finish() {
      clearInterval(interval);
      var isPB = score > (S.drillHigh || 0);
      if (isPB) S.drillHigh = score;
      save();
      var h = '<h2 class="page-title">Time!</h2>' +
        '<div class="card center"><div class="score-big ' + (isPB ? "pass" : "") + '">' + score + "</div>" +
        "<p>" + hits + " correct · best streak " + best + (isPB ? " · <strong>new personal best</strong>" : " · best ever " + (S.drillHigh || 0)) + "</p>" +
        '<p style="margin-top:1rem"><button id="again" class="primary">Go again</button> <a class="btn" href="#/">Dashboard</a></p></div>';
      if (misses.length) {
        h += '<div class="card"><h3>The ones that got you</h3>';
        misses.slice(0, 8).forEach(function (d) {
          h += '<p style="margin:0.5rem 0"><strong>' + esc(d.q) + "</strong> → " + esc(d.options[d.answer]) + '<br><span class="muted">' + (d.why || "") + "</span></p>";
        });
        h += "</div>";
      }
      mainEl.innerHTML = h;
      document.getElementById("again").onclick = runDrill;
    }
    render();
  }

  function moduleHeader(m) {
    return '<p class="muted"><a href="#/">Dashboard</a> · Module ' + m.order + ' · <span class="tag ' + m.track + '">' + m.track + "</span></p>" +
      '<h2 class="page-title">' + esc(m.title) + "</h2>" +
      '<div class="bar" style="margin:0.6rem 0 1.2rem"><i style="width:' + modulePct(m) + '%"></i></div>';
  }

  /* ---------- lesson ---------- */
  function viewLesson(m, lid) {
    var idx = m.lessons.findIndex(function (l) { return l.id === lid; });
    if (idx < 0) return viewModule(m);
    var l = m.lessons[idx];
    var done = !!S.lessons[lessonKey(m, l)];
    var h = '<p class="muted"><a href="#/module/' + m.id + '">' + esc(m.title) + "</a> · Lesson " + (idx + 1) + " of " + m.lessons.length + "</p>" +
      '<h2 class="page-title">' + esc(l.title) + "</h2>" +
      '<div class="lesson-body">' + collapsify(l.html) + "</div>" +
      '<hr class="sep"><div class="lesson-nav">' +
      (idx > 0 ? '<a class="btn" href="#/module/' + m.id + "/lesson/" + m.lessons[idx - 1].id + '">← ' + esc(m.lessons[idx - 1].title) + "</a>" : "<span></span>") +
      '<button id="markdone" class="' + (done ? "" : "primary") + '">' + (done ? "✓ Completed — mark as not done" : "Mark complete") + "</button>" +
      (idx < m.lessons.length - 1
        ? '<a class="btn" href="#/module/' + m.id + "/lesson/" + m.lessons[idx + 1].id + '">' + esc(m.lessons[idx + 1].title) + " →</a>"
        : '<a class="btn" href="#/module/' + m.id + '/quiz">Module quiz →</a>') +
      "</div>";
    mainEl.innerHTML = h;
    wireAccordions();
    document.getElementById("markdone").onclick = function () {
      if (S.lessons[lessonKey(m, l)]) delete S.lessons[lessonKey(m, l)];
      else S.lessons[lessonKey(m, l)] = Date.now();
      save();
      viewLesson(m, lid);
    };
  }

  /* Split long lesson HTML into collapsible sections at each h2/h3 heading.
   * Content before the first heading stays visible; the first section starts open. */
  function collapsify(html) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    var kids = Array.prototype.slice.call(tmp.childNodes);
    var sections = [], intro = [], cur = null;
    kids.forEach(function (n) {
      var isHead = n.nodeType === 1 && (n.tagName === "H2" || n.tagName === "H3");
      if (isHead) { cur = { title: n.textContent, parts: [] }; sections.push(cur); }
      else if (cur) cur.parts.push(n);
      else intro.push(n);
    });
    if (sections.length < 2) return html; // short lesson — leave as-is
    var wrap = document.createElement("div");
    var introDiv = document.createElement("div");
    introDiv.className = "lesson-intro";
    intro.forEach(function (n) { introDiv.appendChild(n); });
    wrap.appendChild(introDiv);
    sections.forEach(function (s, i) {
      var acc = document.createElement("div");
      acc.className = "acc" + (i === 0 ? " open" : "");
      var head = document.createElement("div");
      head.className = "acc-head";
      head.innerHTML = '<span class="chev">❯</span><span>' + esc(s.title) + "</span>";
      var body = document.createElement("div");
      body.className = "acc-body";
      var inner = document.createElement("div");
      inner.className = "acc-inner";
      s.parts.forEach(function (n) { inner.appendChild(n); });
      body.appendChild(inner);
      acc.appendChild(head);
      acc.appendChild(body);
      wrap.appendChild(acc);
    });
    return wrap.innerHTML;
  }
  function wireAccordions() {
    mainEl.querySelectorAll(".acc-head").forEach(function (head) {
      head.onclick = function () { head.parentElement.classList.toggle("open"); };
    });
  }

  /* ---------- quiz ---------- */
  function viewQuiz(m) {
    var qs = shuffle(m.quiz);
    var i = 0, correct = 0, selected = [], submitted = false;
    function render() {
      if (i >= qs.length) return renderResult();
      var q = qs[i];
      var multi = !!q.multi;
      var h = moduleHeader(m) +
        '<div class="quiz-progress">Question ' + (i + 1) + " of " + qs.length + " · " + correct + " correct so far" + (multi ? " · <strong>select " + q.answer.length + "</strong>" : "") + "</div>" +
        '<div class="q-text">' + esc(q.q) + "</div>";
      q.options.forEach(function (o, oi) {
        var cls = "opt";
        if (submitted) {
          if (q.answer.indexOf(oi) >= 0) cls += " correct";
          else if (selected.indexOf(oi) >= 0) cls += " wrong";
        } else if (selected.indexOf(oi) >= 0) cls += " sel";
        h += '<div class="' + cls + '" data-oi="' + oi + '"><span class="letter">' + letters(oi) + "</span><span>" + esc(o) + "</span></div>";
      });
      if (submitted) {
        var ok = sameSet(selected, q.answer);
        h += '<div class="explain' + (ok ? "" : " bad") + '"><strong>' + (ok ? "Correct." : "Not quite.") + "</strong> " + q.explanation + "</div>" +
          '<button class="primary" id="nextq">' + (i === qs.length - 1 ? "See results" : "Next question") + "</button>";
      } else {
        h += '<button class="primary" id="submitq"' + (selected.length ? "" : " disabled") + ">Check answer</button>";
      }
      mainEl.innerHTML = h;
      if (!submitted) {
        mainEl.querySelectorAll(".opt").forEach(function (opt) {
          opt.onclick = function () {
            var oi = +opt.getAttribute("data-oi");
            if (multi) {
              var p = selected.indexOf(oi);
              if (p >= 0) selected.splice(p, 1); else selected.push(oi);
            } else selected = [oi];
            render();
          };
        });
        var sb = document.getElementById("submitq");
        if (sb) sb.onclick = function () {
          submitted = true;
          if (sameSet(selected, qs[i].answer)) correct++;
          render();
        };
      } else {
        document.getElementById("nextq").onclick = function () {
          i++; selected = []; submitted = false; render();
        };
      }
    }
    function renderResult() {
      var pct = Math.round(100 * correct / qs.length);
      var best = S.quizBest[m.id] || 0;
      if (pct > best) S.quizBest[m.id] = pct;
      if (!S.quizAttempts[m.id]) S.quizAttempts[m.id] = [];
      S.quizAttempts[m.id].push({ date: new Date().toISOString(), pct: pct });
      save();
      var h = moduleHeader(m) +
        '<div class="card center"><div class="score-big ' + (pct >= 80 ? "pass" : "fail") + '">' + pct + "%</div>" +
        "<p>" + correct + " / " + qs.length + " correct" + (pct > best ? " · new personal best" : " · best: " + Math.max(best, pct) + "%") + "</p>" +
        '<p class="muted" style="margin-top:0.5rem">' + (pct >= 80 ? "Solid. Move on — spaced review will keep it fresh." : "Aim for 80%+ before moving on. Reread the lessons the misses came from.") + "</p>" +
        '<div class="row" style="justify-content:center;margin-top:1rem">' +
        '<a class="btn primary" href="#/module/' + m.id + '/quiz" onclick="location.reload()">Retake quiz</a>' +
        '<a class="btn" href="#/module/' + m.id + '">Back to module</a></div></div>';
      mainEl.innerHTML = h;
    }
    render();
  }
  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var s = a.slice().sort().join(","), t = b.slice().sort().join(",");
    return s === t;
  }

  /* ---------- flashcards ---------- */
  function viewCards(m) { runCards(dueCards(m.id), m, "#/module/" + m.id); }
  function viewGlobalReview() { runCards(dueCards(null), null, "#/"); }
  function runCards(queue, m, backHref) {
    var total = queue.length, done = 0, flipped = false;
    function render() {
      var title = m ? esc(m.title) + " — flashcards" : "Flashcard review — all due cards";
      if (!queue.length) {
        mainEl.innerHTML = '<h2 class="page-title">' + title + "</h2>" +
          '<div class="card center"><p style="font-size:1.2rem;margin:1rem 0">' + (total ? "Session done — " + total + " cards reviewed." : "Nothing due right now.") + "</p>" +
          '<p class="muted">Cards you marked “again” come back tomorrow; “good” and “easy” push them further out (Leitner boxes: 1, 3, 7, 14 days).</p>' +
          '<p style="margin-top:1rem"><a class="btn primary" href="' + backHref + '">Done</a></p></div>';
        return;
      }
      var cur = queue[0];
      var h = '<h2 class="page-title">' + title + "</h2>" +
        '<p class="page-sub">' + (done) + " reviewed · " + queue.length + " remaining" + (m ? "" : " · " + esc(cur.m.title)) + "</p>" +
        '<div class="fcard" id="fcard"><div class="side-label">' + (flipped ? "Answer" : "Prompt — click to flip") + "</div><div>" + (flipped ? cur.c.back : esc(cur.c.front)) + "</div></div>";
      if (flipped) {
        h += '<div class="fcard-actions">' +
          '<button class="again" data-g="again">Again (tomorrow)</button>' +
          '<button class="good" data-g="good">Good</button>' +
          '<button class="easy" data-g="easy">Easy</button></div>';
      } else {
        h += '<p class="center muted">Click the card or press <kbd>space</kbd> to reveal.</p>';
      }
      mainEl.innerHTML = h;
      document.getElementById("fcard").onclick = function () { flipped = true; render(); };
      mainEl.querySelectorAll(".fcard-actions button").forEach(function (b) {
        b.onclick = function () {
          gradeCard(cur.m, cur.i, b.getAttribute("data-g"));
          if (b.getAttribute("data-g") === "again") queue.push(queue.shift());
          else { queue.shift(); done++; }
          flipped = false;
          render();
        };
      });
    }
    function keyHandler(e) {
      if (e.code === "Space" && !flipped && queue.length) { e.preventDefault(); flipped = true; render(); }
    }
    document.addEventListener("keydown", keyHandler);
    cleanup = function () { document.removeEventListener("keydown", keyHandler); };
    render();
  }

  /* ---------- notes ---------- */
  var noteFilter = "all";
  function viewNotes() {
    var notes = (S.notes || []).slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    var open = notes.filter(function (n) { return !n.learned; }).length;
    mainEl.innerHTML = '<h2 class="page-title">My notes</h2>' +
      '<p class="page-sub">A capture net for things you spot and don’t want to lose — concepts to learn properly, gotchas to remember. Select any text in the course and hit “Save note”, or jot one down here. Mark a note learned once it has actually stuck.</p>';

    var addCard = el('<div class="card"><textarea class="io note-input" id="newnote" placeholder="Something to keep in mind or learn later…"></textarea>' +
      '<p style="margin-top:0.6rem"><button id="addnote" class="primary">Add note</button> <span class="muted">or press <kbd>Ctrl/⌘ + Enter</kbd></span></p></div>');
    mainEl.appendChild(addCard);
    var ta = addCard.querySelector("#newnote");
    function submitNew() {
      if (!ta.value.trim()) return;
      addNote(ta.value, "", "");
      viewNotes();
      var again = document.getElementById("newnote");
      if (again) again.focus();
    }
    addCard.querySelector("#addnote").onclick = submitNew;
    ta.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submitNew();
    });

    if (!notes.length) {
      mainEl.appendChild(el('<div class="card center"><p class="muted" style="padding:0.8rem 0">No notes yet. When something in a lesson makes you think “I need to come back to this”, select it and hit <strong>Save note</strong> — it lands here instead of getting lost.</p></div>'));
      return;
    }

    var chips = el('<div class="w-chip-row" style="margin:0.4rem 0 0.9rem">' +
      '<span class="w-chip" data-f="all">All (' + notes.length + ')</span>' +
      '<span class="w-chip" data-f="open">To learn (' + open + ')</span>' +
      '<span class="w-chip" data-f="learned">Learned (' + (notes.length - open) + ')</span></div>');
    chips.querySelectorAll(".w-chip").forEach(function (c) {
      c.classList.toggle("sel", c.getAttribute("data-f") === noteFilter);
      c.onclick = function () { noteFilter = c.getAttribute("data-f"); viewNotes(); };
    });
    mainEl.appendChild(chips);

    var shown = notes.filter(function (n) {
      if (noteFilter === "open") return !n.learned;
      if (noteFilter === "learned") return !!n.learned;
      return true;
    });
    if (!shown.length) {
      mainEl.appendChild(el('<div class="card"><p class="muted">Nothing under this filter.</p></div>'));
      return;
    }
    shown.forEach(function (n) { mainEl.appendChild(noteCard(n)); });
  }

  function noteCard(n) {
    var when = new Date(n.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    var card = el('<div class="card note-card' + (n.learned ? " learned" : "") + '">' +
      '<div class="note-text">' + esc(n.text) + "</div>" +
      '<div class="note-meta">' + esc(when) +
      (n.ctx ? " · from " + (n.href ? '<a href="' + esc(n.href) + '">' + esc(n.ctx) + "</a>" : esc(n.ctx)) : "") +
      (n.learned ? ' · <span class="note-learned-tag">learned ✓</span>' : "") + "</div>" +
      '<div class="note-actions">' +
      '<button class="learnbtn">' + (n.learned ? "Back to “to learn”" : "✓ Got it — learned") + "</button>" +
      '<button class="editbtn">Edit</button>' +
      '<button class="delbtn danger">Delete</button></div></div>');
    card.querySelector(".learnbtn").onclick = function () {
      n.learned = !n.learned;
      save();
      viewNotes();
    };
    card.querySelector(".delbtn").onclick = function () {
      if (!confirm("Delete this note?")) return;
      S.notes = S.notes.filter(function (x) { return x.id !== n.id; });
      save();
      viewNotes();
    };
    card.querySelector(".editbtn").onclick = function () {
      var ed = el('<div><textarea class="io note-input">' + esc(n.text) + "</textarea>" +
        '<p style="margin-top:0.5rem"><button class="primary savebtn">Save</button> <button class="cancelbtn">Cancel</button></p></div>');
      card.querySelector(".note-text").replaceWith(ed);
      card.querySelector(".note-actions").style.display = "none";
      var tb = ed.querySelector("textarea");
      tb.focus();
      tb.setSelectionRange(tb.value.length, tb.value.length);
      ed.querySelector(".savebtn").onclick = function () {
        var v = tb.value.trim();
        if (v) { n.text = v; save(); }
        viewNotes();
      };
      ed.querySelector(".cancelbtn").onclick = function () { viewNotes(); };
    };
    return card;
  }

  /* ---------- lab ---------- */
  function viewLab(m) {
    if (!m.lab) return viewModule(m);
    mainEl.innerHTML = '<p class="muted"><a href="#/module/' + m.id + '">' + esc(m.title) + "</a> · Hands-on lab</p>" +
      '<h2 class="page-title">' + esc(m.lab.title) + "</h2>" +
      '<div class="callout war">Labs create real AWS resources. Every lab ends with a teardown section — run it. Set a billing alarm before you start (covered in the cost module).</div>' +
      '<div class="lesson-body">' + m.lab.html + "</div>" +
      '<p style="margin-top:1.5rem"><a class="btn" href="#/module/' + m.id + '">Back to module</a></p>';
  }

  /* ---------- interactive: diagrams ---------- */
  function edgeKey(e) { return e.from + "->" + e.to; }
  function renderDiagram(d, container) {
    var wrap = el('<div class="diagram-wrap"><div class="diagram-svgbox"></div></div>');
    var nodeById = {};
    d.nodes.forEach(function (n) { nodeById[n.id] = n; });
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + d.w + " " + d.h);
    svg.innerHTML = '<defs><marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#b3a488"></path></marker></defs>';
    // zones first (background), then edges, then nodes
    var zones = d.nodes.filter(function (n) { return n.zone; });
    var boxes = d.nodes.filter(function (n) { return !n.zone; });
    var edgeEls = {}, nodeEls = {};
    function anchor(a, b) {
      // pick side of node a facing node b
      var ax = a.x + a.w / 2, ay = a.y + a.h / 2;
      var bx = b.x + b.w / 2, by = b.y + b.h / 2;
      var dx = bx - ax, dy = by - ay;
      if (Math.abs(dx) * a.h > Math.abs(dy) * a.w) {
        return { x: dx > 0 ? a.x + a.w : a.x, y: ay };
      }
      return { x: ax, y: dy > 0 ? a.y + a.h : a.y };
    }
    function drawNode(n) {
      var g = document.createElementNS(svgNS, "g");
      g.setAttribute("class", "dg-node" + (n.zone ? " zone" : "") + (n.color ? " c-" + n.color : ""));
      var r = document.createElementNS(svgNS, "rect");
      r.setAttribute("x", n.x); r.setAttribute("y", n.y);
      r.setAttribute("width", n.w); r.setAttribute("height", n.h);
      r.setAttribute("rx", 8);
      g.appendChild(r);
      var t = document.createElementNS(svgNS, "text");
      t.setAttribute("text-anchor", n.zone ? "start" : "middle");
      t.setAttribute("x", n.zone ? n.x + 10 : n.x + n.w / 2);
      t.setAttribute("y", n.zone ? n.y + 16 : n.y + n.h / 2 + (n.sub ? -3 : 4));
      t.textContent = n.label;
      g.appendChild(t);
      if (n.sub && !n.zone) {
        var s = document.createElementNS(svgNS, "text");
        s.setAttribute("class", "sub");
        s.setAttribute("text-anchor", "middle");
        s.setAttribute("x", n.x + n.w / 2);
        s.setAttribute("y", n.y + n.h / 2 + 12);
        s.textContent = n.sub;
        g.appendChild(s);
      }
      svg.appendChild(g);
      nodeEls[n.id] = g;
      if (!n.zone) g.addEventListener("click", function () { showInfo(n.label, n.info || ""); });
    }
    zones.forEach(drawNode);
    (d.edges || []).forEach(function (e) {
      var a = nodeById[e.from], b = nodeById[e.to];
      if (!a || !b) return;
      var p1 = anchor(a, b), p2 = anchor(b, a);
      var path = document.createElementNS(svgNS, "path");
      path.setAttribute("class", "dg-edge" + (e.dashed ? " dashed" : ""));
      var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      path.setAttribute("d", "M " + p1.x + " " + p1.y + " Q " + mx + " " + my + " " + p2.x + " " + p2.y);
      svg.appendChild(path);
      edgeEls[edgeKey(e)] = path;
      if (e.label) {
        var lt = document.createElementNS(svgNS, "text");
        lt.setAttribute("class", "dg-edge-label");
        lt.setAttribute("text-anchor", "middle");
        lt.setAttribute("x", mx); lt.setAttribute("y", my - 5);
        lt.textContent = e.label;
        svg.appendChild(lt);
      }
    });
    boxes.forEach(drawNode);
    wrap.querySelector(".diagram-svgbox").appendChild(svg);

    var info = el('<div class="dg-info"><div class="dg-info-title"></div><div class="dg-info-body muted">Click any component to see what it does' + ((d.flows || []).length ? ", or press Play to step through a flow." : ".") + "</div></div>");
    wrap.appendChild(info);
    function showInfo(title, body) {
      info.querySelector(".dg-info-title").textContent = title;
      info.querySelector(".dg-info-body").innerHTML = body;
      info.querySelector(".dg-info-body").classList.remove("muted");
    }
    function clearLit() {
      Object.keys(nodeEls).forEach(function (k) { nodeEls[k].classList.remove("lit"); });
      Object.keys(edgeEls).forEach(function (k) { edgeEls[k].classList.remove("lit"); });
    }

    if ((d.flows || []).length) {
      var flowIdx = 0, stepIdx = -1;
      var ctrls = el('<div class="dg-controls"></div>');
      var chips = null;
      if (d.flows.length > 1) {
        chips = el('<div class="w-chip-row"></div>');
        d.flows.forEach(function (f, i) {
          var c = el('<span class="w-chip' + (i === 0 ? " sel" : "") + '">' + esc(f.title) + "</span>");
          c.onclick = function () {
            flowIdx = i; stepIdx = -1; clearLit();
            chips.querySelectorAll(".w-chip").forEach(function (x, j) { x.classList.toggle("sel", j === i); });
            update();
          };
          chips.appendChild(c);
        });
        wrap.appendChild(chips);
      }
      var prevB = el('<button>❮ Back</button>');
      var nextB = el('<button class="primary">Play ❯</button>');
      var pill = el('<span class="dg-step-pill"></span>');
      var ftitle = el('<span class="flow-title"></span>');
      ctrls.appendChild(nextB); ctrls.appendChild(prevB); ctrls.appendChild(pill); ctrls.appendChild(ftitle);
      wrap.appendChild(ctrls);
      function update() {
        var flow = d.flows[flowIdx];
        ftitle.textContent = flow.title;
        pill.textContent = (stepIdx + 1) + " / " + flow.steps.length;
        prevB.disabled = stepIdx < 0;
        nextB.textContent = stepIdx < 0 ? "Play ❯" : (stepIdx >= flow.steps.length - 1 ? "Restart" : "Next ❯");
        clearLit();
        if (stepIdx >= 0) {
          var st = flow.steps[stepIdx];
          (st.lit || []).forEach(function (k) {
            if (nodeEls[k]) nodeEls[k].classList.add("lit");
            if (edgeEls[k]) edgeEls[k].classList.add("lit");
          });
          showInfo(flow.title + " — step " + (stepIdx + 1), st.text);
        }
      }
      nextB.onclick = function () {
        var flow = d.flows[flowIdx];
        stepIdx = stepIdx >= flow.steps.length - 1 ? 0 : stepIdx + 1;
        update();
      };
      prevB.onclick = function () { if (stepIdx >= 0) { stepIdx--; update(); if (stepIdx < 0) { clearLit(); } } };
      update();
    }
    container.appendChild(wrap);
  }

  /* ---------- interactive: widgets ---------- */
  function mountWidgetCard(w, container) {
    var card = el('<div class="widget-card"><h3>' + esc(w.title) + '</h3><div class="widget-sub">' + esc(w.sub || "") + '</div><div class="widget-body"></div></div>');
    container.appendChild(card);
    try {
      w.render(card.querySelector(".widget-body"));
    } catch (e) {
      card.querySelector(".widget-body").innerHTML = '<p class="muted">Widget failed to load: ' + esc(e.message) + "</p>";
    }
  }

  function viewModulePlay(m) {
    var h = '<p class="muted"><a href="#/module/' + m.id + '">' + esc(m.title) + "</a> · Interactive</p>" +
      '<h2 class="page-title">Interactive: ' + esc(m.title) + "</h2>" +
      '<p class="page-sub">Diagrams to click and flows to step through, plus simulators to play with. Break things — it is the fastest way to learn them.</p>';
    mainEl.innerHTML = h;
    var ds = moduleDiagrams(m.id), ws = moduleWidgets(m.id);
    ds.forEach(function (d) {
      mainEl.appendChild(el('<h3 style="margin:1.2rem 0 0.4rem">' + esc(d.title) + '</h3>' + (d.sub ? '<p class="muted" style="margin-bottom:0.4rem">' + esc(d.sub) + "</p>" : "")));
      renderDiagram(d, mainEl);
    });
    ws.forEach(function (w) { mountWidgetCard(w, mainEl); });
    if (!ds.length && !ws.length) mainEl.appendChild(el('<div class="card"><p class="muted">No interactive content for this module yet.</p></div>'));
    mainEl.appendChild(el('<p style="margin-top:1.5rem"><a class="btn" href="#/module/' + m.id + '">Back to module</a> <a class="btn" href="#/module/' + m.id + '/quiz">Take the quiz →</a></p>'));
  }

  function viewPlayground() {
    mainEl.innerHTML = '<h2 class="page-title">Playground</h2>' +
      '<p class="page-sub">Every simulator in the course, in one place. Each one links back to its module for the theory.</p>';
    var byModule = {};
    WIDGETS.forEach(function (w) {
      (byModule[w.moduleId] = byModule[w.moduleId] || []).push(w);
    });
    MODULES.forEach(function (m) {
      var ws = byModule[m.id];
      if (!ws) return;
      mainEl.appendChild(el('<h3 style="margin:1.4rem 0 0.5rem">' + String(m.order).padStart(2, "0") + " · <a href=\"#/module/" + m.id + "\">" + esc(m.title) + "</a></h3>"));
      ws.forEach(function (w) { mountWidgetCard(w, mainEl); });
    });
    if (!WIDGETS.length) mainEl.appendChild(el('<div class="card"><p class="muted">No simulators loaded.</p></div>'));
  }

  /* ---------- exam ---------- */
  function viewExam(eid) {
    var e = exam(eid);
    if (!e) return viewDashboard();
    var attempts = S.examAttempts.filter(function (a) { return a.examId === eid; });
    var h = '<h2 class="page-title">' + esc(e.title) + ' <span class="tag ' + e.track + '">' + e.track + "</span></h2>" +
      '<p class="page-sub">' + e.questions.length + " questions · " + e.timeMinutes + " minutes · pass bar ~" + PASS_MARK + "% (AWS uses scaled 720/1000)</p>" +
      '<div class="card"><h3>Rules of engagement</h3><ul style="margin-left:1.3rem">' +
      "<li>Timed. The timer keeps running — just like the real thing.</li>" +
      "<li>Flag questions and come back; unanswered counts as wrong.</li>" +
      "<li>No explanations until you submit. Review every question afterwards, including the ones you got right.</li>" +
      "<li>Closing the tab abandons the attempt.</li></ul>" +
      '<p style="margin-top:1rem"><button class="primary" id="startexam">Start timed exam</button></p></div>';
    if (attempts.length) {
      h += '<div class="card"><h3>Previous attempts</h3>';
      attempts.slice().reverse().forEach(function (a) {
        h += '<div class="domain-row"><span class="dname">' + a.date.slice(0, 10) + " · " + fmtTime(a.durationSec || 0) + '</span>' +
          '<span class="bar"><i class="' + (a.pct >= PASS_MARK ? "green" : "") + '" style="width:' + a.pct + '%"></i></span><span class="dpct">' + a.pct + "%</span></div>";
      });
      h += "</div>";
    }
    mainEl.innerHTML = h;
    document.getElementById("startexam").onclick = function () { runExam(e); };
  }

  function runExam(e) {
    var qs = shuffle(e.questions);
    var answers = qs.map(function () { return []; });
    var flags = qs.map(function () { return false; });
    var cur = 0;
    var remaining = e.timeMinutes * 60;
    var started = Date.now();
    var timerEl = null;
    var interval = setInterval(function () {
      remaining--;
      if (timerEl) {
        timerEl.textContent = fmtTime(Math.max(0, remaining));
        timerEl.classList.toggle("low", remaining < 300);
      }
      if (remaining <= 0) { finish(); }
    }, 1000);
    cleanup = function () { clearInterval(interval); };

    function render() {
      var q = qs[cur];
      var multi = !!q.multi;
      var h = '<div class="exam-topbar"><strong>' + esc(e.title) + "</strong>" +
        '<span class="muted">Q ' + (cur + 1) + "/" + qs.length + (multi ? " · select " + q.answer.length : "") + "</span>" +
        '<span class="spacer"></span><span class="exam-timer" id="timer">' + fmtTime(remaining) + "</span>" +
        '<button id="finishbtn" class="danger">Finish & score</button></div>';
      h += '<div class="q-text">' + esc(q.q) + "</div>";
      q.options.forEach(function (o, oi) {
        var cls = "opt" + (answers[cur].indexOf(oi) >= 0 ? " sel" : "");
        h += '<div class="' + cls + '" data-oi="' + oi + '"><span class="letter">' + letters(oi) + "</span><span>" + esc(o) + "</span></div>";
      });
      h += '<div class="row" style="margin-top:1rem">' +
        '<button id="prevq"' + (cur === 0 ? " disabled" : "") + ">← Prev</button>" +
        '<button id="flagq">' + (flags[cur] ? "⚑ Unflag" : "⚑ Flag for review") + "</button>" +
        '<button id="nextq" class="primary"' + (cur === qs.length - 1 ? " disabled" : "") + ">Next →</button></div>";
      h += '<div class="qnav">';
      qs.forEach(function (_, qi) {
        var cls = [];
        if (qi === cur) cls.push("current");
        else {
          if (answers[qi].length) cls.push("answered");
          if (flags[qi]) cls.push("flagged");
        }
        h += '<button class="' + cls.join(" ") + '" data-qi="' + qi + '">' + (qi + 1) + "</button>";
      });
      h += "</div>";
      mainEl.innerHTML = h;
      timerEl = document.getElementById("timer");
      mainEl.querySelectorAll(".opt").forEach(function (opt) {
        opt.onclick = function () {
          var oi = +opt.getAttribute("data-oi");
          var sel = answers[cur];
          if (multi) {
            var p = sel.indexOf(oi);
            if (p >= 0) sel.splice(p, 1); else sel.push(oi);
          } else answers[cur] = [oi];
          render();
        };
      });
      document.getElementById("prevq").onclick = function () { if (cur > 0) { cur--; render(); } };
      document.getElementById("nextq").onclick = function () { if (cur < qs.length - 1) { cur++; render(); } };
      document.getElementById("flagq").onclick = function () { flags[cur] = !flags[cur]; render(); };
      document.getElementById("finishbtn").onclick = function () {
        var unanswered = answers.filter(function (a) { return !a.length; }).length;
        if (unanswered && remaining > 0 && !confirm(unanswered + " unanswered question(s) will count as wrong. Finish anyway?")) return;
        finish();
      };
      mainEl.querySelectorAll(".qnav button").forEach(function (b) {
        b.onclick = function () { cur = +b.getAttribute("data-qi"); render(); };
      });
    }

    function finish() {
      clearInterval(interval);
      var correct = 0;
      var domains = {};
      qs.forEach(function (q, qi) {
        var d = q.domain || "General";
        if (!domains[d]) domains[d] = { correct: 0, total: 0 };
        domains[d].total++;
        if (sameSet(answers[qi], q.answer)) { correct++; domains[d].correct++; }
      });
      var pct = Math.round(100 * correct / qs.length);
      var durationSec = Math.round((Date.now() - started) / 1000);
      S.examAttempts.push({ examId: e.id, date: new Date().toISOString(), pct: pct, domains: domains, durationSec: durationSec });
      save();
      var h = '<h2 class="page-title">' + esc(e.title) + " — result</h2>" +
        '<div class="card center"><div class="score-big ' + (pct >= PASS_MARK ? "pass" : "fail") + '">' + pct + "%</div>" +
        "<p>" + correct + " / " + qs.length + " correct · " + fmtTime(durationSec) + " · " + (pct >= PASS_MARK ? "would likely pass" : "below the ~" + PASS_MARK + "% bar — keep drilling") + "</p></div>";
      h += '<div class="card"><h3>Score by domain</h3>';
      Object.keys(domains).forEach(function (d) {
        var dd = domains[d];
        var dp = Math.round(100 * dd.correct / dd.total);
        h += '<div class="domain-row"><span class="dname">' + esc(d) + '</span><span class="bar"><i class="' + (dp >= PASS_MARK ? "green" : "") + '" style="width:' + dp + '%"></i></span><span class="dpct">' + dp + "%</span></div>";
      });
      h += '<p class="muted" style="margin-top:0.6rem">Domains under ' + PASS_MARK + "% are where your next study hours go.</p></div>";
      h += '<h3 style="margin:1.5rem 0 0.8rem">Review all questions</h3>';
      qs.forEach(function (q, qi) {
        var ok = sameSet(answers[qi], q.answer);
        h += '<div class="card"><p class="muted">' + (qi + 1) + " · " + esc(q.domain || "General") + " · " + (ok ? '<span style="color:var(--green)">correct</span>' : '<span style="color:var(--red)">wrong</span>') + "</p>" +
          '<div class="q-text">' + esc(q.q) + "</div>";
        q.options.forEach(function (o, oi) {
          var cls = "opt";
          if (q.answer.indexOf(oi) >= 0) cls += " correct";
          else if (answers[qi].indexOf(oi) >= 0) cls += " wrong";
          h += '<div class="' + cls + '"><span class="letter">' + letters(oi) + "</span><span>" + esc(o) + "</span></div>";
        });
        h += '<div class="explain' + (ok ? "" : " bad") + '">' + q.explanation + "</div></div>";
      });
      h += '<p><a class="btn primary" href="#/exam/' + e.id + '">Back to exam page</a> <a class="btn" href="#/">Dashboard</a></p>';
      mainEl.innerHTML = h;
      window.scrollTo(0, 0);
    }
    render();
  }

  /* ---------- settings ---------- */
  function viewSettings() {
    var cfg = syncCfg();
    var fbCard = "";
    if (window.FIREBASE_CONFIG) {
      fbCard = '<div class="card"><h3>Cloud sync (Google account)</h3>' +
        (fbUser
          ? '<p class="muted" id="fbstate">Signed in as <strong>' + esc(fbUser.displayName || fbUser.email || fbUser.uid) + '</strong> — progress auto-syncs a few seconds after every change. <span id="syncstate">' + esc(syncState) + "</span></p>" +
            '<p style="margin-top:0.6rem"><button id="fbpush" class="primary">Sync now</button> <button id="fbout" class="danger">Sign out</button></p>'
          : '<p class="muted" id="fbstate">Sign in once on each device and your progress follows you automatically. Nothing else to configure.</p>' +
            '<p style="margin-top:0.6rem"><button id="fbin" class="primary">Sign in with Google</button></p>') +
        "</div>";
    }
    var ai = (window.ASKAI && window.ASKAI.getCfg()) || null;
    var aiCard = '<div class="card"><h3>AI assistant (OpenAI)</h3>' +
      (window.ASKAI_PROXY_URL
        ? '<p class="muted">App-wide AI is <strong>enabled</strong> via a secure proxy — the key lives server-side, not in any browser. Just be signed in (Google, above) on each device and the Ask AI features work everywhere. No key to paste.</p>'
        : ai
        ? '<p class="muted">Connected (model: <code>' + esc(ai.model || "gpt-4o-mini") + '</code>). Select any text or hit the Ask AI button, then click anything on a page.</p>' +
          '<p style="margin-top:0.6rem"><button id="aioff" class="danger">Remove key</button></p>'
        : '<p class="muted">Paste an OpenAI API key to unlock ask-anything: select text or click any element in the course and question it. The key stays in this browser only — never in progress exports or sync. Use a key with a spending limit.</p>' +
          '<p style="margin-top:0.6rem"><input type="password" id="aikey" placeholder="sk-…" style="width:46%;max-width:340px"> ' +
          '<input type="text" id="aimodel" value="gpt-4o-mini" title="model" style="width:150px"> ' +
          '<button id="aion" class="primary">Save</button></p>') +
      "</div>";
    var h = '<h2 class="page-title">Settings & data</h2>' +
      '<p class="page-sub">Progress lives in this browser’s localStorage' + (window.FIREBASE_CONFIG ? ", auto-synced to the cloud when you sign in." : " — and can auto-sync across devices via a private GitHub Gist.") + "</p>" +
      aiCard +
      fbCard +
      '<div class="card"><h3>' + (window.FIREBASE_CONFIG ? "Alternative: sync via GitHub Gist" : "Cloud sync (GitHub Gist)") + "</h3>" +
      (cfg
        ? '<p class="muted">Connected — progress auto-syncs a few seconds after every change. <span id="syncstate">' + esc(syncState || (cfg.lastSync ? "last synced " + new Date(cfg.lastSync).toLocaleString() : "idle")) + "</span></p>" +
          '<p style="margin-top:0.6rem"><button id="syncnow" class="primary">Sync now</button> <button id="syncpull">Pull from gist</button> <button id="syncoff" class="danger">Disconnect</button></p>'
        : '<p class="muted">Store progress in a <strong>private gist</strong> on your GitHub account so every device stays in sync. Create a fine-grained personal access token with ONLY the <strong>gist</strong> scope (github.com → Settings → Developer settings → Tokens), paste it here. The token stays in this browser and is never included in exports.</p>' +
          '<p style="margin-top:0.6rem"><input type="password" id="ghtoken" placeholder="github_pat_… or ghp_…" style="width:60%;max-width:420px"> <button id="syncon" class="primary">Connect</button></p>' +
          '<p class="muted" id="syncstatus" style="margin-top:0.4rem"></p>') +
      "</div>" +
      '<div class="card"><h3>Export progress</h3><p class="muted">Copy this JSON somewhere safe.</p>' +
      '<textarea class="io" id="exportbox" readonly>' + esc(JSON.stringify(S)) + "</textarea>" +
      '<p style="margin-top:0.6rem"><button id="copybtn">Copy to clipboard</button></p></div>' +
      '<div class="card"><h3>Import progress</h3><p class="muted">Paste previously exported JSON. Replaces current progress.</p>' +
      '<textarea class="io" id="importbox" placeholder="Paste exported JSON here"></textarea>' +
      '<p style="margin-top:0.6rem"><button id="importbtn" class="primary">Import</button></p></div>' +
      '<div class="card"><h3>Danger zone</h3><p class="muted">Wipe all progress — lessons, quiz scores, exam attempts, flashcard scheduling, notes.</p>' +
      '<p style="margin-top:0.6rem"><button id="resetbtn" class="danger">Reset everything</button></p></div>';
    mainEl.innerHTML = h;
    var aion = document.getElementById("aion"), aioff = document.getElementById("aioff");
    if (aion) aion.onclick = function () {
      var k = document.getElementById("aikey").value.trim();
      var mdl = document.getElementById("aimodel").value.trim() || "gpt-4o-mini";
      if (!k) return alert("Paste a key first.");
      window.ASKAI.setCfg({ key: k, model: mdl });
      viewSettings();
    };
    if (aioff) aioff.onclick = function () { window.ASKAI.setCfg(null); viewSettings(); };
    if (window.FIREBASE_CONFIG) {
      var fbin = document.getElementById("fbin"), fbout = document.getElementById("fbout"), fbpush = document.getElementById("fbpush");
      if (fbin) fbin.onclick = function () {
        fbin.textContent = "Loading…";
        loadFirebase().then(function () {
          return window.firebase.auth().signInWithPopup(new window.firebase.auth.GoogleAuthProvider());
        }).catch(function (e) { alert("Sign-in failed: " + e.message + "\n(Pop-up blocked? Allow pop-ups for this site.)"); viewSettings(); });
      };
      if (fbout) fbout.onclick = function () { window.firebase.auth().signOut().then(viewSettings); };
      if (fbpush) fbpush.onclick = fbPush;
    }
    if (cfg) {
      document.getElementById("syncnow").onclick = function () { pushSync(); };
      document.getElementById("syncpull").onclick = function () {
        pullSync(function (changed) {
          alert(changed ? "Pulled newer progress from the gist." : "Local progress is already up to date (or newer).");
          if (changed) { renderSidebar(); viewSettings(); }
        });
      };
      document.getElementById("syncoff").onclick = function () {
        if (confirm("Disconnect sync? The gist keeps its last copy; this browser keeps local progress.")) {
          setSyncCfg(null); viewSettings();
        }
      };
    } else {
      document.getElementById("syncon").onclick = function () {
        var tok = document.getElementById("ghtoken").value.trim();
        if (!tok) return alert("Paste a token first.");
        enableSync(tok, document.getElementById("syncstatus"), function (ok, changed) {
          if (ok) { renderSidebar(); viewSettings(); }
        });
      };
    }
    document.getElementById("copybtn").onclick = function () {
      var box = document.getElementById("exportbox");
      box.select();
      try { navigator.clipboard.writeText(box.value); } catch (err) { document.execCommand("copy"); }
      this.textContent = "Copied ✓";
    };
    document.getElementById("importbtn").onclick = function () {
      try {
        var d = JSON.parse(document.getElementById("importbox").value);
        if (typeof d !== "object" || d === null) throw new Error("not an object");
        S = d;
        var b = blankStore();
        for (var k in b) if (!(k in S)) S[k] = b[k];
        save();
        alert("Imported.");
        location.hash = "#/";
      } catch (err) { alert("Invalid JSON: " + err.message); }
    };
    document.getElementById("resetbtn").onclick = function () {
      if (confirm("Really wipe ALL progress? This cannot be undone.")) {
        S = blankStore();
        save();
        location.hash = "#/";
        route();
      }
    };
  }

  /* ================= boot ================= */
  if (!MODULES.length) {
    app.innerHTML = '<div class="boot">No course content loaded — check that content/modules/*.js are present and error-free (open the browser console).</div>';
    return;
  }
  shell();
  window.addEventListener("hashchange", route);
  route();
  if (window.FIREBASE_CONFIG) loadFirebase().catch(function (e) { setSyncState("cloud sync unavailable: " + e.message); });
  else if (syncCfg()) pullSync(function (changed) { if (changed) { renderSidebar(); route(); } });
})();
