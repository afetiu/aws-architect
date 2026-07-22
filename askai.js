/* Ask-AI: click/select anything in the course and ask the integrated LLM about it.
 * Config (OpenAI API key + model) lives in localStorage under 'awsarch-ai' and is
 * never included in progress exports. Calls go browser → api.openai.com directly. */
(function () {
  "use strict";

  var AI_KEY = "awsarch-ai";
  function cfg() {
    try { return JSON.parse(localStorage.getItem(AI_KEY)) || null; } catch (e) { return null; }
  }
  window.ASKAI = {
    getCfg: cfg,
    setCfg: function (c) {
      if (c && c.key) localStorage.setItem(AI_KEY, JSON.stringify(c));
      else localStorage.removeItem(AI_KEY);
    }
  };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function clamp(s, n) { s = (s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; }

  /* ---------- page context ---------- */
  function pageContext() {
    var t = document.querySelector(".main h2.page-title");
    var crumb = document.querySelector(".main .muted a");
    return clamp((crumb ? crumb.textContent + " · " : "") + (t ? t.textContent : "AWS Solutions Architect course"), 140);
  }

  /* ---------- popup ---------- */
  var popup = null, convo = [], contextText = "";
  function closePopup() {
    if (popup) { popup.remove(); popup = null; }
    convo = [];
  }
  function openPopup(context, x, y) {
    closePopup();
    hideChip();
    contextText = clamp(context, 900);
    popup = el('<div class="ask-popup" role="dialog" aria-label="Ask AI">' +
      '<div class="ask-head"><span>✨ Ask about this</span><button class="ask-x" title="Close (Esc)">✕</button></div>' +
      '<div class="ask-ctx">' + esc(clamp(contextText, 160)) + "</div>" +
      '<div class="ask-chips">' +
      '<span class="w-chip" data-q="Explain this simply.">Explain simply</span>' +
      '<span class="w-chip" data-q="Give one concrete example of this.">Example</span>' +
      '<span class="w-chip" data-q="How does the AWS certification exam test this? What are the trap answers?">Exam angle</span>' +
      '<span class="w-chip" data-q="Why does this matter in real production systems?">Why it matters</span>' +
      "</div>" +
      '<div class="ask-thread"></div>' +
      '<div class="ask-inputrow"><input type="text" class="ask-input" placeholder="Ask anything about it…"><button class="primary ask-send">Ask</button></div>' +
      "</div>");
    document.body.appendChild(popup);
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = Math.min(400, vw - 24);
    popup.style.width = w + "px";
    var left = Math.max(12, Math.min(x, vw - w - 12));
    var top = y + 10;
    popup.style.left = left + "px";
    popup.style.top = Math.min(top, vh - 220) + "px";

    popup.querySelector(".ask-x").onclick = closePopup;
    popup.querySelectorAll(".ask-chips .w-chip").forEach(function (c) {
      c.onclick = function () { send(c.getAttribute("data-q")); };
    });
    var input = popup.querySelector(".ask-input");
    popup.querySelector(".ask-send").onclick = function () { if (input.value.trim()) send(input.value.trim()); };
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && input.value.trim()) send(input.value.trim());
      e.stopPropagation();
    });
    input.focus();
  }

  function bubble(cls, html) {
    var thread = popup.querySelector(".ask-thread");
    var b = el('<div class="ask-msg ' + cls + '">' + html + "</div>");
    thread.appendChild(b);
    thread.scrollTop = thread.scrollHeight;
    return b;
  }

  /* Minimal safe formatting: escape, then **bold**, `code`, line breaks. */
  function fmt(s) {
    return esc(s)
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");
  }

  /* One call path, two modes: app-wide proxy (key lives server-side, gated by the
   * app's Google sign-in) or per-browser key from Settings. */
  function llmFetch(messages, model) {
    var proxy = window.ASKAI_PROXY_URL;
    if (proxy) {
      var fb = window.firebase;
      var user = fb && fb.auth && fb.auth().currentUser;
      if (!user) return Promise.reject(new Error("SIGNIN"));
      return user.getIdToken().then(function (tok) {
        return fetch(proxy, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + tok },
          body: JSON.stringify({ model: model, messages: messages })
        });
      });
    }
    var c = cfg();
    if (!c || !c.key) return Promise.reject(new Error("NOKEY"));
    return fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + c.key },
      body: JSON.stringify({ model: model, messages: messages })
    });
  }

  function send(question) {
    var c = cfg();
    if (!window.ASKAI_PROXY_URL && (!c || !c.key)) {
      bubble("ai", 'No API key configured yet. Add your OpenAI key in <a href="#/settings">Settings → AI assistant</a>, then come back.');
      return;
    }
    var input = popup.querySelector(".ask-input");
    input.value = "";
    bubble("me", esc(question));
    var pending = bubble("ai", '<span class="ask-spin"></span> thinking…');
    convo.push({ role: "user", content: question });

    var messages = [{
      role: "system",
      content: "You are an expert AWS solutions architect embedded as a tutor in a certification course. " +
        "The learner is a senior engineer (10 years experience). Answer in 2-4 sentences maximum — short, precise, no filler, no restating the question. " +
        "Use plain language; **bold** key terms sparingly. If genuinely uncertain or the topic may have changed recently, say so in a few words. " +
        "Current page: " + pageContext() + ". " +
        "The learner highlighted this content, which questions refer to unless stated otherwise:\n\"" + contextText + "\""
    }].concat(convo.slice(-8));

    llmFetch(messages, (c && c.model) || "gpt-4o-mini").then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (res) {
      if (!res.ok) {
        var msg = (res.j && res.j.error && res.j.error.message) || "request failed";
        pending.innerHTML = '<span class="ask-err">Error: ' + esc(clamp(msg, 220)) + "</span>";
        convo.pop();
        return;
      }
      var text = res.j.choices && res.j.choices[0] && res.j.choices[0].message && res.j.choices[0].message.content || "(empty response)";
      pending.innerHTML = fmt(text.trim());
      convo.push({ role: "assistant", content: text });
      popup.querySelector(".ask-thread").scrollTop = 1e6;
    }).catch(function (e) {
      if (e.message === "SIGNIN") pending.innerHTML = 'The AI assistant is enabled app-wide, but it needs you signed in — <a href="#/settings">Sign in with Google in Settings</a> and try again.';
      else if (e.message === "NOKEY") pending.innerHTML = 'No API key configured yet. Add one in <a href="#/settings">Settings → AI assistant</a>.';
      else pending.innerHTML = '<span class="ask-err">Network error: ' + esc(e.message) + "</span>";
      convo.pop();
    });
  }

  /* ---------- selection → floating chip ---------- */
  var chip = null;
  function hideChip() { if (chip) { chip.remove(); chip = null; } }
  document.addEventListener("mouseup", function (e) {
    if (popup && popup.contains(e.target)) return;
    setTimeout(function () {
      var sel = window.getSelection();
      var text = sel ? sel.toString().trim() : "";
      hideChip();
      if (!text || text.length < 3 || text.length > 1200) return;
      var main = document.querySelector(".main");
      if (!main || !sel.anchorNode || !main.contains(sel.anchorNode)) return;
      var rect = sel.getRangeAt(0).getBoundingClientRect();
      chip = el('<button class="ask-chipbtn">✨ Ask</button>');
      chip.style.left = Math.min(rect.left + rect.width / 2, window.innerWidth - 90) + "px";
      chip.style.top = Math.max(8, rect.top - 40) + "px";
      chip.onclick = function () {
        openPopup(text, rect.left, rect.bottom);
      };
      document.body.appendChild(chip);
    }, 10);
  });

  /* ---------- ask mode: click any element ---------- */
  var askMode = false;
  var fab = el('<button class="ask-fab" title="Ask mode: then click anything to ask about it">✨ Ask</button>');
  document.body.appendChild(fab);
  function setMode(on) {
    askMode = on;
    document.body.classList.toggle("askmode", on);
    fab.classList.toggle("on", on);
    fab.textContent = on ? "✨ Click anything…" : "✨ Ask";
  }
  fab.onclick = function () { setMode(!askMode); };
  document.addEventListener("click", function (e) {
    if (!askMode) return;
    if (fab.contains(e.target) || (popup && popup.contains(e.target))) return;
    var main = document.querySelector(".main");
    if (!main || !main.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    var t = e.target;
    // climb to a meaningful block if the target is tiny (a letter span, an svg shape)
    var hops = 0;
    while (t && t !== main && clamp(t.textContent || "", 40).length < 15 && hops < 4) { t = t.parentElement; hops++; }
    var text = clamp(t && t !== main ? t.textContent : e.target.textContent, 900);
    if (!text) return;
    setMode(false);
    openPopup(text, e.clientX, e.clientY);
  }, true);

  /* ---------- global dismissal ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closePopup(); hideChip(); setMode(false); }
  });
  document.addEventListener("mousedown", function (e) {
    if (popup && !popup.contains(e.target) && !(chip && chip.contains(e.target))) closePopup();
  });
  window.addEventListener("hashchange", function () { closePopup(); hideChip(); setMode(false); });
})();
