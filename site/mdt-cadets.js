/* LSPD MDT — Cadet roster check (portal owner only).
   The Google Sheet's Onboarding roster is the truth. The Duty Portal add-on reads the Duty Portal's Cadets roster,
   this page lists every difference, and the ones you leave ticked are fixed by the add-on on the Duty Portal. */
(function () {
  "use strict";
  let B = null, LOADING = false, ALL = false, OFF = {}, POLL = null, BUSY = false;
  const M = () => window.MDT, esc = s => M().esc(s);
  const ago = t => { if (!t) return "never"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };
  async function call(action, extra) {
    const r = await Portal.post(Object.assign({ action: action, session: M().session }, extra || {})).catch(() => ({ ok: false, error: "Couldn't reach the server." }));
    return r || { ok: false, error: "No answer from the server." };
  }
  function load() { if (LOADING) return; LOADING = true; call("cdBoard").then(r => { LOADING = false; B = r; M().draw(); watch(); }); }
  const live = j => j && (j.st === "queued" || j.st === "working");
  function watch() {
    const busy = B && B.ok && Object.keys(B.jobs || {}).some(k => live(B.jobs[k]));
    if (busy && !POLL) POLL = setInterval(() => { if (!document.querySelector(".cd-wrap")) { clearInterval(POLL); POLL = null; return; } call("cdBoard").then(r => { if (r.ok) { B = r; M().draw(); } if (!(r.ok && Object.keys(r.jobs || {}).some(k => live(r.jobs[k])))) { clearInterval(POLL); POLL = null; } }); }, 8000);
  }
  function jobChip(j) {
    if (!j) return "";
    const T = { queued: ["wait", "⏳ waiting for the add-on"], working: ["work", "🤖 " + (j.step || "working…")], done: ["ok", "✓ " + (j.msg || "done")], failed: ["bad", "⚠ " + (j.msg || "couldn't finish")] }[j.st] || ["wait", j.st];
    return '<span class="cd-job ' + T[0] + '">' + esc(T[1]) + "</span>";
  }
  const TY = { clear: ["✖", "Clear", "no"], move: ["🔁", "Move", "warn"], assign: ["➕", "Add", "info"], hold: ["⏸", "Hold", "hold"] };
  function html() {
    if (!B && !LOADING) load();
    let h = '<div class="cd-wrap"><div class="h2"><div><h1>CADET ROSTER CHECK</h1><p>The Google Sheet\'s Onboarding roster is the source of truth. The Duty Portal add-on reads the Duty Portal\'s <b>Cadets</b> roster, every spot that doesn\'t match is listed below, and the changes you leave ticked are made on the Duty Portal by the add-on. Officers who aren\'t in the Duty Portal yet get their spot put on hold.</p></div></div>';
    if (!B) return h + '<div class="pbx-empty">Loading…</div></div>';
    if (!B.ok) return h + '<div class="pbx-empty">' + esc(B.error === "AUTH" ? "Your MDT session expired. Sign on again." : B.error || "Couldn't load.") + "</div></div>";
    const sj = (B.jobs || {}).cdscan, sc = B.scan || {};
    h += '<div class="cd-bar"><button class="pbx-btn" data-cdscan' + (live(sj) || !B.sync ? " disabled" : "") + ">" + (live(sj) ? "CHECKING…" : "🔎 CHECK THE DUTY PORTAL NOW") + "</button>" +
      '<span class="cd-meta">' + (sc.at ? "Last read " + ago(sc.at) + " · " + (sc.n || 0) + " cadet spots" : "The Duty Portal hasn't been read yet") + "</span>" + (sj ? jobChip(sj) : "") +
      '<label class="cd-tg"><input type="checkbox" data-cdall' + (ALL ? " checked" : "") + "> Show matching spots too</label></div>";
    if (!B.sync) h += '<div class="cd-warn">The Duty Portal add-on isn\'t set up yet, so it can\'t read or change the Cadets roster.</div>';
    if (B.error) h += '<div class="cd-warn">' + esc(B.error) + "</div>";
    if (sc.at && sc.menu && sc.menu.length && !sc.menu.some(x => /hold|reserve/i.test(x))) h += '<div class="cd-warn">Heads up: the menu on an empty cadet spot shows <b>' + esc(sc.menu.join(" · ")) + '</b>, with no hold option, so a hold can\'t be placed. Spots that need one will show "couldn\'t finish".</div>';
    if (!sc.at) return h + '<div class="pbx-empty">Press <b>Check the Duty Portal now</b>. The add-on reads the Cadets roster (it changes nothing) and the differences show up here in a minute or two.</div></div>';
    const opsById = {}; (B.ops || []).forEach(o => opsById[o.id] = o);
    const rows = (B.rows || []).filter(r => ALL || !r.ok || r.ops.some(id => (B.jobs || {})["cd:" + id]));
    const todo = (B.ops || []).filter(o => !OFF[o.id] && !live((B.jobs || {})["cd:" + o.id]));
    const okN = (B.rows || []).filter(r => r.ok).length;
    h += '<div class="cd-sum"><span class="pbx-chip ok">✓ ' + okN + " match</span>" + Object.keys(TY).map(t => { const n = (B.ops || []).filter(o => o.type === t).length; return n ? '<span class="pbx-chip ' + TY[t][2] + '">' + TY[t][0] + " " + n + " " + TY[t][1].toLowerCase() + "</span>" : ""; }).join("") + "</div>";
    if (!rows.length) h += '<div class="pbx-empty">Everything matches. The Duty Portal\'s Cadets roster is the same as the Google Sheet.</div>';
    else h += '<div class="cd-tbl"><div class="cd-hd"><span>SPOT</span><span>GOOGLE SHEET (ONBOARDING)</span><span>DUTY PORTAL (CADETS)</span><span>WHAT HAPPENS</span></div>' + rows.map(r => {
      const dp = r.dp, sh = r.sheet;
      return '<div class="cd-r' + (r.ok ? " ok" : "") + '"><code>' + esc(r.cs) + "</code>" +
        "<span>" + (sh.name ? "<b>" + esc(sh.name) + "</b><small>" + (sh.id ? esc(sh.id) : "no Discord ID") + "</small>" : '<i class="cd-mt">empty</i>') + "</span>" +
        "<span>" + (!dp ? '<i class="cd-mt">not found</i>' : dp.id ? "<b>" + esc(dp.who || "?") + "</b><small>" + esc(dp.id) + "</small>" : dp.st === "hold" ? '<b class="cd-hold">ON HOLD</b>' + (dp.who ? "<small>" + esc(dp.who) + "</small>" : "") : '<i class="cd-mt">open</i>') + "</span>" +
        '<span class="cd-do">' + (r.ok ? '<span class="cd-okt">✓ matches</span>' + (r.note ? "<small>" + esc(r.note) + "</small>" : "") : "") +
          r.ops.map(id => { const o = opsById[id], j = (B.jobs || {})["cd:" + id], T = TY[o.type];
            return '<label class="cd-op ' + T[2] + '"><input type="checkbox" data-cdop="' + esc(id) + '"' + (OFF[id] ? "" : " checked") + (live(j) ? " disabled" : "") + "><span><b>" + T[0] + " " + T[1] + "</b> " + esc(o.why) + "</span>" + jobChip(j) + "</label>"; }).join("") +
          (!r.ok && !r.ops.length && r.note ? "<small>" + esc(r.note) + "</small>" : "") + "</span></div>";
    }).join("") + "</div>";
    if ((B.ops || []).length) h += '<div class="cd-foot"><span>' + todo.length + " change" + (todo.length === 1 ? "" : "s") + " ticked. The add-on makes them one at a time on the Duty Portal, then reads the Cadets roster again.</span>" +
      '<button class="pbx-btn" data-cdapply' + (todo.length && !BUSY ? "" : " disabled") + ">" + (BUSY ? "SENDING…" : "APPLY " + todo.length + " CHANGE" + (todo.length === 1 ? "" : "S")) + "</button></div>";
    return h + "</div>";
  }
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.matches && t.matches("[data-cdop]")) { if (t.checked) delete OFF[t.dataset.cdop]; else OFF[t.dataset.cdop] = 1; M().draw(); }
    if (t.matches && t.matches("[data-cdall]")) { ALL = t.checked; M().draw(); }
  });
  document.addEventListener("click", e => {
    const t = e.target; if (!t.closest || !document.querySelector(".cd-wrap")) return;
    if (t.closest("[data-cdscan]")) { (B.jobs = B.jobs || {}).cdscan = { st: "queued" }; M().draw();
      call("cdScan").then(r => { if (!r.ok) { M().toast(r.error || "Couldn't start the check."); delete B.jobs.cdscan; M().draw(); return; } M().toast("Sent to the Duty Portal add-on. It usually takes a minute."); load(); }); return; }
    if (t.closest("[data-cdapply]")) {
      const ops = (B.ops || []).filter(o => !OFF[o.id] && !live((B.jobs || {})["cd:" + o.id])).map(o => o.id); if (!ops.length || BUSY) return;
      BUSY = true; ops.forEach(id => { B.jobs["cd:" + id] = { st: "queued" }; }); M().draw();
      call("cdApply", { ops: ops }).then(r => { BUSY = false; if (!r.ok) { M().toast(r.error || "Couldn't send the changes."); } else M().toast(r.queued + " change" + (r.queued === 1 ? "" : "s") + " sent to the Duty Portal add-on."); load(); });
    }
  });
  window.MDTCadets = { html: html, reload: () => { B = null; load(); } };
  if (/^#cadets$/.test(location.hash) && window.MDT) window.MDT.draw();
})();
