/**
 * LSPD Forms Portal - Apps Script backend (Web App)
 * ==================================================
 * This ONE file is the whole backend. Delete any old code in the project, paste this in,
 * then Deploy > Manage deployments > Edit > Version: New version > Deploy.
 * (First time only: Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.)
 *
 * What lives where:
 *   - Form definitions + portal settings  -> hidden "Portal Config" tab (edited from admin.html)
 *   - Discord webhook URLs (secrets)       -> Script Properties (edited from admin.html)
 *   - Admin accounts (salted hashes only)  -> hidden "Portal Admins" tab
 *   - Every admin change                   -> "Admin Log" tab
 *   - Submissions                          -> one tab per form (name set in the form builder)
 *   - Leaderboard counts                   -> "Leaderboard Log" tab
 *   - Hours from reports (start -> end)    -> "Hours Log" tab
 *   - SGT promotion task credits           -> "Promotion Log" tab
 *
 * FIRST ADMIN: open the Google Sheet, menu "🚔 LSPD Portal" > "Create / reset admin account".
 * Webhook URLs never belong in this file (it is stored on GitHub).
 */

// Bump when the website needs something new from this file. admin.html warns if this is behind.
const BACKEND_VERSION = 62;

const PROPS_ = PropertiesService.getScriptProperties();
const CONFIG_SHEET_ = "Portal Config";
const ADMINS_SHEET_ = "Portal Admins";
const LOG_SHEET_    = "Admin Log";
const LB_SHEET_     = "Leaderboard Log";
const HOURS_SHEET_  = "Hours Log";
const PROMO_SHEET_  = "Promotion Log";
const SESSION_SECONDS_ = 6 * 60 * 60;   // admin login lasts 6 hours of inactivity
const MAX_LOGIN_FAILS_ = 5;             // then locked for 15 minutes

// =====================================================================
// ENTRY POINTS
// =====================================================================
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    if (action === "config") return json_({ ok: true, config: publicConfig_() });
    if (action === "signon") return json_({ ok: true, signon: signonCfg_() });   // tiny: is the sign-on screen the front door?
    if (action === "promo") return json_({ ok: true, promo: promoView_(false, e.parameter.p) });
    if (action === "wake") { try { getAdmins_(); getConfig_(); readLog_(1); } catch (x) {} return json_({ ok: true }); }   // admin sign-in page: get Google ready while they type
    return json_({ ok: true, service: "LSPD Forms Portal" });
  } catch (err) {
    return json_({ ok: false, error: errMsg_(err) });
  }
}

// Only actions that change saved data wait in line; reading, logging in and Discord posting run side by side.
const WRITE_ACTIONS_ = { saveConfig: 1, webhookSave: 1, webhookDelete: 1, adminAdd: 1, adminReset: 1, adminRole: 1, adminRemove: 1, changePassword: 1, leaderboardRefresh: 1, hoursRefresh: 1, promoCredit: 1, promoRemove: 1, promoExcuse: 1, promoSince: 1, cidSetPassword: 1 };

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "Bad request." }); }
  try {
    if (d.action) {
      const out = WRITE_ACTIONS_[d.action] ? withLock_(() => handleAdmin_(d)) : handleAdmin_(d);
      if (out && out.ok && /^promo(Credit|Remove|Excuse|Since)$/.test(d.action)) snapshotSoon_();
      return json_(out);
    }
    const res = handleSubmit_(d);
    if (res && res.ok) snapshotSoon_();                     // progression may have moved
    return json_(res);
  } catch (err) {
    return json_({ ok: false, error: errMsg_(err) });
  }
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(45000)) return { ok: false, error: "Server busy, please try again in a few seconds." };
  try { try { flushDeferred_(); } catch (e) {} return fn(); } finally { lock.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function errMsg_(err) { return String((err && err.message) || err); }
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function isDate_(v) { return Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v); }
function str_(v) { return String(v == null ? "" : v).trim(); }
function clip_(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.substring(0, n - 3) + "..." : s; }
function cellSafe_(v) { // stop "=..." text from turning into a formula in the sheet
  const s = String(v == null ? "" : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// =====================================================================
// CONFIG STORAGE (hidden "Portal Config" tab, JSON split into chunks)
// =====================================================================
function getConfig_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("portal_cfg");
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  const sh = ss_().getSheetByName(CONFIG_SHEET_);
  let cfg = null;
  if (sh && sh.getLastRow() >= 2) {
    const raw = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]).replace(/^\|/, "")).join("");
    try { cfg = JSON.parse(raw); } catch (e) { cfg = null; }
  }
  if (!cfg) {
    cfg = defaultConfig_();
    cfg.version = 1;
    migrateLegacy_();
    writeConfig_(cfg, "system");
  }
  cacheConfig_(cfg);
  return cfg;
}

function writeConfig_(cfg, user) {
  const ss = ss_();
  let sh = ss.getSheetByName(CONFIG_SHEET_);
  if (!sh) { sh = ss.insertSheet(CONFIG_SHEET_); sh.hideSheet(); }
  cfg.updatedAt = new Date().toISOString();
  cfg.updatedBy = user;
  const s = JSON.stringify(cfg);
  const rows = [];
  for (let i = 0; i < s.length; i += 40000) rows.push(["|" + s.substring(i, i + 40000)]); // "|" keeps Sheets from parsing it
  sh.clear();
  sh.getRange(1, 1, 1, 3).setValues([["DO NOT EDIT - managed by admin.html", "version " + cfg.version, cfg.updatedAt]]);
  sh.getRange(2, 1, rows.length, 1).setNumberFormat("@").setValues(rows);
  cacheConfig_(cfg);
}

function cacheConfig_(cfg) {
  const s = JSON.stringify(cfg), cache = CacheService.getScriptCache();
  if (s.length < 95000) cache.put("portal_cfg", s, 600); else cache.remove("portal_cfg");
}

// What the public website is allowed to see (everything except internal stamps).
// =====================================================================
// FAST LOADING: a copy of the public data saved ON THE WEBSITE (site/data/portal.json via GitHub)
// Visitors load that file straight from the site (instant); Google only handles submissions
// and keeps the copy up to date. A new copy is published only when something actually changed.
// =====================================================================
const SNAP_REPO_DEFAULT_ = "Izzy24249/lspd-portal", SNAP_PATH_ = "site/data/portal.json";
function snapshotData_() {
  const cfg = getConfig_(), promo = {};
  programs_(cfg).forEach(p => { try { if (p.on) promo[p.id] = promoView_(false, p.id); } catch (e) {} });
  return { config: publicConfig_(), promo: promo };
}
function snapshotStatus_() {
  return { on: !!PROPS_.getProperty("GITHUB_TOKEN"), repo: PROPS_.getProperty("SNAP_REPO") || SNAP_REPO_DEFAULT_,
    last: PROPS_.getProperty("SNAP_LAST") || "", checked: PROPS_.getProperty("SNAP_CHECKED") || "", error: PROPS_.getProperty("SNAP_ERROR") || "" };
}
// after a save / submission: publish in the background (a one-off trigger), so nobody waits for GitHub
function snapshotSoon_() {
  try {
    if (!PROPS_.getProperty("GITHUB_TOKEN")) return;
    const c = CacheService.getScriptCache();
    if (c.get("snap_soon")) return;
    c.put("snap_soon", "1", 90);
    ScriptApp.newTrigger("publishSnapshot").timeBased().after(20 * 1000).create();
  } catch (e) {}
}
function publishSnapshot() {                                   // trigger entry point
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "publishSnapshot").forEach(t => { try { ScriptApp.deleteTrigger(t); } catch (e) {} });
  CacheService.getScriptCache().remove("snap_soon");
  publishSnapshot_();
}
function publishSnapshot_(force) {
  const token = PROPS_.getProperty("GITHUB_TOKEN");
  if (!token) return { ok: false, error: "Fast loading isn't set up (no GitHub token)." };
  const repo = PROPS_.getProperty("SNAP_REPO") || SNAP_REPO_DEFAULT_;
  const data = snapshotData_(), body = JSON.stringify(data, (k, v) => k === "updated" ? undefined : v);   // "updated" stamps change every run
  const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, body, Utilities.Charset.UTF_8));
  PROPS_.setProperty("SNAP_CHECKED", new Date().toISOString());
  if (!force && hash === PROPS_.getProperty("SNAP_HASH")) return { ok: true, unchanged: true };
  const file = JSON.stringify(Object.assign({ published: new Date().toISOString() }, data));
  const api = "https://api.github.com/repos/" + repo + "/contents/" + SNAP_PATH_;
  const head = { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const getSha = () => {
    const r = UrlFetchApp.fetch(api + "?ref=main", { method: "get", headers: head, muteHttpExceptions: true });
    if (r.getResponseCode() === 404) return "";
    if (r.getResponseCode() !== 200) throw new Error(ghError_(r));
    return JSON.parse(r.getContentText()).sha || "";
  };
  const put = sha => UrlFetchApp.fetch(api, { method: "put", headers: head, contentType: "application/json", muteHttpExceptions: true,
    payload: JSON.stringify(Object.assign({ message: "Portal data update (automatic)", branch: "main",
      content: Utilities.base64Encode(file, Utilities.Charset.UTF_8) }, sha ? { sha: sha } : {})) });
  try {
    let sha = PROPS_.getProperty("SNAP_SHA");
    if (sha == null) sha = getSha();
    let r = put(sha);
    if (r.getResponseCode() === 409 || r.getResponseCode() === 422) r = put(getSha());   // the file changed on GitHub: get its id and retry
    if (r.getResponseCode() !== 200 && r.getResponseCode() !== 201) throw new Error(ghError_(r));
    PROPS_.setProperty("SNAP_SHA", JSON.parse(r.getContentText()).content.sha);
    PROPS_.setProperty("SNAP_HASH", hash);
    PROPS_.setProperty("SNAP_LAST", new Date().toISOString());
    PROPS_.deleteProperty("SNAP_ERROR");
    return { ok: true };
  } catch (e) {
    PROPS_.setProperty("SNAP_ERROR", clip_(errMsg_(e), 300));
    return { ok: false, error: errMsg_(e) };
  }
}
function ghError_(r) {
  const code = r.getResponseCode(); let msg = "";
  try { msg = JSON.parse(r.getContentText()).message || ""; } catch (e) {}
  if (code === 401) return "GitHub said the token is wrong or expired (401). Make a new one and paste it again.";
  if (code === 403 || code === 404) return "GitHub refused (" + code + "): the token needs \"Contents: Read and write\" on the repository. " + msg;
  return "GitHub error " + code + ": " + msg;
}

function publicConfig_() {
  const cfg = getConfig_();
  return {
    version: cfg.version,
    backend: BACKEND_VERSION,
    settings: Object.assign({}, cfg.settings, { promo: promoCfg_(cfg, "cpl"), programs: programs_(cfg).slice(1) }),   // progression on by default, even before its setup is first saved
    rosters: rostersFor_(cfg.forms.filter(f => f.status !== "hidden")),
    roster: (() => { try { return usesOldRoster_(cfg.forms) ? rosterForPickers_().map(p => ({ name: p.name, id: p.id, extra: p.extra, division: p.division })) : []; } catch (e) { return []; } })(),
    forms: cfg.forms.filter(f => f.status !== "hidden"),
    signon: signonCfg_()
  };
}
// officers see the MDT sign-on screen before the portal (only once Discord sign-in is set up)
function signonCfg_() {
  const d = discordStatus_(), ready = !!(d.clientId && d.hasSecret && d.redirect);
  return { required: ready && PROPS_.getProperty("SIGNON_REQUIRED") === "1", pinEvery: PROPS_.getProperty("SIGNON_PIN_EVERY") === "1", ready: ready };
}

// =====================================================================
// ROSTER (names + Discord IDs from a Google Sheet tab, for the name pickers)
// Default: a tab called "Roster" in this spreadsheet. Column headers are found by name:
//   a column with "Discord" + "ID" in the header, a column with "Name" or "Callsign",
//   and optionally "Rank" / "Division" / "Unit" / "Badge" (shown as extra info).
// =====================================================================
// people shown in the pickers (hides anyone without a Discord ID unless that setting is turned off)
function rosterForPickers_() {
  const cfg = getConfig_(), r = (cfg.settings && cfg.settings.roster) || {};
  const people = getRoster_().people;
  return r.requireId === false ? people : people.filter(p => /^\d{15,21}$/.test(p.id || ""));
}

// ---- One roster tab -> people (each form field picks its own tab) ----
let ROSTER_BOOK_ = null;            // opened once per request (opening another spreadsheet is slow)
function rosterBook_() {
  const r = ((getConfig_().settings || {}).roster) || {}, url = str_(r.url);
  if (ROSTER_BOOK_ && ROSTER_BOOK_.url === url) return ROSTER_BOOK_.book;
  ROSTER_BOOK_ = { url: url, book: url ? SpreadsheetApp.openByUrl(url) : ss_() };
  return ROSTER_BOOK_.book;
}
const ROSTER_CACHE_SECONDS_ = 3600;  // kept warm every 10 minutes by warmRosters() so nobody waits on the sheet
function getRosterTab_(tabId, fresh, cols, cacheOnly, noExclude) {
  cols = (cols || []).filter(c => colIndex_(c) >= 0);
  const key = "roster_tab_" + tabId + (cols.length ? "_" + cols.join("") : "") + (noExclude ? "_all" : ""), cache = CacheService.getScriptCache();
  if (!fresh) { const hit = cache.get(key); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  if (cacheOnly) return null;
  const r = ((getConfig_().settings || {}).roster) || {};
  const out = { tab: "", people: [], warnings: [], error: "", left: 0, noId: 0 };
  try {
    const sh = rosterBook_().getSheets().find(x => x.getSheetId() === Number(tabId));
    if (!sh) out.error = "That roster tab no longer exists in the roster sheet.";
    else {
      out.tab = sh.getName();
      const EXCL = str_(r.exclude === undefined ? ROSTER_EXCLUDE_DEFAULT : r.exclude).toLowerCase().split(",").map(w => w.trim()).filter(Boolean);
      const isOut = noExclude ? () => false : t => { t = String(t || "").toLowerCase(); return EXCL.some(w => t.indexOf(w) !== -1); };   // onboarding tab: keep everyone
      const info = { tab: out.tab, people: 0, noId: 0, skipped: "", left: 0 };
      const rows = readRosterTab_(sh, isOut, info, out.warnings, { moreCols: cols });
      if (info.skipped) out.error = "Tab \"" + out.tab + "\": " + info.skipped + ".";
      out.left = info.left; out.noId = info.noId;
      const seen = {}, calls = callsignMap_();
      out.withCallsign = 0;
      rows.forEach(p => {
        if (r.requireId !== false && !p.id) return;                    // only people with a Discord ID
        const k = p.id || p.name.toLowerCase(); if (seen[k]) return; seen[k] = 1;
        const shownName = withCallsign_(p, calls);
        if (shownName !== p.name) out.withCallsign++;
        const person = { name: clip_(shownName, 80), id: p.id, extra: clip_(p.extra, 80) };
        if (p.more) person.more = p.more;                                  // extra columns a form asked for (e.g. K9 name in J)
        if (p.sec) person.sec = p.sec;                                     // the roster's section heading above them (e.g. HIGH COMMAND)
        out.people.push(person);
      });
    }
  } catch (e) { out.error = "Couldn't open the roster sheet: " + errMsg_(e); }
  const js = JSON.stringify(out);
  if (js.length < 95000) cache.put(key, js, ROSTER_CACHE_SECONDS_);
  return out;
}
// Callsigns from the main roster (Portal Settings → Roster → Callsigns): { byId: {discordId: "L-104"}, byName: {"f duzen": "L-104"} }
function callsignMap_(fresh) {
  const r = ((getConfig_().settings || {}).roster) || {}, c = r.callsigns || {};
  if (!c.on || c.tabId == null) return null;
  const cache = CacheService.getScriptCache();
  if (!fresh) { const hit = cache.get("roster_calls"); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  const out = { byId: {}, byName: {}, count: 0, tab: "", error: "" };
  try {
    const sh = rosterBook_().getSheets().find(x => x.getSheetId() === Number(c.tabId));
    if (!sh) out.error = "The main roster tab for callsigns no longer exists.";
    else {
      out.tab = sh.getName();
      const info = { tab: out.tab, people: 0, noId: 0, skipped: "", left: 0 };
      const rows = readRosterTab_(sh, () => false, info, [], { callCol: c.col || "D", idCol: c.idCol || "" });
      if (info.skipped) out.error = "Main roster: " + info.skipped + ".";
      const nameCount = {};
      rows.forEach(m => { if (m.nm) nameCount[m.nm] = (nameCount[m.nm] || 0) + 1; });
      rows.forEach(m => {
        const cs = str_(m.cs); if (!cs) return;
        if (m.id) out.byId[m.id] = cs;
        if (m.nm && nameCount[m.nm] === 1) out.byName[m.nm] = cs;
        out.count++;
      });
    }
  } catch (e) { out.error = "Couldn't read callsigns: " + errMsg_(e); }
  const js = JSON.stringify(out); if (js.length < 95000) cache.put("roster_calls", js, ROSTER_CACHE_SECONDS_);
  return out;
}
// "F. Duzen" + "L-104" -> "L-104 | F. Duzen" (replaces any other callsign already in front)
function withCallsign_(p, calls) {
  if (!calls) return p.name;
  const cs = (p.id && calls.byId[p.id]) || calls.byName[nameKey_(p.name)];
  if (!cs || p.name.indexOf(cs) === 0) return p.name;
  return cs + " | " + p.name.replace(/^\s*[A-Za-z]{1,4}\s*-?\s*\d{1,5}\s*[|·\-–]\s*/, "").trim();
}

// every roster tab used by a field on these forms -> { tabId: [people] }
function rostersFor_(forms, opts) {
  opts = opts || {};
  const ids = {};
  forms.forEach(f => (f.blocks || []).forEach(b => (b.fields || []).concat((b.columns || []).filter(c => c.type === "officer")).forEach(fd => {
    if (fd.rosterTabId == null || fd.rosterTabId === "") return;
    const set = ids[fd.rosterTabId] || (ids[fd.rosterTabId] = {});
    if (fd.pairCol && fd.pairFill) set[String(fd.pairCol).toUpperCase()] = 1;
    if (fd.callCol) set[String(fd.callCol).toUpperCase()] = 1;            // this tab's own callsign column (for people not on the main roster)
    if (fd.onlyCol) set[String(fd.onlyCol).toUpperCase()] = 1;            // "only show people whose column C is L-5##"
  })));
  const out = {};
  Object.keys(ids).forEach(id => {
    try {
      const r = getRosterTab_(id, !!opts.fresh, Object.keys(ids[id]).sort(), !!opts.cacheOnly);
      if (r) out[id] = r.people; else if (opts.missing) opts.missing.push(id);
    } catch (e) { out[id] = []; }
  });
  return out;
}
// Runs every 10 minutes (time trigger) so the website and admin never wait on reading the roster sheet.
function warmRosters() {
  try { flushDeferred_(); } catch (e) {}
  const cfg = getConfig_();
  try { callsignMap_(true); } catch (e) {}
  rostersFor_(cfg.forms, { fresh: true });
  try { if (usesOldRoster_(cfg.forms)) getRoster_(true); } catch (e) {}
  programs_(cfg).forEach(p => { try { if (p.on) promoCandidates_(true, p.id); } catch (e) {} });
  try { promoSync_(); } catch (e) {}
  promoClearCache_();
  programs_(cfg).forEach(p => { try { if (p.on) promoView_(false, p.id); } catch (e) {} });   // progression pages answer from the saved copy
  try { publishSnapshot_(); } catch (e) {}                   // copy on the website itself (only when something changed)
}
function ensureWarmTrigger_() {
  const cache = CacheService.getScriptCache();
  if (cache.get("warm_trigger_ok")) return;
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === "warmRosters")) ScriptApp.newTrigger("warmRosters").timeBased().everyMinutes(10).create();
  try { ensureRosterChangeTrigger_(); } catch (e) {}
  cache.put("warm_trigger_ok", "1", 21600);
}
// Roster edits show up within seconds: a change in the roster spreadsheet re-reads the rosters straight away.
function rosterSheetId_() {
  const r = ((getConfig_().settings || {}).roster) || {};
  if (str_(r.url)) { const m = /\/d\/([\w-]+)/.exec(str_(r.url)); return m ? m[1] : ""; }
  return ss_().getId();
}
function ensureRosterChangeTrigger_() {
  const id = rosterSheetId_();
  if (!id) return;
  const mine = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "onRosterChange");
  if (mine.length === 1 && mine[0].getTriggerSourceId() === id) return;
  mine.forEach(t => ScriptApp.deleteTrigger(t));                // roster sheet link changed: move the trigger
  ScriptApp.newTrigger("onRosterChange").forSpreadsheet(id).onChange().create();
}
function onRosterChange(e) {
  const c = CacheService.getScriptCache();
  if (c.get("roster_busy")) { c.put("roster_pending", "1", 300); return; }   // a refresh is already running: run once more after it
  c.put("roster_busy", "1", 120);
  try {
    for (let i = 0; i < 3; i++) { c.remove("roster_pending"); warmRosters(); if (!c.get("roster_pending")) break; }
    promoClearCache_();
  } finally { c.remove("roster_busy"); }
}
function usesOldRoster_(forms) {
  return forms.some(f => (f.blocks || []).some(b => (b.fields || []).some(fd => (fd.roster || fd.type === "officers" || fd.type === "officer") && (fd.rosterTabId == null || fd.rosterTabId === ""))));
}

const ROSTER_EXCLUDE_DEFAULT = "former, removed, inactive, resigned, terminated, fired, retired, archive, onboarding, pending, applicant, blacklist, dismissed";

// Reads one roster tab -> [{ name, nm, call, id, extra }]. Applies the "not a current member" rules.
function colIndex_(letter) {          // "D" -> 3, "AA" -> 26; "" -> -1
  const t = String(letter || "").trim().toUpperCase(); if (!/^[A-Z]{1,2}$/.test(t)) return -1;
  return t.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}
