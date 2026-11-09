// ==UserScript==
// @name         LSPD MDT · Duty Portal sync
// @namespace    https://lspdisthebest.net/
// @version      1.4.0
// @description  Reads Duty Portal hours, shifts and reports for the LSPD MDT promotion board, and updates the Duty Portal roster after promotions are marked done in the MDT. Runs in your own logged-in browser; never sees your password.
// @match        https://portal.vanitydesigns.cloud/portal/lspd*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @run-at       document-idle
// @noframes
// @downloadURL  https://raw.githubusercontent.com/Izzy24249/lspd-portal/main/site/tools/lspd-duty-sync.user.js
// @updateURL    https://raw.githubusercontent.com/Izzy24249/lspd-portal/main/site/tools/lspd-duty-sync.user.js
// ==/UserScript==
(function () {
  "use strict";
  if (window.top !== window) return;   // never inside the hidden frames it opens itself
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbyQlnEtA7DJRHnnLJsalqvsvNK3yiuOmoBAlzNWM9qk2AebZEwyHkjtfKqxW9hB65jB/exec";
  const BASE = "/portal/lspd", REVISIT = 24 * 3600e3, ONDUTY_REVISIT = 3 * 3600e3, TAB = Math.random().toString(36).slice(2);
  const get = (k, d) => { try { const v = GM_getValue(k); return v === undefined ? d : v; } catch (e) { return d; } };
  const set = (k, v) => { try { GM_setValue(k, v); } catch (e) {} };
  // timers from a tiny worker: a Duty Portal tab in the background gets its own timers slowed to once a minute by the browser, workers don't
  const WT = (() => { try { const w = new Worker(URL.createObjectURL(new Blob(["onmessage=e=>setTimeout(()=>postMessage(e.data[0]),e.data[1])"], { type: "text/javascript" }))), cb = {}; let n = 0;
    w.onmessage = e => { const f = cb[e.data]; delete cb[e.data]; if (f) f(); }; return (f, ms) => { cb[++n] = f; w.postMessage([n, ms]); }; } catch (e) { return null; } })();
  const sleep = ms => new Promise(r => (WT || setTimeout)(r, ms));
  let RUNNING = false, STATUS = "", timer = null;
  const PAGE_T0 = Date.now(), FULL_EVERY = 4 * 3600e3, RELOAD_AFTER = 2 * 3600e3;   // memory: full officer list only every 4 h; the tab refreshes itself every ~2 h
  const rand = (a, b) => a + Math.random() * (b - a);
  const nextGap = () => Math.round(rand(11, 15) * 60e3);   // each sync waits a random 11–15 minutes

  // ---------- little badge in the corner ----------
  const badge = document.createElement("div");
  badge.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:2147483647;font:600 12px/1.3 system-ui,Segoe UI,sans-serif;background:#0e1626;color:#e6edf8;border:1px solid rgba(122,176,255,.45);border-radius:999px;padding:7px 13px;box-shadow:0 8px 24px rgba(0,0,0,.5);cursor:pointer;user-select:none;max-width:360px";
  badge.title = "LSPD MDT sync — click for options";
  document.body.appendChild(badge);
  const ago = t => { if (!t) return "never"; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago"; };
  function draw() {
    const key = get("key", ""), paused = get("paused", false), last = get("last", 0), err = get("err", "");
    const dot = !key ? "#ffbe3d" : paused ? "#8b99b3" : err ? "#ff5d6c" : "#34d996";
    badge.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + dot + ';margin-right:7px"></span>LSPD sync · ' +
      (!key ? "click to set up" : paused ? "paused" : RUNNING ? STATUS || "syncing…" : err ? "error: " + err : "✓ " + ago(last) + (get("next", 0) > Date.now() ? " · next in " + Math.max(1, Math.round((get("next", 0) - Date.now()) / 60000)) + " min" : ""));
  }
  badge.onclick = () => {
    const key = get("key", "");
    if (!key) return askKey();
    const c = prompt("LSPD MDT sync\n\n1 = Sync now\n2 = " + (get("paused", false) ? "Resume" : "Pause") + "\n3 = Change sync key\n4 = Forget what's been read (full re-read next time)\n\nLast sync: " + ago(get("last", 0)) + (get("err", "") ? "\nLast error: " + get("err", "") : ""), "1");
    if (c === "1") runJobs().catch(() => {}).then(() => run(true));
    else if (c === "2") { set("paused", !get("paused", false)); draw(); }
    else if (c === "3") askKey();
    else if (c === "4") { set("seen", {}); alert("Done. The next sync reads every officer again."); }
  };
  function askKey() {
    const k = prompt("Paste the sync key from the MDT promotion board\n(⚙ Requirements → Duty Portal sync → Make a sync key):", "");
    if (k && /^lspd-[a-z0-9]{10,}$/i.test(k.trim())) { set("key", k.trim()); set("err", ""); draw(); run(true); }
    else if (k) alert("That doesn't look like a sync key. It starts with \"lspd-\".");
  }

  // ---------- one hidden frame we load Duty Portal pages into ----------
  let frame = null;
  function freeFrame() { if (!frame) return; try { frame.src = "about:blank"; } catch (e) {} frame.remove(); frame = null; }   // blank it first so the browser lets go of the page
  function load(path) {
    return new Promise(res => {
      freeFrame();
      frame = document.createElement("iframe");
      // kept on screen (but invisible, behind the page): the Duty Portal only loads more rows for frames the browser is drawing
      frame.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;opacity:0.01;z-index:-1;pointer-events:none;border:0";
      const t = setTimeout(() => res(frame ? frame.contentDocument : document), 30000);   // never wait forever for a page
      frame.onload = () => { clearTimeout(t); res(frame.contentDocument); };
      frame.src = path;
      document.body.appendChild(frame);
    });
  }
  const texts = el => { const d = el.ownerDocument, w = d.createTreeWalker(el, NodeFilter.SHOW_TEXT), o = []; let n; while ((n = w.nextNode())) { const t = n.textContent.trim(); if (t) o.push(t); } return o; };
  async function waitFor(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(400); } return null; }

  // ---------- officer list (scrolls to the end so every officer is loaded) ----------
  // full = every officer (scrolls to the end, heavy: every few hours); otherwise just who's on duty right now (light)
  async function readList(full) {
    const d = await load(BASE + "/officers" + (full ? "" : "?status=active"));
    const rows = () => { const m = {}; d.querySelectorAll('main a[href*="/officers/"]').forEach(a => { const h = (a.getAttribute("href") || "").split("?")[0], pid = h.split("/officers/")[1]; if (pid && /^[a-z0-9]{16,}$/i.test(pid) && texts(a).length >= 4) m[pid] = a; }); return m; };
    if (!(await waitFor(() => Object.keys(rows()).length, 20000))) throw new Error("couldn't read the officer list (signed out?)");
    let n = 0, same = 0;
    for (let i = 0; i < (full ? 80 : 6) && same < (full ? 4 : 2); i++) {
      d.querySelectorAll("main *").forEach(el => { if (el.scrollHeight > el.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight; });
      await sleep(1100);
      const k = Object.keys(rows()).length; same = k === n ? same + 1 : 0; n = k; STATUS = "reading officers… " + n; draw();
    }
    const R = rows();
    return Object.keys(R).map(pid => {
      const t = texts(R[pid]), all = t.join(" ");
      const week = (all.match(/\+\s*(\d+(?:\.\d+)?)\s*h\s*\/\s*7d/) || [])[1];
      const rest = all.replace(/\+\s*[\d.]+\s*h\s*\/\s*7d/, "").replace(/\d+\s*(?:mo|min|[smhdwy]|minutes?|hours?|days?|weeks?|months?|years?)\s+ago/i, "");
      const seen = (all.match(/(\d+\s*(?:mo|min|[smhdwy]|minutes?|hours?|days?|weeks?|months?|years?)\s+ago|never seen|just now)/i) || [])[1] || "";
      return { pid: pid, name: t.find(x => x.indexOf("|") !== -1) || t.find(x => x.length > 2 && !/duty|ago|^\d|^h$|^\+/i.test(x)) || "",
        status: (all.match(/\b(on|off) duty\b/i) || [""])[0], seen: seen, seenAt: /never/i.test(seen) ? 0 : relTime(seen),
        total: parseFloat((rest.match(/(\d+(?:\.\d+)?)\s*h\b/) || [])[1]) || 0, week: parseFloat(week) || 0 };
    }).filter(o => /on duty/i.test(o.status) || (full && o.seenAt && Date.now() - o.seenAt < 60 * 864e5));   // skip people not seen in 60 days
  }
  // ---------- one officer's profile: Discord ID, recent shifts, recent reports ----------
  function relTime(s) {
    s = String(s).toLowerCase(); const n = /an? /.test(s) && !/\d/.test(s) ? 1 : parseFloat((s.match(/\d+/) || ["0"])[0]);
    const u = /minute|\dmin|\d\s*m\b/.test(s) ? 60e3 : /hour|\d\s*h\b/.test(s) ? 3600e3 : /day|\d\s*d\b/.test(s) ? 864e5 : /week|\d\s*w\b/.test(s) ? 7 * 864e5 : /month|\dmo\b/.test(s) ? 30 * 864e5 : /year|\d\s*y\b/.test(s) ? 365 * 864e5 : /second|just now|\d\s*s\b/.test(s) ? 1000 : 0;
    return u ? Date.now() - n * u : 0;
  }
  async function readProfile(pid) {
    const d = await load(BASE + "/officers/" + pid);
    const ok = await waitFor(() => { const t = d.body.innerText; return /Recent Shifts/i.test(t) && /\b\d{17,20}\b/.test(t); }, 25000);
    if (!ok) return null;
    await sleep(1800);   // let the reports list arrive
    const main = d.querySelector("main") || d.body;
    const disc = ((main.innerText.match(/Discord\s*\n?\s*(\d{17,20})/) || [])[1]) || "";
    const name = ([...main.querySelectorAll("h1,h2")].map(x => x.textContent.trim()).find(x => x.indexOf("|") !== -1)) || "";
    const shifts = [];
    main.querySelectorAll("button").forEach(b => {
      const t = texts(b); if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(t[0] || "")) return;
      const time = t.find(x => /^\d{1,2}:\d{2}\s*[AP]M$/i.test(x)), dur = t.find(x => /^\d+h \d+m$/.test(x)); if (!time || !dur) return;
      const s = new Date(t[0] + " " + time).getTime(), dm = dur.match(/(\d+)h (\d+)m/);
      if (!isNaN(s)) shifts.push({ s: s, m: Number(dm[1]) * 60 + Number(dm[2]) });
    });
    const reports = [];
    const w = d.createTreeWalker(main, NodeFilter.SHOW_TEXT); let n, hdr = null; while ((n = w.nextNode())) if (/^recent reports$/i.test(n.textContent.trim())) { hdr = n.parentElement; break; }
    if (hdr) {
      let sec = hdr; for (let i = 0; i < 5 && sec; i++) { sec = sec.parentElement; if (sec && sec.querySelectorAll("a").length > 1) break; }
      [...(sec ? sec.querySelectorAll("a") : [])].forEach(a => {
        const t = texts(a); if (!t.length || /^view all$/i.test(t[0])) return;
        const title = t[0], rel = t.find(x => /ago$/i.test(x)) || "", type = (t.find(x => /^(case|report|ticket|arrest|warrant|incident)$/i.test(x)) || "").toLowerCase();
        const ts = (title.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\s*$/) || []), at = ts.length ? new Date(ts[1] + "T" + ts[2]).getTime() : relTime(rel);
        let id = ""; try { const q = new URL(a.href, location.origin).searchParams; id = [...q.values()].join(":").slice(0, 80); } catch (e) {}
        if (at) reports.push({ id: id, at: at, approx: !ts.length, type: type, title: title.slice(0, 200) });
      });
    }
    return { pid: pid, discord: disc, name: name, shifts: shifts, reports: reports };
  }
  // ---------- Duty Portal roster jobs (after a promotion is marked done in the MDT) ----------
  const csRe = cs => new RegExp("^\\s*" + String(cs).replace(/[-]/g, "\\-") + "\\b", "i");
  const rowsOf = d => [...d.querySelectorAll("tbody tr, tr")].filter((r, i, a) => a.indexOf(r) === i);
  const spotRow = (d, cs) => rowsOf(d).find(r => csRe(cs).test(r.innerText || ""));
  const idRows = (d, id) => rowsOf(d).filter(r => (r.innerText || "").indexOf(id) !== -1 && /\bActions for\b/.test([...r.querySelectorAll("button")].map(b => b.getAttribute("aria-label") || "").join(" ")));
  const rowCs = r => ((r.innerText || "").match(/^\s*([A-Z]{1,3}-\d{2,4})/i) || [])[1] || "";
  const btnIn = (el, re) => [...el.querySelectorAll("button")].find(b => re.test((b.getAttribute("aria-label") || "").trim()) || re.test((b.innerText || "").trim()));
  function press(el) {
    const w = el.ownerDocument.defaultView, o = { bubbles: true, cancelable: true, button: 0, pointerType: "mouse", pointerId: 1, isPrimary: true };
    el.dispatchEvent(new w.PointerEvent("pointerdown", o)); el.dispatchEvent(new w.MouseEvent("mousedown", o));
    el.dispatchEvent(new w.PointerEvent("pointerup", o)); el.dispatchEvent(new w.MouseEvent("mouseup", o)); el.click();
  }
  function typeIn(inp, v) { const w = inp.ownerDocument.defaultView; inp.focus(); Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(inp, v); inp.dispatchEvent(new w.Event("input", { bubbles: true })); }
  const dialog = d => [...d.querySelectorAll('[role=dialog],[role=alertdialog]')].filter(x => x.offsetParent !== null || x.getClientRects().length).pop() || null;
  async function escape(d) { for (let i = 0; i < 3 && (dialog(d) || d.querySelector("[role=menu]")); i++) { const x = dialog(d), c = x && btnIn(x, /close|cancel/i); if (c) press(c); else d.dispatchEvent(new d.defaultView.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await sleep(500); } }
  // some actions ask "are you sure?": press the go-ahead button (never Cancel/Close)
  async function confirmAny(d) {
    for (let i = 0; i < 3; i++) { await sleep(1100); const x = dialog(d); if (!x) return;
      const b = [...x.querySelectorAll("button")].filter(b => !b.disabled && !/cancel|close|back/i.test((b.innerText || "") + (b.getAttribute("aria-label") || ""))).find(b => /^(assign|confirm|save|move|clear|yes|continue|done|ok)\b/i.test((b.innerText || "").trim()));
      if (!b) return; press(b); }
  }
  async function openRoster(tab) {
    const d = await load(BASE + "/roster?tab=" + tab);
    if (!(await waitFor(() => rowsOf(d).length > 10 && /Actions for/.test(d.body.innerHTML), 25000))) throw new Error("the " + tab + " roster didn't load (signed out?)");
    await sleep(800); return d;
  }
  async function menuPick(d, row, re) {
    const b = btnIn(row, /^Actions for/); if (!b) throw new Error("no actions menu on " + rowCs(row));
    press(b); const it = await waitFor(() => [...d.querySelectorAll("[role=menuitem]")].find(i => re.test(i.innerText || "")), 5000);
    if (!it) { await escape(d); throw new Error("the actions menu didn't show \"" + re.source + "\""); }
    press(it);
  }
  async function moveTo(d, job, row) {
    await menuPick(d, row, /Move spot/i);
    const x = await waitFor(() => dialog(d), 6000); if (!x) throw new Error("the Move spot window didn't open");
    const inp = x.querySelector("input"); if (inp) typeIn(inp, job.to);
    const opt = await waitFor(() => [...x.querySelectorAll("[role=option],[cmdk-item],button,li")].find(e => (e.innerText || "").trim().toUpperCase() === job.to.toUpperCase()), 6000);
    if (!opt) { await escape(d); throw new Error(job.to + " isn't an open spot on the main roster"); }
    press(opt); await confirmAny(d);
    if (!(await waitFor(() => { const r = spotRow(d, job.to); return r && r.innerText.indexOf(job.discord) !== -1; }, 15000))) throw new Error("moved, but " + job.to + " doesn't show them yet");
  }
  let JOBKEY = "", JOBID = "";
  const step = t => { STATUS = "roster: " + t; draw(); if (JOBID) send({ action: "dpJob", key: JOBKEY, id: JOBID, st: "working", msg: t }); };
  async function doJob(job) {
    const notes = [];
    step("opening the Main roster");
    let d = await openRoster("main");
    const mine = idRows(d, job.discord), at = mine.map(rowCs);
    if (at.some(c => c.toUpperCase() === job.to.toUpperCase())) notes.push("already in " + job.to);
    else if (job.kind === "move" || mine.length) {
      // on the main roster already: Actions -> Move spot -> the new callsign
      if (!mine.length) throw new Error("couldn't find them on the main roster (Discord ID " + job.discord + ")");
      step("moving " + at[0] + " to " + job.to + " (Actions → Move spot)"); await moveTo(d, job, mine[0]); notes.push("moved " + at[0] + " → " + job.to);
    } else {
      // PO -> PO II: the new callsign's spot -> Assign -> the officer (found by Discord ID)
      const row = spotRow(d, job.to); if (!row) throw new Error(job.to + " isn't on the main roster");
      if (!/\bAssign\b/.test(row.innerText)) throw new Error(job.to + " is already taken by someone else");
      step("pressing Assign on " + job.to); press(btnIn(row, /^Assign$/));
      const x = await waitFor(() => dialog(d), 6000); if (!x) throw new Error("the Assign window didn't open");
      const inp = x.querySelector("input"); if (!inp) { await escape(d); throw new Error("no search box in the Assign window"); }
      step("searching for " + job.name + " by Discord ID"); typeIn(inp, job.discord);
      await sleep(1200);
      const opts = await waitFor(() => { const o = [...x.querySelectorAll("[role=option],[cmdk-item]")].filter(e => (e.innerText || "").trim()); return o.length ? o : null; }, 8000);
      if (!opts) { await escape(d); throw new Error("no member with Discord ID " + job.discord + " in the Duty Portal"); }
      if (opts.length > 1) { await escape(d); throw new Error("more than one member matched Discord ID " + job.discord); }
      if (/already on this roster/i.test(opts[0].innerText)) { await escape(d); throw new Error("they're already on the main roster at another spot"); }
      step("picking " + job.name + " for " + job.to); press(opts[0]); await confirmAny(d);
      step("checking " + job.to + " shows " + job.name);
      if (!(await waitFor(() => { const r = spotRow(d, job.to); return r && r.innerText.indexOf(job.discord) !== -1; }, 15000))) throw new Error("assigned, but " + job.to + " doesn't show them yet");
      notes.push("assigned " + job.to);
    }
    if (job.kind === "assign") {
      // Cadets roster: clear their old spot (only rows that really are theirs, by Discord ID)
      step("opening the Cadets roster"); d = await openRoster("cadets");
      const old = idRows(d, job.discord);
      if (!old.length) { const r = job.from && spotRow(d, job.from); notes.push(r && !/\bAssign\b/.test(r.innerText) ? job.from + " belongs to someone else, left alone" : "no cadet spot to clear"); }
      for (const r0 of old) {
        const cs = rowCs(r0); step("clearing cadet spot " + cs); await menuPick(d, r0, /Clear assignment/i); await confirmAny(d);
        if (!(await waitFor(() => { const r = spotRow(d, cs); return r && r.innerText.indexOf(job.discord) === -1; }, 15000))) throw new Error("couldn't clear cadet spot " + cs);
        notes.push("cleared cadet " + cs);
      }
    }
    return notes.join(" · ");
  }
  async function runJobs() {
    const key = get("key", ""); if (!key || RUNNING || get("paused", false)) return;
    const lk = get("lock", null); if (lk && lk.tab !== TAB && Date.now() - lk.at < 3 * 60e3) return;
    const r = await send({ action: "dpJobs", key: key }); if (!r || !r.ok || !(r.jobs || []).length) return;
    RUNNING = true; set("lock", { tab: TAB, at: Date.now() }); const beat = setInterval(() => set("lock", { tab: TAB, at: Date.now() }), 30e3);
    try {
      for (const job of r.jobs) {
        STATUS = "roster: " + job.name + " → " + job.to; draw();
        let st = "done", msg = "";
        JOBKEY = key; JOBID = job.id;
        try { msg = await doJob(job); } catch (e) { st = "failed"; msg = String(e.message || e); }
        JOBID = "";
        try { if (frame) await escape(frame.contentDocument); } catch (e) {}
        await send({ action: "dpJob", key: key, id: job.id, st: st, msg: msg });
        await sleep(rand(1500, 3000));
      }
    } finally { clearInterval(beat); RUNNING = false; STATUS = ""; freeFrame(); set("lock", null); draw(); }
  }

  // ---------- send to the MDT ----------
  function send(body) {
    return new Promise(res => GM_xmlhttpRequest({ method: "POST", url: ENDPOINT, headers: { "Content-Type": "text/plain;charset=utf-8" }, data: JSON.stringify(body), timeout: 90000,
      onload: r => { try { res(JSON.parse(r.responseText)); } catch (e) { res({ ok: false, error: "bad reply from the MDT" }); } },
      onerror: () => res({ ok: false, error: "couldn't reach the MDT" }), ontimeout: () => res({ ok: false, error: "the MDT took too long" }) }));
  }

  // ---------- one sync pass ----------
  async function run(force) {
    const key = get("key", ""); if (!key || RUNNING || (get("paused", false) && !force)) return draw();
    // only one tab syncs at a time
    const lk = get("lock", null); if (lk && lk.tab !== TAB && Date.now() - lk.at < 3 * 60e3) { STATUS = ""; return draw(); }
    if (!force && Date.now() < get("next", 0)) return draw();
    RUNNING = true; set("lock", { tab: TAB, at: Date.now() }); const beat = setInterval(() => set("lock", { tab: TAB, at: Date.now() }), 30e3);
    try {
      STATUS = "reading officers…"; draw();
      const seen = get("seen", {}), full = Date.now() - get("fullAt", 0) > FULL_EVERY || !Object.keys(seen).length;
      STATUS = full ? "reading every officer…" : "checking who's on duty…"; draw();
      const list = await readList(full), now = Date.now();
      // light check: anyone who was on duty last time and isn't now has just finished a shift, so read their profile
      const wasOn = get("onduty", []), nowOn = list.filter(o => /on duty/i.test(o.status)).map(o => o.pid);
      if (!full) wasOn.filter(pid => nowOn.indexOf(pid) === -1).forEach(pid => { const s0 = seen[pid] || {}; list.push({ pid: pid, name: s0.name || "", status: "Off Duty", seen: "", seenAt: now, total: -1, week: 0, left: true }); });
      // open a profile when they're on duty, their hours moved, or we haven't looked in 12 hours
      const active = o => /on duty/i.test(o.status) || (o.seenAt && now - o.seenAt < 21 * 864e5);   // profiles only for people active in the last 3 weeks
      // open a profile only when something changed: hours moved, they clocked in/out, or it's been a while (3 h while on duty, else a day)
      const todo = list.filter(o => active(o)).filter(o => { const s = seen[o.pid], on = /on duty/i.test(o.status);
        return !s || s.total !== o.total || s.status !== o.status || now - s.at > (on ? ONDUTY_REVISIT : REVISIT); });
      let r = await send({ action: "dpSync", key: key, officers: list.filter(o => !o.left), partial: !full, profiles: [] });
      set("onduty", nowOn); if (full) set("fullAt", Date.now());
      if (!r.ok) throw new Error(r.error || "MDT refused the update");
      let batch = [];
      for (let i = 0; i < todo.length; i++) {
        STATUS = "reading profiles " + (i + 1) + "/" + todo.length; draw(); set("lock", { tab: TAB, at: Date.now() });
        const p = await readProfile(todo[i].pid).catch(() => null);
        if (p && p.discord) { batch.push(p); seen[todo[i].pid] = { total: todo[i].total, status: todo[i].status, name: todo[i].name, at: Date.now() }; }
        await sleep(rand(1500, 4500));   // unhurried, like a person clicking through
        if (batch.length >= 15 || (i === todo.length - 1 && batch.length)) {
          r = await send({ action: "dpSync", key: key, profiles: batch }); if (!r.ok) throw new Error(r.error || "MDT refused the update");
          set("seen", seen); batch = [];
        }
      }
      set("last", Date.now()); set("err", "");
      set("next", Date.now() + nextGap());
    } catch (e) { set("err", String(e.message || e).slice(0, 80)); set("next", Date.now() + nextGap()); }
    finally { clearInterval(beat); RUNNING = false; STATUS = ""; freeFrame(); set("lock", null); draw();
      if (Date.now() - PAGE_T0 > RELOAD_AFTER) setTimeout(() => { if (!RUNNING) location.reload(); }, 8000); }   // a fresh page every couple of hours keeps memory down
  }
  draw();
  const tick = () => runJobs().catch(() => {}).then(() => run(false));
  setTimeout(tick, 4000);
  timer = setInterval(tick, 60e3);    // every minute: any roster updates waiting? then is the next sync due?
  setInterval(draw, 30e3);
})();
