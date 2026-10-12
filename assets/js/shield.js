/* 4R022 - own bot / abuse shield (no third-party captcha, no external service).
 *
 * What it does, honestly:
 *  - scores "human-ness" locally from automation flags + real interaction (never stored, never sent),
 *  - keeps automated visits out of the statistics and out of the beacon endpoint,
 *  - rate-limits UI actions that could be looped by a script,
 *  - adds a hashcash proof-of-work to analytics beacons (only used if an analytics endpoint is configured),
 *  - runs a DOM tripwire that removes injected <script>/<object>/<embed>/<base> nodes and on* handlers,
 *  - plants an invisible honeypot link that only automated crawlers/clickers touch.
 * Real network-level DDoS absorption is done by GitHub's CDN, not by browser code.
 */
(function () {
  "use strict";
  var R4 = (window.R4 = window.R4 || {});
  var score = 50, flags = {}, seen = {}, queue = [], events = R4.securityEvents || [];
  R4.securityEvents = events;

  function flag(k, delta) { if (flags[k]) return; flags[k] = true; score += delta; events.push({ t: Date.now(), k: "flag:" + k }); }
  R4.flag = flag;

  /* ---- static automation signals ---- */
  var ua = navigator.userAgent || "";
  if (navigator.webdriver) flag("webdriver", -60);
  if (/HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium|Electron\//i.test(ua)) flag("headless", -40);
  if (/bot|crawl|spider|slurp|curl|wget|python-requests|httpclient/i.test(ua)) flag("uabot", -60);
  if (!navigator.languages || !navigator.languages.length) flag("nolang", -20);
  if (!screen.width || !screen.height || (window.outerWidth === 0 && window.outerHeight === 0)) flag("nowindow", -25);

  /* ---- interaction signals ---- */
  function human() {
    return !R4.isLikelyBot() && Object.keys(seen).length > 0;
  }
  R4.human = human;
  R4.trust = function () { return Math.max(0, Math.min(100, score)); };
  R4.isLikelyBot = function () { return score < 35 || !!(flags.webdriver || flags.honeypot || flags.uabot || flags.headless); };
  R4.onHuman = function (cb) { if (human()) cb(); else queue.push(cb); };

  ["pointerdown", "pointermove", "touchstart", "keydown", "wheel", "scroll"].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      if (e.isTrusted === false) { flag("synthetic", -40); return; }
      if (!seen[ev]) {
        seen[ev] = 1;
        score = Math.min(100, score + (ev === "pointerdown" || ev === "keydown" || ev === "touchstart" ? 15 : 8));
        if (human() && queue.length) { var q = queue.splice(0); q.forEach(function (f) { try { f(); } catch (x) { /* ignore */ } }); }
      }
    }, { passive: true, capture: true });
  });

  /* ---- client-side rate limiter ---- */
  var buckets = {};
  R4.limit = function (name, max, windowMs) {
    var now = Date.now(), b = (buckets[name] = (buckets[name] || []).filter(function (t) { return now - t < windowMs; }));
    if (b.length >= max) { events.push({ t: now, k: "rate:" + name }); return false; }
    b.push(now); return true;
  };

  /* ---- honeypot (off-screen, not display:none, hidden from AT and tab order) ---- */
  function plantHoneypot() {
    if (!document.body) return;
    var a = document.createElement("a");
    a.className = "hp"; a.setAttribute("href", "legal.html#trap"); a.setAttribute("tabindex", "-1"); a.setAttribute("aria-hidden", "true"); a.textContent = "admin";
    ["click", "focus", "pointerdown"].forEach(function (ev) { a.addEventListener(ev, function () { flag("honeypot", -100); }); });
    document.body.appendChild(a);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", plantHoneypot); else plantHoneypot();

  /* ---- DOM tripwire (defence in depth behind the CSP) ---- */
  var BAD = { SCRIPT: 1, OBJECT: 1, EMBED: 1, BASE: 1, APPLET: 1 };
  function inspect(n) {
    if (!n || n.nodeType !== 1) return;
    var tag = n.tagName;
    if (BAD[tag]) {
      if (tag === "SCRIPT" && n.src && n.src.indexOf(location.origin + "/") === 0) return;
      n.remove(); events.push({ t: Date.now(), k: "removed:" + tag.toLowerCase() }); return;
    }
    if (tag === "IFRAME" && !/^https:\/\//i.test(n.getAttribute("src") || "")) { n.remove(); events.push({ t: Date.now(), k: "removed:iframe" }); return; }
    if (tag === "META" && /refresh/i.test(n.getAttribute("http-equiv") || "")) { n.remove(); return; }
    Array.prototype.slice.call(n.attributes || []).forEach(function (at) {
      if (/^on/i.test(at.name)) { n.removeAttribute(at.name); events.push({ t: Date.now(), k: "removed:handler" }); }
    });
    if (n.children && n.children.length) Array.prototype.forEach.call(n.children, inspect);
  }
  if (window.MutationObserver) {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === "childList") Array.prototype.forEach.call(m.addedNodes, inspect);
        else if (m.type === "attributes" && /^on/i.test(m.attributeName || "")) { m.target.removeAttribute(m.attributeName); events.push({ t: Date.now(), k: "removed:handler" }); }
      });
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }

  /* ---- hashcash proof-of-work (synchronous SHA-256 so it is fast enough, chunked so it never blocks) ---- */
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  var enc = window.TextEncoder ? new TextEncoder() : null;
  function sha256(bytes) {
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var l = bytes.length, padLen = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(padLen);
    m.set(bytes); m[l] = 0x80;
    var dv = new DataView(m.buffer);
    dv.setUint32(padLen - 8, Math.floor((l * 8) / 4294967296)); dv.setUint32(padLen - 4, (l * 8) >>> 0);
    var w = new Int32Array(64), i, o;
    for (o = 0; o < padLen; o += 64) {
      for (i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (i = 16; i < 64; i++) {
        var a = w[i - 15], b = w[i - 2];
        var s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        var s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var A = H[0], B = H[1], C = H[2], D = H[3], E = H[4], F = H[5], G = H[6], Q = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((E >>> 6) | (E << 26)) ^ ((E >>> 11) | (E << 21)) ^ ((E >>> 25) | (E << 7));
        var t1 = (Q + S1 + ((E & F) ^ (~E & G)) + K[i] + w[i]) | 0;
        var S0 = ((A >>> 2) | (A << 30)) ^ ((A >>> 13) | (A << 19)) ^ ((A >>> 22) | (A << 10));
        var t2 = (S0 + ((A & B) ^ (A & C) ^ (B & C))) | 0;
        Q = G; G = F; F = E; E = (D + t1) | 0; D = C; C = B; B = A; A = (t1 + t2) | 0;
      }
      H[0] = (H[0] + A) | 0; H[1] = (H[1] + B) | 0; H[2] = (H[2] + C) | 0; H[3] = (H[3] + D) | 0;
      H[4] = (H[4] + E) | 0; H[5] = (H[5] + F) | 0; H[6] = (H[6] + G) | 0; H[7] = (H[7] + Q) | 0;
    }
    return H;
  }
  function zeroBits(H) {
    var n = 0;
    for (var i = 0; i < H.length; i++) { if (H[i] === 0) { n += 32; continue; } n += Math.clz32(H[i]); break; }
    return n;
  }
  R4._sha256hex = function (s) { return sha256(enc.encode(s)).map(function (x) { return ("00000000" + (x >>> 0).toString(16)).slice(-8); }).join(""); };
  /* resolves to a nonce (string) or null; hash input is payload + ":" + nonce */
  R4.pow = function (payload, bits) {
    return new Promise(function (resolve) {
      if (!enc || !Math.clz32) { resolve(null); return; }
      var n = 0, limit = 6000000;
      (function step() {
        var end = n + 6000;
        for (; n < end; n++) {
          if (zeroBits(sha256(enc.encode(payload + ":" + n))) >= bits) { resolve(String(n)); return; }
        }
        if (n >= limit) { resolve(null); return; }
        setTimeout(step, 0);
      })();
    });
  };
})();