function readRosterTab_(sh, isOut, info, warnings, opts) {
  opts = opts || {};
  const rows = [];
  if (sh.getLastRow() < 2) { info.skipped = "empty"; return rows; }
  const tabName = sh.getName();
  const range = sh.getRange(1, 1, Math.min(sh.getLastRow(), 2000), Math.min(sh.getLastColumn(), 30));
  const raw = range.getValues(), shown = range.getDisplayValues();
  let lines = null; try { lines = range.getFontLines(); } catch (e) {}
  // find the header row in the first 15 rows (allows title rows above it)
  let hr = -1, idCol = -1, nameCol = -1, callCol = -1;
  for (let i = 0; i < Math.min(15, shown.length) && hr < 0; i++) {
    const head = shown[i].map(h => String(h).toLowerCase().trim());
    let ic = head.findIndex(h => /discord/.test(h) && /\bid\b|identifier|snowflake/.test(h));
    if (ic < 0) ic = head.findIndex(h => /^(discord )?id$/.test(h) || h === "discord");
    const cc = head.findIndex((h, j) => j !== ic && /call ?sign|unit ?#|badge ?#/.test(h));
    const nc = head.findIndex((h, j) => j !== ic && j !== cc && /name|officer|member|detective|agent|player|character|personnel|trooper|deputy|employee|staff|instructor|fto|recruit|cadet/.test(h) && !/\bid\b|discord|email|rank|status|date|joined/.test(h));
    if ((nc >= 0 || cc >= 0) && head.filter(Boolean).length >= 2) { hr = i; idCol = ic; nameCol = nc >= 0 ? nc : cc; callCol = nc >= 0 ? cc : -1; }   // a title row has only one cell
  }
  if (hr < 0) {
    // no recognisable header: find the row above a run of Discord IDs, and use the text column beside them as the name
    const isId = v => /^\s*\d{17,20}\s*$/.test(String(v || ""));
    for (let i = 0; i < Math.min(15, shown.length - 1) && hr < 0; i++) {
      const below = shown.slice(i + 1, i + 21);
      for (let c = 0; c < shown[i].length && hr < 0; c++) {
        if (below.filter(r => isId(r[c])).length >= Math.max(1, Math.min(3, below.length))) {
          let best = -1, bestN = 0;
          for (let k = 0; k < shown[i].length; k++) { if (k === c) continue; const n = below.filter(r => /[A-Za-z]{2,}/.test(String(r[k] || ""))).length; if (n > bestN) { best = k; bestN = n; } }
          if (best >= 0) { hr = i; idCol = c; nameCol = best; }
        }
      }
    }
  }
  if (hr < 0) { info.skipped = "no header row with a Name/Callsign column"; return rows; }
  // Discord ID column found by its contents (17-20 digit numbers), whatever the header says ("Email ID", "UID", …)
  {
    const data = shown.slice(hr + 1, hr + 301), rawData = raw.slice(hr + 1, hr + 301);
    const filled = data.filter(r => r.some(c => str_(c))).length || 1;
    const score = c => data.filter((r, i) => /^\s*\d{17,20}\s*$/.test(String(r[c] || "")) || (typeof rawData[i][c] === "number" && rawData[i][c] > 1e15)).length;
    let best = -1, bestN = 0;
    for (let c = 0; c < shown[hr].length; c++) { if (c === nameCol) continue; const n = score(c); if (n > bestN) { best = c; bestN = n; } }
    if (best >= 0 && bestN >= Math.max(1, filled * 0.2) && (idCol < 0 || score(idCol) < bestN * 0.6)) idCol = best;
  }
  if (colIndex_(opts.idCol) >= 0) idCol = colIndex_(opts.idCol);
  if (colIndex_(opts.callCol) >= 0) { callCol = colIndex_(opts.callCol); if (callCol === nameCol) nameCol = -1; }
  if (nameCol < 0) { info.skipped = "no Name column"; return rows; }
  const head = shown[hr].map(h => String(h).toLowerCase());
  const extraCols = head.map((h, i) => /rank|title|position|role/.test(h) ? i : -1).filter(i => i >= 0 && i !== idCol && i !== nameCol && i !== callCol);
  const statusCols = head.map((h, i) => /status|state|active|standing/.test(h) ? i : -1).filter(i => i >= 0 && i !== idCol && i !== nameCol);
  let inOutSection = false, section = "";
  const checkHidden = shown.length - hr <= 400;      // per-row hidden checks are slow; skip them on very long tabs
  for (let i = hr + 1; i < shown.length; i++) {
    const filled = shown[i].filter(c => str_(c)).length;
    const noId = !(idCol >= 0 && str_(shown[i][idCol])), noCall = !(callCol >= 0 && callKey_(shown[i][callCol]));
    if (filled === 1 && noId && noCall) {           // section heading row ("COMMANDING PILOTS", "Senior Pilots (4)", "Trainees")
      const t = str_(shown[i].find(c => str_(c)));
      const loud = /[A-Z]/.test(t) && t === t.toUpperCase() && !/\d/.test(t);
      const heading = isOut(t) || loud || /member|roster|division|section|command|staff|personnel|active/i.test(t) ||
        (filled === 1 && !str_(shown[i][nameCol]) && /[A-Za-z]{3}/.test(t) && !/\|/.test(t));   // a lone banner row ("Supervisory Pilots") with nothing in the name column
      if (heading) { inOutSection = isOut(t); if (!inOutSection) section = clip_(t.replace(/\s*[([]\s*\d+\s*[)\]]\s*$/, "").replace(/\s*[-–:]\s*\d+\s*$/, ""), 60); continue; }
    }
    if (!filled) continue;
    const why = inOutSection || statusCols.some(c => isOut(shown[i][c])) ||
      (lines && lines[i] && (lines[i][nameCol] === "line-through" || (callCol >= 0 && lines[i][callCol] === "line-through"))) ||
      (checkHidden && (sh.isRowHiddenByUser(i + 1) || sh.isRowHiddenByFilter(i + 1)));
    if (why) { info.left++; continue; }
    const nm = str_(shown[i][nameCol]), cs = callCol >= 0 ? str_(shown[i][callCol]) : "";
    const name = cs && nm ? (nm.indexOf(cs) === -1 ? cs + " | " + nm : nm) : (nm || cs);   // "L-104 | Duzen"
    if (!name) continue;
    let id = idCol >= 0 ? str_(shown[i][idCol]).replace(/[^0-9]/g, "") : "";
    if (idCol >= 0 && typeof raw[i][idCol] === "number" && raw[i][idCol] > 1e14) {
      warnings.push(tabName + " row " + (i + 1) + " (" + name + "): Discord ID is stored as a number, so Google Sheets rounded it. Format that column as Plain text and paste the ID again.");
      id = "";
    } else if (id && !/^\d{15,21}$/.test(id)) id = "";
    const more = {};
    (opts.moreCols || []).forEach(L => { const c = colIndex_(L), v = c >= 0 && c < shown[i].length ? str_(shown[i][c]) : ""; if (v) more[L] = clip_(v, 60); });
    rows.push({ more: Object.keys(more).length ? more : undefined, name: name, id: id, cs: cs, extra: extraCols.map(c => str_(shown[i][c])).filter(Boolean).join(" · "), call: callKey_(cs || name), nm: nameKey_(name), sec: section || undefined });
    if (!id) info.noId++;
  }
  return rows;
}
// "L-104 | Duzen" -> "L104";  "Duzen" -> ""
function callKey_(t) { const m = /\b([A-Za-z]{1,4})\s*-?\s*(\d{1,5})\b/.exec(String(t || "")); return m ? (m[1] + m[2]).toUpperCase() : ""; }
// "L-104 | J. Duzen" -> "j duzen"
function nameKey_(t) {
  return String(t || "").replace(/\b[A-Za-z]{1,4}\s*-?\s*\d{1,5}\b/g, " ").replace(/[^A-Za-z\s']/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function getRoster_(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) { const hit = cache.get("portal_roster"); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  const cfg = getConfig_(), r = (cfg.settings && cfg.settings.roster) || {};
  const out = { people: [], warnings: [], tabs: [], source: "", error: "", verify: null };
  try {
    const linked = !!str_(r.url);
    const book = linked ? SpreadsheetApp.openByUrl(str_(r.url)) : ss_();
    const masterTab = r.verify && r.verify.on ? (String(r.verify.tab || "") || (r.verify.tabId != null ? "#" + r.verify.tabId : "")) : "";
    const masterId = r.verify && r.verify.on && r.verify.tabId != null && isFinite(Number(r.verify.tabId)) ? Number(r.verify.tabId) : null;
    // which tabs: ticked list, or blank = every tab (linked sheet) / "Roster" (this spreadsheet)
    // The tab checklist decides. (The old "Tabs to read" text is only used by settings saved before the checklist existed.)
    // Tabs are remembered by their permanent sheet ID (two tabs can look identical but differ by a space).
    const ids = Array.isArray(r.tabIds) ? r.tabIds.map(Number).filter(n => isFinite(n)) : [];
    const useList = Array.isArray(r.tabs) || ids.length;
    const want = useList ? "" : str_(r.tab);
    const picked = ids.length ? [] : (Array.isArray(r.tabs) ? r.tabs.map(t => String(t == null ? "" : t)).filter(t => t.trim()) : []);
    const all = !ids.length && !picked.length && (want === "*" || want.toLowerCase() === "all" || (!want && linked));
    let sheets = book.getSheets();
    if (ids.length) {
      const found = ids.map(id => sheets.find(sh => sh.getSheetId() === id)).filter(Boolean);
      if (found.length < ids.length) out.warnings.push((ids.length - found.length) + " ticked tab(s) no longer exist in the sheet. Reload tabs and tick again.");
      sheets = found;
    } else if (!all) {
      const names = picked.length ? picked : (want || "Roster").split(",").map(x => x.trim()).filter(Boolean);
      const byName = n => sheets.find(sh => sh.getName() === n) || sheets.find(sh => sh.getName().trim() === String(n).trim());
      const missing = names.filter(n => !byName(n));
      if (missing.length) out.warnings.push("Tab(s) not found: " + missing.join(", "));
      sheets = names.map(byName).filter(Boolean);
    }
    out.source = (linked ? "linked sheet \"" + book.getName() + "\"" : "this spreadsheet") + " → " + (all ? "all tabs" : sheets.map(x => "\"" + x.getName() + "\"").join(", "));
    const EXCL = str_(r.exclude === undefined ? ROSTER_EXCLUDE_DEFAULT : r.exclude).toLowerCase().split(",").map(w => w.trim()).filter(Boolean);
    const isOut = t => { t = String(t || "").toLowerCase(); return EXCL.some(w => t.indexOf(w) !== -1); };

    // ---- main roster (two-way check): people must also be listed here ----
    let master = null;
    if (masterTab) {
      const mBook = str_(r.verify.url) ? SpreadsheetApp.openByUrl(str_(r.verify.url)) : book;
      const msheets = mBook.getSheets();
      const msh = (masterId != null && msheets.find(sh => sh.getSheetId() === masterId)) || msheets.find(sh => sh.getName() === masterTab) || msheets.find(sh => sh.getName().trim() === masterTab.trim());
      out.verify = { tab: masterTab, count: 0, dropped: 0, droppedNames: [], error: "" };
      if (!msh) out.verify.error = "Main roster tab \"" + masterTab + "\" was not found.";
      else {
        const mi = { tab: masterTab, people: 0, noId: 0, skipped: "", left: 0 };
        const rows = readRosterTab_(msh, isOut, mi, out.warnings);
        if (mi.skipped) out.verify.error = "Main roster tab \"" + masterTab + "\": " + mi.skipped + ".";
        else {
          master = { ids: {}, calls: {}, names: {}, last: {} };
          const add = (map, k, m) => { if (k) (map[k] = map[k] || []).push(m); };
          rows.forEach(m => {
            if (m.id) master.ids[m.id] = m;
            add(master.calls, m.call, m); add(master.names, m.nm, m); add(master.last, m.nm.split(" ").pop(), m);
            m.hasCall = !!m.call;
          });
          out.verify.count = rows.length;
          out.verify.byId = 0; out.verify.byName = 0; out.verify.synced = 0; out.verify.idsAdded = 0;
        }
      }
      if (out.verify.error) out.error = out.verify.error + " Nobody is shown until this is fixed (so old members can't slip through).";
    }
    // Find this person on the main roster. Returns the main-roster row, or null.
    // 1) same Discord ID  2) same callsign + surname  3) same full name  4) same surname + first initial (only if exactly one)
    const findOnMaster = p => {
      if (!master) return null;
      if (p.id && master.ids[p.id]) { out.verify.byId++; return master.ids[p.id]; }
      const ok = m => !(p.id && m.id && p.id !== m.id);                  // two different Discord IDs = two different people
      const sur = p.nm.split(" ").pop(), first = p.nm.split(" ")[0] || "";
      const one = list => { list = (list || []).filter(ok); return list.length === 1 ? list[0] : null; };
      const hit = (p.call && one((master.calls[p.call] || []).filter(m => !p.nm || !m.nm || m.nm.split(" ").pop() === sur))) ||
        (p.nm && one(master.names[p.nm])) ||
        (sur && one((master.last[sur] || []).filter(m => { const f = m.nm.split(" ")[0] || ""; return m.nm.split(" ").length < 2 || p.nm.split(" ").length < 2 || !f || !first || f[0] === first[0]; })));
      if (hit) out.verify.byName++;
      return hit || null;
    };

    const byKey = {};
    sheets.forEach(sh => {
      const tabName = sh.getName(), info = { tab: tabName, id: sh.getSheetId(), people: 0, noId: 0, skipped: "", left: 0, unverified: 0, hidden: sh.isSheetHidden() };
      out.tabs.push(info);
      if (masterTab && !str_(r.verify.url) && (masterId != null ? sh.getSheetId() === masterId : tabName === masterTab)) { info.skipped = "main roster (used for the check only)"; return; }
      if (all && info.hidden) { info.skipped = "hidden tab"; return; }
      if (all && isOut(tabName)) { info.skipped = "tab name marks former/onboarding members"; return; }
      readRosterTab_(sh, isOut, info, out.warnings).forEach(p => {
        if (masterTab) {
          const m = findOnMaster(p);
          if (!m) {
            info.unverified++;
            if (out.verify) { out.verify.dropped++; if (out.verify.droppedNames.length < 25) out.verify.droppedNames.push(p.name + " (" + tabName + ")"); }
            return;
          }
          // main roster is the source of truth: its callsign + name, and its Discord ID if the division tab has none
          if (m.hasCall && m.name !== p.name) { p.name = m.name; out.verify.synced++; }
          if (!p.id && m.id) { p.id = m.id; out.verify.idsAdded++; }
          if (m.extra && !p.extra) p.extra = m.extra;
        }
        const key = p.id || p.name.toLowerCase();
        if (byKey[key]) { if (byKey[key].divisions.indexOf(tabName) === -1) byKey[key].divisions.push(tabName); }
        else { byKey[key] = { name: clip_(p.name, 80), id: p.id, rank: clip_(p.extra, 60), divisions: [tabName] }; out.people.push(byKey[key]); }
        info.people++;
      });
    });
    // a plain "Roster" tab isn't a division
    out.people.forEach(p => { p.division = p.divisions.filter(d => !/^roster$/i.test(d)).join(", "); p.extra = clip_([p.division, p.rank].filter(Boolean).join(" · "), 100); delete p.divisions; });
    try { const calls = callsignMap_(); if (calls) out.people.forEach(p => { p.name = clip_(withCallsign_(p, calls), 80); }); } catch (e) {}   // same "L-104 | Name" as the per-tab pickers
    if (!out.people.length && !out.error) out.error = "No officers found. Each tab needs a header row with a Name (or Callsign) column, and ideally a Discord ID column.";
  } catch (e) {
    out.error = "Couldn't open the roster sheet: " + errMsg_(e) + " (check the link, and that the Google account running the script can open that sheet).";
  }
  const js = JSON.stringify(out);
  if (js.length < 95000) cache.put("portal_roster", js, 900);   // 15 min; "Test / refresh roster" reloads it straight away
  return out;
}

// =====================================================================
// WEBHOOKS (Script Properties, never sent to the website)
// =====================================================================
const LEGACY_WEBHOOK_KEYS_ = { "academy-forum": "FORUM_WEBHOOK_URL", "leaderboard": "LEADERBOARD_WEBHOOK_URL", "cid-forum": "CID_WEBHOOK_URL" };
// image links: https URLs, or files on the site like img/cid-logo.png
const IMG_RE = /^(https:\/\/[^\s"'()<>\\]+|(?!.*\.\.)[A-Za-z0-9_\-\/.]+\.(png|jpe?g|webp|gif|svg))$/i;
const WEBHOOK_RE_ = /^https:\/\/(ptb\.|canary\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

function getWebhooks_() {
  let list = [];
  try { list = JSON.parse(PROPS_.getProperty("WEBHOOKS") || "[]"); } catch (e) {}
  return list;
}
function saveWebhooks_(list) { PROPS_.setProperty("WEBHOOKS", JSON.stringify(list)); }
function webhookById_(id) {
  const w = getWebhooks_().find(x => x.id === id);
  if (w) return w;
  const legacy = LEGACY_WEBHOOK_KEYS_[id] && PROPS_.getProperty(LEGACY_WEBHOOK_KEYS_[id]);
  return legacy ? { id: id, name: id, kind: id === "leaderboard" ? "text" : "forum", url: legacy } : null;
}

// One-time import of the old setup (old webhook properties + old Archive tab for the leaderboard).
function migrateLegacy_() {
  const list = getWebhooks_();
  const add = (id, name, kind) => {
    const url = PROPS_.getProperty(LEGACY_WEBHOOK_KEYS_[id]);
    if (url && !list.some(w => w.id === id)) list.push({ id: id, name: name, kind: kind, url: url });
  };
  add("academy-forum", "Academy Forum", "forum");
  add("leaderboard", "FTO Leaderboard", "text");
  add("cid-forum", "CID Forum", "forum");
  saveWebhooks_(list);

  const ss = ss_(), old = ss.getSheetByName("Archive");
  if (old && !ss.getSheetByName(LB_SHEET_)) {
    const lb = lbSheet_();
    const rows = old.getDataRange().getValues()
      .filter(r => isDate_(r[0]) && str_(r[2]))
      .map(r => [r[0], "academy", "'" + str_(r[2])]);
    if (rows.length) lb.getRange(2, 1, rows.length, 3).setValues(rows);
  }
}

// =====================================================================
// PUBLIC FORM SUBMISSION (schema-driven, works for every form)
// =====================================================================
function handleSubmit_(d) {
  const cfg = getConfig_();
  const m = cfg.settings && cfg.settings.maintenance;
  if (m && m.on) return { ok: false, error: m.message || "The portal is in maintenance. Try again later." };

  const form = cfg.forms.find(f => f.id === (d.form || "academy"));
  if (!form || form.status !== "live") return { ok: false, error: "This form is not accepting submissions right now." };

  const values = d.values || d;                 // (d itself = old-style flat payload)
  const checklists = d.checklists || {};
  const repeaters = d.repeaters || {};

  // an "officer" pick carries its Discord ID: copy it into the linked Discord ID field (tags, leaderboards, required checks)
  allFields_(form).forEach(f => {
    if (f.type === "officer" && f.fillId && !str_(values[f.fillId])) {
      const m = /\((\d{15,21})\)\s*$/.exec(str_(values[f.id])); if (m) values[f.fillId] = m[1];
    }
  });

  // ---- validate against the server's copy of the form (never trust the page) ----
  const fields = allFields_(form);
  for (const f of fields) {
    const v = str_(values[f.id]);
    const nice = String(f.label || f.id).replace(/[:(].*$/, "").trim() || f.id;
    if (f.required && !v) return { ok: false, error: nice + " is required." };
    if (v && f.type === "discord_id" && !/^\d{15,21}$/.test(v)) return { ok: false, error: nice + " must be a Discord user ID (17-20 digits)." };
  }

  const webhook = webhookById_(form.webhookId);
  if (!webhook) return { ok: false, error: "No Discord webhook is set for this form. An admin needs to pick one in admin.html." };

  // ---- build Discord content (report layout) ----
  const embedFields = [], followTexts = [], archiveCols = [], detailBlocks = [], repFields = {};
  form.blocks.forEach(b => {
    if (b.type === "fields" || b.type === "strip") {
      (b.fields || []).forEach(f => {
        if (f.type === "static") return;
        const v = str_(values[f.id]);
        archiveCols.push({ id: f.id, label: f.label || f.id, value: v });
        const label = cleanLabel_(f.label || f.id);
        const prev = detailBlocks[detailBlocks.length - 1];
        // a Discord ID box that belongs to the person before it is folded into that person
        if (f.type === "discord_id" && prev && (v && prev.raw.indexOf(v) !== -1)) return;            // officer pick already has it
        if (f.type === "discord_id" && prev && !prev.mention && prev.type !== "discord_id" && sameSubject_(prev.label, label)) {
          prev.mention = v; prev.person = true;
          const short = prev.label.replace(/\s*call\s*sign\s*$/i, "").trim();       // "Trainee callsign" -> "Trainee"
          if (short) prev.label = short.charAt(0).toUpperCase() + short.slice(1);
          return;
        }
        detailBlocks.push({ f: f, label: label, raw: v, value: v ? displayValue_(f, v).replace(/^[-–•]\s+/, "") : "", type: f.type,
          person: f.type === "officer" || f.type === "officers" || f.type === "discord_id" || !!f.roster });
      });
    } else if (b.type === "checklist") {
      const st = checklists[b.id] || {};
      const items = b.items || [];
      const done = items.filter(it => st[it.topic] === true).length;
      if (items.length && b.display === "selected") {             // e.g. Equipment Used: just list what was ticked
        const picked = items.filter(it => st[it.topic] === true).map(it => it.topic);
        embedFields.push({ name: sectionIcon_(b.title) + " " + clip_(String(b.title || "Checklist").toUpperCase(), 240), value: clip_(picked.length ? picked.join(" · ") : "*None*", 1024), inline: false });
      } else if (items.length) {
        const doneList = items.filter(it => st[it.topic] === true).map(it => it.topic);
        const todo = items.filter(it => st[it.topic] !== true).map(it => it.topic);
        const bar = "▰".repeat(Math.round(10 * done / items.length)) + "▱".repeat(10 - Math.round(10 * done / items.length));
        const body = ["`" + bar + "`  **" + done + "/" + items.length + "**" + (done === items.length ? "  ·  all complete" : "")];
        if (doneList.length && todo.length) body.push("✅ " + doneList.join(" · "));
        if (todo.length) body.push("⬜ **Not done:** " + todo.join(" · "));
        embedFields.push({ name: "☑️ " + clip_(String(b.title || "Checklist").toUpperCase(), 240), value: clip_(body.join("\n"), 1024), inline: false });
      }
      if (b.display === "selected") archiveCols.push({ id: b.id, label: b.title || b.id, value: items.filter(it => st[it.topic] === true).map(it => it.topic).join(", ") });
      else archiveCols.push({ id: b.id, label: b.title || b.id, value: done + "/" + items.length + " done" +
        (done < items.length ? " | missing: " + items.filter(it => st[it.topic] !== true).map(it => it.topic).join(", ") : "") });
    } else if (b.type === "repeater") {
      const cols = b.columns || [];
      const rows = (repeaters[b.id] || []).filter(r => cols.some(c => ((c.type !== "select" && c.type !== "link") || c.blank) && str_(r[c.id])));
      const tick = r => (b.check && b.check.id && r[b.check.id] ? "  ✅ " + (b.check.label || "") : "") + (str_(r._tags) ? "  🔗 " + str_(r._tags) : "");   // people this item is linked to
      const totalsOn = b.totals && b.totals.on;
      const fmtCell = (c, v) => totalsOn && c.id === b.totals.col ? chargeText_(v) : c.type === "officer" ? v.replace(/\s*\((\d{15,21})\)\s*$/, " (<@$1>)") : v;
      let lines = [];
      if (b.groupBy && cols.some(c => c.id === b.groupBy)) {
        const groups = {}, order = [];
        rows.forEach(r => { const g = str_(r[b.groupBy]) || "Unassigned"; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(r); });
        order.forEach((g, gi) => {
          let head = "👤 **" + g + "**";
          if (totalsOn) {
            const t = groups[g].reduce((a, r) => { const x = sentence_(r[b.totals.col], r[b.totals.countCol]); a.m += x.months; a.f += x.fine; return a; }, { m: 0, f: 0 });
            head += "  —  `" + t.m + " months · $" + t.f.toLocaleString("en-US") + "`";
          }
          if (gi) lines.push("");
          lines.push(head);
          groups[g].forEach(r => {
            const cnt = totalsOn ? parseInt(r[b.totals.countCol], 10) || 1 : 1;
            const parts = cols.filter(c => c.id !== b.groupBy && !(totalsOn && c.id === b.totals.countCol)).map(c => fmtCell(c, str_(r[c.id]))).filter(Boolean);
            lines.push(clip_("› " + (cnt > 1 ? "**" + cnt + "×** " : "") + (parts.join(" · ") || "—") + tick(r), 1000));
          });
        });
      } else {
        lines = rows.map((r, ri) => clip_("`" + (ri + 1) + "` " + cols.map((c, ci) => { const v = fmtCell(c, str_(r[c.id])); return !v ? "" : ci === 0 ? "**" + v + "**" : v; }).filter(Boolean).join(" · ") + tick(r), 1000));
        if (totalsOn && rows.length) {
          const t = rows.reduce((a, r) => { const x = sentence_(r[b.totals.col], r[b.totals.countCol]); a.m += x.months; a.f += x.fine; return a; }, { m: 0, f: 0 });
          lines.push("**Total:** `" + t.m + " months · $" + t.f.toLocaleString("en-US") + "`");
        }
      }
      const repStart = embedFields.length;
      addListFields_(embedFields, sectionIcon_(b.title) + " " + clip_(String(b.title || "List").toUpperCase(), 230), lines.length ? lines : ["*None recorded.*"]);
      repFields[b.id] = embedFields.slice(repStart);
      archiveCols.push({ id: b.id, label: b.title || b.id, value: rows.map(r => cols.map(c => str_(r[c.id])).filter(Boolean).join(" / ") + (b.check && r[b.check.id] ? " [" + b.check.label + "]" : "") + (str_(r._tags) ? " (linked: " + str_(r._tags) + ")" : "")).join("; ") });
    } else if (b.type === "longtext") {
      const v = str_(values[b.id]).substring(0, b.maxLength || 8000);
      if (b.followUp) {
        if (v) followTexts.push({ title: String(b.title || "Notes").toUpperCase(), text: v });
      } else if (v) {
        embedFields.push({ name: "📝 " + clip_(String(b.title || "Notes").toUpperCase(), 240), value: clip_("> " + clip_(v, 1000).split("\n").join("\n> "), 1024), inline: false });
      }
      archiveCols.push({ id: b.id, label: b.title || b.id, value: v });
    }
  });

  // ---- tags ----
  let tags = (form.tags && form.tags.base || []).slice();
  ((form.tags && form.tags.rules) || []).forEach(r => {
    if (!r.tag) return;
    if (ruleMatches_(r, values, repeaters)) tags.push(r.tag);
  });
  const cidX = d.cid && form.cidApp ? cidPrep_(form, d.cid) : null;            // the stand-alone CID case builder page
  if (cidX && cidX.error) return { ok: false, error: cidX.error };
  if (cidX) tags = tags.concat(cidX.tags);
  tags = tags.map(str_).filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 5);

  // ---- "Classic" Discord layout (per form): people + date across the top, then each section as a ticked list ----
  const record = form.discordStyle === "record";
  const classic = form.discordStyle === "classic" || record;
  let recColor = null;
  if (record) {
    const c = recordFields_(form, values, checklists, repeaters);
    embedFields.length = 0; embedFields.push(...c.fields);
    followTexts.length = 0; followTexts.push(...c.follow);
    recColor = c.color;
  } else if (classic) {
    const c = classicFields_(form, values, checklists, repFields);
    embedFields.length = 0; embedFields.push(...c.fields);
    followTexts.length = 0; followTexts.push(...c.follow);
  }

  // ---- post ----
  const color = recColor != null ? recColor : parseInt(String(form.color || "#3498db").replace("#", ""), 16) || 3447003;
  const title = clip_(fillTemplate_(form.embedTitle || form.title, values), 256);
  // ---- details grid: three columns, grouped so related things sit together ----
  //   row(s) 1: case identity (case #, CAD #, status) · row(s) 2: incident details · row(s) 3: people
  const PEOPLE_RE = /detective|officer|instructor|trainee|supervisor|fto|lead|assist|unit|deputy|trooper|agent|member|reporting|arresting|filed by|handler|partner|pilot|crew|commander|supported/i;
  const groups = { id: [], info: [], people: [] }, statusItems = [];
  const emoji = !!form.discordEmoji, dateVal = (detailBlocks.find(d => d.type === "date") || {}).raw || "";
  detailBlocks.forEach(d => {
    const L = d.label;
    let val = d.value || "—";
    if (d.type === "officer") val = (officersText_(d.raw) || "—").replace(" · ", "\n");                  // L-104 | Duzen / @Duzen
    else if (d.type === "officers") val = String(d.raw || "").split(";").map(e => e.trim()).filter(Boolean).map(e => {   // one per line: L-122 @Smith
      const m = /^(.*?)\s*\((\d{15,21})\)$/.exec(e); if (!m) return e;
      const cs = m[1].indexOf("|") !== -1 ? m[1].split("|")[0].trim() : "";
      return (cs ? cs + " " : m[1] && !cs ? m[1] + " · " : "") + "<@" + m[2] + ">";
    }).join("\n") || "—";
    else if (d.mention) val = (d.value || "—") + "\n<@" + d.mention + ">";
    else if (d.type === "discord_id" && d.raw) val = "<@" + d.raw + ">";
    let name = L;
    if (emoji) {
      if (d.type === "time" && d.raw) val = discordTime_(dateVal, d.raw) || val;
      if (d.type === "date" && d.raw) { const p = d.raw.split("-"); if (p.length === 3) val = p[1] + "/" + p[2] + "/" + p[0].slice(2); }
      if (/duration|minutes|mins/i.test(L) && /^\d+(\.\d+)?$/.test(d.raw || "")) val = d.raw + " mins";
      if (/complete|result|status|outcome/i.test(L) && /^(yes|no|pass|passed|fail|failed)$/i.test(d.raw || "")) {
        const good = /^(yes|pass)/i.test(d.raw); val = (good ? "✅ " : "❌ ") + "**" + d.raw + "**";
        if (recColor == null) recColor = good ? 0x2ECC71 : 0xE74C3C;
        if (/^completed .{12,}/i.test(name)) name = "Completed?";
      }
      name = (fieldIcon_(L) ? fieldIcon_(L) + " " : "") + name;
    }
    const item = { name: clip_(name, 256), value: clip_(val, 1024), inline: true };
    const notPerson = /check|type|date|time|status|result|location|postal|#|number|area|aircraft|takeoff|landing/i.test(L);
    if (d.person || (PEOPLE_RE.test(L) && !notPerson)) groups.people.push(item);
    else if (/status|result|outcome|verdict/i.test(L)) statusItems.push(item);
    else if (d.type === "case_number" || (/case|cad|report|incident|ticket|file|reference|#/i.test(L) && !/type|date|time|status|location|check/i.test(L))) groups.id.push(item);
    else groups.info.push(item);
  });
  (groups.id.length ? groups.id : groups.info).push(...statusItems);
  const grid = [];
  [groups.id, groups.info, groups.people].forEach(g => {
    if (!g.length) return;
    g.forEach(x => grid.push(x));
    while (g.length % 3) { g.push(0); grid.push({ name: "\u200b", value: "\u200b", inline: true }); }   // keep each group on its own row(s)
  });
  if (!classic) embedFields.unshift(...grid);
  if (emoji && !classic) embedFields.forEach(f => {          // list titles: "📋 TRAINEES" → "👥 Trainees (2)"
    if (f.inline || !/^\S+\s[A-Z0-9 &/()'-]+(\(cont\.\))?$/.test(f.name)) return;
    const t = f.name.replace(/^\S+\s/, ""), ic = fieldIcon_(t), b = (form.blocks || []).find(x => x.type === "repeater" && String(x.title || "").toUpperCase() === t.replace(/ \(cont\.\)$/, ""));
    const n = b ? (repeaters[b.id] || []).filter(r => (b.columns || []).some(c => str_(r[c.id]))).length : null;
    f.name = clip_((ic || f.name.split(" ")[0]) + " " + titleWord_(t) + (n != null && !/cont\./.test(t) ? " (" + n + ")" : ""), 256);
  });
  const embedColor = recColor != null ? recColor : color;

  const extras = record ? { footer: { text: "Sent from the LSPD Records Portal" } } : { footer: { text: "LSPD Records Portal  •  " + clip_(form.title, 80) }, timestamp: new Date().toISOString() };
  if (/^https:\/\/[^\s"'<>]+$/.test(str_(form.discordThumb))) extras.thumbnail = { url: str_(form.discordThumb) };
  const embeds = packEmbeds_(embedFields, title, embedColor, "", extras);
  const isForum = webhook.kind !== "text";

  // ---- ONE post when it fits; otherwise post 1 = full case report, then the narrative on its own ----
  // (Discord: max 10 cards and ~6000 characters per post, 4096 per card description)
  const LIMIT = 5900;
  const sizeOf = e => (e.title || "").length + (e.description || "").length + ((e.footer && e.footer.text) || "").length + (e.fields || []).reduce((n, f) => n + f.name.length + f.value.length, 0);
  const total = list => list.reduce((n, e) => n + sizeOf(e), 0);
  const textCards = followTexts.map(t => ({ title: clip_("📝 " + t.title, 256), description: t.text, color: embedColor }));
  const allCards = embeds.concat(textCards);
  const messages = [];
  if (allCards.length <= 10 && total(allCards) <= LIMIT && textCards.every(c => c.description.length <= 4096)) {
    messages.push(allCards);                                   // everything fits: a single post
  } else {
    // group the report cards into as few posts as possible
    let cur = [];
    embeds.forEach(e => { if (cur.length && (cur.length >= 10 || total(cur) + sizeOf(e) > LIMIT)) { messages.push(cur); cur = []; } cur.push(e); });
    if (cur.length) messages.push(cur);
    // then each narrative as its own post(s), split at paragraph/sentence breaks
    followTexts.forEach(t => {
      // pack the text into as few posts as possible (a post can stack cards up to the size limit)
      const posts = [];
      let cur = [], size = 0;
      chunk_(t.text, 4000).forEach(part => {
        if (cur.length && size + part.length + 40 > LIMIT) { posts.push(cur); cur = []; size = 0; }
        cur.push(part); size += part.length + 40;
      });
      if (cur.length) posts.push(cur);
      posts.forEach((parts, pi) => messages.push(parts.map((part, ci) => {
        const card = { description: part, color: embedColor };
        if (ci === 0) card.title = clip_("📝 " + t.title + (posts.length > 1 ? " (" + (pi + 1) + "/" + posts.length + ")" : ""), 256);
        return card;
      })));
    });
  }

  const first = { embeds: messages[0], allowed_mentions: { parse: [] } };
  if (isForum) {
    // {count:listId} → "3 Trainees" (the list's title, singular when 1)
    const tt = String(form.threadTitle || form.title).replace(/\{count:(\w+)\}/g, (m, id) => {
      const b = (form.blocks || []).find(x => x.id === id && x.type === "repeater"); if (!b) return "";
      const n = (repeaters[id] || []).filter(r => (b.columns || []).some(c => str_(r[c.id]))).length;
      const noun = titleWord_(b.title || "Entries");
      return n + " " + (n === 1 ? noun.replace(/ies$/, "y").replace(/s$/, "") : noun);
    });
    first.thread_name = clip_(fillTemplate_(tt, values) || form.title, 100);
    if (tags.length) first.applied_tags = tags;
  }
  if (cidX) {
    first.content = cidX.content; first.allowed_mentions = { parse: [], users: cidX.mentions };
    if (cidX.file) messages[0][0].image = { url: "attachment://case-file.png" };
    if (cidX.rec) return cidUpdate_(form, webhook, cidX, first, d);                // "Save to Discord": edit the earlier post
  }
  const r1 = discordPost_(webhook.url, first, null, cidX ? cidX.file : null);
  if (!r1.ok) return { ok: false, error: r1.error };
  const threadId = isForum && r1.body ? r1.body.channel_id : null;
  let warning = "";
  for (let i = 1; i < messages.length; i++) {
    Utilities.sleep(350); // stay under Discord's webhook rate limit
    const r = discordPost_(webhook.url, { embeds: messages[i], allowed_mentions: { parse: [] } }, threadId);
    if (!r.ok) { warning = "the case report posted, but part " + (i + 1) + " failed: " + r.error; break; }
  }

  // ---- archive + leaderboard (after Discord so a failed post isn't logged as filed; only this part waits in line) ----
  let logId = "";
  const saved = withLock_(() => {
    archiveRow_(form, archiveCols);
    try { logId = actLog_(form, values, repeaters, archiveCols, { webhookId: webhook.id, threadId: threadId, messageId: r1.body && r1.body.id, content: first.content || "", title: first.thread_name || fillTemplate_(form.embedTitle || form.title, values) || form.title, report: cidX ? cidX.report : "", data: { values: values, repeaters: repeaters, checklists: checklists } }); } catch (e) {}
    const lb = form.leaderboard;
    if (lb && lb.enabled && lb.countField && str_(values[lb.countField])) {
      lbSheet_().appendRow([new Date(), form.id, "'" + str_(values[lb.countField])]);
      try { updateLeaderboard_(form); } catch (e) { warning = warning || "leaderboard not updated: " + errMsg_(e); }
    }
    try { const n = promoFromReport_(cfg, form, values, repeaters); if (n.problem) warning = warning || n.problem; } catch (e) { warning = warning || "promotion tracker not updated: " + errMsg_(e); }
    if (form.hours && form.hours.on) {
      try {
        const h = logHours_(form, values);
        if (h.problem) warning = warning || h.problem;
        else if (h.rows && cfg.settings.hours && cfg.settings.hours.board) updateHoursBoard_(cfg);
      } catch (e) { warning = warning || "hours not logged: " + errMsg_(e); }
    }
    return { ok: true };
  });
  if (!saved.ok) warning = warning || "posted to Discord, but the sheet was busy and the record wasn't logged";
  if (cidX) {
    let id = "";
    try { id = cidRecord_(form, webhook, cidX, first, threadId, r1.body && r1.body.id, values); } catch (e) { warning = warning || "posted, but Command review couldn't save it: " + errMsg_(e); }
    return warning ? { ok: true, id: id, logId: logId, warning: warning } : { ok: true, id: id, logId: logId };
  }
  return warning ? { ok: true, logId: logId, warning: warning } : { ok: true, logId: logId };
}

// Reads "(Felony, 18 Months - $9,000 Fine)" style charges; count multiplies it.
function sentence_(text, count) {
  const m = /(\d+)\s*Months?/i.exec(String(text || "")), f = /\$\s*([\d,]+)\s*Fine/i.exec(String(text || ""));
  const n = Math.max(1, parseInt(count, 10) || 1);
  return { months: m ? +m[1] * n : 0, fine: f ? +f[1].replace(/,/g, "") * n : 0 };
}

function allFields_(form) {
  const out = [];
  (form.blocks || []).forEach(b => {
    if (b.type === "fields" || b.type === "strip") (b.fields || []).forEach(f => { if (f.type !== "static") out.push(f); });
    if (b.type === "longtext") out.push({ id: b.id, label: b.title, required: b.required, type: "longtext" });
  });
  return out;
}

// "Lead Detective: ( L-XXX | J. Doe )" -> "Lead Detective"
function cleanLabel_(l) { return String(l || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().replace(/[:：]$/, "").trim(); }
// "Lead Detective Discord ID" belongs to "Lead Detective"; "Instructor Discord ID" to "Instructor Callsign"
function sameSubject_(a, b) {
  const base = s => s.toLowerCase().replace(/discord|user|\bid\b|callsign|name|#/g, " ").replace(/\s+/g, " ").trim();
  const x = base(a), y = base(b);
  return !!x && !!y && (x === y || x.indexOf(y) === 0 || y.indexOf(x) === 0);
}
function sectionIcon_(t) {
  t = String(t || "").toLowerCase();
  return /person|people|suspect|witness/.test(t) ? "👥" : /evidence|finding/.test(t) ? "🧪" : /vehicle|car|target/.test(t) ? "🚗" : /charge/.test(t) ? "⚖️" : /weapon|firearm/.test(t) ? "🔫" :
    /equipment|gear/.test(t) ? "🧰" : /event|activity|log/.test(t) ? "🕒" : /deploy/.test(t) ? "🐕" : "📋";
}
// "Armed Robbery (Felony, 18 Months - $9,000 Fine)" -> "Armed Robbery `Felony · 18 mo · $9,000`"
function chargeText_(v) {
  const m = /^(.*?)\s*\(((?:Felony|Misdemeanor|Infraction))[^)]*\)\s*$/i.exec(v || "");
  if (!m) return v;
  const x = sentence_(v, 1), bits = [m[2]];
  if (x.months) bits.push(x.months + " mo");
  if (x.fine) bits.push("$" + x.fine.toLocaleString("en-US"));
  return m[1] + "  `" + bits.join(" · ") + "`";
}
// officers field value "L-122 | Smith (123…); L-423 | Doe" -> "L-122 | Smith · <@123…>, L-423 | Doe"
function officersText_(v) {
  return String(v || "").split(";").map(e => e.trim()).filter(Boolean).map(e => {
    const m = /^(.*?)\s*\((\d{15,21})\)$/.exec(e);
    return m ? (m[1] ? m[1] + " · <@" + m[2] + ">" : "<@" + m[2] + ">") : e;
  }).join("\n");
}

function displayValue_(f, v) {
  if (!v) return "—";
  if (f.type === "officer") return officersText_(v).split("\n")[0];
  if (f.type === "officers") { const t = officersText_(v); return t.indexOf("\n") !== -1 ? "\n" + t.split("\n").map(x => "　› " + x).join("\n") : t; }
  if (f.type === "discord_id") return "<@" + v + ">";
  if (f.type === "case_number") return "`" + v + "`";
  if (f.type === "date") {
    const p = v.split("-");
    if (p.length === 3) return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-US");
  }
  return v;
}

function fillTemplate_(tpl, values) {
  // dates in titles read like 10/22/26 or 1/5/26 (month/day/2-digit year, no leading zeros)
  // and times like 8:00 PM
  const val = k => {
    const v = str_(values[k]), d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v), t = /^(\d{1,2}):(\d{2})$/.exec(v);
    if (d) return (+d[2]) + "/" + (+d[3]) + "/" + d[1].slice(2);
    if (t && +t[1] < 24) return ((+t[1] % 12) || 12) + ":" + t[2] + " " + (+t[1] < 12 ? "AM" : "PM");
    return v;
  };
  return String(tpl || "").replace(/\{(\w+)\}/g, (m, k) => val(k).replace(/\s*\(\d{15,21}\)/g, "")).replace(/\s*\|\s*(\|\s*)+/g, " | ").replace(/^\s*\|\s*|\s*\|\s*$/g, "").trim();
}

function ruleMatches_(r, values, repeaters) {
  if (r.op === "hasRows") { // a list (e.g. Vehicles) has at least one filled-in row
    return (repeaters[r.field] || []).some(row => Object.keys(row).some(k => typeof row[k] === "string" && str_(row[k])));
  }
  if (r.op === "anyChecked") {
    return (repeaters[r.field] || []).some(row => Object.keys(row).some(k => row[k] === true));
  }
  const v = str_(values[r.field]).toLowerCase(), t = str_(r.value).toLowerCase();
  if (r.op === "equals") return v === t;
  if (r.op === "filled") return !!v;
  return !!t && v.indexOf(t) !== -1; // contains (default)
}

// One tab per form. Columns are matched by the field ID stored in each header's note,
// so renaming a label in the builder doesn't create a new column.
function archiveRow_(form, cols) {
  const name = clip_(str_(form.archiveSheet) || form.title || form.id, 90);
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1).setValue("Submitted").setNote("_ts");
    sh.setFrozenRows(1);
  }
  const lastCol = Math.max(1, sh.getLastColumn());
  const notes = sh.getRange(1, 1, 1, lastCol).getNotes()[0];
  const row = new Array(lastCol).fill("");
  row[0] = new Date();
  cols.forEach(c => {
    let idx = notes.indexOf(c.id);
    if (idx === -1) {
      idx = notes.length;
      notes.push(c.id);
      sh.getRange(1, idx + 1).setValue(c.label).setNote(c.id).setFontWeight("bold");
      row.push("");
    } else if (sh.getRange(1, idx + 1).getValue() !== c.label) {
      sh.getRange(1, idx + 1).setValue(c.label); // keep header text in sync with renamed labels
    }
    row[idx] = /^\d{15,21}$/.test(c.value) ? "'" + c.value : cellSafe_(clip_(c.value, 49000));
  });
  sh.getRange(1, 1, 1, notes.length).setFontWeight("bold");
  sh.appendRow(row);
}

// =====================================================================
// LEADERBOARD (per form, monthly, edits one Discord message)
// =====================================================================
function lbSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(LB_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(LB_SHEET_);
    sh.appendRow(["Submitted", "Form", "Discord ID"]);
    sh.setFrozenRows(1);
    sh.getRange("C:C").setNumberFormat("@");
  }
  return sh;
}

function updateLeaderboard_(form) {
  const lb = form.leaderboard;
  const hook = webhookById_(lb.webhookId);
  if (!hook) throw new Error("leaderboard webhook not set");
  const data = lbSheet_().getDataRange().getValues();
  const now = new Date(), counts = {};
  for (let i = 1; i < data.length; i++) {
    const ts = new Date(data[i][0]), id = str_(data[i][2]);
    if (data[i][1] !== form.id || !id || isNaN(ts)) continue;
    if (ts.getMonth() === now.getMonth() && ts.getFullYear() === now.getFullYear()) counts[id] = (counts[id] || 0) + 1;
  }
  const stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "MM/dd/yyyy 'at' h:mm a");
  let desc = (lb.heading ? lb.heading + "\n" : "") + "*Last updated: " + stamp + "*\n\n";
  const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  if (!sorted.length) desc += "_No submissions recorded for this month yet._";
  sorted.forEach((id, j) => {
    const medal = j === 0 ? "🥇" : j === 1 ? "🥈" : j === 2 ? "🥉" : "🔹";
    const name = /^\d+$/.test(id) ? "<@" + id + ">" : id;
    desc += medal + " **" + name + "** — " + counts[id] + " submission" + (counts[id] === 1 ? "" : "s") + "\n";
  });
  const payload = { content: "", allowed_mentions: { parse: [] },
    embeds: [{ title: clip_(lb.title || form.title + " Leaderboard", 256), description: clip_(desc, 4000), color: parseInt(String(form.color || "#3498db").replace("#", ""), 16) || 3447003 }] };

  const propKey = "LB_MSG_" + form.id;
  const msgId = str_(lb.messageId) || PROPS_.getProperty(propKey) || "";
  if (msgId) {
    const res = UrlFetchApp.fetch(hook.url + "/messages/" + msgId, { method: "patch", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true });
    if (res.getResponseCode() === 200) return;
    if (res.getResponseCode() !== 404) throw new Error("Discord (" + res.getResponseCode() + ")");
    // 404 = message deleted: fall through and post a fresh one
  }
  const r = discordPost_(hook.url, payload, null);
  if (!r.ok) throw new Error(r.error);
  if (r.body && r.body.id) PROPS_.setProperty(propKey, r.body.id);
  if (str_(lb.messageId)) { // the configured ID was stale: point the config at the new message
    const cfg = getConfig_();
    const f = cfg.forms.find(x => x.id === form.id);
    if (f && f.leaderboard) { f.leaderboard.messageId = r.body.id; writeConfig_(cfg, "system"); }
  }
}

// =====================================================================
// HOURS (worked out from each report's date + start/end times; nobody has to clock in)
// =====================================================================
function hoursSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(HOURS_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(HOURS_SHEET_);
    sh.appendRow(["Logged", "Week Of", "Division", "Form", "Report #", "Officer", "Discord ID", "Role", "Date", "Start", "End", "Minutes", "Hours", "Note"]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 14).setFontWeight("bold");
    sh.getRange("G:G").setNumberFormat("@");
    sh.getRange("B:B").setNumberFormat("@");
    sh.getRange("I:K").setNumberFormat("@");
  }
  return sh;
}
function hhmm_(v) { const m = /^(\d{1,2}):?(\d{2})/.exec(str_(v)); if (!m) return null; const h = +m[1], mi = +m[2]; return h < 24 && mi < 60 ? h * 60 + mi : null; }
function ymd_(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd"); }
function parseYmd_(v) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str_(v)); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; }
// first day (Sunday or Monday) of the week a date falls in, as yyyy-MM-dd
function weekOf_(date, weekStart) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  d.setDate(d.getDate() - ((d.getDay() - (weekStart || 0) + 7) % 7));
  return ymd_(d);
}
function hoursFmt_(min) { const h = Math.floor(min / 60), m = Math.round(min % 60); return !h ? m + "m" : h + "h" + (m ? " " + (m < 10 ? "0" : "") + m + "m" : ""); }
// "L-104 | Duzen (1234...)" ; "Smith (5678...)" -> [{name, id}]
function peopleIn_(v) {
  return str_(v).split(";").map(x => x.trim()).filter(Boolean).map(x => {
    const m = /^(.*?)\s*\((\d{15,21})\)\s*$/.exec(x);
    if (m) return { name: m[1].trim(), id: m[2] };
    if (/^\d{15,21}$/.test(x)) return { name: "", id: x };
    return { name: x, id: "" };
  });
}
function logHours_(form, values) {
  const h = form.hours, cfg = getConfig_();
  const ws = cfg.settings.hours ? cfg.settings.hours.weekStart : 1;
  const start = hhmm_(values[h.startField]), end = hhmm_(values[h.endField]);
  if (start == null || end == null) return { problem: "hours not counted: the " + (start == null ? "start" : "end") + " time is missing" };
  let minutes = end - start;
  if (minutes < 0) minutes += 24 * 60;        // shift ran past midnight
  if (!minutes) return { problem: "hours not counted: start and end time are the same" };
  const day = parseYmd_(values[h.dateField]) || new Date();
  const week = weekOf_(day, ws);
  const caseF = allFields_(form).find(f => f.type === "case_number");
  const reportNo = caseF ? str_(values[caseF.id]) : "";
  const seen = {}, rows = [];
  (h.people || []).forEach(fid => {
    const fd = allFields_(form).find(f => f.id === fid);
    peopleIn_(values[fid]).forEach(p => {
      const key = p.id || p.name.toLowerCase();
      if (!key || seen[key]) return;
      seen[key] = 1;
      rows.push([new Date(), "'" + week, form.title, form.id, cellSafe_(reportNo), cellSafe_(p.name), p.id ? "'" + p.id : "", fd ? cleanLabel_(fd.label) : fid,
        "'" + ymd_(day), "'" + str_(values[h.startField]), "'" + str_(values[h.endField]), minutes, Math.round(minutes / 6) / 10, minutes > 12 * 60 ? "Long shift - check times" : ""]);
    });
  });
  if (!rows.length) return { problem: "hours not counted: nobody was picked in the officer boxes" };
  const sh = hoursSheet_();
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  return { rows: rows.length };
}
// Totals for one week: { week, weeks:[...], divisions:[{form, title, officers:[{name,id,minutes,reports}]}] }
function hoursSummary_(week) {
  const cfg = getConfig_(), ws = cfg.settings.hours ? cfg.settings.hours.weekStart : 1;
  const data = hoursSheet_().getDataRange().getValues();
  const weeks = {}, div = {};
  week = week || weekOf_(new Date(), ws);
  for (let i = 1; i < data.length; i++) {
    const r = data[i], wk = str_(r[1]).replace(/^'/, "");
    if (!wk) continue;
    weeks[wk] = 1;
    if (wk !== week) continue;
    const fid = str_(r[3]), id = str_(r[6]).replace(/^'/, ""), name = str_(r[5]);
    const key = id || name.toLowerCase();
    const d = div[fid] || (div[fid] = { form: fid, title: str_(r[2]), officers: {} });
    const o = d.officers[key] || (d.officers[key] = { name: name, id: id, minutes: 0, reports: 0 });
    o.minutes += Number(r[11]) || 0; o.reports++;
    if (name) o.name = name;
  }
  weeks[weekOf_(new Date(), ws)] = 1;
  const order = cfg.forms.map(f => f.id);
  return { week: week, weekStart: ws, weeks: Object.keys(weeks).sort().reverse(),
    divisions: Object.keys(div).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(k => {
      const d = div[k]; const f = cfg.forms.find(x => x.id === k);
      return { form: k, title: f ? f.title : d.title, icon: f ? f.icon || "" : "", officers: Object.keys(d.officers).map(x => d.officers[x]).sort((a, b) => b.minutes - a.minutes) };
    }) };
}
// One Discord message per week, edited as reports come in; a new week starts a new message.
function updateHoursBoard_(cfg) {
  const hs = cfg.settings.hours || {};
  const hook = webhookById_(hs.webhookId);
  if (!hook) throw new Error("hours board webhook not set");
  const sum = hoursSummary_();
  const wk = parseYmd_(sum.week), endD = new Date(wk.getTime()); endD.setDate(endD.getDate() + 6);
  const tz = Session.getScriptTimeZone(), fmt = d => Utilities.formatDate(d, tz, "MMM d");
  const fields = [];
  let grand = 0;
  sum.divisions.forEach(d => {
    const mins = d.officers.reduce((n, o) => n + o.minutes, 0); grand += mins;
    const lines = d.officers.map((o, j) => {
      const medal = j === 0 ? "🥇" : j === 1 ? "🥈" : j === 2 ? "🥉" : "▫️";
      const cs = o.name.indexOf("|") !== -1 ? "`" + o.name.split("|")[0].trim() + "` " : "";
      const who = o.id ? cs + "<@" + o.id + ">" : "**" + o.name + "**";
      return medal + " " + who + " — **" + hoursFmt_(o.minutes) + "** · " + o.reports + " report" + (o.reports === 1 ? "" : "s");
    });
    addListFields_(fields, (d.icon ? d.icon + " " : "") + (d.title.replace(/\s*(flight|incident)?\s*report\s*$/i, "").trim() || d.title).toUpperCase() + "  ·  " + hoursFmt_(mins), lines);
  });
  const stamp = Utilities.formatDate(new Date(), tz, "MM/dd/yyyy 'at' h:mm a");
  const embed = { title: clip_(hs.title || "LSPD Weekly Hours", 200) + "  ·  " + fmt(wk) + " – " + fmt(endD), color: 0x22d3ee,
    description: "Hours from filed reports (start → end time).\nTotal this week: **" + hoursFmt_(grand) + "**\n*Last updated: " + stamp + "*",
    fields: fields.slice(0, 25) };
  if (!fields.length) embed.description += "\n\n_No hours logged this week yet._";
  const payload = { content: "", allowed_mentions: { parse: [] }, embeds: [embed] };
  const msgId = PROPS_.getProperty("HOURS_MSG") || "", msgWeek = PROPS_.getProperty("HOURS_WEEK") || "";
  if (msgId && msgWeek === sum.week) {
    const th = PROPS_.getProperty("HOURS_THREAD") || "";
    const res = UrlFetchApp.fetch(hook.url + "/messages/" + msgId + (th ? "?thread_id=" + th : ""), { method: "patch", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true });
    if (res.getResponseCode() === 200) return;
    if (res.getResponseCode() !== 404) throw new Error("Discord (" + res.getResponseCode() + ")");
  }
  if (hook.kind !== "text") payload.thread_name = clip_(embed.title, 100);    // forum: a new thread each week
  const r = discordPost_(hook.url, payload, null);
  if (!r.ok) throw new Error(r.error);
  if (r.body && r.body.id) { PROPS_.setProperty("HOURS_MSG", r.body.id); PROPS_.setProperty("HOURS_WEEK", sum.week); PROPS_.setProperty("HOURS_THREAD", hook.kind !== "text" && r.body.channel_id ? r.body.channel_id : ""); }
}

// =====================================================================
// TRAINING PROGRESSION (one or more programs: people from a roster tab; requirements credited by reports or by an admin)
//   "cpl"     = CPL → SGT (settings.promo, kept for older setups)
//   others    = settings.programs[]  (e.g. "onboard" = Onboarding)
// =====================================================================
const PROMO_DEFAULT_ = {
  id: "cpl", noun: "Corporal", on: true, title: "CPL → SGT", subtitle: "Corporal requirements for promotion to Sergeant. Progress updates automatically when a report is filed.",
  rosterTabId: null, rosterTabName: "FTO - Roster", col: "C", match: "L-5##", allRows: false, tigDays: 14, tigCol: "G", tigTabId: null, tigTabName: "LSPD Personnel Roster",
  tasks: [
    { id: "gomWitness", title: "Witness a Global Operation Manual Training", need: 1, desc: "Sit in on a GOM training hosted by a SGT+.", sources: [{ form: "suptask", person: "stCpl", field: "stTask", value: "Witness a Global Operation Manual Training" }, { form: "gomtraining", person: "gtWitness", field: "", value: "" }] },
    { id: "gomLead", title: "Lead a GOM Training with a SGT+ hosting", need: 1, desc: "Run the training while a SGT+ hosts and observes.", sources: [{ form: "suptask", person: "stCpl", field: "stTask", value: "Lead a GOM Training with a SGT+ hosting" }, { form: "gomtraining", person: "gtInstructor", field: "gtSupervisor", value: "" }] },
    { id: "gomSolo", title: "Complete GOM Trainings on their own", need: 2, freshDays: 21, desc: "Host and complete the training without a SGT+. Only the last 21 days count.", sources: [{ form: "suptask", person: "stCpl", field: "stTask", value: "Complete a GOM Training on their own" }, { form: "gomtraining", person: "gtInstructor", field: "gtSupervisor", value: "", op: "empty" }] },
    { id: "witness71", title: "Witness a SGT+ handle a 10-71 request", need: 3, freshDays: 21, desc: "Observe a SGT+ respond to a supervisor (71) request. Only the last 21 days count.", sources: [{ form: "suptask", person: "stCpl", field: "stTask", value: "Witness a SGT+ handle a 71 request" }] },
    { id: "supervisorRa", title: "Supervisor Ride-Along with a SGM+", need: 1, desc: "Final step: only after the 14-day time in grade and every other requirement.", final: true, sources: [{ form: "suptask", person: "stCpl", field: "stTask", value: "Supervisor Ride-Along with a SGM+" }] }
  ]
};
const ONBOARD_DEFAULT_ = {
  id: "onboard", noun: "Officer", on: true, title: "Onboarding", subtitle: "New officers' first steps. Boxes tick themselves when the Basic Training log or the Academy Evaluation is filed.",
  rosterTabId: null, rosterTabName: "Onboarding", col: "A", match: "L-8##", allRows: true, tigDays: 0, tigCol: "G", tigTabId: null, tigTabName: "",
  deadlineDays: 14, warnDays: 4, ext: { task: "bpa", window: 4, days: 5 },   // 14 days from joining; Basic Training done in the last 4 days -> 5 more days
  tasks: [
    { id: "bpa", title: "Basic Training - BPA", need: 1, desc: "Complete Basic Training (BPA): the Global Operation Manual training.", sources: [{ form: "bpalog", person: "bpTrainee", field: "bpResult", value: "Passed" }, { form: "gomtraining", person: "gtTrainees.trainee", field: "gtCompleted", value: "Yes" }] },
    { id: "academyRa", title: "Academy in-depth RA", need: 1, desc: "Ride-along covered by the Academy Evaluation.", sources: [{ form: "academy", person: "traineeCallsign", field: "", value: "" }, { form: "academy", person: "traineeDiscordId", field: "", value: "" }] }
  ]
};
function cleanPromo_(p, dflt, id) {
  dflt = dflt || PROMO_DEFAULT_;
  if (!p) return JSON.parse(JSON.stringify(dflt));
  const out = {
    id: id || dflt.id, noun: clip_(str_(p.noun) || dflt.noun || "Person", 30),
    on: p.on !== false, title: clip_(str_(p.title) && str_(p.title) !== "SGT Promotion Tracker" ? str_(p.title) : dflt.title, 80), subtitle: clip_(str_(p.subtitle), 300),
    rosterTabId: p.rosterTabId != null && p.rosterTabId !== "" && isFinite(Number(p.rosterTabId)) ? Number(p.rosterTabId) : null,
    rosterTabName: String(p.rosterTabName || "").substring(0, 100),
    col: /^[A-Za-z]{1,2}$/.test(str_(p.col)) ? str_(p.col).toUpperCase() : "",
    match: clip_(str_(p.match), 40), allRows: !!p.allRows, tigDays: Math.max(0, Math.min(365, parseInt(p.tigDays, 10) || 0)),
    tigCol: /^[A-Za-z]{1,2}$/.test(str_(p.tigCol)) ? str_(p.tigCol).toUpperCase() : "",
    tigTabId: p.tigTabId != null && p.tigTabId !== "" && isFinite(Number(p.tigTabId)) ? Number(p.tigTabId) : null,
    tigTabName: String(p.tigTabName == null ? (dflt.tigTabName || "") : p.tigTabName).substring(0, 100),
    deadlineDays: Math.max(0, Math.min(365, parseInt(p.deadlineDays == null ? dflt.deadlineDays : p.deadlineDays, 10) || 0)),
    warnDays: Math.max(0, Math.min(60, parseInt(p.warnDays == null ? (dflt.warnDays == null ? 4 : dflt.warnDays) : p.warnDays, 10) || 0)),
    ext: (() => { const e = p.ext === undefined ? dflt.ext : p.ext; return e && str_(e.task) ? { task: str_(e.task), window: Math.max(0, Math.min(60, parseInt(e.window, 10) || 0)), days: Math.max(0, Math.min(60, parseInt(e.days, 10) || 0)) } : null; })(),
    tasks: []
  };
  const ids = {};
  (p.tasks || []).slice(0, 12).forEach(t => {
    const tid = str_(t.id);
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(tid) || ids[tid]) throw new Error(out.title + ": every requirement needs its own ID (letters/numbers).");
    ids[tid] = 1;
    if (!str_(t.title)) throw new Error(out.title + ": a requirement has no title.");
    const fd = t.freshDays == null ? ((dflt.tasks || []).find(x => x.id === tid) || {}).freshDays : t.freshDays;   // "only the last N days count"
    out.tasks.push({ id: tid, title: clip_(str_(t.title), 120), desc: clip_(str_(t.desc), 300), need: Math.max(1, Math.min(50, parseInt(t.need, 10) || 1)), final: !!t.final,
      freshDays: Math.max(0, Math.min(365, parseInt(fd, 10) || 0)),
      sources: (t.sources || []).slice(0, 6).map(x => ({ form: str_(x.form), person: str_(x.person), field: str_(x.field), value: clip_(str_(x.value), 120), op: x.op === "empty" ? "empty" : "" })).filter(x => x.form && x.person) });
  });
  return out;
}
function onboardFix_(p) {          // Onboarding: callsigns in A, join date in G, only L-8##, 14-day deadline (unless set otherwise)
  if (p && p.id === "onboard") {
    if (!p.col) p.col = "A"; if (!p.match) p.match = "L-8##"; if (!p.tigCol) p.tigCol = "G";
    if (p.deadlineDays == null) p.deadlineDays = 14; if (p.warnDays == null) p.warnDays = 4; if (p.ext === undefined) p.ext = { task: "bpa", window: 4, days: 5 };
  }
  return p;
}
function cleanPrograms_(list) {
  const out = [], seen = { cpl: 1 };
  list = Array.isArray(list) ? list.slice() : [ONBOARD_DEFAULT_];
  if (!list.some(p => p && str_(p.id).toLowerCase() === "onboard")) list.unshift(ONBOARD_DEFAULT_);   // Onboarding is always there (turn it off instead of deleting)
  (Array.isArray(list) ? list : [ONBOARD_DEFAULT_]).slice(0, 8).forEach(p => {
    const id = str_(p && p.id).toLowerCase();
    if (!/^[a-z][a-z0-9-]{1,20}$/.test(id) || seen[id]) throw new Error("Training Progression: each program needs its own short ID (letters, numbers, dashes).");
    seen[id] = 1;
    out.push(onboardFix_(cleanPromo_(p, id === "onboard" ? ONBOARD_DEFAULT_ : Object.assign({}, ONBOARD_DEFAULT_, { title: "New program", tasks: [] }), id)));
  });
  return out;
}
// every program, CPL first
// saved setups made before the GOM Training form get its sources added (once a source for that form exists it's left alone)
function addDefaultSources_(p, dflt) {
  (p.tasks || []).forEach(t => {
    const d = (dflt.tasks || []).find(x => x.id === t.id); if (!d) return;
    (d.sources || []).forEach(ds => { if (!(t.sources || []).some(x => x.form === ds.form)) t.sources = (t.sources || []).concat([Object.assign({}, ds)]); });
  });
  return p;
}
function programs_(cfg) {
  const s = (cfg || getConfig_()).settings || {};
  const cpl = Object.assign({}, PROMO_DEFAULT_, s.promo || {}, { id: "cpl" });
  if (cpl.title === "SGT Promotion Tracker") cpl.title = PROMO_DEFAULT_.title;
  if (!cpl.noun) cpl.noun = "Corporal";
  cpl.tasks = (cpl.tasks || []).map(t => t.freshDays == null && (PROMO_DEFAULT_.tasks.find(x => x.id === t.id) || {}).freshDays ? Object.assign({}, t, { freshDays: PROMO_DEFAULT_.tasks.find(x => x.id === t.id).freshDays }) : t);
  if (s.promo && !s.promo.col && s.promo.match) cpl.col = "C";
  const more = (Array.isArray(s.programs) ? s.programs : []).map(p => Object.assign({}, p));
  if (!more.some(p => p.id === "onboard")) more.unshift(JSON.parse(JSON.stringify(ONBOARD_DEFAULT_)));
  if (more.length && more[0].id === "onboard" && !(more[0].tasks || []).length) more[0].tasks = JSON.parse(JSON.stringify(ONBOARD_DEFAULT_.tasks));
  addDefaultSources_(cpl, PROMO_DEFAULT_);
  return [cpl].concat(more.map(onboardFix_).map(p => p.id === "onboard" ? addDefaultSources_(p, ONBOARD_DEFAULT_) : p));
}
function promoCfg_(cfg, pid) {
  const all = programs_(cfg);
  return all.find(p => p.id === (pid || "cpl")) || all[0];
}
const progId_ = pid => (pid && pid !== "cpl" ? pid : "cpl");
const taskKey_ = (pid, tid) => progId_(pid) === "cpl" ? tid : pid + ":" + tid;          // CPL keeps plain IDs (older sheets)
const metaType_ = (pid, type) => progId_(pid) === "cpl" ? type : type + ":" + pid;      // "since" / "seen" per program
function promoSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(PROMO_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(PROMO_SHEET_);
    sh.appendRow(["Entry", "Logged", "Type", "Key", "Callsign", "Name", "Task", "Count", "Form", "Report #", "Date", "Note", "By", "Removed"]);
    sh.setFrozenRows(1); sh.getRange(1, 1, 1, 14).setFontWeight("bold"); sh.getRange("D:D").setNumberFormat("@"); sh.getRange("K:K").setNumberFormat("@");
  }
  return sh;
}
function promoClearCache_() {
  try { CacheService.getScriptCache().removeAll(programs_().map(p => "promo_view_" + p.id).concat(["promo_view"])); } catch (e) {}
}
function promoRebuild_() { programs_().forEach(p => { try { if (p.on) promoView_(false, p.id); } catch (e) {} }); }
function promoAppend_(list) {
  const rows = list.map(e => [Utilities.getUuid().slice(0, 8), new Date(), e.type, "'" + e.c.key, e.c.callsign, cellSafe_(e.c.name), e.task, e.count || 0, e.form || "", cellSafe_(e.report || ""), e.date ? "'" + e.date : "", cellSafe_(e.note || ""), e.by || "", ""]);
  if (!rows.length) return;
  const sh = promoSheet_();
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  promoClearCache_();
}
// "L-5##" -> /^L5\d\d$/ (letters/digits only, so "L-501", "L501" and "l 501" all match)
function promoRe_(pattern) {
  const p = str_(pattern).toUpperCase().replace(/[^A-Z0-9#*]/g, "");
  return new RegExp("^" + p.replace(/#/g, "\\d").replace(/\*/g, "[A-Z0-9]*") + "$");
}
function promoTabId_(pc, which) {
  const id = which === "tig" ? pc.tigTabId : pc.rosterTabId, name = which === "tig" ? pc.tigTabName : pc.rosterTabName;
  if (id != null) return id;
  if (!str_(name)) return null;
  const want = str_(name).toLowerCase();
  const sheets = rosterBook_().getSheets();
  const sh = sheets.find(x => x.getName() === name) || sheets.find(x => x.getName().trim().toLowerCase() === want) ||
    (which !== "tig" && sheets.find(x => x.getName().toLowerCase().indexOf(want.replace(/s$/, "")) !== -1));   // "Onboarding" also finds "Onboarding - Roster"
  return sh ? sh.getSheetId() : null;
}
// People in a program: [{ key, callsign, name, id, tigRaw }]
function promoCandidates_(fresh, pid) {
  const pc = promoCfg_(null, pid);
  const tabId = promoTabId_(pc);
  if (tabId == null) return { error: "Roster tab \"" + pc.rosterTabName + "\" not found in the roster sheet.", list: [] };
  // time in grade: a column on another tab (e.g. LSPD Personnel Roster col G), matched by Discord ID / callsign / name
  const tigTab = pc.tigCol ? promoTabId_(pc, "tig") : null;
  const ownTab = pc.tigTabId == null && !str_(pc.tigTabName);
  const sameTab = !!pc.tigCol && (ownTab || tigTab === tabId);
  const cols = [pc.col].concat(sameTab ? [pc.tigCol] : []).filter((x, i, a) => x && a.indexOf(x) === i).sort();
  const tab = getRosterTab_(tabId, !!fresh, cols, false, !!pc.allRows);
  let tigPeople = [];
  if (pc.tigCol && !sameTab && tigTab != null) { try { tigPeople = getRosterTab_(tigTab, !!fresh, [pc.tigCol]).people || []; } catch (e) {} }
  const re = str_(pc.match) ? promoRe_(pc.match) : null, list = [], seen = {};
  (tab.people || []).forEach(p => {
    // callsign: the chosen column, else the "L-801 | Name" prefix the roster already gives
    let cs = pc.col ? str_(p.more && p.more[pc.col]) : "";
    if (!cs && p.name.indexOf("|") !== -1) cs = p.name.split("|")[0].trim();
    if (re && (!cs || !re.test(cs.toUpperCase().replace(/[^A-Z0-9]/g, "")))) return;
    const name = p.name.indexOf("|") !== -1 ? p.name.split("|").slice(1).join("|").trim() : (cs ? p.name.replace(cs, "").trim() : p.name);
    const key = p.id || (cs ? "CS:" + callKey_(cs) : "NM:" + nameKey_(name || p.name));
    if (seen[key]) return; seen[key] = 1;
    let tigRaw = sameTab ? str_(p.more && p.more[pc.tigCol]) : "";
    if (!sameTab && tigPeople.length) {
      const ck = callKey_(cs), nk = nameKey_(name || p.name);
      const m = (p.id && tigPeople.find(x => x.id === p.id)) || (ck && tigPeople.find(x => callKey_(x.name) === ck)) || (nk && tigPeople.find(x => nameKey_(x.name) === nk));
      if (m) tigRaw = str_(m.more && m.more[pc.tigCol]);
    }
    list.push({ key: key, callsign: cs, name: name || p.name, id: p.id || "", tigRaw: tigRaw });
  });
  list.sort((a, b) => (a.callsign || "~").localeCompare(b.callsign || "~", undefined, { numeric: true }) || a.name.localeCompare(b.name));
  return { error: tab.error || "", list: list, tab: tab.tab };
}
function promoFind_(key, pid) {
  const c = promoCandidates_(false, pid).list.find(x => x.key === str_(key));
  if (!c) throw new Error("That person isn't on the roster tab any more.");
  return c;
}
function promoTask_(id, pid) {
  const t = promoCfg_(null, pid).tasks.find(x => x.id === str_(id));
  if (!t) throw new Error("Unknown requirement.");
  return t;
}
// Same person? "A. Ramirez" = "Alex Ramirez" = "a ramirez" (same last name and first initial)
function sameName_(a, b) {
  const x = nameKey_(a), y = nameKey_(b);
  if (!x || !y) return true;
  if (x === y) return true;
  const xs = x.split(" "), ys = y.split(" ");
  return xs[xs.length - 1] === ys[ys.length - 1] && xs[0][0] === ys[0][0];
}
// Whose record is this Promotion Log row? A spot (callsign) can change hands: when someone leaves the roster
// and a new person takes their callsign, the old person's check marks must NOT carry over to the new person.
//  - a row saved under a Discord ID belongs to whoever has that ID now
//  - a row saved under a callsign / name (no Discord ID on the roster) belongs to that spot only if the name matches
//  - an old row whose Discord ID is gone moves to a callsign only when it's the same person (their ID was added/changed)
// Returns the candidate's key, or "" when the row belongs to someone no longer on the roster.
function promoOwner_(r, list) {
  const k = str_(r[3]).replace(/^'/, ""), nm = str_(r[5]), byId = !/^(CS|NM):/.test(k);
  const exact = list.find(c => c.key === k);
  if (exact && (byId || sameName_(nm, exact.name))) return k;
  const ck = callKey_(str_(r[4]));
  const c = ck && nameKey_(nm) && list.find(x => x.callsign && callKey_(x.callsign) === ck && nameKey_(x.name) && sameName_(nm, x.name));
  return c ? c.key : "";
}
// remember the first day each person showed up (used for time in grade when no date is set)
function promoSync_() {
  const data = promoSheet_().getDataRange().getValues(), add = [];
  programs_().forEach(pc => {
    if (!pc.on || !pc.tigDays) return;
    const cands = promoCandidates_(false, pc.id).list;
    const have = {}, tS = metaType_(pc.id, "since"), tN = metaType_(pc.id, "seen");
    for (let i = 1; i < data.length; i++) if (data[i][2] === tS || data[i][2] === tN) { const k = promoOwner_(data[i], cands); if (k) have[k] = 1; }
    cands.filter(c => !have[c.key]).forEach(c => add.push({ type: tN, c: c, task: "", date: ymd_(new Date()), by: "system" }));
  });
  if (add.length) withLock_(() => { promoAppend_(add); return { ok: true }; });
}
// A filed report -> credits for every person named in the right box of a matching report, in every program
function promoFromReport_(cfg, form, values, repeaters) {
  repeaters = repeaters || {};
  // "trainees.trainee" = every row of list "trainees", column "trainee"
  const personVals = path => path.indexOf(".") === -1 ? [values[path]] : (repeaters[path.split(".")[0]] || []).map(r => r[path.split(".")[1]]).filter(Boolean);
  const caseF = allFields_(form).find(f => f.type === "case_number");
  const reportNo = caseF ? str_(values[caseF.id]) : "";
  const out = [], missed = [];
  // the report's result ("Completed: No", "Final Result: FAILED", "Needs retake", "Half Way Completed"):
  // the person being evaluated is NOT checked off, but the report is kept in their record marked with that result
  const outF = allFields_(form).find(f => f.type === "select" && /complete|result|status|outcome|pass|evaluation/i.test(f.label || ""));
  const outVal = outF ? str_(values[outF.id]).replace(/^[-–•\s]+/, "") : "";
  const failed = !!outVal && FAIL_RE_.test(outVal);
  const evaluated = src => src.field ? src.field === (outF && outF.id) : TRAINEE_RE_.test(src.person + " " + fieldLabel_(form, src.person));
  programs_(cfg).forEach(pc => {
    if (!pc.on) return;
    const hits = [];
    (pc.tasks || []).forEach(t => (t.sources || []).forEach(src => {
      if (src.form !== form.id) return;
      if (failed && evaluated(src)) { hits.push({ t: t, src: src, fail: true }); return; }
      if (src.field) {
        const v = str_(values[src.field]).toLowerCase(), want = str_(src.value).toLowerCase();
        if (src.op === "empty") { if (v) return; }                       // e.g. counts only when nobody supervised
        else if (want ? v.indexOf(want) === -1 : !v) return;
      }
      hits.push({ t: t, src: src });
    }));
    if (!hits.length) return;
    const cr = promoCandidates_(false, pc.id), cands = cr.list, done = {};
    const tabId = cr.error ? null : promoTabId_(pc);
    // only warn when the name box picks from this program's own roster tab (so a miss really is a mistake)
    const linked = hits.some(h => {
      let f = allFields_(form).find(x => x.id === h.src.person);
      if (!f && h.src.person.indexOf(".") !== -1) { const b = (form.blocks || []).find(x => x.id === h.src.person.split(".")[0]); f = b && (b.columns || []).find(c => c.id === h.src.person.split(".")[1]); }
      return f && tabId != null && Number(f.rosterTabId) === Number(tabId);
    });
    let any = false;
    hits.forEach(h => {
      personVals(h.src.person).forEach(pv => peopleIn_(pv).forEach(p => {
        const ck = callKey_(p.name), nk = nameKey_(p.name);
        const c = (p.id && cands.find(x => x.id === p.id)) || (ck && cands.find(x => x.callsign && callKey_(x.callsign) === ck)) || (nk && cands.find(x => nameKey_(x.name) === nk));
        if (!c) return;
        any = true;
        if (done[c.key + h.t.id]) return;
        done[c.key + h.t.id] = 1;
        out.push({ type: h.fail ? "fail" : "credit", c: c, task: taskKey_(pc.id, h.t.id), count: h.fail ? 0 : 1, form: form.id, report: reportNo, date: ymd_(parseYmd_(firstDate_(form, values)) || new Date()), by: "report",
          note: h.fail ? (/^no\b/i.test(outVal) ? "Not Complete" : clip_(outVal, 60)) : "" });
      }));
    });
    if (!any && linked) missed.push(pc.title);
  });
  if (out.length) promoAppend_(out);
  return { credited: out.length, problem: !out.length && missed.length ? "training progression (" + missed.join(", ") + "): nobody picked is on that roster tab, so nothing was checked off" : "" };
}
const FAIL_RE_ = /fail|not\s*complete|incomplete|unfinished|half|partial|retake|redo|^no\b|denied|terminat|reject|did\s*not|didn't|unsat/i;
const TRAINEE_RE_ = /trainee|student|cadet|recruit|onboard|candidate/i;
function fieldLabel_(form, path) {
  const p = String(path || ""), f = allFields_(form).find(x => x.id === p);
  if (f) return f.label || "";
  const b = (form.blocks || []).find(x => x.id === p.split(".")[0]), c = b && (b.columns || []).find(x => x.id === p.split(".")[1]);
  return (b ? (b.title || "") + " " : "") + (c ? c.label || "" : "");
}
function firstDate_(form, values) { const f = allFields_(form).find(x => x.type === "date"); return f ? values[f.id] : ""; }
// Everything a progression page shows. admin=true adds entry IDs + notes for editing.
function promoView_(admin, pid) {
  pid = progId_(pid);
  const cache = CacheService.getScriptCache(), ck = "promo_view_" + pid;
  if (!admin) { const hit = cache.get(ck); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  const cfg = getConfig_(), pc = promoCfg_(cfg, pid);
  const base = { id: pc.id, noun: pc.noun || "Person", on: pc.on, title: pc.title, subtitle: pc.subtitle, tigDays: pc.tigDays,
    deadlineDays: pc.deadlineDays || 0, warnDays: pc.warnDays || 0, ext: pc.ext || null,
    showTig: !!(pc.tigDays || pc.tigCol), tigLabel: pc.id === "cpl" ? "TIG" : "Joined",
    tasks: (pc.tasks || []).map(t => ({ id: t.id, title: t.title, desc: t.desc, need: t.need, final: t.final, freshDays: t.freshDays || 0 })) };
  if (!pc.on && !admin) return base;
  const cr = promoCandidates_(false, pid);
  const data = promoSheet_().getDataRange().getValues();
  const byKey = {}, since = {}, seen = {}, excused = {};
  const tS = metaType_(pid, "since"), tN = metaType_(pid, "seen");
  const mine = {}; (pc.tasks || []).forEach(t => mine[taskKey_(pid, t.id)] = t.id);
  const keyFor = r => promoOwner_(r, cr.list) || "gone:" + str_(r[3]);   // someone who left: their records stay in the sheet but go to nobody
  for (let i = 1; i < data.length; i++) {
    const r = data[i], type = str_(r[2]);
    if (type === tS) since[keyFor(r)] = str_(r[10]).replace(/^'/, "");
    else if (type === tN) { const k = keyFor(r); if (!seen[k]) seen[k] = str_(r[10]).replace(/^'/, ""); }
    else if ((type === "excuse" || type === "unexcuse") && mine[str_(r[6])]) excused[keyFor(r) + "|" + mine[str_(r[6])]] = type === "excuse";
    else if ((type === "credit" || type === "fail") && !str_(r[13]) && mine[str_(r[6])]) {
      const k = keyFor(r), fail = type === "fail";
      (byKey[k] = byKey[k] || []).push({ entry: str_(r[0]), task: mine[str_(r[6])], count: fail ? 0 : Number(r[7]) || 1, form: str_(r[8]), report: str_(r[9]), date: str_(r[10]).replace(/^'/, ""), by: str_(r[12]),
        note: admin && !fail ? str_(r[11]) : "", failed: fail ? str_(r[11]) || "Not complete" : "" });
    }
  }
  const forms = {}; cfg.forms.forEach(f => forms[f.id] = f.title);
  const today = parseYmd_(ymd_(new Date()));
  base.error = cr.error;
  base.candidates = cr.list.map(c => {
    const credits = byKey[c.key] || [];
    let sinceDate = since[c.key] || "", sinceSrc = sinceDate ? "set" : "";
    if (!sinceDate && c.tigRaw) {
      if (/^\d{1,4}$/.test(c.tigRaw.trim())) { const d = new Date(today.getTime() - Number(c.tigRaw) * 864e5); sinceDate = ymd_(d); sinceSrc = "roster"; }   // a day count
      else { const d = new Date(c.tigRaw); if (!isNaN(d)) { sinceDate = ymd_(d); sinceSrc = "roster"; } }               // a date
    }
    if (!sinceDate && seen[c.key]) { sinceDate = seen[c.key]; sinceSrc = "first seen"; }
    const tig = sinceDate ? Math.max(0, Math.round((today - parseYmd_(sinceDate)) / 864e5)) : null;
    const tasks = {};
    (pc.tasks || []).forEach(t => {
      const items = credits.filter(x => x.task === t.id).sort((a, b) => a.date < b.date ? -1 : 1);
      // "only the last N days count": older completions stay in the record but don't count (and can expire)
      const cutoff = t.freshDays ? today.getTime() - t.freshDays * 864e5 : null;
      const isOld = x => cutoff != null && (!parseYmd_(x.date) || parseYmd_(x.date).getTime() < cutoff);
      const count = items.reduce((n, x) => n + (isOld(x) ? 0 : x.count), 0);
      tasks[t.id] = { count: count, need: t.need, done: count >= t.need || !!excused[c.key + "|" + t.id], excused: !!excused[c.key + "|" + t.id],
        items: items.map(x => ({ entry: admin ? x.entry : undefined, date: x.date, count: x.count, source: x.form ? (forms[x.form] || x.form) : "Added by admin", report: x.report, note: x.note || undefined, failed: x.failed || undefined, expired: !x.failed && isOld(x) || undefined })) };
    });
    const others = (pc.tasks || []).filter(t => !t.final).every(t => tasks[t.id].done);
    const tigOk = !pc.tigDays || (tig != null && tig >= pc.tigDays);
    (pc.tasks || []).filter(t => t.final).forEach(t => { tasks[t.id].locked = !(others && tigOk); });
    const doneN = (pc.tasks || []).filter(t => tasks[t.id].done).length;
    const complete = doneN === (pc.tasks || []).length && (pc.tasks || []).length > 0;
    // deadline: N days from the start date; finishing the "extension" requirement in the last few days buys extra days from that date
    let dl = null;
    if (pc.deadlineDays && sinceDate) {
      let end = parseYmd_(sinceDate).getTime() + pc.deadlineDays * 864e5, extended = false;
      const ex = pc.ext && tasks[pc.ext.task];
      const passed = ex ? ex.items.filter(x => !x.failed) : [];
      if (ex && ex.done && passed.length) {
        const need = Math.max(1, ex.need || 1), at = passed[Math.min(need, passed.length) - 1].date;
        const t = at && parseYmd_(at) ? parseYmd_(at).getTime() : null;
        if (t != null && t >= end - pc.ext.window * 864e5 && t <= end && t + pc.ext.days * 864e5 > end) { end = t + pc.ext.days * 864e5; extended = true; }
      }
      const left = Math.round((end - today.getTime()) / 864e5);
      dl = { date: ymd_(new Date(end)), left: left, extended: extended,
        state: complete ? "done" : left <= 0 ? "over" : left <= (pc.warnDays || 0) ? "warn" : "ok" };
    }
    return { key: admin ? c.key : undefined, callsign: c.callsign, name: c.name, since: sinceDate, sinceSrc: admin ? sinceSrc : undefined, tig: pc.tigDays || pc.tigCol ? tig : null, tigOk: tigOk,
      tasks: tasks, done: doneN, total: (pc.tasks || []).length, complete: complete, deadline: dl };
  });
  base.updated = new Date().toISOString();
  if (!admin) { const js = JSON.stringify(base); if (js.length < 95000) cache.put(ck, js, 1200); }   // 20 min; cleared whenever a completion changes, rebuilt every 10 min
  return base;
}

// ---- Classic Discord layout ----
//   Instructor | Trainee | Session Date      (people with their @mention, then dates)
//   Evaluation Status: • ✅ - PASSED
//   📘 HEADING            **Label:** value   (fields under a heading text block)
//   📘 CHECKLIST          ✅ `item` / ❌ `item`
//   📝 Notes              > text
function classicFields_(form, values, checklists, repFields) {
  const out = [], follow = [], header = [], status = [];
  const isHeading = b => b.type === "text" && (b.style === "heading" || (str_(b.text).length < 60 && str_(b.text) === str_(b.text).toUpperCase() && /[A-Z]/.test(str_(b.text))));
  const firstHeading = (form.blocks || []).findIndex(isHeading);
  const titleCase = t => String(t || "").toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Of|And|The|To|For|In|On)\b/g, w => w.toLowerCase()).replace(/^./, x => x.toUpperCase());
  const mark = v => /pass|approved|complete|clear|yes/i.test(v) ? "✅ " : /fail|denied|terminat|no go|reject/i.test(v) ? "❌ " : "";
  const personVal = (raw, mention) => {
    const m = /^(.*?)\s*\((\d{15,21})\)\s*$/.exec(raw);
    const name = m ? m[1] : raw, id = mention || (m ? m[2] : "");
    return (name || "—") + (id ? " (<@" + id + ">)" : "");
  };
  let sec = null;
  const flush = () => { if (sec && sec.lines.length) out.push({ name: clip_("📘 " + sec.title, 256), value: clip_(sec.lines.join("\n"), 1024), inline: false }); sec = null; };
  const IGN_RE = /in[\s-]?game|\bign\b|character name/i, igns = [];   // "Trainee in Game Name" goes into the Trainee cell
  (form.blocks || []).forEach((b, bi) => {
    const inHeader = firstHeading === -1 || bi < firstHeading;
    if (b.type === "fields" || b.type === "strip") {
      (b.fields || []).forEach(f => {
        if (f.type === "static") return;
        const v = str_(values[f.id]), label = cleanLabel_(f.label || f.id);
        if (IGN_RE.test(label) && f.type !== "discord_id") { if (v) igns.push({ label: label, value: v }); return; }
        if (inHeader) {
          const prev = header[header.length - 1];
          if (f.type === "discord_id") {
            if (prev && prev.person && !prev.mention && (prev.fillId === f.id || sameSubject_(prev.label, label) || (v && prev.raw.indexOf(v) !== -1))) { if (v && prev.raw.indexOf(v) === -1) prev.mention = v; return; }
            if (v) header.push({ label: label.replace(/\s*discord\s*id\s*$/i, "") || label, raw: "", mention: v, person: true });
            return;
          }
          if (f.type === "select" && /result|status|outcome|verdict/i.test(label)) { status.push({ name: /final result/i.test(label) ? "Evaluation Status" : label, value: v ? "• " + mark(v) + v : "—" }); return; }
          const person = f.type === "officer" || f.type === "officers" || !!f.roster;
          header.push({ label: label.replace(/\s*call\s*sign\s*$/i, "").trim() || label, raw: v, person: person, fillId: f.fillId, date: f.type === "date", f: f });
        } else {
          if (!sec) sec = { title: "DETAILS", lines: [] };
          if (v) sec.lines.push("**" + (f.label || f.id).replace(/[:：]\s*$/, "") + ":** " + (f.type === "officer" || f.type === "officers" ? officersText_(v) : displayValue_(f, v).replace(/^[-–•]\s+/, "")));
        }
      });
    } else if (isHeading(b)) { flush(); sec = { title: String(b.text || "").toUpperCase(), lines: [] }; }
    else if (b.type === "checklist") {
      flush();
      const st = checklists[b.id] || {}, items = b.items || [];
      const list = b.display === "selected" ? items.filter(it => st[it.topic] === true) : items;
      const lines = list.map(it => (st[it.topic] === true ? "✅" : "❌") + " `" + String(it.topic).replace(/`/g, "'") + "`");
      addListFields_(out, "📘 " + clip_(String(b.title || "Checklist").toUpperCase(), 240), lines.length ? lines : ["*None*"]);
    } else if (b.type === "repeater") { flush(); (repFields[b.id] || []).forEach(x => out.push(Object.assign({}, x, { name: x.name.replace(/^\S+\s/, "📘 ") }))); }
    else if (b.type === "longtext") {
      flush();
      const v = str_(values[b.id]).substring(0, b.maxLength || 8000), name = "📝 " + clip_(titleCase(b.title || "Notes"), 240);
      if (v.length > 1000 && b.followUp) { follow.push({ title: String(b.title || "Notes").toUpperCase(), text: v }); out.push({ name: name, value: "> *See the next post.*", inline: false }); }
      else out.push({ name: name, value: v ? clip_("> " + v.split("\n").join("\n> "), 1024) : "> *No specific notes provided.*", inline: false });
    }
  });
  flush();
  // header row: leaders (instructor / FTO / lead) first, then other people, then dates and the rest
  const LEAD_RE = /instructor|fto|lead|supervisor|handler|pilot|commander/i;
  const rank = h => h.person ? (LEAD_RE.test(h.label) ? 0 : 1) : h.date ? 2 : 3;
  // in-game name(s) get their own line right above Evaluation Status
  const ignFields = igns.map(g => ({ name: igns.length > 1 ? g.label.replace(IGN_RE, "In-Game Name").replace(/\s+/g, " ").trim() : "In-Game Name", value: g.value, inline: false }));
  const top = header.filter(h => h.raw || h.mention).sort((a, b) => rank(a) - rank(b)).map(h => ({
    name: clip_(h.date && /completed/i.test(h.label) ? "Session Date" : h.label, 256),
    value: clip_(h.person ? personVal(h.raw, h.mention) : h.date ? displayValue_(h.f, h.raw) : h.f ? displayValue_(h.f, h.raw) : h.raw, 1024), inline: true }));
  while (top.length % 3) top.push({ name: "​", value: "​", inline: true });
  return { fields: top.concat(ignFields, status.map(x => ({ name: x.name, value: x.value, inline: false })), out), follow: follow };
}

const FIELD_ICONS_ = [[/date/i, "📅"], [/time/i, "⏰"], [/duration|length|minutes|mins/i, "⏱️"], [/complete|result|status|outcome|pass/i, "🎯"],
  [/supervis/i, "🛡️"], [/instructor|fto\b|trainer|teacher/i, "👨‍🏫"], [/witness|observ/i, "👀"], [/trainee|student|attend|cadet/i, "👥"],
  [/location|where|area|postal/i, "📍"], [/note|comment|remark/i, "📝"], [/officer|unit|member/i, "👮"]];
function fieldIcon_(l) { for (const [re, e] of FIELD_ICONS_) if (re.test(l)) return e; return ""; }
function titleWord_(t) { return String(t || "").toLowerCase().replace(/(^|\s)([a-z])/g, (m, a, b) => a + b.toUpperCase()); }

// "Simple record" Discord layout: emoji labels, Date · Time · Duration across the top,
// people as @mentions, lists as bullets (the original Google Sheets training post)
function recordFields_(form, values, checklists, repeaters) {
  const out = [], follow = [];
  const icon = l => fieldIcon_(l) || "🔹";
  const who = raw => {                                   // "L-505 | J. Raines (1234…)" → <@1234…>
    const m = /^(.*?)\s*\((\d{15,21})\)\s*$/.exec(str_(raw));
    return m ? "<@" + m[2] + ">" : str_(raw);
  };
  const fieldsAll = [];
  (form.blocks || []).forEach(b => { if (b.type === "fields" || b.type === "strip") (b.fields || []).forEach(f => fieldsAll.push(f)); });
  const filledBy = {};                                     // Discord ID boxes filled from a roster pick
  fieldsAll.forEach(f => { if (f.fillId) filledBy[f.fillId] = f; });
  const dateF = fieldsAll.find(f => f.type === "date"), timeF = fieldsAll.find(f => f.type === "time");
  let color = null, top = [];
  fieldsAll.forEach(f => {
    if (f.type === "static" || filledBy[f.id]) return;
    const v = str_(values[f.id]), label = cleanLabel_(f.label || f.id).replace(/^completed .*$/i, "Completed?");
    let val;
    if (f.type === "time" && v) val = discordTime_(dateF ? str_(values[dateF.id]) : "", v) || v;
    else if (f.type === "date" && v) { const p = v.split("-"); val = p.length === 3 ? p[1] + "/" + p[2] + "/" + p[0].slice(2) : v; }
    else if (f.type === "officer" || f.type === "officers") {
      if (!v && !(f.fillId && str_(values[f.fillId]))) return;
      const id = f.fillId ? str_(values[f.fillId]) : "";
      val = v ? str_(v).split(";").map(x => x.trim()).filter(Boolean).map(x => /\(\d{15,21}\)\s*$/.test(x) ? who(x) : id ? "<@" + id + ">" : x).join("\n") : "<@" + id + ">";
    } else if (f.type === "discord_id") { if (!v) return; val = "<@" + v + ">"; }
    else if (f.type === "select" && /yes|no|pass|fail/i.test(v) && /complete|result|status|outcome|pass/i.test(label)) {
      const good = /^(yes|pass|passed|complete|completed|approved)$/i.test(v);
      val = (good ? "✅ " : "❌ ") + "**" + v + "**"; if (color == null) color = good ? 0x2ECC71 : 0xE74C3C;
    } else { if (!v) return; val = v; }
    if (/duration|minutes|mins/i.test(f.label || "") && /^\d+(\.\d+)?$/.test(v)) val = v + " mins";
    const it = { name: clip_(icon(label) + " " + label, 256), value: clip_(val || "—", 1024), inline: f.type === "date" || f.type === "time" || /duration/i.test(label) };
    top.push(it);
  });
  // date / time / duration share the first row
  const row = top.filter(x => x.inline), rest = top.filter(x => !x.inline);
  out.push(...row); if (row.length % 3 && rest.length) while (out.length % 3) out.push({ name: "\u200b", value: "\u200b", inline: true });
  out.push(...rest);
  (form.blocks || []).forEach(b => {
    if (b.type === "repeater") {
      const cols = b.columns || [];
      const rows = (repeaters[b.id] || []).filter(r => cols.some(c => str_(r[c.id])));
      const lines = rows.map(r => {
        const parts = cols.map(c => str_(r[c.id]));
        const head = cols[0] && (cols[0].type === "officer" || /\(\d{15,21}\)\s*$/.test(parts[0])) ? who(parts[0]) : /^\d{15,21}$/.test(parts[0]) ? "<@" + parts[0] + ">" : parts[0];
        const extra = parts.slice(1).filter(Boolean).map(x => "*" + x + "*").join(" · ");
        return "• " + (head || "—") + (extra ? " — " + extra : "");
      });
      const t = titleWord_(b.title || "List");
      addListFields_(out, icon(t) + " " + t + " (" + rows.length + ")", lines.length ? lines : ["*None listed*"]);
    } else if (b.type === "checklist") {
      const st = checklists[b.id] || {};
      addListFields_(out, "☑️ " + titleWord_(b.title || "Checklist"), (b.items || []).map(it => (st[it.topic] === true ? "✅ " : "❌ ") + it.topic));
    } else if (b.type === "longtext") {
      const v = str_(values[b.id]); if (!v) return;
      if (v.length > 1000) follow.push({ title: String(b.title || "Notes").toUpperCase(), text: v });
      else out.push({ name: "📝 " + titleWord_(b.title || "Notes"), value: clip_(v, 1024), inline: false });
    }
  });
  return { fields: out, follow: follow, color: color };
}

// "2026-10-22" + "15:38" (Eastern) → <t:…:t>, which Discord shows in each reader's own time
function discordTime_(date, time) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "") || (() => { const n = new Date(); return [0, n.getFullYear(), n.getMonth() + 1, n.getDate()]; })();
  const t = /^(\d{1,2}):(\d{2})/.exec(time || ""); if (!t) return "";
  const guess = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  let off;
  try { off = Utilities.formatDate(new Date(guess), "America/New_York", "Z"); } catch (e) { return ""; }
  const m = /^([+-])(\d{2})(\d{2})$/.exec(off || ""); if (!m) return "";
  const mins = (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3]);
  return "<t:" + Math.floor((guess - mins * 60000) / 1000) + ":t>";
}

// =====================================================================
// CID CASE BUILDER (cid.html): officer profile, forum tags, media links, case-file image,
// "Save to Discord" edits, and Command review (password or admin sign-in)
// =====================================================================
const CID_SHEET_ = "CID Submissions";
const CID_HEAD_ = ["ID", "Created", "Updated", "Case #", "Title", "Classification", "Case Status", "Priority", "Detective", "Rank", "Badge", "Callsign", "Discord ID", "Thread ID", "Message ID", "Webhook ID", "Content", "Report", "Case Data", "Review", "Grade", "Graded By", "Comments", "Graded At", "Form"];
const CID_MEDIA_HOSTS_ = ["imgur.com", "i.imgur.com", "m.imgur.com", "cdn.discordapp.com", "media.discordapp.net", "medal.tv", "www.medal.tv"];
function cidSheet_() {
  const ss = ss_(); let sh = ss.getSheetByName(CID_SHEET_);
  if (!sh) { sh = ss.insertSheet(CID_SHEET_); sh.appendRow(CID_HEAD_); sh.setFrozenRows(1); }
  return sh;
}
function cidMediaOk_(u) { const m = /^https:\/\/([^\/?#]+)(\/[^\s]*)?$/i.exec(str_(u)); return !!(m && CID_MEDIA_HOSTS_.indexOf(m[1].toLowerCase()) !== -1 && (m[2] || "").length > 1); }
function cidPrep_(form, c) {
  const p = c.profile || {}, did = /^\d{17,20}$/.test(str_(p.discordId)) ? str_(p.discordId) : "";
  if (!did) return { error: "Add your Discord ID to your officer profile (top of the page) before posting." };
  const allowed = (form.forumTagOptions || []).map(t => str_(t.id));
  const tags = (Array.isArray(c.forumTags) ? c.forumTags : []).map(str_).filter(t => allowed.indexOf(t) !== -1);
  const media = (Array.isArray(c.media) ? c.media : []).filter(m => m && cidMediaOk_(m.url)).slice(0, 10).map(m => ({ tag: clip_(str_(m.tag) || "Evidence", 40), url: str_(m.url) }));
  const who = [p.rank, p.name].map(str_).filter(Boolean).join(" ") + (str_(p.badge) ? " #" + str_(p.badge) : "") + (str_(p.callsign) ? " (" + str_(p.callsign) + ")" : "");
  const content = clip_("<@" + did + "> filed this case file" + (who ? " — " + who : "") + (media.length ? "\n📎 **Evidence media**\n" + media.map(m => "• " + m.tag + ": " + m.url).join("\n") : ""), 1900);
  let file = null;
  const b64 = str_(c.image).replace(/^data:image\/png;base64,/, "");
  if (b64 && b64.length < 11e6) { try { file = Utilities.newBlob(Utilities.base64Decode(b64), "image/png", "case-file.png"); } catch (e) {} }
  let rec = null;
  if (str_(c.update)) {
    rec = cidFind_(str_(c.update));
    if (!rec) return { error: "That case isn't in Command's records any more. Post it again instead." };
    if (rec.discordId !== did) return { error: "Only the detective who posted this case can update it." };
  }
  return { tags: tags, media: media, content: content, mentions: [did], file: file, profile: { name: clip_(str_(p.name), 60), rank: clip_(str_(p.rank), 40), badge: clip_(str_(p.badge), 20), callsign: clip_(str_(p.callsign), 30), discordId: did },
    report: clip_(str_(c.report), 45000), data: clip_(JSON.stringify(c.caseData || {}), 45000), rec: rec };
}
function cidRowObj_(r, i) {
  const g = k => r[CID_HEAD_.indexOf(k)];
  const iso = v => isDate_(v) ? v.toISOString() : str_(v);
  return { row: i + 1, id: str_(g("ID")), created: iso(g("Created")), updated: iso(g("Updated")), caseNo: str_(g("Case #")), title: str_(g("Title")), classification: str_(g("Classification")), status: str_(g("Case Status")), priority: str_(g("Priority")),
    detective: str_(g("Detective")), rank: str_(g("Rank")), badge: str_(g("Badge")).replace(/^'/, ""), callsign: str_(g("Callsign")), discordId: str_(g("Discord ID")).replace(/^'/, ""),
    threadId: str_(g("Thread ID")).replace(/^'/, ""), messageId: str_(g("Message ID")).replace(/^'/, ""), webhookId: str_(g("Webhook ID")), content: str_(g("Content")), report: str_(g("Report")),
    review: str_(g("Review")) || "pending", grade: str_(g("Grade")), gradedBy: str_(g("Graded By")), comments: str_(g("Comments")), gradedAt: iso(g("Graded At")) };
}
function cidAll_() { const v = cidSheet_().getDataRange().getValues(); const out = []; for (let i = 1; i < v.length; i++) if (str_(v[i][0])) out.push(cidRowObj_(v[i], i)); return out; }
function cidFind_(id) { return cidAll_().find(r => r.id === id) || null; }
function cidRecord_(form, webhook, x, first, threadId, messageId, values) {
  const id = Utilities.getUuid().replace(/-/g, "").slice(0, 16), now = new Date(), p = x.profile;
  const v = k => { const f = allFields_(form).find(ff => new RegExp(k, "i").test(ff.id + " " + (ff.label || ""))); return f ? str_(values[f.id]) : ""; };
  const row = [id, now, now, cellSafe_(v("case ?number|caseno")), cellSafe_(v("title")), cellSafe_(v("classification")), cellSafe_(v("case status|ccstatus")), cellSafe_(v("priority")),
    cellSafe_(p.name), p.rank, "'" + p.badge, cellSafe_(p.callsign), "'" + p.discordId, "'" + (threadId || ""), "'" + (messageId || ""), webhook.id, cellSafe_(first.content || ""), cellSafe_(x.report), cellSafe_(x.data), "pending", "", "", "", "", form.id];
  withLock_(() => { cidSheet_().appendRow(row); return { ok: true }; });
  return id;
}
function cidUpdate_(form, webhook, x, first, d) {
  const rec = x.rec, wh = webhookById_(rec.webhookId) || webhook;
  if (!rec.messageId) return { ok: false, error: "The original Discord post wasn't recorded, so it can't be edited. Post it again instead." };
  let url = wh.url.split("?")[0] + "/messages/" + rec.messageId + (rec.threadId ? "?thread_id=" + rec.threadId : "");
  const body = { content: first.content + (rec.review && rec.review !== "pending" ? "\n" + cidReviewLine_(rec) : ""), embeds: first.embeds, allowed_mentions: first.allowed_mentions, attachments: [] };
  const opts = { method: "patch", muteHttpExceptions: true };
  if (x.file) opts.payload = { payload_json: JSON.stringify(body), "files[0]": x.file }; else { opts.contentType = "application/json"; opts.payload = JSON.stringify(body); }
  const res = UrlFetchApp.fetch(url, opts), code = res.getResponseCode();
  if (code !== 200) return { ok: false, error: "Discord wouldn't update the post (" + code + "). " + clip_(res.getContentText(), 200) };
  withLock_(() => {
    const sh = cidSheet_(), c = n => CID_HEAD_.indexOf(n) + 1;
    sh.getRange(rec.row, c("Updated")).setValue(new Date());
    sh.getRange(rec.row, c("Content")).setValue(cellSafe_(first.content));
    sh.getRange(rec.row, c("Report")).setValue(cellSafe_(x.report));
    sh.getRange(rec.row, c("Case Data")).setValue(cellSafe_(x.data));
    try { const a = actRows_().find(r => r.messageId && r.messageId === rec.messageId); if (a) actSheet_().getRange(a.row, 17).setValue(cellSafe_(clip_(x.report, 45000))); divClearCache_(); } catch (e) {}
    return { ok: true };
  });
  return { ok: true, id: rec.id, updated: true };
}
function cidReviewLine_(r) {
  const word = { accepted: "✅ Accepted", denied: "❌ Denied", pending: "⏳ Pending review" }[r.review] || r.review;
  return "🛡️ **Command review:** " + word + (r.grade ? " · Grade **" + r.grade + "**" : "") + (r.gradedBy ? " · by " + r.gradedBy : "");
}
// Command access: the CID Command password (set by an owner in admin), or a signed-in portal admin
function cidCommandOk_(d) {
  if (str_(d.token) && sessionAdmin_(d.token)) return true;
  const cache = CacheService.getScriptCache(), fails = Number(cache.get("cid_fails") || 0);
  if (fails >= 20) throw new Error("Too many wrong passwords. Try again in 15 minutes.");
  const salt = PROPS_.getProperty("CID_CMD_SALT"), hash = PROPS_.getProperty("CID_CMD_HASH");
  if (!salt || !hash) throw new Error("Command access isn't set up yet. An owner sets the CID Command password in the admin panel (Portal Settings).");
  if (hashPw_(String(d.password || ""), salt) === hash) return true;
  cache.put("cid_fails", String(fails + 1), 900);
  return false;
}
function cidHandle_(d) {
  const a = d.action;
  if (a === "cidMine") {                              // a detective's own cases: review status by the ids their browser kept
    const ids = (Array.isArray(d.ids) ? d.ids : []).map(str_).filter(Boolean).slice(0, 200);
    const list = cidAll_().filter(r => ids.indexOf(r.id) !== -1).map(r => ({ id: r.id, review: r.review, grade: r.grade, gradedBy: r.gradedBy, comments: r.comments, gradedAt: r.gradedAt }));
    return { ok: true, reviews: list };
  }
  if (!cidCommandOk_(d)) return { ok: false, error: "Wrong password." };
  if (a === "cidList") {
    const q = str_(d.q).toLowerCase(), f = str_(d.filter);
    let list = cidAll_().reverse();
    const counts = { submitted: list.length, pending: list.filter(r => r.review === "pending").length, accepted: list.filter(r => r.review === "accepted").length, denied: list.filter(r => r.review === "denied").length };
    if (f && f !== "all") list = list.filter(r => r.review === f);
    if (q) list = list.filter(r => [r.caseNo, r.title, r.detective, r.callsign, r.badge, r.report].join(" ").toLowerCase().indexOf(q) !== -1);
    return { ok: true, counts: counts, cases: list.slice(0, 300).map(r => { const o = Object.assign({}, r); delete o.row; delete o.webhookId; delete o.content; return o; }) };
  }
  if (a === "cidReview") {
    const rec = cidFind_(str_(d.id)); if (!rec) return { ok: false, error: "Case not found." };
    const review = ["accepted", "denied", "pending"].indexOf(str_(d.review)) === -1 ? "pending" : str_(d.review);
    const grade = ["A", "B", "C", "D", "F"].indexOf(str_(d.grade)) === -1 ? "" : str_(d.grade);
    const by = clip_(str_(d.gradedBy), 60), comments = clip_(str_(d.comments), 1500);
    if (review !== "pending" && !by) return { ok: false, error: "Add who graded it." };
    Object.assign(rec, { review: review, grade: grade, gradedBy: by, comments: comments });
    withLock_(() => {
      const sh = cidSheet_(), c = n => CID_HEAD_.indexOf(n) + 1;
      sh.getRange(rec.row, c("Review"), 1, 5).setValues([[review, grade, cellSafe_(by), cellSafe_(comments), new Date()]]);
      return { ok: true };
    });
    let warning = "";
    const wh = webhookById_(rec.webhookId);
    if (wh && rec.messageId) {
      // the case's own post shows the decision, and the detective is tagged in the thread
      try {
        const base = wh.url.split("?")[0], tq = rec.threadId ? "?thread_id=" + rec.threadId : "";
        UrlFetchApp.fetch(base + "/messages/" + rec.messageId + tq, { method: "patch", contentType: "application/json", muteHttpExceptions: true,
          payload: JSON.stringify({ content: clip_(rec.content + "\n" + cidReviewLine_(rec), 1990), allowed_mentions: { parse: [] } }) });
        const r = discordPost_(wh.url, { content: clip_("<@" + rec.discordId + "> " + cidReviewLine_(rec) + (comments ? "\n> " + comments.split("\n").join("\n> ") : ""), 1990), allowed_mentions: { parse: [], users: rec.discordId ? [rec.discordId] : [] } }, rec.threadId || null);
        if (!r.ok) warning = "saved, but Discord said: " + r.error;
      } catch (e) { warning = "saved, but Discord couldn't be updated: " + errMsg_(e); }
    } else warning = "saved; the Discord post wasn't recorded so it wasn't updated";
    return warning ? { ok: true, warning: warning } : { ok: true };
  }
  return { ok: false, error: "Unknown action." };
}

// =====================================================================
// DIVISION COMMAND (division.html): every report, who filed it, who was tagged, grades
// =====================================================================
const ACT_SHEET_ = "Division Activity";
const ACT_HEAD_ = ["ID", "Filed", "Form", "Report #", "Title", "People", "Summary", "Thread ID", "Message ID", "Webhook ID", "Content", "Grade", "Graded By", "Comments", "Graded At", "Source", "Report", "Data"];
const LEADER_ACTIONS_ = { logout: 1, getAll: 1, divView: 1, divGrade: 1, divReport: 1, changePassword: 1 };
const GRADES_ = ["A", "B", "C", "D", "F"];
function actSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(ACT_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(ACT_SHEET_);
    sh.appendRow(ACT_HEAD_); sh.setFrozenRows(1); sh.getRange(1, 1, 1, ACT_HEAD_.length).setFontWeight("bold");
    sh.getRange("H:J").setNumberFormat("@");
  } else if (sh.getLastColumn() < ACT_HEAD_.length) sh.getRange(1, 1, 1, ACT_HEAD_.length).setValues([ACT_HEAD_]).setFontWeight("bold");   // sheets made before the Report column
  return sh;
}
function divClearCache_() { try { CacheService.getScriptCache().removeAll(((getConfig_().settings || {}).divisions || []).map(x => "div_view_" + x.id + "_n")); } catch (e) {} }
// The script cache holds 100 KB per entry: bigger values are split over several entries ("key_n" says how many)
function bigPut_(key, text, secs) {
  const cache = CacheService.getScriptCache(), size = 90000, n = Math.ceil(text.length / size);
  if (n > 20) return;
  const parts = {}; for (let i = 0; i < n; i++) parts[key + "_" + i] = text.substr(i * size, size);
  cache.putAll(parts, secs); cache.put(key + "_n", String(n), secs);
}
function bigGet_(key) {
  const cache = CacheService.getScriptCache(), n = Number(cache.get(key + "_n") || 0); if (!n) return null;
  const keys = []; for (let i = 0; i < n; i++) keys.push(key + "_" + i);
  const got = cache.getAll(keys); if (keys.some(k => got[k] == null)) return null;
  return keys.map(k => got[k]).join("");
}
// Boxes that hold people: officer / officers / Discord ID fields, roster-picker text boxes, and the same inside lists.
function personSlots_(form) {
  const out = [], isP = f => ["officer", "officers", "discord_id"].indexOf(f.type) !== -1 || (f.type === "text" && (f.roster || f.rosterTabId != null && f.rosterTabId !== ""));
  (form.blocks || []).forEach(b => {
    if (b.type === "fields" || b.type === "strip") (b.fields || []).forEach(f => { if (isP(f)) out.push({ key: f.id, label: str_(f.label).replace(/[:(].*$/, "").trim() || f.id, single: f.type !== "officers" }); });
    if (b.type === "repeater") (b.columns || []).forEach(c => { if (isP(c)) out.push({ key: b.id + "." + c.id, label: titleWord_(str_(b.title)) + " · " + (str_(c.label) || c.id), single: false }); });
  });
  return out;
}
// Who "filed" the report when the division leader hasn't picked: the lead / reporting / instructor box
function autoAuthor_(form) {
  const slots = personSlots_(form);
  const good = /report|filing|filed|lead|primary|submit|author|your|instructor|investigator|detective|fto|trainer|evaluat|pilot|handler|officer/i, bad = /assist|witness|trainee|student|cadet|suspect|victim|backup|supervis|tagged|other|partner|passenger|recruit/i;
  const pick = slots.find(x => x.single && good.test(x.label) && !bad.test(x.label)) || slots.find(x => x.single && !bad.test(x.label)) || slots.find(x => x.single) || slots[0];
  return pick ? pick.key : "";
}
function actPeople_(form, values, repeaters) {
  const out = [], seen = {};
  personSlots_(form).forEach(sl => {
    const vals = sl.key.indexOf(".") === -1 ? [values[sl.key]] : ((repeaters || {})[sl.key.split(".")[0]] || []).map(r => r[sl.key.split(".")[1]]);
    vals.forEach(v => peopleIn_(v).forEach(p => {
      const k = sl.key + "|" + (p.id || nameKey_(p.name) || p.name); if (seen[k]) return; seen[k] = 1;
      out.push({ f: sl.key, n: clip_(p.name, 60), i: p.id });
    }));
  });
  return out;
}
function actSummary_(cols, people) {
  const skip = {}; people.forEach(p => skip[p.f] = 1);
  let txt = "";
  cols.forEach(c => { if (skip[c.id] || !str_(c.value)) return; const line = c.label.replace(/[:(].*$/, "").trim() + ": " + clip_(str_(c.value).replace(/\s+/g, " "), 400); if (txt.length + line.length < 3500) txt += (txt ? "\n" : "") + line; });
  return txt;
}
// The whole report as readable text (for reading it while grading): every box, lists one row per line, long text kept as written
function actFull_(cols) {
  return cols.filter(c => str_(c.value)).map(c => { const lab = str_(c.label).replace(/[:(].*$/, "").trim() || c.id, v = str_(c.value).replace(/\s*\(\d{15,21}\)/g, "");
    return v.length > 80 || v.indexOf("\n") !== -1 || v.indexOf("; ") !== -1 ? lab.toUpperCase() + "\n" + v.split(/;\s(?=\S)/).join("\n") + "\n" : lab + ": " + v; }).join("\n");
}
function actLog_(form, values, repeaters, cols, x) {
  const people = actPeople_(form, values, repeaters);
  const caseF = allFields_(form).find(f => f.type === "case_number");
  const id = Utilities.getUuid().replace(/-/g, "").slice(0, 14);
  actSheet_().appendRow([id, new Date(), form.id, cellSafe_(caseF ? str_(values[caseF.id]) : ""), cellSafe_(clip_(x.title, 200)), JSON.stringify(people), cellSafe_(actSummary_(cols, people)),
    "'" + (x.threadId || ""), "'" + (x.messageId || ""), x.webhookId || "", cellSafe_(clip_(x.content || "", 1900)), "", "", "", "", x.source || "report", cellSafe_(clip_(x.report || actFull_(cols), 45000)), (() => { const j = x.data ? JSON.stringify(x.data) : ""; return j.length < 48000 ? cellSafe_(j) : ""; })()]);
  divClearCache_();
  return id;
}
function cleanDivisions_(list, forms) {
  const ids = {};
  return (Array.isArray(list) ? list : []).slice(0, 20).map((d, i) => {
    let id = str_(d.id).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24) || "div" + (i + 1);
    while (ids[id]) id += "x"; ids[id] = 1;
    const name = clip_(str_(d.name), 40); if (!name) throw new Error("Division Command: every division needs a name.");
    const logo = str_(d.logoUrl); if (logo && !/^(img\/[\w.\-\/]+|https:\/\/\S+)$/.test(logo)) throw new Error("Division " + name + ": the logo must be a file like img/logo.png or an https:// link.");
    const fl = (Array.isArray(d.forms) ? d.forms : []).filter(f => f && forms.some(x => x.id === f.id)).map(f => ({ id: str_(f.id), author: clip_(str_(f.author), 80) }));
    const n = v => Math.max(0, Math.min(365, parseInt(v, 10) || 0));
    return { id: id, name: name, tagline: clip_(str_(d.tagline), 80), color: /^#[0-9a-f]{6}$/i.test(str_(d.color)) ? str_(d.color) : "#2f7bff", logoUrl: logo,
      rosterTabId: d.rosterTabId === "" || d.rosterTabId == null ? null : Number(d.rosterTabId), rosterTabName: clip_(str_(d.rosterTabName), 100),
      forms: fl, quota: Math.max(0, Math.min(50, parseInt(d.quota, 10) || 0)), quotaPer: d.quotaPer === "month" ? "month" : "week", quotaAssists: d.quotaAssists !== false,
      warnDays: n(d.warnDays), inactiveDays: n(d.inactiveDays), pingTagged: !!d.pingTagged,
      exempt: clip_(str_(d.exempt), 300),
      unitCol: colIndex_(d.unitCol) >= 0 ? str_(d.unitCol).toUpperCase() : "", positionCol: colIndex_(d.positionCol) >= 0 ? str_(d.positionCol).toUpperCase() : "",
      groupBy: ["position", "headings", "none"].indexOf(d.groupBy) !== -1 ? d.groupBy : "auto" };
  });
}
// "Command, High Command, L-101" -> does any of these words appear in the officer's roster section, rank, callsign or name?
function exemptHit_(rule, fields) {
  const words = str_(rule).split(",").map(w => w.trim().toLowerCase()).filter(Boolean); if (!words.length) return "";
  const hay = fields.map(x => str_(x).toLowerCase());
  const hit = words.find(w => hay.some(h => h && (callKey_(w) && callKey_(h) ? callKey_(w) === callKey_(h) : new RegExp("(^|[^a-z])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z]|$)").test(h))));
  return hit ? fields.find(x => str_(x).toLowerCase().indexOf(hit) !== -1) || hit : "";
}
function divList_() { return ((getConfig_().settings || {}).divisions || []).map(x => ({ id: x.id, name: x.name, color: x.color, logoUrl: x.logoUrl, tagline: x.tagline })); }
function actRows_() {
  const v = actSheet_().getDataRange().getValues(), out = [];
  for (let i = 1; i < v.length; i++) { const r = v[i]; if (!str_(r[0])) continue;
    let people = []; try { people = JSON.parse(str_(r[5]) || "[]"); } catch (e) {}
    out.push({ row: i + 1, id: str_(r[0]), at: isDate_(r[1]) ? r[1].getTime() : new Date(r[1]).getTime() || 0, form: str_(r[2]), no: str_(r[3]), title: str_(r[4]), people: people, summary: str_(r[6]),
      threadId: str_(r[7]).replace(/^'/, ""), messageId: str_(r[8]).replace(/^'/, ""), webhookId: str_(r[9]), content: str_(r[10]),
      grade: str_(r[11]), gradedBy: str_(r[12]), comments: str_(r[13]), gradedAt: isDate_(r[14]) ? r[14].getTime() : 0, source: str_(r[15]), report: str_(r[16]), data: str_(r[17]) }); }
  return out;
}
// Everything the Division Command page shows for one division: its officers + every report from its forms.
// Stats, leaderboard, quotas and alerts are worked out in the browser from this.
function divView_(d, me) {
  const cfg = getConfig_(), divs = (cfg.settings || {}).divisions || [];
  const dv = divs.find(x => x.id === str_(d.division)) || divs[0];
  if (!dv) return { ok: true, divisions: [], me: { username: me.username, role: me.role } };
  const cache = CacheService.getScriptCache(), ck = "div_view_" + dv.id;
  if (!d.fresh) { const hit = bigGet_(ck); if (hit) { try { return Object.assign(JSON.parse(hit), { me: { username: me.username, role: me.role }, cached: true }); } catch (e) {} } }
  // officers from the division's roster tab
  let officers = [], rosterError = "";
  if (dv.rosterTabId != null) {
    try { const t = getRosterTab_(dv.rosterTabId, !!d.fresh, [dv.unitCol, dv.positionCol].filter(Boolean), false, false); rosterError = t.error || "";
      officers = (t.people || []).map(p => { const cs = p.name.indexOf("|") !== -1 ? p.name.split("|")[0].trim() : (callKey_(p.name) ? (/\b[A-Za-z]{1,4}\s*-?\s*\d{1,5}\b/.exec(p.name) || [""])[0] : "");
        const nm = p.name.indexOf("|") !== -1 ? p.name.split("|").slice(1).join("|").trim() : p.name.replace(cs, "").trim() || p.name;
        const more = p.more || {}, unit = dv.unitCol ? str_(more[dv.unitCol]) : "", rank = (dv.positionCol ? str_(more[dv.positionCol]) : "") || p.extra || "";
        return { key: p.id ? "ID:" + p.id : "CS:" + (callKey_(cs) || nameKey_(nm)), name: nm, callsign: unit || cs, alt: unit && cs ? cs : "", id: p.id || "", section: p.sec || "", rank: rank,
          exempt: exemptHit_(dv.exempt, [p.sec, rank, unit, cs, nm]) }; });
    } catch (e) { rosterError = errMsg_(e); }
  } else rosterError = "No roster tab picked for this division yet (admin → Division Command).";
  const find = p => (p.i && officers.find(o => o.id === p.i)) || (callKey_(p.n) && officers.find(o => [o.callsign, o.alt].some(c => c && callKey_(c) === callKey_(p.n)))) || (nameKey_(p.n) && officers.find(o => nameKey_(o.name) === nameKey_(p.n))) || null;
  const formsById = {}; cfg.forms.forEach(f => formsById[f.id] = f);
  const fset = {}; dv.forms.forEach(f => { const form = formsById[f.id]; if (!form) return; const slots = personSlots_(form); fset[f.id] = { author: f.author && slots.some(x => x.key === f.author) ? f.author : autoAuthor_(form), labels: slots.reduce((m, x) => (m[x.key] = x.label, m), {}) }; });
  const since = Date.now() - 400 * 864e5;
  const reports = actRows_().filter(r => fset[r.form] && r.at >= since).sort((a, b) => b.at - a.at).slice(0, 2500).map(r => {
    const fs = fset[r.form], person = p => { const o = find(p); return { key: o ? o.key : "", name: o ? o.name : (p.n.indexOf("|") !== -1 ? p.n.split("|").slice(1).join("|").trim() : p.n) || "ID " + p.i, callsign: o ? o.callsign : (callKey_(p.n) ? (/\b[A-Za-z]{1,4}\s*-?\s*\d{1,5}\b/.exec(p.n) || [""])[0] : ""), id: p.i || (o && o.id) || "", role: fs.labels[p.f] || p.f }; };
    const authorP = r.people.find(p => p.f === fs.author);
    const author = authorP ? person(authorP) : null;
    const tagged = [], tk = {};
    r.people.filter(p => p !== authorP).forEach(p => { const x = person(p); const k = x.key || x.id || nameKey_(x.name); if (!k || tk[k] || (author && (author.key ? author.key === x.key : author.name === x.name))) return; tk[k] = 1; tagged.push(x); });
    return { id: r.id, at: r.at, form: r.form, formTitle: formsById[r.form].title, icon: formsById[r.form].icon || "📄", no: r.no, title: r.title, summary: r.summary, author: author, tagged: tagged,
      grade: r.grade, gradedBy: r.gradedBy, comments: r.comments, gradedAt: r.gradedAt, canPost: !!(r.webhookId && webhookById_(r.webhookId) && (r.messageId || r.threadId)), imported: r.source !== "report" };
  });
  const out = { ok: true, division: dv, divisions: divList_(), officers: officers, rosterError: rosterError, reports: reports,
    forms: dv.forms.filter(f => formsById[f.id]).map(f => ({ id: f.id, title: formsById[f.id].title, icon: formsById[f.id].icon || "📄" })),
    weekStart: (cfg.settings.hours && cfg.settings.hours.weekStart != null) ? cfg.settings.hours.weekStart : 1, at: Date.now() };
  try { bigPut_(ck, JSON.stringify(out), 900); } catch (e) {}   // 15 min; cleared the moment a report is filed or graded
  out.me = { username: me.username, role: me.role };
  return out;
}
function divGrade_(d, me) {
  const rows = actRows_(), rec = rows.find(r => r.id === str_(d.id));
  if (!rec) return { ok: false, error: "That report isn't in the log." };
  const clear = !!d.clear, grade = clear ? "" : str_(d.grade).toUpperCase();
  if (!clear && GRADES_.indexOf(grade) === -1) return { ok: false, error: "Pick a grade A to F." };
  const by = clip_(str_(d.gradedBy) || me.username, 60), comments = clear ? "" : clip_(str_(d.comments), 1500);
  actSheet_().getRange(rec.row, 12, 1, 4).setValues([[grade, clear ? "" : cellSafe_(by), cellSafe_(comments), clear ? "" : new Date()]]);
  divClearCache_();
  logAdmin_(me.username, "division grade", (rec.no || rec.title) + " -> " + (grade || "cleared"));
  if (clear || !d.post) return { ok: true };
  // Discord: the report's own post gets a grade line, and a reply tags whoever filed it (and the tagged officers if asked)
  const wh = webhookById_(rec.webhookId);
  if (!wh || !(rec.messageId || rec.threadId)) return { ok: true, warning: "grade saved; this report's Discord post wasn't recorded, so nothing was posted" };
  const form = getConfig_().forms.find(f => f.id === rec.form) || { blocks: [] };
  const dv = ((getConfig_().settings || {}).divisions || []).find(x => x.id === str_(d.division));
  const author = rec.people.find(p => p.f === ((dv && (dv.forms.find(f => f.id === rec.form) || {}).author) || autoAuthor_(form)));
  const ids = [], add = id => { if (/^\d{15,21}$/.test(id || "") && ids.indexOf(id) === -1) ids.push(id); };
  if (author) add(author.i);
  if (d.pingTagged) rec.people.forEach(p => add(p.i));
  const medal = { A: "🟢", B: "🟢", C: "🟡", D: "🟠", F: "🔴" }[grade];
  const line = "🏅 **Division review:** " + medal + " Grade **" + grade + "** · by " + by;
  let warning = "";
  try {
    const base = wh.url.split("?")[0];
    if (rec.messageId) {
      const tq = rec.threadId ? "?thread_id=" + rec.threadId : "";
      const res = UrlFetchApp.fetch(base + "/messages/" + rec.messageId + tq, { method: "patch", contentType: "application/json", muteHttpExceptions: true,
        payload: JSON.stringify({ content: clip_((rec.content ? rec.content.replace(/\n🏅 \*\*Division review:\*\*.*$/m, "") + "\n" : "") + line, 1990), allowed_mentions: { parse: [] } }) });
      if (res.getResponseCode() !== 200) warning = "the post's grade line couldn't be added (" + res.getResponseCode() + ")";
      else actSheet_().getRange(rec.row, 11).setValue(cellSafe_(clip_((rec.content ? rec.content.replace(/\n🏅 \*\*Division review:\*\*.*$/m, "") + "\n" : "") + line, 1900)));
    }
    const msg = (ids.length ? ids.map(x => "<@" + x + ">").join(" ") + " " : "") + line + (rec.threadId ? "" : " — " + (rec.no ? rec.no + " · " : "") + clip_(rec.title, 120)) + (comments ? "\n> " + comments.split("\n").join("\n> ") : "");
    const r = discordPost_(wh.url, { content: clip_(msg, 1990), allowed_mentions: { parse: [], users: ids } }, rec.threadId || null);
    if (!r.ok) warning = "grade saved, but Discord said: " + r.error;
  } catch (e) { warning = "grade saved, but Discord couldn't be reached: " + errMsg_(e); }
  return warning ? { ok: true, warning: warning } : { ok: true };
}
// One report for reading/grading: the printed case file (CID page), and the answers + the form, so the page can lay it
// out like the report writer. Reports logged before answers were saved get theirs back from the form's sheet tab.
function divReport_(d) {
  const r = actRows_().find(x => x.id === str_(d.id)); if (!r) return { ok: false, error: "That report isn't in the log." };
  const form = getConfig_().forms.find(f => f.id === r.form);
  let data = null; try { data = r.data ? JSON.parse(r.data) : null; } catch (e) {}
  if (!data && form) { try { data = archiveLookup_(form, r); } catch (e) {} }
  return { ok: true, report: r.report || r.summary, printed: /^={20,}/.test(r.report), data: data, form: form ? { id: form.id, title: form.title, blocks: form.blocks } : null };
}
function archiveLookup_(form, r) {
  const src = r.source.indexOf("import:") === 0 ? Number(r.source.split(":")[2]) : r.at;
  const sh = ss_().getSheetByName(clip_(str_(form.archiveSheet) || form.title || form.id, 90)); if (!sh || sh.getLastRow() < 2) return null;
  const lastCol = sh.getLastColumn(), notes = sh.getRange(1, 1, 1, lastCol).getNotes()[0];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();
  const caseF = allFields_(form).find(f => f.type === "case_number"), ci = caseF ? notes.indexOf(caseF.id) : -1;
  let best = null, bestD = 6 * 60000;
  rows.forEach(row => { const t = isDate_(row[0]) ? row[0].getTime() : new Date(row[0]).getTime(); if (isNaN(t)) return; const dd = Math.abs(t - src);
    if (dd < bestD && (ci < 0 || !r.no || str_(row[ci]) === r.no)) { best = row; bestD = dd; } });
  if (!best) return null;
  const values = {}; notes.forEach((n, j) => { if (j && n) values[n] = str_(best[j]); });
  return { values: values, repeaters: {}, checklists: {}, flat: true };    // lists come back as text ("a / b; c / d")
}
// An officer's own reports, by the log IDs their browser kept when they filed them (or a CID case's ID): grades and comments
function divMine_(d) {
  const ids = (Array.isArray(d.ids) ? d.ids : []).map(str_).filter(Boolean).slice(0, 300);
  const cids = (Array.isArray(d.cidIds) ? d.cidIds : []).map(str_).filter(Boolean).slice(0, 300);
  const rows = actRows_(), forms = {}; getConfig_().forms.forEach(f => forms[f.id] = f);
  const pick = r => ({ id: r.id, at: r.at, form: r.form, formTitle: forms[r.form] ? forms[r.form].title : r.form, icon: forms[r.form] ? forms[r.form].icon || "📄" : "📄", no: r.no, title: r.title,
    grade: r.grade, gradedBy: r.gradedBy, comments: r.comments, gradedAt: r.gradedAt });
  const out = rows.filter(r => ids.indexOf(r.id) !== -1).map(pick), cid = {};
  if (cids.length) { try { cidAll_().filter(c => cids.indexOf(c.id) !== -1 && c.messageId).forEach(c => { const r = rows.find(x => x.messageId === c.messageId); if (r) cid[c.id] = pick(r); }); } catch (e) {} }
  return { ok: true, reports: out, cid: cid };
}
// Reports filed before Division Command existed: read back from each form's sheet tab (no Discord post to reply to)
function divImport_() {
  const cfg = getConfig_(), divs = (cfg.settings || {}).divisions || [], want = {};
  divs.forEach(dv => dv.forms.forEach(f => want[f.id] = 1));
  const have = {}, live = actRows_(); live.forEach(r => { if (r.source.indexOf("import:") === 0) have[r.source] = 1; });
  const already = (formId, ts, no, ppl) => live.some(r => r.form === formId && r.source === "report" && r.no === no && (Math.abs(r.at - ts) < 180000 || (no && JSON.stringify(r.people) === ppl)));   // logged live already
  const rows = [];
  cfg.forms.filter(f => want[f.id]).forEach(form => {
    const sh = ss_().getSheetByName(clip_(str_(form.archiveSheet) || form.title || form.id, 90)); if (!sh || sh.getLastRow() < 2) return;
    const lastCol = sh.getLastColumn(), notes = sh.getRange(1, 1, 1, lastCol).getNotes()[0], heads = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, lastCol).getValues();
    const caseF = allFields_(form).find(f => f.type === "case_number");
    data.forEach((r, i) => {
      const ts = isDate_(r[0]) ? r[0] : new Date(r[0]); if (isNaN(ts)) return;
      const src = "import:" + form.id + ":" + ts.getTime(); if (have[src]) return; have[src] = 1;
      const values = {}, cols = []; notes.forEach((n, j) => { if (j && n) { values[n] = str_(r[j]); cols.push({ id: n, label: str_(heads[j]), value: str_(r[j]) }); } });
      const people = actPeople_(form, values, {});
      if (!people.length || already(form.id, ts.getTime(), caseF ? str_(values[caseF.id]) : "", JSON.stringify(people))) return;
      rows.push([Utilities.getUuid().replace(/-/g, "").slice(0, 14), ts, form.id, cellSafe_(caseF ? values[caseF.id] || "" : ""), cellSafe_(clip_(fillTemplate_(form.embedTitle || form.title, values) || form.title, 200)), JSON.stringify(people), cellSafe_(actSummary_(cols, people)), "", "", "", "", "", "", "", "", src, cellSafe_(clip_(actFull_(cols), 45000))]);
    });
  });
  if (rows.length) withLock_(() => { const sh = actSheet_(); sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows); return { ok: true }; });
  divClearCache_();
  return { added: rows.length };
}

// =====================================================================
// OFFICER ACCOUNTS: sign in with Discord once per device, then a 4-digit PIN
// =====================================================================
const ACCT_SHEET_ = "Officer Accounts";
const ACCT_HEAD_ = ["Discord ID", "Username", "Callsign", "Name", "Level Override", "PIN Salt", "PIN Hash", "Created", "Last Sign-in", "Locked", "Signed Out", "Devices", "Say Name As"];
const LEVELS_ = ["trainee", "officer", "fto", "leader", "command", "admin", "owner"];
const OFFICER_DAYS_ = 30;              // a PIN sign-in lasts 30 days on that device
function acctSheet_() {
  const ss = ss_(); let sh = ss.getSheetByName(ACCT_SHEET_);
  if (!sh) { sh = ss.insertSheet(ACCT_SHEET_); sh.appendRow(ACCT_HEAD_); sh.setFrozenRows(1); sh.getRange(1, 1, 1, ACCT_HEAD_.length).setFontWeight("bold"); sh.getRange("A:A").setNumberFormat("@"); }
  return sh;
}
function acctAll_() {
  const v = acctSheet_().getDataRange().getValues(), out = [];
  for (let i = 1; i < v.length; i++) { const r = v[i], id = str_(r[0]).replace(/^'/, ""); if (!id) continue;
    out.push({ row: i + 1, id: id, username: str_(r[1]), callsign: str_(r[2]), name: str_(r[3]), override: str_(r[4]), salt: str_(r[5]), hash: str_(r[6]),
      created: isDate_(r[7]) ? r[7].toISOString() : str_(r[7]), last: isDate_(r[8]) ? r[8].toISOString() : str_(r[8]), locked: r[9] === true || str_(r[9]).toUpperCase() === "TRUE", signedOut: Number(r[10]) || 0, devices: Number(r[11]) || 0, sayAs: str_(r[12]) }); }
  return out;
}
function acctFind_(id) { return acctAll_().find(a => a.id === str_(id)) || null; }
function discordStatus_() {
  return { clientId: PROPS_.getProperty("DISCORD_CLIENT_ID") || "", hasSecret: !!PROPS_.getProperty("DISCORD_CLIENT_SECRET"), redirect: PROPS_.getProperty("DISCORD_REDIRECT") || "", guildId: PROPS_.getProperty("DISCORD_GUILD") || "" };
}
// signed tokens: "kind|discordId|expires|issued" + HMAC (same secret as admin sessions, but a different kind, so they never mix)
function offToken_(kind, id, ms) { const now = Date.now(); const p = Utilities.base64EncodeWebSafe(kind + "|" + id + "|" + (now + ms) + "|" + now, Utilities.Charset.UTF_8).replace(/=+$/, ""); return p + "." + sessSign_(p); }
function offRead_(token, kind) {
  const t = str_(token); if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)) return null;
  const [p, sig] = t.split("."); if (sessSign_(p) !== sig) return null;
  let raw; try { raw = Utilities.newBlob(Utilities.base64DecodeWebSafe(p + "===".slice((p.length + 3) % 4))).getDataAsString(); } catch (e) { return null; }
  const b = raw.split("|"); if (b[0] !== kind || !(Number(b[2]) > Date.now())) return null;
  return { id: b[1], issued: Number(b[3]) };
}
// who is this Discord ID on the rosters? main roster first, then the progression (onboarding) and division tabs
// Certified officers are on "LSPD Personnel Roster"; onboarding officers (trainees) on "LSPD Onboarding Roster".
const PERSONNEL_TAB_ = "LSPD Personnel Roster", ONBOARD_TAB_ = "LSPD Onboarding Roster";
function rosterTabByName_(name) {
  try { const want = name.toLowerCase(), sh = rosterBook_().getSheets().find(x => x.getName().trim().toLowerCase() === want); return sh ? sh.getSheetId() : null; } catch (e) { return null; }
}
// roster tags stuck to the end of a name ("F. DuzenRM", "F. Duzen RM") aren't part of the name
function cleanName_(n) { return str_(n).replace(/([a-z'])RM\b/g, "$1").replace(/\s+RM\b/g, "").trim(); }
function rosterPerson_(id) {
  const split = n => { const cs = n.indexOf("|") !== -1 ? n.split("|")[0].trim() : ""; return { callsign: cs, name: cleanName_(cs ? n.split("|").slice(1).join("|").trim() : n) }; };
  let hit = null, trainee = false;
  const fromTab = (name, isTrainee) => { if (hit) return; const tid = rosterTabByName_(name); if (tid == null) return;
    try { const p = (getRosterTab_(tid, false, [], false, true).people || []).find(x => x.id === id); if (p) { hit = Object.assign(split(p.name), { rank: p.extra || "" }); trainee = isTrainee; } } catch (e) {} };
  fromTab(PERSONNEL_TAB_, false);
  fromTab(ONBOARD_TAB_, true);
  if (hit) return Object.assign(hit, { trainee: trainee });
  try { const p = (getRoster_(false).people || []).find(x => x.id === id); if (p) hit = Object.assign(split(p.name), { rank: p.extra || "" }); } catch (e) {}
  try { programs_().forEach(pc => { if (!pc.on) return; const c = promoCandidates_(false, pc.id).list.find(x => x.id === id); if (c) { if (!hit) hit = { callsign: c.callsign, name: cleanName_(c.name), rank: "" }; if (/onboard|recruit|cadet|trainee|probation/i.test(pc.id + " " + pc.title + " " + (pc.rosterTabName || ""))) trainee = true; } }); } catch (e) {}
  return hit ? Object.assign(hit, { trainee: trainee }) : null;
}
function acctLevel_(acct, person) {
  if (acct && LEVELS_.indexOf(acct.override) !== -1) return acct.override;
  return person && person.trainee ? "trainee" : "officer";
}
function acctProfile_(acct) {
  const person = rosterPerson_(acct.id) || {};
  const level = acctLevel_(acct, person);
  return { discordId: acct.id, username: acct.username, callsign: person.callsign || acct.callsign, name: person.name || acct.name, rank: person.rank || "", level: level, rank_i: LEVELS_.indexOf(level) };
}
function officerSession_(token) {
  const t = offRead_(token, "OFF"); if (!t) return null;
  const a = acctFind_(t.id); if (!a || a.locked || !a.hash || (a.signedOut && t.issued < a.signedOut)) return null;
  return a;
}
function acctHandle_(d) {
  const a = d.action, st = discordStatus_();
  if (a === "acctDiscordUrl") {
    if (!st.clientId || !st.hasSecret || !st.redirect) return { ok: false, error: "Sign in with Discord isn't set up yet. An owner adds the Discord app in Admin → Accounts." };
    const state = offToken_("STATE", "x", 10 * 60000);
    const q = { client_id: st.clientId, redirect_uri: st.redirect, response_type: "code", scope: st.guildId ? "identify guilds" : "identify", state: state, prompt: "none" };
    return { ok: true, url: "https://discord.com/oauth2/authorize?" + Object.keys(q).map(k => k + "=" + encodeURIComponent(q[k])).join("&") };
  }
  if (a === "acctDiscord") {
    if (!offRead_(d.state, "STATE")) return { ok: false, error: "That sign-in link expired. Try again." };
    const tok = UrlFetchApp.fetch("https://discord.com/api/oauth2/token", { method: "post", muteHttpExceptions: true,
      payload: { client_id: st.clientId, client_secret: PROPS_.getProperty("DISCORD_CLIENT_SECRET"), grant_type: "authorization_code", code: str_(d.code), redirect_uri: st.redirect } });
    if (tok.getResponseCode() !== 200) return { ok: false, error: "Discord didn't accept the sign-in. Try again." };
    const access = JSON.parse(tok.getContentText()).access_token, H = { headers: { Authorization: "Bearer " + access }, muteHttpExceptions: true };
    const meR = UrlFetchApp.fetch("https://discord.com/api/users/@me", H); if (meR.getResponseCode() !== 200) return { ok: false, error: "Couldn't read your Discord account." };
    const du = JSON.parse(meR.getContentText()), id = str_(du.id);
    if (st.guildId) { const gR = UrlFetchApp.fetch("https://discord.com/api/users/@me/guilds", H); const gs = gR.getResponseCode() === 200 ? JSON.parse(gR.getContentText()) : [];
      if (!gs.some(g => str_(g.id) === st.guildId)) return { ok: false, error: "This Discord account isn't in the LSPD Discord server." }; }
    const person = rosterPerson_(id);
    let acct = acctFind_(id);
    if (!person && !acct) return { ok: false, error: "Your Discord account (" + (du.username || id) + ") isn't on the LSPD roster. Ask a supervisor to add your Discord ID to the roster." };
    if (acct && acct.locked) return { ok: false, error: "This account is locked. Contact command staff." };
    withLock_(() => {
      const sh = acctSheet_(); acct = acctFind_(id);
      if (!acct) sh.appendRow(["'" + id, cellSafe_(du.username || ""), cellSafe_(person ? person.callsign : ""), cellSafe_(person ? person.name : ""), "", "", "", new Date(), "", false, 0, 1]);
      else sh.getRange(acct.row, 2).setValue(cellSafe_(du.username || acct.username)), sh.getRange(acct.row, 12).setValue((acct.devices || 0) + 1);
      return { ok: true };
    });
    acct = acctFind_(id);
    return { ok: true, device: offToken_("DEV", id, 400 * 864e5), hasPin: !!acct.hash, profile: acctProfile_(acct) };
  }
  // device token → set the first PIN (or a new one after an admin reset)
  if (a === "acctSetPin") {
    const dv = offRead_(d.device, "DEV"); if (!dv) return { ok: false, error: "Sign in with Discord again on this device." };
    const pin = str_(d.pin); if (!/^\d{4}$/.test(pin)) return { ok: false, error: "Your PIN must be 4 digits." };
    if (/^(\d)\1{3}$/.test(pin) || /^(\d\d)\1$/.test(pin) || "0123456789012".indexOf(pin) !== -1 || "9876543210987".indexOf(pin) !== -1) return { ok: false, error: "Pick a less obvious PIN (not 1111, 1212 or 1234)." };
    let acct = acctFind_(dv.id); if (!acct) return { ok: false, error: "Sign in with Discord again on this device." };
    if (acct.hash) return { ok: false, error: "You already have a PIN. Enter it to sign in (an admin can reset it)." };
    const salt = Utilities.getUuid();
    withLock_(() => { acctSheet_().getRange(acct.row, 6, 1, 4).setValues([[salt, hashPw_(pin, salt), acct.created || new Date(), new Date()]]); return { ok: true }; });
    acct = acctFind_(dv.id);
    return { ok: true, session: offToken_("OFF", acct.id, OFFICER_DAYS_ * 864e5), profile: acctProfile_(acct) };
  }
  if (a === "acctPin") {
    const dv = offRead_(d.device, "DEV"); if (!dv) return { ok: false, error: "Sign in with Discord again on this device." };
    const cache = CacheService.getScriptCache(), fk = "pinfail_" + dv.id, fails = Number(cache.get(fk) || 0);
    if (fails >= 5) return { ok: false, error: "Too many wrong PINs. Try again in 15 minutes, or ask an admin to reset it." };
    const acct = acctFind_(dv.id);
    if (!acct) return { ok: false, error: "Sign in with Discord again on this device." };
    if (acct.locked) return { ok: false, error: "This account is locked. Contact command staff." };
    if (!acct.hash) return { ok: false, needPin: true, error: "Create your PIN first." };
    if (acct.signedOut && dv.issued < acct.signedOut) return { ok: false, error: "This device was signed out. Sign in with Discord again." };
    if (hashPw_(str_(d.pin), acct.salt) !== acct.hash) { cache.put(fk, String(fails + 1), 900); return { ok: false, error: "Wrong PIN" + (fails >= 3 ? " — " + (4 - fails) + " tr" + (4 - fails === 1 ? "y" : "ies") + " left." : ".") }; }
    cache.remove(fk);
    try { acctSheet_().getRange(acct.row, 9).setValue(new Date()); } catch (e) {}
    return { ok: true, session: offToken_("OFF", acct.id, OFFICER_DAYS_ * 864e5), profile: acctProfile_(acct) };
  }
  if (a === "acctMe") { const acct = officerSession_(d.session); return acct ? { ok: true, profile: acctProfile_(acct) } : { ok: false, error: "AUTH" }; }
  if (a === "acctOut") return { ok: true };       // the browser forgets its tokens
  return { ok: false, error: "Unknown action." };
}
function acctList_() {
  return acctAll_().map(a => { const p = rosterPerson_(a.id); return { discordId: a.id, username: a.username, callsign: (p && p.callsign) || a.callsign, name: (p && p.name) || a.name, rank: p ? p.rank : "", onRoster: !!p,
    level: acctLevel_(a, p), override: a.override, sayAs: a.sayAs, voiceAs: voiceNameText_(a, p), hasPin: !!a.hash, locked: a.locked, created: a.created, last: a.last, devices: a.devices }; });
}
function acctAdmin_(a, d, me) {
  const acct = acctFind_(d.discordId); if (!acct) throw new Error("Account not found.");
  const sh = acctSheet_();
  return withLock_(() => {
    if (a === "acctReset") sh.getRange(acct.row, 6, 1, 2).setValues([["", ""]]), sh.getRange(acct.row, 11).setValue(Date.now());          // new PIN + every device signs in again
    if (a === "acctSignOut") sh.getRange(acct.row, 11).setValue(Date.now());
    if (a === "acctLock") { sh.getRange(acct.row, 10).setValue(!!d.locked); if (d.locked) sh.getRange(acct.row, 11).setValue(Date.now()); }
    if (a === "acctLevel") {
      const lv = str_(d.level);
      if (lv && LEVELS_.indexOf(lv) === -1) throw new Error("Unknown level.");
      if ((lv === "owner" || lv === "admin") && me.role !== "owner") throw new Error("Only an owner can give Admin or Owner level.");
      sh.getRange(acct.row, 5).setValue(lv);
    }
    return { ok: true, accounts: acctList_() };
  });
}

// =====================================================================
// SIGN-IN VOICE: ElevenLabs clips, stitched in the browser
//   "Good morning," + "Sergeant Duzen." + "You're signed on."
// The greeting and closing are recorded once for everyone; each officer's rank + last name is
// recorded once and reused, and only recorded again when the rank (or the spoken name) changes.
// Clips live in the "Voice Clips" tab (small MP3s as text), with a cache in front.
// =====================================================================
const VOICE_SHEET_ = "Voice Clips", VOICE_MODELS_ = ["eleven_multilingual_v2", "eleven_flash_v2_5"];
const VOICE_GREET_ = { morning: "Good morning.", afternoon: "Good afternoon.", evening: "Good evening." };   // full sentences: the model finishes every word
const VOICE_CLOSE_ = "You're signed on.";
const VOICE_ERR_ = { v: "" };
function voiceCfg_() {
  return { key: PROPS_.getProperty("ELEVEN_KEY") || "", voice: PROPS_.getProperty("ELEVEN_VOICE") || "", voiceName: PROPS_.getProperty("ELEVEN_VOICE_NAME") || "",
    model: PROPS_.getProperty("ELEVEN_MODEL") || VOICE_MODELS_[0], on: PROPS_.getProperty("ELEVEN_ON") === "1" };
}
function voiceStatus_() { const c = voiceCfg_(); return { hasKey: !!c.key, voiceId: c.voice, voiceName: c.voiceName, model: c.model, enabled: c.on && !!c.key && !!c.voice, models: VOICE_MODELS_ }; }
// roster rank -> how you'd address them ("Police Officer II" -> "Officer"); same rules as the sign-on page
function voiceTitle_(rank) {
  const r = str_(rank).toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!r) return "";
  const T = [[/sergeant major/, "Sergeant Major"], [/assistant chief/, "Assistant Chief"], [/deputy chief/, "Deputy Chief"], [/\bchief\b/, "Chief"], [/commander/, "Commander"], [/\bmajor\b/, "Major"],
    [/captain/, "Captain"], [/lieutenant/, "Lieutenant"], [/staff sergeant/, "Staff Sergeant"], [/sergeant/, "Sergeant"], [/corporal/, "Corporal"], [/detective/, "Detective"],
    [/officer|recruit|cadet|trainee|probation|\bpo\b/, "Officer"]];
  for (let i = 0; i < T.length; i++) if (T[i][0].test(r)) return T[i][1];
  return "";
}
function voiceLast_(n) {
  n = cleanName_(n).replace(/["“”'(\[].*?["“”')\]]/g, " ").trim();
  if (n.indexOf(",") > 0) return n.split(",")[0].trim().split(/\s+/).pop();
  const parts = n.split(/\s+/).filter(w => !/^(jr|sr|ii|iii|iv)\.?$/i.test(w) && !/^[A-Za-z]\.?$/.test(w));
  return parts.length ? parts[parts.length - 1] : n;
}
// what the voice says for this officer: "Sergeant Duzen." (Say Name As replaces the last name)
function voiceNameText_(acct, person) {
  const name = (person && person.name) || acct.name || acct.username || "";
  const last = str_(acct.sayAs) || voiceLast_(name);
  return ((voiceTitle_(person && person.rank) || "Officer") + (last ? " " + last : "")).replace(/[^A-Za-z0-9 '\-]/g, "").trim() + ".";
}
const VOICE_RECIPE_ = "r3";             // bump when the recording settings change, so clips are recorded again
function voiceHash_(s) { s = VOICE_RECIPE_ + "|" + s; return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).slice(0, 9).map(b => ((b + 256) % 256).toString(16).padStart(2, "0")).join(""); }
// a clip = what to say + the words around it (ElevenLabs uses them so the pieces flow as one sentence)
function voiceKey_(kind, when) {
  const c = voiceCfg_();
  if (kind === "greet") { const t = VOICE_GREET_[when] || VOICE_GREET_.evening; return { key: "g" + voiceHash_(c.voice + "|" + c.model + "|" + t), text: t }; }
  return { key: "c" + voiceHash_(c.voice + "|" + c.model + "|" + VOICE_CLOSE_), text: VOICE_CLOSE_ };
}
function voiceNameKey_(text) { const c = voiceCfg_(); return { key: "n" + voiceHash_(c.voice + "|" + c.model + "|" + text), text: text }; }   // recorded on its own, like the others
function voiceSheet_() {
  const ss = ss_(); let sh = ss.getSheetByName(VOICE_SHEET_);
  if (!sh) { sh = ss.insertSheet(VOICE_SHEET_); sh.appendRow(["Key", "Says", "Voice", "Recorded", "Audio (MP3, base64)"]); sh.setFrozenRows(1); sh.getRange(1, 1, 1, 5).setFontWeight("bold"); }
  return sh;
}
function voiceFind_(key) {
  const sh = voiceSheet_(), last = sh.getLastRow(); if (last < 2) return null;
  const keys = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < keys.length; i++) if (str_(keys[i][0]) === key) return { row: i + 2, b64: str_(sh.getRange(i + 2, 5).getValue()) };
  return null;
}
function eleven_(clip) {
  const c = voiceCfg_(); VOICE_ERR_.v = "";
  // steady, identical settings + a fixed seed so every clip lands on the same pitch and tone (they're joined in the browser)
  const body = { text: clip.text, model_id: c.model, seed: 4242, voice_settings: { stability: 0.8, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: 1 } };
  if (clip.prev) body.previous_text = clip.prev;
  if (clip.next) body.next_text = clip.next;
  const r = UrlFetchApp.fetch("https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(c.voice) + "?output_format=mp3_22050_32",
    { method: "post", contentType: "application/json", headers: { "xi-api-key": c.key, Accept: "audio/mpeg" }, payload: JSON.stringify(body), muteHttpExceptions: true });
  const code = r.getResponseCode();
  if (code !== 200) {
    let msg = "", st = ""; try { const j = JSON.parse(r.getContentText()); st = str_(j.detail && j.detail.status); msg = (j.detail && j.detail.message) || j.message || ""; } catch (e) {}
    const why = (st ? "[" + st + "] " : "") + (msg || ""), quota = /quota_exceeded|insufficient|credits? (remaining|left)|character limit/i.test(why);
    VOICE_ERR_.v = (quota ? "ElevenLabs says this key is out of credits. If your account still has characters, the key itself may have a credit limit set (ElevenLabs → Developers → API Keys → edit the key)." : code === 401 ? "ElevenLabs refused the request." : "ElevenLabs error " + code + ".") + (why ? " ElevenLabs said: " + clip_(why, 300) : "");
    return "";
  }
  return Utilities.base64Encode(r.getBlob().getBytes());
}
// the clip's audio: cache -> sheet -> record it now (and keep it)
function voiceClip_(clip) {
  const cache = CacheService.getScriptCache(), ck = "vc_" + clip.key;
  const hit = cache.get(ck); if (hit) return hit;
  const f = voiceFind_(clip.key); if (f && f.b64) { try { cache.put(ck, f.b64, 21600); } catch (e) {} return f.b64; }
  const b64 = eleven_(clip); if (!b64) return "";
  withLock_(() => { if (!voiceFind_(clip.key)) voiceSheet_().appendRow([clip.key, clip.text, voiceCfg_().voiceName || voiceCfg_().voice, new Date(), b64]); return { ok: true }; });
  try { cache.put(ck, b64, 21600); } catch (e) {}
  return b64;
}
function voiceForget_(text) {
  const k = voiceNameKey_(text).key, f = voiceFind_(k);
  CacheService.getScriptCache().remove("vc_" + k);
  if (f) withLock_(() => { voiceSheet_().deleteRow(f.row); return { ok: true }; });
}
// signed-in device asks for its greeting; the browser keeps clips it already has (d.have)
function voiceForDevice_(d) {
  const c = voiceCfg_(); if (!c.on || !c.key || !c.voice) return { ok: true, on: false };
  const dv = offRead_(d.device, "DEV"); if (!dv) return { ok: false, error: "AUTH" };
  const acct = acctFind_(dv.id); if (!acct || acct.locked) return { ok: false, error: "AUTH" };
  const have = {}; (Array.isArray(d.have) ? d.have : []).slice(0, 60).forEach(k => { have[str_(k)] = 1; });
  const nk = voiceNameKey_(voiceNameText_(acct, rosterPerson_(acct.id))), ck = voiceKey_("close");
  const plan = { greet: {}, name: nk.key, close: ck.key, says: nk.text }, audio = {}, need = [ck, nk];
  Object.keys(VOICE_GREET_).forEach(w => { const k = voiceKey_("greet", w); plan.greet[w] = k.key; need.push(k); });
  for (let i = 0; i < need.length; i++) { if (have[need[i].key]) continue; const b = voiceClip_(need[i]); if (!b) return { ok: true, on: false, error: VOICE_ERR_.v }; audio[need[i].key] = b; }
  return { ok: true, on: true, plan: plan, audio: audio };
}
function voiceUsage_() {
  const c = voiceCfg_(); if (!c.key) return null;
  try { const r = UrlFetchApp.fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": c.key }, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return null; const j = JSON.parse(r.getContentText());
    return { used: Number(j.character_count) || 0, limit: Number(j.character_limit) || 0, resets: j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000).toISOString() : "", tier: str_(j.tier) };
  } catch (e) { return null; }
}
function voiceVoices_() {
  const c = voiceCfg_(); if (!c.key) throw new Error("Paste the ElevenLabs API key first.");
  const r = UrlFetchApp.fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": c.key }, muteHttpExceptions: true });
  if (r.getResponseCode() === 401) throw new Error("ElevenLabs refused the API key. Make sure the key has Voices (read) access.");
  if (r.getResponseCode() !== 200) throw new Error("ElevenLabs error " + r.getResponseCode() + ".");
  const voices = (JSON.parse(r.getContentText()).voices || []).map(v => ({ id: str_(v.voice_id), name: str_(v.name), preview: str_(v.preview_url), premade: str_(v.category) === "premade", category: str_(v.category),
    about: [v.labels && v.labels.gender, v.labels && v.labels.accent, v.labels && (v.labels.description || v.labels.descriptive), v.labels && (v.labels.use_case || v.labels.use_case)].filter(Boolean).join(" · ") }));
  voices.sort((x, y) => (y.premade - x.premade) || x.name.localeCompare(y.name));
  return { voices: voices, usage: voiceUsage_(), voice: voiceStatus_() };
}

// =====================================================================
// DISCORD HELPERS
// =====================================================================
function addListFields_(fields, name, lines) {
  if (!lines.length) { fields.push({ name: name, value: "*None recorded.*", inline: false }); return; }
  let buf = "", part = 0;
  const flush = () => { fields.push({ name: clip_(part ? name + " (cont.)" : name, 256), value: buf, inline: false }); part++; buf = ""; };
  lines.forEach(line => {
    line = clip_(line, 1000);
    if (buf && buf.length + 1 + line.length > 1024) flush();
    buf += (buf ? "\n" : "") + line;
  });
  if (buf) flush();
}

function packEmbeds_(fields, title, color, description, extras) {
  const out = [];
  let cur = Object.assign({ title: title, color: color }, description ? { description: clip_(description, 4096) } : {}, extras || {}, { fields: [] });
  let size = title.length + (cur.description || "").length + ((cur.footer && cur.footer.text) || "").length;
  fields.forEach(f => {
    const fs = f.name.length + f.value.length;
    if (cur.fields.length >= 25 || size + fs > 5800) {
      out.push(cur);
      cur = { title: clip_(title + " (cont.)", 256), color: color, fields: [] };
      size = cur.title.length;
    }
    cur.fields.push(f); size += fs;
  });
  out.push(cur);
  return out;
}

function chunk_(text, max) {
  const parts = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.substring(0, cut));
    rest = rest.substring(cut).replace(/^\s+/, "");
  }
  if (rest) parts.push(rest);
  return parts;
}

function discordPost_(webhookUrl, payload, threadId, file) {
  let url = webhookUrl + (webhookUrl.indexOf("?") !== -1 ? "&" : "?") + "wait=true";
  if (threadId) url += "&thread_id=" + threadId;
  const opts = { method: "post", muteHttpExceptions: true };
  if (file) {
    opts.payload = { payload_json: JSON.stringify(payload), "files[0]": file }; // multipart: message + attachment in one post
  } else {
    opts.contentType = "application/json";
    opts.payload = JSON.stringify(payload);
  }
  const res = UrlFetchApp.fetch(url, opts);
  const code = res.getResponseCode();
  if (code !== 200 && code !== 201 && code !== 204) return { ok: false, error: "Discord (" + code + "): " + clip_(res.getContentText(), 300) };
  let body = null;
  try { body = JSON.parse(res.getContentText()); } catch (e) {}
  return { ok: true, body: body };
}

// =====================================================================
// ADMIN ACCOUNTS + SESSIONS
// =====================================================================
function adminsSheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(ADMINS_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(ADMINS_SHEET_);
    sh.appendRow(["Username", "Role", "Salt", "Password Hash", "Created", "Last Login", "Signed Out"]);
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  return sh;
}
// the admin list is read on every admin request (to check the session), so it's kept in the cache
function adminsDirty_() { CacheService.getScriptCache().remove("admins_list"); }
function getAdmins_() {
  const cache = CacheService.getScriptCache(), hit = cache.get("admins_list");
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const list = readAdmins_().map(a => Object.assign({}, a, { created: isDate_(a.created) ? a.created.toISOString() : a.created || "", lastLogin: isDate_(a.lastLogin) ? a.lastLogin.toISOString() : a.lastLogin || "" }));
  try { cache.put("admins_list", JSON.stringify(list), 21600); } catch (e) {}
  return list;
}
function readAdmins_() {
  const data = adminsSheet_().getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    if (!str_(data[i][0])) continue;
    out.push({ row: i + 1, username: str_(data[i][0]), role: str_(data[i][1]) || "admin", salt: str_(data[i][2]), hash: str_(data[i][3]), created: data[i][4], lastLogin: data[i][5],
      signedOut: data[i][6] instanceof Date ? data[i][6].getTime() : Number(data[i][6]) || 0 });
  }
  return out;
}
function findAdmin_(username) {
  const u = str_(username).toLowerCase();
  return getAdmins_().find(a => a.username.toLowerCase() === u) || null;
}
function hashPw_(pw, salt) {
  let h = salt + "|" + pw;
  for (let i = 0; i < 500; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + "|" + salt, Utilities.Charset.UTF_8));
  }
  return h;
}
function checkPwRules_(pw) {
  if (String(pw || "").length < 8) throw new Error("Password must be at least 8 characters.");
}
function setAdmin_(username, password, role) {
  username = str_(username);
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) throw new Error("Username: 3-32 letters, numbers, dot, dash or underscore.");
  checkPwRules_(password);
  if (role !== "owner" && role !== "admin" && role !== "leader") role = "admin";
  const salt = Utilities.getUuid();
  const hash = hashPw_(password, salt);
  const sh = adminsSheet_(), existing = findAdmin_(username);
  if (existing) { sh.getRange(existing.row, 2, 1, 3).setValues([[role, salt, hash]]); sh.getRange(existing.row, 7).setValue(Date.now()); }   // new password signs out every device
  else sh.appendRow([username, role, salt, hash, new Date(), ""]);
  adminsDirty_();
}

// Sessions are signed tokens (username|expires|issued + HMAC), so they survive cache resets and can last days ("keep me signed in").
// Signing out, or a password change, stamps "Signed Out" on the admin row, which ends every older token for that admin.
const REMEMBER_MS_ = 14 * 864e5, SHORT_MS_ = 12 * 3600e3;
function sessSecret_() {
  let k = PROPS_.getProperty("SESSION_SECRET");
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); PROPS_.setProperty("SESSION_SECRET", k); }
  return k;
}
function sessSign_(payload) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, sessSecret_())).replace(/=+$/, ""); }
function newSession_(admin, remember) {
  const now = Date.now();
  const payload = Utilities.base64EncodeWebSafe(admin.username + "|" + (now + (remember ? REMEMBER_MS_ : SHORT_MS_)) + "|" + now, Utilities.Charset.UTF_8).replace(/=+$/, "");
  return payload + "." + sessSign_(payload);
}
function sessionAdmin_(token) {
  const t = str_(token);
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t)) {
    const parts = t.split(".");
    if (sessSign_(parts[0]) !== parts[1]) return null;
    let raw; try { raw = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0] + "===".slice((parts[0].length + 3) % 4))).getDataAsString(); } catch (e) { return null; }
    const bits = raw.split("|"), exp = Number(bits[1]), issued = Number(bits[2]);
    if (!(exp > Date.now())) return null;
    const admin = findAdmin_(bits[0]);
    if (!admin || (admin.signedOut && issued < admin.signedOut)) return null;
    return admin;
  }
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const cache = CacheService.getScriptCache();
  const username = cache.get("sess_" + token);
  if (!username) return null;
  const admin = findAdmin_(username);           // removed admins lose access immediately
  if (!admin) { cache.remove("sess_" + token); return null; }
  cache.put("sess_" + token, username, SESSION_SECONDS_); // sliding expiry
  return admin;
}

function logAdmin_(user, action, detail, when) {
  const ss = ss_();
  let sh = ss.getSheetByName(LOG_SHEET_);
  if (!sh) { sh = ss.insertSheet(LOG_SHEET_); sh.appendRow(["When", "Admin", "Action", "Detail"]); sh.setFrozenRows(1); }
  const at = when ? new Date(when) : new Date(), text = cellSafe_(clip_(detail || "", 1000));
  sh.appendRow([at, user, action, text]);
  const cache = CacheService.getScriptCache(), hit = cache.get("admin_log");   // keep the cached copy current
  if (hit) { try { const list = JSON.parse(hit); list.unshift({ when: at.toISOString(), user: user, action: action, detail: text }); list.sort((a, b) => String(b.when).localeCompare(String(a.when))); cache.put("admin_log", JSON.stringify(list.slice(0, 200)), 21600); } catch (e) { cache.remove("admin_log"); } }
}
function readLog_(n) {
  const cache = CacheService.getScriptCache(), pending = deferred_().map(x => ({ when: x.when, user: x.user, action: "login", detail: "" }));
  let list = null;
  const hit = cache.get("admin_log");
  if (hit) { try { list = JSON.parse(hit); } catch (e) {} }
  if (!list) {
    const sh = ss_().getSheetByName(LOG_SHEET_);
    if (!sh || sh.getLastRow() < 2) list = [];
    else {
      const count = Math.min(200, sh.getLastRow() - 1);
      list = sh.getRange(sh.getLastRow() - count + 1, 1, count, 4).getValues().reverse()
        .map(r => ({ when: isDate_(r[0]) ? r[0].toISOString() : String(r[0]), user: r[1], action: r[2], detail: r[3] }));
    }
    try { cache.put("admin_log", JSON.stringify(list), 21600); } catch (e) {}
  }
  return pending.concat(list).slice(0, n);
}
// sign-in bookkeeping waits in a small queue and is written by the next save or the 10-minute trigger
function deferred_() { try { return JSON.parse(CacheService.getScriptCache().get("defer_logins") || "[]"); } catch (e) { return []; } }
function deferLogin_(user) {
  const q = deferred_(); q.unshift({ user: user, when: new Date().toISOString() });
  CacheService.getScriptCache().put("defer_logins", JSON.stringify(q.slice(0, 100)), 21600);
}
function flushDeferred_() {
  const q = deferred_(); if (!q.length) return;
  CacheService.getScriptCache().remove("defer_logins");
  const sh = adminsSheet_(), admins = readAdmins_(), latest = {};
  q.slice().reverse().forEach(x => { logAdmin_(x.user, "login", "", x.when); latest[x.user.toLowerCase()] = x.when; });
  admins.forEach(a => { const w = latest[a.username.toLowerCase()]; if (w) sh.getRange(a.row, 6).setValue(new Date(w)); });
  adminsDirty_();
}

// =====================================================================
// ADMIN API
// =====================================================================
function allPayload_(me) {
  if (me.role === "leader") return { ok: true, me: { username: me.username, role: me.role }, backend: BACKEND_VERSION, leader: true, divisions: divList_() };
  const cfg = getConfig_(), missing = [], isOwner = me.role === "owner";
  try { ensureWarmTrigger_(); } catch (e) {}
  const rosters = rostersFor_(cfg.forms, { cacheOnly: true, missing: missing });   // instant; anything not cached loads after sign-in
  return {
    ok: true,
    me: { username: me.username, role: me.role },
    backend: BACKEND_VERSION,
    config: cfg,
    rosters: rosters, rostersMissing: missing,
    roster: (() => { try { return usesOldRoster_(cfg.forms) ? rosterForPickers_() : []; } catch (e) { return []; } })(),
    webhooks: maskWebhooks_(),
    admins: (isOwner ? getAdmins_() : getAdmins_().filter(x => x.username === me.username)).map(x => {
      const p = deferred_().find(q => q.user.toLowerCase() === x.username.toLowerCase());
      return { username: x.username, role: x.role, created: x.created ? new Date(x.created).toISOString() : "", lastLogin: p ? p.when : x.lastLogin ? new Date(x.lastLogin).toISOString() : "" };
    }),
    log: readLog_(200),
    snapshot: snapshotStatus_(),
    cidCommand: !!PROPS_.getProperty("CID_CMD_HASH")
  };
}
function handleAdmin_(d) {
  const a = d.action;

  if (a === "login") {
    const username = str_(d.username), cache = CacheService.getScriptCache();
    const failKey = "fail_" + username.toLowerCase();
    const fails = Number(cache.get(failKey) || 0);
    if (fails >= MAX_LOGIN_FAILS_) return { ok: false, error: "Too many failed attempts. Try again in 15 minutes." };
    const admin = findAdmin_(username);
    if (!admin || hashPw_(String(d.password || ""), admin.salt) !== admin.hash) {
      cache.put(failKey, String(fails + 1), 900);
      return { ok: false, error: "Wrong username or password." };
    }
    cache.remove(failKey);
    deferLogin_(admin.username);                         // "last login" + activity line are written later, so signing in is quick
    admin.lastLogin = new Date().toISOString();
    return Object.assign(allPayload_(admin), { ok: true, token: newSession_(admin, d.remember !== false) });   // one trip: sign in + load the portal
  }

  if (/^cid(Mine|List|Review)$/.test(a)) return cidHandle_(d);
  if (a === "divMine") return divMine_(d);
  if (/^acct(DiscordUrl|Discord|SetPin|Pin|Me|Out)$/.test(a)) return acctHandle_(d);
  if (a === "acctVoice") return voiceForDevice_(d);

  const me = sessionAdmin_(d.token);
  if (!me) return { ok: false, error: "AUTH", message: "Your session expired. Please log in again." };
  const isOwner = me.role === "owner";
  const ownerOnly = () => { if (!isOwner) throw new Error("Only an owner can manage admin accounts."); };
  // division leaders: the Division Command page only (no forms, settings, webhooks or accounts)
  if (me.role === "leader" && !LEADER_ACTIONS_[a]) throw new Error("Division leader accounts can only use the Division Command page.");
  if (a === "divView") return divView_(d, me);
  if (a === "divReport") return divReport_(d);
  if (a === "divGrade") return withLock_(() => divGrade_(d, me));

  switch (a) {
    case "logout":
      CacheService.getScriptCache().remove("sess_" + d.token);
      if (d.everywhere) { adminsSheet_().getRange(me.row, 7).setValue(Date.now()); adminsDirty_(); }
      return { ok: true };

    case "getAll": return allPayload_(me);

    case "snapshotSetup": {      // owner pastes a GitHub token: the site then loads from its own copy
      ownerOnly();
      const tok = str_(d.githubToken), repo = str_(d.repo) || SNAP_REPO_DEFAULT_;
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Repository should look like owner/name.");
      if (tok) PROPS_.setProperty("GITHUB_TOKEN", tok);
      if (d.off) PROPS_.deleteProperty("GITHUB_TOKEN");
      PROPS_.setProperty("SNAP_REPO", repo);
      PROPS_.deleteProperty("SNAP_HASH"); PROPS_.deleteProperty("SNAP_SHA");
      logAdmin_(me.username, "fast loading", d.off ? "turned off" : "set up for " + repo);
      const r = d.off ? { ok: true } : publishSnapshot_(true);
      return { ok: r.ok, error: r.error, snapshot: snapshotStatus_() };
    }
    case "divImport": {         // put reports filed before Division Command existed into its log
      const r = divImport_();
      logAdmin_(me.username, "division logs", "imported " + r.added + " past reports");
      return Object.assign({ ok: true }, r);
    }
    case "acctList": return { ok: true, accounts: acctList_(), discord: discordStatus_(), voice: voiceStatus_(), signon: signonCfg_() };
    case "signonSetup": {        // owner/admin: make the sign-on screen the front door
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can change this.");
      if (d.required && !signonCfg_().ready) throw new Error("Set up Sign in with Discord first, otherwise nobody could get in.");
      PROPS_.setProperty("SIGNON_REQUIRED", d.required ? "1" : ""); PROPS_.setProperty("SIGNON_PIN_EVERY", d.pinEvery ? "1" : "");
      logAdmin_(me.username, "sign-on screen", (d.required ? "required" : "off") + (d.pinEvery ? ", PIN every visit" : ""));
      return { ok: true, signon: signonCfg_() };
    }
    case "acctSayAs": case "voiceRedo": {      // how the voice says an officer's name / record their clip again
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can change the sign-in voice.");
      const acct = acctFind_(d.discordId); if (!acct) throw new Error("Account not found.");
      if (a === "acctSayAs") withLock_(() => { acctSheet_().getRange(acct.row, 13).setValue(cellSafe_(clip_(str_(d.sayAs), 60))); return { ok: true }; });
      else voiceForget_(voiceNameText_(acct, rosterPerson_(acct.id)));
      logAdmin_(me.username, "sign-in voice", (a === "acctSayAs" ? "say name as '" + str_(d.sayAs) + "' for " : "re-record ") + str_(d.discordId));
      return { ok: true, accounts: acctList_() };
    }
    case "voiceSetup": {         // owner: ElevenLabs API key, voice and model
      ownerOnly();
      if (str_(d.apiKey)) PROPS_.setProperty("ELEVEN_KEY", str_(d.apiKey));
      if (d.voiceId != null) PROPS_.setProperty("ELEVEN_VOICE", str_(d.voiceId));
      if (d.voiceName != null) PROPS_.setProperty("ELEVEN_VOICE_NAME", clip_(str_(d.voiceName), 80));
      if (d.model != null) PROPS_.setProperty("ELEVEN_MODEL", VOICE_MODELS_.indexOf(str_(d.model)) !== -1 ? str_(d.model) : VOICE_MODELS_[0]);
      if (d.enabled != null) PROPS_.setProperty("ELEVEN_ON", d.enabled ? "1" : "");
      if (d.clear) ["ELEVEN_KEY", "ELEVEN_VOICE", "ELEVEN_VOICE_NAME", "ELEVEN_ON"].forEach(k => PROPS_.deleteProperty(k));
      logAdmin_(me.username, "sign-in voice", d.clear ? "removed" : "settings saved");
      return { ok: true, voice: voiceStatus_() };
    }
    case "voiceVoices": {        // owner: list the account's voices + characters used
      ownerOnly();
      return Object.assign({ ok: true }, voiceVoices_());
    }
    case "voiceTest": {          // owner/admin: hear "Good evening, Sergeant Duzen. You're signed on."
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can test the voice.");
      const c = voiceCfg_(); if (!c.key || !c.voice) throw new Error("Add the ElevenLabs API key and pick a voice first.");
      const nameText = clip_(str_(d.text) || "Sergeant Duzen", 60).replace(/[.!?]*$/, ".");
      const keys = [voiceKey_("greet", str_(d.when) || "evening"), voiceNameKey_(nameText), voiceKey_("close")];
      const audio = {}; keys.forEach(k => { const b = voiceClip_(k); if (!b) throw new Error(VOICE_ERR_.v || "ElevenLabs didn't return audio."); audio[k.key] = b; });
      return { ok: true, keys: keys.map(k => k.key), audio: audio, usage: voiceUsage_() };
    }
    case "acctReset": case "acctLock": case "acctSignOut": case "acctLevel": {
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can manage officer accounts.");
      const r = acctAdmin_(a, d, me); logAdmin_(me.username, "officer account", a.replace("acct", "") + " " + str_(d.discordId) + (d.level ? " -> " + d.level : "") + (d.locked != null ? " -> " + (d.locked ? "locked" : "unlocked") : ""));
      return r;
    }
    case "discordSetup": {       // owner pastes the Discord app's Client ID + Secret (sign in with Discord)
      ownerOnly();
      if (str_(d.clientId) && !/^\d{15,21}$/.test(str_(d.clientId))) throw new Error("The Client ID is the long number on the app's OAuth2 page.");
      if (str_(d.clientId)) PROPS_.setProperty("DISCORD_CLIENT_ID", str_(d.clientId));
      if (str_(d.clientSecret)) PROPS_.setProperty("DISCORD_CLIENT_SECRET", str_(d.clientSecret));
      PROPS_.setProperty("DISCORD_REDIRECT", str_(d.redirect));
      PROPS_.setProperty("DISCORD_GUILD", /^\d{15,21}$/.test(str_(d.guildId)) ? str_(d.guildId) : "");
      logAdmin_(me.username, "Discord sign-in", "settings saved");
      return { ok: true, discord: discordStatus_() };
    }
    case "cidSetPassword": {    // the CID Command review page password
      ownerOnly();
      const pw = String(d.password || "");
      if (pw.length < 6) throw new Error("Use at least 6 characters.");
      const salt = Utilities.getUuid();
      PROPS_.setProperty("CID_CMD_SALT", salt); PROPS_.setProperty("CID_CMD_HASH", hashPw_(pw, salt));
      logAdmin_(me.username, "CID command password", "changed");
      return { ok: true };
    }
    case "snapshotPublish": {
      const r = publishSnapshot_(true);
      return { ok: r.ok, error: r.error, snapshot: snapshotStatus_() };
    }

    case "saveConfig": {
      const cur = getConfig_();
      if (Number(d.baseVersion) !== Number(cur.version)) {
        return { ok: false, error: "CONFLICT", message: (cur.updatedBy || "Another admin") + " saved changes since you loaded the page. Reload to get their version (your unsaved edits will be lost)." };
      }
      const next = validateConfig_(d.config);
      CacheService.getScriptCache().remove("warm_trigger_ok");
      next.version = Number(cur.version) + 1;
      writeConfig_(next, me.username);
      CacheService.getScriptCache().removeAll(["portal_roster", "roster_calls"]);
      const tabKeys = []; next.forms.forEach(f => (f.blocks || []).forEach(b => (b.fields || []).forEach(fd => { if (fd.rosterTabId != null && fd.rosterTabId !== "") tabKeys.push("roster_tab_" + fd.rosterTabId); })));
      if (tabKeys.length) CacheService.getScriptCache().removeAll(tabKeys);
      promoClearCache_();                                  // progression setup may have changed
      divClearCache_();                                    // division setup may have changed
      logAdmin_(me.username, "save config", diffSummary_(cur, next));
      try { ensureWarmTrigger_(); } catch (e) {}
      snapshotSoon_();
      return { ok: true, config: next };
    }

    case "webhookSave": {
      const w = d.webhook || {};
      const name = clip_(str_(w.name), 60);
      if (!name) throw new Error("Give the webhook a name.");
      const kind = w.kind === "text" ? "text" : "forum";
      const list = getWebhooks_();
      let item = w.id ? list.find(x => x.id === w.id) : null;
      if (!item && w.id && LEGACY_WEBHOOK_KEYS_[w.id] && PROPS_.getProperty(LEGACY_WEBHOOK_KEYS_[w.id])) {
        item = { id: w.id, url: PROPS_.getProperty(LEGACY_WEBHOOK_KEYS_[w.id]) }; // adopt an old-setup webhook
        list.push(item);
      }
      const url = str_(w.url);
      if (!item && !url) throw new Error("Paste the webhook URL.");
      let channelInfo = "";
      if (url) {
        if (!WEBHOOK_RE_.test(url)) throw new Error("That isn't a Discord webhook URL (it should start with https://discord.com/api/webhooks/).");
        const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        if (res.getResponseCode() !== 200) throw new Error("Discord rejected that webhook (" + res.getResponseCode() + "). It may have been deleted or regenerated.");
        channelInfo = JSON.parse(res.getContentText()).name || "";
      }
      if (!item) {
        let id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "webhook";
        let n = 2, base = id;
        while (list.some(x => x.id === id)) id = base + "-" + n++;
        item = { id: id };
        list.push(item);
      }
      item.name = name; item.kind = kind;
      if (url) item.url = url;
      saveWebhooks_(list);
      logAdmin_(me.username, w.id ? "edit webhook" : "add webhook", name + (url ? " (URL " + (w.id ? "replaced" : "set") + ")" : ""));
      return { ok: true, webhooks: maskWebhooks_(), discordName: channelInfo };
    }

    case "webhookDelete": {
      const cfg = getConfig_();
      const users = cfg.forms.filter(f => f.webhookId === d.id || (f.leaderboard && f.leaderboard.enabled && f.leaderboard.webhookId === d.id)).map(f => f.title);
      if (users.length) throw new Error("Still used by: " + users.join(", ") + ". Switch those forms to another webhook first.");
      const list = getWebhooks_().filter(x => x.id !== d.id);
      saveWebhooks_(list);
      if (LEGACY_WEBHOOK_KEYS_[d.id]) PROPS_.deleteProperty(LEGACY_WEBHOOK_KEYS_[d.id]);
      logAdmin_(me.username, "delete webhook", d.id);
      return { ok: true, webhooks: maskWebhooks_() };
    }

    case "webhookTest": {
      const w = webhookById_(d.id);
      if (!w) throw new Error("Webhook not found.");
      const res = UrlFetchApp.fetch(w.url, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) return { ok: true, valid: false, message: "Discord says this webhook is invalid (" + res.getResponseCode() + "). Replace its URL." };
      const info = JSON.parse(res.getContentText());
      if (d.send) {
        const p = { content: "✅ Test message from the LSPD Portal (sent by " + me.username + ").", allowed_mentions: { parse: [] } };
        if (w.kind !== "text") p.thread_name = "Portal webhook test";
        const r = discordPost_(w.url, p, null);
        if (!r.ok) return { ok: true, valid: true, message: "Webhook is valid, but the test post failed: " + r.error };
        logAdmin_(me.username, "test webhook", w.name);
        return { ok: true, valid: true, message: "Test message posted by \"" + info.name + "\"." };
      }
      return { ok: true, valid: true, message: "Valid: posts as \"" + info.name + "\"." };
    }

    case "rosterPreview": {
      callsignMap_(true);
      const r = getRosterTab_(d.tabId, true);
      return { ok: true, preview: r };
    }

    case "callsignTest": {
      const m = callsignMap_(true);
      return { ok: true, calls: m ? { count: m.count, tab: m.tab, error: m.error, sample: Object.keys(m.byId).slice(0, 5).map(k => m.byId[k]) } : null };
    }

    case "rosterTabs": {
      const r = (getConfig_().settings || {}).roster || {};
      const url = str_(d.url !== undefined ? d.url : r.url);
      let book;
      try { book = url ? SpreadsheetApp.openByUrl(url) : ss_(); }
      catch (e) { return { ok: false, error: "Couldn't open that sheet: " + errMsg_(e) }; }
      const system = [CONFIG_SHEET_, ADMINS_SHEET_, LOG_SHEET_, LB_SHEET_, HOURS_SHEET_, PROMO_SHEET_];
      const tabs = book.getSheets().filter(sh => url || system.indexOf(sh.getName()) === -1)
        .map(sh => ({ name: sh.getName(), id: sh.getSheetId(), hidden: sh.isSheetHidden(), rows: Math.max(0, sh.getLastRow() - 1) }));
      return { ok: true, book: book.getName(), tabs: tabs };
    }

    case "rosterTest": {
      const r = getRoster_(true);
      return { ok: true, roster: r, shown: rosterForPickers_().length };
    }

    case "leaderboardRefresh": {
      const form = getConfig_().forms.find(f => f.id === d.formId);
      if (!form || !form.leaderboard || !form.leaderboard.enabled) throw new Error("That form has no leaderboard turned on.");
      updateLeaderboard_(form);
      logAdmin_(me.username, "refresh leaderboard", form.title);
      return { ok: true };
    }

    case "rosters": {   // the roster tabs getAll didn't have cached yet
      return { ok: true, rosters: rostersFor_(getConfig_().forms) };
    }

    case "promoAdmin": {
      const pid = progId_(d.program);
      return { ok: true, promo: promoView_(true, pid), settings: promoCfg_(null, pid), programs: programs_().map(p => ({ id: p.id, title: p.title, on: p.on })) };
    }
    case "promoCredit": {        // add a completion by hand
      const pid = progId_(d.program), c = promoFind_(d.key, pid), t = promoTask_(d.taskId, pid);
      const n = Math.max(1, Math.min(10, parseInt(d.count, 10) || 1));
      promoAppend_([{ type: "credit", c: c, task: taskKey_(pid, t.id), count: n, form: "", report: "", date: str_(d.date) || ymd_(new Date()), note: clip_(str_(d.note), 300), by: me.username }]);
      logAdmin_(me.username, "progression credit", promoCfg_(null, pid).title + " · " + (c.callsign ? c.callsign + " " : "") + c.name + " · " + t.title + (n > 1 ? " ×" + n : ""));
      return { ok: true, promo: promoView_(true, pid) };
    }
    case "promoRemove": {        // take a completion back off (kept in the sheet, marked removed)
      const pid = progId_(d.program), sh = promoSheet_(), data = sh.getDataRange().getValues();
      const i = data.findIndex((r, j) => j && str_(r[0]) === str_(d.rowId));
      if (i < 1) throw new Error("That entry no longer exists.");
      sh.getRange(i + 1, 14).setValue("removed by " + me.username + " " + ymd_(new Date()));
      promoClearCache_();
      logAdmin_(me.username, "progression credit removed", str_(data[i][4]) + " " + str_(data[i][5]) + " · " + str_(data[i][6]));
      return { ok: true, promo: promoView_(true, pid) };
    }
    case "promoExcuse": {
      const pid = progId_(d.program), c = promoFind_(d.key, pid), t = promoTask_(d.taskId, pid);
      promoAppend_([{ type: d.on ? "excuse" : "unexcuse", c: c, task: taskKey_(pid, t.id), count: 0, note: clip_(str_(d.note), 300), by: me.username }]);
      logAdmin_(me.username, d.on ? "progression requirement excused" : "progression excuse removed", (c.callsign || c.name) + " · " + t.title);
      return { ok: true, promo: promoView_(true, pid) };
    }
    case "promoSince": {         // date they started the grade (time in grade)
      const pid = progId_(d.program), c = promoFind_(d.key, pid);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str_(d.date))) throw new Error("Pick a date.");
      promoAppend_([{ type: metaType_(pid, "since"), c: c, task: "", count: 0, date: str_(d.date), by: me.username }]);
      logAdmin_(me.username, "progression start date set", (c.callsign || c.name) + " → " + d.date);
      return { ok: true, promo: promoView_(true, pid) };
    }

    case "hoursReport": {
      return { ok: true, hours: hoursSummary_(/^\d{4}-\d{2}-\d{2}$/.test(str_(d.week)) ? str_(d.week) : "") };
    }

    case "hoursRefresh": {
      const cfg = getConfig_();
      if (!cfg.settings.hours || !cfg.settings.hours.board) throw new Error("Turn on the weekly hours board in Portal Settings first.");
      updateHoursBoard_(cfg);
      logAdmin_(me.username, "refresh hours board", "");
      return { ok: true };
    }

    case "changePassword": {
      if (hashPw_(String(d.current || ""), me.salt) !== me.hash) throw new Error("Current password is wrong.");
      setAdmin_(me.username, d.next, me.role);
      logAdmin_(me.username, "change own password", "");
      Utilities.sleep(5);                                   // the new token must be issued after the "signed out" stamp
      return { ok: true, token: newSession_(findAdmin_(me.username), true) };   // other devices are signed out; this one stays in
    }

    case "adminAdd": {
      ownerOnly();
      if (findAdmin_(d.username)) throw new Error("That username already exists.");
      setAdmin_(d.username, d.password, d.role);
      logAdmin_(me.username, "add admin", str_(d.username) + " (" + d.role + ")");
      return { ok: true };
    }
    case "adminReset": {
      ownerOnly();
      const t = findAdmin_(d.username);
      if (!t) throw new Error("Admin not found.");
      setAdmin_(t.username, d.password, t.role);
      logAdmin_(me.username, "reset password", t.username);
      return { ok: true };
    }
    case "adminRole": {
      ownerOnly();
      const t = findAdmin_(d.username);
      if (!t) throw new Error("Admin not found.");
      if (t.role === "owner" && d.role !== "owner" && getAdmins_().filter(x => x.role === "owner").length < 2) throw new Error("There must always be at least one owner.");
      adminsSheet_().getRange(t.row, 2).setValue(["owner", "leader"].indexOf(d.role) !== -1 ? d.role : "admin"); adminsDirty_();
      logAdmin_(me.username, "change role", t.username + " -> " + d.role);
      return { ok: true };
    }
    case "adminRemove": {
      ownerOnly();
      const t = findAdmin_(d.username);
      if (!t) throw new Error("Admin not found.");
      if (t.username === me.username) throw new Error("You can't remove yourself.");
      if (t.role === "owner" && getAdmins_().filter(x => x.role === "owner").length < 2) throw new Error("There must always be at least one owner.");
      adminsSheet_().deleteRow(t.row); adminsDirty_();
      logAdmin_(me.username, "remove admin", t.username);
      return { ok: true };
    }
  }
  return { ok: false, error: "Unknown action." };
}

