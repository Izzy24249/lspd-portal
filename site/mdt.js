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
    $("uCs").textContent = p.callsign || "----"; $("uName").textContent = who(p);
    $("uRank").textContent = (DATA && DATA.fleet && DATA.fleet.rank && (DATA.fleet.rank.known || DATA.fleet.rank.trainee)) ? DATA.fleet.rank.name : (p.level || "");
    const sop = (DATA && DATA.sop) || "https://docs.google.com/document/d/1t4vHCiHS3xH2VTfDgOKRX3L7BeZyh8YrCLaC_bZTJqw/edit?tab=t.0"; $("sopLink").href = "#sop";
    const nt = UNIT && UNIT.sessions ? UNIT.sessions.filter(x => !x.mine && !x.full).length + (UNIT.checks || []).filter(c => !c.best).length : 0; $("nTrain").textContent = nt || "";
    const nb = (DATA && DATA.board && DATA.board.notices || []).length; $("nBolo").textContent = nb || ""; $("nBolo").className = nb ? "new" : "";
    if (DATA && DATA.fleet) { $("nFleet").textContent = DATA.fleet.vehicles.filter(v => v.allowed).length || ""; $("nUni").textContent = (DATA.fleet.uniforms[SEX] || []).filter(u => u.yours).length || ""; }
    drawFormsNav();
  }
  // ---------- unit status (10-codes), sound, mobile drawer ----------
  const STATUSES = [["10-8", "In service", "#34d996"], ["10-6", "Busy", "#ffbe3d"], ["10-23", "On scene", "#4c8dff"], ["10-97", "En route", "#3ee0ff"], ["10-7", "Out of service", "#ff5d6c"]];
  function paintStatus() { const st = STATUSES.find(x => x[0] === LS.get("mdt:status")) || STATUSES[0]; $("statusTxt").textContent = st[0] + " · " + st[1].toUpperCase(); const b = $("statusBtn"); b.style.color = st[2]; b.style.borderColor = st[2] + "66"; b.style.background = st[2] + "14"; }
  $("statusMenu").innerHTML = STATUSES.map(x => '<button data-st="' + x[0] + '"><i style="background:' + x[2] + ';box-shadow:0 0 8px ' + x[2] + '"></i><b>' + x[0] + "</b>" + x[1] + "</button>").join("");
  $("statusBtn").onclick = e => { e.stopPropagation(); $("statusMenu").hidden = !$("statusMenu").hidden; };
  $("statusMenu").onclick = e => { const b = e.target.closest("[data-st]"); if (!b) return; LS.set("mdt:status", b.dataset.st); paintStatus(); $("statusMenu").hidden = true; blip(1300); toast("Status " + b.textContent.replace(/^(\S+)/, "$1 ·")); };
  document.addEventListener("click", e => { if (!e.target.closest("#statusMenu,#statusBtn")) $("statusMenu").hidden = true; });
  paintStatus();
  let actx = null;
  function blip(f) { if (LS.get("lspd_sound") === "off") return; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain(); o.type = "sine"; o.frequency.value = f || 900; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.035, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.08); } catch (e) {} }
  function paintSnd() { $("sndBtn").classList.toggle("off", LS.get("lspd_sound") === "off"); }
  $("sndBtn").onclick = () => { LS.set("lspd_sound", LS.get("lspd_sound") === "off" ? "" : "off"); paintSnd(); blip(); toast(LS.get("lspd_sound") === "off" ? "Sounds off" : "Sounds on"); };
  paintSnd();
  const side = $("side");
  $("menuBtn").onclick = () => side.classList.add("open"); $("sideClose").onclick = () => side.classList.remove("open"); $("scrim").onclick = () => side.classList.remove("open");

  // ---------- reports (forms) in the side panel ----------
  let FORM_Q = "";
  function myForms() { return (DATA && DATA.forms) || []; }
  function drawFormsNav() {
    const box = $("formsNav"); if (!DATA) return;
    const list = myForms(), q = FORM_Q.toLowerCase(), cur = VIEW.indexOf("form:") === 0 ? VIEW.slice(5) : "";
    $("nForms").textContent = list.filter(f => f.status === "live").length || "";
    const shown = list.filter(f => !q || (f.title + " " + f.section + " " + f.division).toLowerCase().indexOf(q) !== -1);
    const btn = f => '<button class="fa' + (f.status !== "live" ? " soon" : "") + (cur === f.id ? " on" : "") + '" ' + (f.status === "live" ? 'data-form="' + esc(f.id) + '"' : "disabled") + ' title="' + esc(f.desc || f.title) + '"><span class="fi">' + esc(f.icon) + "</span><span>" + esc(f.title) +
      (f.status !== "live" ? "<small>Coming soon</small>" : f.division ? "<small>" + esc(f.division) + "</small>" : "") + "</span></button>";
    const live = shown.filter(f => f.status === "live"), soon = shown.filter(f => f.status !== "live");
    const html = (list.length > 6 ? '<input class="forms-filter" id="formsFilter" placeholder="Filter reports…" value="' + esc(FORM_Q) + '">' : "") +
      live.map(btn).join("") + (soon.length ? '<details class="soonbox"' + (q ? " open" : "") + '><summary>Coming soon · ' + soon.length + "</summary>" + soon.map(btn).join("") + "</details>" : "") +
      (shown.length ? "" : '<p style="padding:4px 10px;color:var(--dim);font-size:12.5px">No reports match.</p>');
    if (box.__h !== html) { const had = document.activeElement && document.activeElement.id === "formsFilter", pos = had ? document.activeElement.selectionStart : 0; box.innerHTML = html; box.__h = html; if (had) { const n = $("formsFilter"); n.focus(); n.setSelectionRange(pos, pos); } }
  }
  document.addEventListener("input", e => { if (e.target.id === "formsFilter") { FORM_Q = e.target.value; drawFormsNav(); } });
  document.addEventListener("click", e => { const b = e.target.closest("[data-form]"); if (b) { e.preventDefault(); go("form:" + b.getAttribute("data-form")); }
    const fr = e.target.closest("[data-frame]"); if (fr) { e.preventDefault(); go("frame:" + fr.getAttribute("data-frame")); } });
  // a report filed inside the terminal: refresh "My reports", the ticker and the stats
  addEventListener("message", e => { if (e.origin === location.origin && e.data && e.data.type === "lspd:filed") { toast("✓ " + (e.data.title || "Report") + " filed"); blip(1400); setTimeout(load, 1500); } });

  // ---------- router ----------
  const VIEWS = ["home", "fleet", "uniforms", "records", "reference", "unit", "training", "reports", "sop"];
  const TITLES = { home: ["TERMINAL", "Dashboard"], fleet: ["DEPARTMENT", "Fleet"], uniforms: ["DEPARTMENT", "Uniforms"], records: ["TERMINAL", "Records & BOLOs"], reference: ["TERMINAL", "Penal code & 10-codes"], unit: ["DEPARTMENT", "Kudos & awards"], training: ["DEPARTMENT", "Training"], reports: ["REPORTS", "File a report"], sop: ["DEPARTMENT", "Standard Operating Procedures"] };
  const okView = v => VIEWS.indexOf(v) >= 0 || /^form:[\w-]+$/.test(v) || /^frame:[\w.-]+\.html$/.test(v);
  function go(v) { VIEW = okView(v) ? v : "home"; if (decodeURIComponent(location.hash.slice(1)) !== VIEW) history.replaceState(null, "", "#" + VIEW); side.classList.remove("open"); draw(); window.scrollTo(0, 0); blip(); }
  document.addEventListener("click", e => { const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); go(a.getAttribute("data-go")); } });
  addEventListener("hashchange", () => { const h = decodeURIComponent(location.hash.slice(1)); if (h !== VIEW) go(h); });

  function drawTicker() {
    const t = $("ticker"), list = (DATA && DATA.board && DATA.board.dept && DATA.board.dept.ticker) || [];
    if (!list.length) { t.hidden = true; return; }
    t.hidden = false; t.innerHTML = '<div class="live"><i></i>LIVE</div><div class="tk-run">' + list.concat(list).map(x => "<span>" + esc(x.t) + " · " + ago(x.at) + "</span>").join("") + "</div>";
  }
  function modal(html) { const m = $("modal"); m.innerHTML = '<div class="md-box">' + html + "</div>"; m.hidden = false; m.onclick = e => { if (e.target === m || e.target.closest("[data-close]")) m.hidden = true; }; return m; }
  // the SOP as an embeddable page: Google Docs block /edit inside frames, /preview is the read-only view that allows it
  function sopEmbed(u) {
    const g = /^(https:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/[\w-]+)/.exec(u || "");
    if (g) { const tab = /[?&#]tab=([\w.]+)/.exec(u); return g[1] + "/preview" + (tab ? "?tab=" + tab[1] : ""); }
    return u;
  }
  function sopUrl() { return (DATA && DATA.sop) || "https://docs.google.com/document/d/1t4vHCiHS3xH2VTfDgOKRX3L7BeZyh8YrCLaC_bZTJqw/edit?tab=t.0"; }
  function frameHTML(src, icon, title, sub, full) {
    return '<div class="formview"><div class="fv-bar"><span class="fi">' + esc(icon) + "</span><div><b>" + esc(title) + "</b><small>" + esc(sub) + '</small></div><span class="sp"></span><a class="btn ghost" href="' + esc(full || src.replace(/[?&]embed=1/, "")) + '" target="_blank" rel="noopener" title="Open in its own tab">↗ <span class="only-d">FULL PAGE</span></a></div>' +
      '<div class="fv-frame"><div class="fv-load boot"><i></i>' + (full ? "LOADING SOP…" : "LOADING REPORT…") + '</div><iframe src="' + esc(src) + '" title="' + esc(title) + '" onload="this.previousElementSibling.style.opacity=0"></iframe></div></div>';
  }
  function draw() {
    const navKey = VIEW.indexOf("form:") === 0 ? "reports" : VIEW;
    document.querySelectorAll("[data-go]").forEach(a => a.classList.toggle("on", a.getAttribute("data-go") === navKey));
    document.querySelectorAll("[data-frame]").forEach(a => a.classList.toggle("on", "frame:" + a.getAttribute("data-frame") === VIEW));
    drawStrip();
    const m = $("main"), framed = /^(form|frame):/.test(VIEW) || VIEW === "sop";
    let t = TITLES[VIEW] || ["TERMINAL", "Dashboard"];
    if (VIEW.indexOf("form:") === 0) { const f = myForms().find(x => x.id === VIEW.slice(5)); t = ["REPORTS", f ? f.title : "Report"]; }
    if (VIEW.indexOf("frame:") === 0) { const a = document.querySelector('[data-frame="' + VIEW.slice(6) + '"]'); t = ["TERMINAL", a ? a.getAttribute("data-title") : "Page"]; }
    $("crumbSec").textContent = t[0]; $("crumbTitle").textContent = t[1]; document.title = t[1] + " · LSPD MDT";
    m.classList.toggle("flush", framed);
    if (!DATA) { m.innerHTML = '<div class="boot"><i></i>ESTABLISHING LINK…</div>'; return; }
    if (framed) {
      if (m.__view === VIEW) return;                                   // keep the report open (and typed text) through background refreshes
      m.__view = VIEW;
      if (VIEW.indexOf("form:") === 0) {
        const f = myForms().find(x => x.id === VIEW.slice(5));
        if (!f) { m.__view = ""; m.innerHTML = '<div class="main-in"><div class="empty">That report isn\'t available to you.</div></div>'; return; }
        m.innerHTML = frameHTML(f.cid ? "cid.html?embed=1" : "forms.html?embed=1#" + f.id, f.icon, f.title, f.division ? f.division + " report" : (f.desc || "Filed straight to Discord and Division Command"));
      } else if (VIEW === "sop") m.innerHTML = frameHTML(sopEmbed(sopUrl()), "📘", "LSPD SOP", "Policy, radio, pursuits, use of force", sopUrl());
      else m.innerHTML = frameHTML(VIEW.slice(6) + "?embed=1", "📋", t[1], "Your filed reports and their grades");
      $("ticker").hidden = true; return;
    }
    m.__view = "";
    m.innerHTML = '<div class="view">' + (VIEW === "fleet" ? fleetHTML() : VIEW === "uniforms" ? uniformsHTML() : VIEW === "records" ? recordsHTML() : VIEW === "reference" ? refHTML() : VIEW === "unit" ? unitHTML() : VIEW === "training" ? trainHTML() : VIEW === "reports" ? reportsHTML() : homeHTML()) + "</div>";
    if ((VIEW === "unit" || VIEW === "training") && !UNIT) loadUnit();
    if (VIEW === "reference" && !REF) loadRef();
    m.querySelectorAll("[data-count]").forEach(el => { const to = +el.dataset.count || 0, t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
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
    const D0 = B.dept || {}, NB0 = B.notices || [], st = (STATUSES.find(x => x[0] === LS.get("mdt:status")) || STATUSES[0]);
    let h = '<section class="hero"><div><div class="kick">' + esc((p.callsign ? p.callsign + " · " : "") + st[0] + " " + st[1].toUpperCase()) + "</div><h1>Good " + esc(greet().toLowerCase()) + ", " + esc(last(p.name) || "Officer") + '.<br><span>' + esc(trainee ? "Welcome to the academy." : NB0.length ? NB0.length + " active BOLO" + (NB0.length > 1 ? "s" : "") + " on the board." : "All quiet on the board.") + "</span></h1>" +
      '<p>' + esc(who(p)) + (mine.length ? " · last report <b>" + ago(mine[0].at) + " ago</b>" + (waiting ? " · <b>" + waiting + "</b> waiting on a grade" : "") : " · no reports on file yet") + '</p><div class="acts"><button class="btn" data-go="reports">FILE A REPORT <kbd>F</kbd></button><button class="btn ghost" data-go="records">RUN A RECORD</button><button class="btn ghost" id="palHero">SEARCH <kbd>Ctrl K</kbd></button></div></div>' +
      '<div class="radar"><img src="img/lspd-badge.png" alt=""><i class="blip" style="left:30%;top:28%"></i><i class="blip" style="left:68%;top:62%;animation-delay:1.4s"></i><i class="blip" style="left:56%;top:22%;animation-delay:2.4s"></i></div></section>' +
      '<div class="stats">' +
      '<div class="stat"><svg viewBox="0 0 24 24"><use href="#i-clip"/></svg><small>Dept. reports · 7 days</small><b data-count="' + (D0.week || 0) + '">0</b>' + (D0.delta ? "<em" + (D0.delta < 0 ? ' style="color:var(--red)"' : "") + ">" + (D0.delta > 0 ? "▲ " : "▼ ") + Math.abs(D0.delta) + " vs last week</em>" : "<em>&nbsp;</em>") + "</div>" +
      '<div class="stat"><svg viewBox="0 0 24 24"><use href="#i-file"/></svg><small>Your recent reports</small><b data-count="' + mine.length + '">0</b><em>' + (waiting ? waiting + " awaiting grade" : "all graded") + "</em></div>" +
      '<div class="stat ' + (NB0.length ? "r" : "") + '"><svg viewBox="0 0 24 24"><use href="#i-radio"/></svg><small>Active BOLOs</small><b data-count="' + NB0.length + '">0</b><em>' + (NB0[0] ? esc(NB0[0].title).slice(0, 26) : "none posted") + "</em></div>" +
      '<div class="stat a"><svg viewBox="0 0 24 24"><use href="#i-star"/></svg><small>Officers active · 7 days</small><b data-count="' + (D0.active || 0) + '">0</b><em>avg grade ' + esc(D0.avg || "—") + "</em></div></div>";
    if (UNIT && UNIT.ootm) h += '<a class="ootm mini" data-go="unit"><span>🏆</span><div><small>' + esc(UNIT.ootm.title) + "</small><b>" + esc(UNIT.ootm.to) + "</b></div></a>";
    if (UNIT && (UNIT.ribbons || []).length) h += '<div class="ribbons" style="margin:-8px 0 16px">' + UNIT.ribbons.map(r => '<span title="' + esc(r.title) + '"><i>' + esc(r.emoji) + "</i>" + esc(r.title) + "</span>").join("") + "</div>";
    const NB = B.notices || [];
    if (NB.length) h += '<section class="bolos">' + NB.slice(0, 3).map(n => '<a class="bolo t-' + esc(n.type.toLowerCase()) + '" data-go="records"><b>' + esc(n.type.toUpperCase()) + "</b><span>" + esc(n.title) + "</span><small>" + esc(n.from) + " · " + ago(n.at) + " ago</small></a>").join("") + (NB.length > 3 ? '<a class="bolo more" data-go="records">+' + (NB.length - 3) + " more</a>" : "") + "</section>";
    // briefing | path
    h += '<div class="grid"><section class="pane"><div class="ph"><span class="lbl">Shift briefing</span>' + (B.canBrief ? '<a data-brief>Post briefing</a>' : (B.past || []).length ? '<a data-past>Past briefings</a>' : "") + "</div>" + memoHTML(B.briefing, B) + "</section>";
    if ((DATA.paths || []).length) h += pathHTML(DATA.paths[0]);
    else h += '<section class="pane"><div class="ph"><span class="lbl">Standard Operating Procedures</span></div><div class="sop"><svg viewBox="0 0 24 24"><use href="#i-book"/></svg><div><b>LSPD SOP</b><small>Policy, radio, pursuits, use of force. Keep it handy.</small></div><a class="btn" data-go="sop" href="#sop">OPEN</a></div>' +
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
    if (B.needs) h += '<section class="pane"><div class="ph"><span class="lbl">Needs you · FTO</span></div>' + (B.needs.length ? B.needs.map(n => '<div class="need"><span class="cs">' + esc(n.callsign || "—") + "</span><div><b>" + esc(n.name) + '</b><small class="' + (n.hot ? "hot" : "") + '">' + esc(n.why) + '</small></div><a href="forms.html">' + esc(n.act) + "</a></div>").join("") : '<p style="color:var(--mute)">All trainees are on track.</p>') + "</section>";
    else h += '<section class="pane"><div class="ph"><span class="lbl">Quick access</span></div><div class="tiles" style="grid-template-columns:1fr;margin-top:0">' + tile("fleet", "i-car", "Fleet", (f.vehicles || []).filter(v => v.allowed).length + " vehicles approved for you") + tile("uniforms", "i-shirt", "Uniforms", ((f.uniforms || {})[SEX] || []).filter(u => u.yours).length + " outfits for your rank") + "</div></section>";
    h += "</div>";
    if ((p.divisions || []).length) h += '<div class="tiles"><a class="tile" href="division.html"><svg><use href="#i-shield"/></svg><b>Division Command</b><small>Your divisions: activity, grading and officers</small></a></div>';
    return h;
  }
  function reportsHTML() {
    const list = myForms();
    return '<div class="h2"><div><h1>FILE A REPORT</h1><p>Every report you can file, right here in the terminal. Division reports only show for that division\'s officers.</p></div></div>' +
      (list.length ? '<div class="reports-grid">' + list.map(f => '<button class="rcard' + (f.status !== "live" ? " soon" : "") + '" ' + (f.status === "live" ? 'data-form="' + esc(f.id) + '"' : "disabled") + '><span class="fi">' + esc(f.icon) + "</span><div><b>" + esc(f.title) + "</b><small>" + esc(f.status !== "live" ? "Coming soon" : f.desc || "Filed to Discord and Division Command") + "</small>" + (f.division ? '<span class="dv">' + esc(f.division.toUpperCase()) + "</span>" : "") + "</div></button>").join("") + "</div>"
        : '<div class="empty">No reports are open to you yet.</div>');
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
  let REF_CAT = "";
  function refHTML() {
    let h = '<div class="h2"><div><h1>PENAL CODE <span>&amp; 10-codes</span></h1><p>Grouped the same way as the charge lists in your reports. Tap a charge to copy it.</p></div></div>';
    if (!REF) return h + '<div class="boot"><i></i>LOADING PENAL CODE…</div>';
    const opts = REF.charges ? REF.charges.options : REF.penal.map(x => x.raw);
    const groups = (window.Portal && Portal.chargeGroups ? Portal.chargeGroups(opts) : [{ name: "Charges", icon: "⚖️", items: opts }]);
    const q = REF_Q.toLowerCase().trim(), match = o => !q || String(o).toLowerCase().indexOf(q) !== -1;
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    h += '<div class="pen-head"><input class="refq" id="refQ" placeholder="Search ' + total + ' charges and 10-codes…" value="' + esc(REF_Q) + '" autocomplete="off"></div>';
    h += '<div class="pen-cats"><button data-pcat="" class="' + (REF_CAT ? "" : "on") + '">All <em>' + total + "</em></button>" + groups.map(g => '<button data-pcat="' + esc(g.name) + '" class="' + (REF_CAT === g.name ? "on" : "") + '">' + esc(g.icon) + " " + esc(g.name) + " <em>" + g.items.filter(match).length + "</em></button>").join("") + "</div>";
    let any = 0;
    groups.filter(g => !REF_CAT || g.name === REF_CAT).forEach(g => {
      const items = g.items.filter(match); if (!items.length) return; any += items.length;
      h += '<details class="pen-grp"' + (q || REF_CAT || groups.length < 4 ? " open" : "") + '><summary><span class="ico">' + esc(g.icon) + "</span>" + esc(g.name) + "<em>" + items.length + '</em></summary><div class="pen-list">' +
        items.map(o => { const it = Portal.chargeItem ? Portal.chargeItem(o) : { label: o, value: o };
          return '<button class="chg" data-copy="' + esc(it.label) + '" data-what="Charge"><span class="b ' + esc(it.cls || "x") + '">' + esc(it.badge || "•") + "</span><div><b>" + (q ? hl(it.label, REF_Q) : esc(it.label)) + "</b>" + (it.cls ? "<small>" + esc(it.cls[0].toUpperCase() + it.cls.slice(1)) + "</small>" : "") + '</div><span class="t">' + esc(it.sub || "") + "</span></button>"; }).join("") + "</div></details>";
    });
    if (!any) h += '<div class="empty">' + (opts.length ? "No charge matches “" + esc(REF_Q) + "”." : "No charge list found in the report forms yet.") + "</div>";
    const C = REF.tenCodes.filter(x => !q || (x[0] + " " + x[1]).toLowerCase().indexOf(q) !== -1);
    if (C.length) h += '<div class="sect"><span class="lbl">Radio codes · ' + C.length + '</span></div><div class="codes">' + C.map(x => "<div><b>" + esc(x[0]) + "</b><span>" + esc(x[1]) + "</span></div>").join("") + "</div>";
    return h;
  }


  // ---------- unit life: kudos, awards, training, knowledge checks ----------
  let UNIT = LS.json("mdt:unit"), TAKING = null;
  async function loadUnit() { const r = await Portal.post({ action: "unitView", session: SESSION }).catch(() => null); if (r && r.ok) { UNIT = r; LS.set("mdt:unit", JSON.stringify(r)); } else if (!UNIT) UNIT = { error: (r && r.error) || "Couldn't load." }; if (VIEW === "unit" || VIEW === "training" || VIEW === "home") draw(); }
  async function unit(action, data, msg) {
    const r = await Portal.post(Object.assign({ action: action, session: SESSION }, data)).catch(() => ({ ok: false, error: "Couldn't reach the server." }));
    if (r.ok) { UNIT = r; LS.set("mdt:unit", JSON.stringify(r)); if (msg) toast(msg); draw(); } else toast(r.error || "Something went wrong.");
    return r;
  }
  const dt = t => new Date(t).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  function peopleOpts() { return (UNIT.people || []).map(p => '<option value="' + esc(p.i) + '">' + esc(p.n) + "</option>").join(""); }
  function unitHTML() {
    if (!UNIT) return '<div class="boot">LOADING…</div>'; if (UNIT.error) return '<div class="empty">' + esc(UNIT.error) + "</div>";
    const U = UNIT;
    let h = '<div class="h2"><div><h1>KUDOS &amp; AWARDS</h1><p>Thank someone for good work. Command hands out ribbons and Officer of the Month.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-kudo>👏 GIVE KUDOS</button>' + (U.canAward ? '<button class="btn ghost" data-award>🎖️ AWARD</button>' : "") + "</div></div>";
    if (U.ootm) h += '<section class="ootm"><span>🏆</span><div><small>' + esc(U.ootm.title) + "</small><b>" + esc(U.ootm.to) + "</b>" + (U.ootm.note ? "<p>" + esc(U.ootm.note) + "</p>" : "") + "</div></section>";
    if ((U.ribbons || []).length) h += '<div class="sect"><span class="lbl">Your ribbons</span></div><div class="ribbons">' + U.ribbons.map(r => '<span title="' + esc(r.note || "") + '"><i>' + esc(r.emoji) + "</i>" + esc(r.title) + "</span>").join("") + "</div>";
    h += '<div class="grid" style="margin-top:18px;align-items:start"><section class="pane"><div class="ph"><span class="lbl">Kudos wall</span><span class="lbl">' + (U.mineReceived ? "You've received " + U.mineReceived : "") + "</span></div>" +
      ((U.kudos || []).length ? U.kudos.map(k => '<div class="kudo' + (k.toId === U.me.id ? " me" : "") + '"><b>' + esc(k.to) + "</b><p>“" + esc(k.msg) + '”</p><small>from ' + esc(k.from) + " · " + ago(k.at) + " ago</small></div>").join("") : '<p style="color:var(--mute)">No kudos yet. Be the first.</p>') + "</section>" +
      '<section class="pane"><div class="ph"><span class="lbl">Recent awards</span></div>' + ((U.recentAwards || []).length ? U.recentAwards.map(a => '<div class="need"><span class="cs" style="font-size:16px">' + esc(a.emoji) + "</span><div><b>" + esc(a.to) + "</b><small>" + esc(a.title) + " · " + esc(a.by) + "</small></div><span></span></div>").join("") : '<p style="color:var(--mute)">None yet.</p>') + "</section></div>";
    return h;
  }
  function trainHTML() {
    if (!UNIT) return '<div class="boot">LOADING…</div>'; if (UNIT.error) return '<div class="empty">' + esc(UNIT.error) + "</div>";
    const U = UNIT;
    let h = '<div class="h2"><div><h1>TRAINING</h1><p>Sign up for sessions with an FTO and take knowledge checks.</p></div>' + (U.canTrain ? '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-newsess>+ SESSION</button><button class="btn ghost" data-newcheck>+ KNOWLEDGE CHECK</button></div>' : "") + "</div>";
    h += '<div class="sect"><span class="lbl">Upcoming sessions · ' + (U.sessions || []).length + "</span></div>";
    h += (U.sessions || []).length ? '<div class="cards">' + U.sessions.map(x => '<div class="card"><div class="bd"><span class="rk ' + (x.mine ? "" : x.full ? "no" : "lo") + '" style="position:static;justify-self:start">' + (x.mine ? "✓ YOU'RE IN" : x.full ? "FULL" : "OPEN") + '</span><b class="bt">' + esc(x.topic) + "</b><dl class=\"kv\"><dt>When</dt><dd>" + esc(dt(x.when)) + "</dd><dt>Host</dt><dd>" + esc(x.host) + "</dd><dt>Spots</dt><dd>" + x.signups.length + (x.slots ? " / " + x.slots : "") + "</dd></dl>" +
      (x.details ? '<p class="bdx">' + esc(x.details) + "</p>" : "") + (x.canManage && x.signups.length ? '<small class="bm">' + x.signups.map(y => esc(y.n)).join(" · ") + "</small>" : "") +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (x.mine ? '<button class="btn ghost" data-join="' + esc(x.id) + '" data-leave="1">LEAVE</button>' : x.full ? "" : '<button class="btn" data-join="' + esc(x.id) + '">SIGN UP</button>') + (x.canManage ? '<button class="btn ghost" data-sclose="' + esc(x.id) + '">CLOSE</button>' : "") + "</div></div></div>").join("") + "</div>" : '<div class="empty">No sessions scheduled.' + (U.canTrain ? " Post one with + SESSION." : "") + "</div>";
    h += '<div class="sect"><span class="lbl">Knowledge checks · ' + (U.checks || []).length + "</span></div>";
    h += (U.checks || []).length ? '<div class="cards">' + U.checks.map(c => '<div class="card"><div class="bd"><span class="rk ' + (c.best && c.best.passed ? "" : "lo") + '" style="position:static;justify-self:start">' + (c.best ? (c.best.passed ? "✓ PASSED " : "LAST ") + c.best.score + "/" + c.best.of : "NOT TAKEN") + '</span><b class="bt">' + esc(c.title) + '</b><small class="bm">' + c.questions.length + " questions · pass at " + c.pass + "% · by " + esc(c.by) + (c.takers != null ? " · " + c.takers + " attempts, " + c.passedN + " passed" : "") + "</small>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-take="' + esc(c.id) + '">' + (c.best ? "RETAKE" : "START") + "</button>" + (U.canTrain ? '<button class="btn ghost" data-cclose="' + esc(c.id) + '">CLOSE</button>' : "") + "</div></div></div>").join("") + "</div>" : '<div class="empty">No knowledge checks right now.</div>';
    return h;
  }
  function takeCheck(c) {
    const m = modal("<h3>" + esc(c.title) + '</h3><form id="qz">' + c.questions.map((q, i) => '<fieldset class="qq"><legend>' + (i + 1) + ". " + esc(q.q) + "</legend>" + q.options.map((o, j) => '<label class="qo"><input type="radio" name="q' + i + '" value="' + j + '"> ' + esc(o) + "</label>").join("") + "</fieldset>").join("") +
      '<div class="md-act"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn" type="submit">SUBMIT</button></div></form>');
    m.querySelector("#qz").onsubmit = async ev => { ev.preventDefault();
      const ans = c.questions.map((q, i) => { const x = m.querySelector('input[name="q' + i + '"]:checked'); return x ? +x.value : -1; });
      if (ans.some(a => a < 0)) { toast("Answer every question."); return; }
      const r = await unit("unitCheckTake", { id: c.id, answers: ans });
      if (r.ok && r.result) { m.hidden = false; const R = r.result; modal('<h3>' + (R.passed ? "✓ Passed" : "Not quite") + '</h3><p class="qscore">' + R.score + " / " + R.of + "</p>" + c.questions.map((q, i) => '<div class="qr ' + (ans[i] === R.correct[i] ? "ok" : "no") + '"><b>' + (i + 1) + ". " + esc(q.q) + "</b><small>" + (ans[i] === R.correct[i] ? "✓ " : "✗ Your answer: " + esc(q.options[ans[i]]) + " · Correct: ") + esc(q.options[R.correct[i]]) + "</small></div>").join("") + '<div class="md-act"><button class="btn" data-close>Done</button></div>'); }
    };
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
    if (e.target.closest("[data-kudo]")) { const m = modal('<h3>👏 Give kudos</h3><label>Officer<select id="kTo"><option value="">Pick from the roster…</option>' + peopleOpts() + '</select></label><label>What did they do?<textarea id="kMsg" rows="4" maxlength="300" placeholder="Great pursuit call-outs on Route 68 last night."></textarea></label>' + (UNIT.dm ? '<p class="md-note">They also get a Discord DM.</p>' : "") + '<div class="md-act"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="kGo">SEND</button></div>');
      m.querySelector("#kGo").onclick = async () => { const r = await unit("unitKudos", { to: m.querySelector("#kTo").value, msg: m.querySelector("#kMsg").value }, "Kudos sent 👏"); if (r.ok) m.hidden = true; }; return; }
    if (e.target.closest("[data-award]")) { const m = modal('<h3>🎖️ Award</h3><div class="seg" id="aType"><button type="button" class="on" data-t="ribbon">RIBBON</button><button type="button" data-t="ootm">OFFICER OF THE MONTH</button></div><label>Officer<select id="aTo"><option value="">Pick from the roster…</option>' + peopleOpts() + '</select></label><label id="aTL">Ribbon name<input id="aTitle" maxlength="60" placeholder="Distinguished Service"></label><label id="aEL">Emoji<input id="aEmoji" maxlength="4" value="🎖️"></label><label>Note (optional)<textarea id="aNote" rows="3" maxlength="300"></textarea></label><div class="md-act"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="aGo">AWARD</button></div>');
      let type = "ribbon"; m.querySelector("#aType").onclick = ev => { const b = ev.target.closest("[data-t]"); if (!b) return; type = b.dataset.t; m.querySelectorAll("#aType button").forEach(x => x.classList.toggle("on", x === b)); m.querySelector("#aTL").hidden = m.querySelector("#aEL").hidden = type === "ootm"; };
      m.querySelector("#aGo").onclick = async () => { const r = await unit("unitAward", { type: type, to: m.querySelector("#aTo").value, title: m.querySelector("#aTitle").value, emoji: m.querySelector("#aEmoji").value, note: m.querySelector("#aNote").value }, "Awarded 🎖️"); if (r.ok) m.hidden = true; }; return; }
    if (e.target.closest("[data-newsess]")) { const m = modal('<h3>Post a training session</h3><label>Training<input id="sTopic" maxlength="120" placeholder="Felony stops & radio procedure"></label><label>When<input id="sWhen" type="datetime-local"></label><label>Spots (0 = no limit)<input id="sSlots" type="number" min="0" max="50" value="4"></label><label>Details (optional)<textarea id="sDet" rows="3" maxlength="600" placeholder="Meet at Mission Row garage."></textarea></label><div class="md-act"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="sGo">POST</button></div>');
      m.querySelector("#sGo").onclick = async () => { const w = m.querySelector("#sWhen").value; const r = await unit("unitSession", { topic: m.querySelector("#sTopic").value, when: w ? new Date(w).toISOString() : "", slots: m.querySelector("#sSlots").value, details: m.querySelector("#sDet").value }, "Session posted."); if (r.ok) m.hidden = true; }; return; }
    if (e.target.closest("[data-newcheck]")) { const m = modal('<h3>New knowledge check</h3><label>Title<input id="cTitle" maxlength="100" placeholder="10-codes basics"></label><label>Pass mark (%)<input id="cPass" type="number" min="1" max="100" value="80"></label><label>Questions<textarea id="cQs" rows="10" placeholder="One question per block, blank line between blocks. Mark the right answer with *.&#10;&#10;What does 10-8 mean?&#10;*In service&#10;Out of service&#10;Busy&#10;&#10;Which code is officer down?&#10;10-4&#10;*10-99"></textarea></label><div class="md-act"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="cGo">SAVE</button></div>');
      m.querySelector("#cGo").onclick = async () => { const qs = m.querySelector("#cQs").value.split(/\n\s*\n/).map(b => b.split("\n").map(x => x.trim()).filter(Boolean)).filter(b => b.length >= 3).map(b => { const opts = b.slice(1); const a = opts.findIndex(o => o.charAt(0) === "*"); return { q: b[0], options: opts.map(o => o.replace(/^\*\s*/, "")), answer: Math.max(0, a) }; });
        const r = await unit("unitCheckSave", { title: m.querySelector("#cTitle").value, pass: m.querySelector("#cPass").value, questions: qs }, "Knowledge check saved."); if (r.ok) m.hidden = true; }; return; }
    const jn = e.target.closest("[data-join]"); if (jn) { unit("unitJoin", { id: jn.getAttribute("data-join"), leave: !!jn.getAttribute("data-leave") }, jn.getAttribute("data-leave") ? "You left the session." : "You're signed up."); return; }
    const sc = e.target.closest("[data-sclose]"); if (sc) { unit("unitSessionClose", { id: sc.getAttribute("data-sclose") }, "Session closed."); return; }
    const tk = e.target.closest("[data-take]"); if (tk) { takeCheck(UNIT.checks.find(c => c.id === tk.getAttribute("data-take"))); return; }
    const cc = e.target.closest("[data-cclose]"); if (cc) { unit("unitCheckClose", { id: cc.getAttribute("data-cclose") }, "Check closed."); return; }
    const pc = e.target.closest("[data-pcat]"); if (pc) { REF_CAT = pc.getAttribute("data-pcat"); draw(); return; }
    if (e.target.closest("#palHero")) { openPal(); return; }
    const ak = e.target.closest("[data-ack]"); if (ak) { ak.disabled = true; Portal.post({ action: "mdtBriefAck", session: SESSION, id: ak.getAttribute("data-ack") }).then(r => { if (r.ok) { DATA.board.briefing.acked = true; if (DATA.board.briefing.ackCount != null) DATA.board.briefing.ackCount++; draw(); toast("Acknowledged. Have a safe shift."); } else { ak.disabled = false; toast(r.error || "Couldn't acknowledge."); } }); return; }
    if (e.target.closest("[data-past]")) { const P = (DATA.board.past || []); modal('<h3>Past briefings</h3>' + (P.length ? P.map(b => '<div class="pb"><b>' + esc(b.re) + "</b><small>" + esc(new Date(b.at).toLocaleDateString()) + " · " + esc(b.from) + "</small><p>" + esc(b.body).replace(/\n/g, "<br>") + "</p></div>").join("") : "<p>None yet.</p>") + '<div class="md-act"><button class="btn ghost" data-close>Close</button></div>'); return; }
    if (e.target.closest("[data-brief]")) {
      const m = modal('<h3>Post the shift briefing</h3><label>To<input id="bTo" value="All sworn personnel"></label><label>Subject (RE)<input id="bRe" maxlength="120" placeholder="Paleto patrol & report deadlines"></label><label>Briefing<textarea id="bBody" rows="7" maxlength="3000" placeholder="What every unit needs to know this shift…"></textarea></label><p class="md-note">Shows on every officer\'s MDT home. Officers tap Acknowledge for roll call, and you\'ll see how many have read it.</p><div class="md-act"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="bGo">POST BRIEFING</button></div>');
      m.querySelector("#bGo").onclick = async () => { const b = m.querySelector("#bGo"); b.disabled = true;
        const r = await Portal.post({ action: "mdtBriefPost", session: SESSION, to: m.querySelector("#bTo").value, re: m.querySelector("#bRe").value, body: m.querySelector("#bBody").value }).catch(() => ({ ok: false, error: "Couldn't reach the server." }));
        if (r.ok) { m.hidden = true; toast("Briefing posted."); load(); } else { b.disabled = false; toast(r.error || "Couldn't post."); } };
    }
  });

  // ---------- command palette: search everything ----------
  let PAL_SEL = 0, PAL_ITEMS = [];
  function palItems(q) {
    q = q.toLowerCase().trim();
    const out = [], add = (grp, icon, title, sub, run, extra) => { const hay = (title + " " + (sub || "") + " " + (extra || "")).toLowerCase(); if (!q || hay.indexOf(q) !== -1) out.push({ grp, icon, title, sub, run }); };
    [["home", "🏠", "Dashboard"], ["records", "🔎", "Records & BOLOs"], ["reference", "⚖️", "Penal code & 10-codes"], ["fleet", "🚓", "Fleet"], ["uniforms", "👕", "Uniforms"], ["training", "📅", "Training"], ["unit", "⭐", "Kudos & awards"], ["sop", "📘", "SOP"]].forEach(v => add("Go to", v[1], v[2], "", () => go(v[0])));
    add("Go to", "📋", "My reports", "", () => go("frame:myreports.html"));
    myForms().filter(f => f.status === "live").forEach(f => add("File a report", f.icon, f.title, f.division ? f.division + " report" : "", () => go("form:" + f.id), f.section));
    ((DATA && DATA.board && DATA.board.notices) || []).forEach(n => add("BOLOs", "🚨", n.title, n.type + " · " + n.from, () => go("records"), n.details));
    if (q.length >= 2) add("Records", "🗂️", "Search records for “" + q + "”", "People, vehicles and plates in every report", () => { go("records"); setTimeout(() => { const i = $("recQ"); if (i) { i.value = q; runSearch(q); } }, 50); });
    if (REF && q.length >= 2) {
      const opts = REF.charges ? REF.charges.options : REF.penal.map(x => x.raw);
      opts.filter(o => !/^#/.test(o) && o.toLowerCase().indexOf(q) !== -1).slice(0, 8).forEach(o => { const it = Portal.chargeItem(o); add("Charges", "⚖️", it.label, [it.cls, it.sub].filter(Boolean).join(" · "), () => copy(it.label, "Charge")); });
      REF.tenCodes.filter(x => (x[0] + " " + x[1]).toLowerCase().indexOf(q) !== -1).slice(0, 6).forEach(x => add("Radio codes", "📻", x[0] + " — " + x[1], "", () => copy(x[0], "Code")));
    }
    return out.slice(0, 40);
  }
  function drawPal() {
    PAL_ITEMS = palItems($("palQ").value); PAL_SEL = Math.min(PAL_SEL, Math.max(0, PAL_ITEMS.length - 1));
    let h = "", g = "";
    PAL_ITEMS.forEach((it, i) => { if (it.grp !== g) { g = it.grp; h += '<div class="ph2">' + esc(g) + "</div>"; } h += '<button data-pi="' + i + '" class="' + (i === PAL_SEL ? "on" : "") + '"><span class="pi">' + esc(it.icon) + "</span><div><b>" + esc(it.title) + "</b>" + (it.sub ? "<small>" + esc(it.sub) + "</small>" : "") + "</div>" + (i === PAL_SEL ? '<span class="px">↵</span>' : "") + "</button>"; });
    $("palList").innerHTML = h || '<p style="padding:14px;color:var(--mute)">Nothing found.</p>';
    const on = $("palList").querySelector("button.on"); if (on) on.scrollIntoView({ block: "nearest" });
  }
  function openPal() { $("pal").hidden = false; $("palQ").value = ""; PAL_SEL = 0; $("palQ").focus(); drawPal(); if (!REF) loadRef(); }
  function closePal() { $("pal").hidden = true; }
  function runPal(i) { const it = PAL_ITEMS[i]; if (!it) return; closePal(); it.run(); }
  $("openPal").onclick = openPal;
  $("pal").onclick = e => { if (e.target === $("pal")) closePal(); const b = e.target.closest("[data-pi]"); if (b) runPal(+b.dataset.pi); };
  $("palQ").addEventListener("input", () => { PAL_SEL = 0; drawPal(); });
  $("palQ").addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { PAL_SEL = Math.min(PAL_ITEMS.length - 1, PAL_SEL + 1); drawPal(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { PAL_SEL = Math.max(0, PAL_SEL - 1); drawPal(); e.preventDefault(); }
    else if (e.key === "Enter") { runPal(PAL_SEL); e.preventDefault(); }
    else if (e.key === "Escape") { closePal(); e.preventDefault(); }
  });
  addEventListener("keydown", e => {
    const typing = /input|textarea|select/i.test((e.target.tagName || "")) || e.target.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("pal").hidden ? openPal() : closePal(); }
    else if (e.key === "/" && !typing && $("pal").hidden && $("modal").hidden && !document.querySelector(".lk")) { e.preventDefault(); openPal(); }
    else if (e.key === "Escape" && !$("pal").hidden) closePal();
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
  VIEW = okView(decodeURIComponent(location.hash.slice(1))) ? decodeURIComponent(location.hash.slice(1)) : "home";
  draw(); load(); loadUnit();
  setInterval(() => { if (!document.hidden) load(); }, 3 * 60e3);
  document.addEventListener("submit", e => { if (e.target.id === "recForm") { e.preventDefault(); const q = $("recQ").value.trim(); if (q.length >= 2) runSearch(q); else toast("Type at least 2 characters."); } });
  document.addEventListener("input", e => { if (e.target.id === "refQ") { REF_Q = e.target.value; const pos = e.target.selectionStart; draw(); const n = $("refQ"); n.focus(); n.setSelectionRange(pos, pos); } });
  addEventListener("keydown", e => { if (e.key && e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey && !e.altKey && !/input|textarea|select/i.test((e.target.tagName || "")) && $("modal").hidden && !document.querySelector(".lk")) go("reports"); });
})();
