/* LSPD MDT — Discord ID check (portal owner only).
   The Duty Portal add-on reads who holds each callsign on the Duty Portal's Main and Cadets rosters (with their Discord IDs).
   The roster sheet's Personnel / Onboarding tabs are compared callsign by callsign, then every division tab by name,
   and the IDs you leave ticked are corrected on the roster sheet. */
(function () {
  "use strict";
  let B = null, LOADING = false, OFF = {}, ON = {}, POLL = null, BUSY = false, SHOW = "todo";
  const M = () => window.MDT, esc = s => M().esc(s);
  const ago = t => { if (!t) return "never"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
  const live = j => j && (j.st === "queued" || j.st === "working");
  async function call(action, extra) {
    const r = await Portal.post(Object.assign({ action: action, session: M().session }, extra || {})).catch(() => ({ ok: false, error: "Couldn't reach the server." }));
    return r || { ok: false, error: "No answer from the server." };
  }
  function load() { if (LOADING) return; LOADING = true; call("idBoard").then(r => { LOADING = false; B = r; M().draw(); watch(); }); }
  function watch() {
    if (!(B && B.ok && live(B.job)) || POLL) return;
    POLL = setInterval(() => { if (!document.querySelector(".id-wrap")) { clearInterval(POLL); POLL = null; return; }
      call("idBoard").then(r => { if (r.ok) { B = r; M().draw(); } if (!(r.ok && live(r.job))) { clearInterval(POLL); POLL = null; } }); }, 8000);
  }
  function jobChip(j) {
    if (!j) return "";
    const T = { queued: ["wait", "⏳ waiting for the add-on"], working: ["work", "🤖 " + (j.step || "working…")], done: ["ok", "✓ " + (j.msg || "done")], failed: ["bad", "⚠ " + (j.msg || "couldn't finish")] }[j.st] || ["wait", j.st];
    return '<span class="cd-job ' + T[0] + '">' + esc(T[1]) + "</span>";
  }
  const picked = x => x.to && x.row !== undefined && (x.st === "fix" ? !OFF[x.key] : !!ON[x.key]);
  function html() {
    if (!B && !LOADING) load();
    let h = '<div class="cd-wrap id-wrap"><div class="h2"><div><h1>DISCORD ID CHECK</h1><p><b>Step 1:</b> the Duty Portal add-on reads who holds each callsign on the Duty Portal\'s <b>Main</b> roster, with their Discord IDs, and every callsign on the roster sheet\'s Main (Personnel) roster is compared with it. <b>Step 2:</b> everyone on each division tab is matched by name to the corrected Main roster (or the Onboarding roster) and their Discord ID is checked. The Onboarding roster itself isn\'t checked against the Duty Portal, since not every cadet is on it. The IDs you leave ticked are corrected on the roster sheet.</p></div></div>';
    if (!B) return h + '<div class="pbx-empty">Loading…</div></div>';
    if (!B.ok) return h + '<div class="pbx-empty">' + esc(B.error === "AUTH" ? "Your MDT session expired. Sign on again." : B.error || "Couldn't load.") + "</div></div>";
    const sc = B.scan || {}, I = B.items || [];
    h += '<div class="cd-bar"><button class="pbx-btn" data-idscan' + (live(B.job) || !B.sync ? " disabled" : "") + ">" + (live(B.job) ? "CHECKING…" : "🔎 CHECK THE DUTY PORTAL NOW") + "</button>" +
      '<span class="cd-meta">' + (sc.at ? "Last read " + ago(sc.at) + " · " + (sc.n || 0) + " filled spots" : "The Duty Portal hasn't been read yet") + "</span>" + jobChip(B.job) + "</div>";
    if (!B.sync) h += '<div class="cd-warn">The Duty Portal add-on isn\'t set up yet, so it can\'t read the rosters.</div>';
    { const A = B.addon || {}, ver = A.v ? Math.floor(A.v / 100) + "." + Math.floor(A.v / 10) % 10 + "." + A.v % 10 : "?";
      const quiet = !A.at || Date.now() - A.at > 3 * 60e3;
      h += '<div class="' + (quiet || A.v < 160 ? "cd-warn" : "cd-meta id-hb") + '">🤖 Add-on: ' + (A.at ? "version " + ver + ", last checked in " + ago(A.at) : "hasn't checked in yet") +
        (A.v && A.v < 160 ? " — <b>it needs 1.6.0 for this check.</b> Update it in Tampermonkey, then reload the Duty Portal tab." : quiet ? " — <b>it isn't running right now.</b> Open the Duty Portal (logged in) in the browser where the add-on is installed, and make sure it isn't paused." : " — it picks up the check within a minute.") + "</div>"; }
    if (B.error) h += '<div class="cd-warn">' + esc(B.error) + "</div>";
    if (!sc.at) return h + '<div class="pbx-empty">Press <b>Check the Duty Portal now</b>. The add-on (version 1.6.0 or newer) reads the Main roster, changes nothing there, and the differences show up here in a minute or two.</div></div>';
    const n = k => I.filter(x => x.st === k).length;
    h += '<div class="cd-sum"><span class="pbx-chip info">🔧 ' + n("fix") + ' to correct</span><span class="pbx-chip warn">👀 ' + n("review") + ' to look at</span><span class="pbx-chip no">❔ ' + n("missing") + " not matched</span>" +
      '<span class="id-tabs">' + [["todo", "To correct & review"], ["missing", "Not matched"], ["all", "Everything"]].map(t => '<button class="' + (SHOW === t[0] ? "on" : "") + '" data-idshow="' + t[0] + '">' + t[1] + "</button>").join("") + "</span></div>";
    const list = I.filter(x => SHOW === "all" || (SHOW === "todo" ? x.st !== "missing" : x.st === "missing"));
    if (!list.length) h += '<div class="pbx-empty">' + (SHOW === "missing" ? "Everyone was matched." : "Every Discord ID on the roster sheet matches the Duty Portal.") + "</div>";
    else h += '<div class="cd-tbl id-tbl"><div class="cd-hd"><span></span><span>TAB · SPOT</span><span>OFFICER</span><span>ON THE SHEET</span><span>SHOULD BE</span><span>WHY</span></div>' + list.map(x => {
      const can = x.to && x.row !== undefined, on = picked(x);
      return '<label class="cd-r id-r ' + x.st + '"><span>' + (can ? '<input type="checkbox" data-idk="' + esc(x.key) + '" data-st="' + x.st + '"' + (on ? " checked" : "") + ">" : "") + "</span>" +
        "<span><small>" + esc(x.tab) + "</small><code>" + esc(x.cs || "—") + "</code></span><span><b>" + esc(x.name) + "</b>" + (x.dpWho ? "<small>Duty Portal: " + esc(x.dpWho) + "</small>" : "") + "</span>" +
        '<span class="id-v' + (x.to ? " old" : "") + '">' + (x.from ? esc(x.from) : "<i>blank</i>") + "</span>" +
        '<span class="id-v new">' + (x.to ? esc(x.to) : "—") + "</span><span class=\"id-why\">" + (x.st === "review" ? "👀 " : x.st === "missing" ? "❔ " : "") + esc(x.why) + "</span></label>";
    }).join("") + "</div>";
    const todo = I.filter(picked);
    if (I.some(x => x.to && x.row !== undefined)) h += '<div class="cd-foot"><span>' + todo.length + " Discord ID" + (todo.length === 1 ? "" : "s") + " ticked. They're written straight onto the roster sheet; a cell that changed since the check is skipped. \"Look at\" rows are left unticked — tick them only if you're sure.</span>" +
      '<button class="pbx-btn" data-idfix' + (todo.length && !BUSY ? "" : " disabled") + ">" + (BUSY ? "FIXING…" : "CORRECT " + todo.length + " ID" + (todo.length === 1 ? "" : "S")) + "</button></div>";
    return h + "</div>";
  }
  document.addEventListener("change", e => {
    const t = e.target; if (!(t.matches && t.matches("[data-idk]"))) return; const k = t.dataset.idk;
    if (t.dataset.st === "fix") { if (t.checked) delete OFF[k]; else OFF[k] = 1; } else { if (t.checked) ON[k] = 1; else delete ON[k]; }
    M().draw();
  });
  document.addEventListener("click", e => {
    const t = e.target; if (!t.closest || !document.querySelector(".id-wrap")) return;
    const sh = t.closest("[data-idshow]"); if (sh) { SHOW = sh.dataset.idshow; M().draw(); return; }
    if (t.closest("[data-idscan]")) { B.job = { st: "queued" }; M().draw();
      call("idScan").then(r => { if (!r.ok) { M().toast(r.error || "Couldn't start the check."); B.job = null; M().draw(); return; } M().toast("Sent to the Duty Portal add-on. It usually takes a minute or two."); load(); }); return; }
    if (t.closest("[data-idfix]")) {
      const keys = (B.items || []).filter(picked).map(x => x.key); if (!keys.length || BUSY) return;
      BUSY = true; M().draw();
      call("idFix", { keys: keys }).then(r => { BUSY = false; OFF = {}; ON = {};
        if (!r.ok) M().toast(r.error || "Couldn't fix them."); else M().toast("✓ " + r.done.length + " Discord ID" + (r.done.length === 1 ? "" : "s") + " corrected" + (r.skipped.length ? " · " + r.skipped.length + " skipped" : "") + ".");
        load(); });
    }
  });
  window.MDTIds = { html: html, reload: () => { B = null; load(); } };
  if (/^#idcheck$/.test(location.hash) && window.MDT) window.MDT.draw();
})();