function maskWebhooks_() {
  const list = getWebhooks_().map(w => ({ id: w.id, name: w.name, kind: w.kind, hint: w.url ? "…" + w.url.slice(-6) : "", set: !!w.url }));
  Object.keys(LEGACY_WEBHOOK_KEYS_).forEach(id => {
    const url = PROPS_.getProperty(LEGACY_WEBHOOK_KEYS_[id]);
    if (url && !list.some(w => w.id === id)) list.push({ id: id, name: id + " (old setup)", kind: id === "leaderboard" ? "text" : "forum", hint: "…" + url.slice(-6), set: true });
  });
  return list;
}

// Server-side checks so a broken or malicious save can't wreck the live portal.
function validateConfig_(c) {
  if (!c || !Array.isArray(c.forms)) throw new Error("Invalid config.");
  const FIELD_TYPES = ["text", "number", "date", "time", "select", "discord_id", "case_number", "static", "officers", "officer"];
  const BLOCK_TYPES = ["banner", "fields", "strip", "text", "checklist", "repeater", "longtext"];
  const formIds = {};
  const out = { settings: {}, forms: [] };
  const s = c.settings || {};
  out.settings = {
    portalName: clip_(str_(s.portalName) || "LSPD", 40),
    portalSub: clip_(str_(s.portalSub), 60),
    heroTag: clip_(str_(s.heroTag), 60),
    heroText: clip_(str_(s.heroText), 300),
    footer: clip_(str_(s.footer), 120),
    heroLogo: s.heroLogo == null ? "img/lspd-patch.png" : str_(s.heroLogo),
    announcement: { text: clip_(str_(s.announcement && s.announcement.text), 500), style: (s.announcement && s.announcement.style) === "warning" ? "warning" : "info" },
    maintenance: { on: !!(s.maintenance && s.maintenance.on), message: clip_(str_(s.maintenance && s.maintenance.message), 300) },
    roster: { url: clip_(str_(s.roster && s.roster.url), 300), tab: s.roster && Array.isArray(s.roster.tabs) ? "" : clip_(str_(s.roster && s.roster.tab), 300),
      tabs: (s.roster && Array.isArray(s.roster.tabs) ? s.roster.tabs : []).map(t => String(t == null ? "" : t).substring(0, 100)).filter(t => t.trim()).slice(0, 60),   // exact names, spaces kept
      tabIds: (s.roster && Array.isArray(s.roster.tabIds) ? s.roster.tabIds : []).map(Number).filter(n => isFinite(n)).slice(0, 60),
      callsigns: (() => { const c = (s.roster && s.roster.callsigns) || {};
        return { on: !!c.on, tabId: c.tabId != null && isFinite(Number(c.tabId)) ? Number(c.tabId) : null, tabName: String(c.tabName || "").substring(0, 100),
          col: /^[A-Za-z]{1,2}$/.test(str_(c.col)) ? str_(c.col).toUpperCase() : "D", idCol: /^[A-Za-z]{1,2}$/.test(str_(c.idCol)) ? str_(c.idCol).toUpperCase() : "" }; })(),
      verify: { on: !!(s.roster && s.roster.verify && s.roster.verify.on), tab: String((s.roster && s.roster.verify && s.roster.verify.tab) || "").substring(0, 100),
        tabId: s.roster && s.roster.verify && s.roster.verify.tabId != null && isFinite(Number(s.roster.verify.tabId)) ? Number(s.roster.verify.tabId) : null,
        url: clip_(str_(s.roster && s.roster.verify && s.roster.verify.url), 300) }, requireId: !(s.roster && s.roster.requireId === false),
      exclude: s.roster && s.roster.exclude !== undefined ? clip_(str_(s.roster.exclude), 500) : ROSTER_EXCLUDE_DEFAULT },
    hours: { weekStart: s.hours && Number(s.hours.weekStart) === 0 ? 0 : 1, board: !!(s.hours && s.hours.board),
      webhookId: str_(s.hours && s.hours.webhookId), title: clip_(str_(s.hours && s.hours.title), 120) }
  };
  out.settings.promo = cleanPromo_(s.promo);
  out.settings.programs = cleanPrograms_(s.programs);
  out.settings.divisions = cleanDivisions_(s.divisions, Array.isArray(c.forms) ? c.forms : []);
  if (out.settings.hours.board && !out.settings.hours.webhookId) throw new Error("Weekly hours board: pick which webhook it posts to (or turn it off).");
  if (out.settings.roster.verify.on && !out.settings.roster.verify.tab.trim() && out.settings.roster.verify.tabId == null) throw new Error("Roster: pick which tab is the main personnel roster (or turn the two-way check off).");
  if (out.settings.roster.verify.url && !/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/.test(out.settings.roster.verify.url)) throw new Error("Main roster link must be a Google Sheets link.");
  if (out.settings.roster.url && !/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/.test(out.settings.roster.url)) throw new Error("Roster sheet link must be a Google Sheets link (https://docs.google.com/spreadsheets/d/...).");
  if (out.settings.heroLogo && !IMG_RE.test(out.settings.heroLogo)) throw new Error("Home page logo must be a file like img/logo.png or an https:// link.");
  c.forms.forEach(f => {
    const id = str_(f.id);
    if (!/^[a-z][a-z0-9-]{1,30}$/.test(id)) throw new Error("Form ID \"" + id + "\" must be 2-31 lowercase letters, numbers or dashes, starting with a letter.");
    if (formIds[id]) throw new Error("Two forms share the ID \"" + id + "\".");
    formIds[id] = 1;
    if (!str_(f.title)) throw new Error("Form \"" + id + "\" needs a title.");
    const keys = {};
    const key = (k, where) => {
      k = str_(k);
      if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) throw new Error(f.title + ": ID \"" + k + "\" (" + where + ") must start with a letter and use only letters, numbers or _.");
      if (keys[k]) throw new Error(f.title + ": the ID \"" + k + "\" is used twice. Every field, list and checklist needs its own ID.");
      keys[k] = 1;
      return k;
    };
    (f.blocks || []).forEach((b, bi) => {
      if (BLOCK_TYPES.indexOf(b.type) === -1) throw new Error(f.title + ": unknown block type " + b.type);
      if (b.type === "fields" || b.type === "strip") {
        const max = b.type === "fields" ? 2 : 4;
        if (!(b.fields || []).length || b.fields.length > max) throw new Error(f.title + ": block " + (bi + 1) + " must have 1-" + max + " fields.");
        b.fields.forEach(fd => {
          if (FIELD_TYPES.indexOf(fd.type) === -1) fd.type = "text";
          fd.id = key(fd.id, fd.label || "field");
          if (fd.type === "select" && !(fd.options || []).length) throw new Error(f.title + ": dropdown \"" + (fd.label || fd.id) + "\" has no options.");
          if (fd.rosterTabId != null && fd.rosterTabId !== "") { fd.rosterTabId = Number(fd.rosterTabId); if (!isFinite(fd.rosterTabId)) delete fd.rosterTabId; }
          if (fd.callCol !== undefined) { fd.callCol = /^[A-Za-z]{1,2}$/.test(str_(fd.callCol)) ? str_(fd.callCol).toUpperCase() : ""; if (!fd.callCol) delete fd.callCol; }
          if (fd.onlyCol !== undefined || fd.onlyMatch !== undefined) {
            fd.onlyCol = /^[A-Za-z]{1,2}$/.test(str_(fd.onlyCol)) ? str_(fd.onlyCol).toUpperCase() : ""; fd.onlyMatch = clip_(str_(fd.onlyMatch), 40);
            if (!fd.onlyCol || !fd.onlyMatch) { delete fd.onlyCol; delete fd.onlyMatch; }
          }
          if (fd.pairCol || fd.pairFill) {                       // "also fill <box> from roster column <J>"
            fd.pairCol = /^[A-Za-z]{1,2}$/.test(str_(fd.pairCol)) ? str_(fd.pairCol).toUpperCase() : "";
            fd.pairFill = /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(str_(fd.pairFill)) ? str_(fd.pairFill) : "";
            if (!fd.pairCol || !fd.pairFill) { delete fd.pairCol; delete fd.pairFill; }
          }
        });
      }
      if (b.type === "checklist") { b.id = key(b.id, b.title || "checklist"); b.items = (b.items || []).filter(it => str_(it.topic)); }
      if (b.type === "repeater") {
        b.id = key(b.id, b.title || "list");
        if (!(b.columns || []).length || b.columns.length > 5) throw new Error(f.title + ": list \"" + b.title + "\" needs 1-5 columns.");
        const ck = {};
        b.columns.concat(b.check && b.check.id ? [b.check] : []).forEach(col => {
          if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(str_(col.id)) || ck[col.id]) throw new Error(f.title + ": list \"" + b.title + "\" has a missing or repeated column ID.");
          if (col.rosterTabId != null && col.rosterTabId !== "") { col.rosterTabId = Number(col.rosterTabId); if (!isFinite(col.rosterTabId)) delete col.rosterTabId; }
          ck[col.id] = 1;
        });
      }
      if (b.type === "longtext") { b.id = key(b.id, b.title || "text box"); b.maxLength = Math.min(Math.max(Number(b.maxLength) || 1000, 50), 8000); }
    });
    if (f.status === "live" && !(f.blocks || []).length) throw new Error(f.title + " is set to Live but has no blocks.");
    if (f.hours && f.hours.on) {
      ["dateField", "startField", "endField"].forEach(k => { if (!keys[str_(f.hours[k])]) throw new Error(f.title + ": hours tracking needs its " + k.replace("Field", "") + " field picked."); });
      f.hours.people = (f.hours.people || []).filter(k => keys[k]);
      if (!f.hours.people.length) throw new Error(f.title + ": hours tracking needs at least one officer box to count.");
    }
    if (f.leaderboard && f.leaderboard.enabled) {
      if (!f.leaderboard.countField || !keys[f.leaderboard.countField]) throw new Error(f.title + ": pick which Discord ID field the leaderboard counts.");
    }
    f.status = ["live", "soon", "hidden"].indexOf(f.status) === -1 ? "hidden" : f.status;
    f.section = clip_(str_(f.section), 40);
    f.discordStyle = f.discordStyle === "classic" || f.discordStyle === "record" ? f.discordStyle : "";
    f.discordEmoji = !!f.discordEmoji;
    f.cidApp = !!f.cidApp;
    f.forumTagOptions = (Array.isArray(f.forumTagOptions) ? f.forumTagOptions : []).filter(t => t && /^\d{15,21}$/.test(str_(t.id)) && str_(t.label)).slice(0, 25).map(t => ({ id: str_(t.id), label: clip_(str_(t.label), 40) }));
    f.theme = /^[a-z][a-z0-9-]{1,20}$/.test(str_(f.theme)) ? str_(f.theme) : "sheet"; // any look the website offers
    f.watermark = ["cid", "custom"].indexOf(f.watermark) === -1 ? "" : f.watermark;
    if (f.watermark === "custom" && !IMG_RE.test(str_(f.watermarkUrl))) throw new Error(f.title + ": the watermark image must be a file like img/logo.png or an https:// link (no spaces or quotes).");
    f.discordThumb = str_(f.discordThumb);
    if (f.discordThumb && !/^https:\/\/[^\s"'<>]+$/.test(f.discordThumb)) throw new Error(f.title + ": the Discord logo must be an https:// image link.");
    f.logoUrl = str_(f.logoUrl);
    if (f.logoUrl && !IMG_RE.test(f.logoUrl)) throw new Error(f.title + ": the header logo must be a file like img/logo.png or an https:// link (no spaces or quotes).");
    out.forms.push(f);
  });
  return out;
}

