/* LSPD MDT — Promotion board (Lieutenants and up).
   Left: every Personnel officer, their next rank and what's open. The terminal ticks what it can count itself.
   Right: the promotion list. LT – Commander put officers on it (drag or →); High Command approves and pushes. */
(function () {
  "use strict";
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
      if (x.auto === "hours" && x.weeks) extra = '<div class="pbx-wk">' + x.weeks.map(w => '<span class="' + (w.low ? "low" : "") + '">Week of ' + day(w.from) + ": <b>" + H(w.min) + "h</b></span>").join("") + "</div>" + (x.warn ? '<div class="pbx-warn">⚠ Total met, but ' + esc(x.warn) + ".</div>" : "");
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
    const mine = e.by && me.callsign && e.by.indexOf("(" + me.callsign + ")") !== -1;
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
      [["Officers", all.length, ""], ["Terminal ✓", all.filter(o => o.terminal).length, "term"], ["All met", all.filter(o => o.ready).length, "ready"], ["On the list", listed.length, "list"], ["Approved", ap.length, "ap"]]
        .map(s => '<div class="' + s[2] + '"><b>' + s[1] + "</b><small>" + s[0] + "</small></div>").join("") + "</div>";
    if (B.slotError) h += '<div class="pbx-alert">⚠ Couldn\'t read the Personnel roster: ' + esc(B.slotError) + "</div>";
    // rank filter
    h += '<div class="pbx-ranks"><button data-pbrf="all" class="' + (RF === "all" ? "on" : "") + '">ALL RANKS <small>' + all.length + "</small></button>" +
      B.ranks.filter(r => all.some(o => o.idx === r.idx)).map(r => '<button data-pbrf="' + r.idx + '" class="' + (String(RF) === String(r.idx) ? "on" : "") + '" title="' + r.open + " open " + esc(r.next) + ' slot(s) on the roster">' + esc(r.abbr) + " → " + esc(B.ranks[r.idx] ? B.ranks[r.idx].abbr : "CMDR") + " <small>" + all.filter(o => o.idx === r.idx).length + '</small><i class="' + (r.open ? "" : "no") + '">' + r.open + " open</i></button>").join("") + "</div>";
    const q = Q.trim().toLowerCase();
    let left = all.filter(o => !o.entry && (RF === "all" || String(o.idx) === String(RF)) && (!q || (o.name + " " + o.callsign + " " + o.rank).toLowerCase().indexOf(q) !== -1));
    if (SHOW === "term") left = left.filter(o => o.terminal); if (SHOW === "ready") left = left.filter(o => o.ready);
    left.sort((a, b) => (b.ready - a.ready) || (b.terminal - a.terminal) || (b.done / (b.total || 1) - a.done / (a.total || 1)) || b.idx - a.idx);
    const right = listed.filter(o => RF === "all" || String(o.idx) === String(RF)).sort((a, b) => b.idx - a.idx || a.entry.at - b.entry.at);
    h += '<div class="pbx">' +
      '<section class="pbx-col"><header><span class="lbl">Officers</span><div class="pbx-tools"><input id="pbQ" placeholder="Search name or callsign" value="' + esc(Q) + '">' +
      '<div class="seg"><button data-pbshow="all" class="' + (SHOW === "all" ? "on" : "") + '">ALL</button><button data-pbshow="term" class="' + (SHOW === "term" ? "on" : "") + '">TERMINAL ✓</button><button data-pbshow="ready" class="' + (SHOW === "ready" ? "on" : "") + '">ALL MET</button></div></div></header>' +
      '<div class="pbx-body">' + (left.length ? left.map(officerCard).join("") : '<div class="empty">No one here' + (q ? " matches that search" : "") + ".</div>") + "</div></section>" +
      '<section class="pbx-col list" data-pbdrop><header><span class="lbl">Promotion list</span><small>' + (B.me.nominate ? "Drag officers here or press →" : "") + "</small></header>" +
      '<div class="pbx-body">' + (right.length ? groupBy(right).map(g => '<div class="pbx-grp">' + esc(g.to) + " <small>" + g.list.length + " · " + g.open + " open slot" + (g.open === 1 ? "" : "s") + "</small></div>" + g.list.map(listCard).join("")).join("")
        : '<div class="pbx-drop"><span>🎖️</span><b>No one on the list yet</b><small>' + (B.me.nominate ? "Drag an officer across to put them up for promotion." : "Command adds officers here.") + "</small></div>") + "</div>" +
      (B.me.hc ? '<footer><button class="btn pbx-push" data-pbpush' + (ap.length ? "" : " disabled") + ">🎖️ PUSH " + ap.length + " PROMOTION" + (ap.length === 1 ? "" : "S") + "</button><small>Updates the roster, highest ranks first.</small></footer>"
        : '<footer><small>' + (ap.length ? ap.length + " approved, waiting for High Command to push." : "High Command approves and pushes promotions.") + "</small></footer>") +
      "</section></div>";
    h += followUps();
    return h;
  }
  function groupBy(list) {
    const g = [];
    list.forEach(o => { let x = g.find(y => y.idx === o.idx); if (!x) { const r = B.ranks.find(z => z.idx === o.idx); x = { idx: o.idx, to: o.next, open: r ? r.open : 0, list: [] }; g.push(x); } x.list.push(o); });
    return g;
  }
  function followUps() {
    const rec = B.recent || []; if (!rec.length) return "";
    const pend = rec.filter(r => !r.discord), canTick = B.me.hc || B.me.editor;
    return '<div class="sect"><span class="lbl">Recent promotions · Discord to-do</span></div><div class="pbx-fu">' +
      '<p class="pbx-fu-h">' + (pend.length ? "Until the bot is approved, someone with Discord permissions updates each officer's name tag and rank role by hand. Tick each one off when it's done." : "All caught up. Every recent promotion has been updated in Discord.") + "</p>" +
      rec.map(r => '<div class="pbx-fr' + (r.discord ? " done" : "") + '"><div><b>' + esc(r.officer.replace(/^.*\|\s*/, "")) + "</b><small>" + esc(r.from) + " → " + esc(r.to) + " · " + day(r.at) + (r.oldCs || r.newCs ? " · " + esc(r.oldCs || "—") + " → " + esc(r.newCs || "—") : "") + "</small></div>" +
        '<button class="pbx-nick" data-copy="' + esc(r.todo.nick) + '" data-what="Nickname" title="Copy nickname"><span>' + esc(r.todo.nick) + "</span><em>COPY</em></button>" +
        '<div class="pbx-roles"><span class="rm">− ' + esc(r.todo.remove) + '</span><span class="ad">+ ' + esc(r.todo.add) + "</span></div>" +
        (canTick ? '<button class="pbx-btn ' + (r.discord ? "on" : "ghost") + '" data-pbdone="' + esc(r.entry) + "|" + (r.discord ? 0 : 1) + '">' + (r.discord ? "✓ DONE" : "MARK DONE") + "</button>" : '<span class="pbx-wait">' + (r.discord ? "✓ Done" : "Pending") + "</span>") + "</div>").join("") + "</div>";
  }

  // ---------- actions ----------
  async function nominate(id) {
    const o = B.officers.find(x => x.id === id); if (!o || BUSY) return;
    const go = async note => {
      BUSY = true; M().blip(1200);
      const r = await call("pbNominate", { id: id, note: note || "" }); BUSY = false;
      if (r.ok) { M().toast("🎖️ " + o.name + " is up for " + o.next); M().draw(); } else M().toast(r.error || "Couldn't add them.");
    };
    if (o.ready) return go("");
    const m = M().modal('<h3 style="font:700 22px Barlow Condensed,sans-serif;letter-spacing:.04em">Put ' + esc(o.name) + " up for " + esc(o.next) + "?</h3>" +
      '<p style="color:var(--mute);font-size:14px">' + (o.total - o.done) + " requirement" + (o.total - o.done > 1 ? "s are" : " is") + " still open. High Command will see that on the list.</p>" +
      '<textarea id="pbNote" rows="3" maxlength="300" placeholder="Why now? (optional, High Command sees this)" style="width:100%;border-radius:10px;border:1px solid var(--line2);background:#0b1220;color:var(--tx);padding:10px;font:inherit"></textarea>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" data-close>CANCEL</button><button class="btn" id="pbNomGo">PUT ON LIST</button></div>');
    m.querySelector("#pbNomGo").onclick = () => { const n = m.querySelector("#pbNote").value; m.hidden = true; go(n); };
  }
  async function push() {
    const pv = await call("pbPreview"); if (!pv.ok) return M().toast(pv.error || "Couldn't plan the push.");
    const ok = pv.plan.filter(p => !p.error);
    const m = M().modal('<h3 style="font:700 24px Barlow Condensed,sans-serif;letter-spacing:.05em">🎖️ PUSH PROMOTIONS</h3>' +
      '<p style="color:var(--mute);font-size:13.5px">Each officer moves to the first open slot of their new rank on the <b>LSPD Personnel Roster</b>, highest ranks first. Their old row\'s name, Discord ID and date are cleared, and time in grade starts today.</p>' +
      '<div class="pbx-plan">' + pv.plan.map(p => '<div class="' + (p.error ? "bad" : "") + '"><b>' + esc(p.officer.replace(/^.*\|\s*/, "")) + "</b><span>" + esc(p.from) + " → " + esc(p.to) + "</span>" +
        (p.error ? "<em>✕ " + esc(p.error) + "</em>" : "<em>" + esc(p.oldCs || "—") + " → <b>" + esc(p.newCs) + "</b> · row " + p.toRow + "</em>") + "</div>").join("") + "</div>" +
      '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button class="btn ghost" data-close>CANCEL</button><button class="btn pbx-push" id="pbGo"' + (ok.length ? "" : " disabled") + ">CONFIRM " + ok.length + " PROMOTION" + (ok.length === 1 ? "" : "S") + "</button></div>");
    const b = m.querySelector("#pbGo"); if (!b) return;
    b.onclick = async () => {
      b.disabled = true; b.textContent = "UPDATING THE ROSTER…";
      const r = await call("pbPush");
      if (!r.ok) { b.disabled = false; b.textContent = "TRY AGAIN"; return M().toast(r.error || "Push failed."); }
      m.querySelector(".md-box").innerHTML = '<div class="pbx-done"><span>🎖️</span><h3>' + r.pushed + " PROMOTION" + (r.pushed === 1 ? "" : "S") + " PUSHED</h3><p>The roster is updated." + (r.warning ? "<br><b style=\"color:var(--amber)\">" + esc(r.warning) + "</b>" : "") + "</p>" +
        ((r.skipped || []).length ? '<div class="pbx-plan">' + r.skipped.map(s => '<div class="bad"><b>' + esc(s.officer) + "</b><em>✕ " + esc(s.error) + "</em></div>").join("") + "</div>" : "") +
        '<p style="font-size:13px">Next: update their Discord name tags and roles from the to-do list under the board.</p><button class="btn" data-close>DONE</button></div>';
      M().blip(1600); setTimeout(() => M().blip(2000), 120); M().draw();
    };
  }
  function rules() {
    const me = B.me;
    const rows = B.ranks.map(r => '<tr data-rk="' + r.idx + '"><th>' + esc(r.abbr) + " → " + esc(B.ranks[r.idx] ? B.ranks[r.idx].abbr : "CMDR") + "<small>" + esc(r.name) + "</small></th>" +
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
    if (!document.querySelector(".pbx") && !e.target.closest("[data-pbrefresh],[data-pbrules]")) return;
    const t = e.target;
    if (t.closest("[data-pbrefresh]")) { B = null; M().draw(); return; }
    if (t.closest("[data-pbrules]")) { if (B && B.ok) rules(); return; }
    const rf = t.closest("[data-pbrf]"); if (rf) { RF = rf.dataset.pbrf; M().draw(); return; }
    const sw = t.closest("[data-pbshow]"); if (sw) { SHOW = sw.dataset.pbshow; M().draw(); return; }
    const ad = t.closest("[data-pbadd]"); if (ad) { e.stopPropagation(); nominate(ad.dataset.pbadd); return; }
    const ap = t.closest("[data-pbapprove]"); if (ap) { if (BUSY) return; const [id, on] = ap.dataset.pbapprove.split("|"); BUSY = true; ap.disabled = true; M().blip(on === "1" ? 1500 : 700);
      const r = await call("pbApprove", { id: id, on: on === "1" }); BUSY = false; if (!r.ok) M().toast(r.error || "Couldn't save."); M().draw(); return; }
    const rm = t.closest("[data-pbremove]"); if (rm) { if (BUSY) return; const o = B.officers.find(x => x.id === rm.dataset.pbremove); if (!o) return;
      const m = M().modal('<h3 style="font:700 22px Barlow Condensed,sans-serif">Take ' + esc(o.name) + ' off the list?</h3><input id="pbWhy" maxlength="200" placeholder="Reason (optional)" style="height:42px;border-radius:10px;border:1px solid var(--line2);background:#0b1220;color:var(--tx);padding:0 12px;font:inherit">' +
        '<div style="display:flex;gap:10px;justify-content:flex-end"><button class="btn ghost" data-close>KEEP</button><button class="btn" id="pbRmGo">RETURN</button></div>');
      m.querySelector("#pbRmGo").onclick = async () => { const why = m.querySelector("#pbWhy").value; m.hidden = true; BUSY = true; const r = await call("pbRemove", { id: o.id, reason: why }); BUSY = false; if (!r.ok) M().toast(r.error || "Couldn't save."); else M().toast(o.name + " is back on the officer list"); M().draw(); };
      return; }
    const ck = t.closest("[data-pbcheck]"); if (ck) { e.stopPropagation(); if (BUSY) return; const [id, key, on] = ck.dataset.pbcheck.split("|"); BUSY = true; ck.classList.add("busy"); M().blip(on === "1" ? 1400 : 600);
      const r = await call("pbCheck", { id: id, key: key, on: on === "1" }); BUSY = false; if (!r.ok) M().toast(r.error || "Couldn't save."); else { const o = B.officers.find(x => x.id === id); if (o && o.ready && on === "1") M().toast("★ " + o.name + " has every requirement for " + o.next); } M().draw(); return; }
    const dn = t.closest("[data-pbdone]"); if (dn) { if (BUSY) return; const [en, on] = dn.dataset.pbdone.split("|"); BUSY = true; const r = await call("pbDiscordDone", { entry: en, on: on === "1" }); BUSY = false; if (!r.ok) M().toast(r.error || "Couldn't save."); M().draw(); return; }
    if (t.closest("[data-pbpush]")) { push(); return; }
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
