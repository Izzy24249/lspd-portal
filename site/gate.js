/* LSPD sign-on gate: when command switches it on (Admin → Officer Accounts), officers see the
   MDT sign-on screen before the portal. A sign-on is remembered for 1 hour of activity on this device,
   so new tabs and page changes don't boot the terminal again. Admin and Division Command keep their own logins. */
(function () {
  var HOURS = 1;
  function read(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function signedOn() { return !!read("lspd_sess", "") && Date.now() - Number(read("lspd_seen_at", 0)) < HOURS * 3600e3; }
  function go() {
    var here = location.pathname.split("/").pop() + location.search + location.hash;
    location.replace("signon.html" + (here && !/^(index)?(\.html)?$/.test(location.pathname.split("/").pop()) ? "?next=" + encodeURIComponent(here) : ""));
  }
  function check() {
    var g = null; try { g = JSON.parse(read("lspd_gate", "null")); } catch (e) {}
    if (!g || !g.required) return;
    if (signedOn()) { try { localStorage.setItem("lspd_seen_at", String(Date.now())); } catch (e) {} return; }
    go();
  }
  window.LSPDGate = {
    // the live setting arrives with the forms config (or the small check below); keep a copy so the next page load can gate instantly
    update: function (s) { try { localStorage.setItem("lspd_gate", JSON.stringify(s || {})); localStorage.setItem("lspd_gate_at", String(Date.now())); } catch (e) {} check(); }
  };
  check();
  // pages that don't load the forms config still pick up a changed setting (checked at most every 5 minutes)
  window.addEventListener("load", function () {
    if (Date.now() - Number(read("lspd_gate_at", 0)) < 5 * 60e3 || !window.Portal || !Portal.ENDPOINT) return;
    fetch(Portal.ENDPOINT + "?action=signon&t=" + Date.now()).then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok && d.signon) window.LSPDGate.update(d.signon); }).catch(function () {});
  });
})();
