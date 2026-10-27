/* LSPD portal sync for the report builder.
   Add this ONE line to the builder's page (just before </body>):
     <script src="https://lspdisthebest.net/sync.js"></script>
   What it does:
   · when an officer copies a finished report (the builder's Copy button or Ctrl+C), the report is logged to
     LSPD Division Command (Patrol division) and credited to every roster officer named in it
   · name / officer boxes get LSPD roster suggestions (callsign | name)
   Nothing else on the page changes. Command can switch it off in Admin → Division Command. */
(function () {
  "use strict";
  if (window.__lspdSync) return; window.__lspdSync = 1;
  // same Apps Script backend as the portal (forms.js ENDPOINT)
  var EP = "https://script.google.com/macros/s/AKfycbyQlnEtA7DJRHnnLJsalqvsvNK3yiuOmoBAlzNWM9qk2AebZEwyHkjtfKqxW9hB65jB/exec";
  var last = "", busy = false;

  // ---------- small status chip ----------
  var chip = null;
  function say(t, ok) {
    if (!document.body) return;
    if (!chip) {
      chip = document.createElement("div");
      chip.style.cssText = "position:fixed;left:14px;bottom:14px;z-index:2147483000;padding:8px 12px;font:600 12px/1.2 system-ui,sans-serif;letter-spacing:.04em;color:#dfe6f2;background:rgba(11,15,22,.92);border:1px solid rgba(160,184,220,.3);border-left:3px solid #3f7fff;box-shadow:0 6px 18px rgba(0,0,0,.4);transition:opacity .3s;pointer-events:none";
      document.body.appendChild(chip);
    }
    chip.textContent = t; chip.style.borderLeftColor = ok === false ? "#ff5a5f" : ok ? "#3ad18a" : "#3f7fff"; chip.style.opacity = "1";
    clearTimeout(say.t); say.t = setTimeout(function () { chip.style.opacity = "0"; }, 4000);
  }

  // ---------- log a copied report ----------
  function log(text) {
    text = String(text || "").trim();
    if (text.length < 60 || text === last || busy) return;
    last = text; busy = true;
    fetch(EP, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "builderLog", text: text, page: location.href, title: document.title }) })
      .then(function (r) { return r.json(); })
      .then(function (r) {
        if (r && r.ok && r.logged) say("✓ Logged to LSPD Division Command · " + (r.credited || []).length + " officer" + ((r.credited || []).length === 1 ? "" : "s") + " credited", true);
        else if (r && r.ok && r.dup) say("✓ Already logged", true);
        else if (r && r.ok && r.logged === false) say("Not logged: no roster callsign or name found in the report", false);
      })
      .catch(function () {})
      .then(function () { busy = false; });
  }
  // the builder's Copy button (navigator.clipboard.writeText) …
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      var orig = navigator.clipboard.writeText.bind(navigator.clipboard);
      navigator.clipboard.writeText = function (t) { try { log(t); } catch (e) {} return orig(t); };
    }
  } catch (e) {}
  // … or a normal copy (Ctrl+C, or document.execCommand("copy") on a selected text box)
  document.addEventListener("copy", function (e) {
    setTimeout(function () {
      var t = "", a = document.activeElement;
      try { if (a && /^(TEXTAREA|INPUT)$/.test(a.tagName) && a.selectionEnd > a.selectionStart) t = a.value.slice(a.selectionStart, a.selectionEnd); } catch (x) {}
      if (!t) t = String(window.getSelection ? window.getSelection() : "");
      log(t);
    }, 0);
  }, true);

  // ---------- roster suggestions on name boxes ----------
  var LIST = "lspd-roster-list";
  function attach(root) {
    var inputs = (root || document).querySelectorAll ? (root || document).querySelectorAll("input:not([type]),input[type=text],input[type=search]") : [];
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i]; if (el.getAttribute("list") || el.__lspd) continue;
      var lab = "";
      try { lab = [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), el.labels && el.labels[0] && el.labels[0].textContent].join(" "); } catch (x) {}
      if (/officer|name|unit|callsign|trooper|deputy|reporting|assist|lead|partner|fto|trainee/i.test(lab) && !/suspect|victim|witness|plate|vehicle|street|location|address|charge/i.test(lab)) { el.setAttribute("list", LIST); el.__lspd = 1; }
    }
  }
  function roster() {
    fetch(EP + "?action=builderRoster&t=" + Date.now()).then(function (r) { return r.json(); }).then(function (r) {
      if (!r || !r.ok || !r.people) return;
      var dl = document.getElementById(LIST) || document.createElement("datalist"); dl.id = LIST; dl.innerHTML = "";
      r.people.forEach(function (p) { var o = document.createElement("option"); o.value = (p.cs ? p.cs + " | " : "") + p.n; dl.appendChild(o); });
      document.body.appendChild(dl); attach(document);
      try { new MutationObserver(function (m) { m.forEach(function (x) { for (var i = 0; i < x.addedNodes.length; i++) if (x.addedNodes[i].nodeType === 1) attach(x.addedNodes[i]); }); }).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
      say("LSPD portal sync on · roster loaded");
    }).catch(function () {});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", roster); else roster();
})();
