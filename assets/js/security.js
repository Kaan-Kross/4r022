/* 4R022 - client-side security layer (loaded first, synchronous).
 *
 * Honest scope: GitHub Pages is static hosting. Real protection comes from
 * (1) the strict CSP in <meta>, (2) never touching innerHTML, (3) allow-lists,
 * and (4) the client-side guards below. The copy deterrents below
 * only raise the effort; nothing delivered to a browser can be made unreadable.
 */
(function () {
  "use strict";

  var R4 = (window.R4 = window.R4 || {});
  var LANGS = ["tr", "en", "ru", "fr", "de", "es", "zh", "ja", "pt", "pl", "uk"];
  var HASHES = /^#(top|toc|0[1-9]|10|terms|privacy|cookies|accessibility|security|license)$/;

  /* 1. Clickjacking: frame-ancestors cannot be set from <meta>, so bust frames here.
        Browsers may refuse a cross-origin top navigation, so the framed copy is hidden by CSS (html[data-framed]) as well. */
  try {
    if (window.top !== window.self) {
      R4.framed = true;
      try { window.top.location = window.self.location.href; } catch (e) { /* blocked: fall through */ }
      document.documentElement.setAttribute("data-framed", "");
    }
  } catch (e) { R4.framed = true; document.documentElement.setAttribute("data-framed", ""); }

  /* 2. Force HTTPS outside localhost (GitHub Pages "Enforce HTTPS" does this too). */
  if (location.protocol === "http:" && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    location.replace("https://" + location.host + location.pathname + location.search + location.hash);
  }

  /* 3. URL / input guard. The site has no forms and no database; the only inputs
        are the query string and hash. Everything is allow-listed, the rest is dropped. */
  var events = [];
  var SUSPICIOUS = [
    /<\s*\/?\s*(script|iframe|object|embed|svg|img|style|link|meta)/i,
    /(javascript|data|vbscript)\s*:/i,
    /\bon[a-z]{3,20}\s*=/i,
    /(\bunion\b[\s\S]{0,20}\bselect\b|\bselect\b[\s\S]{0,40}\bfrom\b|\bdrop\s+table\b|\binsert\s+into\b|\bdelete\s+from\b|\bsleep\s*\(|\bbenchmark\s*\()/i,
    /(['"`]\s*(or|and)\s+['"`0-9]|--\s|\/\*|;\s*(drop|alter|exec)\b)/i,
    /(\.\.\/|%2e%2e|%00|\\x00)/i
  ];

  function decode(s) {
    var out = s;
    for (var i = 0; i < 3; i++) { try { var d = decodeURIComponent(out); if (d === out) break; out = d; } catch (e) { return out; } }
    return out;
  }
  function isSuspicious(raw) {
    var d = decode(String(raw));
    for (var i = 0; i < SUSPICIOUS.length; i++) if (SUSPICIOUS[i].test(d)) return true;
    return false;
  }
  R4.sanitize = function (value, maxLen) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u001f\u007f<>"'`\\]/g, "")
      .slice(0, maxLen || 64);
  };
  R4.isSuspicious = isSuspicious;

  function cleanUrl() {
    var wantLang = null, dirty = false;
    var search = location.search, hash = location.hash;
    if (search) {
      if (isSuspicious(search)) { dirty = true; events.push({ t: Date.now(), k: "query-blocked" }); }
      else {
        try {
          var p = new URLSearchParams(search);
          var l = (p.get("lang") || "").toLowerCase();
          if (LANGS.indexOf(l) > -1) wantLang = l;
          if (Array.from(p.keys()).some(function (k) { return k !== "lang"; }) || p.getAll("lang").length > 1) dirty = true;
        } catch (e) { dirty = true; }
      }
      if (search) dirty = true; /* keep the address bar tidy: lang is stored, then removed */
    }
    if (hash && (!HASHES.test(hash) || isSuspicious(hash))) {
      dirty = true; events.push({ t: Date.now(), k: "hash-blocked" });
      hash = "";
    }
    if (dirty && window.history && history.replaceState) {
      try { history.replaceState(null, "", location.pathname + hash); } catch (e) { /* ignore */ }
    }
    R4.urlLang = wantLang;
  }
  cleanUrl();
  R4.securityEvents = events;

  /* 4. Copy / source deterrents (best effort; see header comment). */
  function allowed(el) { return !!(el && el.closest && el.closest("[data-allow-select], input, textarea")); }
  function note() { if (R4.toast) R4.toast("copyNotice"); }
  function block(e) { if (!allowed(e.target)) { e.preventDefault(); } }

  document.addEventListener("contextmenu", function (e) { if (!allowed(e.target)) { e.preventDefault(); note(); } });
  document.addEventListener("copy", function (e) { if (!allowed(e.target)) { e.preventDefault(); note(); } });
  document.addEventListener("cut", block);
  document.addEventListener("dragstart", block);
  document.addEventListener("selectstart", block);

  document.addEventListener("keydown", function (e) {
    if (allowed(e.target)) return;
    var k = (e.key || "").toLowerCase(), c = e.ctrlKey || e.metaKey;
    var hit =
      k === "f12" ||
      (c && e.shiftKey && (k === "i" || k === "j" || k === "c" || k === "k")) ||
      (c && (k === "u" || k === "s" || k === "p" || k === "a" || k === "c" || k === "x")) ||
      (e.metaKey && e.altKey && (k === "i" || k === "u" || k === "j"));
    if (hit) { e.preventDefault(); e.stopPropagation(); note(); }
  }, true);

  /* 5. Lightweight toast (used by the above and by the shell). Text only. */
  R4.toast = function (key) {
    var ui = (window.__4R_UI || {})[R4.lang || "tr"] || {};
    var msg = ui[key] || key;
    var el = document.getElementById("r4-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "r4-toast"; el.className = "toast";
      el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(R4._tt);
    R4._tt = setTimeout(function () { el.classList.remove("show"); }, 2600);
  };

  /* 6. Bot heuristics: used ONLY to keep automated visits out of the statistics.
        Visitors are never blocked or challenged (accessibility, search engines). */
  R4.isLikelyBot = function () {
    var ua = navigator.userAgent || "";
    return !!(navigator.webdriver || /HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium|bot|crawl|spider|slurp/i.test(ua) ||
      !navigator.languages || navigator.languages.length === 0);
  };
})();
