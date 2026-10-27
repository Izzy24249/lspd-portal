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
    if (DATA && DATA.fleet) { $("nFleet").textContent = DATA.fleet.vehicles.filter(v => v.allowed).length || ""; $("nUni").textContent = (DATA.fleet.uniforms[SEX] || []).filter(u => u.yours).length || ""; }
  }

  // ---------- router ----------
  function go(v) { VIEW = ["home", "fleet", "uniforms"].indexOf(v) >= 0 ? v : "home"; if (location.hash.slice(1) !== VIEW) history.replaceState(null, "", "#" + VIEW); draw(); window.scrollTo(0, 0); }
  document.addEventListener("click", e => { const a = e.target.closest("[data-go]"); if (a) { e.preventDefault(); go(a.getAttribute("data-go")); } });
  addEventListener("hashchange", () => go(location.hash.slice(1)));

  function draw() {
    document.querySelectorAll("[data-go]").forEach(a => a.classList.toggle("on", a.getAttribute("data-go") === VIEW));
    drawStrip();
    const m = $("main");
    if (!DATA) { m.innerHTML = '<div class="boot">ESTABLISHING LINK…</div>'; return; }
    m.innerHTML = '<div class="view">' + (VIEW === "fleet" ? fleetHTML() : VIEW === "uniforms" ? uniformsHTML() : homeHTML()) + "</div>";
  }

  // ---------- home ----------
  function greet() { const h = new Date().getHours(); return h < 5 ? "Evening" : h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening"; }
  function homeHTML() {
    const p = DATA.profile || {}, f = DATA.fleet || {}, trainee = f.rank && f.rank.trainee;
    let h = '<div class="hello"><div><h1>' + esc(greet()) + ", " + esc(last(p.name) || "Officer") + '. <span>' + esc(trainee ? "Welcome to the academy." : "Ready when you are.") + "</span></h1>" +
      '<p>Signed on as <b>' + esc(p.callsign || "—") + "</b> · " + esc(who(p)) + (f.rank && f.rank.known ? " · rank on file: <b>" + esc(f.rank.name) + "</b>" : "") + '</p></div><a class="file" href="index.html">FILE A REPORT</a></div>';
    (DATA.paths || []).forEach(pa => { h += pathHTML(pa); });
    if (!(DATA.paths || []).length) h += '<section class="pane pathx"><div class="ph"><span class="lbl">Training path</span></div><p style="color:var(--mute)">You\'re not in an active training or promotion program right now. When command adds you to one, your steps and progress show up here.</p></section>';
    h += '<section class="pane"><div class="sop"><svg viewBox="0 0 24 24"><use href="#i-book"/></svg><div><b>Standard Operating Procedures</b><small>The LSPD SOP: policy, radio, pursuits, use of force. Read it before your first shift and keep it handy.</small></div><a class="btn" target="_blank" rel="noopener" href="' + esc(DATA.sop) + '">OPEN SOP ↗</a></div></section>';
    h += '<div class="tiles">' +
      tile("fleet", "i-car", "Fleet", (f.vehicles || []).filter(v => v.allowed).length + " vehicles approved for you") +
      tile("uniforms", "i-shirt", "Uniforms", ((f.uniforms || {})[SEX] || []).filter(u => u.yours).length + " outfits for your rank") +
      '<a class="tile" href="myreports.html"><svg><use href="#i-file"/></svg><b>My reports</b><small>Grades and feedback on what you filed</small></a>' +
      '<a class="tile" href="index.html"><svg><use href="#i-clip"/></svg><b>File a report</b><small>Every LSPD form in one place</small></a>' +
      '<a class="tile" href="division.html" data-need-division ' + ((p.divisions || []).length ? "" : "hidden") + '><svg><use href="#i-shield"/></svg><b>Division Command</b><small>Your divisions: activity and grading</small></a>' +
      "</div>";
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
    const sx = e.target.closest("[data-sex]"); if (sx) { SEX = sx.getAttribute("data-sex"); LS.set("mdt:sex", SEX); draw(); }
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
  VIEW = ["home", "fleet", "uniforms"].indexOf(location.hash.slice(1)) >= 0 ? location.hash.slice(1) : "home";
  draw(); load();
  setInterval(() => { if (!document.hidden) load(); }, 5 * 60e3);
})();
