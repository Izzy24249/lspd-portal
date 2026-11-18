/* LSPD MDT — My Division. Every division the officer is on (from the division roster tabs) gets its own entry in the
   side menu; clicking it opens a drop-down: Division stats, My record, My certs, Roster, Vehicles, Uniforms. Only their own divisions. */
(function () {
  "use strict";
  const M = () => window.MDT, esc = s => M().esc(s), DATA = {}, BUSY = {};
  let LIST = [], OPEN = {};
  try { OPEN = JSON.parse(localStorage.getItem("mdt:mydivOpen") || "{}") || {}; } catch (e) {}
  const SUB = [["stats", "Division stats", "i-chart"], ["record", "My record", "i-shield"], ["certs", "My certs", "i-cert"], ["roster", "Roster", "i-file"], ["vehicles", "Vehicles", "i-car"], ["uniforms", "Uniforms", "i-shirt"]];
  const ICON = { "i-chart": "i-star" };
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 3600 ? Math.max(1, Math.round(s / 60)) + "m ago" : s < 86400 ? Math.round(s / 3600) + "h ago" : Math.round(s / 86400) + "d ago"; };
  const day = t => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  // ---------- side menu ----------
  function nav(list) {
    LIST = list || [];
    const grp = document.getElementById("myDivGrp"), box = document.getElementById("myDivNav"); if (!grp || !box) return;
    grp.hidden = !LIST.length; if (!LIST.length) { box.innerHTML = ""; return; }
    const cur = M().view ? M().view() : "";
    if (LIST.length === 1 && OPEN[LIST[0].id] == null) OPEN[LIST[0].id] = true;
    box.innerHTML = LIST.map(d => {
      const on = !!OPEN[d.id] || cur.indexOf("mydiv:" + d.id + ":") === 0;
      return '<button type="button" class="fa md-dv' + (on ? " open" : "") + '" data-mdtog="' + esc(d.id) + '" style="--dc:' + esc(d.color || "#2f7bff") + '" aria-expanded="' + on + '"><i class="md-dot"></i><span>' + esc(d.name) + '</span><svg class="md-car" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>' +
        '<div class="md-sub"' + (on ? "" : " hidden") + ">" + SUB.map(s => '<a data-go="mydiv:' + esc(d.id) + ":" + s[0] + '" class="' + (cur === "mydiv:" + d.id + ":" + s[0] ? "on" : "") + '"><svg><use href="#' + (ICON[s[2]] || s[2]) + '"/></svg><span>' + esc(s[1]) + "</span></a>").join("") + "</div>";
    }).join("");
  }
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-mdtog]"); if (!t) return;
    const id = t.dataset.mdtog; OPEN[id] = !t.classList.contains("open");
    try { localStorage.setItem("mdt:mydivOpen", JSON.stringify(OPEN)); } catch (x) {}
    nav(LIST);
    if (OPEN[id] && !(M().view() || "").startsWith("mydiv:" + id + ":")) M().go("mydiv:" + id + ":stats");
  });

  // ---------- data ----------
  function load(id, force) {
    if (BUSY[id] || (!force && DATA[id] && Date.now() - DATA[id]._t < 120000)) return;
    BUSY[id] = 1;
    Portal.post({ action: "myDivision", session: M().session, division: id }).then(r => { r = r || { ok: false, error: "No answer." }; r._t = Date.now(); DATA[id] = r; })
      .catch(() => { DATA[id] = { ok: false, error: "Couldn't reach the server.", _t: Date.now() }; })
      .finally(() => { delete BUSY[id]; if ((M().view() || "").indexOf("mydiv:" + id + ":") === 0) M().draw(); });
  }
  function title(v) { const p = v.split(":"), d = LIST.find(x => x.id === p[1]), s = SUB.find(x => x[0] === p[2]); return [d ? d.name.toUpperCase() : "MY DIVISION", s ? s[1] : "Division"]; }

  // ---------- pages ----------
  // the officer's own division ID card: division callsign + name up top, their billet, standing this week, what they've done for the
  // division, the extra roster columns that are theirs (K9 name, aircraft, role…) and their certs as badges
  function head(R, sub) {
    const dv = R.division, me = R.me, P = me.profile || {}, L = me.life || {}, need = dv.quotaPts, hr = new Date().getHours();
    const hi = hr < 5 ? "Night shift" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    const last = String(me.name || "").split(/\s+/).pop();
    const chips = [];
    if (me.loa) chips.push(["loa", "On LOA"]); else if (me.exempt) chips.push(["loa", me.exempt]);
    else if (need) chips.push([me.ptsW >= need ? "ok" : me.stage ? "bad" : "mid", me.ptsW >= need ? "✓ Quota met" : me.ptsW + " / " + need + " pts this week"]);
    if (me.place) chips.push(["mid", (me.place === 1 ? "👑 " : "#") + (me.place === 1 ? "Top officer" : me.place + " of " + me.onBoard) + " this week"]);
    chips.push(R.record && R.record.points ? ["bad", R.record.ladder] : ["ok", "Good standing"]);
    if (me.staff) chips.push(["lead", "⭐ Division leadership"]);
    const since = P.date || (L.first ? day(L.first) : "");
    return '<div class="md-hero md-id" style="--dc:' + esc(dv.color || "#2f7bff") + '"><img class="md-wm" src="' + esc(dv.logoUrl || "img/lspd-badge.png") + '" alt="" onerror="this.remove()">' +
      '<img class="md-badge" src="' + esc(dv.logoUrl || "img/lspd-badge.png") + '" alt="" onerror="this.src=\'img/lspd-badge.png\'">' +
      '<div class="md-idm"><small>' + esc(hi) + ", " + esc(P.billet || me.rank || "Officer") + " " + esc(last) + " · " + esc(dv.name).toUpperCase() + "</small>" +
      '<h1><span class="md-cs">' + esc(me.callsign || P.unit || "—") + "</span> " + esc(me.name) + "</h1>" +
      "<p>" + esc([me.section && me.section !== P.billet ? me.section : "", P.billet || me.rank, me.deptCallsign ? "Dept " + me.deptCallsign : "", since ? "In " + dv.name + " since " + since : ""].filter(Boolean).join(" · ")) + "</p>" +
      '<div class="md-chips">' + chips.map(c => '<span class="' + c[0] + '">' + esc(c[1]) + "</span>").join("") + "</div>" +
      ((P.fields || []).length ? '<dl class="md-pf">' + P.fields.map(f => "<div><dt>" + esc(f.k) + "</dt><dd>" + esc(f.v) + "</dd></div>").join("") + "</dl>" : "") +
      ((R.myCerts || []).length ? '<div class="md-bd">' + R.myCerts.map(c => '<span title="Certified">✓ ' + esc(c) + "</span>").join("") + "</div>" : "") + "</div>" +
      '<div class="md-svc"><div><b>' + (L.filed || 0) + "</b><small>reports filed</small></div><div><b>" + (L.assists || 0) + "</b><small>assists</small></div><div><b>" + (L.pts || 0) + "</b><small>division points</small></div><div><b>" + (L.best || 0) + "</b><small>best week</small></div></div></div>" +
      '<div class="md-tabs" style="--dc:' + esc(dv.color || "#2f7bff") + '">' + SUB.map(s => '<a data-go="mydiv:' + esc(dv.id) + ":" + s[0] + '" class="' + (s[0] === sub ? "on" : "") + '">' + esc(s[1]) + "</a>").join("") + "</div>";
  }
  function stats(R) {
    const me = R.me, need = R.division.quotaPts, f = need ? Math.min(1, me.ptsW / need) : 0, NW = R.division.inactWeeks;
    let warn = "";
    if (me.loa) warn = '<div class="md-alert loa">You\'re on LOA, so the quota and inactivity don\'t apply to you right now.</div>';
    else if (me.exempt) warn = '<div class="md-alert loa">' + esc(me.exempt) + ": no quota for you, but your points still count for the division.</div>";
    else if (me.stage) warn = '<div class="md-alert w' + Math.min(3, me.stage >= NW ? 3 : me.stage) + '"><b>' + (me.stage >= NW ? "Removal due" : "Week " + me.stage + " with no division activity") + "</b>" +
      (me.stage >= NW ? "You've had no division points for " + me.stage + " weeks. Talk to your division leader right away." : "File or assist on a division report this week to reset it. After " + NW + " weeks in a row, officers are removed from the division.") + "</div>";
    const r = R.race, ends = new Date(R.weekEnd).toLocaleString(undefined, { weekday: "long", hour: "numeric" });
    let h = warn + '<div class="md-grid">' +
      '<section class="md-card"><span class="md-k">MY POINTS THIS WEEK</span><div class="md-big">' + me.ptsW + (need ? "<em> / " + need + "</em>" : "") + "</div>" +
        (need ? '<div class="md-bar' + (me.ptsW >= need ? " met" : "") + '"><i style="width:' + Math.round(f * 100) + '%"></i></div><small>' + (me.ptsW >= need ? "✓ Quota met." : need - me.ptsW + " more points to meet the quota.") + " Week resets " + esc(ends) + ".</small>" : "<small>Week resets " + esc(ends) + ".</small>") +
        '<div class="md-wk">' + me.weeks.slice(0, 3).map((n, i) => '<span class="' + (n ? "on" : "off") + '"><b>' + n + "</b><small>" + (i ? i + 1 + " wks ago" : "last week") + "</small></span>").join("") + "</div></section>" +
      '<section class="md-card"><span class="md-k">DIVISION RACE</span>' + (r ? '<div class="md-big">' + (r.rank === 1 && r.points ? "👑 1st" : "#" + r.rank) + "<em> of " + r.of + "</em></div><small>" + r.points + " points this week" +
        (r.ahead ? " · " + (r.ahead.points - r.points) + " behind " + esc(r.ahead.name) : r.points ? " · leading the race" : "") + " · last week " + r.last + "</small>" +
        '<div class="md-race">' + r.standings.map(x => '<div class="' + (x.me ? "me" : "") + '" style="--c:' + esc(x.color || "#888") + '"><span>' + esc(x.name) + "</span><i style=\"width:" + Math.round(x.points / Math.max(1, r.standings[0].points) * 100) + '%"></i><b>' + x.points + "</b></div>").join("") + "</div>"
        : "<small>The race isn't running right now.</small>") + "</section></div>" +
      '<div class="md-grid"><section class="md-card"><span class="md-k">TOP OFFICERS THIS WEEK</span>' + (R.board.length ? R.board.map((x, i) => '<div class="md-lb' + (x.me ? " me" : "") + '"><em>' + (i + 1) + "</em><span><b>" + esc(x.name) + "</b><small>" + esc(x.callsign || "") + "</small></span><b>" + x.pts + "</b></div>").join("") : "<small>No division reports yet this week. Be the first.</small>") + "</section>" +
      '<section class="md-card"><span class="md-k">WHAT I EARNED THIS WEEK</span>' + (me.items.filter(x => x.at >= R.weekStart).length ? me.items.filter(x => x.at >= R.weekStart).map(x => '<div class="md-it"><span>' + (x.kind === "filed" ? "📝" : "🤝") + "</span><div><b>" + esc(x.title) + "</b><small>" + esc(x.form) + " · " + esc(ago(x.at)) + (x.grade ? " · graded " + esc(x.grade) : "") + "</small></div><em>+" + x.pts + "</em></div>").join("") :
        "<small>Nothing yet this week. Filing a division report is 10 points (plus a bonus when it's graded A, B or C), being tagged as an assist is 4.</small>") + "</section></div>";
    return h;
  }
  function record(R) {
    const rc = R.record;
    return '<section class="md-card"><span class="md-k">MY DISCIPLINE RECORD</span><div class="md-big">' + rc.points + "<em> active point" + (rc.points === 1 ? "" : "s") + "</em></div><small>" + esc(rc.ladder) + ". Points stop counting when they expire. Only you and your division's leadership can see this.</small>" +
      (rc.entries.length ? rc.entries.map(x => '<div class="md-rec' + (x.live ? "" : " old") + '"><div><span class="md-ty t-' + esc(x.type) + '">' + esc(x.label) + "</span><small>" + esc(day(x.at)) + (x.pts ? " · +" + x.pts + " pts" : "") +
        (x.status !== "active" ? " · " + esc(x.status) : x.expires ? (x.live ? " · until " : " · ended ") + esc(day(x.expires)) : "") + "</small></div><p>" + esc(x.reason) + "</p><small>by " + esc(x.by || "—") + "</small></div>").join("") : '<p class="md-none">Clean record. Nothing on file.</p>') + "</section>";
  }
  // short column heads for the cert columns ("SWAT CERT" → "SWAT", "Search & Rescue" → "S&R"); the full name is the tooltip
  const short = n => { const t = String(n).replace(/\b(cert(ified|ification)?s?|qualif\w*|status)\b/ig, "").replace(/\s+/g, " ").trim() || n; return t.length > 9 ? t.split(/[\s/-]+/).map(w => w[0]).join("").toUpperCase().slice(0, 5) : t; };
  // the division roster as one table: division callsign, department callsign, name, the division's own columns (K9 name,
  // T.I.G.…), a ✓ column per cert, and a copy button for the Discord ID
  function roster(R) {
    const C = R.certNames || [], X = (R.rosterCols || []).filter(x => !/role|position|duty/i.test(x)), groups = [], bySec = new Set(R.roster.map(o => o.section).filter(Boolean)).size >= 2;
    R.roster.forEach(o => { const g = (bySec ? o.section : o.rank || o.section) || "Members"; let x = groups.find(y => y.n === g); if (!x) { x = { n: g, l: [] }; groups.push(x); } x.l.push(o); });
    const cols = 5 + X.length + C.length;
    return '<section class="md-card"><span class="md-k">' + esc(R.division.name).toUpperCase() + " · " + R.roster.length + ' MEMBERS</span><p class="md-none" style="margin:4px 0 10px">⭐ = division leadership, the people to go to with questions.' + (C.length ? " ✓ = certified." : "") + " Click an ID to copy it.</p>" +
      '<div class="md-tw"><table class="md-rt"><thead><tr><th>Div unit</th><th>Callsign</th><th>Name</th>' + X.map(x => "<th>" + esc(x) + "</th>").join("") +
      C.map(c => '<th class="c" title="' + esc(c) + '">' + esc(short(c)) + "</th>").join("") + "<th>Discord ID</th><th></th></tr></thead><tbody>" +
      groups.map(g => '<tr class="g"><td colspan="' + cols + '">' + esc(g.n) + "</td></tr>" + g.l.map(o => '<tr class="' + (o.me ? "me" : "") + (o.loa ? " loa" : "") + '">' +
        "<td><code>" + esc(o.callsign || "—") + '</code></td><td><code class="d">' + esc(o.dept || "—") + "</code></td>" +
        "<td><b>" + esc(o.name) + "</b>" + (o.staff ? " ⭐" : "") + (o.me ? " <small>(you)</small>" : "") + (o.billet && o.billet !== g.n ? "<br><small>" + esc(o.billet) + "</small>" : "") + "</td>" +
        X.map(x => "<td>" + (o.f && o.f[x] ? esc(o.f[x]) : '<span class="n">—</span>') + "</td>").join("") +
        C.map(c => (o.certs || []).indexOf(c) !== -1 ? '<td class="c y" title="' + esc(c) + '">✓</td>' : '<td class="c n">·</td>').join("") +
        "<td>" + (o.id ? '<button class="md-id-cp" data-copy="' + esc(o.id) + '" data-what="Discord ID" title="' + esc(o.id) + '">⧉ …' + esc(o.id.slice(-4)) + "</button>" : '<span class="n">—</span>') + "</td>" +
        "<td>" + (o.loa ? "<em>LOA</em>" : "") + "</td></tr>").join("")).join("") + "</tbody></table></div></section>";
  }
  // one certification tile: earned, or not yet (with steps when there's a path to it)
  function tile(c) {
    return '<div class="mc' + (c.has ? " on" : "") + (c.steps ? " mc-p" : "") + '"><i>' + (c.has ? (c.steps ? "◐" : "✓") : "—") + "</i><div><b>" + esc(c.name) + "</b>" +
      (c.how || c.src ? "<small>" + esc([c.how, c.src && c.src !== "auto" ? c.src : ""].filter(Boolean).join(" · ")) + (c.since ? " · since " + esc(day(c.since)) : "") + "</small>" : "") +
      (c.steps ? '<ul>' + c.steps.map(x => '<li class="' + (x.done ? "ok" : "") + '">' + (x.done ? "✓ " : "○ ") + esc(x.t) + "</li>").join("") + "</ul>" + (c.next ? "<small>Both done → <b>" + esc(c.next) + "</b></small>" : "") : "") + "</div></div>";
  }
  function divCerts(R) {
    const C = R.certNames || [], mine = R.myCerts || [];
    if (!C.length) return '<div class="empty">' + esc(R.division.name) + " doesn't track any certifications on its roster yet.</div>";
    return '<section class="md-card"><span class="md-k">MY ' + esc(R.division.name).toUpperCase() + " CERTIFICATIONS · " + mine.length + " OF " + C.length + '</span><div class="mc-grid">' +
      C.map(n => tile({ name: n, has: mine.indexOf(n) !== -1, how: mine.indexOf(n) !== -1 ? "Certified" : "Not certified yet" })).join("") + '</div><small class="md-foot">Ask your division leaders about getting certified.</small></section>';
  }
  // ---------- MDT → My certifications (every cert, all divisions) ----------
  let ALL = null, ALLBUSY = false;
  function loadAll(force) {
    if (ALLBUSY || (!force && ALL && Date.now() - ALL._t < 120000)) return; ALLBUSY = true;
    Portal.post({ action: "myCerts", session: M().session }).then(r => { ALL = r || { ok: false, error: "No answer." }; }).catch(() => { ALL = { ok: false, error: "Couldn't reach the server." }; })
      .finally(() => { ALL._t = Date.now(); ALLBUSY = false; if (M().view() === "mycerts") M().draw(); });
  }
  function certsHTML() {
    loadAll();
    if (!ALL) return '<div class="empty">Loading your certifications…</div>';
    if (!ALL.ok) return '<div class="empty">' + esc(ALL.error === "AUTH" ? "Your MDT session expired. Sign on again." : ALL.error || "Couldn't load.") + "</div>";
    const dept = (ALL.fto || []).concat(ALL.dept || []), got = dept.filter(c => c.has).length + ALL.divisions.reduce((n, d) => n + d.certs.filter(c => c.has).length, 0);
    let h = '<div class="mc-hero"><div><small>MY CERTIFICATIONS</small><h1>' + got + " held</h1><p>" + esc(ALL.rank || "") + (ALL.divisions.length ? " · " + ALL.divisions.map(d => d.name).join(", ") : "") + "</p></div></div>";
    h += '<section class="md-card mc-sec"><span class="md-k">DEPARTMENT</span>' + (dept.length ? '<div class="mc-grid">' + dept.map(tile).join("") + "</div>" : '<p class="md-none">No department certifications yet. Corporals start the FTO program; Sergeants and above are FTOs.</p>') + "</section>";
    ALL.divisions.filter(d => d.certs.length).forEach(d => { const n = d.certs.filter(c => c.has).length;
      h += '<section class="md-card mc-sec" style="--dc:' + esc(d.color || "#2f7bff") + '"><span class="md-k"><i class="md-dot"></i>' + esc(d.name).toUpperCase() + " · " + n + " OF " + d.certs.length + "</span>" +
        (d.certs.length ? '<div class="mc-grid">' + d.certs.map(c => tile({ name: c.name, has: c.has, how: c.has ? "Certified" : "Not certified yet" })).join("") + "</div>" : '<p class="md-none">This division doesn\'t track certifications.</p>') + "</section>"; });
    return h;
  }
  function gear(R, kind) {
    const L = (R.gear || []).filter(x => x.kind === (kind === "vehicles" ? "vehicle" : "uniform"));
    if (!L.length) return '<div class="empty">' + esc(R.division.name) + " hasn't added any division " + kind + " yet. Your division leaders can add them in Division Command.</div>";
    return '<div class="cards">' + L.map(x => {
      const rows = kind === "vehicles" ? [["Rank", x.rank], ["Livery", x.livery], ["Extras", x.extras], ["Use", x.use]] : [["When", x.when]].concat((x.items || []).map(i => [i.k, i.v]));
      return '<div class="card' + (kind === "uniforms" ? " u" : "") + '">' + (x.photo ? '<div class="pic" style="background-image:url(\'' + esc(x.photo) + "')" + (kind === "uniforms" ? ";height:200px" : "") + '"></div>' : "") +
        '<div class="top"><span class="rk">' + esc(R.division.name).toUpperCase() + (x.rank ? " · " + esc(x.rank).toUpperCase() : "") + "</span><b>" + esc(x.name) + "</b></div><div class=\"bd\">" +
        (x.code ? '<button class="code" data-copy="' + esc(x.code) + '" data-what="' + (kind === "vehicles" ? "Spawn code" : "Duplicate code") + '"><span>' + esc(x.code) + "</span><em>COPY " + (kind === "vehicles" ? "SPAWN" : "DUPLICATE") + " CODE</em></button>" : "") +
        '<dl class="kv">' + rows.filter(r => r[1]).map(r => "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>").join("") + "</dl>" + (x.note ? '<small style="color:var(--mute);font-size:11.5px">' + esc(x.note) + "</small>" : "") + "</div></div>";
    }).join("") + "</div>";
  }
  function html(v) {
    const p = v.split(":"), id = p[1], sub = p[2], R = DATA[id];
    load(id);
    if (!LIST.some(x => x.id === id) && LIST.length) return '<div class="empty">You\'re not on that division\'s roster.</div>';
    if (!R) return '<div class="empty">Loading your division…</div>';
    if (!R.ok) return '<div class="empty">' + esc(R.error === "AUTH" ? "Your MDT session expired. Sign on again." : R.error || "Couldn't load.") + "</div>";
    return '<div class="md-page" style="--dc:' + esc(R.division.color || "#2f7bff") + '">' + head(R, sub) + (sub === "record" ? record(R) : sub === "roster" ? roster(R) : sub === "certs" ? divCerts(R) : sub === "vehicles" || sub === "uniforms" ? gear(R, sub) : stats(R));
  }
  window.MDTMyDiv = { nav: nav, html: html, title: title, certsHTML: certsHTML };
})();
