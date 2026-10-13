/* 4R022 - Founder Statement page: language gate, welcome intro, hero, overview, 10 chapters.
   Everything is rendered with textContent / createElement (no innerHTML). */
(function () {
  "use strict";
  var R4 = window.R4, h = R4.h, root = document.documentElement;
  var DATA = window.__4R_CONTENT || {};
  var main = document.getElementById("main");
  var observers = [], current = null, ticking = false, hero, progressBar, pill, railLinks = {}, chapterEls = [];

  function inline(tokens, parent) {
    tokens.forEach(function (tk) {
      if (tk[0] === "b") parent.appendChild(h("strong", { text: tk[1] }));
      else if (tk[0] === "i") parent.appendChild(h("em", { text: tk[1] }));
      else parent.appendChild(document.createTextNode(tk[1]));
    });
    return parent;
  }
  function img(src, cls, w, hh) { return h("img", { src: src, alt: "", width: String(w), height: String(hh), "class": cls, draggable: "false" }); }

  /* ---------------- hero + overview ---------------- */
  function buildHero(d) {
    var chips = h("ul", { "class": "chips" });
    d.disciplines.split(/\s*[·•]\s*/).forEach(function (c, i) {
      var li = h("li", { text: c }); li.style.setProperty("--i", String(i)); chips.appendChild(li);
    });
    return h("section", { id: "top", "class": "hero", "aria-labelledby": "hero-t" },
      h("div", { "class": "lbox top", "aria-hidden": "true" }), h("div", { "class": "lbox bot", "aria-hidden": "true" }),
      h("div", { "class": "beam", "aria-hidden": "true" }), h("div", { "class": "glow", "aria-hidden": "true" }),
      h("div", { "class": "hero-in" },
        h("h1", { id: "hero-t", "class": "sr-only", text: d.title + " · 4R022" }),
        img("assets/img/logo-wide.png", "hero-logo", 461, 150),
        h("p", { "class": "hero-sub", text: d.subtitle }),
        chips,
        h("p", { "class": "hero-motto", text: d.motto }),
        h("div", { "class": "hero-cta" },
          h("a", { "class": "cta", href: "#01", text: R4.t("enter") }),
          h("a", { "class": "cta ghost", href: "#toc", text: R4.t("tocTitle") }))),
      h("a", { "class": "cue", href: "#toc", "aria-label": R4.t("scroll") }, h("span", { text: R4.t("scroll") }), h("i", { "aria-hidden": "true" })));
  }

  function buildStats(d) {
    function stat(n, label) {
      return h("div", { "class": "stat" }, h("b", { "data-to": String(n), text: String(n) }), h("span", { text: label }));
    }
    return h("section", { "class": "stats", "aria-label": d.title },
      stat(R4.langs.length, R4.t("sLang")), stat(d.sections.length, R4.t("sArt")), stat(1, R4.t("sDoc")));
  }

  function buildTicker() {
    function items() {
      var f = document.createDocumentFragment();
      R4.langs.forEach(function (m) { f.appendChild(h("span", { "class": "tk" }, img("assets/flags/" + m.flag + ".svg", "flag", 24, 16), h("span", { text: m.native }))); });
      return f;
    }
    var track = h("div", { "class": "ticker-track" });
    track.appendChild(items()); track.appendChild(items());
    return h("div", { "class": "ticker", "aria-hidden": "true" }, track);
  }

  function buildToc(d) {
    var ol = h("ol", { "class": "toc-grid" });
    d.sections.forEach(function (s) {
      var a = h("a", { "class": "card", href: "#" + s.n },
        h("span", { "class": "card-n", "aria-hidden": "true", text: s.n }),
        h("span", { "class": "card-t", text: s.title }),
        h("span", { "class": "card-go", "aria-hidden": "true", text: "→" }));
      var li = h("li", { "class": "rv" }, a); li.style.setProperty("--i", String(Number(s.n) % 2)); ol.appendChild(li);
    });
    return h("section", { id: "toc", "class": "toc", "aria-labelledby": "toc-t" }, h("h2", { id: "toc-t", text: R4.t("tocTitle") }), ol);
  }

  /* ---------------- chapters ---------------- */
  function buildChapter(s, d, idx) {
    var head = h("div", { "class": "chapter-head" },
      h("span", { "class": "num", "aria-hidden": "true", text: s.n }),
      h("p", { "class": "counter", "aria-hidden": "true", text: s.n + " / " + String(d.sections.length).padStart(2, "0") }),
      h("h2", { id: "h" + s.n, "class": "ch-title" },
        h("span", { "class": "sr-only", text: R4.t("chapter") + " " + s.n + ": " }),
        h("span", { "class": "ch-title-in", text: s.title })),
      h("span", { "class": "rule", "aria-hidden": "true" }));
    var body = h("div", { "class": "chapter-body" });
    body.appendChild(h("span", { "class": "cprog", "aria-hidden": "true" }, h("i")));
    s.blocks.forEach(function (b, i) {
      if (b.t === "q") {
        var bq = h("blockquote", { "class": "pull block rv" });
        bq.appendChild(inline(b.x, h("p")));
        body.appendChild(bq);
      } else {
        body.appendChild(inline(b.x, h("p", { "class": "para block rv" + (i === 0 ? " lead" : "") })));
      }
    });
    var nxt = d.sections[idx + 1];
    if (nxt) body.appendChild(h("a", { "class": "next", href: "#" + nxt.n },
      h("span", { text: R4.t("next") }), h("b", { text: nxt.n + " · " + nxt.title }), h("i", { "aria-hidden": "true", text: "→" })));
    return h("section", { id: s.n, "class": "chapter", "aria-labelledby": "h" + s.n }, head, body);
  }

  function buildSignoff(d) {
    return h("section", { "class": "signoff", "aria-label": d.sign.name },
      h("div", { "class": "signoff-in" },
        img("assets/img/logo-wide.png", "sign-logo", 461, 150),
        h("p", { "class": "sign-closing", text: d.sign.closing }),
        h("p", { "class": "sign-name", text: d.sign.name }),
        h("p", { "class": "sign-role", text: d.sign.role }),
        h("p", { "class": "sign-motto", text: d.sign.motto }),
        h("a", { "class": "cta ghost", href: "#top", text: R4.t("top") }),
        (window.__4R_CFG || {}).instagramUrl ? h("p", { "class": "sign-social" }, h("a", { "class": "foot-social", href: window.__4R_CFG.instagramUrl, target: "_blank", rel: "me noopener noreferrer", "aria-label": "Instagram @_4r022_", text: "Instagram · @_4r022_" })) : null));
  }

  function buildRail(d) {
    var ol = h("ol", { "class": "rail-list" });
    railLinks = {};
    d.sections.forEach(function (s) {
      var a = h("a", { href: "#" + s.n, "aria-label": R4.t("chapter") + " " + s.n + ": " + s.title }, h("span", { "class": "tick", "aria-hidden": "true" }), h("span", { "class": "tip", "aria-hidden": "true", text: s.n + " " + s.title }));
      railLinks[s.n] = a; ol.appendChild(h("li", null, a));
    });
    return h("nav", { "class": "rail", "aria-label": R4.t("chapters") }, ol);
  }

  /* ---------------- observers / scroll ---------------- */
  function teardown() { observers.forEach(function (o) { o.disconnect(); }); observers = []; }

  function countUp(el) {
    var to = Number(el.getAttribute("data-to")) || 0;
    if (!R4.motionOn() || to < 2) return;
    var t0 = performance.now(), dur = 1300;
    (function tick(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(to * e));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function observe() {
    if (!("IntersectionObserver" in window)) {
      main.querySelectorAll(".chapter, .rv, .stats, .toc").forEach(function (c) { c.classList.add("in", "seen"); });
      return;
    }
    var enter = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in"); enter.unobserve(e.target);
        if (e.target.classList.contains("stats")) e.target.querySelectorAll("b").forEach(countUp);
      });
    }, { threshold: 0.12 });
    main.querySelectorAll(".chapter, .stats, .toc").forEach(function (c) { enter.observe(c); });
    observers.push(enter);

    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("seen"); seen.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0 });
    main.querySelectorAll(".rv").forEach(function (b) { seen.observe(b); });
    observers.push(seen);

    var focus = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle("is-focus", e.isIntersecting); });
    }, { rootMargin: "-36% 0px -36% 0px", threshold: 0 });
    main.querySelectorAll(".block").forEach(function (b) { focus.observe(b); });
    observers.push(focus);

    var active = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id;
        if (current === id) return;
        current = id;
        Object.keys(railLinks).forEach(function (k) { if (k === id) railLinks[k].setAttribute("aria-current", "true"); else railLinks[k].removeAttribute("aria-current"); });
        if (pill) { pill.classList.add("show"); pill.querySelector(".pill-n").textContent = id; }
        if (window.history && history.replaceState) { try { history.replaceState(null, "", "#" + id); } catch (x) { /* ignore */ } }
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    main.querySelectorAll(".chapter").forEach(function (c) { active.observe(c); });
    observers.push(active);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY || 0, vh = window.innerHeight || 1;
      var total = Math.max(1, document.documentElement.scrollHeight - vh);
      if (progressBar) progressBar.style.setProperty("--prog", String(Math.min(1, y / total)));
      if (hero) hero.style.setProperty("--p", String(Math.min(1, Math.max(0, y / vh))));
      if (pill && chapterEls.length && chapterEls[0].getBoundingClientRect().top > vh * 0.6) { pill.classList.remove("show"); current = null; }   /* above the first chapter: no stale "10/10" pill */
      else if (pill && y < vh * 0.6) pill.classList.remove("show");
      var bar = document.querySelector("header.bar"); if (bar) bar.classList.toggle("on-dark", y < vh * 0.85);
      chapterEls.forEach(function (c) {
        var r = c.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        c.style.setProperty("--cp", String(Math.max(0, Math.min(1, (vh * 0.5 - r.top) / Math.max(1, r.height)))));
      });
    });
  }

  function jumpTo(id, smooth) {
    var el = id && document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: smooth ? "smooth" : "instant" });
  }

  /* ---------------- render ---------------- */
  function render(code) {
    var d = DATA[code] || DATA.tr;
    if (!d) return;
    teardown();
    var keep = current || (/^#(0[1-9]|10|toc)$/.test(location.hash) ? location.hash.slice(1) : null);
    current = null;

    progressBar = h("div", { "class": "progress", "aria-hidden": "true" }, h("i"));
    hero = buildHero(d);
    var chapters = h("div", { "class": "chapters" });
    d.sections.forEach(function (s, i) { chapters.appendChild(buildChapter(s, d, i)); });
    pill = h("a", { "class": "pill", href: "#toc", "aria-label": R4.t("tocTitle") }, h("span", { "class": "pill-n", text: "01" }), h("span", { "class": "pill-of", text: "/" + String(d.sections.length).padStart(2, "0") }));
    main.replaceChildren(progressBar, hero, buildStats(d), buildTicker(), buildToc(d), chapters, buildSignoff(d), buildRail(d), pill);
    chapterEls = Array.prototype.slice.call(main.querySelectorAll(".chapter"));

    document.title = d.title + " · " + d.subtitle;
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute("content", d.title + " — " + d.subtitle + ". " + d.motto);

    observe(); onScroll();
    if (keep) jumpTo(keep, false);
  }

  /* ---------------- language gate + welcome intro ---------------- */
  var GATE_FLAG = "4r022.gate";
  function setInert(on) {
    ["main", "header.bar", "footer.foot"].forEach(function (sel) {
      var el = document.querySelector(sel); if (!el) return;
      if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert");
    });
  }

  function finishEntry() {
    setInert(false);
    root.classList.remove("gating", "intro-on", "pre-hero");
    root.classList.add("hero-go");
    R4.shell.askConsent();
    try { main.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  }

  function runIntro(done) {
    var ui = (window.__4R_UI || {})[R4.lang] || {};
    var lines = String(ui.welcomeMain || "4R022 · Kaan Kross").split("\n");
    var ov = h("div", { id: "intro", "class": "intro-ov", role: "region", "aria-label": ui.welcomeTop || "Welcome" },
      h("div", { "class": "intro-half top", "aria-hidden": "true" }), h("div", { "class": "intro-half bot", "aria-hidden": "true" }),
      h("div", { "class": "intro-center" },
        img("assets/img/logo-wide.png", "intro-logo", 461, 150),
        h("p", { "class": "intro-top", text: ui.welcomeTop || "" }),
        h("p", { "class": "intro-main" }, h("span", { text: lines[0] }), lines[1] ? h("span", { text: lines[1] }) : null),
        h("i", { "class": "intro-line", "aria-hidden": "true" })),
      h("button", { type: "button", "class": "intro-skip", text: ui.skipIntro || "Skip" }));
    document.body.appendChild(ov);
    root.classList.add("intro-on");
    var finished = false, t1, t2;
    function end() {
      if (finished) return; finished = true; clearTimeout(t1); clearTimeout(t2);
      ov.classList.add("open"); root.classList.add("hero-go"); root.classList.remove("intro-on");
      setTimeout(function () { ov.remove(); done(); }, 950);
    }
    ov.querySelector(".intro-skip").addEventListener("click", end);
    ov.addEventListener("click", end);
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape" || e.key === "Enter") { end(); document.removeEventListener("keydown", esc); } });
    t1 = setTimeout(end, 5600);
    ov.querySelector(".intro-skip").focus();
  }

  function openGate() {
    var detected = R4.lang, t0 = performance.now(), titleIdx = 0, timer = null;
    var UI = window.__4R_UI || {};
    root.classList.add("gating", "pre-hero");
    setInert(true);

    var title = h("h2", { id: "gate-t", "class": "gate-title", lang: R4.meta[detected].htmlLang, text: (UI[detected] || UI.en).gateTitle });
    var sub = h("p", { "class": "gate-sub", lang: R4.meta[detected].htmlLang, text: (UI[detected] || UI.en).gateSub });
    var grid = h("ul", { "class": "gate-grid" });
    var btns = [];
    R4.langs.forEach(function (m, i) {
      var b = h("button", { type: "button", lang: m.htmlLang, "class": "gate-card", "data-code": m.code, "aria-label": m.native + " — " + (UI[m.code] || UI.en).gateTitle },
        img("assets/flags/" + m.flag + ".svg", "flag", 44, 30), h("span", { "class": "gate-name", text: m.native }), h("span", { "class": "gate-code", "aria-hidden": "true", text: m.code.toUpperCase() }));
      b.style.setProperty("--i", String(i));
      if (m.code === detected) b.classList.add("detected");
      function preview() { var u = UI[m.code] || UI.en; title.textContent = u.gateTitle; sub.textContent = u.gateSub; title.setAttribute("lang", m.htmlLang); sub.setAttribute("lang", m.htmlLang); clearInterval(timer); timer = null; }
      b.addEventListener("focus", preview); b.addEventListener("mouseenter", preview);
      b.addEventListener("click", function () { choose(m.code); });
      btns.push(b); grid.appendChild(h("li", null, b));
    });

    var gate = h("div", { id: "gate", "class": "gate", role: "dialog", "aria-modal": "true", "aria-labelledby": "gate-t" },
      h("div", { "class": "gate-bg", "aria-hidden": "true" }), h("div", { "class": "beam", "aria-hidden": "true" }),
      h("div", { "class": "gate-in" }, img("assets/img/logo-wide.png", "gate-logo", 461, 150), title, sub, grid));
    document.body.appendChild(gate);

    /* cycle the title through all languages until the visitor interacts */
    if (R4.motionOn()) {
      timer = setInterval(function () {
        titleIdx = (titleIdx + 1) % R4.langs.length;
        var m = R4.langs[titleIdx], u = UI[m.code] || UI.en;
        title.classList.remove("swap"); void title.offsetWidth; title.classList.add("swap");
        title.textContent = u.gateTitle; title.setAttribute("lang", m.htmlLang);
      }, 1900);
    }

    var cur = btns.filter(function (b) { return b.getAttribute("data-code") === detected; })[0] || btns[0];
    cur.focus({ preventScroll: true });

    gate.addEventListener("keydown", function (e) {
      var i = btns.indexOf(document.activeElement);
      if (i < 0) return;
      var cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 1, n = i;
      if (e.key === "ArrowRight") n = i + 1; else if (e.key === "ArrowLeft") n = i - 1;
      else if (e.key === "ArrowDown") n = i + cols; else if (e.key === "ArrowUp") n = i - cols;
      else if (e.key === "Home") n = 0; else if (e.key === "End") n = btns.length - 1;
      else if (e.key === "Tab") { n = e.shiftKey ? (i === 0 ? btns.length - 1 : i - 1) : (i === btns.length - 1 ? 0 : i + 1); }
      else return;
      e.preventDefault();
      if (n >= 0 && n < btns.length) btns[n].focus();
    });

    function choose(code) {
      if (performance.now() - t0 < 150) R4.flag("fastgate", -30);   /* a script "clicks" before a human could */
      clearInterval(timer);
      R4.ss("set", GATE_FLAG, "1");
      R4.pref.set("4r022.lang", code);
      if (code !== R4.lang) R4.applyLang(code);
      gate.classList.add("leaving");
      setTimeout(function () {
        gate.remove();
        if (R4.motionOn()) runIntro(finishEntry); else finishEntry();
      }, R4.motionOn() ? 650 : 0);
    }
  }

  /* ---------------- events ---------------- */
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch" || !R4.motionOn() || !hero || window.scrollY > window.innerHeight) return;
    hero.style.setProperty("--mx", String(Math.round((e.clientX / window.innerWidth) * 100)));
    hero.style.setProperty("--my", String(Math.round((e.clientY / window.innerHeight) * 100)));
  }, { passive: true });

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    if (id === "top") { e.preventDefault(); window.scrollTo({ top: 0, behavior: R4.motionOn() ? "smooth" : "instant" }); return; }
    if (document.getElementById(id)) { e.preventDefault(); jumpTo(id, R4.motionOn()); try { main.focus({ preventScroll: true }); } catch (x) { /* ignore */ } }
  });

  R4.shell.init({ page: "home", onLang: render, deferBanner: true });
  if (!R4.ss("get", GATE_FLAG) && !/bot|crawl|spider|slurp|lighthouse|pagespeed|facebookexternalhit/i.test(navigator.userAgent || "")) openGate();   /* search/preview crawlers go straight to the content */
  else { root.classList.add("hero-go"); R4.shell.askConsent(); }
  setTimeout(function () { root.classList.remove("pre-hero"); }, 14000);   /* failsafe: never leave the hero hidden */
})();
