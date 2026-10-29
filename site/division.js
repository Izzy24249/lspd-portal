/* Division Command — what each division's leader sees: every report from the division's forms, who filed it,
   who was tagged (assists), quotas, inactivity, leaderboard, officer profiles, and grading posted to Discord. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), esc = s => Portal.esc(s);
  const TK = "lspd_admin_token";
  let TOKEN = "", ME = null, DATA = null, DIV = "", PERIOD = "week", TAB = "overview", SEEN = null, OFF_Q = "", OFF_SORT = "roster", REP_F = { state: "all", form: "", q: "" }, REP_N = 40, LAST = 0;
  try { TOKEN = localStorage.getItem(TK) || sessionStorage.getItem(TK) || ""; DIV = localStorage.getItem("dc:div") || ""; PERIOD = localStorage.getItem("dc:period") || "week"; } catch (e) {}
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  // Command Center (all divisions + the division race) is the first page every time Division Command opens
  let MODE = "hq", HQ = null, HQ_P = "week", HQ_RANK = "total", HQ_BUSY = false, HQ_AT = 0, HQ_ANIM = true;
  let HQ_NEW = false, HQ_OPEN = new Set(), HQ_GOAL = "", HQ_PENDING = false, HQ_WORK = false, HQ_TAB = "race", HQ_SEEN = 0;
  try { HQ_TAB = localStorage.getItem("dc:hqt") || "race"; HQ_SEEN = Number(localStorage.getItem("dc:hqseen")) || 0; } catch (e) {}
  try { HQ = JSON.parse(localStorage.getItem("dc:hq") || "null"); HQ_P = localStorage.getItem("dc:hqp") || "week"; HQ_RANK = localStorage.getItem("dc:hqr") || "total"; } catch (e) {}

  function toast(m, t) { const x = $("toast"); x.textContent = m; x.className = "toast show " + (t || ""); clearTimeout(toast.t); toast.t = setTimeout(() => x.className = "toast", 4500); }
  // officers come in with their MDT sign-on (Leader level and up); portal admins can still use the admin login
  let SESSION = ""; try { SESSION = localStorage.getItem("lspd_sess") || ""; } catch (e) {}
  // the officer sign-on comes first (it carries your rank and name); the portal admin login is the fallback
  const OFFICER = () => !!SESSION;
  async function api(action, data) {
    const r = await Portal.post(Object.assign({ action: action }, OFFICER() ? { session: SESSION } : { token: TOKEN }, data || {}));
    if (!r.ok && r.error === "AUTH" && OFFICER() && TOKEN) { SESSION = ""; return api(action, data); }   // MDT sign-on expired: use the admin login instead
    if (!r.ok && r.error === "AUTH") {
      if (OFFICER()) { location.replace("signon.html?next=division.html"); throw new Error("Sign on again."); }
      signOut(true); throw new Error(r.message || "Please sign in again."); }
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
      loadHQ(); await load(false);
    } catch (x) { $("lgErr").textContent = x.message; }
    finally { $("lgBtn").disabled = false; $("lgBtn").textContent = "Enter command"; }
  };
  function signOut(expired) {
    if (!expired && TOKEN) Portal.post({ action: "logout", token: TOKEN }).catch(() => {});
    TOKEN = ""; DATA = null; SEEN = null; Object.keys(MEM).forEach(k => delete MEM[k]);
    try { localStorage.removeItem(TK); sessionStorage.removeItem(TK); Object.keys(localStorage).filter(k => k.indexOf("dc:data:") === 0).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    showLogin();
  }
  $("outBtn").onclick = () => { if (OFFICER()) location.href = "mdt.html"; else signOut(false); };

  // ---------------- data ----------------
  // Each division's last data is kept (in memory and in this browser), so switching shows it instantly;
  // Google is asked for anything new in the background, and the other divisions are loaded ahead of time.
  const MEM = {}, BUSY = {}, LSK = id => "dc:data:" + id;
  const keep = (id, data) => { MEM[id] = { data: data, at: Date.now(), seen: new Set(data.reports.map(x => x.id)) };
    try { localStorage.setItem(LSK(id), JSON.stringify({ at: Date.now(), data: data }, (k, v) => k === "_new" ? undefined : v)); } catch (e) {} };
  const saved = id => { if (MEM[id]) return MEM[id]; try { const j = JSON.parse(localStorage.getItem(LSK(id)) || "null"); if (j && j.data && j.data.division) { MEM[id] = { data: j.data, at: j.at, seen: new Set(j.data.reports.map(x => x.id)), old: true }; return MEM[id]; } } catch (e) {} return null; };
  function setLive(t) { $("live").classList.toggle("upd", !!t); if (t) $("liveTxt").textContent = t; else tick(); }
  async function loadHQ() {
    if (HQ_BUSY) return; HQ_BUSY = true;
    try { const r = await api("divOverview"); ME = r.me || ME; HQ = r; HQ_AT = Date.now(); store("dc:hq", JSON.stringify(r)); LAST = Date.now();
      if (MODE === "hq") { $("boot").hidden = true; $("login").hidden = true; $("app").hidden = false; drawAll(); } }
    catch (e) { if (MODE === "hq" && !HQ) $("hq").innerHTML = '<div class="dc-empty">' + esc(e.message) + "</div>"; }
    finally { HQ_BUSY = false; }
  }
  function show(data) {
    DATA = data; ME = data.me || ME; DIV = data.division.id; store("dc:div", DIV);
    if (MODE === "hq" && !HQ) return;                 // the Command Center is on its way: keep the boot screen until it lands
    $("boot").hidden = true; $("login").hidden = true; $("app").hidden = false;
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
      if (!TOKEN && !SESSION) return;
      if (!DATA) { $("boot").querySelector("span").textContent = e.message; setTimeout(() => { if (!DATA && (TOKEN || SESSION)) load(fresh); }, 6000); }
      else if (!quiet) toast(e.message, "bad");
    } finally { setLive(""); }
  }
  // the other divisions, one after another, so they're ready before they're clicked
  let pre = false;
  async function prefetch() {
    if (pre || !DATA || !DATA.divisions) return; pre = true;
    try { for (const d of DATA.divisions) { if (!TOKEN && !SESSION) break; if (d.id === DIV) continue; const m = MEM[d.id]; if (m && !m.old && Date.now() - m.at < 120000) continue; try { await fetchDiv(d.id, false, true); } catch (e) {} } }
    finally { pre = false; }
  }
  function switchDiv(id) {
    if (id === "_hq") { MODE = "hq"; HQ_ANIM = true; drawAll(); window.scrollTo({ top: 0 }); if (Date.now() - HQ_AT > 60000) loadHQ(); return; }
    const wasHq = MODE === "hq"; MODE = "div";
    if (id === DIV) { if (wasHq) { drawAll(); window.scrollTo({ top: 0 }); } return; }
    DIV = id; OPEN.clear(); store("dc:div", DIV);
    const s = saved(id);
    if (s) { LAST = s.at; show(s.data); if (Date.now() - s.at < 60000 && !s.old) return; }   // fresh enough: no wait at all
    else { $("view").innerHTML = '<div class="dc-empty">Loading division…</div>'; }
    load(false, true);
  }
  setInterval(() => { if (DATA && (TOKEN || SESSION) && !document.hidden && $("modal").hidden) load(false, true); }, 60000);
  setInterval(() => { if (DATA && (TOKEN || SESSION) && !document.hidden) prefetch(); }, 300000);
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
    const inHq = MODE === "hq";
    ["hero", "kpis", "view"].forEach(id => $(id).hidden = inHq); document.querySelector(".dc-bar").hidden = inHq; $("hq").hidden = !inHq;
    if (inHq || !DATA || !DATA.division) {
      const list = (HQ && HQ.divisions) || (DATA && DATA.divisions) || [];
      $("topDiv").textContent = "COMMAND CENTER";
      if (ME) { $("me").innerHTML = `<i class="r-${esc(ME.role)}">${esc(ME.role === "leader" ? "LEADER" : String(ME.role).toUpperCase())}</i>${esc(ME.username)}`; $("adminLink").hidden = ME.role === "leader" || (!!ME.officer && ["admin", "owner"].indexOf(ME.role) === -1); }
      $("divs").innerHTML = `<button data-div="_hq" class="hqb${inHq ? " on" : ""}"><i></i>Command Center</button>` + list.map(d => `<button data-div="${esc(d.id)}" class="${!inHq && DATA && DATA.division && d.id === DATA.division.id ? "on" : ""}" style="--c:${esc(d.color)}"><i></i>${esc(d.name)}</button>`).join("");
      document.documentElement.style.setProperty("--ac", "#e8b54a"); document.documentElement.style.setProperty("--acr", "232,181,74");
      if (inHq) { drawHQ(); return; }
    }
    if (!DATA || !DATA.division) return;
    document.documentElement.style.setProperty("--ac", DATA.division.color || "#2f7bff"); document.documentElement.style.setProperty("--acr", hexRgb(DATA.division.color || "#2f7bff"));
    const dv = DATA.division, S = stats();
    $("topDiv").textContent = dv.name.toUpperCase();
    $("me").innerHTML = `<i class="r-${esc(ME.role)}">${esc(ME.role === "leader" ? "LEADER" : ME.role.toUpperCase())}</i>${esc(ME.username)}`;
    $("adminLink").hidden = ME.role === "leader" || (!!ME.officer && ["admin", "owner"].indexOf(ME.role) === -1);
    $("divs").innerHTML = `<button data-div="_hq" class="hqb"><i></i>Command Center</button>` + (DATA.divisions || []).map(d => `<button data-div="${esc(d.id)}" class="${d.id === dv.id ? "on" : ""}" style="--c:${esc(d.color)}"><i></i>${esc(d.name)}</button>`).join("");
    document.querySelectorAll("#period [data-p]").forEach(b => b.classList.toggle("on", b.dataset.p === PERIOD));
    document.querySelectorAll("#tabs [data-t]").forEach(b => b.classList.toggle("on", b.dataset.t === TAB));
    drawHero(dv, S); drawKpis(S);
    ({ overview: viewOverview, officers: viewOfficers, board: viewBoard, reports: viewReports })[TAB](S);
  }
  // ---------------- Command Center ----------------
  const GLET = v => v == null ? "—" : GL[Math.max(0, Math.min(4, Math.round(v)))];
  function hqScore(d) { const c = d[HQ_P] || {}; return HQ_RANK === "per" ? Math.round((c.points || 0) / Math.max(1, d.roster || c.active || 1) * 10) / 10 : (c.points || 0); }
  function emblem(d, cls) { return d.logoUrl ? `<img class="${cls}" src="${esc(d.logoUrl)}" alt="" onerror="this.outerHTML='<span class=&quot;${cls} ini&quot;>${esc(initials(d.name))}</span>'">` : `<span class="${cls} ini">${esc(initials(d.name))}</span>`; }
  const ICON = {
    flag: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8"/></svg>',
    grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M10 17h4"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/></svg>'
  };
  const TAGC = { "Announcement": "#60a5fa", "Need help": "#f87171", "Joint operation": "#fbbf24", "Policy change": "#c084fc", "Shout-out": "#34d399" };
  function goalHTML(d) {
    const g = (HQ.goals || {})[d.id], c = d.week || {}, P = HQ.perms || {}, can = P.goalAll || (P.divisions || []).indexOf(d.id) !== -1;
    if (HQ_GOAL === d.id) return `<form class="hq-goalf" data-goalf="${esc(d.id)}"><label>Reports this week<input type="number" min="0" max="500" name="target" value="${g ? g.target : ""}" placeholder="15"></label><label>Note<input name="note" maxlength="120" value="${esc(g ? g.note : "")}" placeholder="Every report graded"></label><div><button type="button" class="dc-btn" data-goalx>Cancel</button><button class="dc-btn ac">Save goal</button></div></form>`;
    if (!g || !g.target) return can ? `<button class="hq-goalset" data-goal="${esc(d.id)}">🎯 Set this week's goal</button>` : "";
    const pct = Math.min(100, Math.round(c.reports / g.target * 100)), hit = c.reports >= g.target;
    return `<div class="hq-goal${hit ? " hit" : ""}"><div class="hq-gtop"><span>🎯 Weekly goal${g.note ? " · " + esc(g.note) : ""}</span><b>${hit ? "✓ " : ""}${c.reports} / ${g.target}</b></div><div class="hq-gbar"><i style="width:${pct}%"></i></div>${can ? `<button class="hq-gedit" data-goal="${esc(d.id)}">Edit</button>` : ""}</div>`;
  }
  function fameHTML(L) {
    const S = HQ.seasons || [];
    const nm = id => (L.find(x => x.id === id) || {}).name || id, col = id => (L.find(x => x.id === id) || {}).color || "#888";
    return `<section class="hq-fame"><h3>${ICON.trophy} HALL OF FAME</h3>${S.length ? S.map(x => `<div class="hq-fr" style="--c:${esc(col(x.champ))}"><span>${new Date(x.month).toLocaleDateString(undefined, { month: "short", year: "2-digit" }).toUpperCase()}</span><b>${esc(nm(x.champ))}</b><em>${x.points} pts</em></div>`).join("")
      : '<p class="dim">The first monthly champion is crowned when this month ends. The division with the most points wins the title.</p>'}</section>`;
  }
  function boardHTML() {
    const B = HQ.board || [], P = HQ.perms || {}, tags = HQ.tags || Object.keys(TAGC);
    let h = `<section class="hqb"><header><h2><span class="hq-ic">${ICON.pin}</span>LEADER BULLETIN</h2><span class="dim">Only division leaders and command see this board</span><button class="dc-btn ac" data-hqnew>${HQ_NEW ? "Close" : "+ New post"}</button></header>`;
    if (HQ_NEW) h += `<form class="hqb-new" id="hqNew"><div class="hqb-tags">${tags.map((t, i) => `<label style="--t:${TAGC[t] || "#888"}"><input type="radio" name="tag" value="${esc(t)}"${i ? "" : " checked"}><span>${esc(t)}</span></label>`).join("")}</div>
      <input name="title" maxlength="120" placeholder="Title, e.g. Joint warrant service Friday 8pm" required><textarea name="body" maxlength="2000" rows="3" placeholder="Details: who, when, what you need…"></textarea><div class="hqb-acts"><button class="dc-btn ac">Post to all leaders</button></div></form>`;
    h += B.length ? B.map(p => { const open = HQ_OPEN.has(p.id), c = TAGC[p.tag] || "#888";
      return `<article class="hqb-post${p.pinned ? " pinned" : ""}" style="--t:${c}"><div class="hqb-head">${face(p, "hqb-av")}<span class="hqb-tag">${esc(p.tag)}</span>${p.pinned ? '<span class="hqb-pin">📌 Pinned</span>' : ""}<span class="dim">${esc(p.from)} · ${ago(p.at)}</span></div>
        <h4>${esc(p.title)}</h4>${p.body ? `<p>${esc(p.body).replace(/\n/g, "<br>")}</p>` : ""}
        <div class="hqb-foot"><button class="hqb-ack${p.acked ? " on" : ""}" data-hqack="${esc(p.id)}"${p.acked ? " disabled" : ""} title="${esc(p.acks.join(", ") || "Nobody yet")}">✓ ${p.acked ? "Acknowledged" : "Acknowledge"} · ${p.acks.length}</button>
          <button class="hqb-btn" data-hqrep="${esc(p.id)}">💬 ${p.replies.length ? p.replies.length + " repl" + (p.replies.length === 1 ? "y" : "ies") : "Reply"}</button>
          ${P.pin ? `<button class="hqb-btn" data-hqpin="${esc(p.id)}" data-on="${p.pinned ? 0 : 1}">${p.pinned ? "Unpin" : "📌 Pin"}</button>` : ""}${p.mine || P.pin ? `<button class="hqb-btn del" data-hqdel="${esc(p.id)}">Remove</button>` : ""}</div>
        ${open ? `<div class="hqb-replies">${p.replies.map(r => `<div class="hqb-r"><b>${esc(r.n)}</b><span>${esc(r.t)}</span><small>${ago(r.at)}</small></div>`).join("")}<form class="hqb-rf" data-hqrf="${esc(p.id)}"><input name="text" maxlength="600" placeholder="Write a reply…"><button class="dc-btn ac">Send</button></form></div>` : ""}</article>`; }).join("")
      : `<div class="hqb-empty">No posts yet. Share an announcement, ask other divisions for help, or plan a joint operation.</div>`;
    return h + "</section>";
  }
  async function hqDo(action, data, ok) {
    if (HQ_WORK) return; HQ_WORK = true;
    try { const r = await api(action, data); HQ = r; HQ_AT = Date.now(); store("dc:hq", JSON.stringify(r)); if (ok) toast(ok, "ok"); drawHQ(true); }
    catch (e) { toast(e.message, "bad"); }
    finally { HQ_WORK = false; }
  }
  document.addEventListener("focusout", () => setTimeout(() => { if (HQ_PENDING && MODE === "hq" && !hqTyping()) drawHQ(); }, 50));
  document.addEventListener("submit", e => {
    const f = e.target; if (!f.closest || !f.closest("#hq")) return; e.preventDefault();
    const v = n => (f.elements[n] ? String(f.elements[n].value || "") : "").trim();
    if (f.id === "hqNew") { if (!v("title")) return toast("Give the post a title.", "bad"); const tag = (f.querySelector("input[name=tag]:checked") || {}).value; HQ_NEW = false; hqDo("hqPost", { tag: tag, title: v("title"), body: v("body") }, "Posted to every division leader."); }
    else if (f.dataset.hqrf) { if (!v("text")) return; hqDo("hqReply", { id: f.dataset.hqrf, text: v("text") }); }
    else if (f.dataset.goalf) { const div = f.dataset.goalf; HQ_GOAL = ""; hqDo("hqGoal", { division: div, target: v("target"), note: v("note") }, "Goal set for this week."); }
  });
  const hqTyping = () => { const a = document.activeElement; return !!(a && a.closest && a.closest("#hq") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && (a.value || "").trim()); };
  const face = (p, cls) => p && p.avatar ? `<img class="${cls} pic" src="${esc(p.avatar)}" alt="" onerror="this.outerHTML='<span class=&quot;${cls}&quot;>${esc(initials(p.name || p.from || "?"))}</span>'">` : `<span class="${cls}">${esc(initials((p && (p.name || p.from)) || "?"))}</span>`;
  const ord = n => n + (["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
  function hqGreet(race) {
    const mine = ((HQ.perms || {}).divisions || []), who = ME && ME.username ? esc(ME.username) : "Commander";
    const myD = (HQ.perms || {}).pin && mine.length !== 1 ? null : race.find(d => mine.indexOf(d.id) !== -1);   // command staff: the whole department
    if (!myD) { const tot = race.reduce((n, d) => n + (d[HQ_P].reports || 0), 0); return `${who}, the department has filed <b>${tot}</b> report${tot === 1 ? "" : "s"} this ${HQ_P === "week" ? "week" : "month"}. Here's where every division stands.`; }
    const i = race.indexOf(myD), s0 = hqScore(myD);
    if (i === 0) { const nx = race[1], lead = nx ? s0 - hqScore(nx) : 0; return s0 ? `${who}, <b class="dcol" style="--c:${esc(myD.color)}">${esc(myD.name)}</b> is leading${nx && lead ? ` by ${lead} pts over ${esc(nx.name)}` : ""}. Keep the pressure on.` : `${who}, the race is wide open. One report puts ${esc(myD.name)} in front.`; }
    const ah = race[i - 1], gap = hqScore(ah) - s0, need = Math.max(1, Math.ceil((gap + 1) / (HQ_RANK === "per" ? Math.max(1, 10 / Math.max(1, myD.roster || 1)) : 10)));
    return `${who}, <b class="dcol" style="--c:${esc(myD.color)}">${esc(myD.name)}</b> is ${ord(i + 1)}, ${gap ? gap + " pts behind " + esc(ah.name) + ". About " + need + " more report" + (need === 1 ? "" : "s") + " to pass them." : "tied with " + esc(ah.name) + ". One report breaks it."}`;
  }
  // race moments: what changed since this leader last looked, plus streaks and hot divisions
  let HQ_LAST_ORDER = null;
  function hqMoments(race) {
    const out = [], P = HQ_P, key = "dc:hqprev:" + P;
    let prev = null; try { prev = JSON.parse(localStorage.getItem(key) || "null"); } catch (e) {}
    const order = race.map(d => d.id), nm = id => (race.find(d => d.id === id) || {}).name || id;
    if (prev && prev.start === (P === "week" ? HQ.weekStart : HQ.monthStart) && prev.order.length) {
      if (prev.order[0] !== order[0] && hqScore(race[0])) { out.push(`⚡ <b>${esc(race[0].name)}</b> took the lead from ${esc(nm(prev.order[0]))}`); if (HQ_LAST_ORDER && HQ_LAST_ORDER[0] !== order[0]) leadChange(race[0]); }
      order.forEach((id, i) => { const was = prev.order.indexOf(id); if (was > i && i > 0) out.push(`📈 <b>${esc(nm(id))}</b> moved up to ${ord(i + 1)}`); });
    }
    HQ_LAST_ORDER = order;
    try { localStorage.setItem(key, JSON.stringify({ start: P === "week" ? HQ.weekStart : HQ.monthStart, order: order })); } catch (e) {}
    race.forEach(d => { if (d.today >= 3) out.push(`🚨 <b>${esc(d.name)}</b> has ${d.today} reports today`); if (d.streak >= 3) out.push(`🔥 <b>${esc(d.name)}</b>: reports ${d.streak} days in a row`); });
    if (HQ.hot) out.push(`⚡ <b>${esc(nm(HQ.hot))}</b> is the hottest division right now (most points in 24h)`);
    if (HQ.improved) out.push(`📈 Most improved: <b>${esc(nm(HQ.improved.id))}</b> (+${HQ.improved.by} vs last week)`);
    if (HQ.mvp) out.push(`🏆 <b>${esc(HQ.mvp.name)}</b> is MVP of the week with ${HQ.mvp.pts} pts`);
    return out;
  }
  let ACTX = null;
  function chime(up) { try { ACTX = ACTX || new (window.AudioContext || window.webkitAudioContext)(); const t = ACTX.currentTime; [0, .12, .24].forEach((dt, i) => { const o = ACTX.createOscillator(), g = ACTX.createGain(); o.type = "triangle"; o.frequency.value = (up ? [660, 880, 1320] : [520, 660, 780])[i]; g.gain.setValueAtTime(.0001, t + dt); g.gain.exponentialRampToValueAtTime(.12, t + dt + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dt + .35); o.connect(g).connect(ACTX.destination); o.start(t + dt); o.stop(t + dt + .4); }); } catch (e) {} }
  function leadChange(d) { chime(true); toast("⚡ " + d.name + " just took the lead!", "ok"); confetti(d.color); }
  function confetti(color) {
    const c = document.createElement("canvas"); c.className = "hq-confetti"; c.width = innerWidth; c.height = innerHeight; document.body.appendChild(c);
    const x = c.getContext("2d"), cols = [color || "#e8b54a", "#ffd98a", "#ffffff", "#34d399", "#60a5fa"], P = [];
    for (let i = 0; i < 140; i++) P.push({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35, vx: (Math.random() - .5) * 14, vy: -Math.random() * 12 - 4, r: Math.random() * 5 + 3, c: cols[i % cols.length], a: Math.random() * 6 });
    let n = 0; (function f() { x.clearRect(0, 0, c.width, c.height); P.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += .2; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore(); }); if (++n < 140) requestAnimationFrame(f); else c.remove(); })();
  }
  setInterval(() => { document.querySelectorAll("[data-hqend]").forEach(el => { const ms = Number(el.dataset.hqend) - Date.now(); if (ms <= 0) { el.textContent = "Race closed"; return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4), sec = Math.floor(ms % 6e4 / 1000);
    el.innerHTML = (d ? "<b>" + d + "</b>d " : "") + "<b>" + h + "</b>h <b>" + String(m).padStart(2, "0") + "</b>m <b>" + String(sec).padStart(2, "0") + "</b>s"; el.closest(".hq-clock") && el.closest(".hq-clock").classList.toggle("soon", ms < 864e5); }); }, 1000);
  function drawHQ(force) {
    const box = $("hq");
    if (!force && hqTyping()) { HQ_PENDING = true; return; }      // don't wipe a post or reply someone is typing
    HQ_PENDING = false;
    if (!HQ) { box.innerHTML = '<div class="dc-empty">Loading the Command Center…</div>'; loadHQ(); return; }
    const P = HQ_P, prevK = P === "week" ? "lastWeek" : "lastMonth", L = HQ.divisions || [];
    if (!L.length) { box.innerHTML = '<div class="dc-empty big"><b>No divisions set up yet.</b></div>'; return; }
    const race = L.slice().sort((a, b) => hqScore(b) - hqScore(a) || (b[P].reports - a[P].reports));
    const top = hqScore(race[0]) || 1, lead = race[0], second = race[1];
    const sum = k => L.reduce((n, d) => n + (d[P][k] || 0), 0);
    const graded = L.reduce((n, d) => n + (d[P].graded || 0), 0), gAvg = graded ? L.reduce((n, d) => n + (d[P].avg || 0) * (d[P].graded || 0), 0) / graded : null;
    const since = new Date(P === "week" ? HQ.weekStart : HQ.monthStart).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const unit = HQ_RANK === "per" ? "pts / officer" : "pts";
    const gap = second ? hqScore(lead) - hqScore(second) : 0;
    const endTxt = new Date(HQ.weekEnd || 0).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
    const clockH = P === "week" && HQ.weekEnd ? `<div class="hq-clock"><small>RACE CLOSES ${esc(endTxt.toUpperCase())}</small><span data-hqend="${HQ.weekEnd}">…</span></div>` : "";
    const lastMonth = (HQ.seasons || [])[0], champD = lastMonth && L.find(d => d.id === lastMonth.champ), nowD = new Date();
    const champH = champD && nowD.getDate() <= 3 && new Date(lastMonth.month).getMonth() === (nowD.getMonth() + 11) % 12 ? `<section class="hq-champ" style="--c:${esc(champD.color)}"><span>🏆</span><div><small>${new Date(lastMonth.month).toLocaleDateString(undefined, { month: "long" }).toUpperCase()} CHAMPION</small><b>${esc(champD.name)}</b><em>${lastMonth.points} pts · a new season starts now</em></div><span>🏆</span></section>` : "";
    const heroH = champH + `<section class="hq-hero" style="--lc:${esc(hqScore(lead) ? lead.color : "#e8b54a")}"><div class="hq-hero-in"><p class="hq-hi">${hqGreet(race)}</p><div class="hq-kick"><span class="hq-pulse"></span>COMMAND CENTER · ${L.length} DIVISIONS · ${P === "week" && HQ.weekEnd ? "WEEK ENDING " + esc(new Date(HQ.weekEnd).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase()) : (P === "week" ? "WEEK OF " : "MONTH OF ") + esc(since.toUpperCase())}</div>
      <h1>${!hqScore(lead) ? "The race is on." : second && !gap ? "It's a dead heat." : `<b class="dcol" style="--c:${esc(lead.color)}">${esc(lead.name)}</b> leads the race.`}</h1>
      <p>${hqScore(lead) ? (second ? (gap ? `${gap} ${unit} ahead of ${esc(second.name)}.` : `${esc(lead.name)} and ${esc(second.name)} are tied on ${hqScore(lead)} ${unit}.`) : "") + " Every report, assist and good grade moves your division up." : "No reports yet this " + (P === "week" ? "week" : "month") + ". First report takes the lead."}</p></div>
      ${clockH}<div class="hq-tot"><div><b>${sum("reports")}</b><small>Reports</small></div><div><b>${sum("assists")}</b><small>Assists</small></div><div><b>${sum("active")}</b><small>Active officers</small></div><div><b>${GLET(gAvg)}</b><small>Avg grade</small></div><div class="${sum("awaiting") ? "warn" : ""}"><b>${sum("awaiting")}</b><small>Awaiting grade</small></div></div></section>`;
    // the race
    const raceH = `<section class="hq-race"><header><h2><span class="hq-ic">${ICON.flag}</span>DIVISION RACE</h2><div class="hq-segs"><div class="dc-seg"><button data-hqp="week" class="${P === "week" ? "on" : ""}">This week</button><button data-hqp="month" class="${P === "month" ? "on" : ""}">This month</button></div>
      <div class="dc-seg"><button data-hqr="total" class="${HQ_RANK === "total" ? "on" : ""}">Total points</button><button data-hqr="per" class="${HQ_RANK === "per" ? "on" : ""}" title="Points divided by the officers on the division's roster: fair for small divisions">Per officer</button></div></div></header>
      <div class="hq-tower"><div class="hq-thead"><span>POS</span><span></span><span>DIVISION</span><span class="hq-tprog">PROGRESS</span><span>INTERVAL</span><span>PTS</span></div>
      ${race.map((d, i) => { const s = hqScore(d), pct = Math.max(2, Math.round(s / top * 100)), dp = (d[P].points || 0) - ((d[prevK] || {}).points || 0), gap = i ? hqScore(race[0]) - s : 0;
        const tags = (d.trophies ? `<i class="t-title" title="${d.trophies} monthly title${d.trophies === 1 ? "" : "s"}">${ICON.trophy}${d.trophies > 1 ? "×" + d.trophies : ""}</i>` : "") + (d.streak >= 3 ? `<i class="t-streak" title="Reports ${d.streak} days in a row">STREAK ${d.streak}</i>` : "") + (HQ.hot === d.id ? '<i class="t-hot" title="Most points in the last 24 hours">HOT</i>' : "") + (HQ.improved && HQ.improved.id === d.id ? `<i class="t-imp" title="Biggest jump from last week">+${HQ.improved.by}</i>` : "");
        return `<div class="hq-lane${i === 0 && s ? " lead" : ""}" style="--c:${esc(d.color)}" data-div="${esc(d.id)}" title="Open ${esc(d.name)}">
          <span class="hq-pos">${i + 1}</span><span class="hq-stripe"></span>
          <div class="hq-lname">${emblem(d, "hq-em")}<div><b>${esc(d.name)}</b><small>${d[P].reports} report${d[P].reports === 1 ? "" : "s"} · ${d[P].active} active${dp ? ` · <em class="${dp > 0 ? "up" : "down"}">${dp > 0 ? "▲" : "▼"} ${Math.abs(dp)}</em>` : ""}</small></div>${tags ? `<span class="hq-tags">${tags}</span>` : ""}</div>
          <div class="hq-track"><i class="hq-trail" style="width:${HQ_ANIM ? 0 : pct}%" data-w="${pct}"></i><span class="hq-car" style="left:${HQ_ANIM ? 0 : pct}%" data-l="${pct}"></span></div>
          <span class="hq-int">${i === 0 ? (s ? "LEADER" : "—") : gap ? "+" + gap : "TIED"}</span>
          <b class="hq-pts">${s}</b></div>`; }).join("")}</div>
      <p class="hq-legend">Points: report filed <b>${HQ.points.report}</b> · officer assisted <b>${HQ.points.assist}</b> · graded A <b>+${HQ.points.A}</b> / B <b>+${HQ.points.B}</b> / C <b>+${HQ.points.C}</b> · each active officer <b>+${HQ.points.active}</b> · up to ${HQ.points.capReports || 3} reports and ${HQ.points.capAssists || 6} assists per officer per day count, so quality beats volume</p></section>`;
    // division cards, MVP, hall of fame, live feed
    const mvp = HQ.mvp, mvpDiv = mvp && L.find(d => d.id === mvp.div);
    const cardsH = `<div class="hq-cards">${race.map(d => { const c = d[P], act = d.roster ? Math.round(c.active / d.roster * 100) : 0, mx = Math.max(1, ...d.days);
        return `<article class="hq-card" style="--c:${esc(d.color)}"><header>${emblem(d, "hq-cem")}<div><b>${esc(d.name)}</b><small>${esc(d.tagline || "Division")}${d.trophies ? ` · 🏆 ${d.trophies} title${d.trophies === 1 ? "" : "s"}` : ""}</small></div>
          <div class="hq-ring" style="--p:${act}"><b>${c.active}${d.roster ? "<i>/" + d.roster + "</i>" : ""}</b><small>active</small></div></header>
          <div class="hq-cstats"><div><b>${c.reports}</b><small>Reports</small></div><div><b>${c.assists}</b><small>Assists</small></div><div><b>${GLET(c.avg)}</b><small>Avg grade</small></div><div class="${c.awaiting ? "warn" : ""}"><b>${c.awaiting}</b><small>To grade</small></div></div>
          ${goalHTML(d)}
          <div class="hq-spark" title="Reports, last 7 days">${d.days.map((n, i) => `<i style="height:${Math.max(6, Math.round(n / mx * 100))}%" class="${i === 6 ? "t" : ""}" title="${n} report${n === 1 ? "" : "s"}"></i>`).join("")}</div>
          <footer>${d.top ? `<span class="hq-top">${face(d.top, "hq-tav")} ${esc(d.top.callsign ? d.top.callsign + " · " : "")}${esc(d.top.name)} <em>${d.top.pts} pts</em>${OFFICER() && d.top.id ? ` <button class="hq-kudo sm" data-kudo="${esc(d.top.id)}" data-kname="${esc(d.top.name)}" title="Recognize">👏</button>` : ""}</span>` : `<span class="hq-top dim">No top performer yet</span>`}<span class="dim">${d.last ? "Last report " + ago(d.last) : "No reports yet"}</span></footer>
          <button class="hq-open" data-div="${esc(d.id)}">Open ${esc(d.name)} →</button></article>`; }).join("")}</div>`;
    const mvpH = `<section class="hq-mvp"${mvpDiv ? ` style="--c:${esc(mvpDiv.color)}"` : ""}><div class="hq-mk">MVP · THIS WEEK</div>${mvp ? `${face(mvp, "hq-mav")}<b>${esc(mvp.name)}</b><small>${esc(mvp.callsign || "")}${mvpDiv ? " · " + esc(mvpDiv.name) : ""}</small><div class="hq-mpts">${mvp.pts}<span>pts</span></div>${OFFICER() && mvp.id ? `<button class="hq-kudo" data-kudo="${esc(mvp.id)}" data-kname="${esc(mvp.name)}">👏 Recognize</button>` : ""}` : `<p class="dim">The first report of the week claims it.</p>`}</section>`;
    const feedH = `<section class="hq-feed"><h3><span class="hq-pulse"></span>LIVE ACROSS DIVISIONS</h3>${(HQ.feed || []).length ? HQ.feed.map(f => { const d = L.find(x => x.id === f.div) || {};
          return `<div class="hq-fi" style="--c:${esc(d.color || "#888")}" data-div="${esc(f.div)}"><i></i><div><b>${esc(f.icon)} ${esc(f.title)}</b><small>${esc(d.name || "")}${f.by ? " · " + esc(f.by) : ""} · ${ago(f.at)}</small></div>${f.grade ? `<span class="hq-g">${esc(f.grade)}</span>` : ""}</div>`; }).join("") : '<p class="dim">No reports yet.</p>'}</section>`;
    // three views so nothing is crowded: the race, the leaders' bulletin, the division cards
    const B = HQ.board || [], unread = B.filter(p => !p.mine && p.at > HQ_SEEN).length;
    const goalsSet = L.filter(d => (HQ.goals || {})[d.id] && HQ.goals[d.id].target).length, goalsHit = L.filter(d => { const g = (HQ.goals || {})[d.id]; return g && g.target && d.week.reports >= g.target; }).length;
    const tabsH = `<nav class="hq-tabs"><button data-hqt="race" class="${HQ_TAB === "race" ? "on" : ""}"><span>${ICON.flag}</span>Race<small>${esc(lead.name)} leads</small></button>
      <button data-hqt="board" class="${HQ_TAB === "board" ? "on" : ""}"><span>${ICON.pin}</span>Bulletin<small>${B.length} post${B.length === 1 ? "" : "s"}</small>${unread ? `<em>${unread} new</em>` : ""}</button>
      <button data-hqt="divs" class="${HQ_TAB === "divs" ? "on" : ""}"><span>${ICON.grid}</span>Divisions<small>${goalsSet ? goalsHit + " / " + goalsSet + " goals hit" : L.length + " division" + (L.length === 1 ? "" : "s")}</small></button></nav>`;
    const stripH = `<section class="hq-strip"><div class="hq-kick"><span class="hq-pulse"></span>COMMAND CENTER · ${P === "week" && HQ.weekEnd ? "WEEK ENDING " + esc(new Date(HQ.weekEnd).toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase()) : (P === "week" ? "WEEK OF " : "MONTH OF ") + esc(since.toUpperCase())}</div><div class="hq-mini">${race.slice(0, 3).map((d, i) => `<span style="--c:${esc(d.color)}">${i === 0 && hqScore(d) ? "👑" : i + 1 + "."} ${esc(d.name)} <b>${hqScore(d)}</b></span>`).join("")}</div></section>`;
    let h;
    if (HQ_TAB === "board") { HQ_SEEN = Date.now(); store("dc:hqseen", String(HQ_SEEN)); h = stripH + tabsH + `<div class="hq-grid">${boardHTML()}<aside class="hq-side">${feedH}</aside></div>`; }
    else if (HQ_TAB === "divs") h = stripH + tabsH + cardsH;
    else { const mo = hqMoments(race); h = heroH + tabsH + (mo.length ? `<div class="hq-ticker"><span class="hq-tk"><i class="hq-pulse"></i>RACE WIRE</span><div class="hq-tkm"><div>${mo.concat(mo).map(x => `<span>${x.replace(/^(⚡|📈|🚨|🔥|🏆)\s*/, (m, e) => `<i class="tk tk-${{ "⚡": "lead", "📈": "up", "🚨": "busy", "🔥": "streak", "🏆": "mvp" }[e]}">${{ "⚡": /lead/.test(x) ? "LEAD" : "HOT", "📈": /improved/i.test(x) ? "IMPROVED" : "MOVE", "🚨": "BUSY", "🔥": "STREAK", "🏆": "MVP" }[e]}</i>`)}</span>`).join("")}</div></div></div>` : "") + raceH + `<div class="hq-row3">${mvpH}${fameHTML(L)}${feedH}</div>`; }
    if (HQ_TAB === "divs") setTimeout(() => L.forEach(d => { const g = (HQ.goals || {})[d.id]; if (!g || !g.target || d.week.reports < g.target) return; const k = "dc:goalcel:" + d.id + ":" + HQ.weekStart; try { if (localStorage.getItem(k)) return; localStorage.setItem(k, "1"); } catch (e) { return; } confetti(d.color); toast("🎯 " + d.name + " hit its weekly goal!", "ok"); }), 400);
    box.innerHTML = h;
    if (HQ_ANIM) { HQ_ANIM = false; requestAnimationFrame(() => requestAnimationFrame(() => box.querySelectorAll(".hq-trail").forEach(t => t.style.width = t.dataset.w + "%") || box.querySelectorAll(".hq-car").forEach(c => c.style.left = c.dataset.l + "%"))); }
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
        ${r.grade && r.comments ? `<div class="rc-cm">“${esc(r.comments)}” <span>— ${esc(r.gradedBy)}</span></div>` : ""}
      </div>
      <div class="rc-g">${r.grade ? `<button type="button" class="gb ${GCLS(r.grade)}" data-grade="${esc(r.id)}" title="Graded by ${esc(r.gradedBy)}${r.gradedAt ? " · " + esc(fullTime(r.gradedAt)) : ""}">${esc(r.grade)}</button><small>${esc(r.gradedBy)}</small>` : `<button type="button" class="dc-btn ac sm" data-grade="${esc(r.id)}">⚖ Grade</button>`}
        <button type="button" class="rc-more" data-more="${esc(r.id)}">📄 Read report</button></div>
      ${opts.open ? `<div class="rc-paper">${paperHTML(r, FULL[r.id] != null ? paperText(FULL[r.id]) : "Loading the full report…")}</div>` : ""}
    </article>`;
  }
  const OPEN = new Set(), FULL = {};
  // A report on "paper": the CID case file as the case builder prints it, and any other report laid out the same way
  function paperText(t) {
    t = String(t || "");
    if (/^={20,}/.test(t)) return window.CaseFile ? CaseFile.rewrap(t) : t;   // already a printed case file
    const lines = t.split("\n"), out = [], kv = /^([^:\n]{1,42}):\s(.*)$/;
    for (let i = 0; i < lines.length;) {
      if (kv.test(lines[i])) {                                         // a run of "Label: value" lines, values lined up
        const run = []; while (i < lines.length && kv.test(lines[i])) { const m = kv.exec(lines[i]); run.push([m[1], m[2]]); i++; }
        const short = run.filter(([, b]) => b.indexOf("; ") === -1 && b.length <= 70), w = Math.min(26, Math.max(0, ...short.map(x => x[0].length)) + 2);
        let open = false;
        run.forEach(([a, b]) => {
          if (b.indexOf("; ") !== -1 || b.length > 70) {            // a list or long text: its own section, one entry per line
            out.push("", "[ " + a.toUpperCase() + " ]", "-".repeat(38));
            if (b.indexOf("; ") !== -1) b.split(/;\s(?=\S)/).forEach(x => out.push("  • " + x)); else out.push(b);
            out.push(""); open = false;
          } else { if (!open && out.length && out[out.length - 1] !== "" && !/^-+$/.test(out[out.length - 1])) out.push(""); out.push((a + ":").padEnd(w) + b); open = true; }
        });
      } else if (/^[A-Z0-9 &/().,'#-]{3,}$/.test(lines[i].trim()) && /[A-Z]/.test(lines[i])) {   // a section heading
        if (out.length && out[out.length - 1] !== "") out.push("");
        out.push("[ " + lines[i].trim() + " ]", "-".repeat(38)); i++;
      } else { out.push(lines[i]); i++; }
    }
    const txt = out.join("\n").replace(/\n{3,}/g, "\n\n");
    return window.CaseFile ? CaseFile.rewrap(txt) : txt;
  }
  function paperHTML(r, text) {
    const dv = DATA.division, no = r.no || r.formTitle;
    const stamp = r.grade ? `<span class="pp-stamp g">GRADE ${esc(r.grade)}</span>` : `<span class="pp-stamp">AWAITING GRADE</span>`;
    return `<div class="pp"><div class="pp-head"><img src="${esc(dv.logoUrl || "img/lspd-seal.png")}" alt="" onerror="this.onerror=null;this.src='img/lspd-seal.png'"><div><b>LSPD ${esc(dv.name.toUpperCase())}</b><small>${esc(("Official " + (r.formTitle || "report") + (no && no !== r.formTitle ? " · " + no : "")).toUpperCase())}</small></div>${stamp}</div>
      <pre class="pp-body" data-full="${esc(r.id)}">${esc(text)}</pre></div>`;
  }
  function fullReport(id, box) {
    const put = t => { if (box && box.isConnected) box.textContent = paperText(t); };
    if (FULL[id] != null) { put(FULL[id]); return; }
    put("Loading the full report…");
    api("divReport", { id: id }).then(x => {
      const r = DATA.reports.find(y => y.id === id) || {};
      let t = x.report || "No details recorded.";
      if (!x.printed && x.data && x.form && window.CaseFile) {
        try { t = CaseFile.text(x.form, x.data, { dept: "LSPD " + DATA.division.name, doc: "Official " + (x.form.title || "report"), number: r.no, filedBy: r.author ? (r.author.callsign ? r.author.callsign + " | " : "") + r.author.name : "", date: r.at ? new Date(r.at).toLocaleDateString() : "" }); } catch (e) {}
      }
      FULL[id] = t; put(FULL[id]); document.querySelectorAll(`[data-full="${CSS.escape(id)}"]`).forEach(b => b.textContent = paperText(FULL[id]));
    })
      .catch(e => put("Couldn't load the full report: " + e.message));
  }
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
    const nav = navList(), at = nav.findIndex(x => x.id === r.id), prev = nav[at - 1], next = nav[at + 1], nextUn = nav.slice(at + 1).find(x => !x.grade) || nav.slice(0, Math.max(0, at)).find(x => !x.grade);
    $("mcard").className = "dc-mcard review";
    $("mcard").innerHTML = `<div class="gm-split">
      <div class="gm-left">${paperHTML(r, "Loading the full report…")}</div>
      <div class="gm-right">
        <div class="gm-top"><div class="gm-nav"><button type="button" class="dc-ibtn" id="gmPrev" ${prev ? "" : "disabled"} title="Previous report (←)">‹</button><span>${at + 1} / ${nav.length}</span><button type="button" class="dc-ibtn" id="gmNext" ${next ? "" : "disabled"} title="Next report (→)">›</button></div><button class="dc-x" data-mclose aria-label="Close">✕</button></div>
        <div class="dc-kick">GRADE REPORT</div><h2>${esc(r.title || r.formTitle)}</h2>
        <div class="gm-m">${esc(r.formTitle)}${r.no ? " · " + esc(r.no) : ""} · ${esc(fullTime(r.at))}</div>
        <div class="rc-p">${r.author ? personChip(r.author, "author") : ""}${r.tagged.map(t => personChip(t, "assist")).join("")}</div>
        <div class="gm-letters">${["A", "B", "C", "D", "F", "R"].map(g => `<button type="button" data-g="${g}" class="${GCLS(g)}${pick === g ? " on" : ""}" title="Press ${g}"><b>${g === "R" ? "↩" : g}</b><small>${{ A: "Excellent", B: "Good", C: "Acceptable", D: "Needs work", F: "Unacceptable", R: "Return to fix" }[g]}</small></button>`).join("")}</div>
        <label class="gm-f"><span>Comments for the officer</span><textarea id="gmCm" maxlength="1500" placeholder="What was done well, what to fix next time…">${esc(r.comments || "")}</textarea></label>
        <label class="gm-f"><span>Graded by</span><input id="gmBy" maxlength="60" value="${esc(r.gradedBy || by)}"></label>
        <label class="gm-c${r.canPost ? "" : " dis"}"><input type="checkbox" id="gmPost" ${r.canPost ? "checked" : "disabled"}> Post to Discord: grade line on the report + a reply tagging ${esc(r.author ? r.author.name : "the officer")}${r.canPost ? "" : " <small>(this report's Discord post wasn't recorded" + (r.imported ? ": imported from the sheet" : "") + ")</small>"}</label>
        ${r.tagged.length ? `<label class="gm-c${r.canPost ? "" : " dis"}"><input type="checkbox" id="gmPing" ${DATA.division.pingTagged ? "checked" : ""} ${r.canPost ? "" : "disabled"}> Also tag the ${r.tagged.length} assisting officer${r.tagged.length === 1 ? "" : "s"}</label>` : ""}
        <div class="gm-b">${r.grade ? '<button type="button" class="dc-btn danger" id="gmClear">Remove grade</button>' : ""}<span></span><button type="button" class="dc-btn" data-mclose>Close</button>${nextUn ? '<button type="button" class="dc-btn" id="gmSaveNext" title="Save, then open the next report that needs a grade">Save &amp; next ›</button>' : ""}<button type="button" class="dc-btn ac" id="gmSave">Save grade</button></div>
        <p class="gm-keys">Keys: <b>A–F</b> pick a grade · <b>R</b> return for correction · <b>← →</b> previous / next report · <b>Esc</b> close</p>
      </div></div>`;
    $("modal").hidden = false;
    const card0 = () => $("mcard").querySelector(".pp-body");
    fullReport(r.id, card0());
    const card = $("mcard");
    card.querySelector(".gm-letters").onclick = e => { const b = e.target.closest("[data-g]"); if (!b) return; pick = b.dataset.g; card.querySelectorAll("[data-g]").forEach(x => x.classList.toggle("on", x === b)); };
    card.querySelectorAll("[data-mclose]").forEach(b => b.onclick = closeModal);
    const send = async (clear, then) => {
      if (!clear && !pick) { toast("Pick a grade first.", "bad"); return; }
      const btn = clear ? $("gmClear") : $("gmSave"), lab = btn.textContent; btn.disabled = true; btn.textContent = clear ? "Removing…" : "Saving…";
      const gby = $("gmBy").value.trim(); store("dc:gradedBy", gby);
      const posted = !clear && !!($("gmPost") && $("gmPost").checked);
      try {
        const res = await api("divGrade", { id: r.id, division: DATA.division.id, grade: pick, comments: $("gmCm").value.trim(), gradedBy: gby, clear: !!clear, post: posted, pingTagged: !!($("gmPing") && $("gmPing").checked) });
        Object.assign(r, clear ? { grade: "", gradedBy: "", comments: "", gradedAt: 0 } : { grade: pick, gradedBy: gby || ME.username, comments: $("gmCm").value.trim(), gradedAt: Date.now() });
        keep(DATA.division.id, DATA); closeModal(); drawAll(); if (!$("drawer").hidden) { const k = $("dpanel").dataset.key; if (k) openOfficer(k); }
        if (then) openGrade(then.id);
        toast(res.warning ? "Grade saved (" + res.warning + ")" : clear ? "Grade removed" : "Grade " + pick + " saved" + (posted ? " and posted to Discord" : ""), res.warning ? "bad" : "ok");
      } catch (e) { toast(e.message, "bad"); btn.disabled = false; btn.textContent = lab; }
    };
    $("gmSave").onclick = () => send(false);
    if ($("gmSaveNext")) $("gmSaveNext").onclick = () => send(false, nextUn);
    $("gmPrev").onclick = () => prev && openGrade(prev.id);
    $("gmNext").onclick = () => next && openGrade(next.id);
    GKEYS = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
      if (typing) return;
      const k = e.key.toUpperCase();
      if (["A", "B", "C", "D", "F", "R"].includes(k)) { const b = card.querySelector(`[data-g="${k}"]`); if (b) b.click(); e.preventDefault(); }
      else if (e.key === "ArrowLeft" && prev) openGrade(prev.id);
      else if (e.key === "ArrowRight" && next) openGrade(next.id);
    };
    if ($("gmClear")) $("gmClear").onclick = () => { if (confirm("Remove this grade? (Anything already posted in Discord stays.)")) send(true); };
  }
  function closeModal() { $("modal").hidden = true; $("mcard").innerHTML = ""; $("mcard").className = "dc-mcard"; GKEYS = null; }
  let GKEYS = null;
  document.addEventListener("keydown", e => { if (GKEYS && !$("modal").hidden) GKEYS(e); });
  // the reports the leader is looking at, in the same order (for previous / next)
  function navList() {
    const from = periodStart(PERIOD);
    let list = DATA.reports.filter(r => r.at >= from);
    if (TAB === "reports") {
      if (REP_F.state === "ungraded") list = list.filter(r => !r.grade); else if (REP_F.state === "graded") list = list.filter(r => r.grade);
      if (REP_F.form) list = list.filter(r => r.form === REP_F.form);
    }
    return list;
  }
  $("modal").addEventListener("mousedown", e => { if (e.target === $("modal")) closeModal(); });

  // ---------------- clicks ----------------
  document.addEventListener("click", e => {
    const t = e.target;
    const ht = t.closest("[data-hqt]"); if (ht) { HQ_TAB = ht.dataset.hqt; store("dc:hqt", HQ_TAB); HQ_ANIM = HQ_TAB === "race"; drawHQ(true); return; }
    const kb = t.closest("[data-kudo]"); if (kb) { const msg = prompt("Recognize " + kb.dataset.kname + " (they'll see it on their MDT):", "Great work this week. Thanks for carrying the division!"); if (msg && msg.trim()) Portal.post({ action: "unitKudos", session: SESSION, to: kb.dataset.kudo, msg: msg.trim() }).then(r => toast(r.ok ? "👏 " + kb.dataset.kname + " was recognized." : (r.error || "Couldn't send that."), r.ok ? "ok" : "bad")).catch(() => toast("Couldn't reach the server.", "bad")); return; }
    if (t.closest("[data-hqnew]")) { HQ_NEW = !HQ_NEW; drawHQ(true); if (HQ_NEW) setTimeout(() => { const n = document.querySelector("#hqNew [name=title]"); if (n) n.focus(); }, 30); return; }
    const ha = t.closest("[data-hqack]"); if (ha) { hqDo("hqAck", { id: ha.dataset.hqack }); return; }
    const hr2 = t.closest("[data-hqrep]"); if (hr2) { const id = hr2.dataset.hqrep; HQ_OPEN.has(id) ? HQ_OPEN.delete(id) : HQ_OPEN.add(id); drawHQ(true); return; }
    const hpn = t.closest("[data-hqpin]"); if (hpn) { hqDo("hqPin", { id: hpn.dataset.hqpin, on: hpn.dataset.on === "1" }); return; }
    const hd = t.closest("[data-hqdel]"); if (hd) { if (confirm("Remove this post for everyone?")) hqDo("hqDelete", { id: hd.dataset.hqdel }, "Post removed."); return; }
    const hg = t.closest("[data-goal]"); if (hg) { HQ_GOAL = hg.dataset.goal; drawHQ(true); return; }
    if (t.closest("[data-goalx]")) { HQ_GOAL = ""; drawHQ(true); return; }
    const hp = t.closest("[data-hqp]"); if (hp) { HQ_P = hp.dataset.hqp; store("dc:hqp", HQ_P); HQ_ANIM = true; drawHQ(); return; }
    const hr = t.closest("[data-hqr]"); if (hr) { HQ_RANK = hr.dataset.hqr; store("dc:hqr", HQ_RANK); HQ_ANIM = true; drawHQ(); return; }
    const dvb = t.closest("[data-div]"); if (dvb) { switchDiv(dvb.dataset.div); return; }
    const pb = t.closest("#period [data-p]"); if (pb) { PERIOD = pb.dataset.p; store("dc:period", PERIOD); drawAll(); return; }
    const tb = t.closest("[data-tab],[data-t]"); if (tb && !t.closest("#dpanel")) { TAB = tb.dataset.tab || tb.dataset.t; drawAll(); window.scrollTo({ top: $("kpis").offsetTop - 120, behavior: "smooth" }); return; }
    const g = t.closest("[data-grade]"); if (g) { e.stopPropagation(); openGrade(g.dataset.grade); return; }
    const m = t.closest("[data-more]"); if (m) { openGrade(m.dataset.more); return; }
    if (false) { const id = m.dataset.more; OPEN.has(id) ? OPEN.delete(id) : OPEN.add(id); const card = m.closest(".rc"), r = DATA.reports.find(x => x.id === id); if (card && r) { card.outerHTML = reportCard(r, { open: OPEN.has(id) }); if (OPEN.has(id)) fullReport(id, document.querySelector(`.rc-paper [data-full="${CSS.escape(id)}"]`)); } return; }
    const o = t.closest("[data-off]"); if (o) { openOfficer(o.dataset.off); $("dpanel").dataset.key = o.dataset.off; return; }
    if (t.closest("[data-close]")) { closeDrawer(); return; }
  });
  document.addEventListener("keydown", e => { if (e.key !== "Escape") return; if (!$("modal").hidden) closeModal(); else if (!$("drawer").hidden) closeDrawer(); });

  // ---------------- start ----------------
  tick();
  if (OFFICER()) { $("outBtn").textContent = "← Portal"; }
  if (TOKEN || SESSION) { if (HQ) { $("boot").hidden = true; $("app").hidden = false; drawAll(); } loadHQ(); load(false); } else showLogin();
  setInterval(() => { if (MODE === "hq" && (TOKEN || SESSION) && !document.hidden) loadHQ(); }, 90000);
})();
