/* LSPD terminal lock — every officer page (portal home, My Reports, CID case builder, Division Command).
   After 10 minutes with no activity on ANY open portal tab, all tabs lock behind a blurred screen.
   Signed-on officers unlock with their 4-digit PIN (5 wrong tries = signed out); anyone without an account taps to unlock.
   The page underneath is untouched, so half-written reports are kept.
   Also keeps the officer's profile fresh (level, rank, divisions) and shows "Division Command" links to those allowed. */
(function () {
  "use strict";
  var IDLE_MS = 10 * 60 * 1000;
  var EMBED = false; try { EMBED = window.top !== window; } catch (e) { EMBED = true; }   // a page shown inside the MDT: the MDT draws the lock
  var LS = {
    get: function (k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } },
    set: function (k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} },
    json: function (k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var here = function () { return location.pathname.split("/").pop() + location.search + location.hash; };
  var toSignon = function () { location.replace("signon.html?next=" + encodeURIComponent(here())); };

  // ---------- profile: who is signed on, refreshed in the background every 10 minutes ----------
  function profile() { return LS.json("lspd_prof") || null; }
  function applyProfile() {
    var p = profile(), can = !!(LS.get("lspd_sess") && p && p.divisions && p.divisions.length);
    var els = document.querySelectorAll("[data-need-division]");
    for (var i = 0; i < els.length; i++) els[i].hidden = !can;
  }
  function refreshProfile() {
    var s = LS.get("lspd_sess");
    if (!s || !window.Portal || Date.now() - Number(LS.get("lspd_prof_at") || 0) < 10 * 60e3) return;
    LS.set("lspd_prof_at", String(Date.now()));
    Portal.post({ action: "acctMe", session: s }).then(function (r) {
      if (r && r.ok && r.profile) { LS.set("lspd_prof", JSON.stringify(r.profile)); applyProfile(); }
      else if (r && r.error === "AUTH") {                              // signed out by command, PIN reset, or expired
        LS.set("lspd_sess", ""); applyProfile();
        var g = LS.json("lspd_gate"); if (g && g.required) toSignon();
      }
    }).catch(function () {});
  }

  // ---------- activity shared across tabs ----------
  var lastLocal = Date.now(), lastWrite = 0;
  function poke() {
    if (isLocked()) return;
    lastLocal = Date.now();
    if (lastLocal - lastWrite > 15000) { lastWrite = lastLocal; LS.set("lspd_act", String(lastLocal)); }
  }
  ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart", "input"].forEach(function (ev) { addEventListener(ev, poke, { passive: true, capture: true }); });
  function idleFor() { return Date.now() - Math.max(lastLocal, Number(LS.get("lspd_act")) || 0); }
  function isLocked() { return LS.get("lspd_locked") === "1"; }

  // ---------- the lock screen ----------
  var root = null, clockT = null, pin = "", busy = false, actx = null;
  function click(f) {                                                  // small key click, made in code
    if (LS.get("lspd_sound") === "off") return;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); var t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      o.type = "triangle"; o.frequency.value = f || 1050; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.06); } catch (e) {}
  }
  function css() {
    if (document.getElementById("lspdLockCss")) return;
    var st = document.createElement("style"); st.id = "lspdLockCss";
    st.textContent = [
      ".lk{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px 16px;overflow:auto;background:rgba(6,9,14,.55);backdrop-filter:blur(18px) saturate(.7);-webkit-backdrop-filter:blur(18px) saturate(.7);color:#dfe6f2;font:14px/1.5 Inter,system-ui,sans-serif;animation:lkIn .35s ease-out}",
      "@keyframes lkIn{from{opacity:0}}",
      ".lk *{box-sizing:border-box;margin:0;padding:0}",
      ".lk-in{width:min(400px,100%);display:grid;justify-items:center;text-align:center}",
      ".lk-badge{width:110px;height:110px;object-fit:contain;filter:drop-shadow(0 0 24px rgba(63,127,255,.5))}",
      ".lk-h{margin-top:16px;display:flex;gap:10px;align-items:center;font:700 22px 'Barlow Condensed',Oswald,sans-serif;letter-spacing:.2em;color:#cfe0ff}",
      ".lk-h svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}",
      ".lk-time{margin-top:10px;font:600 46px/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.04em}",
      ".lk-date{margin-top:6px;color:#8592a8;font-size:13px;letter-spacing:.06em}",
      ".lk-who{margin:18px 0 14px;display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid rgba(160,184,220,.22);background:rgba(0,0,0,.25)}",
      ".lk-who .cs{font:600 13px 'JetBrains Mono',monospace;color:#cfe0ff;padding:3px 8px;border:1px solid rgba(63,127,255,.45);background:rgba(63,127,255,.12)}",
      ".lk-who small{display:block;color:#8592a8;font-size:12px;text-align:left}",
      ".lk-dots{display:flex;gap:16px;margin:4px 0 16px}",
      ".lk-dots i{width:15px;height:15px;border:2px solid rgba(160,184,220,.35);transform:rotate(45deg);transition:.12s}",
      ".lk-dots i.on{background:#3f7fff;border-color:#3f7fff;box-shadow:0 0 10px rgba(63,127,255,.6)}",
      ".lk-dots.bad{animation:lkShake .35s}.lk-dots.bad i{border-color:#ff5a5f}",
      "@keyframes lkShake{20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}",
      ".lk-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:min(270px,100%)}",
      ".lk-pad button{height:54px;border:1px solid rgba(160,184,220,.22);background:rgba(13,19,29,.85);color:#dfe6f2;font:600 21px 'JetBrains Mono',monospace;cursor:pointer}",
      ".lk-pad button:hover{border-color:rgba(63,127,255,.6)}.lk-pad button:active{background:rgba(63,127,255,.25)}",
      ".lk-pad button.fn{font:700 11px 'Barlow Condensed',sans-serif;letter-spacing:.16em;color:#8592a8}",
      ".lk-pad.busy{opacity:.5;pointer-events:none}",
      ".lk-msg{min-height:20px;margin-top:12px;font-size:13px;color:#ffb3b5}",
      ".lk-go{margin-top:6px;height:48px;padding:0 30px;border:0;background:#3f7fff;color:#fff;font:700 15px 'Barlow Condensed',sans-serif;letter-spacing:.18em;cursor:pointer}",
      ".lk-links{margin-top:14px;font-size:12.5px;color:#8592a8}.lk-links a{color:#8592a8;cursor:pointer;text-decoration:underline;text-underline-offset:3px}.lk-links a:hover{color:#dfe6f2}",
      ".lk-note{margin-top:10px;font-size:12px;color:#5d6a80}"
    ].join("\n");
    document.head.appendChild(st);
  }
  function tick() {
    if (!root) return; var d = new Date();
    root.querySelector(".lk-time").textContent = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    root.querySelector(".lk-date").textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  function paint() { if (!root) return; var ds = root.querySelectorAll(".lk-dots i"); for (var i = 0; i < ds.length; i++) ds[i].classList.toggle("on", i < pin.length); }
  function msg(t) { if (root) root.querySelector(".lk-msg").textContent = t || ""; }
  function signOutTo() { LS.set("lspd_sess", ""); LS.set("lspd_locked", ""); toSignon(); }
  function show() {
    if (EMBED) return;
    if (root || !document.body) return;
    css();
    var p = profile(), dev = LS.get("lspd_dev"), withPin = !!(dev && p);
    var title = p ? ((p.title || "Officer") + " " + String(p.name || "").split(/\s+/).pop()) : "";
    root = document.createElement("div"); root.className = "lk"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Terminal locked");
    root.innerHTML = '<div class="lk-in"><img class="lk-badge" src="img/lspd-badge.png" alt="">' +
      '<div class="lk-h"><svg viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>TERMINAL LOCKED</div>' +
      '<div class="lk-time">--:--:--</div><div class="lk-date"></div>' +
      (p ? '<div class="lk-who">' + (p.callsign ? '<span class="cs">' + esc(p.callsign) + "</span>" : "") + "<div><b>" + esc(title) + "</b><small>Enter your PIN to unlock</small></div></div>" : '<div style="height:18px"></div>') +
      (withPin ? '<div class="lk-dots"><i></i><i></i><i></i><i></i></div><div class="lk-pad">' + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button type="button" data-k="' + n + '">' + n + "</button>"; }).join("") +
        '<button type="button" class="fn" data-k="c">CLEAR</button><button type="button" data-k="0">0</button><button type="button" class="fn" data-k="b">⌫ BACK</button></div>'
        : '<button type="button" class="lk-go" data-unlock>UNLOCK TERMINAL</button>') +
      '<div class="lk-msg"></div>' +
      (withPin ? '<div class="lk-links"><a data-notme>Not you? Sign out</a></div>' : "") +
      '<p class="lk-note">Locked after 10 minutes away. Your work is still here.</p></div>';
    document.body.appendChild(root);
    tick(); clockT = setInterval(tick, 1000); pin = ""; busy = false;
    var pad = root.querySelector(".lk-pad");
    if (pad) pad.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) press(b.getAttribute("data-k")); });
    var u = root.querySelector("[data-unlock]"); if (u) u.onclick = function () { click(); unlock(); };
    var nm = root.querySelector("[data-notme]"); if (nm) nm.onclick = function () { LS.set("lspd_dev", ""); LS.set("lspd_prof", ""); LS.set("lspd_pinv", ""); signOutTo(); };
  }
  function press(k) {
    if (busy || !root) return;
    var dots = root.querySelector(".lk-dots"); if (!dots) return;
    click(); dots.classList.remove("bad"); msg("");
    if (k === "c") pin = ""; else if (k === "b") pin = pin.slice(0, -1); else if (pin.length < 4) pin += k;
    paint();
    if (pin.length === 4) submit();
  }
  // The PIN is checked right here on the device first (against a fingerprint saved at the last good sign-on),
  // so unlocking is instant even when Google is slow to wake up. Only a PIN that doesn't match (a new or reset PIN)
  // goes to the server, which keeps its own wrong-PIN limit.
  function pinMark(p) {
    var p0 = profile() || {};
    if (!window.crypto || !crypto.subtle || !window.TextEncoder) return Promise.resolve("");
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode("lspd-pin|" + LS.get("lspd_dev") + "|" + (p0.discordId || "") + "|" + p))
      .then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }).catch(function () { return ""; });
  }
  function remember(p) { return pinMark(p).then(function (h) { if (h) LS.set("lspd_pinv", h); }); }
  function submit() {
    busy = true; root.querySelector(".lk-pad").classList.add("busy");
    var p = pin, saved = LS.get("lspd_pinv");
    pinMark(p).then(function (h) {
      if (saved && h && h === saved) { LS.set("lspd_seen_at", String(Date.now())); click(1400); unlock(); return; }
      if (saved && h) { fail("Wrong PIN."); server(p, true); return; }   // keep the keypad free; the server still gets a say (a new or reset PIN)
      server(p);
    });
  }
  function server(p, quiet) {
    if (!quiet) msg("Checking your PIN with the server…");
    var done = false, t = setTimeout(function () { if (done) return; done = true; if (!quiet) fail("The LSPD server is slow to answer. Try your PIN again."); }, 20000);
    Portal.post({ action: "acctPin", device: LS.get("lspd_dev"), pin: p }).then(function (r) {
      if (done) return; done = true; clearTimeout(t);
      if (!root) return;
      if (quiet && !(r && r.ok) && !/Too many|Discord again|locked|signed out/i.test((r && r.error) || "")) return;
      if (r && r.ok) { LS.set("lspd_sess", r.session || ""); if (r.profile) LS.set("lspd_prof", JSON.stringify(r.profile)); LS.set("lspd_seen_at", String(Date.now())); remember(p); click(1400); unlock(); return; }
      var e = (r && r.error) || "Couldn't unlock.";
      if (/Too many|0 tries|Discord again|locked|signed out/i.test(e)) { msg(e + " Signing you out…"); setTimeout(signOutTo, 1600); return; }
      fail(e);
    }).catch(function () { if (done) return; done = true; clearTimeout(t); if (!quiet) fail("Couldn't reach the LSPD server. Try again."); });
  }
  function fail(t) {
    if (!root) return; busy = false; pin = ""; paint(); msg(t);
    var dots = root.querySelector(".lk-dots"), pad = root.querySelector(".lk-pad");
    if (pad) pad.classList.remove("busy");
    if (dots) { dots.classList.remove("bad"); void dots.offsetWidth; dots.classList.add("bad"); }
    click(220);
  }
  function hide() { clearInterval(clockT); if (root) { root.remove(); root = null; } }
  function lock() { if (!isLocked()) LS.set("lspd_locked", "1"); show(); }
  function unlock() { LS.set("lspd_locked", ""); lastLocal = Date.now(); LS.set("lspd_act", String(lastLocal)); hide(); }

  addEventListener("keydown", function (e) {
    if (!root) return;
    if (document.activeElement && document.activeElement.tagName === "IFRAME") try { document.activeElement.blur(); } catch (x) {}
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^\d$/.test(e.key)) { press(e.key); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === "Backspace") { press("b"); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === "Escape") { press("c"); e.preventDefault(); }
    else if (e.key === "Enter" && root.querySelector("[data-unlock]")) { unlock(); e.preventDefault(); }
    else if (e.key !== "Tab") e.preventDefault();                       // typing can't reach the form underneath
  }, true);
  // other tabs: lock and unlock together
  addEventListener("storage", function (e) { if (e.key === "lspd_locked") { if (e.newValue === "1") show(); else hide(); } if (e.key === "lspd_prof") applyProfile(); });
  setInterval(function () { if (!EMBED && !isLocked() && idleFor() > IDLE_MS) lock(); }, 15000);

  window.LSPDLock = { lock: lock, unlock: unlock, idleMs: IDLE_MS, remember: remember };
  if (EMBED) {
    addEventListener("keydown", function (e) { if (isLocked()) { e.preventDefault(); e.stopPropagation(); } }, true);
    addEventListener("storage", function (e) { if (e.key === "lspd_locked" && e.newValue === "1" && document.activeElement) try { document.activeElement.blur(); } catch (x) {} });
  }
  function boot() { applyProfile(); refreshProfile(); if (isLocked()) show(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  addEventListener("load", refreshProfile);
})();
