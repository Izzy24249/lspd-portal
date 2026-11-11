/* LSPD Report Builder -> LSPD MDT link.
   Add to the Report Builder page, after its own script:
     <script src="https://lspd-portal.pages.dev/tools/report-link.js"></script>
   When an officer presses COPY on a finished report, a copy of that report (header, body, callsign, name)
   is sent to the LSPD MDT so it counts toward their promotion requirements. Nothing in the builder changes:
   the copy still goes to the clipboard exactly as before, and if the MDT can't be reached the builder works normally. */
(function () {
  "use strict";
  var ENDPOINT = "https://script.google.com/macros/s/AKfycbyQlnEtA7DJRHnnLJsalqvsvNK3yiuOmoBAlzNWM9qk2AebZEwyHkjtfKqxW9hB65jB/exec";
  var QKEY = "lspd_mdt_link_queue";
  if (window.__lspdMdtLink) return; window.__lspdMdtLink = true;
  var $ = function (id) { return document.getElementById(id); };
  var val = function (id) { var e = $(id); return e ? String(e.value != null && e.tagName !== "DIV" ? e.value : e.textContent || "").trim() : ""; };
  function queue() { try { return JSON.parse(localStorage.getItem(QKEY) || "[]") || []; } catch (e) { return []; } }
  function saveQ(q) { try { localStorage.setItem(QKEY, JSON.stringify(q.slice(-20))); } catch (e) {} }
  function post(item) {
    return fetch(ENDPOINT, { method: "POST", mode: "no-cors", keepalive: true, headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(item) });
  }
  function flush() { var q = queue(); if (!q.length) return; saveQ([]); q.forEach(function (it) { post(it).catch(function () { var r = queue(); r.push(it); saveQ(r); }); }); }
  function note(t) {
    try { var n = document.createElement("div"); n.textContent = t;
      n.style.cssText = "position:fixed;left:14px;bottom:14px;z-index:2147483000;padding:6px 11px;border-radius:6px;background:rgba(10,10,12,.88);border:1px solid rgba(80,200,120,.5);color:#9ee6b4;font:600 11px ui-monospace,Consolas,monospace;letter-spacing:.06em;pointer-events:none;opacity:0;transition:opacity .25s";
      document.body.appendChild(n); requestAnimationFrame(function () { n.style.opacity = "1"; }); setTimeout(function () { n.style.opacity = "0"; setTimeout(function () { n.remove(); }, 400); }, 2200); } catch (e) {}
  }
  function send(text) {
    var bodyEl = $("reportBody"), body = bodyEl ? String(bodyEl.textContent || "").trim() : "";
    if (!body || String(text || "").trim() !== body) return;          // only the report itself (not history re-copies or anything else)
    var header = $("reportHeaderLine") ? String($("reportHeaderLine").textContent || "").trim() : "";
    var parts = header.split("|").map(function (s) { return s.trim(); });
    var item = { action: "rbReport", badge: val("badge") || parts[1] || "", name: val("name") || parts[0] || "", type: parts[2] || "", header: header, body: body, at: Date.now() };
    if (!/\d/.test(item.badge)) return;                                 // no callsign filled in: nothing to credit
    post(item).then(function () { note("✓ LOGGED TO LSPD MDT"); }).catch(function () { var q = queue(); q.push(item); saveQ(q); });
  }
  // watch the clipboard writes the builder already makes
  try {
    var cb = navigator.clipboard;
    if (cb && cb.writeText) { var orig = cb.writeText.bind(cb);
      cb.writeText = function (t) { var p = orig(t); try { send(t); } catch (e) {} return p; }; }
  } catch (e) {}
  flush(); window.addEventListener("online", flush);
})();
