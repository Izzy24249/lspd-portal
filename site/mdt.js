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

  let DATA = LS.json("mdt:home"), VIEW = "home", SNAP_FORMS = null, FLEET_ALL = LS.get("mdt:fleetAll") === "1", UNI_ALL = LS.get("mdt:uniAll") === "1", SEX = LS.get("mdt:sex") || "male";
  const SHOW_FEMALE = false;   // female uniforms are hidden from officers until command posts them; set to true to show the MALE/FEMALE switch
  if (!SHOW_FEMALE) SEX = "male";
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
  const last = n => String(n || "").replace(/([a-z'])R[MA]\b/g, "$1").trim().split(/\s+/).pop();
  function who(p) { return p ? ((p.title || "Officer") + " " + last(p.name)) : "Officer"; }
  function drawStrip() {
    const p = (DATA && DATA.profile) || LS.json("lspd_prof") || {};
    $("uCs").textContent = p.callsign || "----"; $("uName").textContent = who(p);
    $("uRank").textContent = (DATA && DATA.fleet && DATA.fleet.rank && (DATA.fleet.rank.known || DATA.fleet.rank.trainee)) ? DATA.fleet.rank.name : (p.level || "");
    const sop = (DATA && DATA.sop) || "https://docs.google.com/document/d/1t4vHCiHS3xH2VTfDgOKRX3L7BeZyh8YrCLaC_bZTJqw/edit?tab=t.0"; $("sopLink").href = "#sop";
    const nt = UNIT && UNIT.sessions ? UNIT.sessions.filter(x => !x.mine && !x.full).length + (UNIT.checks || []).filter(c => !c.best).length : 0; $("nTrain").textContent = nt || "";
    document.querySelectorAll("[data-need-command]").forEach(a => a.hidden = !isCommand());
    $("adminBtn").hidden = ["admin", "owner"].indexOf(p.level) === -1;   // portal admin: admins and the owner only
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
  // the CID Case File always opens in the CID case builder (cid.html)
  function myForms() { return ((DATA && DATA.forms) || SNAP_FORMS || []).map(f => f.id === "cidcase" && !f.cid ? Object.assign({}, f, { cid: true }) : f); }
  // first visit on this device: list the reports straight away from the site's own copy of the forms (data/portal.json)
  // and the officer's sign-on profile; the live list from the server replaces it a moment later
  function snapForms() {
    fetch("data/portal.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).then(sn => {
      if (DATA || !sn || !sn.config) return;
      const pr = LS.json("lspd_prof") || {}, L = ["trainee", "officer", "fto", "leader", "command", "admin", "owner"], lv = L.indexOf(pr.level || "officer");
      SNAP_FORMS = (sn.config.forms || []).filter(f => (f.status === "live" || f.status === "soon") && !(f.minLevel && lv < L.indexOf(f.minLevel)) &&
        !((f.accessTabs || []).length && lv < L.indexOf("command") && (pr.forms || []).indexOf(f.id) === -1))
        .map(f => ({ id: f.id, title: f.title, icon: f.icon || "📄", status: f.status, section: f.section || "", desc: String(f.desc || f.subtitle || "").slice(0, 140), cid: !!f.cidApp, division: (f.accessTabs || []).map(t => t.name).join(", ") }));
      drawFormsNav(); if (/^form:/.test(VIEW)) draw();
    }).catch(() => {});
  }
  // one report window, loaded in the background as soon as the terminal opens and kept open:
  // switching reports only changes which form it shows, so reports open instantly
  let FH_READY = false, FH_WANT = "";
  function formHost() {
    let h = $("fhost"); if (h.__made) return h; h.__made = 1;
    h.innerHTML = '<div class="formview"><div class="fv-bar" id="fhBar"></div><div class="fv-frame"><div class="fv-load boot" id="fhLoad"><i></i>LOADING REPORT…</div><iframe id="fhFrame" title="Report" src="forms.html?embed=1"></iframe></div></div>';
    $("fhFrame").addEventListener("load", () => { FH_READY = true; if (FH_WANT) showForm(FH_WANT); });
    return h;
  }
  function showForm(id) {
    FH_WANT = id; formHost();
    if (!FH_READY) { $("fhLoad").style.opacity = 1; return; }
    try { const w = $("fhFrame").contentWindow; if (w.location.hash.slice(1) !== id) w.location.hash = id; } catch (e) { $("fhFrame").src = "forms.html?embed=1#" + id; }
    setTimeout(() => { $("fhLoad").style.opacity = 0; }, 120);
  }
  function drawFormsNav() {
    const box = $("formsNav"); if (!DATA && !SNAP_FORMS) return;
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
  const VIEWS = ["home", "fleet", "uniforms", "records", "reference", "unit", "training", "reports", "sop", "promotions", "tracker"];
  const TITLES = { home: ["TERMINAL", "Dashboard"], fleet: ["DEPARTMENT", "Fleet"], uniforms: ["DEPARTMENT", "Uniforms"], records: ["TERMINAL", "Records & BOLOs"], reference: ["TERMINAL", "Penal code"], unit: ["DEPARTMENT", "Kudos & awards"], training: ["DEPARTMENT", "Training"], reports: ["REPORTS", "File a report"], sop: ["DEPARTMENT", "Standard Operating Procedures"], promotions: ["DEPARTMENT", "Promotions"], tracker: ["DEPARTMENT", "Promotion tracker"] };
  const okView = v => VIEWS.indexOf(v) >= 0 || /^form:[\w-]+$/.test(v) || /^frame:[\w.-]+\.html$/.test(v);
  function go(v) { VIEW = okView(v) ? v : "home"; if (decodeURIComponent(location.hash.slice(1)) !== VIEW) history.replaceState(null, "", "#" + VIEW); side.classList.remove("open"); draw(); window.scrollTo(0, 0); blip(); }
  document.addEventListener("click", e => { const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); go(a.getAttribute("data-go")); } });
  addEventListener("hashchange", () => { const h = decodeURIComponent(location.hash.slice(1)); if (h !== VIEW) go(h); });

  function drawTicker() {
    const t = $("ticker"), list = (DATA && DATA.board && DATA.board.dept && DATA.board.dept.ticker) || [];
    if (!list.length) { t.hidden = true; return; }
    t.hidden = false; t.innerHTML = '<div class="live"><i></i>LIVE</div><div class="tk-run">' + list.concat(list).map(x => "<span>" + esc(x.t) + " · " + ago(x.at) + "</span>").join("") + "</div>";
  }
  function modal(html) { const m = $("modal"); m.classList.remove("cc"); m.innerHTML = '<div class="md-box">' + html + "</div>"; m.hidden = false; m.onclick = e => { if (e.target === m || e.target.closest("[data-close]")) m.hidden = true; }; return m; }
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
    if (VIEW.indexOf("frame:") === 0) { const a = document.querySelector('[data-frame="' + VIEW.slice(6) + '"]'); t = [VIEW === "frame:division.html" ? "COMMAND" : "TERMINAL", a ? a.getAttribute("data-title") : "Page"]; }
    $("crumbSec").textContent = t[0]; $("crumbTitle").textContent = t[1]; document.title = t[1] + " · LSPD MDT";
    m.classList.toggle("flush", framed);
    const inHost = VIEW.indexOf("form:") === 0 && myForms().some(x => x.id === VIEW.slice(5) && !x.cid);
    $("fhost").hidden = !inHost; m.hidden = inHost;
    if (inHost) {
      const f = myForms().find(x => x.id === VIEW.slice(5)); m.__view = "";
      formHost(); $("fhBar").innerHTML = '<span class="fi">' + esc(f.icon) + "</span><div><b>" + esc(f.title) + "</b><small>" + esc(f.division ? f.division + " report" : (f.desc || "Filed straight to Discord and Division Command")) + '</small></div><span class="sp"></span><a class="btn ghost" href="forms.html#' + esc(f.id) + '" target="_blank" rel="noopener" title="Open in its own tab">↗ <span class="only-d">FULL PAGE</span></a>';
      showForm(f.id); $("ticker").hidden = true; return;
    }
    if (!DATA && !framed) { m.innerHTML = '<div class="boot"><i></i>ESTABLISHING LINK…</div>'; return; }
    if (framed) {
      if (!DATA && VIEW.indexOf("form:") === 0) { m.innerHTML = '<div class="boot"><i></i>ESTABLISHING LINK…</div>'; return; }
      if (m.__view === VIEW) return;                                   // keep the report open (and typed text) through background refreshes
      m.__view = VIEW;
      if (VIEW.indexOf("form:") === 0) {
        const f = myForms().find(x => x.id === VIEW.slice(5));
        if (!f) { m.__view = ""; m.innerHTML = '<div class="main-in"><div class="empty">That report isn\'t available to you.</div></div>'; return; }
        m.innerHTML = frameHTML(f.cid ? "cid.html?embed=1" : "forms.html?embed=1#" + f.id, f.icon, f.title, f.division ? f.division + " report" : (f.desc || "Filed straight to Discord and Division Command"));
        if (f.cid) { const bar = m.querySelector(".fv-bar"); if (bar) bar.remove(); }   // the case builder has its own header
      } else if (VIEW === "sop") m.innerHTML = frameHTML(sopEmbed(sopUrl()), "📘", "LSPD SOP", "Policy, radio, pursuits, use of force", sopUrl());
      else if (VIEW === "frame:division.html") {
        const dv = ((DATA && DATA.profile) || LS.json("lspd_prof") || {}).divisions || [];
        m.innerHTML = frameHTML("division.html?embed=1", "🛡️", "Division Command", dv.length ? "Grading, activity and officers · " + dv.length + " division" + (dv.length === 1 ? "" : "s") : "Grading, activity and officers");
      }
      else m.innerHTML = frameHTML(VIEW.slice(6) + "?embed=1", "📋", t[1], "Your filed reports and their grades");
      $("ticker").hidden = true; return;
    }
    m.__view = "";
    m.innerHTML = '<div class="view">' + (VIEW === "fleet" ? fleetHTML() : VIEW === "uniforms" ? uniformsHTML() : VIEW === "records" ? recordsHTML() : VIEW === "reference" ? refHTML() : VIEW === "promotions" ? promoHTML() : VIEW === "tracker" ? trackHTML() : VIEW === "unit" ? unitHTML() : VIEW === "training" ? trainHTML() : VIEW === "reports" ? reportsHTML() : homeHTML()) + "</div>";
    if ((VIEW === "unit" || VIEW === "training") && !UNIT) loadUnit();
    if (VIEW === "reference" && !REF) loadRef();
    m.querySelectorAll("[data-count]").forEach(el => { const to = +el.dataset.count || 0, t0 = performance.now(); const step = now => { const k = Math.min(1, (now - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
    if (VIEW === "records") { const q = $("recQ"); if (q && !matchMedia("(max-width:760px)").matches) q.focus(); }
    drawTicker();
  }

  // ---------- home ----------
  // the division race, from this officer's side (their division's place and their own points this week)
  function raceCardHTML() {
    const R = DATA && DATA.race; if (!R || !((R.divisions || []).length || (R.standings || []).length)) return "";
    const end = R.weekEnd ? new Date(R.weekEnd) : null;
    return '<section class="race"><div class="race-head"><span class="race-k">🏁 DIVISION RACE</span>' + (end ? '<span class="race-clock" data-raceend="' + R.weekEnd + '">closes ' + end.toLocaleDateString(undefined, { weekday: "short" }) + " " + end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + "</span>" : "") + "</div>" +
      (R.divisions.length ? "" : '<p class="race-none">Every report you file counts for your division. Here are this week\'s standings:</p>') +
      R.divisions.map(d => { const gap = d.ahead ? d.ahead.points - d.points : 0, need = gap ? Math.max(1, Math.ceil((gap + 1) / 10)) : 0;
        const line = d.rank === 1 ? (d.points ? "Your division is leading the race." : "The race just started. First report takes the lead.")
          : d.ahead ? gap ? gap + " pts behind " + esc(d.ahead.name) + " · about " + need + " more report" + (need === 1 ? "" : "s") + " to pass them." : "Tied with " + esc(d.ahead.name) + ". One report breaks it." : "";
        return '<div class="race-row" style="--c:' + esc(d.color) + '"><div class="race-pos">' + (d.rank === 1 && d.points ? "👑" : "#" + d.rank) + '</div><div class="race-txt"><b>' + esc(d.name) + ' <em>' + d.points + " pts</em>" + (d.streak >= 3 ? ' <span class="race-fire" title="Reports ' + d.streak + ' days in a row">🔥 ' + d.streak + "</span>" : "") + "</b><small>" + line + "</small></div>" +
          '<div class="race-me">' + (d.my ? "<b>+" + d.my.pts + "</b><small>you · " + d.my.reports + " report" + (d.my.reports === 1 ? "" : "s") + "</small>" : "<b>0</b><small>you this week</small>") + "</div></div>"; }).join("") +
      '<div class="race-foot">' + (R.standings || []).map((x, i) => '<span style="--c:' + esc(x.color) + '">' + (i + 1) + ". " + esc(x.name) + " <b>" + x.points + "</b></span>").join("") + (R.improved ? '<span class="race-imp">📈 Most improved: ' + esc(R.improved) + "</span>" : "") + "</div></section>";
  }
  setInterval(() => { document.querySelectorAll("[data-raceend]").forEach(el => { const ms = Number(el.dataset.raceend) - Date.now(); if (ms <= 0) { el.textContent = "race closed"; return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4); el.textContent = "closes in " + (d ? d + "d " : "") + h + "h " + m + "m"; el.classList.toggle("soon", ms < 864e5); }); }, 1000);
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
  // ---------- on duty now: read from the On Duty role in the LSPD Discord (checked every 15 minutes) ----------
  function durTxt(min) { const hh = Math.floor(min / 60), mm = min % 60; return hh ? hh + "h" + (mm ? " " + mm + "m" : "") : mm + "m"; }
  function dutyHTML() {
    const du = DATA.duty; if (!du) return "";
    const L = du.list || []; let h = "";
    if (!du.linked) h += '<div class="duty-link"><span>🛰️</span><div><b>Connect Discord for automatic duty hours</b><small>One time only. Your on-duty time is counted from the On Duty role in the LSPD Discord, so you never have to clock in here. You\'ll confirm with Discord, then enter your PIN.</small></div><button class="btn" data-duty-link type="button">CONNECT</button></div>';
    const sups = L.filter(o => o.sup);
    h += '<section class="pane duty"><div class="ph"><span class="lbl">On duty now · ' + L.length + "</span>" + (du.me ? '<span class="duty-me">● YOU\'RE ON DUTY</span>' : "") + "</div>" +
      (L.length ? '<div class="duty-sup ' + (sups.length ? "ok" : "no") + '">' + (sups.length ? "★ Supervisor on duty: <b>" + sups.map(o => esc((o.callsign ? o.callsign + " " : "") + (o.rank ? o.rank + " " : "") + last(o.name))).join("</b>, <b>") + "</b>"
        : "No supervisor (Sergeant or above) on duty right now") + "</div>" : "") +
      (L.length ? '<div class="duty-list">' + L.map(o => '<div class="need' + (o.sup ? " sup" : "") + '"><span class="cs">' + esc(o.callsign || "—") + "</span><div><b>" + esc(o.name || "Officer") + "</b><small>" + esc(o.rank ? o.rank + " · " : "") + "on for " + durTxt(o.minutes) + "</small></div></div>").join("") + "</div>"
        : '<p style="color:var(--mute);margin:0">Nobody is on duty right now.</p>') +
      '<p class="duty-note">From the On Duty role in Discord' + (du.checkedAt ? " · checked " + (ago(du.checkedAt) === "now" ? "just now" : ago(du.checkedAt) + " ago") : " · first check within " + (du.every || 15) + " minutes") + "</p></section>";
    const M = du.linked && du.mine;
    if (M) {
      const pct = Math.min(100, Math.round(M.window / Math.max(1, M.goalMinutes) * 100)), left = Math.max(0, M.goalMinutes - M.window);
      h += '<section class="pane shift"><div class="ph"><span class="lbl">Your duty time</span></div><div class="shift-grid">' +
        "<div><small>" + (du.me ? "This shift so far" : "Last shift") + "</small><b>" + (du.me ? durTxt(M.live) : M.last ? durTxt(M.last.minutes) : "—") + "</b><em>" +
          (du.me ? "since " + new Date(Date.now() - M.live * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : M.last ? new Date(M.last.start).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "no shifts logged yet") + "</em></div>" +
        "<div><small>This week</small><b>" + durTxt(M.week) + "</b><em>" + (du.me ? "including this shift" : "&nbsp;") + "</em></div>" +
        "<div><small>Last " + M.goalDays + " days</small><b>" + durTxt(M.window) + " / " + durTxt(M.goalMinutes) + "</b><em>" + (left ? durTxt(left) + " to go" : "✓ minimum met") + "</em></div></div>" +
        '<div class="shift-bar' + (left ? "" : " ok") + '"><i style="width:' + pct + '%"></i></div></section>';
    }
    return h;
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
    h += raceCardHTML();
    h += dutyHTML();
    // a leader recognized this officer in the last 3 days
    { const me = (p && p.discordId) || ""; const kd = UNIT && (UNIT.kudos || []).find(k => k.toId === me && Date.now() - k.at < 3 * 864e5);
      if (kd) h += '<a class="kudo-ban" data-go="unit"><span>👏</span><div><small>YOU WERE RECOGNIZED</small><b>' + esc(kd.from) + "</b><p>“" + esc(kd.msg) + "”</p></div></a>"; }
    if (UNIT && UNIT.ootm) h += '<a class="ootm mini" data-go="unit"><span>🏆</span><div><small>' + esc(UNIT.ootm.title) + "</small><b>" + esc(UNIT.ootm.to) + "</b></div></a>";
    if (UNIT && (UNIT.ribbons || []).length) h += '<div class="ribbons" style="margin:-8px 0 16px">' + UNIT.ribbons.map(r => '<span title="' + esc(r.title) + '"><i>' + esc(r.emoji) + "</i>" + esc(r.title) + "</span>").join("") + "</div>";
    const NB = B.notices || [];
    if (NB.length) h += '<section class="bolos">' + NB.slice(0, 3).map(n => '<a class="bolo t-' + esc(n.type.toLowerCase()) + '" data-go="records"><b>' + esc(n.type.toUpperCase()) + "</b><span>" + esc(n.title) + "</span><small>" + esc(n.from) + " · " + ago(n.at) + " ago</small></a>").join("") + (NB.length > 3 ? '<a class="bolo more" data-go="records">+' + (NB.length - 3) + " more</a>" : "") + "</section>";
    // briefing | path
    h += '<div class="grid"><section class="pane"><div class="ph"><span class="lbl">Shift briefing</span>' + (B.canBrief ? '<a data-brief>Post briefing</a>' : (B.past || []).length ? '<a data-past>Past briefings</a>' : "") + "</div>" + memoHTML(B.briefing, B) + "</section>";
    if ((DATA.paths || []).length) h += pathHTML(DATA.paths[0]);
    else h += '<section class="pane"><div class="ph"><span class="lbl">Standard Operating Procedures</span></div><div class="sop"><svg viewBox="0 0 24 24"><use href="#i-book"/></svg><div><b>LSPD SOP</b><small>Policy, radio, pursuits, use of force. Keep it handy.</small></div><a class="btn" data-go="sop" href="#sop">OPEN</a></div>' +
      '<div class="tiles" style="grid-template-columns:1fr 1fr">' + tile("reference", "i-gavel", "Penal code", "Charges, sentences and fines") + tile("training", "i-cal", "Training", "Sessions and knowledge checks") + "</div></section>";
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
    else h += '<section class="pane"><div class="ph"><span class="lbl">Your gear</span></div><div class="tiles" style="grid-template-columns:1fr;margin-top:0">' + tile("fleet", "i-car", "Fleet", (f.vehicles || []).filter(v => v.allowed).length + " vehicles approved for you") + tile("uniforms", "i-shirt", "Uniforms", ((f.uniforms || {})[SEX] || []).filter(u => u.yours).length + " outfits for your rank") + "</div></section>";
    h += "</div>";
    if ((p.divisions || []).length) h += '<div class="tiles"><a class="tile" href="division.html" data-frame="division.html"><svg><use href="#i-shield"/></svg><b>Division Command</b><small>Your divisions: activity, grading and officers</small></a></div>';
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
  let REF_CAT = "", REF_CLS = "", REF_TAB = "charges", PEN = {};
  const lawOf = it => (window.LSPD_LAW || {})[String(it.label).toLowerCase().trim()] || null;
  const penParts = it => { const sub = it.sub || ""; return { tm: (sub.split(" · ").find(x => /month/.test(x))) || "", fn: ((sub.split(" · ").find(x => /fine/.test(x))) || "").replace(" fine", "") }; };
  // charge detail card
  function chargeCard(key) {
    const e = PEN[key]; if (!e) return; const it = e.it, g = e.g, law = lawOf(it), pp = penParts(it);
    const rel = g.items.filter(x => x.label !== it.label).sort((a, b) => (b.cls === it.cls) - (a.cls === it.cls)).slice(0, 4);
    modal('<div class="cc-kick"><span>' + esc(g.icon) + " " + esc(g.name) + '</span><button class="ibtn" data-close aria-label="Close">✕</button></div>' +
      '<h3 class="cc-title">' + esc(it.label) + "</h3>" +
      '<div class="cc-stats"><div class="k-' + esc(it.cls || "") + '"><small>Class</small><b><i></i>' + esc(CLS_NAME[it.cls] || "—") + "</b></div><div><small>Jail time</small><b>" + esc(pp.tm || "None") + "</b></div><div><small>Fine</small><b class=\"fn\">" + esc(pp.fn || "None") + "</b></div></div>" +
      (law ? '<div class="cc-law"><div class="cc-code"><small>Based on</small><b>' + esc(law[0]) + "</b></div><p>" + esc(law[1]) + "</p></div>" : '<div class="cc-law"><p>No California code reference on file for this charge yet.</p></div>') +
      '<div class="cc-acts"><button class="btn" data-copy="' + esc(it.label) + '" data-what="Charge">COPY CHARGE</button>' + (law ? '<button class="btn ghost" data-copy="' + esc(it.label + " (" + law[0] + ")") + '" data-what="Charge with code">COPY WITH CODE</button>' : "") + "</div>" +
      (rel.length ? '<div class="cc-rel"><small>Related in ' + esc(g.name) + "</small>" + rel.map(x => '<button data-charge="' + esc(x.label) + '"><i class="k-' + esc(x.cls || "") + '"></i>' + esc(x.label) + "</button>").join("") + "</div>" : "") +
      '<p class="cc-note">Code references are the California law each charge is modeled on. Sentences and fines follow the LSPD charge list.</p>');
    $("modal").classList.add("cc"); blip();
  }
  const CLS_NAME = { felony: "Felony", misdemeanor: "Misdemeanor", infraction: "Infraction", citation: "Citation" };
  function refHTML() {
    let h = '<div class="pen-top"><div><h1>Penal Code</h1><p>Tap any charge for its details and the California law it\'s based on.</p></div></div>';
    if (!REF) return h + '<div class="boot"><i></i>LOADING PENAL CODE…</div>';
    const opts = REF.charges ? REF.charges.options : REF.penal.map(x => x.raw);
    const groups = (window.Portal && Portal.chargeGroups ? Portal.chargeGroups(opts) : [{ name: "Charges", icon: "⚖️", items: opts }])
      .map(g => ({ name: g.name, icon: g.icon, items: g.items.map(o => Portal.chargeItem ? Portal.chargeItem(o) : { label: o, value: o, search: String(o).toLowerCase() }) }));
    const q = REF_Q.toLowerCase().trim();
    const match = it => (!q || (it.search || it.label.toLowerCase()).indexOf(q) !== -1) && (!REF_CLS || it.cls === REF_CLS);
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    const C = REF.tenCodes.filter(x => !q || (x[0] + " " + x[1]).toLowerCase().indexOf(q) !== -1);
    const classes = Object.keys(CLS_NAME).filter(c => groups.some(g => g.items.some(i => i.cls === c)));
    // toolbar: search · charges / radio codes · class filter
    h += '<div class="pen-bar"><label class="pen-search"><svg><use href="#i-search"/></svg><input id="refQ" placeholder="Search ' + total + ' charges and ' + REF.tenCodes.length + ' radio codes…" value="' + esc(REF_Q) + '" autocomplete="off">' + (REF_Q ? '<button data-refclear title="Clear">✕</button>' : "") + "</label>" +
      '<div class="seg"><button data-rtab="charges" class="' + (REF_TAB === "charges" ? "on" : "") + '">Charges</button><button data-rtab="codes" class="' + (REF_TAB === "codes" ? "on" : "") + '">Radio codes' + (q ? " <em>" + C.length + "</em>" : "") + "</button></div></div>";
    if (REF_TAB === "codes") {
      return h + '<section class="pen-panel"><div class="codes">' + (C.length ? C.map(x => '<button data-copy="' + esc(x[0]) + '" data-what="Code"><b>' + esc(x[0]) + "</b><span>" + (q ? hl(x[1], REF_Q) : esc(x[1])) + "</span></button>").join("") : '<div class="empty">No radio code matches “' + esc(REF_Q) + "”.</div>") + "</div></section>";
    }
    if (classes.length) h += '<div class="pen-cls"><button data-pcls="" class="' + (REF_CLS ? "" : "on") + '">All classes</button>' + classes.map(c => '<button data-pcls="' + c + '" class="k-' + c + (REF_CLS === c ? " on" : "") + '"><i></i>' + CLS_NAME[c] + "</button>").join("") + "</div>";
    // left: categories · right: the list
    const counts = groups.map(g => g.items.filter(match).length), all = counts.reduce((a, b) => a + b, 0);
    h += '<div class="pen-wrap"><nav class="pen-rail"><button data-pcat="" class="' + (REF_CAT ? "" : "on") + '"><span class="ic">⚖️</span><span class="nm">All charges</span><em>' + all + "</em></button>" +
      groups.map((g, i) => '<button data-pcat="' + esc(g.name) + '" class="' + (REF_CAT === g.name ? "on" : "") + (counts[i] ? "" : " none") + '"><span class="ic">' + esc(g.icon) + '</span><span class="nm">' + esc(g.name) + "</span><em>" + counts[i] + "</em></button>").join("") + "</nav>";
    let body = "", any = 0;
    PEN = {}; groups.forEach(g => g.items.forEach(it => { PEN[it.label] = { it: it, g: g }; }));
    groups.forEach((g, i) => {
      if (REF_CAT && g.name !== REF_CAT) return;
      const items = g.items.filter(match); if (!items.length) return; any += items.length;
      body += '<div class="pen-sec"><div class="pen-sh"><span>' + esc(g.icon) + "</span>" + esc(g.name) + "<em>" + items.length + "</em></div>" +
        items.map(it => { const law = lawOf(it); return '<button class="pen-row" data-charge="' + esc(it.label) + '"><span class="nm">' + (q ? hl(it.label, REF_Q) : esc(it.label)) + (law ? "<small>" + esc(law[0]) + "</small>" : "") + "</span>" +
          (it.cls ? '<span class="cls k-' + esc(it.cls) + '">' + esc(CLS_NAME[it.cls] || it.cls) + "</span>" : '<span class="cls"></span>') +
          '<span class="tm">' + esc(((it.sub || "").split(" · ").find(x => /month/.test(x))) || "—") + '</span><span class="fn">' + esc((((it.sub || "").split(" · ").find(x => /fine/.test(x))) || "—").replace(" fine", "")) + "</span></button>"; }).join("") + "</div>";
    });
    if (!any) body = '<div class="empty">' + (opts.length ? "No charge matches" + (REF_Q ? " “" + esc(REF_Q) + "”" : "") + (REF_CLS ? " in " + CLS_NAME[REF_CLS] + "s" : "") + "." + (q && C.length ? ' <a href="#" data-rtab="codes">' + C.length + " radio code" + (C.length > 1 ? "s" : "") + " match.</a>" : "") : "No charge list found in the report forms yet.") + "</div>";
    else body = '<div class="pen-th"><span>Charge</span><span>Class</span><span>Time</span><span>Fine</span></div>' + body;
    return h + '<section class="pen-panel pen-main">' + body + "</section></div>";
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
  // ---------- promotions: every rank's requirements, from the LSPD Promotion Guidelines doc ----------
  // each rank's section is what an officer AT that rank needs for their next promotion
  let PROMO_OPEN = {};
  function promoReqs(r, marks) {
    const mk = (i) => { const m = marks && marks[i]; if (!m) return ""; return '<span class="pr-mark ' + (m.done ? "ok" : "") + '">' + (m.done ? "✓ " : "") +
      (m.auto === "tig" ? (m.have == null ? "No TIG date on roster" : m.have + " / " + m.need + " days") : m.auto === "reports" ? m.have + " / " + m.need + " reports" : m.auto === "sop" ? (m.done ? "SOP Certified role in Discord" : "Waiting for the SOP Certified role in Discord") : m.done ? "Signed off" + (m.by ? " by " + esc(m.by) : "") : "Waiting for command sign-off") + "</span>"; };
    return r.reqs.length ? '<ol class="pr-reqs">' + r.reqs.map((q, i) => '<li class="' + (marks && marks[i] && marks[i].done ? "ok" : "") + '"><b>' + esc(q.t) + (q.star ? ' <i class="pr-star" title="' + esc(r.note || "Time-limited") + '">✱</i>' : "") + "</b>" +
      (q.d ? "<small>" + q.d.split("\n").map(esc).join("<br>") + "</small>" : "") + mk(i) + "</li>").join("") + "</ol>" + (r.note ? '<p class="pr-note">✱ ' + esc(r.note) + "</p>" : "") : '<p class="pr-none">No requirements listed yet.</p>';
  }
  function promoHTML() {
    const L = DATA.ladder || {}, PM = DATA.promoMe, rk0 = (DATA.fleet || {}).rank || {};
    const rk = PM ? { idx: PM.idx, name: (L.ranks || []).concat([]).map(r => r).find(r => r.idx === PM.idx) ? (L.ranks.find(r => r.idx === PM.idx).name) : rk0.name, known: true, trainee: rk0.trainee } : rk0;
    const mine = rk.known || rk.trainee ? rk.idx : -1;
    const ranks = L.ranks || [];
    let h = '<div class="h2"><div><h1>PROMOTIONS <span>· ' + esc(mine >= 0 ? (rk.trainee ? "Probationary Officer" : rk.name) : "rank not on file") + "</span></h1><p>Every rank's requirements from the LSPD Promotion Guidelines. Meeting them opens the door; High Command makes the final call.</p></div>" +
      (L.doc ? '<a class="btn ghost" href="' + esc(L.doc) + '" target="_blank" rel="noopener">FULL GUIDELINES ↗</a>' : "") + "</div>";
    if (L.error) return h + '<div class="empty">' + esc(L.error) + "</div>";
    if (!ranks.length) return h + '<div class="empty">Promotion requirements aren\'t set up yet.</div>';
    const exempt = !!(PM && PM.exempt);
    if (exempt) h += '<section class="pr-next top"><div class="pr-kick">YOUR RANK</div><div class="pr-path"><b>' + esc(PM.rank || "Honorary Officer") + '</b></div><p class="pr-none">Honorary Officers are exempt from promotion requirements and training tracks. Thank you for your service in command.</p></section>';
    const me = exempt ? null : ranks.find(r => r.idx === mine), after = r => { const n = ranks.find(x => x.idx > r.idx); return n ? n.name : "High Command"; };
    if (me) {
      h += '<section class="pr-next"><div class="pr-kick">YOUR PROMOTION REQUIREMENTS' + (me.draft ? ' <span class="pr-draft">NOT FINAL YET</span>' : "") + '</div><div class="pr-path"><span>' + esc(me.label) + '</span><i>→</i><b>' + esc(after(me)) + "</b></div>" +
        (me.tig ? '<div class="pr-tig">⏱ ' + me.tig + " days time in grade required</div>" : "") +
        (DATA.promoMe && DATA.promoMe.idx === me.idx ? '<div class="pr-prog"><i style="width:' + Math.round(DATA.promoMe.items.filter(x => x.done).length / Math.max(1, DATA.promoMe.items.length) * 100) + '%"></i></div><div class="pr-progt">' + DATA.promoMe.items.filter(x => x.done).length + " of " + DATA.promoMe.items.length + " done" + (DATA.promoMe.ready ? " · <b>Ready for review by High Command</b>" : "") + "</div>" : "") +
        promoReqs(me, DATA.promoMe && DATA.promoMe.idx === me.idx ? DATA.promoMe.items : null) +
        ((DATA.paths || []).length ? '<a class="pr-track" data-go="home">Your tracked progress is on the dashboard →</a>' : "") + "</section>";
    } else if (exempt) { /* shown above */ } else if (mine >= 0) h += '<section class="pr-next top"><div class="pr-kick">YOUR RANK</div><div class="pr-path"><b>' + esc(rk.name) + '</b></div><p class="pr-none">The guidelines don\'t list requirements for your rank. Promotions from here are at High Command\'s discretion.</p></section>';
    else h += '<div class="pr-notes"><p>Your rank isn\'t in column B of the roster, so nothing is marked for you. Ask command to fix your roster entry.</p></div>';
    h += '<a class="pr-track" data-go="tracker" style="display:inline-block;margin:0 0 14px">See where everyone stands in the Promotion tracker →</a>';
    if ((L.notes || []).length) h += '<div class="pr-notes">' + L.notes.map(n => "<p>💬 " + esc(n) + "</p>").join("") + "</div>";
    let grp = null;
    h += '<div class="pr-ladder">' + ranks.map(r => {
      const st = mine < 0 ? "" : r.idx < mine ? "done" : r.idx === mine ? "here" : "ahead";
      const open = PROMO_OPEN[r.idx] != null ? PROMO_OPEN[r.idx] : false;
      const g = r.group && r.group !== grp ? '<div class="pr-grp">' + esc(r.group) + "</div>" : ""; grp = r.group;
      return g + '<details class="pr-rank ' + st + '" data-prank="' + r.idx + '"' + (open ? " open" : "") + '><summary><span class="pr-dot"></span><div><b>' + esc(r.label) + "</b><small>" +
        (st === "done" ? "Passed" : st === "here" ? "You are here" : "To reach " + esc(after(r))) + (r.tig ? " · " + r.tig + " TIG" : "") + (r.draft ? " · not final" : "") + "</small></div>" +
        "<em>" + r.reqs.length + "</em></summary>" + promoReqs(r) + "</details>";
    }).join("") + "</div>";
    return h;
  }
  // ---------- promotion tracker (command): every officer's checklist for their current rank ----------
  // ---------- promotion tracker: one grid per rank (from the Promotion Guidelines doc) + the Training Progression programs ----------
  // same look as the forms page's progression boards: a column per requirement, check marks, TIG days, progress bar
  let TRACK = null, TRK_TAB = LS.get("mdt:trkTab") || "", TRK_Q = "", TRK_F = "all", TRK_SORT = LS.get("mdt:trkSort") || "callsign", TRK_OPEN = {}, TRK_BUSY = false, PROGS = {};
  const isCommand = () => { const lv = ((DATA && DATA.profile) || LS.json("lspd_prof") || {}).level; return ["command", "admin", "owner"].indexOf(lv) !== -1; };
  async function loadTrack() { const r = await Portal.post({ action: "promoBoard", session: SESSION }).catch(() => ({ ok: false, error: "Couldn't reach the server." })); TRACK = r; if (VIEW === "tracker") draw(); }
  async function loadProg(id) {
    try { const r = await fetch(Portal.ENDPOINT + "?action=promo&p=" + encodeURIComponent(id) + "&t=" + Date.now()); const j = await r.json(); PROGS[id] = j.ok ? j.promo : { error: j.error || "Couldn't load it." }; }
    catch (e) { PROGS[id] = { error: "Couldn't reach the server." }; }
    if (VIEW === "tracker") draw();
  }
  // "Officer Must Complete & Pass Basic Police Training" -> "Complete & Pass Basic"
  function reqShort(it) {
    if (it.auto === "tig") return "Time in grade";
    if (it.auto === "reports") return it.need + " reports";
    if (it.auto === "sop") return "SOP certified";
    const t = String(it.t || "");
    if (/hours?\s+logged/i.test(t)) { const h = /\((\d+)\)\s*hours/i.exec(t), d = /\((\d+)\)\s*days/i.exec(t); return (h ? h[1] + " hrs" : "Hours") + (d ? " / " + d[1] + "d" : ""); }
    const x = t.replace(/^.*?\bmust\b\s*/i, "").replace(/\(.*?\)/g, " ");
    const w = x.split(/\s+/).filter(v => v && !/^(a|an|the|of|with|within|by|to|and|&|in|on|for|be|have|has|complete|pass|must|officer|department|lspd|los|santos|police)$/i.test(v)).slice(0, 3).join(" ");
    return w || t.slice(0, 18);
  }
  const trkByCall = (a, b) => (a.callsign || "~").localeCompare(b.callsign || "~", undefined, { numeric: true }) || String(a.name).localeCompare(String(b.name));
  // one board from a common shape: { kick, title, sub, noun, readyWord, tasks:[{short,title,sub}], rows:[...] , foot }
  function boardHTML(M) {
    const q = TRK_Q.toLowerCase().trim(), rows = M.rows.slice();
    if (TRK_SORT === "progress") rows.sort((a, b) => (b.ready - a.ready) || (b.done / Math.max(1, b.total) - a.done / Math.max(1, a.total)) || trkByCall(a, b)); else rows.sort(trkByCall);
    const mine = rows.filter(r => r.me); const rest = rows.filter(r => !r.me); const ordered = mine.concat(rest);
    const shown = ordered.filter(r => (TRK_F === "all" || (TRK_F === "ready" ? r.ready : !r.ready)) && (!q || (r.callsign + " " + r.name).toLowerCase().indexOf(q) !== -1));
    const ready = rows.filter(r => r.ready).length, avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.done / Math.max(1, r.total), 0) / rows.length * 100) : 0;
    const T = M.tasks, nouns = M.noun + (/s$/i.test(M.noun) ? "" : "s");
    let h = '<header class="pb-head"><div class="pb-title"><div class="pb-rank"><svg viewBox="0 0 40 40"><path d="M8 14l12-7 12 7M8 21l12-7 12 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M8 28l12-7 12 7" fill="none" stroke="var(--amber)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="2 5"/></svg></div>' +
      '<div><span class="pb-kick">' + esc(M.kick) + "</span><h1>" + esc(M.title) + "</h1>" + (M.sub ? "<p>" + esc(M.sub) + "</p>" : "") + "</div></div>" +
      '<dl class="pb-stats"><div><dt>' + esc(nouns) + "</dt><dd>" + rows.length + '</dd></div><div><dt>' + esc(M.readyWord) + '</dt><dd class="g">' + ready + "</dd></div><div><dt>Average</dt><dd>" + avg + "%</dd></div></dl></header>";
    h += '<div class="pb-tools"><input id="trkQ" placeholder="Search callsign or name" value="' + esc(TRK_Q) + '" autocomplete="off">' +
      '<label class="pb-sort" style="color:var(--mute);font-size:12px">Order <select id="trkSort" class="tr-sel">' + [["callsign", "Callsign"], ["progress", "Progress"]].map(o => '<option value="' + o[0] + '"' + (TRK_SORT === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select></label>" +
      '<div class="seg">' + [["all", "All"], ["prog", "In progress"], ["ready", M.readyWord]].map(o => '<button data-trkf="' + o[0] + '" class="' + (TRK_F === o[0] ? "on" : "") + '">' + o[1].toUpperCase() + "</button>").join("") + "</div></div>";
    if (M.error) h += '<div class="empty" style="margin-bottom:12px">' + esc(M.error) + "</div>";
    h += '<div class="pb-scroll"><div class="pb-board" style="--cols:' + Math.max(1, T.length) + '"><div class="pb-row pb-th"><span class="pb-who">' + esc(M.noun) + "</span>" +
      T.map((t, i) => '<span class="pb-task" title="' + esc(t.title) + '"><b>' + (i + 1) + "</b><small>" + esc(t.short) + "</small></span>").join("") + '<span class="pb-prog">Progress</span></div>';
    h += shown.length ? shown.map(r => {
      const open = !!TRK_OPEN[r.key];
      return '<div class="pb-item' + (r.ready ? " ready" : "") + (r.me ? " me" : "") + (open ? " open" : "") + '"><div class="pb-row" data-trow="' + esc(r.key) + '">' +
        '<span class="pb-who">' + (r.callsign ? "<code>" + esc(r.callsign) + "</code>" : "") + '<span class="nm">' + esc(r.name) + "</span>" + (r.me ? '<span class="you">YOU</span>' : "") + (r.chip ? '<span class="tg' + (r.chip.ok ? " ok" : "") + '">' + esc(r.chip.txt) + "</span>" : "") + "</span>" +
        r.cells.map((c, i) => '<span class="pb-cell" data-n="' + (i + 1) + '">' + c + "</span>").join("") +
        '<span class="pb-prog">' + (r.dl || "") + (r.ready ? '<span class="rd" style="font-size:.58rem;font-weight:800;letter-spacing:.12em;color:#06210f;background:var(--green);border-radius:4px;padding:2px 6px">' + esc(M.readyWord.toUpperCase()) + "</span>" : "") +
        '<span class="bar"><i style="width:' + Math.round(r.done / Math.max(1, r.total) * 100) + '%"></i></span><b>' + r.done + "/" + r.total + "</b></span></div>" + (open ? r.detail : "") + "</div>";
    }).join("") : '<div class="pb-empty">' + (rows.length ? "No one matches." : "No " + esc(nouns.toLowerCase()) + " at this step right now.") + "</div>";
    h += "</div></div>";
    if (T.length) h += '<ol class="pb-legend">' + T.map(t => "<li><span>" + esc(t.title) + "</span>" + (t.sub ? "<b>" + esc(t.sub) + "</b>" : "") + "</li>").join("") + "</ol>";
    if (M.foot) h += '<p class="promo-upd">' + M.foot + "</p>";
    return h;
  }
  // a rank from the guidelines doc -> board
  function rankBoard(r) {
    const can = !!TRACK.canTick, list = (TRACK.officers || []).filter(o => o.listed && o.idx === r.idx);
    const items0 = (list[0] && list[0].items) || (r.reqs || []).map(t => ({ t: t.t }));
    const tasks = items0.map(it => ({ short: reqShort(it), title: it.t, sub: it.auto === "tig" ? it.need + " days" : it.auto === "reports" ? "×" + it.need : it.auto === "sop" ? "Discord role" : "" }));
    const rows = list.map(o => {
      const key = o.id || (o.callsign + "|" + o.name);
      const cells = o.items.map(it => {
        const ref = esc(o.id) + "|" + esc(it.key) + "|" + (it.manual ? "0" : "1");
        if (it.done) return '<span class="pb-c ok' + (can && it.manual ? " can" : " auto") + '"' + (can && it.manual ? ' data-tcheck="' + ref + '"' : "") + ' title="' + esc(it.manual ? "Signed off by " + it.by : "Counted automatically") + '">✓</span>';
        if (it.auto === "tig" || it.auto === "reports") { const have = it.have == null ? 0 : it.have, need = Math.max(1, it.need);
          return '<span class="pb-c part' + (can ? " can" : "") + '"' + (can ? ' data-tcheck="' + ref + '"' : "") + ' title="' + esc(it.auto === "tig" ? (it.have == null ? "No TIG date on the roster" : have + " of " + it.need + " days") : have + " of " + it.need + " reports") + '"><i style="--p:' + Math.min(100, Math.round(have / need * 100)) + '%"></i>' + (it.auto === "tig" ? (it.have == null ? "—" : have + "d") : have + "/" + it.need) + "</span>"; }
        return '<span class="pb-c zero' + (can ? " can" : "") + '"' + (can ? ' data-tcheck="' + ref + '"' : "") + ' title="' + (can ? "Tap to sign off" : "Not done yet") + '">·</span>';
      });
      const tigNeed = r.tig || 0, chip = o.tigDays == null ? { txt: "TIG —", ok: false } : { txt: "TIG " + o.tigDays + "d", ok: !tigNeed || o.tigDays >= tigNeed };
      const detail = '<div class="pb-detail">' + o.items.map((it, i) => '<div class="pd-item' + (it.done ? " ok" : "") + '"><div class="pd-h"><span class="pd-n">' + (i + 1) + "</span><b>" + esc(it.t) + "</b><em>" + (it.done ? "Done" : "Open") + "</em></div><p>" +
        (it.auto === "tig" ? (it.have == null ? "No time-in-grade date on the roster (column G)." : it.have + " of " + it.need + " days.") : it.auto === "reports" ? it.have + " of " + it.need + " reports since reaching this rank." : it.auto === "sop" ? (it.have ? "Has the SOP Certified role in Discord." : "No SOP Certified role in Discord yet.") : "") +
        (it.manual ? " Signed off by " + esc(it.by) + (it.at ? " on " + new Date(it.at).toLocaleDateString() : "") + "." : !it.auto && !it.done ? " Command signs this off." : "") + "</p>" +
        (can && (!it.done || it.manual) ? '<button class="btn ghost" data-tcheck="' + esc(o.id) + "|" + esc(it.key) + "|" + (it.manual ? "0" : "1") + '">' + (it.done ? "UNDO SIGN-OFF" : "SIGN OFF") + "</button>" : "") + "</div>").join("") + "</div>";
      return { key: key, callsign: o.callsign, name: o.name, me: !!o.me, chip: chip, cells: cells, done: o.done, total: o.total, ready: !!o.ready, detail: detail };
    });
    return boardHTML({ kick: "Promotion tracker", title: r.name + " → " + r.next, sub: "From the LSPD Promotion Guidelines. Time in grade, reports and the SOP role tick themselves" + (can ? "; tap a box to sign off the rest." : "; command signs off the rest."),
      noun: (r.name || "Officer").replace(/\s*\(.*\)$/, ""), readyWord: "Ready", tasks: tasks, rows: rows, foot: r.tig ? "Requires " + r.tig + " days time in grade." : "" });
  }
  // a Training Progression program (Onboarding, CPL -> SGT…) -> board (read-only: it fills itself from reports)
  function progBoard(id) {
    const P = PROGS[id]; if (!P) { loadProg(id); return '<div class="boot"><i></i>LOADING…</div>'; }
    if (P.error && !P.candidates) return '<div class="empty">' + esc(P.error) + "</div>";
    const T = P.tasks || [], me = DATA && DATA.profile || {};
    const short = t => String(t.title || "").replace(/Global Operation Manual/i, "GOM").replace(/^(Witness|Lead|Complete|Do)\s+(a|an)?\s*/i, m => m.split(" ")[0] + " ");
    const fmtDl = d => d ? new Date(d + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" }) : "";
    const rows = (P.candidates || []).map(c => {
      const cells = T.map(t => { const st = c.tasks[t.id] || { count: 0, need: t.need };
        if (st.excused) return '<span class="pb-c ex" title="Excused">EX</span>';
        if (st.done) return '<span class="pb-c ok" title="Done">✓</span>';
        if (st.locked) return '<span class="pb-c lk" title="Locked until the other requirements are done"><svg viewBox="0 0 16 16"><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3.5" y="7" width="9" height="7" rx="1.5" fill="currentColor"/></svg></span>';
        if (!st.count) return '<span class="pb-c zero" title="Not started">·</span>';
        return '<span class="pb-c part" title="' + st.count + " of " + st.need + '"><i style="--p:' + Math.round(st.count / st.need * 100) + '%"></i>' + st.count + "/" + st.need + "</span>"; });
      const d = c.deadline, dl = d && d.state !== "done" && !c.complete ? '<span class="tg" style="font-size:.66rem;padding:2px 8px;border-radius:999px;border:1px solid ' + (d.state === "over" ? "var(--red);color:var(--red)" : d.state === "warn" ? "var(--amber);color:var(--amber)" : "var(--line2);color:var(--mute)") + '" title="Deadline ' + esc(fmtDl(d.date)) + '">' + (d.state === "over" ? "Out of time" : d.left === 1 ? "1 day left" : d.left + " days left") + "</span>" : "";
      const chip = P.tigDays || P.showTig ? { txt: P.id === "cpl" || !P.tigLabel ? (c.tig == null ? "TIG —" : "TIG " + c.tig + "d") : (c.tig == null ? "Joined —" : "Joined " + (c.tig === 0 ? "today" : c.tig + "d ago")), ok: !!(c.tigOk || !P.tigDays) } : null;
      const detail = '<div class="pb-detail">' + T.map((t, i) => { const st = c.tasks[t.id] || { count: 0, need: t.need, items: [] };
        return '<div class="pd-item' + (st.done ? " ok" : "") + '"><div class="pd-h"><span class="pd-n">' + (i + 1) + "</span><b>" + esc(t.title) + "</b><em>" + (st.excused ? "Excused" : st.done ? "Complete" : st.locked ? "Locked" : st.count + " of " + st.need) + "</em></div>" +
          ((st.items || []).length ? "<ul>" + st.items.map(x => "<li>" + esc(fmtDl(x.date)) + " · " + esc(x.source) + (x.report ? " <code>" + esc(x.report) + "</code>" : "") + (x.count > 1 ? " ×" + x.count : "") + "</li>").join("") + "</ul>" : "<p>Nothing logged yet.</p>") + "</div>"; }).join("") + "</div>";
      const mine = (me.callsign && c.callsign === me.callsign) || (!me.callsign && me.name && c.name === me.name);
      return { key: "p:" + (c.callsign || c.name), callsign: c.callsign, name: c.name, me: !!mine, chip: chip, cells: cells, done: c.done, total: c.total, ready: !!c.complete, dl: dl, detail: detail };
    });
    return boardHTML({ kick: "Training progression", title: P.title, sub: P.subtitle, noun: P.noun || "Person", readyWord: P.id === "cpl" ? "Ready" : "Complete", error: P.error,
      tasks: T.map(t => ({ short: short(t), title: t.title, sub: "×" + t.need + (t.freshDays ? " in " + t.freshDays + "d" : "") })), rows: rows,
      foot: (P.tigDays ? "Final step requires " + P.tigDays + " days time in grade. " : "") + (P.deadlineDays ? "Requirements must be finished within " + P.deadlineDays + " days of joining. " : "") + "Fills itself when reports are filed." });
  }
  function trackHTML() {
    let h = '<div class="h2"><div><h1>PROMOTION TRACKER</h1><p>Where everyone stands on their next step. Your own row is marked <b style="color:var(--amber)">YOU</b> and listed first.</p></div><button class="btn ghost" data-trefresh>↻ REFRESH</button></div>';
    if (!TRACK) { loadTrack(); return h + '<div class="boot"><i></i>LOADING THE TRACKER…</div>'; }
    if (!TRACK.ok) return h + '<div class="empty">' + esc(TRACK.error || "Couldn't load the tracker.") + "</div>";
    const ranks = (TRACK.ranks || []).filter(r => (TRACK.officers || []).some(o => o.listed && o.idx === r.idx)), progs = TRACK.programs || [];
    const meO = (TRACK.officers || []).find(o => o.me), myProg = ((DATA && DATA.paths) || [])[0];
    const tabs = ranks.map(r => ({ k: "r:" + r.idx, label: r.name + " → " + r.next, n: (TRACK.officers || []).filter(o => o.listed && o.idx === r.idx).length, mine: !!(meO && meO.listed && meO.idx === r.idx) }))
      .concat(progs.map(p => ({ k: "p:" + p.id, label: p.title, prog: true, mine: !!(myProg && myProg.id === p.id) })));
    if (!tabs.some(t => t.k === TRK_TAB)) TRK_TAB = ((tabs.find(t => t.mine && t.prog) || tabs.find(t => t.mine) || tabs[0]) || {}).k || "";
    h += '<div class="trk"><div class="trk-tabs"><i>Ranks</i>' + tabs.filter(t => !t.prog).map(t => '<button data-trktab="' + t.k + '" class="' + (t.k === TRK_TAB ? "on" : "") + (t.mine ? " mine" : "") + '">' + esc(t.label) + "<small>" + t.n + "</small></button>").join("") +
      (progs.length ? "<i>Training</i>" + tabs.filter(t => t.prog).map(t => '<button data-trktab="' + t.k + '" class="' + (t.k === TRK_TAB ? "on" : "") + (t.mine ? " mine" : "") + '">' + esc(t.label) + "</button>").join("") : "") + "</div>";
    if (!TRK_TAB) return h + '<div class="empty">Promotion requirements aren\'t set up yet.</div></div>';
    if (TRK_TAB.indexOf("p:") === 0) return h + progBoard(TRK_TAB.slice(2)) + "</div>";
    const r = ranks.find(x => "r:" + x.idx === TRK_TAB);
    return h + rankBoard(r) + "</div>";
  }
  document.addEventListener("input", e => { if (e.target.id === "trkQ") { TRK_Q = e.target.value; const pos = e.target.selectionStart; draw(); const n = $("trkQ"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } });
  document.addEventListener("change", e => { if (e.target.id === "trkSort") { TRK_SORT = e.target.value; LS.set("mdt:trkSort", TRK_SORT); draw(); } });
  document.addEventListener("click", async e => {
    const tb = e.target.closest("[data-trktab]"); if (tb) { TRK_TAB = tb.dataset.trktab; LS.set("mdt:trkTab", TRK_TAB); TRK_OPEN = {}; draw(); return; }
    const tf = e.target.closest("[data-trkf]"); if (tf) { TRK_F = tf.dataset.trkf; draw(); return; }
    if (e.target.closest("[data-trefresh]")) { TRACK = null; PROGS = {}; draw(); return; }
    const c = e.target.closest("[data-tcheck]");
    if (!c) { const row = e.target.closest("[data-trow]"); if (row) { const k = row.dataset.trow; TRK_OPEN[k] = !TRK_OPEN[k]; draw(); } return; }
    e.stopPropagation(); if (TRK_BUSY || !TRACK || !TRACK.canTick) return;
    const [id, key, turnOn] = c.dataset.tcheck.split("|"), it = ((TRACK.officers.find(o => o.id === id) || {}).items || []).find(x => x.key === key);
    if (it && it.done && !it.manual) { toast("This one is counted automatically."); return; }
    TRK_BUSY = true; c.classList.add("busy"); blip(turnOn === "1" ? 1400 : 600);
    const r = await Portal.post({ action: "promoCheck", session: SESSION, id: id, key: key, on: turnOn === "1" }).catch(() => ({ ok: false, error: "Couldn't reach the server." }));
    TRK_BUSY = false;
    if (r.ok) { TRACK = r; const o = r.officers.find(x => x.id === id); draw(); if (o && o.ready && turnOn === "1") toast("🎖️ " + o.name + " has every requirement for " + ((r.ranks.find(x => x.idx === o.idx) || {}).next || "promotion") + "."); }
    else { c.classList.remove("busy"); toast(r.error || "Couldn't save that."); }
  });
  document.addEventListener("toggle", e => { const d = e.target; if (d && d.dataset && d.dataset.prank != null) PROMO_OPEN[d.dataset.prank] = d.open; }, true);
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
      (f.female && SHOW_FEMALE ? '<div class="seg"><button data-sex="male" class="' + (SEX === "male" ? "on" : "") + '">MALE</button><button data-sex="female" class="' + (SEX === "female" ? "on" : "") + '">FEMALE</button></div>' : "") +
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
    const dl = e.target.closest("[data-duty-link]"); if (dl) { dl.disabled = true; dl.textContent = "OPENING DISCORD…";
      Portal.post({ action: "acctDiscordUrl" }).then(r => { if (r && r.ok && r.url) location.href = r.url; else { dl.disabled = false; dl.textContent = "CONNECT"; toast((r && r.error) || "Couldn't open Discord."); } }); return; }
    const c = e.target.closest("[data-copy]"); if (c && !c.disabled) { copy(c.getAttribute("data-copy"), c.getAttribute("data-what") || "Code"); return; }
    const fa = e.target.closest("[data-fa]"); if (fa) { FLEET_ALL = fa.getAttribute("data-fa") === "1"; LS.set("mdt:fleetAll", FLEET_ALL ? "1" : ""); draw(); return; }
    const ua = e.target.closest("[data-ua]"); if (ua) { UNI_ALL = ua.getAttribute("data-ua") === "1"; LS.set("mdt:uniAll", UNI_ALL ? "1" : ""); draw(); return; }
    const sx = e.target.closest("[data-sex]"); if (sx && SHOW_FEMALE) { SEX = sx.getAttribute("data-sex"); LS.set("mdt:sex", SEX); draw(); return; }
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
    const pc = e.target.closest("[data-pcat]"); if (pc) { REF_CAT = pc.getAttribute("data-pcat"); draw(); const mm = document.querySelector(".pen-main"); if (mm) mm.scrollTop = 0; return; }
    const ch = e.target.closest("[data-charge]"); if (ch) { chargeCard(ch.getAttribute("data-charge")); return; }
    const pk = e.target.closest("[data-pcls]"); if (pk) { REF_CLS = pk.getAttribute("data-pcls"); draw(); return; }
    const rt = e.target.closest("[data-rtab]"); if (rt) { e.preventDefault(); REF_TAB = rt.getAttribute("data-rtab"); draw(); return; }
    if (e.target.closest("[data-refclear]")) { REF_Q = ""; draw(); const n = $("refQ"); if (n) n.focus(); return; }
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
    [["home", "🏠", "Dashboard"], ["records", "🔎", "Records & BOLOs"], ["reference", "⚖️", "Penal code & 10-codes"], ["fleet", "🚓", "Fleet"], ["uniforms", "👕", "Uniforms"], ["training", "📅", "Training"], ["unit", "⭐", "Kudos & awards"], ["promotions", "🎖️", "Promotions"], ["sop", "📘", "SOP"], ["tracker", "✅", "Promotion tracker"]].forEach(v => add("Go to", v[1], v[2], "", () => go(v[0])));
    add("Go to", "📋", "My reports", "", () => go("frame:myreports.html"));
    if ((((DATA && DATA.profile) || LS.json("lspd_prof") || {}).divisions || []).length) add("Go to", "🛡️", "Division Command", "Grading, activity and officers", () => go("frame:division.html"));
    myForms().filter(f => f.status === "live").forEach(f => add("File a report", f.icon, f.title, f.division ? f.division + " report" : "", () => go("form:" + f.id), f.section));
    ((DATA && DATA.board && DATA.board.notices) || []).forEach(n => add("BOLOs", "🚨", n.title, n.type + " · " + n.from, () => go("records"), n.details));
    if (q.length >= 2) add("Records", "🗂️", "Search records for “" + q + "”", "People, vehicles and plates in every report", () => { go("records"); setTimeout(() => { const i = $("recQ"); if (i) { i.value = q; runSearch(q); } }, 50); });
    if (REF && q.length >= 2) {
      const opts = REF.charges ? REF.charges.options : REF.penal.map(x => x.raw);
      opts.filter(o => !/^#/.test(o) && o.toLowerCase().indexOf(q) !== -1).slice(0, 8).forEach(o => { const it = Portal.chargeItem(o); add("Charges", "⚖️", it.label, [it.cls, it.sub].filter(Boolean).join(" · "), () => { go("reference"); chargeCard(it.label); }); });
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
  { const pr = LS.json("lspd_prof"); if (DATA && DATA.profile && pr && pr.discordId && DATA.profile.discordId !== pr.discordId) DATA = null; }   // another officer used this device
  if (!DATA) snapForms();
  draw(); load(); loadUnit();
  setTimeout(formHost, 700);
  setInterval(() => { if (!document.hidden) load(); }, 3 * 60e3);
  document.addEventListener("submit", e => { if (e.target.id === "recForm") { e.preventDefault(); const q = $("recQ").value.trim(); if (q.length >= 2) runSearch(q); else toast("Type at least 2 characters."); } });
  document.addEventListener("input", e => { if (e.target.id === "refQ") { REF_Q = e.target.value; const pos = e.target.selectionStart; draw(); const n = $("refQ"); n.focus(); n.setSelectionRange(pos, pos); } });
  addEventListener("keydown", e => { if (e.key && e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey && !e.altKey && !/input|textarea|select/i.test((e.target.tagName || "")) && $("modal").hidden && !document.querySelector(".lk")) go("reports"); });
})();