function diffSummary_(a, b) {
  const parts = [];
  const ai = {}, bi = {};
  a.forms.forEach(f => ai[f.id] = f);
  b.forms.forEach(f => bi[f.id] = f);
  b.forms.forEach(f => { if (!ai[f.id]) parts.push("added " + f.title); else if (JSON.stringify(ai[f.id]) !== JSON.stringify(f)) parts.push("edited " + f.title); });
  a.forms.forEach(f => { if (!bi[f.id]) parts.push("deleted " + f.title); });
  if (JSON.stringify(a.settings) !== JSON.stringify(b.settings)) parts.push("portal settings");
  if (a.forms.map(f => f.id).join() !== b.forms.map(f => f.id).join() && !parts.some(p => /added|deleted/.test(p))) parts.push("reordered forms");
  return parts.join(", ") || "no changes";
}

// =====================================================================
// SHEET MENU (for the sheet owner: first admin account + emergency resets)
// =====================================================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu("🚔 LSPD Portal")
    .addItem("Create / reset admin account", "menuCreateAdmin")
    .addItem("Check webhooks", "menuCheckWebhooks")
    .addSeparator()
    .addItem("Reset forms to defaults (keeps webhooks + admins)", "menuResetForms")
    .addToUi();
}

function menuCreateAdmin() {
  const ui = SpreadsheetApp.getUi();
  const u = ui.prompt("Admin account", "Username (new, or existing to reset its password):", ui.ButtonSet.OK_CANCEL);
  if (u.getSelectedButton() !== ui.Button.OK) return;
  const p = ui.prompt("Admin account", "Password for " + u.getResponseText().trim() + " (at least 8 characters):", ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  try {
    const existing = findAdmin_(u.getResponseText());
    setAdmin_(u.getResponseText(), p.getResponseText(), existing ? existing.role : "owner");
    logAdmin_("sheet owner", existing ? "reset password (sheet menu)" : "create admin (sheet menu)", u.getResponseText().trim());
    ui.alert("✅ " + (existing ? "Password reset for " : "Owner account created: ") + u.getResponseText().trim() + "\n\nLog in at your site's /admin.html");
  } catch (e) {
    ui.alert("❌ " + errMsg_(e));
  }
}

function menuCheckWebhooks() {
  const list = maskWebhooks_();
  const lines = list.length ? list.map(w => {
    const full = webhookById_(w.id);
    const res = UrlFetchApp.fetch(full.url, { muteHttpExceptions: true });
    return (res.getResponseCode() === 200 ? "✅ " : "❌ ") + w.name + (res.getResponseCode() === 200 ? "" : " — invalid (" + res.getResponseCode() + ")");
  }) : ["No webhooks yet. Add them in admin.html > Webhooks."];
  SpreadsheetApp.getUi().alert("Webhook status\n\n" + lines.join("\n"));
}

function menuResetForms() {
  const ui = SpreadsheetApp.getUi();
  if (ui.alert("Reset forms?", "This replaces ALL forms and portal settings with the original Academy + CID versions. Submissions, webhooks and admins are kept.", ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  const cur = getConfig_();
  const cfg = defaultConfig_();
  cfg.version = Number(cur.version || 0) + 1;
  writeConfig_(cfg, "sheet owner");
  logAdmin_("sheet owner", "reset forms to defaults", "");
  ui.alert("✅ Forms reset.");
}

// =====================================================================
// DEFAULT FORMS (used the first time, and by "Reset forms to defaults")
// =====================================================================
// Charge list (all 278 criminal charges from the LSPD report builder) and vehicle colours. Edit freely in admin.html afterwards.
const CHARGES_ = [
  "Driving a boat under the influence of alcohol or drugs (Misdemeanor, 4 Months - $1,000 Fine)",
  "Violating boating safety regulations (Misdemeanor, 4 Months - $1,000 Fine)",
  "No Wake Zone (Misdemeanor, $1,750 Fine)",
  "Operating a vessel without the proper registration (Infraction, $250 Fine)",
  "Speed Limits and Reckless Operation for a vessel (Infraction, $250 Fine)",
  "Driving Without a Commercial Driver's License (Misdemeanor, 4 Months - $1,000 Fine)",
  "Failure to Submit Vehicle to Inspection (Misdemeanor, 4 Months - $2,250 Fine)",
  "Overweight Vehicle (Infraction, $250 Fine)",
  "Defective Equipment (Infraction, $250 Fine)",
  "Inadequate Safety Inspections (Infraction, $250 Fine)",
  "Failure to Maintain Logbooks (Infraction, $250 Fine)",
  "Improper Transport of Hazardous Materials (Infraction, $250 Fine)",
  "Failure to Carry Proper Documentation (Infraction, $250 Fine)",
  "Driving Without Proper Permits (Infraction, $250 Fine)",
  "Hours of Service Violation (Infraction, $250 Fine)",
  "Medical Certificate Violation (Infraction, $250 Fine)",
  "Improper Load Securement (Infraction, $250 Fine)",
  "Online Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
  "Phishing (Felony, 7 Months - $3,000 Fine)",
  "Unauthorized Access to Computer Systems (Felony, 7 Months - $3,000 Fine)",
  "Possession of Controlled Substances (Misdemeanor, 4 Months - $1,000 Fine)",
  "Public Drug Use (Misdemeanor, 4 Months - $1,000 Fine)",
  "Drug Trafficking (Felony, 15 Months - $6,000 Fine)",
  "Driving Under Drug Influence (Felony, 7 Months - $3,000 Fine)",
  "Cultivation of Illegal Drugs (Felony, 7 Months - $3,000 Fine)",
  "Drug Manufacturing (Felony, 7 Months - $3,000 Fine)",
  "Prescription Fraud (Felony, 7 Months - $3,000 Fine)",
  "Possession with Intent to Distribute (Felony, 7 Months - $3,000 Fine)",
  "Operating a Drug House (Felony, 7 Months - $3,000 Fine)",
  "Public Sale of Drugs (Felony, 7 Months - $3,000 Fine)",
  "Possession of Drug Paraphernalia (Felony, 7 Months - $3,000 Fine)",
  "Illegal Dumping (Misdemeanor, 4 Months - $1,000 Fine)",
  "Overfishing (Infraction, $250 Fine)",
  "Illegal Logging (Felony, 7 Months - $3,000 Fine)",
  "Endangered Species Trafficking (Felony, 15 Months - $6,000 Fine)",
  "Illegal Mining (Felony, 7 Months - $3,000 Fine)",
  "Poaching (Felony, 7 Months - $3,000 Fine)",
  "Careless or Reckless Aircraft Operation (Misdemeanor, 5 Months - $1,000 Fine)",
  "Operating Without a Pilot Certificate (Misdemeanor, 5 Months - $1,000 Fine)",
  "Consuming Personal Alcohol Aboard an Aircraft (Misdemeanor, 5 Months - $2,500 Fine)",
  "Boarding While Intoxicated (Misdemeanor, 5 Months - $1,500 Fine)",
  "Undeclared Hazardous Materials (Misdemeanor, 5 Months - $1,000 Fine)",
  "Falsification of FAA Records (Felony, 10 Months - $2,500 Fine)",
  "Violation of a Temporary Flight Restriction (Felony, 5 Months - $3,500 Fine)",
  "Operating an Aircraft to Facilitate Drug Trafficking (Felony, 20 Months - $5,000 Fine)",
  "Assault Aboard an Aircraft (Felony, 15 Months - $2,500 Fine)",
  "Carrying a Weapon Aboard an Aircraft (Felony, 15 Months - $5,000 Fine)",
  "Carrying an Explosive or Incendiary Device Aboard (Felony, 20 Months - $5,000 Fine)",
  "Aircraft Hijacking (Felony, 20 Months - $5,000 Fine)",
  "Criminal Transportation of Hazardous Materials (Felony, 15 Months - $2,500 Fine)",
  "Failure to Declare an Item (Misdemeanor, 5 Months - $1,000 Fine)",
  "Importing Prohibited Agricultural Items (Misdemeanor, 5 Months - $1,000 Fine)",
  "Failure to Declare a Firearm (Misdemeanor, 5 Months - $1,000 Fine)",
  "Failure to Declare Prescription Medication (Misdemeanor, 5 Months - $1,000 Fine)",
  "Improper Entry (Felony, 15 Months - $5,000 Fine)",
  "Illegal Re-entry (Felony, 20 Months - $5,000 Fine)",
  "Alien Smuggling (Felony, 15 Months - $5,000 Fine)",
  "Attempted Human Smuggling (Felony, 15 Months - $2,500 Fine)",
  "Conspiracy to Commit Human Trafficking (Felony, 15 Months - $5,000 Fine)",
  "Visa or Immigration-Document Fraud (Felony, 15 Months - $5,000 Fine)",
  "Unlawful Transportation (Felony, 15 Months - $2,500 Fine)",
  "Bringing a Person Through an Unauthorized Location (Felony, 15 Months - $3,500 Fine)",
  "Passport Forgery or False Use (Felony, 15 Months - $2,500 Fine)",
  "High-Speed Flight From an Immigration Checkpoint (Felony, 10 Months - $2,500 Fine)",
  "Forcibly Resisting or Impeding a Federal Agent (Felony, 10 Months - $500 Fine)",
  "Aggravated Assault on a Federal Agent (Felony, 15 Months - $2,000 Fine)",
  "False Statements to a Federal Agent (Felony, 5 Months - $500 Fine)",
  "Possession of Contraband at a Checkpoint (Felony, 10 Months - $1,000 Fine)",
  "Alien Smuggling Discovered at a Checkpoint (Felony, 15 Months - $2,000 Fine)",
  "False Customs Declaration (Felony, 10 Months - $2,500 Fine)",
  "Smuggling Goods Into the United States (Felony, 10 Months - $1,000 Fine)",
  "Undeclared Currency or Monetary Instruments (Felony, 15 Months - $2,000 Fine)",
  "Illegal Importation of a Firearm (Felony, 7 Months - $1,000 Fine)",
  "Firearm Smuggling (Felony, 15 Months - $5,000 Fine)",
  "Drug Smuggling Through Concealment (Felony, 20 Months - $5,000 Fine)",
  "Filing a False Police Report (Misdemeanor, 4 Months - $1,000 Fine)",
  "Resisting Arrest (Misdemeanor, 4 Months - $1,000 Fine)",
  "Failure to Appear in Court (Misdemeanor, 4 Months - $1,000 Fine)",
  "Failure to Report a Crime (Misdemeanor, 4 Months - $1,000 Fine)",
  "Providing False Identification (Misdemeanor, 4 Months - $1,000 Fine)",
  "Violation Of Probation (Misdemeanor, 4 Months - $1,000 Fine)",
  "False 911 Call (Misdemeanor, 4 Months - $1,000 Fine)",
  "Resisting Without Violence (Misdemeanor, 4 Months - $1,000 Fine)",
  "Failure to Comply (Misdemeanor, 4 Months - $1,000 Fine)",
  "Obstruction (Misdemeanor, 4 Months - $1,000 Fine)",
  "Trespassing on Government Property (Misdemeanor, 4 Months - $1,000 Fine)",
  "Criminal Threats (Misdemeanor, 4 Months - $1,000 Fine)",
  "Sightseeing at the Scene of an Emergency (Misdemeanor, 6 Months - $1,200 Fine)",
  "Unlawful Assembly (Infraction, $250 Fine)",
  "Littering (Infraction, $250 Fine)",
  "Perjury (Felony, 7 Months - $3,000 Fine)",
  "Impersonating a Police Officer (Felony, 7 Months - $3,000 Fine)",
  "Escaping Custody (Felony, 7 Months - $3,000 Fine)",
  "Aiding and Abetting (Felony, 7 Months - $3,000 Fine)",
  "Impersonating a Peace Officer (Felony, 7 Months - $3,000 Fine)",
  "Involuntary Manslaughter (Felony, 15 Months - $6,000 Fine)",
  "Marked Bills (Felony, 9 Months - $3,000 Fine)",
  "Vehicle Burglary (Felony, 7 Months - $3,000 Fine)",
  "Grave Robbery (Felony, 15 Months - $3,000 Fine)",
  "Vandalism (Misdemeanor, 3 Months - $1,000 Fine)",
  "Shoplifting (Misdemeanor, 3 Months - $1,000 Fine)",
  "Petty Theft (Misdemeanor, 3 Months - $1,000 Fine)",
  "Possession of Stolen Property (Misdemeanor, 3 Months - $1,000 Fine)",
  "Graffiti (Misdemeanor, 3 Months - $1,000 Fine)",
  "Piracy (Misdemeanor, 3 Months - $1,000 Fine)",
  "Unauthorized Use of a Vehicle (Misdemeanor, 3 Months - $1,000 Fine)",
  "Illegal Squatting (Misdemeanor, 3 Months - $1,000 Fine)",
  "Destruction of Property (Misdemeanor, 3 Months - $1,000 Fine)",
  "Trespassing (Infraction, $250 Fine)",
  "Burglary (Felony, 11 Months - $6,000 Fine)",
  "Arson (Felony, 14 Months - $10,000 Fine)",
  "Credit Card Fraud (Felony, 5 Months - $3,000 Fine)",
  "Breaking and Entering (Felony, 5 Months - $3,000 Fine)",
  "Identity Theft (Felony, 5 Months - $3,000 Fine)",
  "Theft of Public Property (Felony, 5 Months - $3,000 Fine)",
  "Extortion (Felony, 5 Months - $3,000 Fine)",
  "Attempted Robbery (Felony, 8 Months - $3,000 Fine)",
  "Disorderly Conduct (Misdemeanor, 4 Months - $1,000 Fine)",
  "Public Intoxication (Misdemeanor, 4 Months - $1,000 Fine)",
  "Indecent Exposure (Misdemeanor, 4 Months - $1,000 Fine)",
  "Criminal Mischief (Misdemeanor, 4 Months - $1,000 Fine)",
  "Harassment (Misdemeanor, 4 Months - $1,000 Fine)",
  "Aiding & Abetting (Misdemeanor) (Misdemeanor, 4 Months - $1,000 Fine)",
  "Failure to Identify (Misdemeanor, 4 Months - $1,000 Fine)",
  "Loitering (Infraction, $250 Fine)",
  "Disturbing the Peace (Infraction, $250 Fine)",
  "Illegal Protests (Infraction, $250 Fine)",
  "Rioting (Felony, 7 Months - $3,000 Fine)",
  "Bribery (Felony, 7 Months - $3,000 Fine)",
  "Inciting a Riot (Felony, 7 Months - $3,000 Fine)",
  "Illegal Immigration (Felony, 7 Months - $3,000 Fine)",
  "Reckless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
  "Driving Without a License (Misdemeanor, 4 Months - $1,000 Fine)",
  "Road Rage Incident (Misdemeanor, 4 Months - $1,000 Fine)",
  "Attempted Grand Theft Auto (Misdemeanor, 7 Months - $3,000 Fine)",
  "Leaving the Scene of a Vehicle Accident (Misdemeanor, 4 Months - $1,000 Fine)",
  "Careless Driving (Misdemeanor, 4 Months - $1,000 Fine)",
  "Operating a Vehicle with Suspended License (Misdemeanor)",
  "Driving a Motorcycle Without a Motorcycle License (Misdemeanor, $500 Fine)",
  "Speeding (Infraction, $250 Fine)",
  "Running a Red Light (Infraction, $250 Fine)",
  "Driving Without Insurance (Infraction, $250 Fine)",
  "Failure to Yield (Infraction, $250 Fine)",
  "Illegal U-Turn (Infraction, $250 Fine)",
  "Driving Without Headlights (Infraction, $250 Fine)",
  "Driving in the Wrong Direction (Infraction, $250 Fine)",
  "Illegal Parking in Handicap Zones (Infraction, $250 Fine)",
  "Excessive Window Tinting (Infraction, $250 Fine)",
  "Failure to Maintain Lanes (Infraction, $250 Fine)",
  "Unsafe Passing (Infraction, $250 Fine)",
  "Failure to Yield to an Emergency Vehicle (Infraction, $250 Fine)",
  "Obstructed License Plate (Infraction, $250 Fine)",
  "Unsafe Hauling (Infraction, $250 Fine)",
  "Parking in a Fire Zone (Infraction, $250 Fine)",
  "Failure to Yield to a Traffic Device (Infraction, $250 Fine)",
  "Improper Vehicle Safety Equipment (Infraction, $250 Fine)",
  "Operating an Unroadworthy Vehicle on a Public Roadway (Infraction, $250 Fine)",
  "Lighting Violation (Infraction, $250 Fine)",
  "Improper Parking, Stopping, or Standing (Infraction, $250 Fine)",
  "Unsafe Lane Changes (Infraction, $250 Fine)",
  "Operating a Motorcycle Without a Helmet (Infraction, $250 Fine)",
  "Impeding Traffic (Infraction, $250 Fine)",
  "Using a Handheld Device While Driving (Infraction, $250 Fine)",
  "Improper Use of Horn (Infraction, $250 Fine)",
  "Failure to Yield to Pedestrian in Crosswalk (Infraction, $250 Fine)",
  "Crossing a Double Yellow Line (Infraction, $250 Fine)",
  "Passing on the Shoulder (Infraction, $250 Fine)",
  "Towing Without a License (Infraction, $500 Fine)",
  "Move Over Law (Infraction, $250 Fine)",
  "Illegally Parked in a No Parking Zone (Infraction, $250 Fine)",
  "Failure to Pay for Parking Meter (Infraction, $250 Fine)",
  "Blocking a Driveway (Infraction, $250 Fine)",
  "Blocking a Crosswalk (Infraction, $250 Fine)",
  "Facing the Wrong Way (Infraction, $250 Fine)",
  "Bus Stop Violation (Infraction, $250 Fine)",
  "Blocking an Intersection (Infraction, $250 Fine)",
  "Parking Within 15 Feet of a Fire Station Driveway (Infraction, $250 Fine)",
  "Blocking Railroad Crossing (Infraction, $250 Fine)",
  "Parking on a Sidewalk Median or Divider (Infraction, $250 Fine)",
  "Unregistered Vehicle (Infraction, $250 Fine)",
  "Towing Without a Valid Operator's License (Infraction, $500 Fine)",
  "Failure to Signal (Infraction, $250 Fine)",
  "Failure to Yield to Pedestrians (Infraction, $250 Fine)",
  "Blocking Emergency Access Lanes (Infraction, $250 Fine)",
  "Expired Insurance (Infraction, $250 Fine)",
  "Fictitious Plate (Infraction, $250 Fine)",
  "Prohibited Underglow Lighting (Infraction, $250 Fine)",
  "Tailgating (Infraction, $250 Fine)",
  "Plate Violation (Infraction, $250 Fine)",
  "Operating a Vehicle While Using a Miscellaneous Object (Infraction, $500 Fine)",
  "Occupying a Side of the Freeway (Infraction, $250 Fine)",
  "Parking in an Alley Way (Infraction, $250 Fine)",
  "Unlawful Riding in a Vehicle (Infraction, $500 Fine)",
  "Driving Under the Influence (DUI) (Felony, 7 Months - $3,000 Fine)",
  "Hit and Run (Felony, 7 Months - $3,000 Fine)",
  "Street Racing (Felony, 7 Months - $3,000 Fine)",
  "Fleeing/Attempting to Elude (Felony, 7 Months - $3,000 Fine)",
  "Possession of a Stolen Vehicle (Felony, 7 Months - $3,000 Fine)",
  "Felony Speeding (Felony, 9 Months - $6,000 Fine)",
  "Grand Theft Auto (Felony, 7 Months - $6,000 Fine)",
  "Assault (Misdemeanor, 7 Months - $3,000 Fine)",
  "Battery (Misdemeanor, 7 Months - $3,000 Fine)",
  "Reckless Endangerment (Misdemeanor, 4 Months - $1,000 Fine)",
  "Stalking (Misdemeanor, 7 Months - $3,000 Fine)",
  "Robbery (Felony, 15 Months - $6,000 Fine)",
  "Homicide (Felony, 18 Months - $10,000 Fine)",
  "Domestic Violence (Felony, 15 Months - $6,000 Fine)",
  "Kidnapping (Felony, 18 Months - $10,000 Fine)",
  "Aggravated Assault (Felony, 18 Months - $10,000 Fine)",
  "Terroristic Threats (Felony, 7 Months - $3,000 Fine)",
  "Vehicular Manslaughter (Felony, 18 Months - $10,000 Fine)",
  "Attempted Murder of a Government Official (Felony, 18 Months - $6,000 Fine)",
  "Brandishing a Firearm in Public (Felony, 15 Months - $6,000 Fine)",
  "Assault of a Peace Officer (Felony, 15 Months - $6,000 Fine)",
  "Attempted Murder (Felony, 18 Months - $10,000 Fine)",
  "Armed Robbery (Felony, 18 Months - $9,000 Fine)",
  "Aggravated Battery (Felony, 15 Months - $6,000 Fine)",
  "Battery on a Law Enforcement Officer (Felony, 15 Months - $6,000 Fine)",
  "Second-Degree Murder (Felony, 15 Months - $6,000 Fine)",
  "Capital Murder (Felony, 15 Months - $6,000 Fine)",
  "Carjacking (Felony, 15 Months - $6,000 Fine)",
  "Solicitation to Commit Murder (Felony, 9 Months - $10,000 Fine)",
  "Obstructing Justice (Felony, 7 Months - $3,000 Fine)",
  "Possession of Assault Weapon (Felony, 7 Months - $2,250 Fine)",
  "Brandishing a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
  "Using a Weapon While Intoxicated (Misdemeanor, 7 Months - $3,000 Fine)",
  "Failure to Secure a Firearm (Misdemeanor, 7 Months - $3,000 Fine)",
  "Carrying a Loaded Firearm in Public (Misdemeanor, 7 Months - $3,000 Fine)",
  "Negligent Use of a Weapon (Misdemeanor, 7 Months - $3,000 Fine)",
  "Possession of a Firearm Without a License (Misdemeanor, 7 Months - $3,000 Fine)",
  "Failure to Report Lost/Stolen Firearm (Misdemeanor, 4 Months - $1,000 Fine)",
  "Firearm in a Restricted Zone (Misdemeanor, 4 Months - $1,000 Fine)",
  "Carrying a Concealed Weapon Without Permit (Felony, 15 Months - $6,000 Fine)",
  "Illegal Sale of Firearms (Felony, 15 Months - $6,000 Fine)",
  "Unlawful Discharge of a Firearm (Felony, 15 Months - $6,000 Fine)",
  "Possession of a Prohibited Weapon (Felony, 15 Months - $6,000 Fine)",
  "Possession of a Weapon in a Restricted Area (Felony, 15 Months - $6,000 Fine)",
  "Trafficking Illegal Firearms (Felony, 15 Months - $6,000 Fine)",
  "Modifying a Firearm Illegally (Felony, 15 Months - $6,000 Fine)",
  "Possession of a Firearm Without a Serial Number (Felony, 15 Months - $6,000 Fine)",
  "Possession of a Stolen Firearm (Felony, 15 Months - $6,000 Fine)",
  "Felon in Possession of a Firearm (Felony, 15 Months - $6,000 Fine)",
  "Open Carry (Felony, 7 Months - $3,000 Fine)",
  "Reckless Firearm Discharge (Felony, 15 Months - $6,000 Fine)",
  "Felon in Possession of Deadly Weapon (Felony, 15 Months - $6,000 Fine)",
  "Discharge of a Firearm in City Limits (Felony, 15 Months - $6,000 Fine)",
  "Unserialized (\"Ghost\") Firearm (Felony, 15 Months - $6,000 Fine)",
  "Carrying Firearm While Masked (Felony, 15 Months - $6,000 Fine)",
  "Undetectable Firearm (Felony, 15 Months - $6,000 Fine)",
  "Sale to Prohibited Person (Felony, 15 Months - $6,000 Fine)",
  "Straw Purchase of Firearm (Felony, 15 Months - $6,000 Fine)",
  "Possession of an Unregistered Firearm (Felony, 9 Months)",
  "Illegal Transfer of a Firearm (Felony, 12 Months - $6,000 Fine)",
  "Possession of Ammunition by a Felon (Felony, 9 Months - $4,000 Fine)",
  "Possession of Explosive Device(s) (Felony, 18 Months - $8,000 Fine)",
  "Carrying a Firearm While Being Underage (Felony, 9 Months - $2,000 Fine)",
  "Possession of a Weapon in Commission of a Crime (Felony, 12 Months - $6,000 Fine)",
  "Possession of an Illegal Firearm Modification (Felony, 12 Months - $1,200 Fine)",
  "Embezzlement (Felony, 11 Months - $6,000 Fine)",
  "Fraud (Felony, 5 Months - $3,000 Fine)",
  "Tax Evasion (Felony, 5 Months - $3,000 Fine)",
  "Money Laundering (Felony, 5 Months - $3,000 Fine)",
  "Insider Trading (Felony, 5 Months - $3,000 Fine)",
  "Forgery (Felony, 5 Months - $3,000 Fine)",
  "Cybercrime (Felony, 5 Months - $3,000 Fine)",
  "Healthcare Fraud (Felony, 5 Months - $3,000 Fine)",
  "Ponzi Scheme (Felony, 5 Months - $3,000 Fine)",
  "Counterfeiting (Felony, 5 Months - $3,000 Fine)",
  "Corporate Espionage (Felony, 5 Months - $3,000 Fine)",
  "Animal Abuse and Cruelty (Misdemeanor, 4 Months - $1,000 Fine)",
  "Possession of Illegally Taken Wildlife (Misdemeanor, 4 Months - $1,000 Fine)",
  "Importation of Restricted Animals (Misdemeanor, 4 Months - $1,000 Fine)",
  "Exceeding Daily Catch Limits (Misdemeanor, 4 Months - $1,000 Fine)",
  "Hunting Out of Season or in Protected Areas (Misdemeanor, 4 Months - $1,000 Fine)",
  "Sale of Illegally Taken Fish (Misdemeanor, 4 Months - $1,000 Fine)",
  "Endangered Species Violation (Misdemeanor, 4 Months - $1,000 Fine)",
  "Using Illegal Fishing Gear or Methods (Misdemeanor, 4 Months - $1,000 Fine)",
  "Hunting Without a License (Infraction, $250 Fine)"
  ];
const VEHICLE_COLORS_ = ["White", "Black", "Silver", "Gray", "Red", "Blue", "Green", "Yellow", "Orange", "Brown", "Beige", "Gold", "Purple", "Maroon"];

function defaultConfig_() {
  const items = arr => arr.map(x => ({ topic: x[0], standard: x[1] }));
  return {
    settings: {
      portalName: "LSPD",
      portalSub: "LOS SANTOS POLICE DEPT.",
      heroTag: "OFFICIAL FORMS PORTAL",
      heroText: "Select a form below to file an official record to Discord.",
      footer: "LOS SANTOS POLICE DEPARTMENT · INTERNAL USE ONLY",
      heroLogo: "img/lspd-patch.png",
      roster: { url: "", tab: "Roster", requireId: true },
      announcement: { text: "", style: "info" },
      maintenance: { on: false, message: "The forms portal is down for maintenance. Please try again shortly." }
    },
    forms: [
      {
        id: "academy", status: "live", icon: "🎓", title: "Academy Evaluation", discordStyle: "classic",
        description: "1-hour 30-minute mandatory academy training checklist and FTO sign-off.",
        submitLabel: "Submit Official Record to Discord", copyText: false,
        webhookId: "academy-forum", color: "#3498db",
        embedTitle: "🚔 LSPD Academy Evaluation Record", threadTitle: "{traineeCallsign}",
        archiveSheet: "Academy Records",
        tags: {
          base: ["1451941367843393679"],
          rules: [
            { field: "finalResult", op: "contains", value: "PASS", tag: "1441894255034630226" },
            { field: "finalResult", op: "contains", value: "FAIL", tag: "1441894292082655263" },
            { field: "finalResult", op: "contains", value: "HALF", tag: "1490237728963690496" },
            { field: "cadCheck", op: "contains", value: "Misdemeanor", tag: "1498495293719580753" },
            { field: "cadCheck", op: "contains", value: "Felony", tag: "1498495293719580753" },
            { field: "cadCheck", op: "contains", value: "Felony", tag: "1544810175238508714" }
          ]
        },
        leaderboard: {
          enabled: true, countField: "ftoDiscordId", webhookId: "leaderboard", messageId: "1545068576946397295",
          title: "LSPD Academy - Monthly Leaderboard",
          heading: "📊 **Ride Along - FTO Submission Tracker** 📊\n*Tracking total academy sign-offs for this month. Resets automatically on the 1st.*"
        },
        blocks: [
          { type: "banner", title: "LSPD - 1-HOUR 30-MINUTE MANDATORY ACADEMY TRAINING CHECKLIST", subtitle: "Streamlined Single-Session Academy: Covers CAD, Traffic Stops, Code 5, Investigation, Medical, and SOPs." },
          { type: "fields", fields: [
            { id: "traineeCallsign", label: "Trainee callsign (L-8XX | J. Doe ):", type: "text", required: true, roster: true, fillId: "traineeDiscordId" },
            { id: "traineeDiscordId", label: "Trainee Discord ID:", type: "discord_id" } ] },
          { type: "fields", fields: [
            { id: "ftoCallsign", label: "Instructor Callsign: ( L-XXX | J. Doe )", type: "text", roster: true, fillId: "ftoDiscordId" },
            { id: "ftoDiscordId", label: "Instructor Discord ID:", type: "discord_id", required: true } ] },
          { type: "strip", fields: [
            { id: "sessionName", label: "Training Session", type: "static", text: "1-Hour 30-Min Combined Academy Session" },
            { id: "dateCompleted", label: "Date Completed", type: "date", defaultToday: true },
            { id: "finalResult", label: "Final Result", type: "select", options: ["- PASSED", "- FAILED", "- Half Way Completed"] } ] },
          { type: "text", style: "heading", text: "FTO GOLDEN RULES" },
          { type: "text", style: "warning", text: "Fingerprint all Trainee and Check profile record.\n  - if felon, do not continue training. Mark on drop down and submit this form" },
          { type: "fields", fields: [
            { id: "cadCheck", label: "CAD - Trainee Name Check:", type: "select", options: ["✅ Clear - No Record", "🟡 Record - Misdemeanor only", "❌ No Go - Has Felony"] } ] },
          { type: "text", style: "rule", text: "Rule #1 (Embrace Live Chaos): Active server calls take priority. Use them as live teaching moments. Do not penalize for server unpredictability." },
          { type: "text", style: "rule", text: "Rule #2 (Keep Moving): Except during Module 1, never stay parked for more than 3 minutes. Teach while on patrol." },
          { type: "text", style: "rule", text: "Rule #3 (Action Required): Need at least 1 arrest and 1 citation." },
          { type: "checklist", id: "module1", title: "MODULE 1: SOP, USE OF FORCE & CASE LAW (20 MIN)", colTopic: "Training Topic", colStandard: "Core Requirement & Standard", colCheck: "Check-Off", items: items([
            ["Ethics & Chain of Command", "Covers Integrity, Respect, Selfless Service, and proper reporting hierarchy."],
            ["Use of Force Continuum", "Governed by Reasonableness, Necessity, Proportionality. Covers 5 Tiers: Presence, Verbalization, Empty-Hand, Less-Lethal (Taser/Beanbag), and Lethal Force (IMMEDIATE THREAT)."],
            ["California State Law Scope", "This city we enforce California Law - if it's a law in California we must follow as well."],
            ["Supreme Court Case Law", "Brief review of Terry v. Ohio (Stop & Frisk), Carroll v. Ohio (Auto Exception), Mapp v. Ohio (Exclusionary Rule), and Tennessee v. Garner (IMMEDIATE THREAT standard). Refer to DOC file for further explanation."],
            ["Bodycam & 3rd-Party Recording", "Mandatory on-duty bodycam usage (/bodycam) or mandatory 3rd-party recording software (strictly required for OIS)."]]) },
          { type: "checklist", id: "module2", title: "MODULE 2: CAD, RADIO & TRAFFIC STOPS (25 MIN)", colTopic: "Training Topic", colStandard: "Core Requirement & Standard", colCheck: "Check-Off", items: items([
            ["CAD & MDT System Mastery", "Navigating CAD tabs, running profiles, vehicles, and weapon serial numbers; filing Reports vs. Cases."],
            ["Radio Protocols & Ten-Codes", "RTO discipline, callsign formatting, 10-41/10-8, and military phonetics for plate checks."],
            ["Traffic Stops (10-11) & Radar", "Cruiser positioning (1.5-2 car lengths, 40° offset for Officer's Alleyway), safe B-post approach, Teach and avoid the Deadly Zone, and Wraith ARS 2X radar operation."],
            ["Citations & Ticketing", "Drafting and issuing citations using /citation, inventory physical handoff, unpaid fine rules (5-day doubling under Postal 388), and tag DMV registration Postal 697, 745, or 040."]]) },
          { type: "checklist", id: "module3", title: "MODULE 3: INVESTIGATION, ARREST WORKFLOW & MEDICAL (30 MIN)", colTopic: "Training Topic", colStandard: "Core Requirement & Standard", colCheck: "Check-Off", items: items([
            ["Evidence Gathering", "Using flashlights/cameras for evidence (Casing, Blood, Vehicle fragments), talk about how to do vehicle fingerprint sweeps, and serial number checks."],
            ["5-Day Felon Rule & Weapons", "Teach correctly seizing weapons tied to felonies vs. returning Civ firearms under the 5-day felon rules. If the weapon is illegal, always seized."],
            ["Complete Arrest Pipeline", "Lawful detention, probable cause, searching, cuffing, transport, booking photo, CAD Case creation, automated fees/sentences (max limits: 55 mos / $60,000 fine), state jail transfer."],
            ["Miranda & Report Writing", "Talk about when you are required to read the suspect their Miranda Rights. Talk about the LSPD Standard for report writing."],
            ["Medical Menu & Triage", "Teach how to use the medical menu. Always check for SAFR on channel 9."]]) },
          { type: "checklist", id: "module4", title: "MODULE 4: TACTICAL CODE 5 & FINAL CATCH-UP (15 MIN)", colTopic: "Training Topic", colStandard: "Core Requirement & Standard", colCheck: "Check-Off", items: items([
            ["Catch-Up & Review Block", "Finish covering any material not yet reviewed. Find a quiet place and complete all unchecked requirements."],
            ["Code 5 Formation & Roles", "Three-car felony stop formation, officer roles (C1-C4), verbal commands, and suspect prone positioning."],
            ["Pursuits & Scene Control", "10-80 / 10-70 callouts, primary/secondary radio handoffs, P.I.T. requests, and cone/flare taper layouts."]]) },
          { type: "longtext", id: "notes", title: "INSTRUCTOR PERFORMANCE NOTES & FEEDBACK", hint: "Note any areas of improvement, strengths, or remediation required below:", maxLength: 1000, required: false, followUp: false }
        ]
      },
      {
        id: "cid", status: "live", icon: "🕵️", title: "CID Report Builder",
        description: "Detective case file: involved persons, evidence log, charges, checklist and narrative.",
        submitLabel: "Submit Case Report to Discord", copyText: true,
        theme: "hud", logoUrl: "img/cid-logo.png", watermark: "custom", watermarkUrl: "img/cid-logo.png", watermarkOpacity: 11, watermarkMode: "single",
        webhookId: "cid-forum", color: "#eab308",
        embedTitle: "🕵️ LSPD CID Case Report — {cidCaseNo}", threadTitle: "{cidCaseNo} | {cidType}",
        archiveSheet: "CID Records",
        tags: { base: [], rules: [] },
        leaderboard: { enabled: false, countField: "", webhookId: "", messageId: "", title: "", heading: "" },
        blocks: [
          { type: "banner", title: "LSPD - CRIMINAL INVESTIGATION DIVISION (CID) CASE REPORT", subtitle: "Detective case file: involved persons, evidence chain, charges, investigative checklist, and narrative." },
          { type: "fields", fields: [
            { id: "cidCaseNo", label: "CID Case Number:", type: "case_number", prefix: "CID", required: true },
            { id: "cidCadNo", label: "CAD Case #:", type: "text" } ] },
          { type: "fields", fields: [
            { id: "cidLead", label: "Lead Detective:", type: "officer", required: true, fillId: "cidLeadId" },
            { id: "cidLeadId", label: "Lead Detective Discord ID:", type: "discord_id", required: true } ] },
          { type: "fields", fields: [
            { id: "cidAssist", label: "Assisting Detectives:", type: "officers" },
            { id: "cidSupervisor", label: "Supervisor Notified:", type: "text", roster: true } ] },
          { type: "strip", fields: [
            { id: "cidType", label: "Case Type", type: "select", required: true, options: ["Homicide", "Attempted Murder", "Armed Robbery", "Bank / Store Robbery", "Burglary", "Grand Theft Auto", "Narcotics", "Weapons Trafficking", "Assault / Battery", "Kidnapping", "Fraud / Forgery", "Gang Activity", "Officer-Involved Shooting", "Other"] },
            { id: "cidDate", label: "Incident Date", type: "date", defaultToday: true },
            { id: "cidLocation", label: "Location / Postal", type: "text", placeholder: "Postal 388" },
            { id: "cidStatus", label: "Case Status", type: "select", required: true, options: ["🟢 Open - Active", "🟡 Pending Warrant", "🔵 Closed - Arrest", "⚪ Closed - Cleared", "⚫ Cold Case"] } ] },
          { type: "repeater", id: "persons", title: "INVOLVED PERSONS", addLabel: "+ Add Person",
            columns: [ { id: "role", label: "Role", type: "select", options: ["Suspect", "Victim", "Witness", "Person of Interest", "Complainant"] },
                       { id: "name", label: "Name / DOB", type: "text", placeholder: "John Doe · 01/01/1990" },
                       { id: "notes", label: "Notes (State ID, ties, injuries)", type: "text" } ],
            check: { id: "profileRun", label: "Profile Run" } },
          { type: "repeater", id: "evidence", title: "EVIDENCE LOG", addLabel: "+ Add Evidence",
            columns: [ { id: "type", label: "Type", type: "select", options: ["Shell Casing", "Blood Sample", "Fingerprint", "Firearm", "Narcotics", "Vehicle / Fragment", "Bodycam / Video", "Photograph", "Document", "Other"] },
                       { id: "desc", label: "Description", type: "text" },
                       { id: "serial", label: "Serial # / Where Found", type: "text" } ],
            check: { id: "logged", label: "Logged in CAD" } },
          { type: "repeater", id: "vehicles", title: "VEHICLES INVOLVED", addLabel: "+ Add Vehicle",
            columns: [ { id: "plate", label: "Plate / Tag", type: "text", placeholder: "46EEK572" },
                       { id: "color", label: "Color", type: "select", options: VEHICLE_COLORS_ },
                       { id: "makeModel", label: "Make / Model", type: "text", placeholder: "Bravado Buffalo" } ],
            check: { id: "plateRun", label: "Plate Run" } },
          { type: "repeater", id: "charges", title: "CHARGES", addLabel: "+ Add Charge",
            groupBy: "suspect", totals: { on: true, col: "charge", countCol: "count" },
            columns: [ { id: "suspect", label: "Suspect", type: "link", source: "persons", sourceCol: "name", filterCol: "role", filterValue: "Suspect" },
                       { id: "charge", label: "Charge (type to search)", type: "search", options: CHARGES_, placeholder: "Start typing, e.g. robbery" },
                       { id: "count", label: "Counts", type: "text", placeholder: "1", width: "narrow" } ],
            check: { id: "warrant", label: "Warrant Req." } },
          { type: "checklist", id: "cidChecklist", title: "INVESTIGATIVE CHECKLIST", colTopic: "Task", colStandard: "Standard", colCheck: "Done", items: items([
            ["Scene Secured & Documented", "Perimeter set, scene photographed, bodycam running from arrival."],
            ["Evidence Collected & Logged", "Casings, blood, prints and fragments collected and entered into CAD evidence."],
            ["Prints & Serials Run", "Fingerprints run through CAD; weapon and vehicle serial numbers checked."],
            ["Statements Taken", "Victim and witness statements obtained and summarised in the narrative."],
            ["Suspect Profiles Checked", "All suspects run in CAD for priors, open warrants and the 5-day felon rule."],
            ["Footage Reviewed", "Own and assisting units' bodycam / recordings reviewed and referenced."],
            ["Warrant / Arrest Action", "Warrant requested or arrest made where probable cause exists."],
            ["Supervisor Notified", "CID supervisor briefed on case status and next steps."]]) },
          { type: "longtext", id: "cidNarrative", title: "CASE NARRATIVE", hint: "Who, what, when, where, how. Write in first person, chronological order, per the LSPD report-writing standard.", maxLength: 8000, required: true, followUp: true,
            guide: {
              on: true,
              steps: [
                { label: "Call / Dispatch", help: "How did you get involved? When, where, and who sent you?", starter: "On {cidDate} at approximately [time] hours, I [was dispatched / responded] to {cidLocation} regarding a reported {cidType}." },
                { label: "Arrival", help: "What did you see, hear and smell when you arrived? Who was there?", starter: "Upon arrival, I observed [describe the scene, the people present and anything out of place]." },
                { label: "Contacts & statements", help: "Who did you speak to and what did they tell you? Quote key words exactly.", starter: "I made contact with {persons.name?role=Victim}, who stated \"[their words]\"." },
                { label: "Investigation", help: "What did you do to find out what happened? CAD checks, prints, serials, footage, canvassing.", starter: "During my investigation, I [ran / checked / reviewed] [what you did], which showed [what you found]." },
                { label: "Evidence", help: "What did you collect, where exactly was it found, and was it logged in CAD?", starter: "I located [evidence] at [where it was found]. I collected it and logged it into CAD evidence." },
                { label: "Suspect & arrest", help: "How was the suspect identified? What was your probable cause? When was Miranda read?", starter: "I identified {persons.name?role=Suspect} as the suspect(s) based on [probable cause]. I placed {persons.name?role=Suspect} under arrest at approximately [time] hours and read Miranda rights at [time] hours." },
                { label: "Outcome", help: "How did it end? Transport, booking, and what is still open.", starter: "{persons.name?role=Suspect} was transported to [location] and booked. This case remains [open / closed] pending [next steps]." }
              ],
              tips: [
                "Write in first person and past tense: \"I observed\", not \"Officer observed\" or \"I observe\".",
                "Tell it in the order it happened, with times (e.g. 2315 hours).",
                "Stick to facts you saw, heard, or were told. Leave out opinions like \"he looked guilty\".",
                "Quote important statements word for word in \"quotation marks\".",
                "Say how you know each fact: \"I saw\", \"the victim stated\", \"CAD showed\".",
                "Explain your probable cause for every stop, search and arrest.",
                "Note when Miranda rights were read if anyone was questioned in custody.",
                "Re-read it once: would someone who wasn't there understand exactly what happened?"
              ],
              mention: [
                { label: "Names every suspect", ref: "{persons.name?role=Suspect}" },
                { label: "Mentions the location", ref: "{cidLocation}" }
              ],
              keywords: [
                { label: "Probable cause explained", words: ["probable cause", "based on", "because"] },
                { label: "Miranda noted", words: ["miranda"] }
              ]
            } },
          { type: "longtext", id: "cidFollowup", title: "FOLLOW-UP / NEXT STEPS", hint: "Outstanding leads, pending warrants, evidence awaiting results, who owns the next action.", maxLength: 1000, required: false, followUp: false }
        ]
      },
      { id: "ridealong", status: "soon", icon: "🚓", title: "Ride-Along Report", description: "Coming soon.", webhookId: "", color: "#3498db", tags: { base: [], rules: [] }, leaderboard: { enabled: false }, blocks: [] },
      { id: "incident", status: "soon", icon: "📋", title: "Incident Report", description: "Coming soon.", webhookId: "", color: "#3498db", tags: { base: [], rules: [] }, leaderboard: { enabled: false }, blocks: [] },
      { id: "arrest", status: "soon", icon: "🚨", title: "Arrest Report", description: "Coming soon.", webhookId: "", color: "#3498db", tags: { base: [], rules: [] }, leaderboard: { enabled: false }, blocks: [] },
      { id: "citation", status: "soon", icon: "🧾", title: "Citation Log", description: "Coming soon.", webhookId: "", color: "#3498db", tags: { base: [], rules: [] }, leaderboard: { enabled: false }, blocks: [] },
      { id: "discipline", status: "soon", icon: "⚖️", title: "Commendation / Discipline", description: "Coming soon.", webhookId: "", color: "#3498db", tags: { base: [], rules: [] }, leaderboard: { enabled: false }, blocks: [] }
    ]
  };
}
