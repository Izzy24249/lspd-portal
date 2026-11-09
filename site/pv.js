/* MDT preview ("View the MDT as…" in Admin): this browser tab signs on as a read-only preview of another officer.
   Everything the portal keeps on the device is kept apart ("pv:" keys), so your own sign-on is never touched.
   Closing the tab (or "Exit preview") ends it. */
(function () {
  try {
    var q = new URLSearchParams(location.search), tok = q.get("preview");
    if (tok) { sessionStorage.setItem("lspd_pv", tok); sessionStorage.setItem("lspd_pv_who", q.get("pvwho") || "");
      for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && k.indexOf("pv:") === 0) localStorage.removeItem(k); }   // a fresh preview: nothing left from the last one
      q.delete("preview"); q.delete("pvwho"); history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash); }
    var t = sessionStorage.getItem("lspd_pv"); if (!t) return;
    window.LSPD_PREVIEW = { session: t, who: sessionStorage.getItem("lspd_pv_who") || "" };
    var P = Storage.prototype, g = P.getItem, s = P.setItem, r = P.removeItem, L = window.localStorage;
    P.getItem = function (k) { if (this !== L) return g.call(this, k); if (k === "lspd_sess") return t; if (k === "lspd_seen_at") return String(Date.now()); return g.call(this, "pv:" + k); };
    P.setItem = function (k, v) { if (this !== L) return s.call(this, k, v); if (k === "lspd_sess" || k === "lspd_seen_at") return; return s.call(this, "pv:" + k, v); };
    P.removeItem = function (k) { if (this !== L) return r.call(this, k); return r.call(this, "pv:" + k); };
    var top = true; try { top = window.top === window; } catch (e) { top = false; }
    if (!top) return;
    window.LSPDPreviewExit = function () {
      sessionStorage.removeItem("lspd_pv"); sessionStorage.removeItem("lspd_pv_who");
      for (var i = L.length - 1; i >= 0; i--) { var k = L.key(i); if (k && k.indexOf("pv:") === 0) r.call(L, k); }
      window.close(); setTimeout(function () { location.replace("admin.html"); }, 200);
    };
    var bar = function () {
      if (document.getElementById("pvBar")) return;
      var st = document.createElement("style");
      st.textContent = "#pvBar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 24px);padding:9px 10px 9px 16px;border-radius:999px;" +
        "background:rgba(8,15,32,.94);border:1px solid rgba(250,204,21,.6);box-shadow:0 12px 40px -10px rgba(0,0,0,.8),0 0 28px -8px rgba(250,204,21,.6);color:#fef3c7;font:600 13px Inter,system-ui,sans-serif;backdrop-filter:blur(10px)}" +
        "#pvBar b{color:#fde047;letter-spacing:.12em;font:800 11px ui-monospace,Consolas,monospace}#pvBar span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}" +
        "#pvBar button{flex:none;border:1px solid rgba(250,204,21,.6);background:rgba(250,204,21,.14);color:#fde047;border-radius:999px;padding:6px 12px;font:700 12px Inter,system-ui,sans-serif;cursor:pointer}#pvBar button:hover{background:rgba(250,204,21,.26)}";
      document.head.appendChild(st);
      var d = document.createElement("div"); d.id = "pvBar";
      var who = window.LSPD_PREVIEW.who || "another officer";
      d.innerHTML = "<b>👁 PREVIEW</b><span></span><button type=\"button\">Exit preview</button>";
      d.querySelector("span").textContent = "Viewing the MDT as " + who + " · view-only";
      d.querySelector("button").onclick = window.LSPDPreviewExit;
      document.body.appendChild(d);
    };
    if (document.body) bar(); else document.addEventListener("DOMContentLoaded", bar);
  } catch (e) {}
})();
