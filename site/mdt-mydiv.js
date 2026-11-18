/* LSPD MDT — My Division. Every division the officer is on (from the division roster tabs) gets its own entry in the
   side menu; clicking it opens a drop-down: Division stats, My record, Roster, Vehicles, Uniforms. Only their own divisions. */
(function () {
  "use strict";
  const M = () => window.MDT, esc = s => M().esc(s), DATA = {}, BUSY = {};
  let LIST = [], OPEN = {};
  try { OPEN = JSON.parse(localStorage.getItem("mdt:mydivOpen") || "{}") || {}; } catch (e) {}
  const SUB = [["stats", "Division stats", "i-chart"], ["record", "My record", "i-shield"], ["roster", "Roster", "i-file"], ["vehicles", "Vehicles", "i-car"], ["uniforms", "Uniforms", "i-shirt"]];
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
  function head(R, sub) {
    const dv = R.division;
    return '<div class="md-hero" style="--dc:' + esc(dv.color || "#2f7bff") + '"><img src="' + esc(dv.logoUrl || "img/lspd-badge.png") + '" alt="" onerror="this.src=\'img/lspd-badge.png\'"><div><small>MY DIVISION</small><h1>' + esc(dv.name) + "</h1>" +
      (dv.tagline ? "<p>" + esc(dv.tagline) + "</p>" : "") + '</div><div class="md-me"><b>' + esc(R.me.callsign || "") + "</b><span>" + esc(R.me.rank || "") + (R.me.staff ? " · leadership" : "") + "</span></div></div>" +
      '<div class="md-tabs">' + SUB.map(s => '<a data-go="mydiv:' + esc(dv.id) + ":" + s[0] + '" class="' + (s[0] === sub ? "on" : "") + '">' + esc(s[1]) + "</a>").join("") + "</div>";
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
  function roster(R) {
    const groups = []; R.roster.forEach(o => { const g = o.rank || o.section || "Members"; let x = groups.find(y => y.n === g); if (!x) { x = { n: g, l: [] }; groups.push(x); } x.l.push(o); });
    return '<section class="md-card"><span class="md-k">' + esc(R.division.name).toUpperCase() + " · " + R.roster.length + ' MEMBERS</span><p class="md-none" style="margin:4px 0 10px">⭐ = division leadership, the people to go to with questions.</p>' +
      groups.map(g => '<div class="md-rg"><b>' + esc(g.n) + "</b>" + g.l.map(o => '<div class="md-ro' + (o.me ? " me" : "") + '"><code>' + esc(o.callsign || "—") + "</code><span>" + esc(o.name) + (o.staff ? " ⭐" : "") + (o.me ? " (you)" : "") + "</span>" + (o.loa ? "<em>LOA</em>" : "") + "</div>").join("") + "</div>").join("") + "</section>";
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
    return head(R, sub) + (sub === "record" ? record(R) : sub === "roster" ? roster(R) : sub === "vehicles" || sub === "uniforms" ? gear(R, sub) : stats(R));
  }
  window.MDTMyDiv = { nav: nav, html: html, title: title };
})();
