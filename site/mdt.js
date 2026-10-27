/* LSPD Mobile Data Terminal — the officer's home after signing on.
   Home: training path + SOP + quick links · Fleet: vehicles by rank · Uniforms: outfits by rank (with your badge). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LS = { get(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }, set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} },
    json(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } } };
  const SESSION = LS.get("lspd_sess");
  if (!SESSION) { location.replace("signon.html?next=" + encodeURIComponent("mdt.html" + location.hash)); return; }

  let DATA = LS.json("mdt:home"), VIEW = "home", FLEET_ALL = LS.get("mdt:fleetAll") === "1", UNI_ALL = LS.get("mdt:uniAll") === "1", SEX = LS.get("mdt:sex") || "male";
  function toast(t) { const x = $("toast"); x.textContent = t; x.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => x.classList.remove("show"), 2200); }
  function copy(text, what) {
    const done = () => toast(what + " copied: " + text);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("Copy: " + text); } t.remove(); }
  }

  // ---------- strip: clock, watch, unit ----------
  function tick() {
    const d = new Date(); $("clk").textContent = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    $("clkD").textContent = d.toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase();
    const h = d.getHours(); $("watch").textContent = h >= 6 && h < 14 ? "DAY WATCH" : h >= 14 && h < 22 ? "SWING WATCH" : "NIGHT WATCH";
  }
  tick(); setInterval(tick, 1000);
  const last = n => String(n || "").replace(/([a-z'])RM\b/g, "$1").trim().split(/\s+/).pop();
  function who(p) { return p ? ((p.title || "Officer") + " " + last(p.name)) : "Officer"; }
  function drawStrip() {
    const p = (DATA && DATA.profile) || LS.json("lspd_prof") || {};
    $("uCs").textContent = p.callsign || "----"; $("uName").textContent = who(p).toUpperCase();
    $("me").innerHTML = 'Signed on as <b>' + esc(p.callsign || "—") + "</b> · " + esc(who(p)) + '<br><a href="signon.html?out=1">Sign off (10-7)</a>';
    const sop = (DATA && DATA.sop) || "https://docs.google.com/document/d/1t4vHCiHS3xH2VTfDgOKRX3L7BeZyh8YrCLaC_bZTJqw/edit?tab=t.0"; $("sopLink").href = sop;
    const nb = (DATA && DATA.board && DATA.board.notices || []).length; $("nBolo").textContent = nb || ""; $("nBolo").className = nb ? "new" : "";
    if (DATA && DATA.fleet) { $("nFleet").textContent = DATA.fleet.vehicles.filter(v => v.allowed).length || ""; $("nUni").textContent = (DATA.fleet.uniforms[SEX] || []).filter(u => u.yours).length || ""; }
  }

  // ---------- router ----------
  const VIEWS = ["home", "fleet", "uniforms", "records", "reference"];
  function go(v) { VIEW = VIEWS.indexOf(v) >= 0 ? v : "home"; if (location.hash.slice(1) !== VIEW) history.replaceState(null, "", "#" + VIEW); draw(); window.scrollTo(0, 0); }
  document.addEventListener("click", e => { const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); go(a.getAttribute("data-go")); } });
  addEventListener("hashchange", () => go(location.hash.slice(1)));

  function drawTicker() {
    const t = $("ticker"), list = (DATA && DATA.board && DATA.board.dept && DATA.board.dept.ticker) || [];
    if (!list.length) { t.hidden = true; return; }
    t.hidden = false; t.innerHTML = '<div class="live"><i></i>LIVE</div><div class="tk-run">' + list.concat(list).map(x => "<span>" + esc(x.t) + " · " + ago(x.at) + "</span>").join("") + "</div>";
  }
  function modal(html) { const m = $("modal"); m.innerHTML = '<div class="md-box">' + html + "</div>"; m.hidden = false; m.onclick = e => { if (e.target === m || e.target.closest("[data-close]")) m.hidden = true; }; return m; }
  function draw() {
    document.querySelectorAll("[data-go]").forEach(a => a.classList.toggle("on", a.getAttribute("data-go") === VIEW));
    drawStrip();
    const m = $("main");
    if (!DATA) { m.innerHTML = '<div class="boot">ESTABLISHING LINK…</div>'; return; }
    m.innerHTML = '<div class="view">' + (VIEW === "fleet" ? fleetHTML() : VIEW === "uniforms" ? uniformsHTML() : VIEW === "records" ? recordsHTML() : VIEW === "reference" ? refHTML() : homeHTML()) + "</div>";
    if (VIEW === "reference" && !REF) loadRef();
    if (VIEW === "records") { const q = $("recQ"); if (q && !matchMedia("(max-width:760px)").matches) q.focus(); }
    drawTicker();
  }

  // ---------- home ----------
  function greet() { const h = new Date().getHours(); return h < 5 ? "Evening" : h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening"; }
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "now" : m < 60 ? m + "m" : m < 1440 ? Math.round(m / 60) + "h" : Math.round(m / 1440) + "d"; };
  const gcls = g => { const x = String(g || "").toUpperCase()[0]; return x === "R" ? "r" : x === "A" ? "a" : x === "B" ? "b" : x === "C" ? "c" : x ? "c" : "w"; };
  function memoHTML(b, B) {
    if (!b) return '<div class="memo"><div class="mh"><span>LSPD · MEMORANDUM</span><span>' + esc(new Date().toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()) + "</span></div><p>No briefing posted for this shift. Check your division channels and stay safe out there.</p></div>";
    const d = new Date(b.at);
    return '<div class="memo"><div class="mh"><span>LSPD · MEMORANDUM</span><span>' + esc(d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()) + "</span></div>" +
      "<dl><dt>TO:</dt><dd>" + esc(b.to) + "</dd><dt>FROM:</dt><dd>" + esc(b.from) + "</dd><dt>RE:</dt><dd>" + esc(b.re) + "</dd></dl>" +
      esc(b.body).split(/\n{2,}/).map(x => "<p>" + x.replace(/\n/g, "<br>") + "</p>").join("") +
      (b.acked ? '<span class="stamp">READ AT ROLL CALL</span>' : "") + "</div>" +
      '<div class="ackrow">' + (b.acked ? '<span class="acked">✓ Acknowledged</span>' : '<button class="btn" data-ack="' + esc(b.id) + '">ACKNOWLEDGE · ROLL CALL</button>') +
      (b.ackCount != null ? '<span class="lbl">' + b.ackCount + " acknowledged</span>" : "") + "</div>";
  }
  function homeHTML() {
    const p = DATA.profile || {}, f = DATA.fleet || {}, B = DATA.board || {}, trainee = f.rank && f.rank.trainee, mine = B.mine || [];
    const waiting = mine.filter(r => !r.grade).length;
    let h = '<div class="hello"><div><h1>' + esc(greet()) + ", " + esc(last(p.name) || "Officer") + '. <span>' + esc(trainee ? "Welcome to the academy." : "Ready when you are.") + "</span></h1>" +
      '<p>Signed on as <b>' + esc(p.callsign || "—") + "</b> · " + esc(who(p)) + (mine.length ? " · last report <b>" + ago(mine[0].at) + " ago</b>" + (waiting ? " · " + waiting + " waiting on a grade" : "") : "") + '</p></div><a class="file" href="index.html">FILE A REPORT <kbd>F</kbd></a></div>';
    const NB = B.notices || [];
    if (NB.length) h += '<section class="bolos">' + NB.slice(0, 3).map(n => '<a class="bolo t-' + esc(n.type.toLowerCase()) + '" data-go="records"><b>' + esc(n.type.toUpperCase()) + "</b><span>" + esc(n.title) + "</span><small>" + esc(n.from) + " · " + ago(n.at) + " ago</small></a>").join("") + (NB.length > 3 ? '<a class="bolo more" data-go="records">+' + (NB.length - 3) + " more</a>" : "") + "</section>";
    // briefing | path
    h += '<div class="grid"><section class="pane"><div class="ph"><span class="lbl">Shift briefing</span>' + (B.canBrief ? '<a data-brief>Post briefing</a>' : (B.past || []).length ? '<a data-past>Past briefings</a>' : "") + "</div>" + memoHTML(B.briefing, B) + "</section>";
    if ((DATA.paths || []).length) h += pathHTML(DATA.paths[0]);
    else h += '<section class="pane"><div class="ph"><span class="lbl">Standard Operating Procedures</span></div><div class="sop"><svg viewBox="0 0 24 24"><use href="#i-book"/></svg><div><b>LSPD SOP</b><small>Policy, radio, pursuits, use of force. Keep it handy.</small></div><a class="btn" target="_blank" rel="noopener" href="' + esc(DATA.sop) + '">OPEN ↗</a></div>' +
      '<div class="tiles" style="grid-template-columns:1fr 1fr">' + tile("fleet", "i-car", "Fleet", (f.vehicles || []).filter(v => v.allowed).length + " approved") + tile("uniforms", "i-shirt", "Uniforms", ((f.uniforms || {})[SEX] || []).filter(u => u.yours).length + " for your rank") + "</div></section>";
    h += "</div>";
    (DATA.paths || []).slice(1).forEach(pa => { h += '<div style="margin-top:18px">' + pathHTML(pa) + "</div>"; });
    // reports | department | needs you / tiles
    const D = B.dept || {};
    h += '<div class="grid3"><section class="pane"><div class="ph"><span class="lbl">My reports</span><a href="myreports.html">All</a></div>' +
      (mine.length ? mine.map(r => '<div class="rep"><div><b>' + esc((r.no ? r.no + " · " : "") + (r.title || r.formTitle)) + "</b><small>" + esc(r.formTitle) + (r.tagged ? " · you were tagged" : "") + " · " + (r.grade ? "graded by " + esc(r.gradedBy || "command") + (r.comments ? ' · "' + esc(r.comments) + '"' : "") : "filed " + ago(r.at) + " ago") + '</small></div><span class="gr ' + gcls(r.grade) + '"' + (r.grade === "R" ? ' title="Returned for correction: fix it and file again"' : "") + ">" + esc(r.grade === "R" ? "↩" : r.grade || "…") + "</span></div>").join("")
        : '<p style="color:var(--mute)">Nothing yet. Reports you file, or get tagged in, show up here with their grade.</p>') + "</section>";
    h += '<section class="pane"><div class="ph"><span class="lbl">Department · this week</span></div><div class="big"><div><small>Reports filed</small><b>' + (D.week || 0) + "</b>" + (D.delta ? "<em" + (D.delta < 0 ? ' style="color:var(--red)"' : "") + ">" + (D.delta > 0 ? "▲ " : "▼ ") + Math.abs(D.delta) + "</em>" : "") + "</div><div><small>Officers active</small><b>" + (D.active || 0) + "</b></div><div><small>Avg. grade (30 days)</small><b>" + esc(D.avg || "—") + "</b></div><div><small>Trainees in program</small><b>" + (D.trainees || 0) + "</b></div></div>";
    const mx = Math.max(1, ...(D.days || []).map(x => x.n));
    h += '<div class="spark">' + (D.days || []).map((x, i, a) => '<i class="' + (i === a.length - 1 ? "t" : "") + '" style="height:' + Math.max(4, Math.round(x.n / mx * 100)) + '%" title="' + x.n + ' reports"></i>').join("") + '</div><div class="days">' + (D.days || []).map(x => "<span>" + esc(x.d) + "</span>").join("") + "</div></section>";
    if (B.needs) h += '<section class="pane"><div class="ph"><span class="lbl">Needs you · FTO</span></div>' + (B.needs.length ? B.needs.map(n => '<div class="need"><span class="cs">' + esc(n.callsign || "—") + "</span><div><b>" + esc(n.name) + '</b><small class="' + (n.hot ? "hot" : "") + '">' + esc(n.why) + '</small></div><a href="index.html">' + esc(n.act) + "</a></div>").join("") : '<p style="color:var(--mute)">All trainees are on track.</p>') + "</section>";
    else h += '<section class="pane"><div class="ph"><span class="lbl">Quick access</span></div><div class="tiles" style="grid-template-columns:1fr;margin-top:0">' + tile("fleet", "i-car", "Fleet", (f.vehicles || []).filter(v => v.allowed).length + " vehicles approved for you") + tile("uniforms", "i-shirt", "Uniforms", ((f.uniforms || {})[SEX] || []).filter(u => u.yours).length + " outfits for your rank") + "</div></section>";
    h += "</div>";
    if ((p.divisions || []).length) h += '<div class="tiles"><a class="tile" href="division.html"><svg><use href="#i-shield"/></svg><b>Division Command</b><small>Your divisions: activity, grading and officers</small></a></div>';
    return h;
  }
  function tile(go, icon, t, s) { return '<a class="tile" data-go="' + go + '"><svg><use href="#' + icon + '"/></svg><b>' + esc(t) + "</b><small>" + esc(s) + "</small></a>"; }
  function pathHTML(pa) {
    const pct = pa.total ? Math.round(pa.done / pa.total * 100) : 0;
    let firstOpen = (pa.tasks || []).findIndex(t => !t.done);
    let h = '<section class="pane pathx"><div class="ph"><span class="lbl">' + esc(pa.title || "Training path") + '</span><span class="lbl" style="color:var(--tx)">' + pa.done + " / " + pa.total + " complete</span></div>" +
      '<div class="prog"><i style="width:' + pct + '%"></i></div><div class="meta">' +
      (pa.tig != null ? "<span>Time in program: <b>" + pa.tig + " days</b>" + (pa.tigDays ? " of " + pa.tigDays : "") + "</span>" : "") +
      (pa.since ? "<span>Started <b>" + esc(pa.since) + "</b></span>" : "") + "</div><div class=\"path\">";
    (pa.tasks || []).forEach((t, i) => {
      const cls = t.done ? "done" : t.locked ? "lock" : i === firstOpen ? "now" : "";
      const need = t.need || 1, cnt = Math.min(t.count || 0, need);
      const recent = (t.items || []).filter(x => !x.failed).slice(-2).map(x => esc(x.date) + (x.source ? " · " + esc(x.source) : "")).join("<br>");
      h += '<div class="step ' + cls + '"><i>' + (t.done ? "✓" : t.locked ? "🔒" : i + 1) + '</i><div><b>' + esc(t.title) + "</b>" +
        "<small>" + esc(t.done ? (t.excused ? "Excused by command" : "Completed") : t.locked ? "Unlocks when the other steps are done" : (t.desc || (need > 1 ? cnt + " of " + need + " done" : "Not started yet"))) + "</small>" +
        (!t.done && need > 1 ? '<div class="bar"><i style="width:' + Math.round(cnt / need * 100) + '%"></i></div>' : "") +
        (recent ? '<div class="items"><small>' + recent + "</small></div>" : "") + '</div><span class="pg">' + cnt + "/" + need + "</span></div>";
    });
    h += "</div>";
    if (pa.deadline) h += '<div class="dl ' + esc(pa.deadline.state) + '"><span>Deadline · ' + esc(pa.deadline.date) + (pa.deadline.extended ? " (extended)" : "") + "</span><b>" +
      (pa.deadline.state === "done" ? "Complete" : pa.deadline.left <= 0 ? "Overdue" : pa.deadline.left + " days left") + "</b></div>";
    return h + "</section>";
  }

  // ---------- records & BOLOs ----------
  let REC = null, REC_KIND = "person", REC_BUSY = false, REF = null, REF_Q = "";
  function boloCard(n, canClose) {
    return '<div class="card bolo-c t-' + esc(n.type.toLowerCase()) + '">' + (n.image ? '<div class="pic" style="background-image:url(\'' + esc(n.image) + '\')"></div>' : "") +
      '<div class="bd"><span class="rk ' + (n.type === "Notice" ? "lo" : "no") + '" style="position:static;justify-self:start">' + esc(n.type.toUpperCase()) + '</span><b class="bt">' + esc(n.title) + "</b>" +
      (n.details ? '<p class="bdx">' + esc(n.details).replace(/\n/g, "<br>") + "</p>" : "") + '<small class="bm">' + esc(n.from) + " · " + new Date(n.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) +
      (n.expires ? " · until " + new Date(n.expires).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "") + "</small>" + (canClose ? '<button class="btn ghost" data-close-notice="' + esc(n.id) + '">CLEAR</button>' : "") + "</div></div>";
  }
  function recordsHTML() {
    const B = DATA.board || {}, NB = B.notices || [];
    let h = '<div class="h2"><div><h1>RECORDS <span>· people &amp; vehicles</span></h1><p>Search every report on file: suspects, victims, witnesses, plates and vehicles.</p></div>' +
      (B.canNotice ? '<button class="btn" data-new-notice>+ POST BOLO / NOTICE</button>' : "") + "</div>";
    if (B.canRecords === false) h += '<div class="empty">Records lookup opens up once you\'re certified (Officer level). Active BOLOs are below.</div>';
    else h += '<form class="recf" id="recForm"><div class="seg"><button type="button" data-rk="person" class="' + (REC_KIND === "person" ? "on" : "") + '">PERSON</button><button type="button" data-rk="vehicle" class="' + (REC_KIND === "vehicle" ? "on" : "") + '">VEHICLE</button><button type="button" data-rk="any" class="' + (REC_KIND === "any" ? "on" : "") + '">ANYTHING</button></div>' +
      '<input id="recQ" autocomplete="off" placeholder="' + (REC_KIND === "vehicle" ? "Plate, model or color…" : REC_KIND === "person" ? "Name or Discord ID…" : "Any word in a report…") + '" value="' + esc(REC ? REC.q : "") + '"><button class="btn" type="submit">' + (REC_BUSY ? "SEARCHING…" : "RUN") + "</button></form>" + recResults();
    h += '<div class="sect"><span class="lbl">Active BOLOs &amp; notices · ' + NB.length + '</span></div>' + (NB.length ? '<div class="cards">' + NB.map(n => boloCard(n, B.canNotice)).join("") + "</div>" : '<div class="empty">No active BOLOs.</div>');
    return h;
  }
  function recResults() {
    if (!REC) return '<p class="rec-hint">Tip: a last name finds every report it appears in. Results show newest first.</p>';
    if (REC.error) return '<div class="empty">' + esc(REC.error) + "</div>";
    if (!REC.total) return '<div class="empty">No records for "' + esc(REC.q) + '".</div>';
    let h = '<p class="rec-hint"><b>' + REC.total + "</b> report" + (REC.total === 1 ? "" : "s") + ' mention "' + esc(REC.q) + '"' + (REC.total > REC.results.length ? " · showing the newest " + REC.results.length : "") + "</p>";
    if ((REC.subjects || []).length > 1) h += '<div class="subj">' + REC.subjects.map(x => '<span>' + (x.kind === "vehicle" ? "🚗 " : "👤 ") + esc(x.name) + " <b>" + x.n + "</b></span>").join("") + "</div>";
    h += '<div class="recs">' + REC.results.map((r, i) => '<button class="rec" data-rec="' + i + '"><span class="ic">' + esc(r.icon) + '</span><div><b>' + esc(r.form) + "</b><small>" + (r.at ? esc(new Date(r.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })) : "") + "</small>" +
      r.match.map(m => '<div class="mt"><span>' + esc(m.label) + "</span>" + hl(m.value, REC.q) + "</div>").join("") + '</div><em>VIEW ›</em></button>').join("") + "</div>";
    return h;
  }
  function hl(v, q) { v = String(v).replace(/\s*\(\d{15,21}\)/g, ""); const i = v.toLowerCase().indexOf(q.toLowerCase()); return i < 0 ? esc(v) : esc(v.slice(0, i)) + "<mark>" + esc(v.slice(i, i + q.length)) + "</mark>" + esc(v.slice(i + q.length)); }
  async function runSearch(q) {
    REC_BUSY = true; draw();
    const r = await Portal.post({ action: "recordsSearch", session: SESSION, q: q, kind: REC_KIND }).catch(() => ({ ok: false, error: "Couldn't reach the records server." }));
    REC_BUSY = false; REC = r.ok ? r : { q: q, error: r.error === "AUTH" ? "Sign on again." : r.error }; draw();
  }
  // ---------- quick reference ----------
  async function loadRef() { const r = await Portal.post({ action: "quickRef", session: SESSION }).catch(() => null); REF = r && r.ok ? r : { penal: [], tenCodes: [], error: true }; if (VIEW === "reference") draw(); }
  function refHTML() {
    let h = '<div class="h2"><div><h1>QUICK REFERENCE</h1><p>Penal code from the LSPD report forms, and radio codes.</p></div><input class="refq" id="refQ" placeholder="Search charges or codes…" value="' + esc(REF_Q) + '"></div>';
    if (!REF) return h + '<div class="boot">LOADING PENAL CODE…</div>';
    const q = REF_Q.toLowerCase(), P = REF.penal.filter(x => !q || x.raw.toLowerCase().indexOf(q) !== -1), C = REF.tenCodes.filter(x => !q || (x[0] + " " + x[1]).toLowerCase().indexOf(q) !== -1);
    h += '<div class="grid" style="align-items:start"><section class="pane"><div class="ph"><span class="lbl">Penal code · ' + P.length + "</span></div>" +
      (P.length ? '<table class="pc"><tr><th>Charge</th><th>Class</th><th>Time</th><th>Fine</th></tr>' + P.map(x => "<tr><td>" + esc(x.name) + '</td><td><span class="cls c-' + esc(x.cls.toLowerCase()) + '">' + esc(x.cls || "—") + "</span></td><td>" + (x.months ? x.months + " mo" : "—") + "</td><td>" + (x.fine ? "$" + x.fine.toLocaleString() : "—") + "</td></tr>").join("") + "</table>"
        : '<p style="color:var(--mute)">' + (REF.penal.length ? "No charge matches." : "No charges found in the forms yet. Charges written like \"Robbery (Felony, 18 Months - $9,000 Fine)\" in any form's charge list show up here.") + "</p>") + "</section>" +
      '<section class="pane"><div class="ph"><span class="lbl">Radio codes</span></div><table class="pc">' + C.map(x => '<tr><td class="mono" style="white-space:nowrap;color:#cfe0ff">' + esc(x[0]) + "</td><td>" + esc(x[1]) + "</td></tr>").join("") + "</table></section></div>";
    return h;
  }

  // ---------- fleet ----------
  const CAR = '<svg class="ph-car" viewBox="0 0 120 50"><path d="M8 38v-9l10-12h40l16 9h24l12 6v6H8z"/><circle cx="30" cy="38" r="7"/><circle cx="92" cy="38" r="7"/><path d="M22 18h34v9H14"/></svg>';
  function chips(req, opt) {
    const list = s => /^[\d\s,]+$/.test(String(s || "").trim()) && String(s).trim() ? String(s).split(",").map(x => x.trim()).filter(Boolean) : null;
    const r = list(req), o = list(opt);
    if ((req && !r && !/^none$/i.test(req)) || (opt && !o && !/^(none|n\/a)$/i.test(opt))) return '<dt>Extras</dt><dd>' + (req ? "<b>Required:</b> " + esc(req) : "") + (opt ? "<br><b>Optional:</b> " + esc(opt) : "") + "</dd>";
    if (!r && !o) return "<dt>Extras</dt><dd>None</dd>";
    return '<dt>Extras</dt><dd class="ex">' + (r || []).map(n => '<i class="r">' + esc(n) + "</i>").join("") + (o || []).map(n => "<i>" + esc(n) + "</i>").join("") + "</dd>";
  }
  function fleetHTML() {
    const f = DATA.fleet || {}, rk = f.rank || {}, all = f.vehicles || [];
    const show = all.filter(v => FLEET_ALL || v.allowed);
    let h = '<div class="h2"><div><h1>FLEET <span>· ' + esc(rk.known || rk.trainee ? rk.name : "rank not on file") + "</span></h1><p>" +
      (rk.known || rk.trainee ? "You can drive anything at or below your rank. Tap a spawn code to copy it." : "Your rank isn't in column B of the roster, so you're shown Police Officer vehicles. Ask command to fix your roster entry.") +
      '</p></div><div class="seg"><button data-fa="0" class="' + (FLEET_ALL ? "" : "on") + '">MY RANK · ' + all.filter(v => v.allowed).length + '</button><button data-fa="1" class="' + (FLEET_ALL ? "on" : "") + '">ALL RANKS · ' + all.length + "</button></div></div>";
    if (!all.length) return h + '<div class="empty">No vehicles found. Command: make sure the roster has a "Vehicle Guidelines" tab.</div>';
    const secs = []; show.forEach(v => { const s = v.section || "Vehicles"; if (secs.indexOf(s) === -1) secs.push(s); });
    secs.forEach(s => {
      h += '<div class="sect"><span class="lbl">' + esc(s) + '</span></div><div class="cards">';
      show.filter(v => (v.section || "Vehicles") === s).forEach(v => {
        const miss = !v.spawn;
        h += '<div class="card' + (v.allowed ? "" : " locked") + '"><div class="pic"' + (v.photo ? ' style="background-image:url(\'' + esc(v.photo) + '\')"' : "") + ">" + (v.photo ? "" : CAR) +
          '<span class="rk' + (v.allowed ? "" : " no") + '">' + (v.allowed ? "✓ APPROVED" : "🔒 " + esc(v.rank).toUpperCase()) + '</span><div class="nm"><small>' + esc(v.rank) + "</small><b>" + esc(v.name) + "</b></div></div>" +
          (v.allowed ? "" : '<div class="lockmsg"><b>🔒 ' + esc(v.rank).toUpperCase() + "</b><small>Unlocks at this rank</small></div>") +
          '<div class="bd">' + (miss ? '<div class="code miss"><span>Spawn code missing</span><em>ASK COMMAND</em></div>' : '<button class="code" data-copy="' + esc(v.spawn) + '" data-what="Spawn code"' + (v.allowed ? "" : " disabled") + "><span>" + esc(v.allowed ? v.spawn : "•••••••••") + "</span><em>" + (v.allowed ? "COPY SPAWN CODE" : "LOCKED") + "</em></button>") +
          '<dl class="kv"><dt>Livery</dt><dd>' + esc(v.livery || "—") + "</dd><dt>Color</dt><dd>" + esc(v.color || "—") + "</dd><dt>Mods</dt><dd>" + esc(v.mods || "—") + "</dd><dt>Slicktop</dt><dd>" + esc(v.slick || "—") + "</dd>" + chips(v.req, v.opt) + "</dl>" +
          '<small style="color:var(--mute);font-size:11.5px">Blue = required extras · outline = optional</small></div></div>';
      });
      h += "</div>";
    });
    if ((f.vehicleRules || []).length) h += '<div class="rules"><details open><summary>Vehicle rules</summary><ul>' + f.vehicleRules.map(r => "<li>" + esc(r) + "</li>").join("") + "</ul></details></div>";
    return h;
  }

  // ---------- uniforms ----------
  function uniformsHTML() {
    const f = DATA.fleet || {}, rk = f.rank || {}, list = (f.uniforms || {})[SEX] || [];
    const mine = list.filter(u => u.yours), show = UNI_ALL ? list : mine, badge = f.badge;
    let h = '<div class="h2"><div><h1>UNIFORMS <span>· ' + esc(rk.known || rk.trainee ? rk.name : "rank not on file") + "</span></h1><p>Outfits approved for your rank. Tap a duplicate code to copy it." +
      (badge ? " Your badge &amp; logo: <b>" + esc(badge.value) + "</b>." : "") + '</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      (f.female ? '<div class="seg"><button data-sex="male" class="' + (SEX === "male" ? "on" : "") + '">MALE</button><button data-sex="female" class="' + (SEX === "female" ? "on" : "") + '">FEMALE</button></div>' : "") +
      '<div class="seg"><button data-ua="0" class="' + (UNI_ALL ? "" : "on") + '">MY RANK · ' + mine.length + '</button><button data-ua="1" class="' + (UNI_ALL ? "on" : "") + '">ALL · ' + list.length + "</button></div></div></div>";
    if (!list.length) return h + '<div class="empty">No uniforms found. Command: make sure the roster has a "Patrol Attire Guidelines" tab.</div>';
    h += '<div class="cards">';
    show.forEach(u => {
      const st = u.yours ? "" : u.locked ? " locked" : "";
      h += '<div class="card u' + st + '">' + (u.photo ? '<div class="pic" style="background-image:url(\'' + esc(u.photo) + '\');height:200px"></div>' : "") +
        '<div class="top"><span class="rk' + (u.yours ? "" : u.locked ? " no" : " lo") + '">' + (u.yours ? "✓ YOUR RANK" : u.locked ? "🔒 HIGHER RANK" : "OTHER RANK") + "</span><b>" + esc(u.title) + "</b></div>" +
        '<div class="bd"><button class="code" data-copy="' + esc(u.code) + '" data-what="Duplicate code"' + (u.locked ? " disabled" : "") + "><span>" + esc(u.code) + '</span><em>COPY DUPLICATE CODE</em></button><div class="uitems">' +
        (u.items || []).map(it => it.head ? '<span class="hd">' + esc(it.head) + "</span>" : (() => {
          let val = it.value || "—", cls = "";
          if (/insignia chart/i.test(val) && badge && u.yours) { val = badge.value; cls = "mine"; }
          return "<div><span>" + esc(it.label) + '</span><b class="' + cls + '">' + esc(val) + "</b></div>";
        })()).join("") + "</div></div>" + (u.locked ? '<div class="lockmsg"><small>For higher ranks</small></div>' : "") + "</div>";
    });
    h += "</div>";
    const ins = f.insignia || [];
    h += '<div class="rules">' + ((f.uniformRules || []).length ? '<details open><summary>Uniform rules</summary><ul>' + f.uniformRules.map(r => "<li>" + esc(r) + "</li>").join("") + "</ul></details>" : "") +
      (ins.length ? '<details><summary>Rank insignia chart</summary><table><tr><th>Rank</th><th>Badges &amp; logos</th></tr>' + ins.map(x => '<tr class="' + (rk.idx === x.idx ? "me" : "") + '"><td>' + esc(x.rank) + "</td><td>" + esc(x.badge) + "</td></tr>").join("") + "</table></details>" : "") + "</div>";
    return h;
  }

  document.addEventListener("click", e => {
    const c = e.target.closest("[data-copy]"); if (c && !c.disabled) { copy(c.getAttribute("data-copy"), c.getAttribute("data-what") || "Code"); return; }
    const fa = e.target.closest("[data-fa]"); if (fa) { FLEET_ALL = fa.getAttribute("data-fa") === "1"; LS.set("mdt:fleetAll", FLEET_ALL ? "1" : ""); draw(); return; }
    const ua = e.target.closest("[data-ua]"); if (ua) { UNI_ALL = ua.getAttribute("data-ua") === "1"; LS.set("mdt:uniAll", UNI_ALL ? "1" : ""); draw(); return; }
    const sx = e.target.closest("[data-sex]"); if (sx) { SEX = sx.getAttribute("data-sex"); LS.set("mdt:sex", SEX); draw(); return; }
    const rk = e.target.closest("[data-rk]"); if (rk) { REC_KIND = rk.getAttribute("data-rk"); const q = ($("recQ") || {}).value || ""; REC = null; draw(); const n = $("recQ"); if (n) { n.value = q; n.focus(); } return; }
    const rc = e.target.closest("[data-rec]"); if (rc) { const r = REC.results[+rc.getAttribute("data-rec")]; modal("<h3>" + esc(r.icon + " " + r.form) + '</h3><dl class="kv full">' + r.fields.map(f => "<dt>" + esc(f.label) + "</dt><dd>" + hl(f.value, REC.q).replace(/\n/g, "<br>") + "</dd>").join("") + '</dl><div class="md-act"><button class="btn ghost" data-close>Close</button></div>'); return; }
    const cn = e.target.closest("[data-close-notice]"); if (cn) { cn.disabled = true; Portal.post({ action: "mdtNoticeClose", session: SESSION, id: cn.getAttribute("data-close-notice") }).then(r => { if (r.ok) { DATA.board.notices = DATA.board.notices.filter(n => n.id !== cn.getAttribute("data-close-notice")); draw(); toast("Cleared."); } else { cn.disabled = false; toast(r.error || "Couldn't clear it."); } }); return; }
    if (e.target.closest("[data-new-notice]")) {
      const m = modal('<h3>Post a BOLO or notice</h3><div class="seg" id="nType"><button type="button" class="on" data-t="BOLO">BOLO</button><button type="button" data-t="Wanted">WANTED</button><button type="button" data-t="Notice">NOTICE</button></div><label>Title<input id="nTitle" maxlength="120" placeholder="Black Sultan RS · plate 46EEK572"></label><label>Details<textarea id="nDet" rows="5" maxlength="2000" placeholder="Last seen heading north on Route 68. Armed. Approach with caution."></textarea></label><label>Photo link (optional)<input id="nImg" placeholder="https://i.imgur.com/….png"></label><label>Keep it up for<input id="nDays" type="number" min="1" max="30" value="7"></label><div class="md-act"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="nGo">POST</button></div>');
      let type = "BOLO"; m.querySelector("#nType").onclick = ev => { const b = ev.target.closest("[data-t]"); if (!b) return; type = b.dataset.t; m.querySelectorAll("#nType button").forEach(x => x.classList.toggle("on", x === b)); };
      m.querySelector("#nGo").onclick = async () => { const b = m.querySelector("#nGo"); b.disabled = true;
        const r = await Portal.post({ action: "mdtNoticePost", session: SESSION, type: type, title: m.querySelector("#nTitle").value, details: m.querySelector("#nDet").value, image: m.querySelector("#nImg").value.trim(), days: m.querySelector("#nDays").value }).catch(() => ({ ok: false, error: "Couldn't reach the server." }));
        if (r.ok) { m.hidden = true; toast("Posted to every MDT."); load(); } else { b.disabled = false; toast(r.error || "Couldn't post."); } };
      return;
    }
    const ak = e.target.closest("[data-ack]"); if (ak) { ak.disabled = true; Portal.post({ action: "mdtBriefAck", session: SESSION, id: ak.getAttribute("data-ack") }).then(r => { if (r.ok) { DATA.board.briefing.acked = true; if (DATA.board.briefing.ackCount != null) DATA.board.briefing.ackCount++; draw(); toast("Acknowledged. Have a safe shift."); } else { ak.disabled = false; toast(r.error || "Couldn't acknowledge."); } }); return; }
    if (e.target.closest("[data-past]")) { const P = (DATA.board.past || []); modal('<h3>Past briefings</h3>' + (P.length ? P.map(b => '<div class="pb"><b>' + esc(b.re) + "</b><small>" + esc(new Date(b.at).toLocaleDateString()) + " · " + esc(b.from) + "</small><p>" + esc(b.body).replace(/\n/g, "<br>") + "</p></div>").join("") : "<p>None yet.</p>") + '<div class="md-act"><button class="btn ghost" data-close>Close</button></div>'); return; }
    if (e.target.closest("[data-brief]")) {
      const m = modal('<h3>Post the shift briefing</h3><label>To<input id="bTo" value="All sworn personnel"></label><label>Subject (RE)<input id="bRe" maxlength="120" placeholder="Paleto patrol & report deadlines"></label><label>Briefing<textarea id="bBody" rows="7" maxlength="3000" placeholder="What every unit needs to know this shift…"></textarea></label><p class="md-note">Shows on every officer\'s MDT home. Officers tap Acknowledge for roll call, and you\'ll see how many have read it.</p><div class="md-act"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="bGo">POST BRIEFING</button></div>');
      m.querySelector("#bGo").onclick = async () => { const b = m.querySelector("#bGo"); b.disabled = true;
        const r = await Portal.post({ action: "mdtBriefPost", session: SESSION, to: m.querySelector("#bTo").value, re: m.querySelector("#bRe").value, body: m.querySelector("#bBody").value }).catch(() => ({ ok: false, error: "Couldn't reach the server." }));
        if (r.ok) { m.hidden = true; toast("Briefing posted."); load(); } else { b.disabled = false; toast(r.error || "Couldn't post."); } };
    }
  });

  // ---------- data ----------
  async function load() {
    try {
      const r = await Portal.post({ action: "officerHome", session: SESSION });
      if (!r.ok && r.error === "AUTH") { LS.set("lspd_sess", ""); location.replace("signon.html?next=" + encodeURIComponent("mdt.html#" + VIEW)); return; }
      if (!r.ok) throw new Error(r.error || "Couldn't load your terminal.");
      DATA = r; LS.set("mdt:home", JSON.stringify(r)); if (r.profile) LS.set("lspd_prof", JSON.stringify(r.profile));
      draw();
    } catch (e) { if (!DATA) $("main").innerHTML = '<div class="boot">LINK FAILED · ' + esc(e.message) + ' · <a href="" style="color:#8fb2ff">retry</a></div>'; else toast("Showing saved data: " + e.message); }
  }
  VIEW = VIEWS.indexOf(location.hash.slice(1)) >= 0 ? location.hash.slice(1) : "home";
  draw(); load();
  setInterval(() => { if (!document.hidden) load(); }, 3 * 60e3);
  document.addEventListener("submit", e => { if (e.target.id === "recForm") { e.preventDefault(); const q = $("recQ").value.trim(); if (q.length >= 2) runSearch(q); else toast("Type at least 2 characters."); } });
  document.addEventListener("input", e => { if (e.target.id === "refQ") { REF_Q = e.target.value; const pos = e.target.selectionStart; draw(); const n = $("refQ"); n.focus(); n.setSelectionRange(pos, pos); } });
  addEventListener("keydown", e => { if (e.key && e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey && !e.altKey && !/input|textarea|select/i.test((e.target.tagName || "")) && $("modal").hidden && !document.querySelector(".lk")) location.href = "index.html"; });
})();
