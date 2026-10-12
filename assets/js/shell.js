/* 4R022 - shared shell: header, language dialog, footer, consent infrastructure,
 * consent-gated entry/exit tracking with proof-of-work. DOM is built with createElement/textContent only. */
(function () {
  "use strict";
  var R4 = (window.R4 = window.R4 || {});
  var UI = window.__4R_UI || {};
  var CFG = window.__4R_CFG || {};
  var SVGNS = "http://www.w3.org/2000/svg";
  var PREF_KEYS = ["4r022.lang", "4r022.theme", "4r022.motion"];
  var CONSENT_KEY = "4r022.consent", SESS_KEY = "4r022.sessions";
  var CONSENT_TTL = 365 * 24 * 3600 * 1000;

  var LMETA = [
    ["tr", "Türkçe", "tr", "tr"], ["en", "English", "gb", "en"], ["ru", "Русский", "ru", "ru"],
    ["fr", "Français", "fr", "fr"], ["de", "Deutsch", "de", "de"], ["es", "Español", "es", "es"],
    ["zh", "中文", "cn", "zh-CN"], ["ja", "日本語", "jp", "ja"], ["pt", "Português", "pt", "pt"],
    ["pl", "Polski", "pl", "pl"], ["uk", "Українська", "ua", "uk"]
  ];
  var META = {};
  LMETA.forEach(function (m) { META[m[0]] = { code: m[0], native: m[1], flag: m[2], htmlLang: m[3] }; });
  R4.langs = LMETA.map(function (m) { return META[m[0]]; });
  R4.meta = META;

  /* ---------- storage ---------- */
  function ls(op, key, val) {
    try {
      var s = window.localStorage;
      if (op === "get") return s.getItem(key);
      if (op === "set") s.setItem(key, val);
      if (op === "del") s.removeItem(key);
    } catch (e) { /* blocked */ }
    return null;
  }
  function ss(op, key, val) {
    try {
      var s = window.sessionStorage;
      if (op === "get") return s.getItem(key);
      if (op === "set") s.setItem(key, val);
      if (op === "del") s.removeItem(key);
    } catch (e) { /* blocked */ }
    return null;
  }
  R4.ss = ss;

  var consent = null;
  function readConsent() {
    var raw = ls("get", CONSENT_KEY);
    if (!raw) return null;
    try {
      var c = JSON.parse(raw);
      if (c && c.v === 2 && typeof c.ts === "number" && Date.now() - c.ts < CONSENT_TTL) return c;
    } catch (e) { /* ignore */ }
    return null;
  }
  var GPC = !!(navigator.globalPrivacyControl || navigator.doNotTrack === "1");

  /* preferences live in sessionStorage; they are copied to localStorage only with the "preferences" consent */
  R4.pref = {
    get: function (k) { var v = ss("get", k); return v != null ? v : ls("get", k); },
    set: function (k, v) { ss("set", k, v); if (consent && consent.prefs) ls("set", k, v); }
  };

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") { if (typeof v === "function") el.addEventListener(k.slice(2), v); }
      else el.setAttribute(k, v === true ? "" : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return el;
  }
  R4.h = h;

  function svg(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i++) { if (arguments[i]) el.appendChild(arguments[i]); }
    return el;
  }
  R4.svg = svg;
  function icon(d) {
    return svg("svg", { viewBox: "0 0 24 24", width: "20", height: "20", "aria-hidden": "true", focusable: "false", "class": "ico" },
      svg("path", { d: d, fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round" }));
  }
  R4.icon = icon;

  function t(key) { var l = UI[R4.lang] || {}; return l[key] != null ? l[key] : (UI.en || {})[key] || key; }
  R4.t = t;

  function pickLang() {
    var s = R4.pref.get("4r022.lang");
    if (R4.urlLang && META[R4.urlLang]) return R4.urlLang;
    if (s && META[s]) return s;
    var nav = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "tr"]);
    for (var i = 0; i < nav.length; i++) {
      var c = String(nav[i]).toLowerCase().slice(0, 2);
      if (c === "ua") c = "uk";
      if (META[c]) return c;
    }
    return "tr";
  }
  R4.pickLang = pickLang;

  var root = document.documentElement;
  var mqReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var mqLight = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : { matches: false };
  function applyTheme(th) { root.setAttribute("data-theme", th); }
  function applyMotion(m) { root.setAttribute("data-motion", m); }
  R4.motionOn = function () { return root.getAttribute("data-motion") === "on"; };

  /* ---------- tracking (consent-gated, human-gated, proof-of-work) ---------- */
  var session = null, sent = 0;
  function saveSession(s) {
    var list = [];
    try { list = JSON.parse(ls("get", SESS_KEY) || "[]"); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    list = list.filter(function (x) { return x && x.id !== s.id; });
    list.push(s);
    ls("set", SESS_KEY, JSON.stringify(list.slice(-50)));
  }
  function sendBeacon(type, extra) {
    if (!CFG.endpoint || !session || sent >= 12) return;
    var p = session.pow && session.pow[type];
    if (!p) return;
    sent++;
    var body = { v: 1, type: type, sid: session.id, page: session.page, lang: session.lang, ts: Date.now(), bits: CFG.powBits || 14, n: p };
    if (extra != null) body.dur = extra;
    try {
      var blob = new Blob([JSON.stringify(body)], { type: "text/plain;charset=UTF-8" });
      if (navigator.sendBeacon) navigator.sendBeacon(CFG.endpoint, blob);
    } catch (e) { /* ignore */ }
  }
  function trackEnter() {
    if (session || !consent || !consent.stats || GPC || R4.isLikelyBot()) return;
    var sid = (window.crypto && crypto.getRandomValues ? Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(8)), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("") : Math.random().toString(36).slice(2, 10) + "x1");
    session = { id: sid, page: (location.pathname.split("/").pop() || "index.html"), lang: R4.lang, in: Date.now(), out: null, dur: null, pow: {} };
    if (session.page !== "index.html" && session.page !== "legal.html") session.page = "index.html";
    saveSession({ id: session.id, page: session.page, lang: session.lang, in: session.in, out: null, dur: null });
    if (CFG.endpoint) {
      var bits = CFG.powBits || 14, s = session;
      R4.pow(s.id + "|enter|" + s.page, bits).then(function (n) {
        s.pow.enter = n; return R4.pow(s.id + "|exit|" + s.page, bits);
      }).then(function (n) { s.pow.exit = n; R4.onHuman(function () { sendBeacon("enter"); }); });
    }
  }
  function trackExit() {
    if (!session || session.out) return;
    session.out = Date.now(); session.dur = Math.max(0, Math.min(86399, Math.round((session.out - session.in) / 1000)));
    saveSession({ id: session.id, page: session.page, lang: session.lang, in: session.in, out: session.out, dur: session.dur });
    if (R4.human()) sendBeacon("exit", session.dur);
  }
  window.addEventListener("pagehide", trackExit);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") trackExit(); });

  /* ---------- consent ---------- */
  var refs = {};
  function allKeys(store) {
    var out = [];
    try { for (var i = 0; i < store.length; i++) { var k = store.key(i); if (k && k.indexOf("4r022.") === 0) out.push(k); } } catch (e) { /* ignore */ }
    return out;
  }
  function closeConsentUI() {
    var b = document.getElementById("r4-consent"); if (b) b.remove();
    root.classList.remove("consent-open");
    if (refs.prefDlg) { try { if (refs.prefDlg.open) refs.prefDlg.close(); } catch (e) { /* ignore */ } refs.prefDlg.remove(); refs.prefDlg = null; }
  }
  function applyConsent(c) {
    consent = c;
    if (c.prefs) { PREF_KEYS.forEach(function (k) { var v = ss("get", k); if (v != null) ls("set", k, v); }); }
    else { PREF_KEYS.forEach(function (k) { ls("del", k); }); }
    if (c.stats && !GPC) trackEnter(); else { trackExit(); session = null; ls("del", SESS_KEY); }
    closeConsentUI();
  }
  function saveConsent(prefs, stats) {
    var c = { v: 2, ts: Date.now(), prefs: !!prefs, stats: !!stats && !GPC };
    ls("set", CONSENT_KEY, JSON.stringify(c));
    applyConsent(c);
  }
  function exportData() {
    var dump = { exportedAt: new Date().toISOString(), localStorage: {}, sessionStorage: {} };
    allKeys(window.localStorage).forEach(function (k) { dump.localStorage[k] = ls("get", k); });
    allKeys(window.sessionStorage).forEach(function (k) { dump.sessionStorage[k] = ss("get", k); });
    try {
      var url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" }));
      var a = h("a", { href: url, download: "4r022-my-data.json" });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    } catch (e) { /* ignore */ }
  }
  function eraseData() {
    trackExit(); session = null;
    allKeys(window.localStorage).forEach(function (k) { ls("del", k); });
    allKeys(window.sessionStorage).forEach(function (k) { ss("del", k); });
    consent = null;
    closeConsentUI();
    showBanner();
  }

  function showBanner() {
    var old = document.getElementById("r4-consent"); if (old) old.remove();
    var box = h("section", { id: "r4-consent", "class": "consent", "aria-labelledby": "r4-consent-t" },
      h("h2", { id: "r4-consent-t", text: t("cdTitle") }),
      h("p", { text: t("cbText") }),
      h("div", { "class": "consent-row" },
        h("button", { type: "button", "class": "btn", text: t("cdNone"), onclick: function () { saveConsent(false, false); } }),
        h("button", { type: "button", "class": "btn", text: t("cbCustomize"), onclick: openPrefs }),
        h("button", { type: "button", "class": "btn", text: t("cdAll"), onclick: function () { saveConsent(true, true); } })),
      h("a", { href: "legal.html#cookies", "class": "consent-more", text: t("cbMore") }));
    document.body.appendChild(box);
    root.classList.add("consent-open");
    root.style.setProperty("--consent-h", box.offsetHeight + "px");
  }

  function sw(id, checked, disabled) {
    var input = h("input", { type: "checkbox", role: "switch", id: id, "class": "sw-in" });
    if (checked) input.checked = true;
    if (disabled) input.disabled = true;
    return { input: input, el: h("span", { "class": "sw" }, input, h("span", { "class": "sw-knob", "aria-hidden": "true" })) };
  }
  function openPrefs() {
    if (refs.prefDlg) refs.prefDlg.remove();
    var cur = consent || { prefs: false, stats: false };
    var nec = sw("r4-sw-nec", true, true), pr = sw("r4-sw-pref", cur.prefs, false), st = sw("r4-sw-stat", cur.stats && !GPC, GPC);
    function row(title, desc, s, id, note) {
      return h("div", { "class": "pref-row" },
        h("div", { "class": "pref-txt" }, h("label", { "for": id, "class": "pref-t", text: title }), h("p", { text: desc }), note ? h("p", { "class": "pref-note", text: note }) : null),
        s.el);
    }
    var dlg = h("dialog", { "class": "prefdlg", "aria-labelledby": "r4-pref-t" },
      h("div", { "class": "dlg-head" }, h("h2", { id: "r4-pref-t", text: t("cdTitle") }),
        h("button", { type: "button", "class": "tool icon-only", "aria-label": t("close"), onclick: function () { dlg.close(); } }, icon("M6 6l12 12M18 6L6 18"))),
      h("div", { "class": "pref-body" },
        row(t("cdNecTitle") + " — " + t("cdAlways"), t("cdNecDesc"), nec, "r4-sw-nec"),
        row(t("cdPrefTitle"), t("cdPrefDesc"), pr, "r4-sw-pref"),
        row(t("cdStatTitle"), t("cdStatDesc"), st, "r4-sw-stat", GPC ? t("cdGpc") : null)),
      h("div", { "class": "pref-actions" },
        h("button", { type: "button", "class": "btn", text: t("cdNone"), onclick: function () { saveConsent(false, false); } }),
        h("button", { type: "button", "class": "btn", text: t("cdSave"), onclick: function () { saveConsent(pr.input.checked, st.input.checked); } }),
        h("button", { type: "button", "class": "btn", text: t("cdAll"), onclick: function () { saveConsent(true, true); } })),
      h("div", { "class": "pref-tools" },
        h("button", { type: "button", "class": "linklike", text: t("cdExport"), onclick: exportData }),
        h("button", { type: "button", "class": "linklike", text: t("cdErase"), onclick: eraseData }),
        h("a", { href: "legal.html#cookies", "class": "linklike", text: t("cbMore") })));
    refs.prefDlg = dlg;
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }

  /* ---------- header / dialog / footer ---------- */
  function buildHeader(page) {
    var brand = h("a", { "class": "brand", href: page === "home" ? "#top" : "index.html", "aria-label": "4R022 · Kaan Kross" },
      h("span", { "class": "brand-mark", "aria-hidden": "true" }, "4R022"),
      h("span", { "class": "brand-by", "aria-hidden": "true" }, "KAAN KROSS"));
    refs.flag = h("img", { alt: "", width: "22", height: "15", "class": "flag", src: "assets/flags/tr.svg" });
    refs.langName = h("span", { "class": "lang-name" });
    refs.langBtn = h("button", { type: "button", "class": "tool", "aria-haspopup": "dialog", onclick: openDialog }, refs.flag, refs.langName);
    refs.themeBtn = h("button", { type: "button", "class": "tool icon-only", onclick: function () {
      var th = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(th); R4.pref.set("4r022.theme", th); refreshLabels();
    } }, icon("M12 3a9 9 0 1 0 9 9c-5 1-10-4-9-9z"));
    refs.motionBtn = h("button", { type: "button", "class": "tool icon-only", "aria-pressed": "true", onclick: function () {
      var m = R4.motionOn() ? "off" : "on";
      applyMotion(m); R4.pref.set("4r022.motion", m); refreshLabels();
    } }, icon("M5 5l14 7-14 7z"));
    var bar = h("header", { "class": "bar" }, brand, h("div", { "class": "bar-tools" }, refs.langBtn, refs.themeBtn, refs.motionBtn));
    refs.skip = h("a", { "class": "skip", href: "#main" });
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.insertBefore(refs.skip, document.body.firstChild);
    refs.bar = bar;
  }

  function buildDialog() {
    refs.dlgTitle = h("h2", { id: "r4-dlg-t" });
    refs.dlgClose = h("button", { type: "button", "class": "tool icon-only dlg-close", onclick: function () { refs.dlg.close(); } }, icon("M6 6l12 12M18 6L6 18"));
    var list = h("ul", { "class": "lang-grid" });
    refs.langItems = {};
    R4.langs.forEach(function (m) {
      var b = h("button", { type: "button", lang: m.htmlLang, "class": "lang-opt", onclick: function () { refs.dlg.close(); R4.setLang(m.code, true); } },
        h("img", { src: "assets/flags/" + m.flag + ".svg", alt: "", width: "30", height: "20", "class": "flag" }), h("span", { text: m.native }));
      refs.langItems[m.code] = b;
      list.appendChild(h("li", null, b));
    });
    refs.dlg = h("dialog", { "class": "langdlg", "aria-labelledby": "r4-dlg-t" }, h("div", { "class": "dlg-head" }, refs.dlgTitle, refs.dlgClose), list);
    refs.dlg.addEventListener("click", function (e) { if (e.target === refs.dlg) refs.dlg.close(); });
    document.body.appendChild(refs.dlg);
  }
  function openDialog() {
    if (typeof refs.dlg.showModal === "function") refs.dlg.showModal(); else refs.dlg.setAttribute("open", "");
    var cur = refs.langItems[R4.lang]; if (cur) cur.focus();
  }

  function buildFooter() {
    refs.footLinks = {};
    var nav = h("nav", { "class": "foot-nav" });
    [["terms", "legal.html#terms"], ["privacy", "legal.html#privacy"], ["cookies", "legal.html#cookies"], ["a11y", "legal.html#accessibility"], ["security", "legal.html#security"]].forEach(function (p) {
      var a = h("a", { href: p[1] }); refs.footLinks[p[0]] = a; nav.appendChild(a);
    });
    refs.cookieBtn = h("button", { type: "button", "class": "linklike", onclick: openPrefs });
    nav.appendChild(refs.cookieBtn);
    refs.rights = h("p", { "class": "foot-rights" });
    refs.year = new Date().getFullYear();
    refs.footer = h("footer", { "class": "foot" }, h("div", { "class": "foot-in" },
      h("div", { "class": "foot-brand" }, h("span", { "class": "brand-mark", "aria-hidden": "true" }, "4R022"), h("span", { "class": "brand-by", "aria-hidden": "true" }, "KAAN KROSS")), nav, refs.rights));
    document.body.appendChild(refs.footer);
  }

  function refreshLabels() {
    var m = META[R4.lang];
    refs.flag.setAttribute("src", "assets/flags/" + m.flag + ".svg");
    refs.langName.textContent = m.native;
    refs.langBtn.setAttribute("aria-label", t("langBtn") + ": " + m.native);
    var dark = root.getAttribute("data-theme") === "dark";
    refs.themeBtn.setAttribute("aria-label", dark ? t("toLight") : t("toDark"));
    refs.themeBtn.setAttribute("title", dark ? t("toLight") : t("toDark"));
    var on = R4.motionOn();
    refs.motionBtn.setAttribute("aria-pressed", on ? "true" : "false");
    refs.motionBtn.setAttribute("aria-label", on ? t("motionOn") : t("motionOff"));
    refs.motionBtn.setAttribute("title", on ? t("motionOn") : t("motionOff"));
    refs.skip.textContent = t("skip");
    document.body.setAttribute("data-print", t("printNotice"));
    refs.dlgTitle.textContent = t("langTitle");
    refs.dlgClose.setAttribute("aria-label", t("close"));
    Object.keys(refs.langItems).forEach(function (c) {
      if (c === R4.lang) refs.langItems[c].setAttribute("aria-current", "true"); else refs.langItems[c].removeAttribute("aria-current");
    });
    Object.keys(refs.footLinks).forEach(function (k) { refs.footLinks[k].textContent = t(k); });
    refs.cookieBtn.textContent = t("cookieSettings");
    refs.rights.textContent = "© " + refs.year + " 4R022 · Kaan Kross. " + t("rights");
    if (document.getElementById("r4-consent")) showBanner();
  }

  /* ---------- language switching ---------- */
  function applyLang(code) {
    R4.lang = code;
    root.setAttribute("lang", META[code].htmlLang);
    R4.pref.set("4r022.lang", code);
    refreshLabels();
    if (R4._onLang) R4._onLang(code);
    var ann = document.getElementById("r4-live");
    if (ann) ann.textContent = META[code].native;
  }
  R4.applyLang = applyLang;
  R4.setLang = function (code, animate) {
    if (!META[code] || code === R4.lang) return;
    if (!R4.limit("lang", 8, 10000)) { R4.toast("rateNotice"); return; }
    if (!animate || !R4.motionOn()) { applyLang(code); return; }
    var m = META[code];
    var cur = h("div", { "class": "curtain", "aria-hidden": "true" },
      h("img", { src: "assets/flags/" + m.flag + ".svg", alt: "", width: "120", height: "80", "class": "flag big" }),
      h("span", { "class": "curtain-name", text: m.native }));
    document.body.appendChild(cur);
    setTimeout(function () { applyLang(code); }, 520);
    setTimeout(function () { cur.remove(); }, 1500);
  };

  /* ---------- init ---------- */
  R4.shell = {
    init: function (opts) {
      if (R4.framed) return;
      opts = opts || {};
      consent = readConsent();
      var th = R4.pref.get("4r022.theme");
      applyTheme(th === "light" || th === "dark" ? th : (mqLight.matches ? "light" : "dark"));
      var mo = R4.pref.get("4r022.motion");
      applyMotion(mo === "on" || mo === "off" ? mo : (mqReduce.matches ? "off" : "on"));
      document.body.appendChild(h("div", { id: "r4-live", "class": "sr-only", "aria-live": "polite" }));
      buildHeader(opts.page || "home");
      buildDialog();
      buildFooter();
      R4._onLang = opts.onLang || null;
      R4.lang = pickLang();
      root.setAttribute("lang", META[R4.lang].htmlLang);
      refreshLabels();
      if (R4._onLang) R4._onLang(R4.lang);
      if (consent) applyConsent(consent);
      if (!opts.deferBanner) R4.shell.askConsent();
    },
    askConsent: function () { if (!consent && !document.getElementById("r4-consent")) showBanner(); },
    openPrefs: openPrefs
  };
})();
