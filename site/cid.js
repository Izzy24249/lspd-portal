/* CID Case File Builder — the Criminal Investigations Division's own page.
   The case form itself is the portal's "CID Case File" form (edited in admin), drawn by forms.js,
   so it keeps every portal feature (charges pop-out, linking, narrative sync…). This file adds the
   division's builder around it: officer profile, several saved cases, dashboard, live case-file preview
   (plain text / Discord / BBCode), print & download, case-file image, Post / Save to Discord,
   Command review status, idle lock and the background beat. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id), esc = s => Portal.esc(s);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  const K = { profile: "cid-builder:profile", cases: "cid-builder:cases", current: "cid-builder:current", beat: "cid-builder:beat", fmt: "cid-builder:fmt" };
  const RANKS = ["Honorary Detective", "Probationary Detective", "Detective", "Lead Detective", "Command"];
  const MEDIA_HOSTS = ["imgur.com", "i.imgur.com", "m.imgur.com", "cdn.discordapp.com", "media.discordapp.net", "medal.tv", "www.medal.tv"];
  const ID = () => Math.random().toString(36).slice(2, 10);
  const todayISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const genCaseNo = () => "CID-" + String(new Date().getFullYear()).slice(2) + "-" + Math.floor(1000 + Math.random() * 9000);
  const isDiscordId = v => /^\d{17,20}$/.test(String(v || "").trim());

  let CONFIG = null, FORM = null, ctrl = null, CUR = null, FMT = LS.get(K.fmt, "text");
  let CASES = LS.get(K.cases, []); if (!Array.isArray(CASES)) CASES = [];
  let PROFILE = LS.get(K.profile, null);
  if (PROFILE && (!PROFILE.name || typeof PROFILE !== "object")) PROFILE = null;

  function toast(msg, type) {
    const t = $("toast"); t.textContent = msg; t.className = "toast show " + (type || "");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.className = "toast", 4600);
  }
  function saveCases() { if (!LS.set(K.cases, CASES)) toast("Your browser's storage is full: export some cases to back them up, then delete them here.", "bad"); }

  // ---------------- config: the site's own copy first (instant), then Google ----------------
  function pickForm(cfg) { const fs = (cfg && cfg.forms) || []; return fs.find(f => f.cidApp && f.status === "live") || fs.find(f => f.id === "cidcase" && f.status === "live") || null; }
  function useConfig(cfg) {
    const f = pickForm(cfg); if (!f) return false;
    const changed = !FORM || JSON.stringify(FORM) !== JSON.stringify(f);
    CONFIG = cfg; FORM = f;
    if (Portal.setRoster) Portal.setRoster(cfg.roster || []);
    if (Portal.setRosters) Portal.setRosters(cfg.rosters || {});
    setBadges();
    return changed;
  }
  function setBadges() {
    const src = FORM && FORM.logoUrl ? FORM.logoUrl : "img/lspd-seal.png";
    document.querySelectorAll("[data-badge]").forEach(img => {
      if (img.getAttribute("src") === src) return;
      img.onerror = () => { img.onerror = null; img.src = "img/lspd-seal.png"; };
      img.src = src;
    });
  }
  async function loadConfig() {
    let snap = null;
    try { const r = await fetch("data/portal.json?t=" + Date.now(), { cache: "no-store" }); if (r.ok) snap = await r.json(); } catch (e) {}
    if (snap && snap.config && useConfig(snap.config)) ready();
    Portal.loadConfig().then(cfg => { if (useConfig(cfg) && ctrl) mountCase(); else if (!ctrl) ready(); }).catch(err => {
      if (!FORM) $("mount").innerHTML = '<div class="loading">Could not load the case builder. ' + esc(err.message) + '<br><button class="ci-btn" onclick="location.reload()">Try again</button></div>';
    });
  }
  let READY = false;
  function ready() {
    if (READY || !FORM) { if (READY && !FORM) noForm(); return; }
    READY = true;
    if (introDone) startBuilder();
  }
  function noForm() { $("mount").innerHTML = '<div class="loading">The CID Case File form isn\'t live yet. An admin adds it in the admin panel: Forms → + From template → CID Case File, then sets it to Live.</div>'; }

  // ---------------- intro: loading terminal, then officer sign-in ----------------
  let introDone = false;
  const LINES = ["Establishing secure link to MDT terminal", "Verifying officer credentials", "Loading penal code registry", "Syncing division case index", "Preparing evidence locker", "Applying Command review channel", "Case file builder ready"];
  function runIntro() {
    let i = 0, pct = 0, done = false;
    const lines = $("introLines"), bar = $("introBar"), pc = $("introPct");
    const finish = () => { if (done) return; done = true; clearInterval(tm); bar.style.width = "100%"; pc.textContent = "100%"; setTimeout(showSign, 250); };
    const tm = setInterval(() => {
      pct = Math.min(100, pct + 4 + Math.random() * 9);
      bar.style.width = pct + "%"; pc.textContent = Math.round(pct) + "%";
      const want = Math.floor(pct / (100 / LINES.length));
      while (i < want && i < LINES.length) { lines.insertAdjacentHTML("beforeend", `<div><b>[ OK ]</b> ${esc(LINES[i])}</div>`); i++; }
      if (pct >= 100) finish();
    }, 120);
    $("introSkip").onclick = finish;
  }
  function showSign() {
    $("introTerm").hidden = true;
    const box = $("introSign"); box.hidden = false;
    if (PROFILE) {
      box.innerHTML = `<div class="ci-welcome">Welcome back, <b>${esc(PROFILE.rank + " " + PROFILE.name)}</b>${PROFILE.badge ? ` · Badge ${esc(PROFILE.badge)}` : ""}${PROFILE.callsign ? ` · Callsign ${esc(PROFILE.callsign)}` : ""}</div>
        <button type="button" class="ci-btn gold big" id="openBuilder">Open case builder →</button>
        <button type="button" class="ci-link" id="notYou">Not you? Change details</button>`;
      $("openBuilder").onclick = enterBuilder;
      $("notYou").onclick = () => { box.innerHTML = profileForm(true); wireProfileForm(box, enterBuilder); };
    } else { box.innerHTML = profileForm(true); wireProfileForm(box, enterBuilder); }
  }
  function profileForm(intro) {
    const p = PROFILE || { name: "", rank: "Detective", badge: "", callsign: "", discordId: "" };
    return `<div class="ci-pform">
      <div class="ci-pform-h">${intro ? "Officer sign-in · saved in this browser" : "Officer details · saved in this browser"}</div>
      <label><span>Name *</span><input id="pfName" maxlength="60" placeholder="Last name / callsign name" value="${esc(p.name)}"></label>
      <label><span>Rank</span><select id="pfRank">${RANKS.map(r => `<option${r === p.rank ? " selected" : ""}>${esc(r)}</option>`).join("")}</select></label>
      <div class="ci-pform-2"><label><span>Badge #</span><input id="pfBadge" maxlength="12" placeholder="417" value="${esc(p.badge)}"></label>
      <label><span>Callsign</span><input id="pfCall" maxlength="20" placeholder="L-417" value="${esc(p.callsign)}"></label></div>
      <label><span>Discord ID <small>(needed to post; Developer Mode → right-click yourself → Copy User ID)</small></span><input id="pfDiscord" inputmode="numeric" maxlength="20" placeholder="123456789012345678" value="${esc(p.discordId)}"></label>
      <div class="ci-pform-err" id="pfErr"></div>
      <div class="ci-pform-btns">${!intro ? '<button type="button" class="ci-btn" data-close>Cancel</button>' : ""}<button type="button" class="ci-btn gold" id="pfSave">${intro ? "Save & open builder →" : "Save details"}</button></div></div>`;
  }
  function wireProfileForm(box, after) {
    const save = () => {
      const p = { name: box.querySelector("#pfName").value.trim(), rank: box.querySelector("#pfRank").value, badge: box.querySelector("#pfBadge").value.trim(),
        callsign: box.querySelector("#pfCall").value.trim(), discordId: box.querySelector("#pfDiscord").value.trim() };
      const err = box.querySelector("#pfErr");
      if (!p.name) { err.textContent = "Enter your name."; return; }
      if (p.discordId && !isDiscordId(p.discordId)) { err.textContent = "A Discord ID is the 17-20 digit number, not your username."; return; }
      const prev = PROFILE; PROFILE = p; LS.set(K.profile, p);
      if (ctrl) applyProfile(prev);
      drawProfileChip();
      after && after();
    };
    box.querySelector("#pfSave").onclick = save;
    box.querySelectorAll("input").forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter") save(); }));
    const n = box.querySelector("#pfName"); if (n) setTimeout(() => n.focus(), 30);
  }
  function enterBuilder() {
    introDone = true;
    $("intro").classList.add("gone"); setTimeout(() => { $("intro").hidden = true; $("introSign").innerHTML = ""; }, 450);
    Beat.userStart();
    if (READY) startBuilder(); else $("main").hidden = false, $("head").hidden = false;
  }

  // ---------------- builder ----------------
  let started = false;
  function startBuilder() {
    if (started) return; started = true;
    $("head").hidden = false; $("main").hidden = false;
    drawProfileChip();
    if (!FORM) { noForm(); return; }
    const want = LS.get(K.current, "");
    CUR = CASES.find(c => c.id === want) || CASES[0] || newCase(true);
    mountCase();
    pollReviews(); setInterval(pollReviews, 90000);
    Idle.start();
  }
  function blankData() {
    const p = PROFILE || {};
    return { values: { ccCaseNo: genCaseNo(), ccDate: todayISO(), ccStatus: "Open", ccPriority: "Medium", ccRank: p.rank || "Detective", ccLead: p.name || "", ccBadge: p.badge || "",
      ccDivision: "LSPD Criminal Investigations Division", ccCerts: "None" }, checklists: {}, repeaters: {} };
  }
  function newCase(silent) {
    const c = { id: ID(), created: Date.now(), updated: Date.now(), data: blankData(), forumTags: [], media: {}, submissionId: "", review: null };
    CASES.unshift(c); saveCases();
    if (!silent) { CUR = c; mountCase(); toast("New case started: " + c.data.values.ccCaseNo, "ok"); }
    return c;
  }
  function mountCase() {
    if (!FORM || !CUR) return;
    LS.set(K.current, CUR.id);
    ctrl = Portal.render(FORM, $("mount"), { draft: false, manualLoad: true, caseKey: CUR.id, onChange: onChange });
    ctrl.load(CUR.data || {});
    if (!ctrl.getValue("ccCaseNo")) ctrl.setValue("ccCaseNo", genCaseNo());
    applyProfile(null, true);
    injectExtras();
    afterChange(true);
  }
  // rank / lead investigator / badge follow the officer profile (unless someone typed something else)
  function applyProfile(prev, onlyEmpty) {
    if (!ctrl || !PROFILE) return;
    [["ccRank", "rank"], ["ccLead", "name"], ["ccBadge", "badge"]].forEach(([f, k]) => {
      const cur = ctrl.getValue(f), was = prev ? prev[k] : null;
      if (!cur || (!onlyEmpty && was != null && cur === was)) ctrl.setValue(f, PROFILE[k] || "");
    });
    onChange();
  }
  let chT = null;
  function onChange() { clearTimeout(chT); chT = setTimeout(() => afterChange(false), 250); }
  function afterChange(first) {
    if (!ctrl || !CUR) return;
    const d = ctrl.collect();
    if (!first || JSON.stringify(d) !== JSON.stringify(CUR.data)) { CUR.data = d; CUR.updated = Date.now(); }
    saveCases();
    drawMeter(); drawPreview(); drawCount(); drawMedia(); drawReview(); drawPostBtns();
  }

  // ---------------- extras inside the form: Discord forum tags + evidence media links ----------------
  function injectExtras() {
    const root = $("mount");
    const pr = root.querySelector('[data-f="ccPriority"]');
    const anchor = pr && (pr.closest(".hud-fields") || pr.closest("tr"));
    if (anchor && (FORM.forumTagOptions || []).length) {
      const box = document.createElement(anchor.tagName === "TR" ? "tr" : "div");
      box.className = "ci-tagsbox";
      const inner = `<div class="ci-tagslbl">DISCORD FORUM TAGS <small>(up to 5)</small></div><div class="ci-tagchips">${FORM.forumTagOptions.map(t => `<button type="button" class="ci-tagchip" data-ftag="${esc(t.id)}">${esc(t.label)}</button>`).join("")}</div>`;
      box.innerHTML = anchor.tagName === "TR" ? `<td colspan="4">${inner}</td>` : inner;
      anchor.after(box);
      box.addEventListener("click", e => {
        const b = e.target.closest("[data-ftag]"); if (!b) return;
        const id = b.dataset.ftag, on = CUR.forumTags.includes(id);
        if (!on && CUR.forumTags.length >= 5) { toast("Discord allows up to 5 forum tags.", "bad"); return; }
        CUR.forumTags = on ? CUR.forumTags.filter(x => x !== id) : CUR.forumTags.concat(id);
        drawTags(); saveCases();
      });
      drawTags();
    }
    const ev = root.querySelector('[data-anchor="ccEvidence"]');
    const card = ev && (ev.closest(".hud-card") || ev.closest("table"));
    if (card) {
      const box = document.createElement("section");
      box.className = "hud-card ci-media"; box.id = "mediaBox";
      card.after(box);
      box.addEventListener("input", e => {
        const i = e.target.closest("[data-murl]"); if (!i) return;
        const [eid, n] = i.dataset.murl.split("|"); (CUR.media[eid] = CUR.media[eid] || [])[+n] = i.value.trim();
        i.classList.toggle("bad", !!i.value.trim() && !mediaOk(i.value)); saveCases(); drawPreview();
      });
      box.addEventListener("click", e => {
        const add = e.target.closest("[data-madd]"); if (add) { (CUR.media[add.dataset.madd] = CUR.media[add.dataset.madd] || []).push(""); box.dataset.ck = ""; drawMedia(); const ins = box.querySelectorAll(`[data-murl^="${add.dataset.madd}|"]`); if (ins.length) ins[ins.length - 1].focus(); return; }
        const rm = e.target.closest("[data-mrm]"); if (rm) { const [eid, n] = rm.dataset.mrm.split("|"); (CUR.media[eid] || []).splice(+n, 1); box.dataset.ck = ""; saveCases(); drawMedia(); drawPreview(); }
      });
    }
  }
  function drawTags() { document.querySelectorAll("[data-ftag]").forEach(b => b.classList.toggle("on", CUR.forumTags.includes(b.dataset.ftag))); }
  function mediaOk(u) { try { const x = new URL(String(u).trim()); return x.protocol === "https:" && MEDIA_HOSTS.includes(x.hostname.toLowerCase()) && x.pathname.length > 1; } catch (e) { return false; } }
  function evidenceRows() { return ((CUR.data.repeaters || {}).ccEvidence || []).filter(r => r._id); }
  function drawMedia() {
    const box = $("mediaBox"); if (!box) return;
    const rows = evidenceRows(), key = JSON.stringify([rows.map(r => [r._id, r.etag, r.type, r.desc]), CUR.media]);
    if (box.dataset.ck === key) return; box.dataset.ck = key;
    box.innerHTML = `<header class="hud-chead"><h3>EVIDENCE MEDIA</h3><span class="hud-chip">Imgur · Discord · Medal.tv</span></header>
      <p class="ci-mhelp">Paste an Imgur, Discord or Medal.tv link to attach photos, video or clips to an evidence item. Links are added to the case file and posted to Discord with it.</p>
      ${rows.length ? rows.map(r => { const list = CUR.media[r._id] || [];
        return `<div class="ci-mrow"><div class="ci-mtag"><b>${esc(r.etag || "Evidence")}</b> ${esc(r.type || "")}${r.desc ? ` · ${esc(r.desc)}` : ""}</div>
          ${list.map((u, n) => `<div class="ci-mline"><input type="url" inputmode="url" class="g${u && !mediaOk(u) ? " bad" : ""}" data-murl="${esc(r._id)}|${n}" placeholder="https://i.imgur.com/…, cdn.discordapp.com/… or medal.tv/…" value="${esc(u)}"><button type="button" class="rm" data-mrm="${esc(r._id)}|${n}" aria-label="Remove link">✕</button></div>${/medal\.tv/i.test(u) && mediaOk(u) ? '<small class="ci-mok">Medal.tv clip · posted to Discord with the case file</small>' : u && !mediaOk(u) ? '<small class="ci-mbad">Only https Imgur, Discord or Medal.tv links are accepted.</small>' : ""}`).join("")}
          <button type="button" class="tag-add" data-madd="${esc(r._id)}">＋ Add media link</button></div>`; }).join("") : '<div class="hud-empty">Add evidence above, then attach its photos or clips here.</div>'}`;
  }
  function mediaList() {
    const out = [];
    evidenceRows().forEach(r => (CUR.media[r._id] || []).filter(mediaOk).forEach(u => out.push({ tag: r.etag || "Evidence", url: u.trim() })));
    return out;
  }

  // ---------------- completeness meter (only counts the parts this form still has) ----------------
  function completeness(d) {
    const v = d.values || {}, R = d.repeaters || {}, has = (l, k) => (R[l] || []).some(r => String(r[k] || "").trim());
    const ids = new Set(); (FORM.blocks || []).forEach(b => { if (b.id) ids.add(b.id); (b.fields || []).forEach(f => ids.add(f.id)); });
    const parts = [["ccTitle", v.ccTitle], ["ccLocation", v.ccLocation], ["ccLead", v.ccLead], ["ccBadge", v.ccBadge], ["ccSummary", v.ccSummary], ["ccNarrative", v.ccNarrative], ["ccConclusion", v.ccConclusion],
      ["ccSuspects", has("ccSuspects", "name")], ["ccEvidence", has("ccEvidence", "desc")], ["ccCharges", has("ccCharges", "charge")]].filter(([id]) => ids.has(id));
    // anything an admin marked required counts too
    (FORM.blocks || []).forEach(b => { (b.fields || []).forEach(f => { if (f.required && !parts.some(p => p[0] === f.id)) parts.push([f.id, v[f.id]]); });
      if (b.type === "longtext" && b.required && !parts.some(p => p[0] === b.id)) parts.push([b.id, v[b.id]]); });
    if (!parts.length) return 0;
    return Math.round(parts.filter(([, x]) => x === true || (typeof x === "string" && x.trim())).length / parts.length * 100);
  }
  function drawMeter() { const p = completeness(CUR.data); $("meterBar").style.width = p + "%"; $("meterPct").textContent = p + "%"; $("meterBar").className = p >= 100 ? "full" : ""; }
  function drawCount() { $("caseCount").textContent = CASES.length; }
  function drawProfileChip() {
    const b = $("profileBtn");
    b.innerHTML = PROFILE ? `<span class="ci-dot${isDiscordId(PROFILE.discordId) ? "" : " warn"}"></span>${esc(PROFILE.rank + " " + PROFILE.name)}${PROFILE.callsign ? ` · ${esc(PROFILE.callsign)}` : ""}` : "Sign in";
    b.title = PROFILE && !isDiscordId(PROFILE.discordId) ? "Add your Discord ID to post cases" : "Your officer details";
    $("lockWho").innerHTML = PROFILE ? `Signed in: <b>${esc(PROFILE.rank + " " + PROFILE.name)}</b>${PROFILE.callsign ? ` · Callsign <em>${esc(PROFILE.callsign)}</em>` : ""}` : "Not signed in";
  }

  // ---------------- the case file in three formats ----------------
  const T = s => String(s == null ? "" : s).trim();
  const N = (s, d) => T(s) || (d == null ? "N/A" : d);
  const noIds = s => T(s).split(";").map(x => x.replace(/\s*\(\d{15,21}\)\s*$/, "").trim()).filter(Boolean).join(", ");
  const CLASS_RE = /\((Felony|Misdemeanor|Infraction)[^)]*\)\s*$/i;
  // Built from the form itself, in the form's order, so anything an admin adds, renames or removes in the
  // form editor shows up here. The original sections keep the division's case-file layout.
  const titleCase = t => T(t).replace(/:\s*$/, "").toLowerCase().replace(/(^|[\s/(&-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  const lbl = x => T(x && x.label).replace(/:\s*$/, "") || (x && x.id) || "";
  const one = b => { const m = /^\s*\+?\s*add\s+(.+)$/i.exec(b.addLabel || ""); return m ? titleCase(m[1]) : titleCase(b.title || "Entry").replace(/s$/, ""); };
  const linked = s => T(s).split(";").map(x => x.trim()).filter(Boolean).join(", ");
  function cell(c, val) {
    if (c.type === "check" || c.type === "checkbox") return val ? "Yes" : "No";
    if (c.type === "officer" || c.type === "officers" || c.type === "discord_id") return noIds(val);
    return T(val);
  }
  const PEOPLE = new Set(["ccSuspects", "ccVictims", "ccWitnesses"]);
  function sectionsOf(d) {
    const v = d.values || {}, R = d.repeaters || {}, S = [];
    let cur = null;
    const sec = h => { cur = { h: h, b: [] }; S.push(cur); return cur; };
    const fieldsBlock = rows => { if (!rows.length) return; if (!cur) sec("Case Information"); const last = cur.b[cur.b.length - 1]; if (last && last.k === "fields") last.rows.push(...rows); else cur.b.push({ k: "fields", rows: rows }); };
    const hasLead = (FORM.blocks || []).some(b => (b.fields || []).some(f => f.id === "ccLead"));
    (FORM.blocks || []).forEach(b => {
      if (b.type === "text" && b.style === "heading") { sec(titleCase(b.text)); return; }
      if (b.type === "fields" || b.type === "strip") {
        fieldsBlock((b.fields || []).filter(f => f.type !== "static").flatMap(f => {
          if (hasLead && (f.id === "ccRank" || f.id === "ccBadge")) return [];
          if (f.id === "ccLead") { const lead = [v.ccRank, v.ccLead].map(T).filter(Boolean).join(" "); return [["Lead Investigator", N(lead) + (T(v.ccBadge) ? " #" + T(v.ccBadge) : "")]]; }
          const val = cell(f, v[f.id]);
          return [[f.id === "ccTitle" ? "Case Title" : lbl(f), val || (f.type === "officers" ? "None" : f.id === "ccTitle" ? "Untitled" : "N/A")]];
        }));
        return;
      }
      if (b.type === "longtext") { const t = T(v[b.id]); if (t) sec(titleCase(b.title || b.id)).b.push(...t.split(/\n\s*\n/).map(p => ({ k: "p", text: p.trim() }))); cur = null; return; }
      if (b.type === "checklist") {
        const st = (d.checklists || {})[b.id] || {};
        if (Object.values(st).some(Boolean)) sec(titleCase(b.title || "Checklist")).b.push({ k: "list", items: (b.items || []).map(it => (st[it.topic] ? "✓ " : "✗ ") + it.topic) });
        cur = null; return;
      }
      if (b.type !== "repeater") return;
      const cols = (b.columns || []).concat(b.check ? [Object.assign({ type: "check" }, b.check)] : []), byId = id => cols.find(c => c.id === id);
      const rows = (R[b.id] || []).filter(r => cols.some(c => c.type !== "check" && T(r[c.id])));
      cur = null;
      if (!rows.length) return;
      const s = sec(titleCase(b.title || b.id));
      const rest = (r, skip) => cols.filter(c => !skip.includes(c.id)).map(c => [lbl(c), cell(c, r[c.id])]).filter(([, x], i) => x || cols.filter(c => !skip.includes(c.id))[i].type === "check");
      if (b.id === "ccCharges" && byId("charge")) {
        s.b.push({ k: "list", items: rows.filter(r => T(r.charge)).map(r => {
          const cnt = Math.max(1, parseInt(r.count, 10) || 1), x = Portal.sentence(r.charge, cnt), m = CLASS_RE.exec(r.charge), name = T(r.charge).replace(CLASS_RE, "").trim();
          const extra = [m ? m[1] : "", x.months ? x.months + " months" : "", x.fine ? "$" + x.fine.toLocaleString("en-US") : ""].filter(Boolean).join(" · ");
          const more = cols.filter(c => !["suspect", "charge", "count"].includes(c.id) && c.type !== "check").map(c => T(r[c.id])).filter(Boolean);
          return N(r.suspect, "Unassigned") + ": " + name + " (x" + cnt + ")" + (extra ? " - " + extra : "") + (more.length ? " · " + more.join(" · ") : "") + (b.check && r[b.check.id] ? " · " + lbl(b.check).toLowerCase() : "");
        }) });
      } else if (b.id === "ccTimeline" && byId("event") && cols.length <= 3) {
        s.b.push({ k: "list", items: rows.map(r => N(r.time, "--:--") + " — " + T(r.event)) });
      } else if (b.id === "ccVehicles" && byId("plate")) {
        s.b.push({ k: "list", items: rows.map(r => {
          const more = cols.filter(c => !["plate", "color", "makeModel"].includes(c.id) && c.type !== "check").map(c => lbl(c) + ": " + cell(c, r[c.id])).filter(x => !/:\s*$/.test(x));
          return [T(r.color), T(r.makeModel)].filter(Boolean).join(" ") + (T(r.plate) ? " — plate " + T(r.plate).toUpperCase() : "") + (more.length ? " · " + more.join(" · ") : "") + (T(r._tags) ? " (linked to " + linked(r._tags) + ")" : "") + (b.check && r[b.check.id] ? " · " + lbl(b.check).toLowerCase() : "");
        }) });
      } else if (cols.length <= 2 && !T(rows[0]._tags) && b.id !== "ccEvidence" && !PEOPLE.has(b.id)) {
        s.b.push({ k: "list", items: rows.map(r => cols.map(c => cell(c, r[c.id])).filter(Boolean).join(" — ")) });
      } else {
        // people, evidence and any list an admin adds: one entry per row
        const ev = b.id === "ccEvidence", first = ev ? null : cols.find(c => c.type !== "check");
        rows.forEach((r, i) => {
          if (ev) s.b.push({ k: "sub", text: "[" + N(r.etag, "—") + "] " + N(r.type, "Evidence") });
          else s.b.push({ k: "sub", text: one(b) + " " + (i + 1) + ": " + N(cell(first, r[first.id]), PEOPLE.has(b.id) ? "Unidentified" : "—") });
          const f = rest(r, ev ? ["etag", "type"] : [first.id]);
          if (PEOPLE.has(b.id)) { const st = f.find(x => x[0] === lbl(byId("status"))); if (byId("status") && !st) f.unshift([lbl(byId("status")), "Unknown"]); }
          if (T(r._tags)) f.push(["Linked To", linked(r._tags)]);
          if (f.length) s.b.push({ k: "fields", rows: f });
          const media = ((CUR.media || {})[r._id] || []).filter(mediaOk);
          if (media.length) s.b.push({ k: "list", items: media.map(u => (/medal\.tv/i.test(u) ? "Medal clip" : "Media") + ": " + u) });
        });
      }
    });
    return S.filter(x => x.b.length);
  }
  const EQ = "=".repeat(56), DASH = "-".repeat(56);
  const center = s => " ".repeat(Math.max(0, Math.floor((EQ.length - s.length) / 2))) + s;
  function filedBy(v) { return ["Filed by: " + N([v.ccRank, v.ccLead].map(T).filter(Boolean).join(" "), "________________") + (T(v.ccBadge) ? " #" + T(v.ccBadge) : ""), "Date: " + N(v.ccDate)]; }
  function format(d, fmt) {
    const v = d.values || {}, S = sectionsOf(d), dept = N(v.ccDivision, "LSPD Criminal Investigations Division");
    if (fmt === "discord") {
      const o = ["# 🗂️ " + dept + " — Case File", "## " + N(v.ccCaseNo) + " · " + N(v.ccTitle, "Untitled"), ""];
      S.forEach(s => { o.push("### " + s.h); s.b.forEach(b => b.k === "fields" ? b.rows.forEach(([a, c]) => o.push("**" + a + ":** " + c)) : b.k === "p" ? o.push(b.text, "") : b.k === "sub" ? o.push("", "__**" + b.text + "**__") : b.items.forEach(i => o.push("- " + i))); if (o[o.length - 1] !== "") o.push(""); });
      return o.concat(["---"], filedBy(v).map(x => "*" + x + "*")).join("\n");
    }
    if (fmt === "bbcode") {
      const o = ["[center][size=150][b]" + dept.toUpperCase() + "[/b][/size]", "[b]OFFICIAL CASE FILE — " + N(v.ccCaseNo) + "[/b]", N(v.ccTitle, "Untitled") + "[/center]", "[hr]"];
      S.forEach(s => { o.push("[size=120][b][u]" + s.h.toUpperCase() + "[/u][/b][/size]"); s.b.forEach(b => b.k === "fields" ? b.rows.forEach(([a, c]) => o.push("[b]" + a + ":[/b] " + c)) : b.k === "p" ? o.push(b.text, "") : b.k === "sub" ? o.push("", "[b][i]" + b.text + "[/i][/b]") : o.push("[list]", ...b.items.map(i => "[*]" + i), "[/list]")); o.push(""); });
      return o.concat(["[hr]"], filedBy(v).map(x => "[i]" + x + "[/i]")).join("\n");
    }
    const o = [EQ, center(dept.toUpperCase()), center("OFFICIAL CASE FILE"), center(N(v.ccCaseNo)), EQ, ""];
    S.forEach(s => { o.push("[ " + s.h.toUpperCase() + " ]", DASH);
      s.b.forEach(b => { if (b.k === "fields") { const w = Math.max(...b.rows.map(([a]) => a.length)); b.rows.forEach(([a, c]) => o.push((a + ":").padEnd(w + 2) + c)); }
        else if (b.k === "p") o.push(b.text, ""); else if (b.k === "sub") o.push("", "> " + b.text); else b.items.forEach(i => o.push("  • " + i)); });
      if (o[o.length - 1] !== "") o.push(""); });
    return o.concat([DASH], filedBy(v), [EQ]).join("\n");
  }
  const stampOf = st => /^closed/i.test(T(st)) ? "CLOSED" : /cold/i.test(T(st)) ? "COLD" : "CONFIDENTIAL";
  const NOTES = { text: "Plain text — works in any MDT, notes app or Google Doc.", discord: "Markdown — paste straight into a Discord channel.", bbcode: "BBCode — for Invision / phpBB / XenForo department forums." };
  function drawPreview() {
    const d = CUR.data, v = d.values || {};
    $("preview").textContent = format(d, FMT);
    $("fmtNote").textContent = NOTES[FMT];
    $("paperSub").textContent = "OFFICIAL CASE FILE · " + N(v.ccCaseNo);
    const st = stampOf(v.ccStatus); $("stamp").textContent = st; $("stamp").className = "ci-stamp s-" + st.toLowerCase();
    document.querySelectorAll("[data-fmt]").forEach(b => b.classList.toggle("on", b.dataset.fmt === FMT));
  }

  // ---------------- the case-file picture posted with the case ----------------
  function loadImg(src) { return new Promise(res => { const i = new Image(); if (/^https?:/i.test(src) && !src.startsWith(location.origin)) i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
  function wrap(ctx, text, max) {
    const out = [];
    text.split("\n").forEach(line => {
      if (ctx.measureText(line).width <= max) { out.push(line); return; }
      const ind = (line.match(/^\s*/) || [""])[0]; let cur = "";
      line.trim().split(/\s+/).forEach(w => { const t = cur ? cur + " " + w : ind + w; if (cur && ctx.measureText(t).width > max) { out.push(cur); cur = ind + w; } else cur = t; });
      out.push(cur);
    });
    return out;
  }
  async function caseImage(d) {
    try { await Promise.all([document.fonts.load('15px "Courier Prime"'), document.fonts.load("bold 22px Oswald")]); } catch (e) {}
    let badge = await loadImg(FORM.logoUrl || "img/lspd-seal.png");
    const draw = async (useBadge) => {
      const W = 900, LH = 24, TOP = 150, c = document.createElement("canvas"), x = c.getContext("2d");
      x.font = '15px "Courier Prime", "Courier New", monospace';
      const lines = wrap(x, format(d, "text"), W - 128), H = TOP + lines.length * LH + 50, scale = Math.max(1, Math.min(2, 16000 / H));
      c.width = Math.round(W * scale); c.height = Math.round(H * scale); x.scale(scale, scale);
      x.fillStyle = "#f8f3e8"; x.fillRect(0, 0, W, H);
      x.fillStyle = "rgba(155,43,34,.25)"; x.fillRect(40, 112, 1, H - 112);
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, "#000"); g.addColorStop(.5, "#4a1714"); g.addColorStop(1, "#000");
      x.fillStyle = g; x.fillRect(0, 0, W, 112); x.fillStyle = "#e8b54a"; x.fillRect(0, 107, W, 5);
      let tx = 64; if (useBadge && badge) { x.drawImage(badge, 56, 18, 72, 72); tx = 148; }
      x.fillStyle = "#e8b54a"; x.font = "bold 24px Oswald, Impact, sans-serif"; x.textBaseline = "alphabetic"; x.fillText("LSPD CRIMINAL INVESTIGATIONS DIVISION", tx, 54);
      x.fillStyle = "#d4d7dd"; x.font = "14px Oswald, Impact, sans-serif"; x.fillText(("OFFICIAL CASE FILE · " + N((d.values || {}).ccCaseNo)).toUpperCase(), tx, 80);
      x.fillStyle = "#2b1d19"; x.font = '15px "Courier Prime", "Courier New", monospace'; x.textBaseline = "top";
      lines.forEach((l, i) => x.fillText(l, 64, TOP + i * LH));
      x.save(); x.translate(750, 172); x.rotate(-12 * Math.PI / 180); x.font = "bold 22px Oswald, Impact, sans-serif";
      const st = stampOf((d.values || {}).ccStatus), w = x.measureText(st).width + 36;
      x.strokeStyle = "rgba(155,43,34,.7)"; x.lineWidth = 3; x.strokeRect(-w / 2, -20, w, 40); x.fillStyle = "rgba(155,43,34,.7)"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(st.split("").join(" "), 0, 1); x.restore();
      return c.toDataURL("image/png");
    };
    try { return await draw(true); } catch (e) { return await draw(false); }   // a badge from another site can block the picture: draw it without
  }

  // ---------------- Post / Save to Discord ----------------
  function drawPostBtns() {
    const posted = !!CUR.submissionId;
    $("saveDiscordBtn").hidden = !posted;
    $("postBtn").textContent = posted ? "📨 Post again" : "📨 Post to Discord";
  }
  async function send(update) {
    if (!PROFILE || !isDiscordId(PROFILE.discordId)) { toast("Add your Discord ID to your officer profile (header) before " + (update ? "saving." : "posting."), "bad"); openProfile(); return; }
    const problem = ctrl.validate(); if (problem) { toast("Missing info: " + problem, "bad"); return; }
    const d = ctrl.collect(), media = mediaList(), v = d.values;
    if (!T(v.ccNarrative)) { toast("Missing info: Investigator Narrative is required.", "bad"); return; }
    const msg = update ? `Save your edits to the Discord post for ${v.ccCaseNo || "this case"}?` :
      `Post ${v.ccCaseNo || "this case file"} to the division Discord?\n\nYou will be tagged, and the case goes to Command for review.` + (CUR.submissionId ? "\n\nThis case was already posted. To update that post instead, use Save to Discord." : "") + (media.length ? `\n\n${media.length} evidence media link${media.length === 1 ? "" : "s"} will be posted with it.` : "");
    if (!confirm(msg)) return;
    const btn = update ? $("saveDiscordBtn") : $("postBtn"), label = btn.textContent;
    btn.disabled = true; btn.textContent = update ? "Saving…" : "Posting…";
    try {
      const image = await caseImage(d);
      const res = await Portal.post(Object.assign({}, d, { form: FORM.id, cid: { profile: PROFILE, forumTags: CUR.forumTags, media: media, image: image, report: format(d, "text"), caseData: Object.assign({}, d, { forumTags: CUR.forumTags, media: CUR.media }), update: update ? CUR.submissionId : "" } }));
      if (!res.ok) throw new Error(res.error || "Posting to Discord failed.");
      if (res.id) CUR.submissionId = res.id;
      CUR.posted = Date.now(); saveCases(); drawPostBtns(); drawReview();
      toast(update ? "Edits saved and the Discord post updated" + (res.warning ? " (" + res.warning + ")" : "") : "Case file posted to Discord and sent to Command" + (res.warning ? " (" + res.warning + ")" : ""), res.warning ? "bad" : "ok");
    } catch (e) { toast(e.message || "Posting to Discord failed.", "bad"); }
    finally { btn.disabled = false; btn.textContent = label; drawPostBtns(); }
  }

  // ---------------- Command review status ----------------
  async function pollReviews() {
    const ids = CASES.map(c => c.submissionId).filter(Boolean); if (!ids.length) return;
    try {
      const res = await Portal.post({ action: "cidMine", ids: ids }); if (!res.ok) return;
      (res.reviews || []).forEach(r => {
        const c = CASES.find(x => x.submissionId === r.id); if (!c) return;
        const before = c.review ? c.review.review + c.review.gradedAt : "";
        c.review = r;
        if (r.review !== "pending" && before && before !== r.review + r.gradedAt) toast(`Command reviewed ${(c.data.values || {}).ccCaseNo || "your case"}: ${r.review === "accepted" ? "Accepted" : "Denied"}${r.grade ? " · Grade " + r.grade : ""}`, r.review === "accepted" ? "ok" : "bad");
      });
      saveCases(); drawReview();
    } catch (e) {}
  }
  function drawReview() {
    const box = $("review"), r = CUR && CUR.review;
    if (!CUR || !CUR.submissionId) { box.hidden = true; return; }
    box.hidden = false;
    if (!r || r.review === "pending") { box.className = "ci-review pending"; box.innerHTML = `<b>🛡️ Command review</b><span>Posted${CUR.posted ? " " + new Date(CUR.posted).toLocaleString() : ""} · waiting for Command to review it.</span>`; return; }
    box.className = "ci-review " + r.review;
    box.innerHTML = `<b>🛡️ Command review: ${r.review === "accepted" ? "✅ Accepted" : "❌ Denied"}${r.grade ? ` · Grade <em>${esc(r.grade)}</em>` : ""}</b><span>${r.gradedBy ? "by " + esc(r.gradedBy) : ""}${r.gradedAt ? " · " + esc(new Date(r.gradedAt).toLocaleString()) : ""}</span>${r.comments ? `<p>${esc(r.comments)}</p>` : ""}`;
  }

  // ---------------- modals: profile, my cases, dashboard ----------------
  function modal(html, cls) {
    $("modalCard").className = "ci-modal-card " + (cls || ""); $("modalCard").innerHTML = html; $("modal").hidden = false;
    $("modalCard").querySelectorAll("[data-close]").forEach(b => b.onclick = closeModal);
    return $("modalCard");
  }
  function closeModal() { $("modal").hidden = true; $("modalCard").innerHTML = ""; }
  $("modal").addEventListener("mousedown", e => { if (e.target === $("modal")) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("modal").hidden) closeModal(); });
  function openProfile() { const c = modal(`<button type="button" class="ci-x" data-close aria-label="Close">✕</button>` + profileForm(false), "narrow"); wireProfileForm(c, () => { closeModal(); toast("Officer details saved", "ok"); }); }

  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : new Date(t).toLocaleDateString(); };
  const caseTitle = c => { const v = (c.data && c.data.values) || {}; return T(v.ccTitle) || "Untitled case"; };
  function openCases() {
    const list = CASES.slice().sort((a, b) => b.updated - a.updated);
    const c = modal(`<button type="button" class="ci-x" data-close aria-label="Close">✕</button>
      <h2>My cases</h2><p class="ci-sub">Case files saved in this browser. Export a case to back it up or hand it to another detective.</p>
      <div class="ci-mbar"><label class="ci-btn"><input type="file" id="impFile" accept=".json,application/json" multiple hidden>⤒ Import case files</label><button type="button" class="ci-btn" id="expAll">⤓ Export all</button><button type="button" class="ci-btn" id="example">📁 Load example case</button><button type="button" class="ci-btn gold" id="mNew">＋ New case</button></div>
      <div class="ci-clist">${list.map(x => { const v = (x.data && x.data.values) || {}, p = completeness(x.data || {}), r = x.review;
        return `<div class="ci-crow${x.id === CUR.id ? " cur" : ""}" data-cid="${esc(x.id)}">
          <div class="ci-cmain"><b>${esc(caseTitle(x))}</b><small>${esc(v.ccCaseNo || "")} · ${esc(v.ccClass || "No classification")} · <span class="st st-${esc(stampOf(v.ccStatus).toLowerCase())}">${esc(v.ccStatus || "Open")}</span>${x.submissionId ? ` · ${r && r.review !== "pending" ? (r.review === "accepted" ? "✅ Accepted" : "❌ Denied") + (r.grade ? " " + esc(r.grade) : "") : "⏳ With Command"}` : ""}</small>
            <div class="ci-cmeter"><i style="width:${p}%"></i></div></div>
          <span class="ci-cwhen">${x.id === CUR.id ? "Editing" : esc(ago(x.updated))}</span>
          <div class="ci-cacts"><button type="button" class="ci-btn sm" data-act="open">Open</button><button type="button" class="ci-btn sm" data-act="rename">Rename</button><button type="button" class="ci-btn sm" data-act="dup">Duplicate</button><button type="button" class="ci-btn sm" data-act="exp">Export</button><button type="button" class="ci-btn sm danger" data-act="del">Delete</button></div></div>`; }).join("")}</div>`, "wide");
    c.querySelector("#mNew").onclick = () => { closeModal(); newCase(); };
    c.querySelector("#expAll").onclick = () => download("cid-cases-" + todayISO() + ".json", JSON.stringify({ kind: "cid-case-files", version: 1, cases: CASES }, null, 1), "application/json");
    c.querySelector("#example").onclick = () => { const x = fromTheirs(EXAMPLE); CASES.unshift(x); saveCases(); CUR = x; closeModal(); mountCase(); toast("Example case loaded", "ok"); };
    c.querySelector("#impFile").onchange = e => importFiles(e.target.files);
    c.querySelector(".ci-clist").addEventListener("click", e => {
      const b = e.target.closest("[data-act]"), row = e.target.closest("[data-cid]"); if (!b || !row) return;
      const x = CASES.find(y => y.id === row.dataset.cid); if (!x) return;
      const act = b.dataset.act;
      if (act === "open") { CUR = x; closeModal(); mountCase(); }
      else if (act === "rename") {
        const cm = row.querySelector(".ci-cmain"); cm.innerHTML = `<label class="ci-ren"><span>Case title</span><input class="g" value="${esc(caseTitle(x) === "Untitled case" ? "" : caseTitle(x))}"></label><div class="ci-ren-b"><button type="button" class="ci-btn sm gold" data-ren="save">Save name</button><button type="button" class="ci-btn sm" data-ren="cancel">Cancel rename</button></div>`;
        const inp = cm.querySelector("input"); inp.focus(); inp.select();
        const save = () => { x.data.values = x.data.values || {}; x.data.values.ccTitle = inp.value.trim(); x.updated = Date.now(); saveCases(); if (x.id === CUR.id && ctrl) ctrl.setValue("ccTitle", inp.value.trim()); openCases(); };
        cm.querySelector('[data-ren="save"]').onclick = save; cm.querySelector('[data-ren="cancel"]').onclick = openCases; inp.onkeydown = ev => { if (ev.key === "Enter") save(); if (ev.key === "Escape") { ev.stopPropagation(); openCases(); } };
      }
      else if (act === "dup") { const y = JSON.parse(JSON.stringify(x)); y.id = ID(); y.created = y.updated = Date.now(); y.submissionId = ""; y.review = null; y.posted = 0; y.data.values.ccTitle = caseTitle(x) + " (copy)"; y.data.values.ccCaseNo = genCaseNo(); CASES.unshift(y); saveCases(); openCases(); toast("Case duplicated", "ok"); }
      else if (act === "exp") download(((x.data.values || {}).ccCaseNo || "case-file") + ".json", JSON.stringify({ kind: "cid-case-files", version: 1, cases: [x] }, null, 1), "application/json");
      else if (act === "del") {
        if (!confirm(`Delete "${caseTitle(x)}" from this browser?` + (x.submissionId ? "\n\nIts Discord post and Command's copy stay." : "") + "\n\nExport it first if you want a backup.")) return;
        CASES = CASES.filter(y => y !== x); saveCases();
        if (x.id === CUR.id) { CUR = CASES[0] || newCase(true); mountCase(); }
        openCases();
      }
    });
  }
  function download(name, text, type) { const b = new Blob([text], { type: (type || "text/plain") + ";charset=utf-8" }), u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
  async function importFiles(files) {
    let n = 0;
    for (const f of files) {
      try {
        const j = JSON.parse(await f.text());
        const list = Array.isArray(j) ? j : Array.isArray(j.cases) ? j.cases : [j];
        list.forEach(raw => {
          let x = null;
          if (raw && raw.data && raw.data.values) x = Object.assign({ forumTags: [], media: {} }, raw);         // exported from this page
          else if (raw && (raw.caseNumber != null || raw.suspects)) x = fromTheirs(raw.data && raw.data.caseNumber != null ? raw.data : raw);   // the division's old builder
          else if (raw && raw.data && raw.data.caseNumber != null) x = fromTheirs(raw.data);
          if (!x) return;
          x.id = ID(); x.updated = Date.now(); x.submissionId = x.submissionId && CASES.some(c => c.submissionId === x.submissionId) ? "" : (x.submissionId || "");
          CASES.unshift(x); n++;
        });
      } catch (e) {}
    }
    saveCases();
    if (n) { toast("Imported " + n + " case" + (n === 1 ? "" : "s"), "ok"); openCases(); } else toast("Could not import. Pick a case file exported from a CID case builder.", "bad");
  }
  // a case from the division's original builder → this page
  function fromTheirs(e) {
    const people = (l, ph) => (l || []).map(p => ({ _id: ID(), name: p.name || "", status: p.status || "Unknown", dob: p.dob || "", phone: p.phone || "", details: p.details || "" }));
    const media = {};
    const evidence = (e.evidence || []).map(x => { const id = ID(); if ((x.media || []).length) media[id] = x.media.slice(); return { _id: id, _tags: "", etag: x.tag || "", type: x.type || "Physical", desc: x.description || "", where: x.location || "", by: x.collectedBy || "", logged: false }; });
    const opts = (((FORM.blocks || []).find(b => b.id === "ccCharges") || {}).columns || []).find(c => c.id === "charge"), list = (opts && opts.options) || [];
    const findCharge = n => list.find(o => o.toLowerCase().startsWith(String(n || "").toLowerCase() + " (")) || n;
    return { id: ID(), created: Date.now(), updated: Date.now(), forumTags: (e.forumTags || []).map(String), media: media, submissionId: "", review: null,
      data: { values: { ccCaseNo: e.caseNumber || genCaseNo(), ccDate: e.dateOpened || todayISO(), ccTitle: e.title || "", ccClass: e.classification || "", ccLocation: e.location || "", ccStatus: e.status || "Open", ccPriority: e.priority || "Medium",
        ccRank: e.leadRank || "Detective", ccLead: e.leadName || "", ccBadge: e.leadBadge || "", ccDivision: e.department || "LSPD Criminal Investigations Division", ccCerts: e.certification || "None", ccAssist: e.assisting || "",
        ccSummary: e.summary || "", ccNarrative: e.narrative || "", ccConclusion: e.conclusion || "" }, checklists: {},
        repeaters: { ccSuspects: people(e.suspects), ccVictims: people(e.victims), ccWitnesses: people(e.witnesses), ccEvidence: evidence,
          ccTimeline: (e.timeline || []).map(t => ({ _id: ID(), time: t.time || "", event: t.event || "" })),
          ccCharges: (e.charges || []).map(c => ({ suspect: c.suspect || "", charge: findCharge(c.charge), count: String(c.counts || 1), warrant: false })) } } };
  }
  const EXAMPLE = { caseNumber: "CID-26-4471", title: "Fleeca Bank Robbery — Great Ocean Hwy", classification: "Bank Robbery", status: "Pending Warrant", priority: "High", forumTags: ["1294796677873401949", "1331732924818522213"], dateOpened: "2026-10-24", location: "Fleeca Bank, Great Ocean Highway, Chumash",
    department: "LSPD Criminal Investigations Division", certification: "None", leadName: "R. Calloway", leadRank: "Lead Detective", leadBadge: "417", assisting: "Det. M. Reyes #382, Ofc. J. Park #561",
    summary: "Three masked suspects entered the Fleeca Bank on Great Ocean Hwy armed with rifles, held two employees at gunpoint and breached the vault. Suspects fled northbound in a black Kuruma before units arrived.",
    suspects: [{ name: 'Tyrone "Lucky" Vance', dob: "1994-03-12", phone: "555-0192", status: "At Large", details: "Male, approx. 6'1\", tattoo on left hand. Identified via vault camera after mask slipped. Known associate of the Families." }, { name: "Unknown Suspect #2", status: "Unknown", details: "Male, medium build, green hoodie, carried a thermite charge." }],
    victims: [{ name: "Clara Whitmore", dob: "1988-07-02", phone: "555-0144", status: "Hospitalized", details: "Bank teller. Struck with rifle butt; treated at Pillbox Medical." }],
    witnesses: [{ name: "Douglas Ferris", phone: "555-0177", status: "Cooperating", details: 'Gas station attendant across the highway. Saw the Kuruma head north toward Paleto, partial plate "4K".' }],
    evidence: [{ tag: "EV-001", type: "Ballistic", description: "5.56mm shell casings (x6)", location: "Bank lobby floor", collectedBy: "Det. M. Reyes #382" }, { tag: "EV-002", type: "Video", description: "Vault CCTV footage, 14:02–14:09", location: "Fleeca security office", collectedBy: "Det. Sgt. R. Calloway #417" }],
    timeline: [{ time: "14:01", event: "Silent alarm triggered at Fleeca Great Ocean Hwy." }, { time: "14:09", event: "Suspects exit with vault contents and flee northbound." }, { time: "14:12", event: "First units on scene; teller found injured." }],
    charges: [{ suspect: 'Tyrone "Lucky" Vance', charge: "Robbery", counts: "1" }, { suspect: 'Tyrone "Lucky" Vance', charge: "Aggravated Assault", counts: "1" }, { suspect: 'Tyrone "Lucky" Vance', charge: "Kidnapping", counts: "2" }],
    narrative: "On the above date I was dispatched to the Fleeca Bank on Great Ocean Highway regarding a robbery in progress. Upon arrival the suspects had already fled. I reviewed CCTV footage with bank management and observed a suspect's mask slip, revealing his face. A facial comparison against MDT records returned a match for Tyrone Vance.\n\nEvidence was collected, photographed and logged into evidence lockup at Mission Row.",
    conclusion: "Probable cause exists to charge Tyrone Vance with the listed offenses. Requesting an arrest warrant from the DOJ. Investigation into Suspect #2 remains ongoing." };

  function openDash() {
    const all = CASES.map(c => (c.data && c.data.values) || {}), closed = v => /^closed/i.test(v.ccStatus || ""), open = all.filter(v => !closed(v) && !/cold/i.test(v.ccStatus || ""));
    const count = (arr, k) => { const m = {}; arr.forEach(v => { const x = T(v[k]) || "—"; m[x] = (m[x] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const bars = rows => { const max = Math.max(1, ...rows.map(r => r[1])); return rows.length ? rows.map(([k, n]) => `<div class="ci-barrow"><span>${esc(k)}</span><div><i style="width:${n / max * 100}%"></i></div><b>${n}</b></div>`).join("") : '<div class="ci-sub">Nothing yet.</div>'; };
    const recent = CASES.slice().sort((a, b) => b.updated - a.updated).slice(0, 6);
    modal(`<button type="button" class="ci-x" data-close aria-label="Close">✕</button><h2>Division dashboard</h2><p class="ci-sub">From the case files saved in this browser.</p>
      <div class="ci-kpis"><div><small>Total cases</small><b>${all.length}</b></div><div><small>Open</small><b>${open.length}</b></div><div><small>Closed</small><b>${all.filter(closed).length}</b></div><div class="hot"><small>Open · High / Critical</small><b>${open.filter(v => /high|critical/i.test(v.ccPriority || "")).length}</b></div></div>
      <div class="ci-dash2"><div><h3>Open cases by detective</h3>${bars(count(open, "ccLead"))}</div><div><h3>Cases by classification</h3>${bars(count(all, "ccClass"))}</div></div>
      <h3>Recently updated</h3><div class="ci-recent">${recent.map(c => `<button type="button" class="ci-rec" data-open="${esc(c.id)}"><b>${esc(caseTitle(c))}</b><small>${esc((c.data.values || {}).ccCaseNo || "")} · ${esc(ago(c.updated))}</small></button>`).join("") || '<div class="ci-sub">No cases yet.</div>'}</div>`, "wide")
      .addEventListener("click", e => { const b = e.target.closest("[data-open]"); if (!b) return; const x = CASES.find(c => c.id === b.dataset.open); if (x) { CUR = x; closeModal(); mountCase(); } });
  }

  // ---------------- idle lock (5 minutes away) ----------------
  const Idle = {
    t: null, ms: 5 * 60 * 1000,
    start() { ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"].forEach(ev => addEventListener(ev, () => Idle.poke(), { passive: true })); this.poke(); },
    poke() { if (!$("lock").hidden) return; clearTimeout(this.t); this.t = setTimeout(() => this.lock(), this.ms); },
    clock: null,
    tickClock() {   // the computer's own clock and date
      const d = new Date();
      $("lockTime").textContent = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
      $("lockDate").textContent = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    },
    lock() { afterChange(false); drawProfileChip(); this.tickClock(); clearInterval(this.clock); this.clock = setInterval(() => this.tickClock(), 1000); $("lock").hidden = false; Beat.duck(true); },
    unlock() { clearInterval(this.clock); $("lock").hidden = true; Beat.duck(false); this.poke(); }
  };
  $("unlockBtn").onclick = () => Idle.unlock();
  $("lockChange").onclick = () => { Idle.unlock(); openProfile(); };

  // ---------------- background beat (made live in the browser, no audio files) ----------------
  const Beat = (() => {
    let ctx = null, master = null, on = false, timer = null, step = 0, next = 0, duck = 1;
    const st = LS.get(K.beat, { on: true, vol: 35 });
    const BPM = 82, SPB = 60 / BPM / 4;                                    // 16th notes
    const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]];  // Am7 · Fmaj7 · G7 · Em7
    const hz = n => 440 * Math.pow(2, (n - 69) / 12);
    function setup() {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
      master.connect(comp).connect(lp).connect(ctx.destination);
      // vinyl crackle
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.6 : (Math.random() * 2 - 1) * 0.012;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const cg = ctx.createGain(); cg.gain.value = 0.35; src.connect(cg).connect(master); src.start();
    }
    function noise(t, dur, gain, freq, type) {
      const len = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur);
    }
    function kick(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35); o.connect(g).connect(master); o.start(t); o.stop(t + 0.36); }
    function keys(t, notes, dur) {
      notes.forEach((n, i) => { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = "triangle"; o2.type = "sine"; o.frequency.value = hz(n); o2.frequency.value = hz(n) * 1.003; f.type = "lowpass"; f.frequency.value = 1400;
        const at = t + i * 0.012; g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.07, at + 0.04); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
        o.connect(f); o2.connect(f); f.connect(g).connect(master); o.start(at); o2.start(at); o.stop(at + dur); o2.stop(at + dur); });
    }
    function bass(t, n) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = hz(n - 24); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + SPB * 7); o.connect(g).connect(master); o.start(t); o.stop(t + SPB * 8); }
    function tick() {
      while (next < ctx.currentTime + 0.25) {
        const s = step % 64, bar = Math.floor(s / 16), b16 = s % 16, swing = b16 % 2 ? SPB * 0.18 : 0, t = next + swing;
        if (b16 === 0 || b16 === 10) kick(t);
        if (b16 === 4 || b16 === 12) noise(t, 0.22, 0.35, 1800, "bandpass");
        if (b16 % 2 === 0) noise(t, 0.05, b16 % 4 ? 0.06 : 0.1, 7000, "highpass");
        if (b16 === 0) { keys(t, CHORDS[bar], SPB * 15); bass(t, CHORDS[bar][0]); }
        if (b16 === 8) bass(t, CHORDS[bar][0] + (bar % 2 ? 7 : 0));
        next += SPB; step++;
      }
    }
    function level() { return on ? Math.pow(st.vol / 100, 1.6) * 0.55 * duck : 0; }
    function apply() { if (master) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.15); drawBtn(); }
    function play() { if (!ctx) setup(); if (ctx.state === "suspended") ctx.resume(); if (!timer) { next = ctx.currentTime + 0.1; timer = setInterval(tick, 60); } on = true; apply(); }
    function stop() { on = false; apply(); }
    function drawBtn() { $("beatBtn").textContent = on && st.vol > 0 ? "🔊" : "🔇"; $("beatVol").value = st.vol; }
    $("beatBtn").onclick = () => { if (on) { stop(); st.on = false; } else { play(); st.on = true; if (!st.vol) st.vol = 35; } LS.set(K.beat, st); drawBtn(); };
    $("beatVol").oninput = e => { st.vol = +e.target.value; st.on = st.vol > 0; LS.set(K.beat, st); if (st.vol > 0 && !on) play(); else apply(); };
    drawBtn();
    return { userStart() { if (st.on && st.vol > 0) { try { play(); } catch (e) {} } }, duck(x) { duck = x ? 0.25 : 1; apply(); } };
  })();

  // ---------------- header + output buttons ----------------
  $("profileBtn").onclick = openProfile;
  $("casesBtn").onclick = openCases;
  $("dashBtn").onclick = openDash;
  $("newBtn").onclick = () => newCase();
  $("exportBtn").onclick = () => { if (!CUR) return; afterChange(false); download(((CUR.data.values || {}).ccCaseNo || "case-file") + ".json", JSON.stringify({ kind: "cid-case-files", version: 1, cases: [CUR] }, null, 1), "application/json"); toast("Case exported: keep the file to back it up or send it to another detective.", "ok"); };
  document.querySelectorAll("[data-fmt]").forEach(b => b.onclick = () => { FMT = b.dataset.fmt; LS.set(K.fmt, FMT); drawPreview(); });
  $("copyBtn").onclick = async () => {
    const text = format(CUR.data, FMT);
    try { await navigator.clipboard.writeText(text); toast("Case file copied to clipboard", "ok"); }
    catch (e) { const r = document.createRange(); r.selectNodeContents($("preview")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast("Couldn't reach the clipboard: the text is selected, press Ctrl+C.", "bad"); }
  };
  $("dlBtn").onclick = () => download(((CUR.data.values || {}).ccCaseNo || "case-file") + (FMT === "discord" ? ".md" : ".txt"), format(CUR.data, FMT));
  $("printBtn").onclick = () => window.print();
  $("postBtn").onclick = () => send(false);
  $("saveDiscordBtn").onclick = () => send(true);
  addEventListener("beforeunload", () => { if (ctrl && CUR) { CUR.data = ctrl.collect(); saveCases(); } });

  runIntro();
  loadConfig();
})();
