/* LSPD MDT — Promotion board (Lieutenants and up).
   Left: every Personnel officer, their next rank and what's open. The terminal ticks what it can count itself.
   Right: the promotion list. LT – Commander put officers on it (drag or →); High Command approves and pushes. */
(function () {
  "use strict";
  let LS_NL = false;
  document.addEventListener("click", e => { if (e.target.closest && e.target.closest(".pbx-nl summary [data-copy]")) e.preventDefault(); }, true);   // copying the list shouldn't fold it
  document.addEventListener("toggle", e => { if (e.target.classList && e.target.classList.contains("pbx-nl")) LS_NL = e.target.open; }, true);
  let B = null, LOADING = false, Q = "", RF = "all", SHOW = "all", OPEN = {}, BUSY = false, DRAG = "";
  const M = () => window.MDT;
  const esc = s => M().esc(s);
  const H = m => (m / 60).toFixed(m % 60 ? 1 : 0).replace(/\.0$/, "");
  const ago = t => { const d = Math.floor((Date.now() - t) / 864e5); return d <= 0 ? "today" : d === 1 ? "yesterday" : d + "d ago"; };
  const day = t => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  async function call(action, extra) {
    const r = await Portal.post(Object.assign({ action: action, session: M().session }, extra || {})).catch(() => ({ ok: false, error: "Couldn't reach the server." }));
    if (r && r.ok && r.officers) B = r;
    return r || { ok: false, error: "No answer from the server." };
  }
  function load() { if (LOADING) return; LOADING = true; call("pbBoard").then(r => { LOADING = false; if (!r.ok) B = r; M().draw(); }); }

  // ---------- pieces ----------
  function ring(done, total, ready) {
    const p = total ? done / total : 0, C = 2 * Math.PI * 17;
    return '<svg class="pbx-ring' + (ready ? " ok" : "") + '" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><circle class="v" cx="20" cy="20" r="17" style="stroke-dasharray:' + (C * p).toFixed(1) + " " + C.toFixed(1) + '"/>' +
      '<text x="20" y="21">' + (ready ? "✓" : done + "/" + total) + "</text></svg>";
  }
  function chips(o) {
    const it = k => o.items.find(x => x.auto === k), h = it("hours"), r = it("reports14"), t = it("tig"), out = [];
    if (o.linked === false) out.push('<span class="pbx-chip nolink" title="Not matched by the Duty Portal sync and never signed in with Discord, so their duty hours aren\'t counted yet.">🔗 NOT TRACKED</span>');
    if (h) out.push('<span class="pbx-chip ' + (h.done ? (h.warn ? "warn" : "ok") : "no") + '" title="' + esc(h.t + (h.warn ? " · " + h.warn : "")) + '">⏱ ' + H(h.have) + "/" + H(h.need) + "h" + (h.warn ? " ⚠" : "") + "</span>");
    if (r) out.push('<span class="pbx-chip ' + (r.done ? "ok" : "no") + '" title="' + esc(r.t) + '">📝 ' + r.have + "/" + r.need + "</span>");
    if (t) out.push('<span class="pbx-chip ' + (t.done ? "ok" : "no") + '" title="Time in grade">TIG ' + (t.have == null ? "—" : t.have) + "/" + t.need + "d</span>");
    return out.join("");
  }
  function status(o) {
    if (o.ready) return '<span class="pbx-st ready">★ ALL REQUIREMENTS MET</span>';
    if (o.terminal) return '<span class="pbx-st term">✓ TERMINAL CONFIRMED</span>' + (o.openManual ? '<span class="pbx-st need">' + o.openManual + " sign-off" + (o.openManual > 1 ? "s" : "") + " needed</span>" : "");
    return '<span class="pbx-st open">' + (o.total - o.done) + " open</span>";
  }
  function detail(o) {
    const canTick = B.me.nominate;
    return '<div class="pbx-det">' + o.items.map(x => {
      const man = !x.auto, can = man && canTick, by = x.manual && x.by ? "Signed off by " + x.by : x.auto && x.done ? "Counted by the terminal" : "";
      let extra = "";
      if (x.auto === "reports14" && x.split) extra = '<div class="pbx-src">' + x.split.mdt + " from MDT forms · " + x.split.dp + " from the Duty Portal" + (x.split.rb ? " · " + x.split.rb + " from the Report Builder" : "") + (x.split.both ? " · " + x.split.both + " seen twice (counted once)" : "") + "</div>" +
        (x.list && x.list.length ? '<div class="pbx-rl">' + x.list.map(r => "<span><i>" + esc(r.src) + "</i>" + day(r.at) + " · " + esc(r.t || "Report") + "</span>").join("") + "</div>" : "");
      else if (x.auto === "hours" && o.linked === false) extra = '<div class="pbx-warn">🔗 Not tracked: the Duty Portal sync hasn\'t matched them and they\'ve never signed in to the portal with Discord, so on-duty time isn\'t being counted yet.</div>';
      if (x.auto === "hours" && x.src && o.linked !== false) extra = '<div class="pbx-src">' + (x.src === "dp" ? "From the Duty Portal (in-game clock-in/out)" : x.src === "role" ? "From the On Duty Discord role (Duty Portal hasn't seen them yet)" : "No duty time recorded yet") + "</div>";
      if (x.auto === "hours" && o.linked === false) {}
      else if (x.auto === "hours" && x.weeks) extra += '<div class="pbx-wk">' + x.weeks.slice().reverse().map(w => '<span class="' + (w.low ? "low" : w.cur ? "cur" : "") + '">' + (w.to ? day(w.from) + " – " + day(w.to) : "Week of " + day(w.from)) + (w.cur ? " (this week)" : "") + ": <b>" + H(w.min) + "h</b></span>").join("") + "</div>" + (x.warn ? '<div class="pbx-warn">⚠ Total met, but ' + esc(x.warn) + ".</div>" : "");
      const val = x.auto === "hours" ? H(x.have) + " / " + H(x.need) + " h" : x.auto && x.need ? (x.have == null ? "—" : x.have) + " / " + x.need : "";
      return '<div class="pbx-it' + (x.done ? " ok" : "") + (man ? " man" : "") + '">' +
        (can ? '<button class="pbx-box" data-pbcheck="' + esc(o.id) + "|" + esc(x.key) + "|" + (x.done ? 0 : 1) + '" title="' + (x.done ? "Undo sign-off" : "Sign off") + '">' + (x.done ? "✓" : "") + "</button>"
             : '<span class="pbx-box ro">' + (x.done ? "✓" : "") + "</span>") +
        '<div><b>' + esc(x.t) + '</b><small>' + (x.auto ? '<i class="pbx-auto">AUTO</i>' : '<i class="pbx-man">COMMAND SIGN-OFF</i>') + (x.extra ? '<i class="pbx-man">BOARD</i>' : "") + esc(by) + "</small>" + extra + "</div>" +
        (val ? '<em>' + esc(val) + "</em>" : "") + "</div>";
    }).join("") + "</div>";
  }
  function officerCard(o) {
    const on = !!o.entry, can = B.me.nominate && o.canNominate && !on;
    return '<article class="pbx-o' + (o.ready ? " ready" : o.terminal ? " term" : "") + (on ? " listed" : "") + (OPEN[o.id] ? " open" : "") + '" data-pbo="' + esc(o.id) + '"' + (can ? ' draggable="true"' : "") + ">" +
      '<div class="pbx-row">' + ring(o.done, o.total, o.ready) +
      '<div class="pbx-who"><div class="pbx-nm">' + (o.callsign ? "<code>" + esc(o.callsign) + "</code>" : "") + "<b>" + esc(o.name) + "</b></div>" +
      '<div class="pbx-rk">' + esc(o.rank) + ' <span>→</span> <b>' + esc(o.next) + "</b></div>" +
      '<div class="pbx-chips">' + chips(o) + status(o) + "</div></div>" +
      (on ? '<span class="pbx-tag">' + (o.entry.status === "approved" ? "✓ APPROVED" : "ON LIST") + "</span>" : can ? '<button class="pbx-add" data-pbadd="' + esc(o.id) + '" title="Put up for ' + esc(o.next) + '">→</button>' : "") +
      "</div>" + (OPEN[o.id] ? detail(o) : "") + "</article>";
  }
  function listCard(o) {
    const e = o.entry, ap = e.status === "approved", me = B.me;
    const mine = e.mine || (e.by && me.callsign && e.by.indexOf("(" + me.callsign + ")") !== -1);
    return '<article class="pbx-l' + (ap ? " ap" : "") + (o.ready ? "" : " warn") + '" data-pbl="' + esc(o.id) + '">' +
      '<div class="pbx-row">' + ring(o.done, o.total, o.ready) +
      '<div class="pbx-who"><div class="pbx-nm">' + (o.callsign ? "<code>" + esc(o.callsign) + "</code>" : "") + "<b>" + esc(o.name) + "</b></div>" +
      '<div class="pbx-rk">' + esc(o.rank) + ' <span>→</span> <b>' + esc(o.next) + "</b></div>" +
      '<small class="pbx-by">Put up by ' + esc(e.by) + " · " + ago(e.at) + (ap ? '<br><span class="ok">✓ Approved by ' + esc(e.apBy) + "</span>" : "") + "</small>" +
      (e.note ? '<p class="pbx-note">“' + esc(e.note) + "”</p>" : "") + (o.ready ? "" : '<p class="pbx-miss">⚠ ' + (o.total - o.done) + " requirement" + (o.total - o.done > 1 ? "s" : "") + " still open</p>") + "</div></div>" +
      '<div class="pbx-acts">' + (me.hc ? '<button class="pbx-btn ' + (ap ? "on" : "go") + '" data-pbapprove="' + esc(o.id) + "|" + (ap ? 0 : 1) + '">' + (ap ? "✓ APPROVED" : "APPROVE") + "</button>" : '<span class="pbx-wait">' + (ap ? "✓ Approved · waiting to be pushed" : "Waiting on High Command") + "</span>") +
      (me.hc || mine ? '<button class="pbx-btn ghost" data-pbremove="' + esc(o.id) + '" title="Take off the list">↩ RETURN</button>' : "") + "</div></article>";
  }

  // ---------- page ----------
  function html() {
    let h = '<div class="h2"><div><h1>PROMOTION BOARD</h1><p>Pick who moves up. The terminal checks hours, reports and time in grade. Command signs off the rest. High Command approves and pushes it to the roster.</p></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (B && B.ok && B.me.editor ? '<button class="btn ghost" data-pbrules>⚙ REQUIREMENTS</button>' : "") + '<button class="btn ghost" data-pbrefresh>↻ REFRESH</button></div></div>';
    if (!B) { load(); return h + '<div class="boot"><i></i>LOADING THE PROMOTION BOARD…</div>'; }
    if (!B.ok) return h + '<div class="empty">' + esc(B.error === "AUTH" ? "Sign on again to open the board." : B.error || "Couldn't load the board.") + "</div>";
    const all = B.officers, listed = all.filter(o => o.entry), ap = listed.filter(o => o.entry.status === "approved");
    h += '<div class="pbx-stats">' +
      [["Officers", all.length, ""], ["Terminal ✓", all.filter(o => o.terminal).length, "term"], ["All met", all.filter(o => o.ready).length, "ready"], ["On the list", listed.length, "list"], ["Approved", ap.length, "ap"], ["Not tracked", (B.unlinked || []).length, "nl"]]
        .map(s => '<div class="' + s[2] + '"><b>' + s[1] + "</b><small>" + s[0] + "</small></div>").join("") + "</div>";
    if (B.period) { const P = B.period, fmt = t => new Date(t).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
      h += '<div class="pbx-period' + (P.review ? " review" : "") + '"><span>' + (P.review ? "🎖️" : "🗓️") + "</span><div><b>" + (P.review ? "Promotion day: reviewing the period that just closed" : "Counting toward " + fmt(P.end).replace(/,? \d+:\d+ [AP]M$/, "") + " promotions") + "</b><small>Hours and reports from " + fmt(P.start) + " to " + fmt(P.end) + " ET. Weeks run Friday 2 PM to Friday 2 PM." +
        (P.review ? " The new period starts counting tomorrow at 2 PM." : "") + "</small></div></div>"; }
    h += dpBar();
    if (B.slotError) h += '<div class="pbx-alert">⚠ Couldn\'t read the Personnel roster: ' + esc(B.slotError) + "</div>";
    // rank filter
    h += '<div class="pbx-ranks"><button data-pbrf="all" class="' + (RF === "all" ? "on" : "") + '">ALL RANKS <small>' + all.length + "</small></button>" +
      B.ranks.filter(r => all.some(o => o.idx === r.idx)).map(r => '<button data-pbrf="' + r.idx + '" class="' + (String(RF) === String(r.idx) ? "on" : "") + '" title="' + r.open + " open " + esc(r.next) + ' slot(s) on the roster">' + esc(r.abbr) + " → " + esc(nextAbbr(r.idx)) + " <small>" + all.filter(o => o.idx === r.idx).length + '</small><i class="' + (r.open ? "" : "no") + '">' + r.open + " open</i></button>").join("") + "</div>";
    const q = Q.trim().toLowerCase();
    let left = all.filter(o => !o.entry && (RF === "all" || String(o.idx) === String(RF)) && (!q || (o.name + " " + o.callsign + " " + o.rank).toLowerCase().indexOf(q) !== -1));
    if (SHOW === "term") left = left.filter(o => o.terminal); if (SHOW === "ready") left = left.filter(o => o.ready); if (SHOW === "nl") left = left.filter(o => o.linked === false);
    left.sort((a, b) => (b.ready - a.ready) || (b.terminal - a.terminal) || (b.done / (b.total || 1) - a.done / (a.total || 1)) || b.idx - a.idx);
    const right = listed.filter(o => RF === "all" || String(o.idx) === String(RF)).sort((a, b) => b.idx - a.idx || csN(a) - csN(b));
    h += '<div class="pbx">' +
      '<section class="pbx-col"><header><span class="lbl">Officers</span><div class="pbx-tools"><input id="pbQ" placeholder="Search name or callsign" value="' + esc(Q) + '">' +
      '<div class="seg"><button data-pbshow="all" class="' + (SHOW === "all" ? "on" : "") + '">ALL</button><button data-pbshow="term" class="' + (SHOW === "term" ? "on" : "") + '">TERMINAL ✓</button><button data-pbshow="ready" class="' + (SHOW === "ready" ? "on" : "") + '">ALL MET</button><button data-pbshow="nl" class="' + (SHOW === "nl" ? "on" : "") + '">NOT TRACKED</button></div></div></header>' +
      '<div class="pbx-body">' + (left.length ? left.map(officerCard).join("") : '<div class="empty">No one here' + (q ? " matches that search" : "") + ".</div>") + "</div></section>" +
      '<section class="pbx-col list" data-pbdrop><header><span class="lbl">Promotion list</span><small>' + (B.me.nominate ? "Drag officers here or press →" : "") + "</small></header>" +
      '<div class="pbx-body">' + (right.length ? groupBy(right).map(g => '<div class="pbx-grp">' + esc(g.to) + " <small>" + g.list.length + " · " + g.open + " open slot" + (g.open === 1 ? "" : "s") + "</small></div>" + g.list.map(listCard).join("")).join("")
        : '<div class="pbx-drop"><span>🎖️</span><b>No one on the list yet</b><small>' + (B.me.nominate ? "Drag an officer across to put them up for promotion." : "Command adds officers here.") + "</small></div>") + "</div>" +
      (B.me.hc ? '<footer><button class="btn pbx-push' + (ap.length ? "" : " off") + '" data-pbpush>🎖️ PUSH ' + ap.length + " PROMOTION" + (ap.length === 1 ? "" : "S") + "</button><small>Updates the roster, highest ranks first.</small></footer>"
        : '<footer><small>' + (ap.length ? ap.length + " approved, waiting for High Command to push." : "High Command approves and pushes promotions.") + "</small></footer>") +
      "</section></div>";
    h += followUps() + unlinkedHTML();
    return h;
  }
  // Duty Portal sync status (the browser add-on that reads portal.vanitydesigns.cloud)
  function dpBar() {
    const D = B.dp, mins = D ? Math.round((Date.now() - D.at) / 60000) : 0, stale = D && mins > 60, can = !!B.me.dpOwner;
    const when = !D ? "" : mins < 1 ? "just now" : mins < 60 ? mins + " min ago" : mins < 1440 ? Math.round(mins / 60) + " h ago" : Math.round(mins / 1440) + " days ago";
    return '<div class="pbx-dp' + (!D ? " off" : stale ? " stale" : "") + '"><span>' + (!D ? "🔌" : stale ? "⏳" : "🛰️") + "</span><div><b>" +
      (!D ? "Duty Portal sync isn't set up" : "Duty Portal data updated " + when + (D.by ? " · by " + esc(D.by) : "")) + "</b><small>" +
      (!D ? "Hours come only from the On Duty role for officers who signed in with Discord. Set up the sync to count every officer's in-game hours and Duty Portal reports."
        : D.matched + " officers matched by Discord ID" + (D.officers ? " · " + D.onDuty + " on duty of " + D.officers + " active" : "") + (stale ? " · Open the Duty Portal in a browser with the add-on to refresh, especially before a Friday push." : "")) +
      "</small></div>" + (can ? '<button class="pbx-btn ghost" data-dpsetup>' + (D ? "SYNC SETUP" : "SET UP") + "</button>" : "") + "</div>";
  }
  function dpSetup() {
    const m = M().modal('<h3 style="font:700 24px Barlow Condensed,sans-serif;letter-spacing:.05em">DUTY PORTAL SYNC</h3>' +
      '<p style="color:var(--mute);font-size:13.5px;line-height:1.5">A small add-on reads the Duty Portal in <b>your own browser</b>, where you\'re already signed in, and sends hours, shifts and reports here every 10 minutes while a Duty Portal tab is open. It never sees your password.</p>' +
      '<ol class="pbx-steps"><li>Install <b>Tampermonkey</b> in Chrome: <a href="https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo" target="_blank" rel="noopener">Chrome Web Store</a>. Then in Chrome\'s extension settings, turn on <b>Allow user scripts</b> for Tampermonkey if Chrome asks.</li>' +
      '<li><a href="tools/lspd-duty-sync.user.js" target="_blank" rel="noopener"><b>Install the LSPD sync script</b></a> and press <b>Install</b> in Tampermonkey.</li>' +
      '<li>Make your sync key and copy it:<div class="pbx-key"><code id="dpKey">Not made yet</code><button class="pbx-btn go" id="dpMake">MAKE A SYNC KEY</button></div><small>Keep it private: anyone with it can send duty data to the board. If a key ever leaks, revoke it below.</small></li>' +
      '<li>Open the <a href="https://portal.vanitydesigns.cloud/portal/lspd/officers" target="_blank" rel="noopener">Duty Portal</a>, click the <b>LSPD sync</b> badge in the bottom-right corner and paste the key. The first sync reads every active officer (a few minutes), then it keeps up on its own.</li></ol>' +
      '<div class="pbx-keys"><b>Sync keys in use</b><div id="dpKeys"><small>Loading…</small></div></div>' +
      '<p style="color:var(--mute);font-size:12.5px">Leave a Duty Portal tab open (pinned) while you play. If the computer is off, nothing is lost: the next sync picks up the shifts it missed.</p>' +
      '<div style="display:flex;justify-content:flex-end"><button class="btn" data-close>DONE</button></div>');
    m.querySelector(".md-box").style.width = "min(640px,100%)";
    const keysBox = m.querySelector("#dpKeys"), when = t => t ? new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never";
    const drawKeys = K => { keysBox.innerHTML = !K || !K.length ? "<small>No keys yet.</small>" : K.map(k => '<div class="pbx-kr"><div><code>…' + esc(k.id.slice(0, 6)) + "</code> made by " + esc(k.by || "—") + "<small>Made " + when(k.at) + " · last used " + when(k.used) + '</small></div><button class="pbx-btn ghost" data-revoke="' + esc(k.id) + '">REVOKE</button></div>').join("");
      keysBox.querySelectorAll("[data-revoke]").forEach(b => b.onclick = async () => {
        if (!confirm("Revoke this sync key? Any add-on using it stops syncing until it gets a new key.")) return;
        b.disabled = true; const r = await call("pbSyncRevoke", { id: b.dataset.revoke }); if (r.ok) { drawKeys(r.keys); M().toast("Key revoked"); } else { b.disabled = false; M().toast(r.error || "Couldn't revoke."); } }); };
    call("pbSyncKeys").then(r => { if (r.ok) drawKeys(r.keys); else keysBox.innerHTML = "<small>" + esc(r.error || "Couldn't load keys.") + "</small>"; });
    m.querySelector("#dpMake").onclick = async e => {
      e.target.disabled = true; e.target.textContent = "MAKING…";
      const r = await call("pbSyncKey");
      if (!r.ok) { e.target.disabled = false; e.target.textContent = "TRY AGAIN"; return M().toast(r.error || "Couldn't make a key."); }
      const k = m.querySelector("#dpKey"); k.textContent = r.key; if (r.keys) drawKeys(r.keys); e.target.textContent = "COPY"; e.target.disabled = false;
      e.target.onclick = () => { try { navigator.clipboard.writeText(r.key); M().toast("Sync key copied"); } catch (x) {} };
      try { navigator.clipboard.writeText(r.key); M().toast("Sync key copied"); } catch (x) {}
    };
  }
  function csN(o) { const m = /(\d+)/.exec(o.callsign || ""); return m ? +m[1] : 1e9; }
  function nextAbbr(i) { const n = B.ranks.find(z => z.idx === i + 1); return n ? n.abbr : "CMDR"; }
  function groupBy(list) {
    const g = [];
    list.forEach(o => { let x = g.find(y => y.idx === o.idx); if (!x) { const r = B.ranks.find(z => z.idx === o.idx); x = { idx: o.idx, to: o.next, open: r ? r.open : 0, list: [] }; g.push(x); } x.list.push(o); });
    return g;
  }
  // everyone on the rosters who hasn't signed in with Discord (their duty hours aren't tracked until they do)
  function unlinkedHTML() {
    const U = B.unlinked || []; if (!U.length) return "";
    const txt = U.map(u => (u.callsign ? u.callsign + " | " : "") + u.name).join("\n");
    return '<div class="sect"><span class="lbl">Not tracked · ' + U.length + "</span></div>" +
      '<details class="pbx-nl"' + (LS_NL ? " open" : "") + '><summary><span>🔗</span><div><b>' + U.length + " officer" + (U.length === 1 ? " isn't" : "s aren't") + " being tracked</b><small>The Duty Portal sync hasn't matched them" + (B.dp ? "" : " (it isn't set up yet)") + " and they've never signed in to the portal with Discord, so their hours show 0 here. Either fixes it: the sync matches anyone active on the Duty Portal, or they sign in once (portal → Sign in with Discord → set a PIN).</small></div>" +
      '<button class="pbx-btn ghost" data-copy="' + esc(txt) + '" data-what="Not-linked list">COPY LIST</button></summary>' +
      '<div class="pbx-nl-list">' + U.map(u => "<span>" + (u.callsign ? "<code>" + esc(u.callsign) + "</code>" : "") + esc(u.name) + "<small>" + esc(u.rank) + "</small></span>").join("") + "</div></details>";
  }

  // ---------- Discord promotion announcement (the department's own layout) ----------
  const ANN_HEAD = ".                                                                     **==================================================**\n                                                                                 <:LSPD:1307846633160966265> ** LOS SANTOS POLICE DEPARTMENT ** <:LSPD:1307846633160966265>\n                                                                                             ** PROMOTION ANNOUNCEMENT**\n                                                                      **==================================================**\n\nCongratulations to all the officers below that have dedicated time and effort to our department. Your efforts do not go unnoticed, and I am extremely happy to see you continue moving up the ranks. These promotions and your new ranks mean increased responsibilities, and the standards to which you are being held accountable also go up.\n\n## All, join me in congratulating these officers on their well-deserved promotions!\n\n", ANN_FOOT = "\n\n> ### Keep setting the bar, stay hungry, and lead from the front.\n> \n> ###  \"Leadership in this department isn't defined by a badge or a stripe, but by the standards you hold when no one is watching\"\n\n> **If you think that you have met the requirements but we might have missed you, or forgot to log the reports on Discord, please open a https://discord.com/channels/1176588747991699536/1428779501055246498 and one of our COMMAND+ members will gladly assist you (Supervisor+ open a High Command Ticket). Before you do that, make sure you review the Promotion Guidelines, found here.**\n\n <@&1176588748016848957> \n\n__*Signed,*__\n__**LSPD Executive Oversight High Command Team & Command Team**__ <:Americanflagpins__1_r:1441901624032362538>";
  const ANN_ABBR = ["PO", "PO2", "PO3", "CPL", "SGT", "SSGT", "SGM", "LT", "CPT", "MJR", "CMDR"];
  const ANN_LBL = ["PO", "PO2", "PO3", "CPL", "SGT", "SSGT", "SGM", "Lieutenant", "Captain", "Major", "Commander"];
  const ANN_ARROW = "<a:55607redarrowright:1441883493574508665>";
  function annIdx(r) { if (r.fromIdx != null && !isNaN(r.fromIdx)) return Number(r.fromIdx); const k = (B.ranks || []).find(x => x.name === r.from); return k ? k.idx : 0; }
  function announcement(list) {
    const cats = [["Command Promotions", i => i >= 7], ["Supervisory Promotions", i => i >= 4 && i <= 6], ["Supervisor in Training", i => i === 3], ["Officer Promotions", i => i <= 2]];
    const num = c => { const m = /(\d+)/.exec(c || ""); return m ? +m[1] : 1e9; };
    const rows = list.map(r => { const f = annIdx(r), name = String(r.officer || "").replace(/^.*\|\s*/, "").trim().replace(/([a-z])\s?R[AM]$/, "$1");   // roster tags like "RM"/"RA" aren't part of the name
      return { f: f, t: f + 1, cs: r.oldCs || "", line: (r.oldCs ? r.oldCs + " | " : "") + ANN_ABBR[f] + " " + name + " | LSPD  " + ANN_ARROW + " " + (r.id ? "<@" + r.id + ">" : "") }; });
    let body = "";
    cats.forEach(([title, test]) => {
      const C = rows.filter(r => test(r.t)); if (!C.length) return;
      body += "\n__" + title + ":__\n\n";
      const steps = [...new Set(C.map(r => r.f))].sort((a, b) => b - a);
      steps.forEach(f => { body += ANN_LBL[f] + " ---> " + (ANN_LBL[f + 1] || "") + "\n" + C.filter(r => r.f === f).sort((a, b) => num(a.cs) - num(b.cs)).map(r => r.line).join("\n\n") + "\n\n"; });
    });
    return ANN_HEAD + body.replace(/\n+$/, "") + ANN_FOOT;
  }
  // PO → PO II during the week (not the Friday promotions): FTO Command's "Probationary Move Up"
  const PROB_HEAD = "# Probationary Move UP *!* \n\n### Congratulations to the following Officer for successfully completing all training requirements! \n\n\n", PROB_FOOT = "\n\n\n**Welcome to full duty!**\n\nEveryone (<@&1176588748016848957>) , please join us in congratulating them and wishing them the best as they hit the streets. Stay safe out there! \ud83d\ude94\n\nSigned,\n_LSPD FTO Command_\n\n\nCongratulations! <a:Yay:1542189362890940556> <a:clap:1063927446124113970>";
  function probAnnouncement(list) {
    const num = c => { const m = /(\d+)/.exec(c || ""); return m ? +m[1] : 1e9; };
    const po = list.filter(r => annIdx(r) === 0).sort((a, b) => num(a.oldCs) - num(b.oldCs));
    return PROB_HEAD + po.map(r => { const name = String(r.officer || "").replace(/^.*\|\s*/, "").trim().replace(/([a-z])\s?R[AM]$/, "$1");
      return "- " + (r.oldCs ? r.oldCs + " | " : "") + "PO " + name + " | LSPD                               <a:mwrp_arrow_right:1393248238592720986>                         " + (r.id ? "<@" + r.id + ">" : "") + "     "; }).join("\n\n") + PROB_FOOT;
  }
  function lastBatch() { const R = (B.recent || []).slice().sort((a, b) => b.at - a.at); if (!R.length) return []; const t = R[0].at; return R.filter(r => t - r.at < 20 * 60e3); }
  function copyAnn(list, kind) {
    if (kind === "prob") list = list.filter(r => annIdx(r) === 0);
    if (!list.length) return M().toast("No promotions to announce yet.");
    const txt = kind === "prob" ? probAnnouncement(list) : announcement(list);
    const done = () => M().toast("📋 Announcement copied (" + list.length + " officer" + (list.length === 1 ? "" : "s") + "). Paste it in Discord.");
    try { navigator.clipboard.writeText(txt).then(done, () => annBox(txt)); } catch (e) { annBox(txt); }
  }
  function annBox(txt) { const m = M().modal('<h3 style="font:700 22px Barlow Condensed,sans-serif">PROMOTION ANNOUNCEMENT</h3><textarea style="width:100%;height:50vh;border-radius:10px;background:#0b1220;color:var(--tx);border:1px solid var(--line2);padding:10px;font:12px JetBrains Mono,monospace">' + esc(txt) + '</textarea><div style="display:flex;justify-content:flex-end"><button class="btn" data-close>DONE</button></div>'); const t = m.querySelector("textarea"); t.focus(); t.select(); }
  // the Duty Portal add-on updating the Duty Portal roster after "Mark done"
  function dpChip(r, canTick) {
    const j = r.dpJob; if (!j) return "";
    const what = j.kind === "move" ? "move to " + (r.newCs || "the new spot") : "assign " + (r.newCs || "") + " · clear " + (r.oldCs || "cadet spot");
    const T = { queued: ["wait", "🤖 Duty Portal roster: waiting for the add-on (" + what + ")" + (j.msg ? " · " + j.msg : "")], working: ["work", "🤖 Duty Portal roster: updating now" + (j.step ? " · " + j.step : "…") + (j.at ? " (" + Math.max(0, Math.round((Date.now() - j.at) / 1000)) + "s ago)" : "")],
      done: ["ok", "🤖 Duty Portal roster updated" + (j.msg ? " · " + j.msg : "")], failed: ["bad", "🤖 Duty Portal roster: couldn't finish · " + (j.msg || "unknown problem")] }[j.st] || ["wait", j.st];
    return '<div class="pbx-dp ' + T[0] + '"><span>' + esc(T[1]) + "</span>" + (j.st === "failed" && canTick ? '<button class="pbx-btn ghost" data-dpretry="' + esc(r.entry) + '">RETRY</button>' : "") + "</div>";
  }
  // while an update is waiting, check back every 20 s so the chip turns green by itself
  let DPW = null;
  function dpWatch() {
    if (DPW) return;
    DPW = setInterval(() => {
      const busy = (B.recent || []).some(r => r.dpJob && (r.dpJob.st === "queued" || r.dpJob.st === "working"));
      if (!busy || !document.querySelector(".pbx-fu")) { clearInterval(DPW); DPW = null; return; }
      if (!PEND) call("pbBoard", {}).then(r => { if (r && r.ok) M().draw(); });
    }, 10000);
  }
  function followUps() {
    const rec = B.recent || []; if (!rec.length) return "";
    if (rec.some(r => r.dpJob && (r.dpJob.st === "queued" || r.dpJob.st === "working"))) setTimeout(dpWatch, 0);
    const pend = rec.filter(r => !r.discord), canTick = B.me.hc || B.me.editor;
    const lb = lastBatch();
    return '<div class="sect"><span class="lbl">Recent promotions · Discord to-do</span>' + (lb.length ? '<button class="pbx-btn go ann-btn" data-pbann>📋 FRIDAY ANNOUNCEMENT · ' + lb.length + "</button>" : "") +
      (lb.some(r => annIdx(r) === 0) ? '<button class="pbx-btn ghost ann-btn" data-pbann="prob" title="PO → PO II during the week">📋 PROBATIONARY MOVE UP · ' + lb.filter(r => annIdx(r) === 0).length + "</button>" : "") + '</div><div class="pbx-fu">' +
      '<p class="pbx-fu-h">' + (pend.length ? "Until the bot is approved, someone with Discord permissions updates each officer's name tag and rank role by hand. Tick each one off when it's done." : "All caught up. Every recent promotion has been updated in Discord.") + "</p>" +
      rec.map(r => '<div class="pbx-fr' + (r.discord ? " done" : "") + '"><div><b>' + esc(r.officer.replace(/^.*\|\s*/, "")) + "</b><small>" + esc(r.from) + " → " + esc(r.to) + " · " + day(r.at) + (r.oldCs || r.newCs ? " · " + esc(r.oldCs || "—") + " → " + esc(r.newCs || "—") : "") + "</small></div>" +
        '<button class="pbx-nick" data-copy="' + esc(r.todo.nick) + '" data-what="Nickname" title="Copy nickname"><span>' + esc(r.todo.nick) + "</span><em>COPY</em></button>" +
        '<div class="pbx-roles"><span class="rm">− ' + esc(r.todo.remove) + '</span><span class="ad">+ ' + esc(r.todo.add) + "</span></div>" +
        (canTick ? '<button class="pbx-btn ' + (r.discord ? "on" : "ghost") + '" data-pbdone="' + esc(r.entry) + "|" + (r.discord ? 0 : 1) + '">' + (r.discord ? "✓ DONE" : "MARK DONE") + "</button>" : '<span class="pbx-wait">' + (r.discord ? "✓ Done" : "Pending") + "</span>") +
        dpChip(r, canTick) + "</div>").join("") + "</div>";
  }

  // ---------- actions ----------
  // moves show on screen at once; the server saves in the background and anything it refuses is put back
  const ME_WHO = () => "You" + (B.me.callsign ? " (" + B.me.callsign + ")" : "");
  let PEND = 0;
  function quick(action, extra, apply, undo, okMsg) {
    apply(); M().draw(); PEND++;
    call(action, extra).then(r => { PEND--;
      if (r.ok) { if (typeof okMsg === "function") okMsg(r); return; }
      undo(); M().draw(); M().toast(r.error === "AUTH" ? "Your MDT session expired. Sign on again." : r.error || "Couldn't save that. It's been put back.");
    });
  }
  function recount(o) {
    o.done = o.items.filter(x => x.done).length; o.total = o.items.length;
    const au = o.items.filter(x => x.auto); o.terminal = au.length > 0 && au.every(x => x.done);
    o.openManual = o.items.filter(x => !x.auto && !x.done).length; o.ready = o.total > 0 && o.done === o.total;
  }
  async function nominate(id) {
    const o = B.officers.find(x => x.id === id); if (!o || o.entry) return;
    const go = note => {
      M().blip(1200); M().toast("🎖️ " + o.name + " is up for " + o.next);
      quick("pbNominate", { id: id, note: note || "" },
        () => { o.entry = { entry: "", status: "nominated", by: ME_WHO(), at: Date.now(), note: note || "", mine: true }; },
        () => { o.entry = null; },
        r => { if (r.entry && o.entry) { Object.assign(o.entry, r.entry); o.entry.mine = true; } });
    };
    if (o.ready) return go("");
    const m = M().modal('<h3 style="font:700 22px Barlow Condensed,sans-serif;letter-spacing:.04em">Put ' + esc(o.name) + " up for " + esc(o.next) + "?</h3>" +
      '<p style="color:var(--mute);font-size:14px">' + (o.total - o.done) + " requirement" + (o.total - o.done > 1 ? "s are" : " is") + " still open. High Command will see that on the list.</p>" +
      '<textarea id="pbNote" rows="3" maxlength="300" placeholder="Why now? (optional, High Command sees this)" style="width:100%;border-radius:10px;border:1px solid var(--line2);background:#0b1220;color:var(--tx);padding:10px;font:inherit"></textarea>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" data-close>CANCEL</button><button class="btn" id="pbNomGo">PUT ON LIST</button></div>');
    m.querySelector("#pbNomGo").onclick = () => { const n = m.querySelector("#pbNote").value; m.hidden = true; go(n); };
  }
  function say(title, msg) { M().modal('<h3 style="font:700 22px Barlow Condensed,sans-serif;letter-spacing:.04em">' + esc(title) + '</h3><p style="color:var(--mute);font-size:14px;line-height:1.5">' + esc(msg) + '</p><div style="display:flex;justify-content:flex-end"><button class="btn" data-close>OK</button></div>'); }
  async function push() {
    if (!B.officers.some(o => o.entry && o.entry.status === "approved")) return say("Nothing approved yet", "Press the green APPROVE button on each officer in the Promotion list first. Only approved officers are pushed to the roster.");
    const pb = document.querySelector("[data-pbpush]"); if (pb) { pb.disabled = true; pb.textContent = "CHECKING THE ROSTER…"; }
    for (let i = 0; PEND > 0 && i < 100; i++) await new Promise(r => setTimeout(r, 150));   // let any approvals still saving land first
    const pv = await call("pbPreview");
    if (pb) { pb.disabled = false; M().draw(); }
    if (!pv.ok) return say("Couldn't plan the push", pv.error === "AUTH" ? "Your MDT session expired. Sign on again and retry." : pv.error || "No answer from the server. If you just updated WebApp.gs, check that you deployed a new version.");
    const ok = pv.plan.filter(p => !p.error);
    const m = M().modal('<h3 style="font:700 24px Barlow Condensed,sans-serif;letter-spacing:.05em">🎖️ PUSH PROMOTIONS</h3>' +
      '<p style="color:var(--mute);font-size:13.5px">Each officer moves to the first open slot of their new rank on the <b>LSPD Personnel Roster</b>, highest ranks first. Their old row\'s name, Discord ID and date are cleared, and time in grade starts today. New PO IIs come off the <b>Onboarding Roster</b>, and their onboarding row is reset (Status to Good, Training Status to BPA Needed).</p>' +
      '<div class="pbx-plan">' + pv.plan.map(p => '<div class="' + (p.error ? "bad" : "") + '"><b>' + esc(p.officer.replace(/^.*\|\s*/, "")) + "</b><span>" + esc(p.from) + " → " + esc(p.to) + "</span>" +
        (p.error ? "<em>✕ " + esc(p.error) + "</em>" : "<em>" + esc(p.oldCs || "—") + " → <b>" + esc(p.newCs) + "</b> · row " + p.toRow + (p.onb ? " · from the Onboarding roster" : "") + "</em>") + "</div>").join("") + "</div>" +
      '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button class="btn ghost" data-close>CANCEL</button><button class="btn pbx-push" id="pbGo"' + (ok.length ? "" : " disabled") + ">CONFIRM " + ok.length + " PROMOTION" + (ok.length === 1 ? "" : "S") + "</button></div>");
    const b = m.querySelector("#pbGo"); if (!b) return;
    b.onclick = async () => {
      b.disabled = true; b.textContent = "UPDATING THE ROSTER…";
      const r = await call("pbPush");
      if (!r.ok) return say("The push didn't go through", (r.error === "AUTH" ? "Your MDT session expired. Sign on again and retry." : r.error || "No answer from the server.") + " Nothing was changed on the roster unless it says otherwise.");
      // show it right away: the promoted officers leave the board and land in "Recent promotions"; a fresh board loads behind
      (r.done || []).forEach(p => { B.officers = B.officers.filter(o => o.id !== p.id); B.recent = [{ entry: p.entry, officer: p.officer, from: p.from, to: p.to, at: p.at || Date.now(), oldCs: p.oldCs, newCs: p.newCs, discord: "", todo: p.todo }].concat(B.recent || []); });
      if (!r.officers) call("pbBoard").then(x => { if (x.ok) M().draw(); });
      m.querySelector(".md-box").innerHTML = '<div class="pbx-done"><span>🎖️</span><h3>' + r.pushed + " PROMOTION" + (r.pushed === 1 ? "" : "S") + " PUSHED</h3><p>The roster is updated." + (r.warning ? "<br><b style=\"color:var(--amber)\">" + esc(r.warning) + "</b>" : "") + "</p>" +
        ((r.done || []).length ? '<div class="pbx-plan">' + r.done.map(p => '<div><b>' + esc(p.officer.replace(/^.*\|\s*/, "")) + "</b><span>" + esc(p.from) + " → " + esc(p.to) + "</span><em>" + esc(p.oldCs || "—") + " → <b>" + esc(p.newCs || "—") + "</b></em></div>").join("") + "</div>" : "") +
        ((r.skipped || []).length ? '<div class="pbx-plan">' + r.skipped.map(s => '<div class="bad"><b>' + esc(s.officer) + "</b><em>✕ " + esc(s.error) + "</em></div>").join("") + "</div>" : "") +
        '<p style="font-size:13px">Next: post the announcement, then update their Discord name tags and roles from the to-do list under the board.</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn pbx-push" id="pbAnnNow">📋 FRIDAY ANNOUNCEMENT</button>' + ((r.done || []).some(p => annIdx(p) === 0) ? '<button class="btn ghost" id="pbProbNow">📋 PROBATIONARY MOVE UP</button>' : "") + '<button class="btn ghost" data-close>DONE</button></div></div>';
      const an = m.querySelector("#pbAnnNow"); if (an) an.onclick = () => copyAnn((r.done || []).map(p => Object.assign({}, p)));
      const pn = m.querySelector("#pbProbNow"); if (pn) pn.onclick = () => copyAnn((r.done || []).map(p => Object.assign({}, p)), "prob");
      M().blip(1600); setTimeout(() => M().blip(2000), 120); M().draw();
    };
  }
  function rules() {
    const me = B.me;
    const rows = B.ranks.map(r => '<tr data-rk="' + r.idx + '"><th>' + esc(r.abbr) + " → " + esc(nextAbbr(r.idx)) + "<small>" + esc(r.name) + "</small></th>" +
      ["hours", "weekMin", "reports", "days"].map(k => '<td><input type="number" min="0" step="' + (k === "hours" || k === "weekMin" ? "0.5" : "1") + '" data-k="' + k + '" value="' + esc(r.rule[k]) + '"></td>').join("") +
      '<td><textarea data-k="extra" rows="2" placeholder="One per line">' + esc((r.rule.extra || []).join("\n")) + "</textarea>" +
      (r.doc.length ? '<details><summary>' + r.doc.length + " from the guidelines doc</summary><ul>" + r.doc.map(q => "<li>" + esc(q.t) + (q.auto ? " <i>auto</i>" : "") + "</li>").join("") + "</ul></details>" : "") + "</td></tr>").join("");
    const m = M().modal('<h3 style="font:700 24px Barlow Condensed,sans-serif;letter-spacing:.05em">PROMOTION REQUIREMENTS</h3>' +
      '<p style="color:var(--mute);font-size:13px">What an officer needs at each rank before moving up. Hours come from the On Duty role; a light week is flagged but still passes if the total is met. Extra lines are signed off by command. The guidelines doc stays as it is and is added on top.</p>' +
      '<div class="pbx-rules"><table><thead><tr><th>Rank</th><th>Hours</th><th>Weekly min</th><th>Reports</th><th>Days</th><th>Extra requirements</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      (me.hc ? '<div class="pbx-rx"><label>Who else can edit requirements<input id="pbEd" placeholder="Callsigns or Discord IDs, comma separated (e.g. L-121, L-201)" value="' + esc((B.editors || []).join(", ")) + '"></label>' +
        '<label>Announce promotions in<select id="pbWh"><option value="">Don\'t post in Discord</option>' + (B.webhooks || []).map(w => '<option value="' + esc(w.id) + '"' + (w.id === B.webhookId ? " selected" : "") + ">" + esc(w.name) + "</option>").join("") + "</select></label></div>" : "") +
      '<div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" data-close>CANCEL</button><button class="btn" id="pbRulesGo">SAVE</button></div>');
    m.querySelector(".md-box").style.width = "min(980px,100%)";
    m.querySelector("#pbRulesGo").onclick = async e => {
      const ranks = {};
      m.querySelectorAll("tr[data-rk]").forEach(tr => { const x = {}; tr.querySelectorAll("[data-k]").forEach(i => x[i.dataset.k] = i.dataset.k === "extra" ? i.value.split("\n").map(s => s.trim()).filter(Boolean) : i.value); ranks[tr.dataset.rk] = x; });
      const body = { ranks: ranks }; if (me.hc) { body.editors = m.querySelector("#pbEd").value.split(",").map(s => s.trim()).filter(Boolean); body.webhookId = m.querySelector("#pbWh").value; }
      e.target.disabled = true; e.target.textContent = "SAVING…";
      const r = await call("pbRules", { rules: body });
      if (r.ok) { m.hidden = true; M().toast("Requirements saved"); M().draw(); } else { e.target.disabled = false; e.target.textContent = "SAVE"; M().toast(r.error || "Couldn't save."); }
    };
  }

  document.addEventListener("click", async e => {
    if (!document.querySelector(".pbx") && !e.target.closest("[data-pbrefresh],[data-pbrules],[data-dpsetup]")) return;
    const t = e.target;
    if (t.closest("[data-pbrefresh]")) { B = null; M().draw(); return; }
    if (t.closest("[data-pbrules]")) { if (B && B.ok) rules(); return; }
    if (t.closest("[data-dpsetup]")) { if (B && B.ok) dpSetup(); return; }
    const rf = t.closest("[data-pbrf]"); if (rf) { RF = rf.dataset.pbrf; M().draw(); return; }
    const sw = t.closest("[data-pbshow]"); if (sw) { SHOW = sw.dataset.pbshow; M().draw(); return; }
    const ad = t.closest("[data-pbadd]"); if (ad) { e.stopPropagation(); nominate(ad.dataset.pbadd); return; }
    const ap = t.closest("[data-pbapprove]"); if (ap) { const [id, on] = ap.dataset.pbapprove.split("|"), o = B.officers.find(x => x.id === id); if (!o || !o.entry) return;
      const was = { status: o.entry.status, apBy: o.entry.apBy }; M().blip(on === "1" ? 1500 : 700);
      quick("pbApprove", { id: id, on: on === "1" }, () => { o.entry.status = on === "1" ? "approved" : "nominated"; o.entry.apBy = on === "1" ? ME_WHO() : ""; }, () => Object.assign(o.entry, was),
        r => { if (o.entry && r.apBy) o.entry.apBy = r.apBy; });
      return; }
    const rm = t.closest("[data-pbremove]"); if (rm) { const o = B.officers.find(x => x.id === rm.dataset.pbremove); if (!o) return;
      const m = M().modal('<h3 style="font:700 22px Barlow Condensed,sans-serif">Take ' + esc(o.name) + ' off the list?</h3><input id="pbWhy" maxlength="200" placeholder="Reason (optional)" style="height:42px;border-radius:10px;border:1px solid var(--line2);background:#0b1220;color:var(--tx);padding:0 12px;font:inherit">' +
        '<div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" data-close>KEEP</button><button class="btn" id="pbRmGo">RETURN</button></div>');
      m.querySelector("#pbRmGo").onclick = () => { const why = m.querySelector("#pbWhy").value, was = o.entry; m.hidden = true; M().toast(o.name + " is back on the officer list");
        quick("pbRemove", { id: o.id, reason: why }, () => { o.entry = null; }, () => { o.entry = was; }); };
      return; }
    const ck = t.closest("[data-pbcheck]"); if (ck) { e.stopPropagation(); const [id, key, on] = ck.dataset.pbcheck.split("|"), o = B.officers.find(x => x.id === id), it = o && o.items.find(x => x.key === key); if (!it) return;
      const was = { done: it.done, by: it.by, manual: it.manual }; M().blip(on === "1" ? 1400 : 600);
      quick("pbCheck", { id: id, key: key, on: on === "1" }, () => { it.done = on === "1"; it.manual = it.done; it.by = it.done ? ME_WHO() : ""; recount(o); if (o.ready && it.done) M().toast("★ " + o.name + " has every requirement for " + o.next); },
        () => { Object.assign(it, was); recount(o); }, r => { if (r.by) it.by = r.by; });
      return; }
    const dn = t.closest("[data-pbdone]"); if (dn) { const [en, on] = dn.dataset.pbdone.split("|"), r0 = (B.recent || []).find(x => x.entry === en); if (!r0) return; const was = r0.discord;
      quick("pbDiscordDone", { entry: en, on: on === "1" }, () => { r0.discord = on === "1" ? "Done" : ""; if (on === "1" && B.dp && r0.newCs) r0.dpJob = { st: "queued" }; else if (on !== "1" && r0.dpJob && r0.dpJob.st !== "done") r0.dpJob = null; }, () => { r0.discord = was; },
        r => { r0.dpJob = r.dpJob || null; M().draw(); if (r.dpJob) dpWatch(); }); return; }
    const rt = t.closest("[data-dpretry]"); if (rt) { const r0 = (B.recent || []).find(x => x.entry === rt.dataset.dpretry); if (!r0) return; const was = r0.dpJob;
      quick("pbDpRetry", { entry: r0.entry }, () => { r0.dpJob = { st: "queued" }; }, () => { r0.dpJob = was; }, r => { r0.dpJob = r.dpJob || r0.dpJob; M().draw(); dpWatch(); }); return; }
    if (t.closest("[data-pbpush]")) { push(); return; }
    const an0 = t.closest("[data-pbann]"); if (an0) { copyAnn(lastBatch(), an0.dataset.pbann); return; }
    const card = t.closest("[data-pbo]"); if (card && !t.closest("button")) { OPEN[card.dataset.pbo] = !OPEN[card.dataset.pbo]; M().draw(); }
  });
  document.addEventListener("input", e => { if (e.target.id === "pbQ") { Q = e.target.value; const pos = e.target.selectionStart; M().draw(); const n = document.getElementById("pbQ"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } });
  // drag an officer card onto the promotion list
  document.addEventListener("dragstart", e => { const c = e.target.closest && e.target.closest("[data-pbo][draggable]"); if (!c) return; DRAG = c.dataset.pbo; c.classList.add("drag"); try { e.dataTransfer.setData("text/plain", DRAG); e.dataTransfer.effectAllowed = "move"; } catch (x) {} document.querySelector("[data-pbdrop]") && document.querySelector("[data-pbdrop]").classList.add("hint"); });
  document.addEventListener("dragend", () => { DRAG = ""; document.querySelectorAll(".pbx-o.drag").forEach(x => x.classList.remove("drag")); const d = document.querySelector("[data-pbdrop]"); if (d) d.classList.remove("hint", "over"); });
  document.addEventListener("dragover", e => { const d = e.target.closest && e.target.closest("[data-pbdrop]"); if (d && DRAG) { e.preventDefault(); d.classList.add("over"); } });
  document.addEventListener("dragleave", e => { const d = e.target.closest && e.target.closest("[data-pbdrop]"); if (d && !d.contains(e.relatedTarget)) d.classList.remove("over"); });
  document.addEventListener("drop", e => { const d = e.target.closest && e.target.closest("[data-pbdrop]"); if (!d || !DRAG) return; e.preventDefault(); d.classList.remove("over", "hint"); const id = DRAG; DRAG = ""; nominate(id); });

  window.MDTBoard = { html: html, reset: () => { B = null; } };
  if (/^#board$/.test(location.hash) && window.MDT) window.MDT.draw();   // the page opened straight onto the board
})();
