/* Journey store — same localStorage key and shape as the classic engine (app.js),
 * so existing progress carries over, plus the same Firebase live sync and the
 * Android SQLite bridge. Exposes window.JSTORE. */
(function () {
  "use strict";
  var META = window.COURSE_META;
  var STORE_KEY = META.storeKey;

  function blankStore() {
    return { lessons: {}, quizBest: {}, quizAttempts: {}, examAttempts: [], flash: {}, notes: [], resume: null, streak: { last: null, count: 0 }, checks: {}, journey: { at: null, seen: {} } };
  }
  function withDefaults(d) {
    var b = blankStore();
    for (var k in b) if (!(k in d)) d[k] = b[k];
    if (!d.journey.seen) d.journey.seen = {};
    return d;
  }
  function loadStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? withDefaults(JSON.parse(raw)) : blankStore();
    } catch (e) { return blankStore(); }
  }
  var S = loadStore();
  var listeners = [];

  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function touchStreak() {
    var t = todayStr();
    if (S.streak.last === t) return;
    var y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    S.streak.count = (S.streak.last === y) ? S.streak.count + 1 : 1;
    S.streak.last = t;
  }
  function save(quiet) {
    if (!quiet) touchStreak();
    S.savedAt = Date.now();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
    scheduleSync();
    scheduleNativeSave();
  }

  /* ---------- Android: on-device SQLite via the ProgressStore plugin ---------- */
  var NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  var NSTORE = NATIVE && window.Capacitor.registerPlugin ? window.Capacitor.registerPlugin("ProgressStore") : null;
  var nativeTimer = null;
  function scheduleNativeSave() { if (!NSTORE) return; clearTimeout(nativeTimer); nativeTimer = setTimeout(flushNative, 400); }
  function flushNative() {
    if (!NSTORE) return;
    clearTimeout(nativeTimer); nativeTimer = null;
    NSTORE.saveState({ course: META.id, json: JSON.stringify(S) }).catch(function (e) { console.error("SQLite save failed", e); });
  }
  if (NSTORE) {
    document.addEventListener("visibilitychange", function () { if (document.hidden && nativeTimer) flushNative(); });
    window.addEventListener("pagehide", function () { if (nativeTimer) flushNative(); });
  }
  function loadNative() {
    if (!NSTORE) return Promise.resolve();
    return NSTORE.loadState({ course: META.id }).then(function (r) {
      if (r && r.json) {
        var d = JSON.parse(r.json);
        if ((d.savedAt || 0) >= (S.savedAt || 0)) { S = withDefaults(d); localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
      } else if (S.savedAt) flushNative();
    }).catch(function (e) { console.error("SQLite load failed", e); });
  }

  /* ---------- Firebase live sync (identical protocol to app.js) ---------- */
  var fbUser = null, fbReady = null, fbUnsub = null, syncTimer = null, syncState = "";
  function setSyncState(s) { syncState = s; listeners.forEach(function (f) { f("sync", s); }); }
  function scheduleSync() { if (!fbUser) return; clearTimeout(syncTimer); syncTimer = setTimeout(fbPush, 600); }
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
            if (u) fbListen(); else if (fbUnsub) { fbUnsub(); fbUnsub = null; }
            setSyncState(u ? "syncing live" : "signed out");
            listeners.forEach(function (f) { f("auth", u); });
            if (first) { first = false; res(); }
          });
        });
      });
    return fbReady;
  }
  function fbDoc() { return window.firebase.firestore().collection("progress").doc(fbUser.uid); }
  function fbCourseData(d) {
    if (d.courses && d.courses[META.id]) return d.courses[META.id];
    if (META.id === "aws-architect" && d.data) return { data: d.data, savedAt: d.savedAt || 0 };
    return null;
  }
  function fbPush() {
    if (!fbUser) return;
    setSyncState("syncing…");
    var payload = { savedAt: Date.now(), courses: {} };
    payload.courses[META.id] = { data: JSON.stringify(S), savedAt: S.savedAt || Date.now() };
    fbDoc().set(payload, { merge: true })
      .then(function () { setSyncState("synced live · " + new Date().toLocaleTimeString()); })
      .catch(function (e) { setSyncState("sync failed: " + e.message); });
  }
  function fbListen() {
    if (fbUnsub) { fbUnsub(); fbUnsub = null; }
    if (!fbUser) return;
    fbUnsub = fbDoc().onSnapshot(function (snap) {
      if (snap.metadata && snap.metadata.hasPendingWrites) return;
      if (!snap.exists) { fbPush(); return; }
      var mine = fbCourseData(snap.data());
      if (!mine) { fbPush(); return; }
      if ((mine.savedAt || 0) > (S.savedAt || 0)) {
        S = withDefaults(JSON.parse(mine.data));
        localStorage.setItem(STORE_KEY, JSON.stringify(S));
        setSyncState("updated from another device · " + new Date().toLocaleTimeString());
        listeners.forEach(function (f) { f("remote", S); });
      } else if ((mine.savedAt || 0) < (S.savedAt || 0)) fbPush();
    }, function (e) { setSyncState("sync error: " + e.message); });
  }

  /* ---------- course helpers shared by every scene ---------- */
  var MODULES = window.COURSE.modules.slice().sort(function (a, b) {
    var ta = a.track === "saa" ? 0 : 1, tb = b.track === "saa" ? 0 : 1;
    return ta - tb || a.order - b.order;
  });
  var LEARN = {};
  (window.COURSE.learn || []).forEach(function (x) { LEARN[x.moduleId] = x; });
  function lessonKey(m, l) { return m.id + "/" + l.id; }
  function cardKey(m, i) { return m.id + "/" + i; }
  var BOX_DAYS = [0, 0, 1, 3, 7, 14];
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
  function moduleStarted(m) {
    return m.lessons.some(function (l) { return S.lessons[lessonKey(m, l)]; }) || !!S.quizBest[m.id];
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function dueCards(moduleFilter) {
    var out = [];
    MODULES.forEach(function (m) {
      if (moduleFilter && m.id !== moduleFilter) return;
      var started = moduleFilter || moduleStarted(m);
      (m.flashcards || []).forEach(function (c, i) {
        var seen = !!S.flash[cardKey(m, i)];
        if ((seen || started) && cardState(m, i).due <= Date.now()) out.push({ m: m, i: i, c: c });
      });
    });
    return shuffle(out);
  }
  function modulePct(m) {
    if (!m.lessons.length) return 0;
    return m.lessons.filter(function (l) { return S.lessons[lessonKey(m, l)]; }).length / m.lessons.length;
  }

  window.JSTORE = {
    get S() { return S; },
    save: save,
    reset: function () { S = blankStore(); save(); listeners.forEach(function (f) { f("remote", S); }); },
    on: function (fn) { listeners.push(fn); },
    MODULES: MODULES,
    LEARN: LEARN,
    lessonKey: lessonKey,
    cardKey: cardKey,
    cardState: cardState,
    gradeCard: gradeCard,
    dueCards: dueCards,
    moduleStarted: moduleStarted,
    modulePct: modulePct,
    shuffle: shuffle,
    native: NSTORE,
    flushNative: flushNative,
    loadNative: loadNative,
    hasCloud: !!window.FIREBASE_CONFIG && !NSTORE,
    get user() { return fbUser; },
    get syncState() { return syncState; },
    startCloud: function () { if (window.FIREBASE_CONFIG && !NSTORE) return loadFirebase().catch(function (e) { setSyncState("cloud sync unavailable: " + e.message); }); },
    signIn: function () {
      return loadFirebase().then(function () { return window.firebase.auth().signInWithPopup(new window.firebase.auth.GoogleAuthProvider()); });
    },
    signOut: function () { return window.firebase.auth().signOut(); }
  };
})();
