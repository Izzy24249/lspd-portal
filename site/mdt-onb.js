/* LSPD MDT — Onboarding removals (Lieutenants and up; High Command pushes).
   Left: the Onboarding Roster with each officer's onboarding deadline (out of time first).
   Right: the removal list. A push moves them to "Onboarding Terminations" and clears their onboarding row. */
(function () {
  "use strict";
  let B = null, LOADING = false, Q = "", SHOW = "over", PEND = 0;
  const M = () => window.MDT, esc = s => M().esc(s);
  const day = t => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const ymd = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  async function call(action, extra) {
    const r = await Portal.post(Object.assign({ action: action, session: M().session }, extra || {})).catch(() => ({ ok: false, error: "Couldn't reach the server." }));
    if (r && r.ok && r.officers) B = r;
    return r || { ok: false, error: "No answer from the server." };
  }
  function load() { if (LOADING) return; LOADING = true; call("obBoard").then(r => { LOADING = false; if (!r.ok) B = r; M().draw(); }); }
  function quick(action, extra, apply, undo, ok) {
    apply(); M().draw(); PEND++;
    call(action, extra).then(r => { PEND--; if (r.ok) { if (ok) ok(r); return; } undo(); M().draw(); M().toast(r.error === "AUTH" ? "Your MDT session expired. Sign on again." : r.error || "Couldn't save that. It's been put back."); });
  }
  const st = o => o.complete ? "done" : o.deadline ? o.deadline.state : "none";
  function dlChip(o) {
    const d = o.deadline; if (o.complete) return '<span class="pbx-chip ok">✓ ONBOARDING DONE</span>';
    if (!d) return '<span class="pbx-chip">No start date</span>';
    const L = d.left;
    return '<span class="pbx-chip ' + (L <= 0 ? "no" : d.state === "warn" ? "warn" : "ok") + '" title="Deadline ' + esc(d.date) + (d.extended ? " (extended)" : "") + '">' +
      (L < 0 ? "⏰ " + -L + " day" + (L === -1 ? "" : "s") + " over" : L === 0 ? "⏰ Due today" : "⏳ " + L + " day" + (L === 1 ? "" : "s") + " left") + "</span>";
  }
  function card(o, right) {
    const can = B.me.nominate && !o.entry, sd = ymd(o.since);
    return '<article class="' + (right ? "pbx-l ob-l" : "pbx-o") + (st(o) === "over" ? " ob-over" : "") + '" data-obc="' + esc(o.callsign) + '"' + (!right && can ? ' draggable="true"' : "") + '><div class="pbx-row">' +
      '<div class="ob-av">' + esc((o.callsign || "").replace(/^L-?/i, "")) + "</div>" +
      '<div class="pbx-who"><div class="pbx-nm"><code>' + esc(o.callsign) + "</code><b>" + esc(o.name) + "</b></div>" +
      '<div class="pbx-rk">' + (sd ? "Joined " + day(sd) : "Join date unknown") + " · " + o.done + "/" + o.total + " onboarding steps" + (o.training ? " · " + esc(o.training) : "") + "</div>" +
      '<div class="pbx-chips">' + dlChip(o) + "</div>" +
      (right ? '<small class="pbx-by">' + esc(o.entry.reason || "") + " · added by " + esc(o.entry.by || "") + "</small>" : "") + "</div>" +
      (!right && o.entry ? '<span class="pbx-tag">ON LIST</span>' : !right && can ? '<button class="pbx-add ob-add" data-obadd="' + esc(o.callsign) + '" title="Add to the removal list">→</button>' : "") +
      "</div>" + (right ? '<div class="pbx-acts"><button class="pbx-btn ghost" data-obun="' + esc(o.callsign) + '">↩ KEEP THEM</button></div>' : "") + "</article>";
  }
  function html() {
    let h = '<div class="h2"><div><h1>ONBOARDING REMOVALS</h1><p>Officers whose onboarding time ran out. Move them to the list, then High Command removes them from the Onboarding Roster in one go: they\'re copied to Onboarding Terminations and their slot is cleared.</p></div>' +
      '<button class="btn ghost" data-obrefresh>↻ REFRESH</button></div>';
    if (!B) { load(); return h + '<div class="boot"><i></i>READING THE ONBOARDING ROSTER…</div>'; }
    if (!B.ok) return h + '<div class="empty">' + esc(B.error === "AUTH" ? "Sign on again to open this." : B.error || "Couldn't load.") + "</div>";
    const all = B.officers, listed = all.filter(o => o.entry), over = all.filter(o => st(o) === "over"), warn = all.filter(o => st(o) === "warn");
    h += '<div class="pbx-stats ob-stats">' + [["On onboarding", all.length, ""], ["Out of time", over.length, "nl"], ["Ending soon", warn.length, "list"], ["On the list", listed.length, "ap"]]
      .map(s => '<div class="' + s[2] + '"><b>' + s[1] + "</b><small>" + s[0] + "</small></div>").join("") + "</div>";
    if (B.error) h += '<div class="pbx-alert">⚠ ' + esc(B.error) + "</div>";
    const q = Q.trim().toLowerCase();
    let left = all.filter(o => !o.entry && (!q || (o.name + " " + o.callsign).toLowerCase().indexOf(q) !== -1));
    if (SHOW === "over") left = left.filter(o => st(o) === "over"); else if (SHOW === "warn") left = left.filter(o => st(o) === "warn");
    const csN = o => { const m = /(\d+)/.exec(o.callsign || ""); return m ? +m[1] : 1e9; };
    const right = listed.slice().sort((a, b) => csN(a) - csN(b));   // the order they'll land on Onboarding Terminations
    h += '<div class="pbx">' +
      '<section class="pbx-col"><header><span class="lbl">Onboarding Roster</span><div class="pbx-tools"><input id="obQ" placeholder="Search name or callsign" value="' + esc(Q) + '">' +
      '<div class="seg">' + [["over", "OUT OF TIME"], ["warn", "ENDING SOON"], ["all", "ALL"]].map(x => '<button data-obshow="' + x[0] + '" class="' + (SHOW === x[0] ? "on" : "") + '">' + x[1] + "</button>").join("") + "</div>" +
      (B.me.nominate && SHOW === "over" && left.length ? '<button class="pbx-btn ghost" data-oball>ADD ALL ' + left.length + " →</button>" : "") + "</div></header>" +
      '<div class="pbx-body">' + (left.length ? left.map(o => card(o, false)).join("") : '<div class="empty">' + (SHOW === "over" ? "Nobody is out of time. 🎉" : "No one here.") + "</div>") + "</div></section>" +
      '<section class="pbx-col list ob-list" data-obdrop><header><span class="lbl">Removal list</span><small>' + (B.me.nominate ? "Drag officers here or press →" : "") + "</small></header>" +
      '<div class="pbx-body">' + (right.length ? right.map(o => card(o, true)).join("") : '<div class="pbx-drop"><span>🗂️</span><b>Nobody on the list</b><small>Add officers who ran out of time.</small></div>') + "</div>" +
      (B.me.hc ? '<footer><button class="btn ob-push' + (right.length ? "" : " off") + '" data-obpush>REMOVE ' + right.length + " FROM ROSTER</button><small>Copies them to Onboarding Terminations, then clears their slot.</small></footer>"
        : '<footer><small>High Command removes them from the roster.</small></footer>') + "</section></div>";
    const R = B.recent || [];
    if (R.length) h += '<div class="sect"><span class="lbl">Removed · last 30 days</span></div><div class="pbx-fu">' + R.map(r => '<div class="pbx-fr done ob-fr"><div><b>' + esc((r.callsign ? r.callsign + " · " : "") + r.officer) + "</b><small>" + esc(r.reason || "") + " · " + day(r.at) + "</small></div><small>" + esc(r.result || "") + "</small></div>").join("") + "</div>";
    return h;
  }
  function say(t, m) { M().modal('<h3 style="font:700 22px Barlow Condensed,sans-serif;letter-spacing:.04em">' + esc(t) + '</h3><p style="color:var(--mute);font-size:14px;line-height:1.5">' + esc(m) + '</p><div style="display:flex;justify-content:flex-end"><button class="btn" data-close>OK</button></div>'); }
  function add(cs) {
    const o = B.officers.find(x => x.callsign === cs); if (!o || o.entry) return;
    const reason = st(o) === "over" ? "Onboarding time ran out" : "Removed from onboarding";
    M().blip(900);
    quick("obAdd", { callsign: cs, reason: reason }, () => { o.entry = { entry: "", by: "You", at: Date.now(), reason: reason }; }, () => { o.entry = null; }, r => { if (r.entry && o.entry) Object.assign(o.entry, r.entry); });
  }
  async function push() {
    if (!B.officers.some(o => o.entry)) return say("Nobody on the list", "Add the officers to remove first.");
    for (let i = 0; PEND > 0 && i < 100; i++) await new Promise(r => setTimeout(r, 150));
    const pv = await call("obPreview"); if (!pv.ok) return say("Couldn't plan the removal", pv.error === "AUTH" ? "Your MDT session expired. Sign on again." : pv.error || "No answer from the server.");
    const ok = pv.plan.filter(p => !p.error);
    const m = M().modal('<h3 style="font:700 24px Barlow Condensed,sans-serif;letter-spacing:.05em">🗂️ REMOVE FROM ONBOARDING</h3>' +
      '<p style="color:var(--mute);font-size:13.5px;line-height:1.5">Each officer\'s callsign, name and Discord ID are copied to <b>Onboarding Terminations</b> (a new block starting at row ' + pv.start + ", one line below the last list) with today's date. Then their Onboarding Roster slot is emptied and its Status and Training Status are reset.</p>" +
      '<div class="pbx-plan">' + pv.plan.map(p => '<div class="' + (p.error ? "bad" : "") + '"><b>' + esc(p.callsign + " · " + p.officer) + "</b><span>" + (p.error ? "" : "→ row " + p.toRow) + "</span>" + (p.error ? "<em>✕ " + esc(p.error) + "</em>" : "") + "</div>").join("") + "</div>" +
      '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button class="btn ghost" data-close>CANCEL</button><button class="btn ob-push" id="obGo"' + (ok.length ? "" : " disabled") + ">REMOVE " + ok.length + "</button></div>");
    const b = m.querySelector("#obGo"); if (!b) return;
    b.onclick = async () => {
      b.disabled = true; b.textContent = "UPDATING THE ROSTER…";
      const r = await call("obPush");
      if (!r.ok) return say("The removal didn't go through", (r.error || "No answer from the server.") + " Nothing was changed unless it says otherwise.");
      const gone = {}; (r.done || []).forEach(p => gone[p.callsign] = 1);
      B.officers = B.officers.filter(o => !gone[o.callsign]); B.recent = (r.done || []).map(p => ({ callsign: p.callsign, officer: p.officer, reason: "Onboarding time ran out", at: Date.now(), result: "Terminations row " + p.toRow })).concat(B.recent || []);
      call("obBoard").then(x => { if (x.ok) M().draw(); });
      m.querySelector(".md-box").innerHTML = '<div class="pbx-done"><span>🗂️</span><h3>' + r.removed + " REMOVED</h3><p>They're on Onboarding Terminations and their slots are free.</p>" +
        ((r.skipped || []).length ? '<div class="pbx-plan">' + r.skipped.map(s => '<div class="bad"><b>' + esc(s.callsign + " · " + s.officer) + "</b><em>✕ " + esc(s.error) + "</em></div>").join("") + "</div>" : "") + '<button class="btn" data-close>DONE</button></div>';
      M().draw();
    };
  }
  let DRAG = "";
  document.addEventListener("click", e => {
    const t = e.target; if (!t.closest) return;
    if (t.closest("[data-obrefresh]")) { B = null; M().draw(); return; }
    if (!document.querySelector("[data-obdrop]")) return;
    const sw = t.closest("[data-obshow]"); if (sw) { SHOW = sw.dataset.obshow; M().draw(); return; }
    const ad = t.closest("[data-obadd]"); if (ad) { add(ad.dataset.obadd); return; }
    if (t.closest("[data-oball]")) { B.officers.filter(o => !o.entry && st(o) === "over").forEach(o => add(o.callsign)); M().toast("Added everyone who's out of time"); return; }
    const un = t.closest("[data-obun]"); if (un) { const o = B.officers.find(x => x.callsign === un.dataset.obun); if (!o) return; const was = o.entry; quick("obUnlist", { callsign: o.callsign }, () => { o.entry = null; }, () => { o.entry = was; }); M().toast(o.name + " stays on onboarding"); return; }
    if (t.closest("[data-obpush]")) { push(); return; }
  });
  document.addEventListener("input", e => { if (e.target.id === "obQ") { Q = e.target.value; const p = e.target.selectionStart; M().draw(); const n = document.getElementById("obQ"); if (n) { n.focus(); n.setSelectionRange(p, p); } } });
  document.addEventListener("dragstart", e => { const c = e.target.closest && e.target.closest("[data-obc][draggable]"); if (!c) return; DRAG = c.dataset.obc; c.classList.add("drag"); try { e.dataTransfer.setData("text/plain", DRAG); } catch (x) {} const d = document.querySelector("[data-obdrop]"); if (d) d.classList.add("hint"); });
  document.addEventListener("dragend", () => { DRAG = ""; document.querySelectorAll(".pbx-o.drag").forEach(x => x.classList.remove("drag")); const d = document.querySelector("[data-obdrop]"); if (d) d.classList.remove("hint", "over"); });
  document.addEventListener("dragover", e => { const d = e.target.closest && e.target.closest("[data-obdrop]"); if (d && DRAG) { e.preventDefault(); d.classList.add("over"); } });
  document.addEventListener("drop", e => { const d = e.target.closest && e.target.closest("[data-obdrop]"); if (!d || !DRAG) return; e.preventDefault(); d.classList.remove("over", "hint"); const cs = DRAG; DRAG = ""; add(cs); });
  window.MDTOnb = { html: html };
  if (/^#onbremove$/.test(location.hash) && window.MDT) window.MDT.draw();
})();
