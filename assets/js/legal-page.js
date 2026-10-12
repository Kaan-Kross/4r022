/* 4R022 - legal page. Renders legal.js into the DOM (textContent only). */
(function () {
  "use strict";
  var R4 = window.R4, h = R4.h;
  var L = window.__4R_LEGAL || {};
  var CFG = window.__4R_CFG || {};
  var main = document.getElementById("main");
  var IDS = ["terms", "privacy", "cookies", "accessibility", "security"];

  function currentId() {
    var id = (location.hash || "").slice(1);
    return IDS.indexOf(id) > -1 ? id : "terms";
  }

  function item(it) {
    if (it.p) return h("p", { text: it.p });
    if (it.ul) { var ul = h("ul"); it.ul.forEach(function (x) { ul.appendChild(h("li", { text: x })); }); return ul; }
    if (it.table) {
      var tr = h("tr");
      it.table.h.forEach(function (c) { tr.appendChild(h("th", { scope: "col", text: c })); });
      var thead = h("thead", null, tr);
      var tbody = h("tbody");
      it.table.r.forEach(function (row) {
        var r = h("tr");
        row.forEach(function (c) { r.appendChild(h("td", { text: c })); });
        tbody.appendChild(r);
      });
      return h("div", { "class": "legal-scroll" }, h("table", null, thead, tbody));
    }
    return null;
  }

  function render() {
    var code = R4.lang;
    var bundle = L[code === "tr" ? "tr" : "en"];
    var id = currentId();
    var doc = bundle.docs.filter(function (d) { return d.id === id; })[0] || bundle.docs[0];

    var nav = h("nav", { "class": "legal-nav", "aria-label": R4.t("official") });
    bundle.docs.forEach(function (d) {
      var a = h("a", { href: "#" + d.id, text: d.nav });
      if (d.id === doc.id) a.setAttribute("aria-current", "true");
      nav.appendChild(a);
    });

    var article = h("article", { "class": "legal-doc", "data-allow-select": "" });
    article.appendChild(h("a", { "class": "legal-back", href: "index.html", text: "← " + R4.t("back") }));
    article.appendChild(h("h1", { text: doc.title }));
    article.appendChild(h("p", { "class": "legal-meta", text: R4.t("updated") + ": " + bundle.updated }));
    if (code !== "tr" && code !== "en") article.appendChild(h("p", { "class": "legal-note", text: R4.t("legalNote") }));
    doc.sections.forEach(function (s) {
      article.appendChild(h("h2", { text: s.h }));
      s.items.forEach(function (it) { var n = item(it); if (n) article.appendChild(n); });
    });
    if (CFG.repoUrl && !/KULLANICI|YOUR-/i.test(CFG.repoUrl) && (doc.id === "security" || doc.id === "privacy" || doc.id === "terms")) {
      article.appendChild(h("p", null, h("a", { href: CFG.repoUrl, rel: "noopener noreferrer", text: CFG.repoUrl })));
    }

    main.replaceChildren(h("div", { "class": "legal" }, nav, article));
    document.title = doc.title + " · 4R022 · Kaan Kross";
  }

  window.addEventListener("hashchange", function () { render(); window.scrollTo({ top: 0, behavior: "instant" }); });
  R4.shell.init({ page: "legal", onLang: render });
})();
