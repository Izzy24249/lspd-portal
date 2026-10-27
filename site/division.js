/* Division Command — what each division's leader sees: every report from the division's forms, who filed it,
   who was tagged (assists), quotas, inactivity, leaderboard, officer profiles, and grading posted to Discord. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), esc = s => Portal.esc(s);
  const TK = "lspd_admin_token";
  let TOKEN = "", ME = null, DATA = null, DIV = "", PERIOD = "week", TAB = "overview", SEEN = null, OFF_Q = "", OFF_SORT = "roster", REP_F = { state: "all", form: "", q: "" }, REP_N = 40, LAST = 0;
  try { TOKEN = localStorage.getItem(TK) || sessionStorage.getItem(TK) || ""; DIV = localStorage.getItem("dc:div") || ""; PERIOD = localStorage.getItem("dc:period") || "week"; } catch (e) {}
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  function toast(m, t) { const x = $("toast"); x.textContent = m; x.className = "toast show " + (t || ""); clearTimeout(toast.t); toast.t = setTimeout(() => x.className = "toast", 4500); }
  async function api(action, data) {
    const r = await Portal.post(Object.assign({ action: action, token: TOKEN }, data || {}));
    if (!r.ok && r.error === "AUTH") { signOut(true); throw new Error(r.message || "Please sign in again."); }
    if (!r.ok) throw new Error(r.message || r.error || "Something went wrong.");
    return r;
  }

  // ---------------- clock (the computer's own time) ----------------
  function tick() { const d = new Date(); $("clock").textContent = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }); $("clockDate").textContent = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).toUpperCase();
    if (LAST && !$("live").classList.contains("upd")) { const s = Math.round((Date.now() - LAST) / 1000); $("liveTxt").textContent = s < 5 ? "LIVE" : "LIVE · " + (s < 60 ? s + "s" : Math.round(s / 60) + "m") + " ago"; } }
  setInterval(tick, 1000);

  // ---------------- sign in ----------------
  function showLogin() { $("boot").hidden = true; $("app").hidden = true; $("login").hidden = false; setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) $("lgUser").focus(); }, 50); }
  $("loginForm").onsubmit = async e => {
    e.preventDefault(); $("lgErr").textContent = ""; $("lgBtn").disabled = true; $("lgBtn").textContent = "Verifying…";
    try {
      const r = await Portal.post({ action: "login", username: $("lgUser").value.trim(), password: $("lgPass").value, remember: $("lgKeep").checked });
      if (!r.ok) throw new Error(r.error || "Sign-in failed.");
      TOKEN = r.token;
      try { localStorage.removeItem(TK); sessionStorage.removeItem(TK); ($("lgKeep").checked ? localStorage : sessionStorage).setItem(TK, TOKEN); } catch (x) {}
      $("lgPass").value = ""; $("login").hidden = true; $("boot").hidden = false;
      await load(false);
    } catch (x) { $("lgErr").textContent = x.message; }
    finally { $("lgBtn").disabled = false; $("lgBtn").textContent = "Enter command"; }
  };
  function signOut(expired) {
    if (!expired && TOKEN) Portal.post({ action: "logout", token: TOKEN }).catch(() => {});
    TOKEN = ""; DATA = null; SEEN = null; Object.keys(MEM).forEach(k => delete MEM[k]);
    try { localStorage.removeItem(TK); sessionStorage.removeItem(TK); Object.keys(localStorage).filter(k => k.indexOf("dc:data:") === 0).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    showLogin();
  }
  $("outBtn").onclick = () => signOut(false);

  // ---------------- data ----------------
  // Each division's last data is kept (in memory and in this browser), so switching shows it instantly;
  // Google is asked for anything new in the background, and the other divisions are loaded ahead of time.
  const MEM = {}, BUSY = {}, LSK = id => "dc:data:" + id;
  const keep = (id, data) => { MEM[id] = { data: data, at: Date.now(), seen: new Set(data.reports.map(x => x.id)) };
    try { localStorage.setItem(LSK(id), JSON.stringify({ at: Date.now(), data: data }, (k, v) => k === "_new" ? undefined : v)); } catch (e) {} };
  const saved = id => { if (MEM[id]) return MEM[id]; try { const j = JSON.parse(localStorage.getItem(LSK(id)) || "null"); if (j && j.data && j.data.division) { MEM[id] = { data: j.data, at: j.at, seen: new Set(j.data.reports.map(x => x.id)), old: true }; return MEM[id]; } } catch (e) {} return null; };
  function setLive(t) { $("live").classList.toggle("upd", !!t); if (t) $("liveTxt").textContent = t; else tick(); }
  function show(data) {
    DATA = data; ME = data.me || ME; DIV = data.division.id; store("dc:div", DIV);
    $("boot").hidden = true; $("login").hidden = true; $("app").hidden = false;
    document.documentElement.style.setProperty("--ac", data.division.color || "#2f7bff");
    document.documentElement.style.setProperty("--acr", hexRgb(data.division.color || "#2f7bff"));
    drawAll();
  }
  // fetch one division; it's drawn only if it's still the one on screen when the answer arrives
  async function fetchDiv(id, fresh, quiet) {
    if (BUSY[id]) return BUSY[id];
    const run = (async () => {
      const r = await api("divView", { division: id, fresh: !!fresh });
      ME = r.me || ME;
      if (!r.division) { if (!DATA || !DATA.division) { DATA = r; drawEmpty(); } return null; }
      const rid = r.division.id, before = MEM[rid] && !MEM[rid].old ? MEM[rid].seen : null;
      if (before && rid === DIV && DATA && DATA.division && DATA.division.id === rid) {
        const nw = r.reports.filter(x => !before.has(x.id)); nw.forEach(x => x._new = true);
        if (nw.length) toast(nw.length === 1 ? "New report: " + (nw[0].author ? nw[0].author.name : "someone") + " · " + nw[0].formTitle : nw.length + " new reports came in", "ok");
      }
      keep(rid, r);
      if (!id || rid === DIV || !DATA || !DATA.division) { LAST = Date.now(); show(r); }
      return r;
    })();
    BUSY[id] = run;
    try { return await run; } finally { delete BUSY[id]; }
  }
  async function load(fresh, quiet) {
    const s = DIV && saved(DIV);
    if (s && (!DATA || !DATA.division || DATA.division.id !== DIV)) { LAST = s.at; show(s.data); }   // instant
    setLive(DATA && DATA.division ? "UPDATING…" : "");
    try { await fetchDiv(DIV, fresh, quiet); prefetch(); }
    catch (e) {
      if (!TOKEN) return;
      if (!DATA) { $("boot").querySelector("span").textContent = e.message; setTimeout(() => { if (!DATA && TOKEN) load(fresh); }, 6000); }
      else if (!quiet) toast(e.message, "bad");
    } finally { setLive(""); }
  }
  // the other divisions, one after another, so they're ready before they're clicked
  let pre = false;
  async function prefetch() {
    if (pre || !DATA || !DATA.divisions) return; pre = true;
    try { for (const d of DATA.divisions) { if (!TOKEN) break; if (d.id === DIV) continue; const m = MEM[d.id]; if (m && !m.old && Date.now() - m.at < 120000) continue; try { await fetchDiv(d.id, false, true); } catch (e) {} } }
    finally { pre = false; }
  }
  function switchDiv(id) {
    if (id === DIV) return;
    DIV = id; OPEN.clear(); store("dc:div", DIV);
    const s = saved(id);
    if (s) { LAST = s.at; show(s.data); if (Date.now() - s.at < 60000 && !s.old) return; }   // fresh enough: no wait at all
    else { $("view").innerHTML = '<div class="dc-empty">Loading division…</div>'; }
    load(false, true);
  }
  setInterval(() => { if (DATA && TOKEN && !document.hidden && $("modal").hidden) load(false, true); }, 60000);
  setInterval(() => { if (DATA && TOKEN && !document.hidden) prefetch(); }, 300000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && DATA && Date.now() - LAST > 60000) load(false, true); });
  $("refreshBtn").onclick = async () => { $("refreshBtn").classList.add("spin"); await load(true); $("refreshBtn").classList.remove("spin"); };
  function hexRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h) || [0, "2f7bff"]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(","); }

  // ---------------- numbers ----------------
  const DAY = 864e5, GP = { A: 4, B: 3, C: 2, D: 1, F: 0 }, GL = ["F", "D", "C", "B", "A"];
  function periodStart(p) {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (p === "week") { const ws = DATA.weekStart == null ? 1 : DATA.weekStart; d.setDate(d.getDate() - ((d.getDay() - ws + 7) % 7)); return d.getTime(); }
    if (p === "month") { d.setDate(1); return d.getTime(); }
    if (p === "30") return Date.now() - 30 * DAY;
    return 0;
  }
  const avgGrade = list => { const g = list.filter(r => r.grade && GP[r.grade] != null); if (!g.length) return null; const v = g.reduce((n, r) => n + GP[r.grade], 0) / g.length; return { letter: GL[Math.round(v)], value: v, n: g.length }; };
  const initials = n => String(n || "?").replace(/[^A-Za-z\s]/g, " ").trim().split(/\s+/).map(w => w[0]).slice(-2).join("").toUpperCase() || "?";
  const ago = t => { const s = (Date.now() - t) / 1000; return s < 60 ? "just now" : s < 3600 ? Math.round(s / 60) + "m ago" : s < 86400 ? Math.round(s / 3600) + "h ago" : s < 86400 * 30 ? Math.round(s / 86400) + "d ago" : new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); };
  const fullTime = t => new Date(t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  function stats() {
    const dv = DATA.division, from = periodStart(PERIOD), qFrom = periodStart(dv.quotaPer === "month" ? "month" : "week");
    const inP = DATA.reports.filter(r => r.at >= from);
    const O = DATA.officers.map((o, idx) => {
      const filedAll = DATA.reports.filter(r => r.author && r.author.key === o.key), assistAll = DATA.reports.filter(r => r.tagged.some(t => t.key === o.key));
      const filed = filedAll.filter(r => r.at >= from), assists = assistAll.filter(r => r.at >= from);
      const last = Math.max(0, ...filedAll.map(r => r.at), ...assistAll.map(r => r.at));
      const days = last ? Math.floor((Date.now() - last) / DAY) : null;
      let status = "ok";
      if (days == null) status = dv.inactiveDays || dv.warnDays ? "never" : "quiet";
      else if (dv.inactiveDays && days >= dv.inactiveDays) status = "bad";
      else if (dv.warnDays && days >= dv.warnDays) status = "warn";
      if (o.exempt) status = "exempt";          // Command / High Command etc.: no report requirement, activity still shown
      const qCount = filedAll.filter(r => r.at >= qFrom).length + (dv.quotaAssists ? assistAll.filter(r => r.at >= qFrom).length : 0);
      return Object.assign({}, o, { idx, filedAll, assistAll, filed, assists, last, days, status, score: filed.length + assists.length * 0.5, grade: avgGrade(filed), gradeAll: avgGrade(filedAll),
        quota: dv.quota && !o.exempt ? { n: qCount, need: dv.quota, met: qCount >= dv.quota } : null, qn: qCount });
    });
    const active = O.filter(o => o.filed.length || o.assists.length).length;
    const assists = inP.reduce((n, r) => n + r.tagged.filter(t => t.key).length, 0);
    return { O, inP, from, active, assists, grade: avgGrade(inP), ungraded: inP.filter(r => !r.grade).length, behind: O.filter(o => o.quota && !o.quota.met).length };
  }

  // ---------------- drawing ----------------
  function drawEmpty() {
    $("boot").hidden = true; $("app").hidden = false;
    $("divs").innerHTML = ""; $("kpis").innerHTML = ""; $("hero").innerHTML = ""; $("me").textContent = ME ? ME.username : "";
    $("view").innerHTML = `<div class="dc-empty big"><b>No divisions set up yet.</b><span>${ME && ME.role !== "leader" ? 'Open <a href="admin.html">Admin → Division Command</a> to add a division, pick its roster tab and the reports that count.' : "Ask a portal admin to set up your division in Admin → Division Command."}</span></div>`;
  }
  function drawAll() {
    const dv = DATA.division, S = stats();
    $("topDiv").textContent = dv.name.toUpperCase();
    $("me").innerHTML = `<i class="r-${esc(ME.role)}">${esc(ME.role === "leader" ? "LEADER" : ME.role.toUpperCase())}</i>${esc(ME.username)}`;
    $("adminLink").hidden = ME.role === "leader";
    $("divs").innerHTML = (DATA.divisions || []).length > 1 ? DATA.divisions.map(d => `<button data-div="${esc(d.id)}" class="${d.id === dv.id ? "on" : ""}" style="--c:${esc(d.color)}"><i></i>${esc(d.name)}</button>`).join("") : "";
    document.querySelectorAll("#period [data-p]").forEach(b => b.classList.toggle("on", b.dataset.p === PERIOD));
    document.querySelectorAll("#tabs [data-t]").forEach(b => b.classList.toggle("on", b.dataset.t === TAB));
    drawHero(dv, S); drawKpis(S);
    ({ overview: viewOverview, officers: viewOfficers, board: viewBoard, reports: viewReports })[TAB](S);
  }
  function drawHero(dv, S) {
    $("hero").innerHTML = `<div class="dc-radar"><i></i><img src="${esc(dv.logoUrl || "img/lspd-seal.png")}" alt="" onerror="this.onerror=null;this.src='img/lspd-seal.png'"></div>
      <div class="dc-htxt"><div class="dc-kick">DIVISION</div><h1>${esc(dv.name)}</h1>${dv.tagline ? `<p>${esc(dv.tagline)}</p>` : ""}
        <div class="dc-hmeta"><span><b>${DATA.officers.length}</b> officers on roster</span><span><b>${DATA.forms.length}</b> report type${DATA.forms.length === 1 ? "" : "s"} tracked</span>${dv.quota ? `<span>Quota <b>${dv.quota}</b> / ${dv.quotaPer}${dv.quotaAssists ? " (assists count)" : ""}</span>` : ""}${dv.inactiveDays ? `<span>Inactive after <b>${dv.inactiveDays}</b> days</span>` : ""}</div>
        ${DATA.rosterError ? `<div class="dc-warnline">⚠ ${esc(DATA.rosterError)}</div>` : ""}</div>
      <div class="dc-hring">${ring(DATA.officers.length ? S.active / DATA.officers.length : 0, S.active + "/" + DATA.officers.length, "ACTIVE")}</div>`;
  }
  function ring(f, big, small) {
    const r = 44, c = 2 * Math.PI * r;
    return `<svg viewBox="0 0 110 110" class="dc-ring"><circle cx="55" cy="55" r="${r}" class="bg"/><circle cx="55" cy="55" r="${r}" class="fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, f))}"/></svg><div class="dc-ringt"><b>${esc(big)}</b><small>${esc(small)}</small></div>`;
  }
  const PNAME = { week: "this week", month: "this month", 30: "last 30 days", all: "all time" };
  function drawKpis(S) {
    const K = [
      ["Reports filed", S.inP.length, PNAME[PERIOD], "📝"],
      ["Assists credited", S.assists, "officers tagged in reports", "🤝"],
      ["Active officers", S.active + "/" + DATA.officers.length, "filed or assisted " + PNAME[PERIOD], "🟢"],
      ["Average grade", S.grade ? S.grade.letter : "—", S.grade ? S.grade.n + " graded" : "nothing graded yet", "🏅"],
      ["Awaiting grade", S.ungraded, "in this period", "⚖️", S.ungraded ? "hot" : ""],
      DATA.division.quota ? ["Behind quota", S.behind, "this " + DATA.division.quotaPer + " (" + DATA.division.quota + " needed)", "🎯", S.behind ? "hot" : ""] : ["Needs attention", S.O.filter(o => o.status === "bad" || o.status === "never").length, "inactive officers", "🚨"]
    ];
    $("kpis").innerHTML = K.map(([l, v, sub, ic, cls]) => `<div class="dc-kpi ${cls || ""}"><span class="ic">${ic}</span><small>${esc(l)}</small><b data-count="${typeof v === "number" ? v : ""}">${esc(v)}</b><em>${esc(sub)}</em></div>`).join("");
    $("kpis").querySelectorAll("[data-count]").forEach(b => { const n = Number(b.dataset.count); if (!b.dataset.count || !n) return; let i = 0; const st = setInterval(() => { i++; b.textContent = Math.round(n * Math.min(1, i / 16)); if (i >= 16) clearInterval(st); }, 28); });
  }

  // report card
  const GCLS = g => "g-" + String(g || "").toLowerCase();
  function personChip(p, kind) {
    const on = !!p.key;
    return `<button type="button" class="pc ${kind}${on ? "" : " off"}" ${on ? `data-off="${esc(p.key)}"` : ""} title="${esc(p.role)}${on ? "" : " · not on the division roster"}"><i>${esc(initials(p.name))}</i><span><small>${kind === "author" ? "FILED BY" : /assist/i.test(p.role) ? "ASSIST" : "ASSIST · " + esc(p.role).toUpperCase()}</small>${esc(p.callsign ? p.callsign + " · " : "")}${esc(p.name)}</span></button>`;
  }
  function reportCard(r, opts) {
    opts = opts || {};
    return `<article class="rc${r._new ? " new" : ""}${r.grade ? "" : " ungr"}" data-rid="${esc(r.id)}">
      <div class="rc-ic">${esc(r.icon)}</div>
      <div class="rc-main">
        <div class="rc-t"><b>${esc(r.title || r.formTitle)}</b>${r.no && !String(r.title || "").includes(r.no) ? `<code>${esc(r.no)}</code>` : ""}${r._new ? '<em class="nw">NEW</em>' : ""}${r.imported ? '<em class="imp">IMPORTED</em>' : ""}</div>
        <div class="rc-m">${esc(r.formTitle)} · <span title="${esc(fullTime(r.at))}">${esc(ago(r.at))}</span></div>
        <div class="rc-p">${r.author ? personChip(r.author, "author") : '<span class="pc none">No officer recorded</span>'}${r.tagged.map(t => personChip(t, "assist")).join("")}</div>
        ${opts.open ? `<pre class="rc-sum">${esc(r.summary || "No details recorded.")}</pre>` : ""}
        ${r.grade && r.comments ? `<div class="rc-cm">“${esc(r.comments)}” <span>— ${esc(r.gradedBy)}</span></div>` : ""}
      </div>
      <div class="rc-g">${r.grade ? `<button type="button" class="gb ${GCLS(r.grade)}" data-grade="${esc(r.id)}" title="Graded by ${esc(r.gradedBy)}${r.gradedAt ? " · " + esc(fullTime(r.gradedAt)) : ""}">${esc(r.grade)}</button><small>${esc(r.gradedBy)}</small>` : `<button type="button" class="dc-btn ac sm" data-grade="${esc(r.id)}">⚖ Grade</button>`}
        <button type="button" class="rc-more" data-more="${esc(r.id)}">${opts.open ? "Hide details" : "Details"}</button></div>
    </article>`;
  }
  const OPEN = new Set();
  const cards = list => list.map(r => reportCard(r, { open: OPEN.has(r.id) })).join("");

  function statusPill(o) {
    const L = { ok: "Active", warn: "Slowing down", bad: "Inactive", never: "No activity yet", quiet: "No activity yet" };
    if (o.status === "exempt") return `<span class="st st-exempt" title="No report requirement (${esc(o.exempt)})"><i></i>${esc(titleCase(o.exempt))} · no quota${o.days != null ? ` · last ${o.days === 0 ? "today" : o.days + "d"}` : ""}</span>`;
    return `<span class="st st-${o.status}"><i></i>${L[o.status]}${o.days != null ? ` · ${o.days === 0 ? "today" : o.days + "d"}` : ""}</span>`;
  }
  const titleCase = t => String(t || "").toLowerCase().replace(/(^|[\s\-/])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  function quotaBar(o) {
    if (o.exempt && DATA.division.quota) return `<div class="qb ex"><span>Exempt · ${o.qn} this ${esc(DATA.division.quotaPer)}</span></div>`;
    if (!o.quota) return "";
    const f = Math.min(1, o.quota.n / o.quota.need);
    return `<div class="qb${o.quota.met ? " met" : ""}"><div><i style="width:${f * 100}%"></i></div><span>${o.quota.n}/${o.quota.need}</span></div>`;
  }

  function viewOverview(S) {
    const feed = S.inP.slice(0, 20);
    const att = S.O.filter(o => o.status === "bad" || o.status === "never" || o.status === "warn").sort((a, b) => (b.days == null ? 1e9 : b.days) - (a.days == null ? 1e9 : a.days)).slice(0, 8);
    const top = S.O.filter(o => o.score).sort((a, b) => b.score - a.score || b.filed.length - a.filed.length).slice(0, 5);
    const q = DATA.division.quota ? S.O.filter(o => o.quota).sort((a, b) => (a.quota.n / a.quota.need) - (b.quota.n / b.quota.need)).slice(0, 8) : [];
    $("view").innerHTML = `<div class="dc-ov">
      <section class="dc-panel"><header><h2><i class="pulse"></i>Live activity</h2><button class="dc-link" data-tab="reports">All reports →</button></header>
        <div class="feed">${feed.length ? cards(feed) : `<div class="dc-empty">No reports ${esc(PNAME[PERIOD])} yet.</div>`}</div></section>
      <div class="dc-side">
        <section class="dc-panel alert"><header><h2>🚨 Needs attention</h2><button class="dc-link" data-tab="officers">Officers →</button></header>
          ${att.length ? att.map(o => `<button type="button" class="arow" data-off="${esc(o.key)}"><i class="av s-${o.status}">${esc(initials(o.name))}</i><span><b>${esc(o.callsign ? o.callsign + " · " : "")}${esc(o.name)}</b>${statusPill(o)}</span><em>${o.days == null ? "never" : o.days + "d"}</em></button>`).join("") : '<div class="dc-empty sm">Everyone is active. 👏</div>'}</section>
        ${q.length ? `<section class="dc-panel"><header><h2>🎯 Quota · this ${esc(DATA.division.quotaPer)}</h2></header>${q.map(o => `<button type="button" class="qrow" data-off="${esc(o.key)}"><span>${esc(o.callsign ? o.callsign + " · " : "")}${esc(o.name)}</span>${quotaBar(o)}</button>`).join("")}</section>` : ""}
        <section class="dc-panel"><header><h2>🏆 Top performers</h2><button class="dc-link" data-tab="board">Leaderboard →</button></header>
          ${top.length ? top.map((o, i) => `<button type="button" class="trow" data-off="${esc(o.key)}"><em class="rk r${i + 1}">${i + 1}</em><span><b>${esc(o.name)}</b><small>${o.filed.length} filed · ${o.assists.length} assist${o.assists.length === 1 ? "" : "s"}</small></span><b class="pts">${fmtPts(o.score)}</b></button>`).join("") : `<div class="dc-empty sm">No activity ${esc(PNAME[PERIOD])}.</div>`}</section>
      </div></div>`;
  }
  const fmtPts = n => (Math.round(n * 10) / 10).toString();

  function viewOfficers(S) {
    const rank = { never: 0, bad: 1, warn: 2, quiet: 3, ok: 4, exempt: 5 };
    let list = S.O.filter(o => !OFF_Q || (o.name + " " + o.callsign + " " + o.rank + " " + o.section).toLowerCase().includes(OFF_Q.toLowerCase()));
    list.sort(OFF_SORT === "roster" ? (a, b) => a.idx - b.idx : OFF_SORT === "name" ? (a, b) => (a.callsign || a.name).localeCompare(b.callsign || b.name, undefined, { numeric: true }) : OFF_SORT === "activity" ? (a, b) => b.score - a.score : (a, b) => rank[a.status] - rank[b.status] || (b.days || 0) - (a.days || 0));
    const card = o => `<button type="button" class="oc s-${o.status}" data-off="${esc(o.key)}">
        <div class="oc-h"><i class="av s-${o.status}">${esc(initials(o.name))}</i><span><b>${esc(o.name)}</b><small>${o.rank ? esc(o.rank === o.rank.toUpperCase() ? titleCase(o.rank) : o.rank) : "&nbsp;"}</small></span><em class="cs${o.callsign ? "" : " none"}" title="Unit callsign">${esc(o.callsign || "NO CALLSIGN")}</em>${o.grade ? `<em class="gb sm ${GCLS(o.grade.letter)}">${o.grade.letter}</em>` : ""}</div>
        ${statusPill(o)}
        <div class="oc-n"><span><b>${o.filed.length}</b>filed</span><span><b>${o.assists.length}</b>assists</span><span><b>${fmtPts(o.score)}</b>points</span></div>
        ${quotaBar(o)}</button>`;
    // roster order: same order and section headings as the roster sheet
    let body = "";
    // grouped by the roster's section headings, or by position/rank when the roster has no headings;
    // groups appear in the order they first show up on the roster
    // position/rank column first (K9, CRU…); the roster's section headings only when there's no position column (ASU)
    const gb = DATA.division.groupBy || "auto";
    const useRank = gb === "position" || (gb === "auto" && S.O.filter(o => o.rank).length >= S.O.length / 2), useSec = !useRank && gb !== "none" && S.O.some(o => o.section);
    const grp = o => (useRank ? o.rank.split(" · ")[0] : o.section) || "Other";
    if (OFF_SORT === "roster" && (useRank || useSec)) {
      const groups = [], at = {};
      list.forEach(o => { const k = grp(o); if (!at[k]) { at[k] = { name: k, list: [] }; groups.push(at[k]); } at[k].list.push(o); });
      body = groups.map(g => `${g.name ? `<div class="og-h"><span>${esc(g.name)}</span><i></i><small>${g.list.length}</small></div>` : ""}<div class="ogrid">${g.list.map(card).join("")}</div>`).join("");
    } else body = `<div class="ogrid">${list.map(card).join("")}</div>`;
    $("view").innerHTML = `<div class="dc-tools"><input type="search" id="offQ" placeholder="Search officers…" value="${esc(OFF_Q)}"><div class="dc-seg sm" id="offSort">${[["roster", "Roster order"], ["status", "Needs attention first"], ["activity", "Most active"], ["name", "Callsign"]].map(([k, l]) => `<button data-s="${k}" class="${OFF_SORT === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
      ${list.length ? body : '<div class="dc-empty">No officers found on the division roster.</div>'}`;
    const q = $("offQ"); q.oninput = () => { OFF_Q = q.value; const pos = q.selectionStart; viewOfficers(S); const n = $("offQ"); n.focus(); n.setSelectionRange(pos, pos); };
    $("offSort").onclick = e => { const b = e.target.closest("[data-s]"); if (b) { OFF_SORT = b.dataset.s; viewOfficers(S); } };
  }

  function viewBoard(S) {
    const list = S.O.slice().sort((a, b) => b.score - a.score || b.filed.length - a.filed.length || (b.grade ? b.grade.value : -1) - (a.grade ? a.grade.value : -1));
    const pod = list.slice(0, 3).filter(o => o.score);
    $("view").innerHTML = `<section class="dc-panel"><header><h2>🏆 Leaderboard · ${esc(PNAME[PERIOD])}</h2><small class="dc-note">Points: 1 per report filed, ½ per assist (tagged in someone's report)</small></header>
      ${pod.length ? `<div class="podium">${[1, 0, 2].map(i => pod[i] ? `<button type="button" class="pod p${i + 1}" data-off="${esc(pod[i].key)}"><i class="av">${esc(initials(pod[i].name))}</i><b>${esc(pod[i].name)}</b><small>${esc(pod[i].callsign)}</small><div class="pstep"><em>${i + 1}</em><span>${fmtPts(pod[i].score)} pts</span></div></button>` : "").join("")}</div>` : ""}
      <div class="ltable"><div class="lh"><span>#</span><span>Officer</span><span>Filed</span><span>Assists</span><span>Avg grade</span><span>Points</span></div>
        ${list.map((o, i) => `<button type="button" class="lr${o.score ? "" : " zero"}" data-off="${esc(o.key)}"><span class="rk r${i + 1}">${i + 1}</span><span class="lo"><i class="av s-${o.status}">${esc(initials(o.name))}</i><b>${esc(o.name)}</b><small>${esc(o.callsign)}</small></span><span>${o.filed.length}</span><span class="as">${o.assists.length}</span><span>${o.grade ? `<em class="gb sm ${GCLS(o.grade.letter)}">${o.grade.letter}</em>` : "—"}</span><span class="pts">${fmtPts(o.score)}</span></button>`).join("")}</div></section>`;
  }

  function viewReports(S) {
    let list = S.inP;
    if (REP_F.state === "ungraded") list = list.filter(r => !r.grade); else if (REP_F.state === "graded") list = list.filter(r => r.grade);
    if (REP_F.form) list = list.filter(r => r.form === REP_F.form);
    if (REP_F.q) { const q = REP_F.q.toLowerCase(); list = list.filter(r => [r.title, r.no, r.formTitle, r.summary, r.author && r.author.name, r.author && r.author.callsign].concat(r.tagged.map(t => t.name + " " + t.callsign)).join(" ").toLowerCase().includes(q)); }
    $("view").innerHTML = `<div class="dc-tools"><input type="search" id="repQ" placeholder="Search reports, officers, report #…" value="${esc(REP_F.q)}">
      <div class="dc-seg sm" id="repState">${[["all", "All"], ["ungraded", "Needs grade"], ["graded", "Graded"]].map(([k, l]) => `<button data-s="${k}" class="${REP_F.state === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <select id="repForm"><option value="">All report types</option>${DATA.forms.map(f => `<option value="${esc(f.id)}"${REP_F.form === f.id ? " selected" : ""}>${esc(f.icon + " " + f.title)}</option>`).join("")}</select></div>
      <div class="dc-count">${list.length} report${list.length === 1 ? "" : "s"} · ${esc(PNAME[PERIOD])}</div>
      <div class="feed">${list.length ? cards(list.slice(0, REP_N)) : '<div class="dc-empty">No reports match.</div>'}</div>
      ${list.length > REP_N ? `<div class="dc-more"><button class="dc-btn" id="repMore">Show more (${list.length - REP_N} left)</button></div>` : ""}`;
    const q = $("repQ"); q.oninput = () => { clearTimeout(q.t); q.t = setTimeout(() => { REP_F.q = q.value; REP_N = 40; viewReports(S); const n = $("repQ"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); };
    $("repState").onclick = e => { const b = e.target.closest("[data-s]"); if (b) { REP_F.state = b.dataset.s; REP_N = 40; viewReports(S); } };
    $("repForm").onchange = e => { REP_F.form = e.target.value; REP_N = 40; viewReports(S); };
    const m = $("repMore"); if (m) m.onclick = () => { REP_N += 40; viewReports(S); };
  }

  // ---------------- officer profile ----------------
  function openOfficer(key) {
    const S = stats(), o = S.O.find(x => x.key === key); if (!o) return;
    const items = o.filedAll.map(r => ({ r, kind: "filed" })).concat(o.assistAll.map(r => ({ r, kind: "assist" }))).sort((a, b) => b.r.at - a.r.at);
    // last 8 weeks
    const ws = periodStart("week"), weeks = [];
    for (let i = 7; i >= 0; i--) { const a = ws - i * 7 * DAY, b = a + 7 * DAY; weeks.push({ a, f: o.filedAll.filter(r => r.at >= a && r.at < b).length, s: o.assistAll.filter(r => r.at >= a && r.at < b).length }); }
    const mx = Math.max(1, ...weeks.map(w => w.f + w.s));
    const chart = `<svg viewBox="0 0 320 120" class="wchart"><defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(var(--acr),.12)"/><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(var(--acr),.7)" stroke-width="2"/></pattern></defs>
      ${weeks.map((w, i) => { const x = 8 + i * 39, hf = w.f / mx * 84, hs = w.s / mx * 84; return `<rect x="${x}" y="${96 - hf}" width="26" height="${hf}" rx="3" class="bf"><title>${w.f} filed</title></rect><rect x="${x}" y="${96 - hf - hs}" width="26" height="${hs}" rx="3" fill="url(#hatch)"><title>${w.s} assists</title></rect><text x="${x + 13}" y="112" text-anchor="middle">${new Date(w.a).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}</text>${w.f + w.s ? `<text x="${x + 13}" y="${90 - hf - hs}" text-anchor="middle" class="v">${w.f + w.s}</text>` : ""}`; }).join("")}</svg>`;
    $("dpanel").innerHTML = `<button class="dc-x" data-close aria-label="Close">✕</button>
      <div class="pf-h"><i class="av xl s-${o.status}">${esc(initials(o.name))}</i><div><div class="dc-kick">${esc(o.callsign || "OFFICER")}</div><h2>${esc(o.name)}</h2>${statusPill(o)}</div></div>
      <div class="pf-k"><div><small>Filed · ${esc(PNAME[PERIOD])}</small><b>${o.filed.length}</b></div><div><small>Assists · ${esc(PNAME[PERIOD])}</small><b>${o.assists.length}</b></div><div><small>Avg grade (all)</small><b>${o.gradeAll ? `<em class="gb ${GCLS(o.gradeAll.letter)}">${o.gradeAll.letter}</em>` : "—"}</b></div><div><small>Last active</small><b class="sm">${o.last ? esc(ago(o.last)) : "never"}</b></div></div>
      ${o.quota ? `<div class="pf-q"><small>Quota this ${esc(DATA.division.quotaPer)}</small>${quotaBar(o)}</div>` : ""}
      <h3>Last 8 weeks <span class="lg"><i class="lf"></i>filed <i class="ls"></i>assists</span></h3>${chart}
      <h3>Record <small>${o.filedAll.length} filed · ${o.assistAll.length} assists</small></h3>
      <div class="tl">${items.length ? items.slice(0, 120).map(({ r, kind }) => `<div class="ti ${kind}"><div class="ti-dot"></div><div class="ti-b">
          <div class="ti-t">${kind === "filed" ? "📝 <b>Filed</b>" : "🤝 <b>Assisted</b>"} · ${esc(r.title || r.formTitle)}${r.no && !String(r.title || "").includes(r.no) ? ` <code>${esc(r.no)}</code>` : ""}</div>
          <div class="ti-m">${esc(r.formTitle)} · ${esc(fullTime(r.at))}${kind === "assist" ? ` · tagged by ${esc(r.author ? r.author.name : "—")} as ${esc((r.tagged.find(t => t.key === o.key) || {}).role || "assist")}` : ""}</div></div>
          ${kind === "filed" ? (r.grade ? `<button class="gb sm ${GCLS(r.grade)}" data-grade="${esc(r.id)}">${esc(r.grade)}</button>` : `<button class="dc-btn ac xs" data-grade="${esc(r.id)}">Grade</button>`) : '<span class="ti-as">ASSIST</span>'}</div>`).join("") : '<div class="dc-empty sm">No reports or assists yet.</div>'}</div>`;
    $("drawer").hidden = false; requestAnimationFrame(() => $("drawer").classList.add("open"));
  }
  function closeDrawer() { $("drawer").classList.remove("open"); setTimeout(() => $("drawer").hidden = true, 250); }

  // ---------------- grading ----------------
  function openGrade(id) {
    const r = DATA.reports.find(x => x.id === id); if (!r) return;
    let pick = r.grade || "";
    const by = (() => { try { return localStorage.getItem("dc:gradedBy") || ""; } catch (e) { return ""; } })() || ME.username;
    $("mcard").innerHTML = `<button class="dc-x" data-mclose aria-label="Close">✕</button>
      <div class="dc-kick">GRADE REPORT</div><h2>${esc(r.title || r.formTitle)}</h2>
      <div class="gm-m">${esc(r.formTitle)}${r.no ? " · " + esc(r.no) : ""} · ${esc(fullTime(r.at))}</div>
      <div class="rc-p">${r.author ? personChip(r.author, "author") : ""}${r.tagged.map(t => personChip(t, "assist")).join("")}</div>
      <details class="gm-sum"><summary>Report details</summary><pre>${esc(r.summary || "No details recorded.")}</pre></details>
      <div class="gm-letters">${["A", "B", "C", "D", "F"].map(g => `<button type="button" data-g="${g}" class="${GCLS(g)}${pick === g ? " on" : ""}"><b>${g}</b><small>${{ A: "Excellent", B: "Good", C: "Acceptable", D: "Needs work", F: "Unacceptable" }[g]}</small></button>`).join("")}</div>
      <label class="gm-f"><span>Comments for the officer</span><textarea id="gmCm" maxlength="1500" placeholder="What was done well, what to fix next time…">${esc(r.comments || "")}</textarea></label>
      <label class="gm-f"><span>Graded by</span><input id="gmBy" maxlength="60" value="${esc(r.gradedBy || by)}"></label>
      <label class="gm-c${r.canPost ? "" : " dis"}"><input type="checkbox" id="gmPost" ${r.canPost ? "checked" : "disabled"}> Post to Discord: grade line on the report + a reply tagging ${esc(r.author ? r.author.name : "the officer")}${r.canPost ? "" : " <small>(this report's Discord post wasn't recorded" + (r.imported ? ": imported from the sheet" : "") + ")</small>"}</label>
      ${r.tagged.length ? `<label class="gm-c${r.canPost ? "" : " dis"}"><input type="checkbox" id="gmPing" ${DATA.division.pingTagged ? "checked" : ""} ${r.canPost ? "" : "disabled"}> Also tag the ${r.tagged.length} assisting officer${r.tagged.length === 1 ? "" : "s"}</label>` : ""}
      <div class="gm-b">${r.grade ? '<button type="button" class="dc-btn danger" id="gmClear">Remove grade</button>' : ""}<span></span><button type="button" class="dc-btn" data-mclose>Cancel</button><button type="button" class="dc-btn ac" id="gmSave">Save grade</button></div>`;
    $("modal").hidden = false;
    const card = $("mcard");
    card.querySelector(".gm-letters").onclick = e => { const b = e.target.closest("[data-g]"); if (!b) return; pick = b.dataset.g; card.querySelectorAll("[data-g]").forEach(x => x.classList.toggle("on", x === b)); };
    card.querySelectorAll("[data-mclose]").forEach(b => b.onclick = closeModal);
    const send = async clear => {
      if (!clear && !pick) { toast("Pick a grade first.", "bad"); return; }
      const btn = clear ? $("gmClear") : $("gmSave"), lab = btn.textContent; btn.disabled = true; btn.textContent = clear ? "Removing…" : "Saving…";
      const gby = $("gmBy").value.trim(); store("dc:gradedBy", gby);
      const posted = !clear && !!($("gmPost") && $("gmPost").checked);
      try {
        const res = await api("divGrade", { id: r.id, division: DATA.division.id, grade: pick, comments: $("gmCm").value.trim(), gradedBy: gby, clear: !!clear, post: posted, pingTagged: !!($("gmPing") && $("gmPing").checked) });
        Object.assign(r, clear ? { grade: "", gradedBy: "", comments: "", gradedAt: 0 } : { grade: pick, gradedBy: gby || ME.username, comments: $("gmCm").value.trim(), gradedAt: Date.now() });
        keep(DATA.division.id, DATA); closeModal(); drawAll(); if (!$("drawer").hidden) { const k = $("dpanel").dataset.key; if (k) openOfficer(k); }
        toast(res.warning ? "Grade saved (" + res.warning + ")" : clear ? "Grade removed" : "Grade " + pick + " saved" + (posted ? " and posted to Discord" : ""), res.warning ? "bad" : "ok");
      } catch (e) { toast(e.message, "bad"); btn.disabled = false; btn.textContent = lab; }
    };
    $("gmSave").onclick = () => send(false);
    if ($("gmClear")) $("gmClear").onclick = () => { if (confirm("Remove this grade? (Anything already posted in Discord stays.)")) send(true); };
  }
  function closeModal() { $("modal").hidden = true; $("mcard").innerHTML = ""; }
  $("modal").addEventListener("mousedown", e => { if (e.target === $("modal")) closeModal(); });

  // ---------------- clicks ----------------
  document.addEventListener("click", e => {
    const t = e.target;
    const dvb = t.closest("[data-div]"); if (dvb) { switchDiv(dvb.dataset.div); return; }
    const pb = t.closest("#period [data-p]"); if (pb) { PERIOD = pb.dataset.p; store("dc:period", PERIOD); drawAll(); return; }
    const tb = t.closest("[data-tab],[data-t]"); if (tb && !t.closest("#dpanel")) { TAB = tb.dataset.tab || tb.dataset.t; drawAll(); window.scrollTo({ top: $("kpis").offsetTop - 120, behavior: "smooth" }); return; }
    const g = t.closest("[data-grade]"); if (g) { e.stopPropagation(); openGrade(g.dataset.grade); return; }
    const m = t.closest("[data-more]"); if (m) { const id = m.dataset.more; OPEN.has(id) ? OPEN.delete(id) : OPEN.add(id); const card = m.closest(".rc"), r = DATA.reports.find(x => x.id === id); if (card && r) card.outerHTML = reportCard(r, { open: OPEN.has(id) }); return; }
    const o = t.closest("[data-off]"); if (o) { openOfficer(o.dataset.off); $("dpanel").dataset.key = o.dataset.off; return; }
    if (t.closest("[data-close]")) { closeDrawer(); return; }
  });
  document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if (!$("modal").hidden) closeModal(); else if (!$("drawer").hidden) closeDrawer(); });

  // ---------------- start ----------------
  tick();
  if (TOKEN) load(false); else showLogin();
})();
