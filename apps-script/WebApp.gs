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
 *   - Duty sessions from the On Duty role  -> "Duty Log" tab (sign-ins for it: Script Properties)
 *
 * FIRST ADMIN: open the Google Sheet, menu "🚔 LSPD Portal" > "Create / reset admin account".
 * Webhook URLs never belong in this file (it is stored on GitHub).
 */

// Bump when the website needs something new from this file. admin.html warns if this is behind.
const BACKEND_VERSION = 91;

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
    if (action === "signon") return json_({ ok: true, signon: signonCfg_() });
    if (action === "builderRoster") return json_(PROPS_.getProperty("BUILDER_ON") === "1" ? { ok: true, people: builderPeople_().map(p => ({ n: p.n, cs: p.cs })) } : { ok: false });   // tiny: is the sign-on screen the front door?
    if (action === "promo") return json_({ ok: true, promo: promoView_(false, e.parameter.p) });
    if (action === "wake") { try { getAdmins_(); getConfig_(); readLog_(1); } catch (x) {} return json_({ ok: true }); }   // admin sign-in page: get Google ready while they type
    return json_({ ok: true, service: "LSPD Forms Portal" });
  } catch (err) {
    return json_({ ok: false, error: errMsg_(err) });
  }
}

// Only actions that change saved data wait in line; reading, logging in and Discord posting run side by side.
const WRITE_ACTIONS_ = { saveConfig: 1, webhookSave: 1, webhookDelete: 1, adminAdd: 1, adminReset: 1, adminRole: 1, adminRemove: 1, changePassword: 1, leaderboardRefresh: 1, hoursRefresh: 1, promoCredit: 1, promoRemove: 1, promoExcuse: 1, promoSince: 1, cidSetPassword: 1 };

// request timing: slow requests (over 8 s) are written to the "Slow Requests" tab with where the time went
var T0_ = 0, MARKS_ = [];
function mark_(label) { if (T0_) MARKS_.push(label + " " + (Date.now() - T0_) + "ms"); }
function slowLog_(action, ms) {
  if (ms < 8000) return;
  try { const ss = ss_(); let sh = ss.getSheetByName("Slow Requests"); if (!sh) { sh = ss.insertSheet("Slow Requests"); sh.appendRow(["When", "Action", "Seconds", "Steps"]); sh.setFrozenRows(1); }
    if (sh.getLastRow() > 400) sh.deleteRows(2, 100);
    sh.appendRow([new Date(), action, Math.round(ms / 100) / 10, MARKS_.join(" · ")]); } catch (e) {}
}
function doPost(e) {
  ACCT_MEMO_ = null; ACT_MEMO_ = null; T0_ = Date.now(); MARKS_ = [];
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "Bad request." }); }
  try {
    if (d.action) {
      const out = WRITE_ACTIONS_[d.action] ? withLock_(() => handleAdmin_(d)) : handleAdmin_(d);
      if (out && out.ok && /^promo(Credit|Remove|Excuse|Since)$/.test(d.action)) snapshotSoon_();
      const ms = Date.now() - T0_; slowLog_(d.action, ms);
      if (out && /^acct|officerHome/.test(d.action)) { out._ms = ms; if (MARKS_.length) out._steps = MARKS_; }
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
  mark_("lock?"); if (!lock.tryLock(45000)) return { ok: false, error: "Server busy, please try again in a few seconds." }; mark_("lock");
  ACCT_MEMO_ = null; ACT_MEMO_ = null;
  try { try { flushDeferred_(); } catch (e) {} return fn(); } finally { ACCT_MEMO_ = null; ACT_MEMO_ = null; lock.releaseLock(); }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function errMsg_(err) { return String((err && err.message) || err); }
// the portal's own spreadsheet. A roster-change trigger runs with the ROSTER as its "active" spreadsheet, so the
// portal sheet's ID is remembered and used whenever the active one is a different file.
var SS_MEMO_ = null;
function ss_() {
  if (SS_MEMO_) return SS_MEMO_;
  const a = SpreadsheetApp.getActiveSpreadsheet(), want = PROPS_.getProperty("PORTAL_SS_ID");
  if (want && (!a || a.getId() !== want)) return (SS_MEMO_ = SpreadsheetApp.openById(want));
  if (!want && a && a.getSheetByName(CONFIG_SHEET_)) PROPS_.setProperty("PORTAL_SS_ID", a.getId());
  return (SS_MEMO_ = a);
}
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
  if (!cfg && !sh && PROPS_.getProperty("PORTAL_SS_ID") && ss_().getId() !== PROPS_.getProperty("PORTAL_SS_ID")) throw new Error("Portal sheet not found.");
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
// Every 10 minutes (and after roster edits): load the rosters and pages officers need, so nobody waits on the sheet.
// Runs in steps, most important first, and stops itself before Google's 6-minute limit. Each step's time is
// printed to the run's log (Apps Script -> Executions) and saved, so a slow step is easy to spot.
const WARM_BUDGET_MS_ = 4.5 * 60000;
function warmRosters(opts) {
  opts = opts || {};
  const t0 = Date.now(), done = [], budget = opts.budget || WARM_BUDGET_MS_;
  let cfg = null, stopped = "";
  const step = (name, fn) => {
    if (stopped) return;
    if (Date.now() - t0 > budget) { stopped = name; console.log("warm: out of time before " + name); return; }
    const a = Date.now(); console.log("warm: " + name + " ...");
    let err = ""; try { fn(); } catch (e) { err = errMsg_(e); }
    const ms = Date.now() - a; done.push(name + " " + Math.round(ms / 100) / 10 + "s" + (err ? " (error: " + clip_(err, 80) + ")" : ""));
    console.log("warm: " + name + " " + ms + "ms" + (err ? " ERROR " + err : ""));
    try { PROPS_.setProperty("WARM_LAST", JSON.stringify({ at: t0, running: true, steps: done })); } catch (e) {}
  };
  step("settings", () => { flushDeferred_(); cfg = getConfig_(); });
  if (!cfg) return;
  step("callsigns", () => callsignMap_(true));
  // sign-in: the Personnel / Onboarding tabs (with the rank column) are ready before anyone signs on
  step("sign-in rosters", () => [PERSONNEL_TAB_, ONBOARD_TAB_].forEach(t => { const tid = rosterTabByName_(t); if (tid != null) getRosterTab_(tid, true, [RANK_COL_], false, true); }));
  // division-only reports: who's on each division roster (sign-in and the report list check this)
  step("division access", () => { const accTabs = {}; cfg.forms.forEach(f => (f.accessTabs || []).forEach(t => accTabs[t.id] = 1)); Object.keys(accTabs).forEach(id => tabIds_(Number(id), true)); });
  // division race on the MDT home: division rosters + standings
  const divs = (cfg.settings || {}).divisions || [];
  if (divs.length) {
    step("division rosters", () => divs.forEach(dv => { if (dv.rosterTabId != null) getRosterTab_(dv.rosterTabId, true, [], false, false); }));
    step("race standings", () => { const ck = "div_hq_" + divs.map(x => x.id).join(",").slice(0, 200); CacheService.getScriptCache().remove(ck + "_n"); divOverview_(null, { username: "", role: "officer", key: "warm" }, true); });
  }
  step("form rosters", () => rostersFor_(cfg.forms, { fresh: true }));
  // promotion tracker: rank + time-in-grade columns, everyone's report counts
  step("promotion roster", () => { const tid = rosterTabByName_(PERSONNEL_TAB_); if (tid != null) getRosterTab_(tid, true, [RANK_COL_, TIG_COL_], false, true); promoPeople_(true); });
  step("report builder", () => { CacheService.getScriptCache().remove("builder_people"); builderPeople_(); });
  step("old roster", () => { if (usesOldRoster_(cfg.forms)) getRoster_(true); });
  if (!opts.quick) {
    step("progression", () => { programs_(cfg).forEach(p => { if (p.on) promoCandidates_(true, p.id); }); promoSync_(); promoClearCache_(); programs_(cfg).forEach(p => { if (p.on) promoView_(false, p.id); }); });
    step("website copy", () => publishSnapshot_());           // copy on the website itself (only when something changed)
  }
  const total = Date.now() - t0;
  console.log("warm: finished in " + total + "ms" + (stopped ? ", stopped before " + stopped : ""));
  try { PROPS_.setProperty("WARM_LAST", JSON.stringify({ at: t0, ms: total, stopped: stopped, steps: done })); } catch (e) {}
}
// RUN THIS ONCE FROM THE APPS SCRIPT EDITOR after pasting a new version (pick "authorizeAll" next to Run, press Run, Allow).
// Google asks for any permission the new code needs, then the background timers are (re)installed:
// roster warm-up every 10 minutes, roster edits, and the On Duty check every 15 minutes when it's turned on.
function authorizeAll() {
  // Google's permission screen has a checkbox per permission: this asks for ALL of them (tick "Select all" and Allow)
  try { ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL); } catch (e) {}
  const a = SpreadsheetApp.getActiveSpreadsheet(); if (a && a.getSheetByName(CONFIG_SHEET_)) PROPS_.setProperty("PORTAL_SS_ID", a.getId());
  ScriptApp.getProjectTriggers(); UrlFetchApp.getRequest("https://discord.com/api/v10/gateway"); ss_().getName(); rosterBook_().getName();
  const doc = promoDocId_(promoDocUrl_()); if (doc) DocumentApp.openById(doc).getName();     // Promotion Guidelines doc (Docs permission)
  try { promoReqParse_(true); } catch (e) {}                                                  // reload the promotion requirements now
  CacheService.getScriptCache().remove("warm_trigger_ok"); ensureWarmTrigger_();
  try { dutyTrigger_(dutyCfg_().on); } catch (e) {}
  try { warmRosters({ budget: 3 * 60000 }); } catch (e) {}
  const t = ScriptApp.getProjectTriggers().map(x => x.getHandlerFunction());
  Logger.log("Permissions OK. Background timers: " + t.join(", "));
  return t;
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
  if (!PROPS_.getProperty("PORTAL_SS_ID")) return;                // never touch the roster file as if it were the portal sheet
  const c = CacheService.getScriptCache();
  if (c.get("roster_busy")) { c.put("roster_pending", "1", 300); return; }   // a refresh is already running: run once more after it
  c.put("roster_busy", "1", 300);
  try {
    for (let i = 0; i < 2; i++) { c.remove("roster_pending"); warmRosters({ quick: true, budget: 2 * 60000 }); if (!c.get("roster_pending")) break; }
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
  const checkHidden = shown.length - hr <= 400;      // hidden rows = left the department (skipped on very long tabs)
  const hiddenRows = checkHidden ? hiddenRowsOf_(sh, shown.length) : {};
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
      !!hiddenRows[i];
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
// which rows of a tab are hidden ({ rowIndex0: 1 }). One request to the Sheets API for the whole tab; asking
// SpreadsheetApp row by row took two calls per row (minutes on a big roster). Falls back to row-by-row, capped at 20 s.
function hiddenRowsOf_(sh, n) {
  const out = {};
  try {
    const id = sh.getParent().getId(), rng = "'" + sh.getName().replace(/'/g, "''") + "'!A1:A" + n;
    const r = UrlFetchApp.fetch("https://sheets.googleapis.com/v4/spreadsheets/" + id + "?ranges=" + encodeURIComponent(rng) + "&fields=" + encodeURIComponent("sheets(data(rowMetadata(hiddenByUser,hiddenByFilter)))"),
      { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (r.getResponseCode() === 200) {
      const md = ((((JSON.parse(r.getContentText()).sheets || [])[0] || {}).data || [])[0] || {}).rowMetadata || [];
      md.forEach((m, i) => { if (m && (m.hiddenByUser || m.hiddenByFilter)) out[i] = 1; });
      return out;
    }
    console.log("hidden rows: Sheets API answered " + r.getResponseCode() + " " + clip_(r.getContentText(), 200));
  } catch (e) { console.log("hidden rows: " + errMsg_(e)); }
  const t0 = Date.now(); let filter = true; try { filter = !!sh.getFilter(); } catch (e) {}
  for (let i = 1; i < n; i++) { if (Date.now() - t0 > 20000) { console.log("hidden rows: row-by-row check stopped at row " + i + " of " + sh.getName()); break; }
    if (sh.isRowHiddenByUser(i + 1) || (filter && sh.isRowHiddenByFilter(i + 1))) out[i] = 1; }
  return out;
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
function whenOn_(b, values) { return !b || !b.when || !b.when.field || (b.when.is || []).map(str_).indexOf(str_(values[b.when.field])) !== -1; }
function handleSubmit_(d) {
  const cfg = getConfig_();
  const m = cfg.settings && cfg.settings.maintenance;
  if (m && m.on) return { ok: false, error: m.message || "The portal is in maintenance. Try again later." };

  let form = cfg.forms.find(f => f.id === (d.form || "academy"));
  if (!form || form.status !== "live") return { ok: false, error: "This form is not accepting submissions right now." };
  if (form.minLevel || (form.accessTabs || []).length) {   // restricted forms: the officer's sign-on decides
    const acct = officerSession_(d.session), lv = acct ? acctProfile_(acct).level : "";
    if (!acct) return { ok: false, error: "Sign on to the MDT to file this report." };
    if (form.minLevel && LEVELS_.indexOf(lv) < LEVELS_.indexOf(form.minLevel)) return { ok: false, error: "This report is for " + LEVEL_NAMES_[form.minLevel] + " and up." };
    if (!formAllowed_(form, acct, acctProfile_(acct))) return { ok: false, error: "This report is only for " + form.accessTabs.map(t => t.name).join(" / ") + " members." };
  }

  const values = d.values || d;                 // (d itself = old-style flat payload)
  const checklists = d.checklists || {};
  const repeaters = d.repeaters || {};
  // sections that only apply to some report types ("when": { field, is: [...] }): leave out the ones that don't apply
  if ((form.blocks || []).some(b => b.when && b.when.field)) form = Object.assign({}, form, { blocks: form.blocks.filter(b => whenOn_(b, values)) });

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
  const cidX = d.cid && isCidApp_(form) ? cidPrep_(form, d.cid) : null;            // the stand-alone CID case builder page
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
const LEADER_ACTIONS_ = { logout: 1, getAll: 1, divView: 1, divOverview: 1, hqPost: 1, hqAck: 1, hqReply: 1, hqDelete: 1, hqGoal: 1, divGrade: 1, divReport: 1, changePassword: 1 };
const GRADES_ = ["A", "B", "C", "D", "F", "R"];   // R = returned to the officer for correction
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
  try { CacheService.getScriptCache().remove("promo_people"); } catch (e) {} ACT_MEMO_ = null;
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
// the report log. Lists only need the first 16 columns; the full report text and data (the big cells) are read
// only when a report is opened (full = true). Read once per request.
var ACT_MEMO_ = null;
function actRows_(full) {
  if (ACT_MEMO_ && (ACT_MEMO_.full || !full)) return ACT_MEMO_.rows;
  const sh = actSheet_(), n = sh.getLastRow(), w = full ? Math.max(sh.getLastColumn(), 18) : 16;
  const v = n < 2 ? [] : sh.getRange(1, 1, n, w).getValues(), out = [];
  for (let i = 1; i < v.length; i++) { const r = v[i]; if (!str_(r[0])) continue;
    let people = []; try { people = JSON.parse(str_(r[5]) || "[]"); } catch (e) {}
    out.push({ row: i + 1, id: str_(r[0]), at: isDate_(r[1]) ? r[1].getTime() : new Date(r[1]).getTime() || 0, form: str_(r[2]), no: str_(r[3]), title: str_(r[4]), people: people, summary: str_(r[6]),
      threadId: str_(r[7]).replace(/^'/, ""), messageId: str_(r[8]).replace(/^'/, ""), webhookId: str_(r[9]), content: str_(r[10]),
      grade: str_(r[11]), gradedBy: str_(r[12]), comments: str_(r[13]), gradedAt: isDate_(r[14]) ? r[14].getTime() : 0, source: str_(r[15]), report: str_(r[16] || ""), data: str_(r[17] || "") }); }
  ACT_MEMO_ = { full: !!full, rows: out };
  return out;
}
// Everything the Division Command page shows for one division: its officers + every report from its forms.
// Stats, leaderboard, quotas and alerts are worked out in the browser from this.
// roster names: "L-404 | 1T-03 | N. James" -> callsign L-404, division (unit) callsign 1T-03, name N. James
const CS_SEG_ = /^(?=[^.]*\d)[A-Za-z0-9]{1,5}(?:\s*-\s*|\s)?[A-Za-z0-9]{0,5}$/;
function rosterName_(raw) {
  const name = str_(raw);
  if (name.indexOf("|") === -1) { const cs = callKey_(name) ? (/\b[A-Za-z]{1,4}\s*-?\s*\d{1,5}\b/.exec(name) || [""])[0] : ""; return { cs: cs, unit: "", n: name.replace(cs, "").trim() || name }; }
  const seg = name.split("|").map(x => x.trim()); let i = 0; const css = [];
  while (i < seg.length - 1 && CS_SEG_.test(seg[i])) css.push(seg[i++]);
  if (!css.length) css.push(seg[i++]);   // old rule: the first part is the callsign
  return { cs: css[0] || "", unit: css[1] || "", n: seg.slice(i).join(" | ") };
}
// an open spot on a roster: no Discord ID and no officer name (just a unit callsign, "VACANT", "—"…)
function rosterVacant_(p) {
  if (p.id) return false;
  const n = rosterName_(p.name).n.replace(/[()\[\]]/g, "").trim();
  return !n || CS_SEG_.test(n) || /^(vacant|open|opening|available|n\/?a|tbd|tba|none|empty|unassigned|reserved|-+|—+|\.+|x+)$/i.test(n) || (n === p.name.trim() && CS_SEG_.test(n));
}
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
      officers = (t.people || []).filter(p => !rosterVacant_(p)).map(p => { const rp = rosterName_(p.name), cs = rp.cs, nm = rp.n;
        const more = p.more || {}, unit = (dv.unitCol ? str_(more[dv.unitCol]) : "") || rp.unit, rank = (dv.positionCol ? str_(more[dv.positionCol]) : "") || p.extra || "";
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
// Discord profile pictures (saved when an officer signs in with Discord)
function avatarUrl_(id, hash) { return id && hash ? "https://cdn.discordapp.com/avatars/" + id + "/" + hash + ".png?size=128" : ""; }
function avMap_() { const m = {}; try { acctAll_().forEach(a => { if (a.avatar) m[a.id] = avatarUrl_(a.id, a.avatar); }); } catch (e) {} return m; }
// the race week closes Sunday 8 PM (no late-night pressure) and the next one starts right then
function raceWeek_() {
  const cfg = getConfig_(), ws = (cfg.settings.hours && cfg.settings.hours.weekStart != null) ? cfg.settings.hours.weekStart : 1;
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() - ws + 7) % 7));
  let W = d.getTime() - 4 * 3600e3; if (Date.now() >= W + 7 * 864e5) W += 7 * 864e5;
  return W;
}
// ---- Command Center: every division side by side, and the division race (points) ----
// Points: report filed 10 · officer assisted 4 · graded A +5 / B +3 / C +1 · every active officer +5
const RACE_PTS_ = { report: 10, assist: 4, A: 5, B: 3, C: 1, active: 5, capReports: 3, capAssists: 6 };   // per officer, per day
function divOverview_(allowed, me, bare) {
  const cfg = getConfig_(), divs = ((cfg.settings || {}).divisions || []).filter(x => !allowed || allowed.indexOf(x.id) !== -1);
  const cache = CacheService.getScriptCache(), ck = "div_hq_" + divs.map(x => x.id).join(",").slice(0, 200);
  const hit = bigGet_(ck); if (hit) { try { const o = Object.assign(JSON.parse(hit), { me: me, cached: true }); return bare ? o : hqExtras_(o, me, allowed); } catch (e) {} }
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const W = raceWeek_(), LW = W - 7 * 864e5, M = new Date(d0.getFullYear(), d0.getMonth(), 1).getTime(), LM = new Date(d0.getFullYear(), d0.getMonth() - 1, 1).getTime();
  const formsById = {}; cfg.forms.forEach(f => formsById[f.id] = f);
  const rows = actRows_().filter(r => r.at >= Math.min(LW, LM));
  const people = {};   // key -> { name, callsign, div, pts }
  const out = divs.map(dv => {
    let roster = [];
    if (dv.rosterTabId != null) { try { roster = (getRosterTab_(dv.rosterTabId, false, [], false, false).people || []).filter(p => !rosterVacant_(p)).map(p => { const rp = rosterName_(p.name); return { id: p.id, cs: rp.cs, unit: rp.unit, n: rp.n }; }); } catch (e) {} }
    const find = p => (p.i && roster.find(o => o.id === p.i)) || (callKey_(p.n) && roster.find(o => o.cs && callKey_(o.cs) === callKey_(p.n))) || (nameKey_(p.n) && roster.find(o => nameKey_(o.n) === nameKey_(cleanName_(p.n.indexOf("|") !== -1 ? p.n.split("|").slice(1).join("|") : p.n)))) || null;
    const fset = {}; (dv.forms || []).forEach(f => { const form = formsById[f.id]; if (!form) return; const slots = personSlots_(form); fset[f.id] = f.author && slots.some(x => x.key === f.author) ? f.author : autoAuthor_(form); });
    const mine = rows.filter(r => fset[r.form] !== undefined);
    const per = (from, to) => {
      const list = mine.filter(r => r.at >= from && r.at < to).slice().sort((a, b) => a.at - b.at), act = {}, ppl = {}, cap = {};
      let assists = 0, bonus = 0, graded = 0, gsum = 0, capped = 0;
      list.forEach(r => {
        const day = new Date(r.at).toDateString();
        const au = r.people.find(p => p.f === fset[r.form]);
        (r.people || []).forEach(p => { const isAu = p === au;
          const o = find(p) || (p.i || p.n ? { id: p.i || "", cs: p.n.indexOf("|") !== -1 ? p.n.split("|")[0].trim() : "", n: cleanName_((p.n.indexOf("|") !== -1 ? p.n.split("|").slice(1).join("|") : p.n).replace(/\s*\(\d{15,21}\)/, "").trim()) || "ID " + p.i } : null);
          const k = o ? "R:" + (o.id || o.cs || nameKey_(o.n)) : "";
          if (!isAu) assists++;
          if (o) { act[k] = 1; const pk = (o.id || o.cs || nameKey_(o.n)); ppl[pk] = ppl[pk] || { name: cleanName_(o.n), callsign: o.cs, id: o.id || "", pts: 0, reports: 0 };
            const ck2 = pk + "|" + day + "|" + (isAu ? "r" : "a"); cap[ck2] = (cap[ck2] || 0) + 1;
            if (isAu) ppl[pk].reports++;
            if (cap[ck2] <= (isAu ? RACE_PTS_.capReports : RACE_PTS_.capAssists)) { const g = isAu ? RACE_PTS_.report + (RACE_PTS_[r.grade] || 0) : RACE_PTS_.assist; ppl[pk].pts += g; capped += g; } } });
        if (r.grade && "ABCDF".indexOf(r.grade) !== -1) { graded++; gsum += { A: 4, B: 3, C: 2, D: 1, F: 0 }[r.grade]; bonus += RACE_PTS_[r.grade] || 0; }
      });
      const active = Object.keys(act).length;
      return { reports: list.length, assists: assists, active: active, graded: graded, avg: graded ? gsum / graded : null, awaiting: list.filter(r => !r.grade).length,
        points: capped + active * RACE_PTS_.active, people: ppl };
    };
    const wk = per(W, Infinity), lwk = per(LW, W), mo = per(M, Infinity), lmo = per(LM, M);
    Object.keys(wk.people).forEach(k => { const x = wk.people[k]; const pk = k + "|" + dv.id; people[pk] = Object.assign({ div: dv.id }, x); });
    const top = Object.keys(wk.people).map(k => wk.people[k]).sort((a, b) => b.pts - a.pts)[0] || null;
    const days = []; for (let i = 6; i >= 0; i--) { const a = d0.getTime() - i * 864e5; days.push(mine.filter(r => r.at >= a && r.at < a + 864e5).length); }
    let streak = 0; for (let i = days[6] ? 0 : 1; i < 60; i++) { const a = d0.getTime() - i * 864e5; if (mine.some(r => r.at >= a && r.at < a + 864e5)) streak++; else break; }
    const h24 = per(Date.now() - 864e5, Infinity).points;
    const ptsById = {}; Object.keys(wk.people).forEach(k => { const x = wk.people[k]; if (x.id) ptsById[x.id] = { pts: x.pts, reports: x.reports }; });
    const strip = x => { const o = Object.assign({}, x); delete o.people; return o; };
    return { id: dv.id, name: dv.name, color: dv.color || "#2f7bff", logoUrl: dv.logoUrl || "", tagline: dv.tagline || "", roster: roster.length,
      week: strip(wk), lastWeek: strip(lwk), month: strip(mo), lastMonth: strip(lmo), days: days, top: top, last: mine.length ? Math.max.apply(null, mine.map(r => r.at)) : 0,
      today: days[6], streak: streak, h24: h24, ptsById: ptsById };
  });
  const feed = rows.filter(r => out.some(dv => (divs.find(x => x.id === dv.id).forms || []).some(f => f.id === r.form))).sort((a, b) => b.at - a.at).slice(0, 10).map(r => {
    const dv = divs.find(x => (x.forms || []).some(f => f.id === r.form)), au = (r.people || [])[0];
    return { at: r.at, div: dv ? dv.id : "", title: r.title || r.no || (formsById[r.form] || {}).title || r.form, form: (formsById[r.form] || {}).title || r.form, icon: (formsById[r.form] || {}).icon || "📄", by: au ? cleanName_(au.n).replace(/\s*\(\d{15,21}\)/, "") : "", grade: r.grade };
  });
  const mvp = Object.keys(people).map(k => people[k]).sort((a, b) => b.pts - a.pts)[0] || null;
  // seasons: every finished month's champion (last 6 months)
  const seasons = [], all = actRows_();
  for (let i = 1; i <= 6; i++) {
    const a = new Date(d0.getFullYear(), d0.getMonth() - i, 1).getTime(), b = new Date(d0.getFullYear(), d0.getMonth() - i + 1, 1).getTime();
    const st = divs.map(dv => { const fs = {}; (dv.forms || []).forEach(f => fs[f.id] = 1); const list = all.filter(r => fs[r.form] && r.at >= a && r.at < b);
      const act = {}; let assists = 0, bonus = 0; list.forEach(r => { (r.people || []).forEach((p, pi) => { act[p.i || nameKey_(p.n)] = 1; if (pi) assists++; }); bonus += RACE_PTS_[r.grade] || 0; });
      return { id: dv.id, points: list.length * RACE_PTS_.report + assists * RACE_PTS_.assist + bonus + Object.keys(act).length * RACE_PTS_.active }; }).sort((x, y) => y.points - x.points);
    if (st[0] && st[0].points) seasons.push({ month: a, champ: st[0].id, points: st[0].points, runner: st[1] && st[1].points ? st[1].id : "" });
  }
  out.forEach(dv => { dv.trophies = seasons.filter(x => x.champ === dv.id).length; });
  const av = avMap_(); out.forEach(dv => { if (dv.top && dv.top.id) dv.top.avatar = av[dv.top.id] || ""; }); if (mvp && mvp.id) mvp.avatar = av[mvp.id] || "";
  const hot = out.slice().sort((a, b) => b.h24 - a.h24)[0], imp = out.map(dv => ({ id: dv.id, d: dv.week.points - dv.lastWeek.points })).sort((a, b) => b.d - a.d)[0];
  const res = { ok: true, hq: true, divisions: out, feed: feed, mvp: mvp, seasons: seasons, points: RACE_PTS_, weekStart: W, weekEnd: W + 7 * 864e5, monthStart: M, at: Date.now(),
    hot: hot && hot.h24 > 0 ? hot.id : "", improved: imp && imp.d > 0 && out.length > 1 ? { id: imp.id, by: imp.d } : null };
  try { const js = JSON.stringify(res); bigPut_(ck, js, 120); bigPut_(ck + "_last", js, 21600); } catch (e) {}   // 2 min fresh; the last good copy is kept 6 h for the MDT
  res.me = me;
  return hqExtras_(res, me, allowed);
}
// ---- Leader bulletin board + weekly division goals (Command Center) ----
const HQB_SHEET_ = "Leader Board", HQB_HEAD_ = ["ID", "Posted", "From", "From key", "Tag", "Title", "Body", "Pinned", "Acknowledged (JSON)", "Replies (JSON)"];
const HQG_SHEET_ = "Division Goals", HQG_HEAD_ = ["Division", "Week start", "Target reports", "Note", "Set by", "Set at"];
const HQ_TAGS_ = ["Announcement", "Need help", "Joint operation", "Policy change", "Shout-out"];
function hqSheet_(name, head) { const ss = ss_(); let sh = ss.getSheetByName(name); if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight("bold"); } return sh; }
function hqPosts_() {
  const v = hqSheet_(HQB_SHEET_, HQB_HEAD_).getDataRange().getValues(), out = [];
  for (let i = 1; i < v.length; i++) { const r = v[i]; if (!str_(r[0])) continue; let acks = [], reps = []; try { acks = JSON.parse(str_(r[8]) || "[]"); } catch (e) {} try { reps = JSON.parse(str_(r[9]) || "[]"); } catch (e) {}
    out.push({ row: i + 1, id: str_(r[0]), at: isDate_(r[1]) ? r[1].getTime() : 0, from: str_(r[2]), fromKey: str_(r[3]), tag: str_(r[4]), title: str_(r[5]), body: str_(r[6]), pinned: r[7] === true || str_(r[7]) === "TRUE", acks: acks, replies: reps }); }
  return out.sort((a, b) => (b.pinned - a.pinned) || b.at - a.at);
}
function hqGoals_(weekStart) {
  const v = hqSheet_(HQG_SHEET_, HQG_HEAD_).getDataRange().getValues(), out = {};
  for (let i = 1; i < v.length; i++) { const r = v[i], ws = isDate_(r[1]) ? r[1].getTime() : Number(r[1]) || 0; if (ws !== weekStart) continue; out[str_(r[0])] = { target: Number(r[2]) || 0, note: str_(r[3]), by: str_(r[4]), row: i + 1 }; }
  return out;
}
function hqWeekStart_() { return raceWeek_(); }
// what this person may do on the Command Center
function hqPerms_(me, allowed) {
  const boss = ["command", "admin", "owner"].indexOf(me.role) !== -1;
  return { post: true, pin: boss, goalAll: boss || !allowed, divisions: allowed };
}
function hqExtras_(res, me, allowed) {
  const ws = hqWeekStart_();
  const av = avMap_();
  res.board = hqPosts_().slice(0, 40).map(p => ({ id: p.id, at: p.at, from: p.from, avatar: av[p.fromKey] || "", mine: p.fromKey === me.key, tag: p.tag, title: p.title, body: p.body, pinned: p.pinned,
    acks: p.acks.map(a => a.n), acked: p.acks.some(a => a.k === me.key), replies: p.replies.slice(-30) }));
  res.goals = hqGoals_(ws); Object.keys(res.goals).forEach(k => delete res.goals[k].row);
  res.perms = hqPerms_(me, allowed); res.tags = HQ_TAGS_;
  return res;
}
function hqAct_(d, me, allowed) {
  const P = hqPerms_(me, allowed);
  return withLock_(() => {
    if (d.action === "hqPost") {
      const title = clip_(str_(d.title), 120), body = clip_(str_(d.body), 2000), tag = HQ_TAGS_.indexOf(str_(d.tag)) !== -1 ? str_(d.tag) : HQ_TAGS_[0];
      if (!title) return { ok: false, error: "Give the post a title." };
      hqSheet_(HQB_SHEET_, HQB_HEAD_).appendRow([Utilities.getUuid().slice(0, 8), new Date(), cellSafe_(me.username), me.key, tag, cellSafe_(title), cellSafe_(body), false, "[]", "[]"]);
      return { ok: true };
    }
    if (d.action === "hqGoal") {
      const div = str_(d.division);
      if (!P.goalAll && (allowed || []).indexOf(div) === -1) return { ok: false, error: "You can only set goals for your own divisions." };
      const target = Math.max(0, Math.min(500, parseInt(d.target, 10) || 0)), ws = hqWeekStart_(), have = hqGoals_(ws)[div], sh = hqSheet_(HQG_SHEET_, HQG_HEAD_);
      const row = [div, new Date(ws), target, cellSafe_(clip_(str_(d.note), 120)), cellSafe_(me.username), new Date()];
      if (have) sh.getRange(have.row, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
      return { ok: true };
    }
    const post = hqPosts_().find(x => x.id === str_(d.id)); if (!post) return { ok: false, error: "That post was removed." };
    const sh = hqSheet_(HQB_SHEET_, HQB_HEAD_);
    if (d.action === "hqAck") { if (!post.acks.some(a => a.k === me.key)) { post.acks.push({ k: me.key, n: me.username, at: Date.now() }); sh.getRange(post.row, 9).setValue(JSON.stringify(post.acks)); } return { ok: true }; }
    if (d.action === "hqReply") { const t = clip_(str_(d.text), 600); if (!t) return { ok: false, error: "Type a reply." }; post.replies.push({ n: me.username, t: t, at: Date.now() }); sh.getRange(post.row, 10).setValue(JSON.stringify(post.replies.slice(-60))); return { ok: true }; }
    if (d.action === "hqPin") { if (!P.pin) return { ok: false, error: "Only command staff can pin posts." }; sh.getRange(post.row, 8).setValue(!!d.on); return { ok: true }; }
    if (d.action === "hqDelete") { if (!P.pin && post.fromKey !== me.key) return { ok: false, error: "You can only remove your own posts." }; sh.deleteRow(post.row); return { ok: true }; }
    return { ok: false, error: "Unknown action." };
  });
}
function divGrade_(d, me) {
  const rows = actRows_(), rec = rows.find(r => r.id === str_(d.id));
  if (!rec) return { ok: false, error: "That report isn't in the log." };
  const clear = !!d.clear, grade = clear ? "" : str_(d.grade).toUpperCase();
  if (!clear && GRADES_.indexOf(grade) === -1) return { ok: false, error: "Pick a grade A to F, or R to return it for correction." };
  const by = clip_(str_(d.gradedBy) || me.username, 60), comments = clear ? "" : clip_(str_(d.comments), 1500);
  actSheet_().getRange(rec.row, 12, 1, 4).setValues([[grade, clear ? "" : cellSafe_(by), cellSafe_(comments), clear ? "" : new Date()]]);
  divClearCache_();
  logAdmin_(me.username, "division grade", (rec.no || rec.title) + " -> " + (grade || "cleared"));
  if (grade) try { const au = (rec.people || [])[0]; if (au && au.i) dm_(au.i, (grade === "R" ? "↩️ Your report **" + (rec.no || rec.title) + "** was returned for correction by " + by : "🏅 Your report **" + (rec.no || rec.title) + "** was graded **" + grade + "** by " + by) + (comments ? "\n> " + clip_(comments, 400) : "")); } catch (e) {}
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
  const line = grade === "R" ? "🏅 **Division review:** ↩️ **Returned for correction** · by " + by + " — fix and file it again" : "🏅 **Division review:** " + medal + " Grade **" + grade + "** · by " + by;
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
  const r = actRows_(true).find(x => x.id === str_(d.id)); if (!r) return { ok: false, error: "That report isn't in the log." };
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
// CHIEF'S REPORT BUILDER SYNC (the Netlify builder adds one line: <script src="https://lspdisthebest.net/sync.js"></script>)
//   · when an officer copies a finished report, it's logged to Division Command (Patrol division) and credited
//     to every roster officer named in it (by callsign like L-104, or by name)
//   · the builder's name boxes get roster autocomplete
// =====================================================================
const BUILDER_FORM_ = "patrolbuilder";
function builderPeople_() {
  const cache = CacheService.getScriptCache(), hit = cache.get("builder_people"); if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const out = [], seen = {};
  [PERSONNEL_TAB_, ONBOARD_TAB_].forEach(t => { const tid = rosterTabByName_(t); if (tid == null) return;
    try { (getRosterTab_(tid, false, [], false, true).people || []).forEach(p => { const cs = p.name.indexOf("|") !== -1 ? p.name.split("|")[0].trim() : "", nm = cleanName_(cs ? p.name.split("|").slice(1).join("|").trim() : p.name);
      if (!nm || seen[p.id || nm]) return; seen[p.id || nm] = 1; out.push({ n: nm, cs: cs, i: p.id || "" }); }); } catch (e) {} });
  cache.put("builder_people", JSON.stringify(out), 600);
  return out;
}
function builderLog_(d) {
  if (PROPS_.getProperty("BUILDER_ON") !== "1") return { ok: false, error: "Builder sync is off." };
  const text = str_(d.text).replace(/\r/g, "").trim();
  if (text.length < 60) return { ok: false, error: "Too short to be a report." };
  const cache = CacheService.getScriptCache(), key = "bld_" + voiceHash_(text.slice(0, 4000));
  if (cache.get(key)) return { ok: true, dup: true };
  const day = "bld_day_" + ymd_(new Date()), n = Number(cache.get(day) || 0); if (n > 600) return { ok: false, error: "Daily limit reached." };
  cache.put(key, "1", 1800); cache.put(day, String(n + 1), 21600);
  // who is in it: callsigns first, then full names; in the order they appear
  const lower = text.toLowerCase(), found = [];
  builderPeople_().forEach(p => {
    let at = -1;
    if (p.cs) { const m = new RegExp("(^|[^A-Za-z0-9])" + p.cs.replace(/[-]/g, "\\-") + "(?![0-9])", "i").exec(text); if (m) at = m.index; }
    if (at < 0 && p.n.length > 4) at = lower.indexOf(p.n.toLowerCase());
    if (at >= 0) found.push({ at: at, p: p });
  });
  found.sort((a, b) => a.at - b.at);
  if (!found.length) return { ok: true, logged: false, reason: "No roster officer named in the report." };
  const people = found.slice(0, 12).map((x, i) => ({ f: i === 0 ? "author" : "assist", n: clip_((x.p.cs ? x.p.cs + " | " : "") + x.p.n, 60), i: x.p.i }));
  const lines = text.split("\n").map(x => x.trim()).filter(Boolean), title = clip_((lines[0] || "Patrol report").replace(/^[#*\s]+/, ""), 120);
  const no = (/(?:report|case|incident|cad)\s*(?:#|no\.?|number)\s*[:\-]?\s*([A-Z0-9][A-Z0-9-]{2,})/i.exec(text) || [])[1] || "";
  withLock_(() => { const sh = actSheet_();
    sh.appendRow([Utilities.getUuid().replace(/-/g, "").slice(0, 14), new Date(), BUILDER_FORM_, cellSafe_(no), cellSafe_(title), JSON.stringify(people), cellSafe_(clip_(lines.slice(1, 8).join("\n"), 1500)), "", "", "", "", "", "", "", "", "builder:" + clip_(str_(d.page), 200), cellSafe_(clip_(text, 45000)), ""]);
    return { ok: true }; });
  divClearCache_(); try { cache.remove("mdt_dept"); } catch (e) {}
  return { ok: true, logged: true, credited: people.map(p => p.n) };
}
// owner/admin: make sure the hidden "Patrol Report (Builder)" form and a Patrol division exist
function builderSetup_(me, on) {
  return withLock_(() => {
    const cfg = getConfig_(); cfg.settings = cfg.settings || {};
    if (!cfg.forms.some(f => f.id === BUILDER_FORM_)) cfg.forms.push({ id: BUILDER_FORM_, title: "Patrol Report (Builder)", icon: "🚓", status: "hidden", section: "", blocks: [], desc: "Logged automatically from the chief's report builder." });
    const divs = cfg.settings.divisions = cfg.settings.divisions || [];
    let dv = divs.find(x => x.forms && x.forms.some(f => f.id === BUILDER_FORM_)) || divs.find(x => /patrol/i.test(x.name));
    if (!dv) { const tid = rosterTabByName_(PERSONNEL_TAB_); dv = { id: "patrol", name: "Patrol", tagline: "Reports from the report builder", color: "#2f7bff", logoUrl: "img/lspd-badge.png", rosterTabId: tid, rosterTabName: tid != null ? PERSONNEL_TAB_ : "", forms: [], quota: 0, quotaPer: "week", quotaAssists: true, warnDays: 0, inactiveDays: 0, pingTagged: false, exempt: "" }; divs.push(dv); }
    dv.forms = dv.forms || []; if (!dv.forms.some(f => f.id === BUILDER_FORM_)) dv.forms.push({ id: BUILDER_FORM_, author: "author" });
    cfg.version = (Number(cfg.version) || 0) + 1; writeConfig_(cfg, me.username);
    if (on != null) PROPS_.setProperty("BUILDER_ON", on ? "1" : "");
    logAdmin_(me.username, "builder sync", (on ? "on" : "off") + " · Patrol division ready");
    return { ok: true, config: cfg, builder: builderStatus_() };
  });
}
function builderStatus_() {
  const rows = actRows_().filter(r => r.form === BUILDER_FORM_), wk = rows.filter(r => Date.now() - r.at < 7 * 864e5);
  return { on: PROPS_.getProperty("BUILDER_ON") === "1", week: wk.length, total: rows.length, last: rows.length ? rows[rows.length - 1].at : 0 };
}

// =====================================================================
// UNIT LIFE: kudos, ribbons, Officer of the Month, training sign-ups, knowledge checks,
// weekly digest (Discord), and Discord DMs (built, OFF until the bot owner allows it)
// =====================================================================
function tab_(name, head) {
  const ss = ss_(); let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight("bold"); }
  return sh;
}
function rows_(name, head) { const sh = tab_(name, head), n = sh.getLastRow(); return n < 2 ? [] : sh.getRange(2, 1, n - 1, head.length).getValues().map((r, i) => ({ row: i + 2, r: r })); }
const KUDOS_ = ["ID", "When", "From ID", "From", "To ID", "To", "Message"];
const AWARDS_ = ["ID", "When", "Type", "Title", "Emoji", "To ID", "To", "Awarded By", "Note"];
const SESS_ = ["ID", "Posted", "When", "Topic", "Host ID", "Host", "Slots", "Signed Up", "Closed", "Details"];
const CHECKS_ = ["ID", "Created", "Title", "By", "Questions (JSON)", "Pass %", "Closed"];
const RESULTS_ = ["Check ID", "When", "Officer ID", "Officer", "Score", "Out Of", "Passed"];
function me_(acct) { const p = acctProfile_(acct); return { id: acct.id, name: ((p.title || "Officer") + " " + voiceLast_(p.name || "")).trim(), cs: p.callsign || "", level: p.level, lv: LEVELS_.indexOf(p.level) }; }
const atLeast_ = (m, lv) => m.lv >= LEVELS_.indexOf(lv);
// --- Discord DMs: only when switched on AND a bot token is saved (Admin → Officer Accounts, owner) ---
function dmOn_() { return PROPS_.getProperty("DM_ON") === "1" && !!PROPS_.getProperty("BOT_TOKEN"); }
function dm_(discordId, text) {
  if (!dmOn_() || !/^\d{15,21}$/.test(str_(discordId))) return false;
  try {
    const H = { Authorization: "Bot " + PROPS_.getProperty("BOT_TOKEN") };
    const ch = UrlFetchApp.fetch("https://discord.com/api/v10/users/@me/channels", { method: "post", contentType: "application/json", headers: H, payload: JSON.stringify({ recipient_id: str_(discordId) }), muteHttpExceptions: true });
    if (ch.getResponseCode() !== 200) return false;
    const id = JSON.parse(ch.getContentText()).id;
    return UrlFetchApp.fetch("https://discord.com/api/v10/channels/" + id + "/messages", { method: "post", contentType: "application/json", headers: H, payload: JSON.stringify({ content: clip_(text, 1900), allowed_mentions: { parse: [] } }), muteHttpExceptions: true }).getResponseCode() === 200;
  } catch (e) { return false; }
}
function unitView_(acct) {
  const m = me_(acct), now = Date.now();
  const kudos = rows_("Kudos", KUDOS_).map(x => ({ id: str_(x.r[0]), at: isDate_(x.r[1]) ? x.r[1].getTime() : 0, fromId: str_(x.r[2]), from: str_(x.r[3]), toId: str_(x.r[4]), to: str_(x.r[5]), msg: str_(x.r[6]) })).reverse();
  const awards = rows_("Awards", AWARDS_).map(x => ({ id: str_(x.r[0]), at: isDate_(x.r[1]) ? x.r[1].getTime() : 0, type: str_(x.r[2]), title: str_(x.r[3]), emoji: str_(x.r[4]), toId: str_(x.r[5]), to: str_(x.r[6]), by: str_(x.r[7]), note: str_(x.r[8]) })).reverse();
  const ootm = awards.find(a => a.type === "ootm") || null;
  const sessions = rows_("Training Sessions", SESS_).map(x => { let su = []; try { su = JSON.parse(str_(x.r[7]) || "[]"); } catch (e) {}
    return { id: str_(x.r[0]), when: isDate_(x.r[2]) ? x.r[2].getTime() : Date.parse(x.r[2]) || 0, topic: str_(x.r[3]), hostId: str_(x.r[4]), host: str_(x.r[5]), slots: Number(x.r[6]) || 0, signups: su, closed: x.r[8] === true || str_(x.r[8]).toUpperCase() === "TRUE", details: str_(x.r[9]) }; })
    .filter(x => x.id && !x.closed && x.when > now - 3 * 3600e3).sort((a, b) => a.when - b.when).map(x => Object.assign(x, { mine: x.signups.some(y => y.i === m.id), full: x.slots > 0 && x.signups.length >= x.slots, canManage: x.hostId === m.id || atLeast_(m, "command") }));
  const results = rows_("Check Results", RESULTS_).map(x => ({ check: str_(x.r[0]), id: str_(x.r[2]), score: Number(x.r[4]) || 0, of: Number(x.r[5]) || 0, passed: x.r[6] === true || str_(x.r[6]).toUpperCase() === "TRUE" }));
  const checks = rows_("Knowledge Checks", CHECKS_).filter(x => str_(x.r[0]) && !(x.r[6] === true || str_(x.r[6]).toUpperCase() === "TRUE")).map(x => { let qs = []; try { qs = JSON.parse(str_(x.r[4]) || "[]"); } catch (e) {}
    const mine = results.filter(r => r.check === str_(x.r[0]) && r.id === m.id), best = mine.sort((a, b) => b.score - a.score)[0] || null, all = results.filter(r => r.check === str_(x.r[0]));
    return { id: str_(x.r[0]), title: str_(x.r[2]), by: str_(x.r[3]), pass: Number(x.r[5]) || 80, questions: qs.map(q => ({ q: q.q, options: q.options })), best: best, takers: atLeast_(m, "fto") ? all.length : undefined, passedN: atLeast_(m, "fto") ? all.filter(r => r.passed).length : undefined }; }).reverse();
  return { ok: true, me: { id: m.id, name: m.name, level: m.level }, canAward: atLeast_(m, "command"), canTrain: atLeast_(m, "fto"),
    kudos: kudos.slice(0, 40), mineReceived: kudos.filter(k => k.toId === m.id).length, ribbons: awards.filter(a => a.type === "ribbon" && a.toId === m.id), recentAwards: awards.slice(0, 12), ootm: ootm,
    sessions: sessions, checks: checks, people: builderPeople_().filter(p => p.i).map(p => ({ i: p.i, n: (p.cs ? p.cs + " | " : "") + p.n })), dm: dmOn_() };
}
function unitAct_(d) {
  const acct = officerSession_(d.session); if (!acct) return { ok: false, error: "AUTH" };
  const m = me_(acct), a = d.action, who = id => builderPeople_().find(p => p.i === str_(id));
  if (a === "unitView") return unitView_(acct);
  if (a === "unitKudos") {
    const to = who(d.to), msg = clip_(str_(d.msg), 300); if (!to) return { ok: false, error: "Pick an officer from the roster." }; if (to.i === m.id) return { ok: false, error: "Kudos are for someone else 🙂" }; if (msg.length < 3) return { ok: false, error: "Say what they did." };
    const ck = "kudo_" + m.id + "_" + to.i, c = CacheService.getScriptCache(); if (c.get(ck)) return { ok: false, error: "You just sent them kudos. Try again later." }; c.put(ck, "1", 3600);
    withLock_(() => { tab_("Kudos", KUDOS_).appendRow([Utilities.getUuid().slice(0, 8), new Date(), "'" + m.id, cellSafe_(m.name), "'" + to.i, cellSafe_((to.cs ? to.cs + " | " : "") + to.n), cellSafe_(msg)]); return { ok: true }; });
    dm_(to.i, "👏 **Kudos from " + m.name + "** on the LSPD MDT:\n> " + msg);
    return unitView_(acct);
  }
  if (a === "unitAward") {
    if (!atLeast_(m, "command")) return { ok: false, error: "Command staff give ribbons and Officer of the Month." };
    const to = who(d.to); if (!to) return { ok: false, error: "Pick an officer from the roster." };
    const type = d.type === "ootm" ? "ootm" : "ribbon", title = type === "ootm" ? "Officer of the Month · " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM yyyy") : clip_(str_(d.title), 60);
    if (!title) return { ok: false, error: "Name the ribbon." };
    withLock_(() => { tab_("Awards", AWARDS_).appendRow([Utilities.getUuid().slice(0, 8), new Date(), type, cellSafe_(title), clip_(str_(d.emoji) || (type === "ootm" ? "🏆" : "🎖️"), 8), "'" + to.i, cellSafe_((to.cs ? to.cs + " | " : "") + to.n), cellSafe_(m.name), cellSafe_(clip_(str_(d.note), 300))]); return { ok: true }; });
    dm_(to.i, (type === "ootm" ? "🏆 **You're LSPD Officer of the Month!**" : "🎖️ **You've been awarded the " + title + " ribbon.**") + " — " + m.name + (str_(d.note) ? "\n> " + clip_(str_(d.note), 300) : ""));
    try { CacheService.getScriptCache().remove("mdt_dept"); } catch (e) {}
    return unitView_(acct);
  }
  if (a === "unitSession") {
    if (!atLeast_(m, "fto")) return { ok: false, error: "FTOs and up post training sessions." };
    const when = Date.parse(str_(d.when)), topic = clip_(str_(d.topic), 120); if (!when || when < Date.now() - 3600e3) return { ok: false, error: "Pick a date and time in the future." }; if (!topic) return { ok: false, error: "What's the training?" };
    withLock_(() => { tab_("Training Sessions", SESS_).appendRow([Utilities.getUuid().slice(0, 8), new Date(), new Date(when), cellSafe_(topic), "'" + m.id, cellSafe_(m.name), Math.max(0, Math.min(50, Number(d.slots) || 0)), "[]", false, cellSafe_(clip_(str_(d.details), 600))]); return { ok: true }; });
    return unitView_(acct);
  }
  if (a === "unitJoin" || a === "unitSessionClose") {
    return withLock_(() => {
      const x = rows_("Training Sessions", SESS_).find(y => str_(y.r[0]) === str_(d.id)); if (!x) return { ok: false, error: "That session is gone." };
      const sh = tab_("Training Sessions", SESS_);
      if (a === "unitSessionClose") { if (str_(x.r[4]).replace(/^'/, "") !== m.id && !atLeast_(m, "command")) return { ok: false, error: "Only the host or command can close it." }; sh.getRange(x.row, 9).setValue(true); return unitView_(acct); }
      let su = []; try { su = JSON.parse(str_(x.r[7]) || "[]"); } catch (e) {}
      if (d.leave) su = su.filter(y => y.i !== m.id);
      else { if (su.some(y => y.i === m.id)) return unitView_(acct); if (Number(x.r[6]) > 0 && su.length >= Number(x.r[6])) return { ok: false, error: "That session is full." }; su.push({ i: m.id, n: (m.cs ? m.cs + " | " : "") + m.name }); }
      sh.getRange(x.row, 8).setValue(JSON.stringify(su));
      if (!d.leave) dm_(str_(x.r[4]).replace(/^'/, ""), "📋 " + m.name + " signed up for your training: **" + str_(x.r[3]) + "**");
      return unitView_(acct);
    });
  }
  if (a === "unitCheckSave") {
    if (!atLeast_(m, "fto")) return { ok: false, error: "FTOs and up write knowledge checks." };
    const title = clip_(str_(d.title), 100), qs = (Array.isArray(d.questions) ? d.questions : []).slice(0, 30).map(q => ({ q: clip_(str_(q.q), 300), options: (Array.isArray(q.options) ? q.options : []).map(o => clip_(str_(o), 160)).filter(Boolean).slice(0, 6), answer: Number(q.answer) || 0 }))
      .filter(q => q.q && q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length);
    if (!title || !qs.length) return { ok: false, error: "Give it a title and at least one question with 2+ answers." };
    withLock_(() => { tab_("Knowledge Checks", CHECKS_).appendRow([Utilities.getUuid().slice(0, 8), new Date(), cellSafe_(title), cellSafe_(m.name), JSON.stringify(qs), Math.max(1, Math.min(100, Number(d.pass) || 80)), false]); return { ok: true }; });
    return unitView_(acct);
  }
  if (a === "unitCheckTake") {
    const x = rows_("Knowledge Checks", CHECKS_).find(y => str_(y.r[0]) === str_(d.id)); if (!x) return { ok: false, error: "That check is gone." };
    let qs = []; try { qs = JSON.parse(str_(x.r[4]) || "[]"); } catch (e) {}
    const ans = Array.isArray(d.answers) ? d.answers : [], score = qs.reduce((n, q, i) => n + (Number(ans[i]) === q.answer ? 1 : 0), 0), passed = score / Math.max(1, qs.length) * 100 >= (Number(x.r[5]) || 80);
    withLock_(() => { tab_("Check Results", RESULTS_).appendRow([str_(x.r[0]), new Date(), "'" + m.id, cellSafe_(m.name), score, qs.length, passed]); return { ok: true }; });
    return Object.assign(unitView_(acct), { result: { score: score, of: qs.length, passed: passed, correct: qs.map(q => q.answer) } });
  }
  if (a === "unitCheckClose") {
    if (!atLeast_(m, "fto")) return { ok: false, error: "FTOs and up manage knowledge checks." };
    const x = rows_("Knowledge Checks", CHECKS_).find(y => str_(y.r[0]) === str_(d.id)); if (x) tab_("Knowledge Checks", CHECKS_).getRange(x.row, 7).setValue(true);
    return unitView_(acct);
  }
  return { ok: false, error: "Unknown action." };
}
// ---- weekly digest to Discord (Monday morning): reports, top officers, grades, kudos, Officer of the Month ----
function weeklyDigest() { try { digestPost_(false); } catch (e) {} }
function digestPost_(test) {
  const url = PROPS_.getProperty("DIGEST_WEBHOOK_URL"); if (!url) return { ok: false, error: "Add the digest webhook first." };
  if (!test && PROPS_.getProperty("DIGEST_ON") !== "1") return { ok: false, error: "Digest is off." };
  const rows = actRows_(), now = Date.now(), wk = rows.filter(r => now - r.at < 7 * 864e5), cnt = {};
  wk.forEach(r => { const p = (r.people || [])[0]; if (p) cnt[p.n] = (cnt[p.n] || 0) + 1; });
  const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, 5);
  const graded = wk.filter(r => GRADE_PTS_[str_(r.grade).toUpperCase()] != null), avg = graded.length ? graded.reduce((t, r) => t + GRADE_PTS_[r.grade.toUpperCase()], 0) / graded.length : null;
  const kud = rows_("Kudos", KUDOS_).filter(x => isDate_(x.r[1]) && now - x.r[1].getTime() < 7 * 864e5).length;
  const aw = rows_("Awards", AWARDS_).map(x => ({ type: str_(x.r[2]), to: str_(x.r[6]), at: isDate_(x.r[1]) ? x.r[1].getTime() : 0 })).filter(x => x.type === "ootm").pop();
  const medals = ["🥇", "🥈", "🥉", "4.", "5."];
  const fields = [{ name: "📄 Reports filed", value: "**" + wk.length + "** this week", inline: true }, { name: "🏅 Average grade", value: avg == null ? "—" : "**" + avg.toFixed(1) + "** / 4", inline: true }, { name: "👏 Kudos given", value: "**" + kud + "**", inline: true }];
  if (top.length) fields.push({ name: "Top reporters", value: top.map((n, i) => medals[i] + " " + n + " — " + cnt[n]).join("\n"), inline: false });
  if (aw) fields.push({ name: "🏆 Officer of the Month", value: aw.to, inline: false });
  const r = discordPost_(url, { embeds: [{ title: "LSPD weekly digest" + (test ? " (test)" : ""), description: "Week ending " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "EEE d MMM yyyy"), color: 0x3f7fff, fields: fields }], allowed_mentions: { parse: [] } }, null);
  return r.ok ? { ok: true } : { ok: false, error: r.error || "Discord refused the post." };
}
function digestTrigger_(on) {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "weeklyDigest").forEach(t => ScriptApp.deleteTrigger(t));
  if (on) ScriptApp.newTrigger("weeklyDigest").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
}

// =====================================================================
// OFFICER ACCOUNTS: sign in with Discord once per device, then a 4-digit PIN
// =====================================================================
const ACCT_SHEET_ = "Officer Accounts";
const ACCT_HEAD_ = ["Discord ID", "Username", "Callsign", "Name", "Level Override", "PIN Salt", "PIN Hash", "Created", "Last Sign-in", "Locked", "Signed Out", "Devices", "Say Name As", "Say Rank As", "Divisions", "Avatar"];
const LEVELS_ = ["trainee", "officer", "fto", "leader", "command", "admin", "owner"];
const LEVEL_NAMES_ = { trainee: "Trainees", officer: "Officers", fto: "FTOs", leader: "Division leaders", command: "Command staff", admin: "Admins", owner: "Owners" };
const OFFICER_DAYS_ = 30;              // a PIN sign-in lasts 30 days on that device
function acctSheet_() {
  const ss = ss_(); let sh = ss.getSheetByName(ACCT_SHEET_);
  if (!sh) { sh = ss.insertSheet(ACCT_SHEET_); sh.appendRow(ACCT_HEAD_); sh.setFrozenRows(1); sh.getRange(1, 1, 1, ACCT_HEAD_.length).setFontWeight("bold"); sh.getRange("A:A").setNumberFormat("@"); }
  return sh;
}
var ACCT_MEMO_ = null;
function acctAll_() {
  if (ACCT_MEMO_) return ACCT_MEMO_;
  const v = acctSheet_().getDataRange().getValues(), out = [];
  for (let i = 1; i < v.length; i++) { const r = v[i], id = str_(r[0]).replace(/^'/, ""); if (!id) continue;
    out.push({ row: i + 1, id: id, username: str_(r[1]), callsign: str_(r[2]), name: str_(r[3]), override: str_(r[4]), salt: str_(r[5]), hash: str_(r[6]),
      created: isDate_(r[7]) ? r[7].toISOString() : str_(r[7]), last: isDate_(r[8]) ? r[8].toISOString() : str_(r[8]), locked: r[9] === true || str_(r[9]).toUpperCase() === "TRUE", signedOut: Number(r[10]) || 0, devices: Number(r[11]) || 0, sayAs: str_(r[12]), rankAs: str_(r[13]), divisions: str_(r[14]).split(",").map(x => x.trim()).filter(Boolean), avatar: str_(r[15]) }); }
  ACCT_MEMO_ = out;
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
const PERSONNEL_TAB_ = "LSPD Personnel Roster", ONBOARD_TAB_ = "LSPD Onboarding Roster", RANK_COL_ = "B";   // ranks live in column B of both tabs
function rosterTabByName_(name) {
  const cache = CacheService.getScriptCache(), ck = "tabid_" + voiceHash_(str_(((getConfig_().settings || {}).roster || {}).url) + "|" + name.toLowerCase());
  const hit = cache.get(ck); if (hit !== null) return hit === "" ? null : Number(hit);
  let id = null;
  try { const want = name.toLowerCase(), sh = rosterBook_().getSheets().find(x => x.getName().trim().toLowerCase() === want); id = sh ? sh.getSheetId() : null; } catch (e) { return null; }
  cache.put(ck, id == null ? "" : String(id), 21600);
  return id;
}
// roster tags stuck to the end of a name ("F. DuzenRM", "F. Duzen RM") aren't part of the name
function cleanName_(n) { return str_(n).replace(/([a-z'])RM\b/g, "$1").replace(/\s+RM\b/g, "").trim(); }
function rosterPerson_(id) {
  const cache = CacheService.getScriptCache(), ck = "rp_" + str_(id), hit = cache.get(ck);
  if (hit !== null) { try { return hit === "" ? null : JSON.parse(hit); } catch (e) {} }
  const p = rosterPersonRead_(id);
  try { cache.put(ck, p ? JSON.stringify(p) : "", p ? 600 : 60); } catch (e) {}   // someone just added to the roster is found within a minute
  return p;
}
function rosterPersonRead_(id) {
  const split = n => { const cs = n.indexOf("|") !== -1 ? n.split("|")[0].trim() : ""; return { callsign: cs, name: cleanName_(cs ? n.split("|").slice(1).join("|").trim() : n) }; };
  let hit = null, trainee = false;
  const fromTab = (name, isTrainee) => { if (hit) return; const tid = rosterTabByName_(name); if (tid == null) return;
    try { const p = (getRosterTab_(tid, false, [RANK_COL_], false, true).people || []).find(x => x.id === id); if (p) { hit = Object.assign(split(p.name), { rank: str_(p.more && p.more[RANK_COL_]) || p.extra || "", section: p.sec || "" }); trainee = isTrainee; } } catch (e) {} };
  fromTab(PERSONNEL_TAB_, false);
  fromTab(ONBOARD_TAB_, true);
  if (hit) return Object.assign(hit, { trainee: trainee, onboarding: trainee });
  try { const p = (getRoster_(false).people || []).find(x => x.id === id); if (p) hit = Object.assign(split(p.name), { rank: p.extra || "" }); } catch (e) {}
  try { programs_().forEach(pc => { if (!pc.on) return; const c = promoCandidates_(false, pc.id).list.find(x => x.id === id); if (c) { if (!hit) hit = { callsign: c.callsign, name: cleanName_(c.name), rank: "" }; if (/onboard|recruit|cadet|trainee|probation/i.test(pc.id + " " + pc.title + " " + (pc.rosterTabName || ""))) trainee = true; } }); } catch (e) {}
  return hit ? Object.assign(hit, { trainee: trainee }) : null;
}
function acctLevel_(acct, person) {
  if (acct && LEVELS_.indexOf(acct.override) !== -1) return acct.override;
  return person && person.trainee ? "trainee" : "officer";
}
// Division Command through the officer sign-in: Leaders see the divisions assigned to them; Command, Admin and Owner see all
function acctDivisions_(acct, level) {
  const all = ((getConfig_().settings || {}).divisions || []).map(x => x.id);
  if (["command", "admin", "owner"].indexOf(level) !== -1) return all;
  if (level === "leader") return (acct.divisions || []).filter(id => all.indexOf(id) !== -1);
  return [];
}
function acctProfile_(acct) {
  const person = rosterPerson_(acct.id) || {};
  const level = acctLevel_(acct, person);
  return { discordId: acct.id, username: acct.username, callsign: person.callsign || acct.callsign, name: person.name || acct.name, rank: person.rank || "", title: str_(acct.rankAs) || voiceTitleFor_(person), level: level, rank_i: LEVELS_.indexOf(level), divisions: acctDivisions_(acct, level),
    forms: (() => { try { const pr = { level: level }; return getConfig_().forms.filter(f => (f.accessTabs || []).length && formAllowed_(f, acct, pr)).map(f => f.id); } catch (e) { return []; } })() };
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
    const q = { client_id: st.clientId, redirect_uri: st.redirect, response_type: "code", scope: st.guildId ? "identify guilds guilds.members.read" : "identify", state: state, prompt: "none" };
    return { ok: true, url: "https://discord.com/oauth2/authorize?" + Object.keys(q).map(k => k + "=" + encodeURIComponent(q[k])).join("&") };
  }
  if (a === "acctDiscord") {
    if (!offRead_(d.state, "STATE")) return { ok: false, error: "That sign-in link expired. Try again." };
    const tok = UrlFetchApp.fetch("https://discord.com/api/oauth2/token", { method: "post", muteHttpExceptions: true,
      payload: { client_id: st.clientId, client_secret: PROPS_.getProperty("DISCORD_CLIENT_SECRET"), grant_type: "authorization_code", code: str_(d.code), redirect_uri: st.redirect } });
    mark_("discord token"); if (tok.getResponseCode() !== 200) return { ok: false, error: "Discord didn't accept the sign-in. Try again." };
    const tokJ = JSON.parse(tok.getContentText()), access = tokJ.access_token, H = { headers: { Authorization: "Bearer " + access }, muteHttpExceptions: true };
    const meR = UrlFetchApp.fetch("https://discord.com/api/users/@me", H); if (meR.getResponseCode() !== 200) return { ok: false, error: "Couldn't read your Discord account." };
    const du = JSON.parse(meR.getContentText()), id = str_(du.id); mark_("discord user");
    if (st.guildId) {             // member info (roles) when they allowed it; the plain server list otherwise
      const mR = /guilds\.members\.read/.test(str_(tokJ.scope)) ? UrlFetchApp.fetch("https://discord.com/api/v10/users/@me/guilds/" + st.guildId + "/member", H) : null, mc = mR ? mR.getResponseCode() : 0;
      if (mc === 404) return { ok: false, error: "This Discord account isn't in the LSPD Discord server." };
      if (mc !== 200) { const gR = UrlFetchApp.fetch("https://discord.com/api/users/@me/guilds", H); const gs = gR.getResponseCode() === 200 ? JSON.parse(gR.getContentText()) : [];
        if (!gs.some(g => str_(g.id) === st.guildId)) return { ok: false, error: "This Discord account isn't in the LSPD Discord server." }; }
      if (mc === 200) { dlinkSave_(id, tokJ);     // lets the portal check the On Duty role every 15 minutes
        try { const mm = JSON.parse(mR.getContentText()), rl = (mm.roles || []).map(String), dc = dutyCfg_();
          if (dc.on && dc.sopRoleId) { const ch = {}; ch[id] = rl.indexOf(dc.sopRoleId) !== -1; sopApply_(ch); }
          const one = {}; one[id] = { n: str_(mm.nick), r: rl, j: str_(mm.joined_at).slice(0, 10), t: Date.now() }; dmemWrite_(one); } catch (e) {} }
    }
    mark_("discord guilds"); const person = rosterPerson_(id); mark_("roster");
    let acct = acctFind_(id); mark_("account");
    if (!person && !acct) return { ok: false, error: "Your Discord account (" + (du.username || id) + ") isn't on the LSPD roster. Ask a supervisor to add your Discord ID to the roster." };
    if (acct && acct.locked) return { ok: false, error: "This account is locked. Contact command staff." };
    withLock_(() => {
      const sh = acctSheet_(); acct = acctFind_(id);
      const av = /^[\w]{6,40}$/.test(str_(du.avatar)) ? str_(du.avatar) : "";
      if (str_(sh.getRange(1, 16).getValue()) !== "Avatar") sh.getRange(1, 16).setValue("Avatar").setFontWeight("bold");
      if (!acct) sh.appendRow(["'" + id, cellSafe_(du.username || ""), cellSafe_(person ? person.callsign : ""), cellSafe_(person ? person.name : ""), "", "", "", new Date(), "", false, 0, 1, "", "", "", av]);
      else { sh.getRange(acct.row, 2).setValue(cellSafe_(du.username || acct.username)); sh.getRange(acct.row, 12).setValue((acct.devices || 0) + 1); sh.getRange(acct.row, 16).setValue(av); }
      return { ok: true };
    });
    acct = acctFind_(id); mark_("saved");
    const prof = acctProfile_(acct); mark_("profile");
    return { ok: true, device: offToken_("DEV", id, 400 * 864e5), hasPin: !!acct.hash, profile: prof };
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
    const acct = acctFind_(dv.id); mark_("account");
    if (!acct) return { ok: false, error: "Sign in with Discord again on this device." };
    if (acct.locked) return { ok: false, error: "This account is locked. Contact command staff." };
    if (!acct.hash) return { ok: false, needPin: true, error: "Create your PIN first." };
    if (acct.signedOut && dv.issued < acct.signedOut) return { ok: false, error: "This device was signed out. Sign in with Discord again." };
    if (hashPw_(str_(d.pin), acct.salt) !== acct.hash) { cache.put(fk, String(fails + 1), 900); return { ok: false, error: "Wrong PIN" + (fails >= 3 ? " — " + (4 - fails) + " tr" + (4 - fails === 1 ? "y" : "ies") + " left." : ".") }; }
    cache.remove(fk);
    try { acctSheet_().getRange(acct.row, 9).setValue(new Date()); } catch (e) {} mark_("saved");
    const prof = acctProfile_(acct); mark_("profile");
    return { ok: true, session: offToken_("OFF", acct.id, OFFICER_DAYS_ * 864e5), profile: prof };
  }
  if (a === "acctMe") { const acct = officerSession_(d.session); return acct ? { ok: true, profile: acctProfile_(acct) } : { ok: false, error: "AUTH" }; }
  if (a === "acctOut") return { ok: true };       // the browser forgets its tokens
  return { ok: false, error: "Unknown action." };
}
// Division Command for a signed-in officer (no separate login): only their allowed divisions
function divOfficer_(d) {
  const acct = officerSession_(d.session); if (!acct) return { ok: false, error: "AUTH", message: "Sign on again." };
  const prof = acctProfile_(acct), allowed = prof.divisions || [];
  if (!allowed.length) return { ok: false, error: "Division Command is for division leaders and command staff. Ask command to give your account access." };
  const name = ((prof.title || "Officer") + " " + voiceLast_(prof.name || "")).trim() || prof.callsign || acct.username;
  const me = { username: name, role: prof.level === "leader" ? "leader" : prof.level, officer: true };
  if (d.action === "divView") {
    const want = allowed.indexOf(str_(d.division)) !== -1 ? str_(d.division) : allowed[0];
    const r = divView_(Object.assign({}, d, { division: want }), me);
    if (r && r.divisions) r.divisions = r.divisions.filter(x => allowed.indexOf(x.id) !== -1);
    if (r) r.me = me;
    return r;
  }
  if (d.action === "divGrade") { if (allowed.indexOf(str_(d.division)) === -1) return { ok: false, error: "That isn't one of your divisions." }; return withLock_(() => divGrade_(d, me)); }
  me.key = acct.id;
  if (d.action === "divOverview") return divOverview_(allowed, me);
  if (/^hq(Post|Ack|Reply|Pin|Delete|Goal)$/.test(d.action)) { const r = hqAct_(d, me, allowed); return r.ok ? divOverview_(allowed, me) : r; }
  return divReport_(d);
}
function acctList_() {
  return acctAll_().map(a => { const p = rosterPerson_(a.id); return { discordId: a.id, username: a.username, callsign: (p && p.callsign) || a.callsign, name: (p && p.name) || a.name, rank: p ? p.rank : "", section: p ? p.section || "" : "", title: a.rankAs || voiceTitleFor_(p), rankAs: a.rankAs, onRoster: !!p,
    level: acctLevel_(a, p), override: a.override, divisions: a.divisions, sayAs: a.sayAs, voiceAs: voiceNameText_(a, p), hasPin: !!a.hash, locked: a.locked, created: a.created, last: a.last, devices: a.devices }; });
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
// OFFICER HOME: training path, SOP, Fleet (vehicles by rank) and Uniforms
// Fleet and uniforms are read from the main roster's guideline tabs, laid out as card grids:
//   vehicles: a rank heading, then "Mods: / Color: / Required Extras: / Optional Extras: / Requiered Livery: / Slicktop: / Spawncode:" rows, then the vehicle name
//   uniforms: an outfit title, then "Duplicate code: NNNN | Category | Male" and one row per clothing item; plus the Rank Insignia Chart
// Photos: an =IMAGE("https://…") formula inside the card, or a link an admin adds (Admin → Fleet & Uniforms).
// =====================================================================
const SOP_URL_DEFAULT_ = "https://docs.google.com/document/d/1t4vHCiHS3xH2VTfDgOKRX3L7BeZyh8YrCLaC_bZTJqw/edit?tab=t.0";
const RANKS_ = ["Police Officer", "Police Officer II", "Police Officer III", "Corporal", "Sergeant", "Staff Sergeant", "Sergeant Major", "Lieutenant", "Captain", "Major", "Commander", "Deputy Chief", "Assistant Chief", "Chief of Police"];
// any rank text (full or abbreviated) -> position on the ladder above; -1 if none
function rankIndex_(t) {
  const r = " " + str_(t).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim() + " ";
  const T = [[/ (sergeant major|sgt ?maj|sgm) /, 6], [/ (assistant chief|asst chief|aoc) /, 12], [/ (deputy chief|dep chief) /, 11], [/ (chief|cop) /, 13], [/ (commander|cmdr|cdr) /, 10],
    [/ (captain|capt|cpt) /, 8], [/ (major|maj) /, 9], [/ (lieutenant|lieut|lt) /, 7], [/ (staff sergeant|staff sgt|ssgt|s sgt) /, 5], [/ (sergeant|sgt) /, 4], [/ (corporal|cpl) /, 3],
    [/ (third class|po ?iii|po ?3|officer iii|officer 3) /, 2], [/ (second class|po ?ii|po ?2|officer ii|officer 2) /, 1],
    [/ (first class|po ?i|po ?1|police officer|officer|ofc|probationary|recruit|cadet|trainee) /, 0]];
  for (let i = 0; i < T.length; i++) if (T[i][0].test(r)) return T[i][1];
  return -1;
}
// which ranks an outfit/vehicle heading covers ("Class A Police Officer Second Class - Police Officer Third Class", "Supervisor Team", "All Ranks"…)
function rankSpan_(t) {
  const x = str_(t).toLowerCase();
  if (/all ranks/.test(x)) return [0, RANKS_.length - 1];
  if (/command staff|\bcommand\b/.test(x)) return [7, RANKS_.length - 1];   // "Command Staff", or "[Command]" on the female tab
  if (/supervisor/.test(x)) return [4, 6];
  if (/po ?1 ?- ?po ?3/.test(x)) return [0, 2];
  const parts = x.split(/\s[-–&]\s|\s(?:to|and)\s/).map(rankIndex_).filter(i => i >= 0);
  if (!parts.length) { const i = rankIndex_(x); return i >= 0 ? [i, i] : null; }
  return [Math.min.apply(null, parts), Math.max.apply(null, parts)];
}
function guideTab_(re) { try { return rosterBook_().getSheets().find(sh => re.test(sh.getName())) || null; } catch (e) { return null; } }
function imgUrl_(f) { const m = /IMAGE\(\s*"([^"]+)"/i.exec(str_(f)); return m ? m[1] : ""; }
function fleetParse_(fresh) {
  const cache = CacheService.getScriptCache(), ck = "fleet_v1";
  if (!fresh) { const hit = cache.get(ck); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  const out = { vehicles: [], uniforms: { male: [], female: [] }, insignia: [], vehicleRules: [], uniformRules: [], tabs: {} };
  // ---- vehicles ----
  const vt = guideTab_(/vehicle guidelines/i);
  if (vt) {
    out.tabs.vehicles = vt.getName();
    const R = vt.getRange(1, 1, Math.min(vt.getLastRow(), 400), Math.min(vt.getLastColumn(), 40)), v = R.getDisplayValues(), fx = R.getFormulas();
    const cell = (r, c) => r >= 0 && r < v.length && c >= 0 && c < v[r].length ? str_(v[r][c]).trim() : "";
    const LBL = { "mods:": "mods", "color:": "color", "required extras:": "req", "optional extras:": "opt", "requiered livery:": "livery", "required livery:": "livery", "slicktop:": "slick", "spawncode:": "spawn", "spawn code:": "spawn" };
    let section = "", firstCard = v.length;
    for (let r = 0; r < v.length; r++) for (let c = 0; c < v[r].length; c++) {
      if (cell(r, c).toLowerCase() !== "mods:") continue;
      firstCard = Math.min(firstCard, r);
      const card = {}; let rr = r;
      for (; rr < Math.min(v.length, r + 9); rr++) { const k = LBL[cell(rr, c).toLowerCase()]; if (!k) break;
        let val = ""; for (let cc = c + 1; cc <= c + 4 && !val; cc++) { if (LBL[cell(rr, cc).toLowerCase()]) break; val = cell(rr, cc); } card[k] = val; }
      const name = cell(rr, c) || cell(rr, c - 1) || cell(rr, c + 1);
      // rank heading: nearest text above the card in its columns (not a label)
      let rank = "", rankRow = -1, photo = "";
      for (let up = r - 1; up >= Math.max(0, r - 12) && !rank; up--) for (let cc = c - 1; cc <= c + 2; cc++) { const t = cell(up, cc); if (t && !LBL[t.toLowerCase()] && (rankSpan_(t) || /rank/i.test(t))) { rank = t; rankRow = up; break; } }
      for (let up = r - 1; up > rankRow && !photo; up--) for (let cc = c - 1; cc <= c + 4 && !photo; cc++) photo = imgUrl_(fx[up] && fx[up][cc]);
      section = "";
      for (let up = r - 1; up >= 0 && !section; up--) for (let cc = 0; cc < v[up].length; cc++) { const t = cell(up, cc); if (/vehicles$/i.test(t) && !/guidelines/i.test(t)) { section = t; break; } }
      const span = rankSpan_(rank) || [0, RANKS_.length - 1];
      out.vehicles.push({ key: "v:" + (card.spawn || name).toLowerCase(), name: name || "Vehicle", rank: rank || "All Ranks", minRank: span[0], section: section,
        spawn: card.spawn || "", mods: card.mods || "", color: card.color || "", req: card.req || "", opt: card.opt || "", livery: card.livery || "", slick: card.slick || "", photo: photo });
    }
    for (let r = 0; r < Math.min(firstCard, v.length); r++) { const t = cell(r, 1) || cell(r, 0); if (t && t.length > 25 && !/^★/.test(t) && !/vehicle guidelines|regulations|structure/i.test(t) && out.vehicleRules.indexOf(t) === -1) out.vehicleRules.push(t); }
  }
  // ---- uniforms (male tab, and a female tab when one exists) ----
  [["male", /^(?!.*female).*attire/i], ["female", /female.*attire/i]].forEach(pair => {
    const ut = guideTab_(pair[1]); if (!ut) return;
    out.tabs[pair[0]] = ut.getName();
    const R = ut.getRange(1, 1, Math.min(ut.getLastRow(), 400), Math.min(ut.getLastColumn(), 40)), v = R.getDisplayValues(), fx = R.getFormulas();
    const cell = (r, c) => r >= 0 && r < v.length && c >= 0 && c < v[r].length ? str_(v[r][c]).trim() : "";
    for (let r = 0; r < v.length; r++) for (let c = 0; c < v[r].length; c++) {
      const t = cell(r, c);
      if (/^duplicate code/i.test(t)) {
        const title = cell(r - 1, c) || cell(r - 1, c + 1), code = t.replace(/^duplicate code:?\s*/i, ""), items = []; let photo = "";
        for (let rr = r + 1; rr < Math.min(v.length, r + 25); rr++) { const lab = cell(rr, c + 1); if (!lab) break; if (/^more customization$/i.test(lab)) { items.push({ head: lab }); continue; } items.push({ label: lab, value: cell(rr, c + 2) }); }
        for (let up = r - 1; up >= Math.max(0, r - 6) && !photo; up--) for (let cc = c; cc <= c + 3 && !photo; cc++) photo = imgUrl_(fx[up] && fx[up][cc]);
        const span = rankSpan_(title) || [0, RANKS_.length - 1];
        out.uniforms[pair[0]].push({ key: "u:" + code, title: title, code: code, items: items, from: span[0], to: span[1], photo: photo });
      }
      if (pair[0] === "male" && /^rank insignia chart$/i.test(t)) {       // Chevron | Rank | Badges & Logos
        for (let rr = r + 2; rr < Math.min(v.length, r + 25); rr++) { const rk = cell(rr, c + 1); if (!rk) break; out.insignia.push({ rank: rk, idx: rankIndex_(rk), chevron: cell(rr, c), badge: cell(rr, c + 2) }); }
      }
      if (pair[0] === "male" && /attire guidelines/i.test(t) && !/^duplicate/i.test(t)) {
        for (let rr = r + 1; rr < v.length; rr++) { const x = cell(rr, c); if (/^rank insignia chart$/i.test(x)) break; if (x && x.length > 12 && out.uniformRules.indexOf(x) === -1) out.uniformRules.push(x.replace(/\s+/g, " ")); }
      }
    }
  });
  const js = JSON.stringify(out); if (js.length < 95000) cache.put(ck, js, 900);   // 15 min: fixes in the sheet (like a missing spawn code) show up on their own
  return out;
}
// this officer's view: everything marked for their rank (vehicles at or below it; uniforms that include it; their own badge)
function fleetFor_(rank, trainee) {
  const f = fleetParse_(false), photos = (getConfig_().settings || {}).fleetPhotos || {};
  let ri = trainee ? 0 : rankIndex_(rank); const known = ri >= 0; if (!known) ri = 0;
  const ins = f.insignia.find(x => x.idx === ri) || null;
  const pic = x => photos[x.key] || x.photo || "";
  return {
    rank: { idx: ri, name: RANKS_[ri], known: known, trainee: !!trainee },
    vehicles: f.vehicles.map(x => Object.assign({}, x, { photo: pic(x), allowed: x.minRank <= ri })),
    uniforms: { male: f.uniforms.male.map(x => Object.assign({}, x, { photo: pic(x), yours: ri >= x.from && ri <= x.to, locked: ri < x.from })),
      female: f.uniforms.female.map(x => Object.assign({}, x, { photo: pic(x), yours: ri >= x.from && ri <= x.to, locked: ri < x.from })) },
    badge: ins ? { rank: ins.rank, value: ins.badge, chevron: ins.chevron } : null,
    insignia: f.insignia, vehicleRules: f.vehicleRules, uniformRules: f.uniformRules, female: f.uniforms.female.length > 0
  };
}
// ---- Promotion requirements: read from the LSPD Promotion Guidelines Google Doc ----
// Each rank heading in the doc (e.g. "Sergeant (SGT) - 14 TIG") is the officer's CURRENT rank; the lines under it are
// what they need for their next promotion. "[Supervisor Team]" style lines are group names; lines starting with "-" are
// details of the requirement above; "* = …" is a note for that rank. Reading stops at "Effective Date".
const PROMO_DOC_DEFAULT_ = "https://docs.google.com/document/d/12H5Ihu6cAH3m3uaEdYuZfcgQlkiAyYq6PPbai1B4woE/edit";
function promoDocId_(u) { const m = /\/document\/d\/([\w-]{20,})/.exec(str_(u)); return m ? m[1] : ""; }
function promoDocUrl_() { return str_((getConfig_().settings || {}).promoDocUrl) || PROMO_DOC_DEFAULT_; }
function promoLines_(docId) {
  const body = DocumentApp.openById(docId).getBody(), out = [];
  const n = body.getNumChildren();
  for (let i = 0; i < n; i++) {
    const el = body.getChild(i), t = el.getType();
    if (t === DocumentApp.ElementType.PARAGRAPH || t === DocumentApp.ElementType.LIST_ITEM) {
      const txt = el.asText().getText();
      out.push((t === DocumentApp.ElementType.LIST_ITEM && el.asListItem().getNestingLevel() > 0 ? "- " : "") + txt);
    } else if (t === DocumentApp.ElementType.TABLE) {
      const tb = el.asTable(); for (let r = 0; r < tb.getNumRows(); r++) out.push(tb.getRow(r).getText().replace(/\n/g, " "));
    }
  }
  return out;
}
function promoParseLines_(lines) {
  const out = { ranks: [], notes: [] }; let group = "", cur = null, started = false;
  const isHead = x => x.length < 160 && !/\bmust\b/i.test(x) && /\([A-Z0-9]{2,6}\)/.test(x) && rankIndex_(x) >= 0;
  lines.map(x => str_(x).replace(/\s+/g, " ").trim()).forEach(x => {
    if (!x || out.stop) return;
    if (/^effective date/i.test(x)) { out.stop = true; return; }
    const g = /^\[(.+)\]$/.exec(x); if (g) { group = clip_(g[1], 60); started = true; return; }
    if (isHead(x)) {
      started = true;
      const i = rankIndex_(x.split(/\s[-–]\s/)[0]), tig = /(\d+)\s*TIG\b/i.exec(x);
      cur = { idx: i, name: RANKS_[i], label: clip_(x.split(/\s[-–]\s/)[0].trim(), 80), group: group, tig: tig ? Number(tig[1]) : 0, draft: /not final/i.test(x), reqs: [], note: "" };
      out.ranks.push(cur); return;
    }
    if (!started || !cur) { if (/unreachable|ticket|tag @/i.test(x)) out.notes.push(clip_(x, 400)); return; }
    if (/^\*\s*=/.test(x)) { cur.note = clip_(x.replace(/^\*\s*=\s*/, "").replace(/^\((.*)\)$/, "$1"), 400); return; }
    if (/^[-–•○]\s*/.test(x) || /^\(.*\)$/.test(x)) { const last = cur.reqs[cur.reqs.length - 1]; const d = x.replace(/^[-–•○]\s*/, "").replace(/\s*-\.?$/, "").trim(); if (last) last.d = clip_((last.d ? last.d + "\n" : "") + d, 900); else cur.reqs.push({ t: clip_(d, 400), d: "" }); return; }
    const star = /^\*\s*/.test(x);
    cur.reqs.push({ t: clip_(x.replace(/^\*\s*/, "").replace(/,$/, ""), 400), d: "", star: star });
  });
  delete out.stop;
  // two headings for the same rank: keep them together
  const byIdx = {}; out.ranks = out.ranks.filter(r => { if (byIdx[r.idx]) { byIdx[r.idx].reqs = byIdx[r.idx].reqs.concat(r.reqs); return false; } byIdx[r.idx] = r; return true; }).sort((x, y) => x.idx - y.idx);
  return out;
}
function promoReqParse_(fresh) {
  const cache = CacheService.getScriptCache(), ck = "promoreq_v2";
  if (!fresh) { const hit = cache.get(ck); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  const url = promoDocUrl_(), id = promoDocId_(url);
  let out;
  try { out = promoParseLines_(promoLines_(id)); out.doc = url; out.title = ""; try { out.title = DocumentApp.openById(id).getName(); } catch (e) {} }
  catch (e) { return { doc: url, ranks: [], notes: [], error: "Couldn't read the promotion guidelines doc: " + errMsg_(e) }; }
  const js = JSON.stringify(out); if (js.length < 95000) cache.put(ck, js, 900);
  return out;
}

// ---- Promotion tracker: every officer's checklist for their current rank (requirements from the guidelines doc) ----
// Ticks themselves:  time in grade (roster column G: a date or a day count)  ·  "N reports" (every report that credits the
// officer since they reached their rank, division reports included).  Everything else is ticked by command.
// Ticks live in the "Promotion Checks" tab; a promotion starts a fresh checklist (the rank is part of each key).
const PCHK_SHEET_ = "Promotion Checks", PCHK_HEAD_ = ["Discord ID", "Officer", "Rank", "Key", "Requirement", "Checked by", "Checked at"], TIG_COL_ = "G";
function pchkSheet_() {
  const ss = ss_(); let sh = ss.getSheetByName(PCHK_SHEET_);
  if (!sh) { sh = ss.insertSheet(PCHK_SHEET_); sh.appendRow(PCHK_HEAD_); sh.setFrozenRows(1); sh.getRange(1, 1, 1, PCHK_HEAD_.length).setFontWeight("bold"); }
  return sh;
}
function pchkAll_() {
  const v = pchkSheet_().getDataRange().getValues(), out = {};
  for (let i = 1; i < v.length; i++) { const id = str_(v[i][0]).replace(/^'/, ""), k = str_(v[i][3]); if (!id || !k) continue;
    (out[id] = out[id] || {})[k] = { by: str_(v[i][5]), at: isDate_(v[i][6]) ? v[i][6].getTime() : 0, row: i + 1 }; }
  return out;
}
function reqKey_(idx, t) { let h = 5381; const x = str_(t).toLowerCase().replace(/[^a-z0-9]/g, ""); for (let i = 0; i < x.length; i++) h = ((h * 33) ^ x.charCodeAt(i)) >>> 0; return idx + "-" + h.toString(36); }
// what a requirement line asks for, when the portal can count it itself
function reqAuto_(t, sopOn) {
  if (/time in grade|\btig\b/i.test(t)) { const m = /\((\d+)\)\s*days/i.exec(t) || /(\d+)\s*days/i.exec(t); if (m) return { type: "tig", need: Number(m[1]) }; }
  const r = /\((\d+)\)\s*reports/i.exec(t) || /minimum of (\d+) reports/i.exec(t); if (r) return { type: "reports", need: Number(r[1]) };
  if (sopOn && /\bsop\b.*certified|certified.*\bsop\b/i.test(t)) return { type: "sop", need: 1 };   // SOP Certified role in Discord
  return null;
}
function promoLadderKeys_() {
  const L = promoReqParse_(false);
  const dc = dutyCfg_(), sopOn = dc.on && !!dc.sopRoleId;
  (L.ranks || []).forEach(r => r.reqs.forEach(q => { q.key = reqKey_(r.idx, q.t); const a = reqAuto_(q.t, sopOn); if (a) q.auto = a; else delete q.auto; }));
  return L;
}
// everyone on the Personnel and Onboarding rosters, with their rank, time in grade and report count
function promoPeople_(fresh) {
  const cache = CacheService.getScriptCache(), ck = "promo_people";
  if (!fresh) { const hit = cache.get(ck); if (hit) { try { const o = JSON.parse(hit), now = Date.now(); o.forEach(x => { x.tigDays = x.since ? Math.floor((now - x.since) / 864e5) : null; }); return o; } catch (e) {} } }
  const out = promoPeopleRead_();
  try { const js = JSON.stringify(out); if (js.length < 95000) cache.put(ck, js, 900); } catch (e) {}
  return out;
}
function promoPeopleRead_() {
  const out = [], seen = {}, now = Date.now();
  [[PERSONNEL_TAB_, false], [ONBOARD_TAB_, true]].forEach(pair => {
    const tid = rosterTabByName_(pair[0]); if (tid == null) return;
    let people = []; try { people = getRosterTab_(tid, false, [RANK_COL_, TIG_COL_], false, true).people || []; } catch (e) {}
    people.forEach(p => {
      if (!p.id || seen[p.id]) return; seen[p.id] = 1;
      const cs = p.name.indexOf("|") !== -1 ? p.name.split("|")[0].trim() : "", name = cleanName_(cs ? p.name.split("|").slice(1).join("|").trim() : p.name);
      const idx = pair[1] ? 0 : rankIndex_(str_(p.more && p.more[RANK_COL_]) || p.extra || "");
      const raw = str_(p.more && p.more[TIG_COL_]).trim(); let since = 0;
      if (/^\d{1,4}$/.test(raw)) since = now - Number(raw) * 864e5; else if (raw) { const d = new Date(raw); if (!isNaN(d)) since = d.getTime(); }
      out.push({ id: p.id, callsign: cs, name: name, rank: str_(p.more && p.more[RANK_COL_]) || (pair[1] ? "Probationary Officer" : ""), idx: idx, trainee: pair[1], since: since });
    });
  });
  // reports that credit each officer
  const rows = actRows_(), byId = {};
  rows.forEach(r => (r.people || []).forEach(x => { if (x.i) (byId[x.i] = byId[x.i] || []).push(r.at); }));
  out.forEach(o => { const from = o.since || now - 28 * 864e5; o.reports = (byId[o.id] || []).filter(t => t >= from).length; o.tigDays = o.since ? Math.floor((now - o.since) / 864e5) : null; });
  return out;
}
var SOP_MEMO_ = null;
function promoEval_(o, rankReqs, checks) {
  const mine = checks || {};
  const items = (rankReqs ? rankReqs.reqs : []).map(q => {
    const c = mine[q.key], a = q.auto; let have = null, auto = false;
    if (a && a.type === "tig") { have = o.tigDays; auto = have != null && have >= a.need; }
    if (a && a.type === "reports") { have = o.reports; auto = have >= a.need; }
    if (a && a.type === "sop") { have = SOP_MEMO_ ? (SOP_MEMO_[o.id] ? 1 : 0) : (sopIds_()[o.id] ? 1 : 0); auto = have >= 1; }
    return { key: q.key, t: q.t, auto: a ? a.type : "", need: a ? a.need : 0, have: have, done: auto || !!c, by: c ? c.by : (auto ? "auto" : ""), at: c ? c.at : 0, manual: !!c };
  });
  return { items: items, done: items.filter(x => x.done).length, total: items.length, ready: items.length > 0 && items.every(x => x.done) };
}
function promoBoard_() {
  const L = promoLadderKeys_(), people = promoPeople_(), checks = pchkAll_(); SOP_MEMO_ = sopIds_();
  const byIdx = {}; (L.ranks || []).forEach(r => byIdx[r.idx] = r);
  const nextName = idx => { const n = (L.ranks || []).find(x => x.idx > idx); return n ? n.name : "High Command"; };
  return { ok: true, error: L.error || "", doc: L.doc, ranks: (L.ranks || []).map(r => ({ idx: r.idx, label: r.label, name: r.name, next: nextName(r.idx), tig: r.tig, group: r.group })),
    officers: people.filter(o => o.idx >= 0).map(o => Object.assign({ id: o.id, callsign: o.callsign, name: o.name, rank: o.rank, idx: o.idx, trainee: o.trainee, tigDays: o.tigDays, reports: o.reports, listed: !!byIdx[o.idx] },
      promoEval_(o, byIdx[o.idx], checks[o.id]))) };
}
function promoMine_(acct) {
  try {
    const L = promoLadderKeys_(), o = promoPeople_().find(x => x.id === acct.id); if (!o) return null;
    const r = (L.ranks || []).find(x => x.idx === o.idx); if (!r) return null;
    const e = promoEval_(o, r, pchkAll_()[acct.id]);
    return { idx: o.idx, tigDays: o.tigDays, reports: o.reports, items: e.items.map(x => ({ key: x.key, done: x.done, auto: x.auto, need: x.need, have: x.have, by: x.manual ? x.by : "" })), ready: e.ready };
  } catch (e) { return null; }
}
function promoTrack_(d) {
  const acct = officerSession_(d.session); if (!acct) return { ok: false, error: "AUTH" };
  const prof = acctProfile_(acct);
  if (LEVELS_.indexOf(prof.level) < LEVELS_.indexOf("command")) return { ok: false, error: "The promotion tracker is for command staff." };
  if (d.action === "promoCheck") {
    const who = promoPeople_().find(x => x.id === str_(d.id)); if (!who) return { ok: false, error: "That officer isn't on the roster any more." };
    const L = promoLadderKeys_(), r = (L.ranks || []).find(x => x.idx === who.idx), q = r && r.reqs.find(x => x.key === str_(d.key));
    if (!q) return { ok: false, error: "That requirement changed in the guidelines doc. Refresh the tracker." };
    const by = ((prof.title || "") + " " + voiceLast_(prof.name || "")).trim() + (prof.callsign ? " (" + prof.callsign + ")" : "");
    withLock_(() => {
      const sh = pchkSheet_(), have = (pchkAll_()[who.id] || {})[q.key];
      if (d.on && !have) sh.appendRow(["'" + who.id, cellSafe_((who.callsign ? who.callsign + " | " : "") + who.name), cellSafe_(r.name), q.key, cellSafe_(q.t), cellSafe_(by), new Date()]);
      if (!d.on && have) sh.deleteRow(have.row);
      return { ok: true };
    });
    try { CacheService.getScriptCache().remove("promo_people"); } catch (e) {}
  }
  return promoBoard_();
}

// the race, from an officer's side: their divisions' standing and their own points this week
function officerRace_(acct) {
  try {
    const divs = ((getConfig_().settings || {}).divisions || []);
    if (!divs.length) return null;
    const ck = "div_hq_" + divs.map(x => x.id).join(",").slice(0, 200), hit = bigGet_(ck) || bigGet_(ck + "_last");   // the 10-minute timer keeps this fresh
    let ov = null; if (hit) { try { ov = JSON.parse(hit); } catch (e) {} }
    if (!ov) ov = divOverview_(null, { username: "", role: "officer", key: acct.id }, true);
    const L = ov.divisions || [];
    const order = L.slice().sort((a, b) => b.week.points - a.week.points);
    const mine = divs.filter(dv => dv.rosterTabId != null && tabIds_(dv.rosterTabId, false).indexOf(acct.id) !== -1).map(dv => dv.id);
    return { weekEnd: ov.weekEnd, of: order.length, leader: order[0] ? { name: order[0].name, color: order[0].color, points: order[0].week.points } : null,
      divisions: order.map((d, i) => ({ id: d.id, name: d.name, color: d.color, logoUrl: d.logoUrl, rank: i + 1, points: d.week.points, mine: mine.indexOf(d.id) !== -1,
        ahead: i ? { name: order[i - 1].name, points: order[i - 1].week.points } : null, my: (d.ptsById || {})[acct.id] || null, streak: d.streak })).filter(x => x.mine || x.my),
      standings: order.slice(0, 5).map(d => ({ name: d.name, color: d.color, points: d.week.points })), improved: ov.improved ? (L.find(d => d.id === ov.improved.id) || {}).name || "" : "" };
  } catch (e) { return null; }
}
// the officer's own progression (onboarding, promotion programs): tasks, counts, deadline
function myPaths_(person) {
  const out = []; if (!person) return out;
  try {
    programs_().forEach(pc => {
      if (!pc.on) return;
      const v = promoView_(false, pc.id), c = (v.candidates || []).find(x => (person.callsign && x.callsign === person.callsign) || (!person.callsign && x.name === person.name));
      if (!c) return;
      out.push({ id: pc.id, title: v.title, subtitle: v.subtitle, since: c.since, tig: c.tig, tigDays: v.tigDays, done: c.done, total: c.total, complete: c.complete, deadline: c.deadline,
        tasks: (v.tasks || []).map(t => Object.assign({ id: t.id, title: t.title, desc: t.desc, need: t.need, final: t.final }, c.tasks[t.id] || {})) });
    });
  } catch (e) {}
  return out;
}
// ---- MDT home board: shift briefing (roll call), my reports, department pulse, trainer "needs you", live ticker ----
const BRIEF_SHEET_ = "Briefings", BRIEF_HEAD_ = ["ID", "Posted", "From", "To", "RE", "Body", "Acknowledged (Discord IDs)"];
function briefSheet_() {
  const ss = ss_(); let sh = ss.getSheetByName(BRIEF_SHEET_);
  if (!sh) { sh = ss.insertSheet(BRIEF_SHEET_); sh.appendRow(BRIEF_HEAD_); sh.setFrozenRows(1); sh.getRange(1, 1, 1, BRIEF_HEAD_.length).setFontWeight("bold"); }
  return sh;
}
function briefAll_() {
  const sh = briefSheet_(), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 7).getValues().map((r, i) => { let acks = []; try { acks = JSON.parse(str_(r[6]) || "[]"); } catch (e) {}
    return { row: i + 2, id: str_(r[0]), at: isDate_(r[1]) ? r[1].getTime() : 0, from: str_(r[2]), to: str_(r[3]), re: str_(r[4]), body: str_(r[5]), acks: acks }; }).filter(b => b.id).reverse();
}
const GRADE_PTS_ = { "A+": 4.3, A: 4, "A-": 3.7, "B+": 3.3, B: 3, "B-": 2.7, "C+": 2.3, C: 2, "C-": 1.7, D: 1, F: 0 };
function mdtDept_() {
  const cache = CacheService.getScriptCache(), hit = cache.get("mdt_dept"); if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const rows = actRows_(), forms = {}; getConfig_().forms.forEach(f => forms[f.id] = f.title);
  const now = Date.now(), day = 864e5, start = new Date(); start.setHours(0, 0, 0, 0);
  const wk = rows.filter(r => now - r.at < 7 * day), prev = rows.filter(r => now - r.at >= 7 * day && now - r.at < 14 * day);
  const active = {}; wk.forEach(r => (r.people || []).forEach(p => { if (p.i) active[p.i] = 1; }));
  const graded = rows.filter(r => r.grade && now - r.at < 30 * day && GRADE_PTS_[r.grade.toUpperCase()] != null);
  const avg = graded.length ? graded.reduce((t, r) => t + GRADE_PTS_[r.grade.toUpperCase()], 0) / graded.length : null;
  const letter = avg == null ? "—" : avg >= 3.85 ? "A" : avg >= 3.5 ? "A-" : avg >= 3.15 ? "B+" : avg >= 2.85 ? "B" : avg >= 2.5 ? "B-" : avg >= 2.15 ? "C+" : avg >= 1.85 ? "C" : avg >= 1.5 ? "C-" : avg >= 0.5 ? "D" : "F";
  const days = []; for (let i = 6; i >= 0; i--) { const a = start.getTime() - i * day, b = a + day; days.push({ d: new Date(a).toLocaleDateString("en-US", { weekday: "narrow" }), n: rows.filter(r => r.at >= a && r.at < b).length }); }
  let trainees = 0; try { const tid = rosterTabByName_(ONBOARD_TAB_); if (tid != null) trainees = (getRosterTab_(tid, false, [], false, true).people || []).length; } catch (e) {}
  const who = r => { const p = (r.people || [])[0]; return p ? clip_(p.n, 40) : "An officer"; };
  const tick = [];
  rows.slice(-25).forEach(r => { tick.push({ at: r.at, t: who(r) + " filed " + (forms[r.form] || r.form) }); if (r.grade && r.gradedAt) tick.push({ at: r.gradedAt, t: (r.gradedBy || "Command") + " graded " + (r.no || forms[r.form] || "a report") + " " + r.grade }); });
  tick.sort((a, b) => b.at - a.at);
  const out = { week: wk.length, delta: wk.length - prev.length, active: Object.keys(active).length, avg: letter, trainees: trainees, days: days, ticker: tick.slice(0, 12) };
  cache.put("mdt_dept", JSON.stringify(out), 120);
  return out;
}
function mdtMine_(acct, person) {
  const forms = {}; getConfig_().forms.forEach(f => forms[f.id] = f);
  const nk = person && person.name ? nameKey_(person.name) : "";
  return actRows_().filter(r => (r.people || []).some(p => (p.i && p.i === acct.id) || (!p.i && nk && nameKey_(p.n) === nk)))
    .sort((a, b) => b.at - a.at).slice(0, 6).map(r => ({ id: r.id, at: r.at, formTitle: forms[r.form] ? forms[r.form].title : r.form, icon: forms[r.form] ? forms[r.form].icon || "📄" : "📄", no: r.no, title: r.title,
      grade: r.grade, gradedBy: r.gradedBy, comments: clip_(r.comments, 160), tagged: !!((r.people || [])[0] && (r.people[0].i ? r.people[0].i !== acct.id : nameKey_(r.people[0].n) !== nk)) }));
}
// trainers (FTO and up): trainees who need something — overdue, close to the deadline, or ready for their final evaluation
function mdtNeeds_() {
  const out = [];
  try {
    programs_().forEach(pc => {
      if (!pc.on || !/onboard|recruit|cadet|trainee|probation|academy/i.test(pc.id + " " + pc.title + " " + (pc.rosterTabName || ""))) return;
      const v = promoView_(false, pc.id);
      (v.candidates || []).forEach(c => {
        if (c.complete) return;
        const finals = (v.tasks || []).filter(t => t.final), ready = finals.some(t => c.tasks[t.id] && !c.tasks[t.id].done && !c.tasks[t.id].locked);
        const open = (v.tasks || []).filter(t => !t.final && !(c.tasks[t.id] || {}).done);
        let why = "", hot = false, act = "";
        if (c.deadline && c.deadline.state === "over") { why = "Deadline passed · " + c.done + " of " + c.total + " done"; hot = true; act = "REVIEW"; }
        else if (ready) { why = "Ready for final evaluation"; act = "FINAL"; }
        else if (c.deadline && c.deadline.state === "warn") { why = c.deadline.left + " days left · " + (open[0] ? "needs " + open[0].title : c.done + " of " + c.total + " done"); hot = true; act = "HELP"; }
        else if (open.length) { const t = open[0], x = c.tasks[t.id] || {}; why = "Next: " + t.title + (t.need > 1 ? " (" + (x.count || 0) + "/" + t.need + ")" : ""); act = "TRAIN"; }
        if (why) out.push({ callsign: c.callsign, name: c.name, why: why, hot: hot, act: act, program: v.title, order: hot ? 0 : ready ? 1 : 2 });
      });
    });
  } catch (e) {}
  return out.sort((a, b) => a.order - b.order).slice(0, 8);
}
function mdtBoard_(acct, prof, person) {
  const lv = LEVELS_.indexOf(prof.level), briefs = briefAll_(), b = briefs[0] || null;
  return {
    briefing: b ? { id: b.id, at: b.at, from: b.from, to: b.to, re: b.re, body: b.body, acked: b.acks.indexOf(acct.id) !== -1, ackCount: lv >= LEVELS_.indexOf("command") ? b.acks.length : undefined } : null,
    past: briefs.slice(1, 6).map(x => ({ id: x.id, at: x.at, from: x.from, re: x.re, body: x.body })),
    canBrief: lv >= LEVELS_.indexOf("command"), canNotice: lv >= LEVELS_.indexOf("leader"), canRecords: lv >= LEVELS_.indexOf("officer"),
    notices: noticesActive_().map(x => ({ id: x.id, at: x.at, from: x.from, type: x.type, title: x.title, details: x.details, image: x.image, expires: x.expires })),
    mine: mdtMine_(acct, person), dept: mdtDept_(),
    needs: lv >= LEVELS_.indexOf("fto") ? mdtNeeds_() : null
  };
}
function mdtBrief_(d) {
  const acct = officerSession_(d.session); if (!acct) return { ok: false, error: "AUTH" };
  const prof = acctProfile_(acct);
  if (d.action === "mdtBriefAck") {
    return withLock_(() => { const b = briefAll_().find(x => x.id === str_(d.id)); if (!b) return { ok: false, error: "That briefing is gone." };
      if (b.acks.indexOf(acct.id) === -1) { b.acks.push(acct.id); briefSheet_().getRange(b.row, 7).setValue(JSON.stringify(b.acks)); }
      return { ok: true }; });
  }
  if (LEVELS_.indexOf(prof.level) < LEVELS_.indexOf("command")) return { ok: false, error: "Only command staff can post the shift briefing." };
  const re = clip_(str_(d.re), 120), body = clip_(str_(d.body), 3000), to = clip_(str_(d.to) || "All sworn personnel", 120);
  if (!re || !body) return { ok: false, error: "Add a subject and the briefing text." };
  const from = ((prof.title || "") + " " + voiceLast_(prof.name || "")).trim() + (prof.callsign ? " (" + prof.callsign + ")" : "");
  withLock_(() => { briefSheet_().appendRow([Utilities.getUuid().slice(0, 8), new Date(), cellSafe_(from), cellSafe_(to), cellSafe_(re), cellSafe_(body), "[]"]); return { ok: true }; });
  return { ok: true };
}

// ---- Records lookup (people & vehicles in every filed report), quick reference, BOLO / notices ----
const REC_PERSON_ = /name|suspect|victim|witness|officer|person|subject|driver|owner|complainant|offender|detainee|arrest|lead|assist|trainee|discord|\bid\b|dob|phone/i;
const REC_VEHICLE_ = /plate|vehicle|model|make|colou?r|vin|car|registration|reg\b/i;
function recordsSearch_(d) {
  const acct = officerSession_(d.session); if (!acct) return { ok: false, error: "AUTH" };
  if (LEVELS_.indexOf(acctProfile_(acct).level) < LEVELS_.indexOf("officer")) return { ok: false, error: "Records lookup is for sworn officers. Trainees get access when they're certified." };
  const q = str_(d.q).toLowerCase().trim(), kind = ["person", "vehicle"].indexOf(str_(d.kind)) !== -1 ? str_(d.kind) : "any";
  if (q.length < 2) return { ok: false, error: "Type at least 2 characters." };
  const cfg = getConfig_(), ss = ss_(), hits = [], subjects = {};
  cfg.forms.forEach(form => {
    const sh = ss.getSheetByName(clip_(str_(form.archiveSheet) || form.title || form.id, 90)); if (!sh || sh.getLastRow() < 2) return;
    const n = sh.getLastRow(), first = Math.max(2, n - 1999), lastCol = Math.min(sh.getLastColumn(), 60);
    const heads = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0], rows = sh.getRange(first, 1, n - first + 1, lastCol).getDisplayValues();
    const want = heads.map(hd => kind === "any" || (kind === "person" ? REC_PERSON_ : REC_VEHICLE_).test(hd));
    rows.forEach((r, i) => {
      const match = []; r.forEach((v, c) => { if (want[c] && v && v.toLowerCase().indexOf(q) !== -1) match.push({ label: heads[c] || "Field", value: clip_(v, 300) }); });
      if (!match.length) return;
      const at = (() => { for (let c = 0; c < Math.min(r.length, 4); c++) { const t = Date.parse(r[c]); if (!isNaN(t) && /\d{4}|\d{1,2}\/\d{1,2}/.test(r[c])) return t; } return 0; })();
      const fields = []; r.forEach((v, c) => { if (v && heads[c] && fields.length < 40) fields.push({ label: heads[c], value: clip_(v, 600) }); });
      hits.push({ form: form.title, icon: form.icon || "📄", row: first + i, at: at, match: match.slice(0, 4), fields: fields });
      match.forEach(m => { m.value.split(/[;,\n]/).map(x => x.trim()).filter(x => x.toLowerCase().indexOf(q) !== -1).forEach(x => { const k = x.toLowerCase().replace(/\s*\(\d{15,21}\)\s*$/, ""); subjects[k] = subjects[k] || { name: x.replace(/\s*\(\d{15,21}\)\s*$/, ""), n: 0, kind: REC_VEHICLE_.test(m.label) ? "vehicle" : "person" }; subjects[k].n++; }); });
    });
  });
  hits.sort((a, b) => b.at - a.at);
  return { ok: true, q: str_(d.q), kind: kind, total: hits.length, results: hits.slice(0, 40), subjects: Object.keys(subjects).map(k => subjects[k]).sort((a, b) => b.n - a.n).slice(0, 12) };
}
// penal code from every charge list in the forms: "Robbery (Felony, 18 Months - $9,000 Fine)"
function penalCode_() {
  const cfg = getConfig_(), seen = {}, out = [];
  const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === "object") Object.keys(x).forEach(k => walk(x[k])); else if (typeof x === "string" && /\d+\s*Months?|\$\s*[\d,]+\s*Fine/i.test(x)) {
    const key = x.trim().toLowerCase(); if (seen[key]) return; seen[key] = 1;
    const m = /(\d+)\s*Months?/i.exec(x), f = /\$\s*([\d,]+)\s*Fine/i.exec(x), cls = /\b(felony|misdemeanor|infraction|citation)\b/i.exec(x);
    out.push({ name: x.replace(/\s*\([^)]*(months?|fine)[^)]*\)\s*$/i, "").trim() || x.trim(), months: m ? +m[1] : 0, fine: f ? +f[1].replace(/,/g, "") : 0, cls: cls ? cls[1][0].toUpperCase() + cls[1].slice(1).toLowerCase() : "", raw: x.trim() }); } };
  walk(cfg.forms);
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
const TEN_CODES_ = [["10-1", "Weak signal"], ["10-3", "Stop transmitting"], ["10-4", "Acknowledged"], ["10-5", "Meal break"], ["10-6", "Busy"], ["10-7", "Out of service"], ["10-8", "In service"], ["10-9", "Repeat"],
  ["10-10", "Fight in progress"], ["10-11", "Traffic stop"], ["10-12", "Stand by"], ["10-13", "Shots fired"], ["10-15", "Prisoner in custody"], ["10-16", "Pick up prisoner"], ["10-19", "Return to station"], ["10-20", "Location"],
  ["10-23", "Arrived on scene"], ["10-26", "ETA"], ["10-28", "Plate check"], ["10-29", "Warrant check"], ["10-31", "Crime in progress"], ["10-32", "Requesting backup"], ["10-38", "Suspicious vehicle"], ["10-41", "Beginning tour of duty"],
  ["10-42", "Ending tour of duty"], ["10-50", "Vehicle accident"], ["10-52", "EMS needed"], ["10-55", "Intoxicated driver"], ["10-57", "Hit and run"], ["10-60", "Pursuit"], ["10-70", "Foot pursuit"], ["10-71", "Shooting"],
  ["10-78", "Officer needs assistance"], ["10-80", "Vehicle pursuit"], ["10-97", "En route"], ["10-99", "Officer down / emergency"], ["Code 1", "Routine, no lights"], ["Code 2", "Urgent, lights only"], ["Code 3", "Emergency, lights and siren"], ["Code 4", "Scene secure, no further help"]];
function chargeLists_() {
  const out = [];
  getConfig_().forms.forEach(f => (f.blocks || []).forEach(b => (b.columns || []).concat(b.fields || []).forEach(c => {
    const o = (c.options || []).map(str_).filter(Boolean), real = o.filter(x => !/^#\s*\S/.test(x));
    if (real.length >= 8 && real.filter(x => /\d+\s*Months?|\$\s*[\d,]+\s*Fine/i.test(x)).length >= real.length / 2) out.push({ form: f.title, label: c.label || b.title || "Charges", options: o });
  })));
  return out.sort((a, b) => b.options.length - a.options.length);
}
function quickRef_(d) {
  const acct = officerSession_(d.session); if (!acct) return { ok: false, error: "AUTH" };
  const s = getConfig_().settings || {}, lists = chargeLists_();
  return { ok: true, penal: penalCode_(), charges: lists.length ? lists[0] : null, tenCodes: Array.isArray(s.tenCodes) && s.tenCodes.length ? s.tenCodes : TEN_CODES_ };
}
const NOTICE_SHEET_ = "Notices", NOTICE_HEAD_ = ["ID", "Posted", "From", "Type", "Title", "Details", "Image", "Expires", "Closed"];
function noticeSheet_() {
  const ss = ss_(); let sh = ss.getSheetByName(NOTICE_SHEET_);
  if (!sh) { sh = ss.insertSheet(NOTICE_SHEET_); sh.appendRow(NOTICE_HEAD_); sh.setFrozenRows(1); sh.getRange(1, 1, 1, NOTICE_HEAD_.length).setFontWeight("bold"); }
  return sh;
}
function noticesActive_() {
  const sh = noticeSheet_(), n = sh.getLastRow(); if (n < 2) return [];
  const now = Date.now();
  return sh.getRange(2, 1, n - 1, 9).getValues().map((r, i) => ({ row: i + 2, id: str_(r[0]), at: isDate_(r[1]) ? r[1].getTime() : 0, from: str_(r[2]), type: str_(r[3]), title: str_(r[4]), details: str_(r[5]), image: str_(r[6]),
    expires: isDate_(r[7]) ? r[7].getTime() : 0, closed: r[8] === true || str_(r[8]).toUpperCase() === "TRUE" }))
    .filter(x => x.id && !x.closed && (!x.expires || x.expires > now)).reverse().slice(0, 20);
}
function mdtNotice_(d) {
  const acct = officerSession_(d.session); if (!acct) return { ok: false, error: "AUTH" };
  const prof = acctProfile_(acct);
  if (LEVELS_.indexOf(prof.level) < LEVELS_.indexOf("leader")) return { ok: false, error: "Division leaders and command staff post BOLOs and notices." };
  if (d.action === "mdtNoticeClose") return withLock_(() => { const x = noticesActive_().find(n => n.id === str_(d.id)); if (x) noticeSheet_().getRange(x.row, 9).setValue(true); return { ok: true }; });
  const type = ["BOLO", "Wanted", "Notice"].indexOf(str_(d.type)) !== -1 ? str_(d.type) : "Notice", title = clip_(str_(d.title), 120), details = clip_(str_(d.details), 2000);
  const img = /^https:\/\/\S+$/.test(str_(d.image)) ? clip_(str_(d.image), 500) : "", days = Math.min(30, Math.max(1, Number(d.days) || 7));
  if (!title) return { ok: false, error: "Give it a title." };
  const from = ((prof.title || "") + " " + voiceLast_(prof.name || "")).trim() + (prof.callsign ? " (" + prof.callsign + ")" : "");
  withLock_(() => { noticeSheet_().appendRow([Utilities.getUuid().slice(0, 8), new Date(), cellSafe_(from), type, cellSafe_(title), cellSafe_(details), img, new Date(Date.now() + days * 864e5), false]); return { ok: true }; });
  return { ok: true };
}

// can this officer file this form? level (minLevel) + division rosters (accessTabs; command and up see every division's forms)
// who's on a division roster tab: just the Discord IDs, kept in the cache for 6 hours (refreshed every 10 minutes)
function tabIds_(tabId, fresh) {
  const cache = CacheService.getScriptCache(), ck = "tabids_" + tabId;
  if (!fresh) { const hit = cache.get(ck); if (hit) { try { return JSON.parse(hit); } catch (e) {} } }
  let ids = []; try { ids = (getRosterTab_(tabId, !!fresh, [], false, true).people || []).map(p => p.id).filter(Boolean); } catch (e) { return []; }
  try { cache.put(ck, JSON.stringify(ids), 21600); } catch (e) {}
  return ids;
}
function formAllowed_(form, acct, prof) {
  const lv = LEVELS_.indexOf(prof.level);
  if (form.minLevel && lv < LEVELS_.indexOf(form.minLevel)) return false;
  if ((form.accessTabs || []).length && lv < LEVELS_.indexOf("command")) return form.accessTabs.some(t => tabIds_(t.id, false).indexOf(acct.id) !== -1 || hasDivRole_(acct.id, t.id));   // division roster, or the division's role in Discord
  return true;
}
// the CID Case File is always posted from the CID case builder page (also when the admin toggle is off)
function isCidApp_(f) { return !!(f && (f.cidApp || f.id === "cidcase")); }
function myForms_(acct, prof) {
  return getConfig_().forms.filter(f => (f.status === "live" || f.status === "soon") && formAllowed_(f, acct, prof))
    .map(f => ({ id: f.id, title: f.title, icon: f.icon || "📄", status: f.status, section: f.section || "", desc: clip_(str_(f.desc || f.subtitle), 140), cid: isCidApp_(f), division: (f.accessTabs || []).map(t => t.name).join(", ") }));
}
// =====================================================================
// DUTY FROM DISCORD: the server's own bot gives officers an "On Duty" role while they're on duty in game.
// No bot of ours: each officer's own Discord sign-in (scope guilds.members.read) lets the portal ask
// Discord for that officer's roles in the LSPD server. A trigger checks everyone every 15 minutes.
//   - sign-ins are kept in Script Properties only ("DLINK_<discordId>"), never in a sheet or a page
//   - who is on duty right now -> Script Property "DUTY_STATE" ({ id: [startMs, lastSeenMs] })
//   - finished duty sessions   -> "Duty Log" tab
// Times are accurate to about one check (15 minutes); on and off are both seen late, so lengths even out.
// =====================================================================
const DUTY_SHEET_ = "Duty Log", DUTY_EVERY_MIN_ = 15, DUTY_STALE_MS_ = 3 * 3600000;
function dutyCfg_() {
  const s = (getConfig_().settings || {}).duty || {};
  const id = v => /^\d{15,21}$/.test(str_(v)) ? str_(v) : "";
  return { on: !!s.on, roleId: id(s.roleId), roleName: str_(s.roleName), sopRoleId: id(s.sopRoleId) };
}
function dlinkSave_(id, tok) {
  if (!tok || !tok.refresh_token || !/^\d{15,21}$/.test(str_(id))) return;
  try { PROPS_.setProperty("DLINK_" + id, JSON.stringify({ a: tok.access_token, r: tok.refresh_token, x: Date.now() + (Number(tok.expires_in) || 604800) * 1000 - 3600000 })); } catch (e) {}
}
function dlinkHas_(id) { return !!PROPS_.getProperty("DLINK_" + str_(id)); }
// officers seen holding the SOP Certified role ({ id: first seen ms }); ticks the "SOP Certified" promotion requirement
function sopIds_() { try { return JSON.parse(PROPS_.getProperty("SOP_IDS") || "{}") || {}; } catch (e) { return {}; } }
function sopApply_(changes) {        // { id: true | false }
  const cur = sopIds_(); let changed = false;
  Object.keys(changes).forEach(id => { if (changes[id] && !cur[id]) { cur[id] = Date.now(); changed = true; } if (!changes[id] && cur[id]) { delete cur[id]; changed = true; } });
  if (changed) { PROPS_.setProperty("SOP_IDS", JSON.stringify(cur)); try { CacheService.getScriptCache().remove("promo_people"); } catch (e) {} }
}
// a working access token for this officer: "" = try again later, null = the link is gone (they removed the app)
function dlinkAccess_(id, link) {
  if (link.a && link.x > Date.now()) return link.a;
  const st = discordStatus_();
  const r = UrlFetchApp.fetch("https://discord.com/api/oauth2/token", { method: "post", muteHttpExceptions: true,
    payload: { client_id: st.clientId, client_secret: PROPS_.getProperty("DISCORD_CLIENT_SECRET"), grant_type: "refresh_token", refresh_token: link.r } });
  const c = r.getResponseCode();
  if (c === 200) { const t = JSON.parse(r.getContentText()); dlinkSave_(id, t); return t.access_token; }
  if (c === 400 || c === 401) { PROPS_.deleteProperty("DLINK_" + id); return null; }
  return "";
}
function dutyState_() { try { return JSON.parse(PROPS_.getProperty("DUTY_STATE") || "{}") || {}; } catch (e) { return {}; } }
function dutySheet_() {
  const ss = ss_(); let sh = ss.getSheetByName(DUTY_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(DUTY_SHEET_);
    sh.appendRow(["Logged", "Week Of", "Officer", "Discord ID", "On duty", "Off duty", "Minutes", "Hours", "Note"]);
    sh.setFrozenRows(1); sh.getRange(1, 1, 1, 9).setFontWeight("bold");
    sh.getRange("B:B").setNumberFormat("@"); sh.getRange("D:D").setNumberFormat("@");
  }
  return sh;
}
function dutyWho_(id) {
  const p = rosterPerson_(id); if (p) return { name: p.name || "", callsign: p.callsign || "", rank: p.rank || "" };
  const a = acctFind_(id); return { name: (a && (a.name || a.username)) || "", callsign: (a && a.callsign) || "", rank: "" };
}
// install or remove the 15-minute check
function dutyTrigger_(on) {
  const mine = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "dutyPoll");
  if (on && !mine.length) ScriptApp.newTrigger("dutyPoll").timeBased().everyMinutes(DUTY_EVERY_MIN_).create();
  if (!on) mine.forEach(t => ScriptApp.deleteTrigger(t));
}
function dutyPoll() {                                            // trigger entry point
  const cfg = dutyCfg_(), st = discordStatus_();
  if (!cfg.on || !(cfg.roleId || cfg.sopRoleId) || !st.guildId) return;
  const props = PROPS_.getProperties(), now = Date.now(), seen = {}, sop = {}, mem = {};   // id -> true (role), false (no role), null (couldn't tell)
  const ready = [];
  Object.keys(props).filter(k => /^DLINK_\d+$/.test(k)).forEach(k => {
    const id = k.slice(6); let link; try { link = JSON.parse(props[k]); } catch (e) { return; }
    let a = ""; try { a = dlinkAccess_(id, link); } catch (e) {}
    if (a) ready.push({ id: id, a: a }); else seen[id] = null;
  });
  let checked = 0, failed = 0;
  for (let i = 0; i < ready.length; i += 25) {
    const batch = ready.slice(i, i + 25);
    let rs = []; try { rs = UrlFetchApp.fetchAll(batch.map(b => ({ url: "https://discord.com/api/v10/users/@me/guilds/" + st.guildId + "/member", headers: { Authorization: "Bearer " + b.a }, muteHttpExceptions: true }))); } catch (e) { rs = []; }
    batch.forEach((b, k) => {
      const r = rs[k], c = r ? r.getResponseCode() : 0;
      if (c === 200) { let m = {}; try { m = JSON.parse(r.getContentText()); } catch (e) {} const roles = (m.roles || []).map(String);
        seen[b.id] = !!cfg.roleId && roles.indexOf(cfg.roleId) !== -1; if (cfg.sopRoleId) sop[b.id] = roles.indexOf(cfg.sopRoleId) !== -1; checked++;
        mem[b.id] = { n: str_(m.nick), r: roles, j: str_(m.joined_at).slice(0, 10), t: now }; }
      else if (c === 404) { seen[b.id] = false; if (cfg.sopRoleId) sop[b.id] = false; checked++; mem[b.id] = { g: 1, t: now }; }   // left the server
      else { seen[b.id] = null; failed++;
        if (c === 401) { try { const l = JSON.parse(props["DLINK_" + b.id]); l.x = 0; PROPS_.setProperty("DLINK_" + b.id, JSON.stringify(l)); } catch (e) {} } }   // refresh next time
    });
    if (i + 25 < ready.length) Utilities.sleep(1000);
  }
  const state = dutyState_(), done = [];
  Object.keys(seen).forEach(id => {
    const was = state[id];
    if (seen[id] === true) { if (was) was[1] = now; else state[id] = [now, now]; }
    else if (seen[id] === false && was) { done.push([id, was[0], now]); delete state[id]; }
  });
  Object.keys(state).forEach(id => {                             // unlinked, or unreadable for hours: close at the last time we saw them
    if (!(id in seen) || (seen[id] === null && now - state[id][1] > DUTY_STALE_MS_)) { done.push([id, state[id][0], state[id][1], "closed: couldn't check Discord"]); delete state[id]; }
  });
  PROPS_.setProperty("DUTY_STATE", JSON.stringify(state));
  try { sopApply_(sop); } catch (e) {}
  try { dmemWrite_(mem); } catch (e) {}
  PROPS_.setProperty("DUTY_LAST", JSON.stringify({ t: now, linked: ready.length + Object.keys(seen).filter(id => seen[id] === null && !ready.some(b => b.id === id)).length, checked: checked, failed: failed, onDuty: Object.keys(state).length }));
  if (done.length) dutyLog_(done);
}
function dutyLog_(done) {
  const ws = ((getConfig_().settings || {}).hours || {}).weekStart; const fmt = ms => Utilities.formatDate(new Date(ms), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  const rows = done.map(x => { const w = dutyWho_(x[0]), min = Math.max(0, Math.round((x[2] - x[1]) / 60000));
    return [new Date(), "'" + weekOf_(new Date(x[1]), ws == null ? 1 : ws), cellSafe_((w.callsign ? w.callsign + " | " : "") + w.name), "'" + x[0], fmt(x[1]), fmt(x[2]), min, Math.round(min / 6) / 10,
      x[3] || (min > 12 * 60 ? "Long shift - check" : min === 0 ? "Seen on duty once (under 15 min)" : "")]; });
  withLock_(() => { const sh = dutySheet_(); sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows); return { ok: true }; });
  try { CacheService.getScriptCache().remove("duty_sum"); } catch (e) {}
}
function dutyAdmin_() {
  const c = dutyCfg_(); let last = {}; try { last = JSON.parse(PROPS_.getProperty("DUTY_LAST") || "{}"); } catch (e) {}
  const linked = Object.keys(PROPS_.getProperties()).filter(k => /^DLINK_\d+$/.test(k)).length;
  let warm = null; try { warm = JSON.parse(PROPS_.getProperty("WARM_LAST") || "null"); } catch (e) {}
  return { warm: warm, on: c.on, roleId: c.roleId, roleName: c.roleName, sopRoleId: c.sopRoleId, sopCount: Object.keys(sopIds_()).length, guildId: discordStatus_().guildId, linked: linked, last: last, board: c.on && c.roleId ? dutyBoard_() : null,
    trigger: (() => { try { return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === "dutyPoll"); } catch (e) { return null; } })() };
}
// ---- what Discord says about each connected officer: nickname, role IDs, join date (hidden "Discord Members" tab) ----
const DMEM_SHEET_ = "Discord Members";
function dmemSheet_() {
  const ss = ss_(); let sh = ss.getSheetByName(DMEM_SHEET_);
  if (!sh) { sh = ss.insertSheet(DMEM_SHEET_); sh.appendRow(["Discord ID", "Server nickname", "Role IDs", "Joined server", "Checked", "In LSPD Discord"]);
    sh.setFrozenRows(1); sh.getRange(1, 1, 1, 6).setFontWeight("bold"); sh.getRange("A:A").setNumberFormat("@"); sh.getRange("C:C").setNumberFormat("@"); try { sh.hideSheet(); } catch (e) {} }
  return sh;
}
var DMEM_MEMO_ = null;
function dmemAll_() {           // { id: { n: nickname, r: [roleIds], j: "yyyy-mm-dd", t: checkedMs, g: 1 if they left the server } }
  if (DMEM_MEMO_) return DMEM_MEMO_;
  const cache = CacheService.getScriptCache(), hit = cache.get("dmem");
  if (hit) { try { return (DMEM_MEMO_ = JSON.parse(hit)); } catch (e) {} }
  const out = {}; const sh = ss_().getSheetByName(DMEM_SHEET_);
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(r => { const id = str_(r[0]).replace(/^'/, ""); if (!/^\d{15,21}$/.test(id)) return;
    out[id] = { n: str_(r[1]), r: str_(r[2]).split(",").map(x => x.trim()).filter(Boolean), j: str_(r[3]), t: isDate_(r[4]) ? r[4].getTime() : 0 }; if (str_(r[5]).toLowerCase() === "no") out[id].g = 1; });
  try { const js = JSON.stringify(out); if (js.length < 95000) cache.put("dmem", js, 21600); } catch (e) {}
  return (DMEM_MEMO_ = out);
}
function dmemWrite_(changes) {
  const ids = Object.keys(changes || {}); if (!ids.length) return;
  withLock_(() => {
    DMEM_MEMO_ = null; try { CacheService.getScriptCache().remove("dmem"); } catch (e) {}
    const cur = dmemAll_(); ids.forEach(id => { cur[id] = changes[id].g ? Object.assign({}, cur[id] || { r: [] }, { g: 1, t: changes[id].t }) : changes[id]; });
    const rows = Object.keys(cur).map(id => { const m = cur[id]; return ["'" + id, cellSafe_(m.n || ""), "'" + (m.r || []).join(","), m.j || "", m.t ? new Date(m.t) : "", m.g ? "No" : "Yes"]; });
    const sh = dmemSheet_(); if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 6).setValues(rows);
    DMEM_MEMO_ = null; try { CacheService.getScriptCache().remove("dmem"); } catch (e) {}
    return { ok: true };
  });
}
// ---- role map: which Discord role ID means which rank / division (admin confirms; the portal suggests) ----
//   settings.roleMap = { "<roleId>": { kind: "rank", rank: 3 } | { kind: "div", tab: <roster tab id>, name } | { kind: "lspd" } | { kind: "ignore" } }
function roleMap_() { return ((getConfig_().settings || {}).roleMap) || {}; }
function divTabs_() {           // the division rosters that restricted reports use (Admin -> Forms -> who can file)
  const seen = {}, out = []; getConfig_().forms.forEach(f => (f.accessTabs || []).forEach(t => { if (t && t.id != null && !seen[t.id]) { seen[t.id] = 1; out.push({ id: t.id, name: str_(t.name) }); } }));
  return out;
}
function hasDivRole_(discordId, tabId) {
  const map = roleMap_(), m = dmemAll_()[str_(discordId)]; if (!m || m.g) return false;
  return (m.r || []).some(r => map[r] && map[r].kind === "div" && String(map[r].tab) === String(tabId));
}
function roleSuggest_() {
  const mem = dmemAll_(), map = roleMap_(), dc = dutyCfg_(), people = promoPeople_(), byId = {}; people.forEach(o => byId[o.id] = o);
  const ids = Object.keys(mem).filter(id => !mem[id].g), tabs = divTabs_(), tabSets = {};
  tabs.forEach(t => { const set = {}; tabIds_(t.id, false).forEach(x => set[x] = 1); tabSets[t.id] = set; });
  const holders = {}; ids.forEach(id => (mem[id].r || []).forEach(r => (holders[r] = holders[r] || []).push(id)));
  const onRoster = ids.filter(id => byId[id]).length;
  return Object.keys(holders).map(rid => {
    const H = holders[rid], n = H.length, row = { id: rid, holders: n, map: map[rid] || null, sample: H.slice(0, 4).map(id => { const o = byId[id]; return o ? (o.callsign ? o.callsign + " " : "") + o.name : (mem[id].n || id); }) };
    if (rid === dc.roleId) { row.special = "On Duty"; return row; }
    if (rid === dc.sopRoleId) { row.special = "SOP Certified"; return row; }
    let best = null;
    const rk = {}; H.forEach(id => { const o = byId[id]; if (o && o.idx >= 0) rk[o.idx] = (rk[o.idx] || 0) + 1; });
    Object.keys(rk).forEach(k => { const hit = rk[k], score = hit / n; if (hit >= 2 && score >= 0.7 && (!best || score > best.score)) best = { kind: "rank", rank: Number(k), score: score, why: hit + " of " + n + " holders are " + RANKS_[k] + " on the roster" }; });
    tabs.forEach(t => { const hit = H.filter(id => tabSets[t.id][id]).length, score = hit / n; if (hit >= 2 && score >= 0.7 && (!best || score > best.score + 0.05)) best = { kind: "div", tab: t.id, name: t.name, score: score, why: hit + " of " + n + " holders are on " + t.name }; });
    if (onRoster >= 5 && n >= onRoster * 0.8) { const hit = H.filter(id => byId[id]).length; if (!best || n > 15) best = { kind: "lspd", score: hit / n, why: "held by " + n + " of " + ids.length + " connected officers" }; }
    row.suggest = best; return row;
  }).sort((a, b) => b.holders - a.holders);
}
// ---- roster vs Discord audit ----
function discordAudit_() {
  const mem = dmemAll_(), map = roleMap_(), people = promoPeople_(), tabs = divTabs_(), tabSets = {}, tabName = {};
  tabs.forEach(t => { const set = {}; tabIds_(t.id, false).forEach(x => set[x] = 1); tabSets[t.id] = set; tabName[t.id] = t.name; });
  const rankRoles = Object.keys(map).filter(r => map[r].kind === "rank"), divRoles = Object.keys(map).filter(r => map[r].kind === "div"), lspdRoles = Object.keys(map).filter(r => map[r].kind === "lspd");
  const issues = [], notConnected = [], seen = {};
  people.forEach(o => {
    seen[o.id] = 1; const m = mem[o.id], who = { id: o.id, callsign: o.callsign, name: o.name, rank: o.rank };
    if (!m) { notConnected.push(who); return; }
    const p = [];
    if (m.g) p.push("Not in the LSPD Discord any more");
    else {
      const R = m.r || [];
      if (lspdRoles.length && !lspdRoles.some(r => R.indexOf(r) !== -1)) p.push("Missing the LSPD role in Discord");
      if (rankRoles.length && o.idx >= 0 && !o.trainee) {
        const held = rankRoles.filter(r => R.indexOf(r) !== -1).map(r => map[r].rank), mapped = rankRoles.some(r => map[r].rank === o.idx);
        if (held.indexOf(o.idx) === -1 && (held.length || mapped)) p.push("Roster: " + RANKS_[o.idx] + " · Discord: " + (held.length ? held.map(i => RANKS_[i]).join(", ") : "no rank role"));
      }
      divRoles.forEach(r => { const t = map[r].tab, has = R.indexOf(r) !== -1, on = !!(tabSets[t] && tabSets[t][o.id]), nm = str_(tabName[t] || map[r].name || "division").replace(/\s*-?\s*roster\s*$/i, "").trim() || "division";
        if (has && !on) p.push("Has the " + nm + " role, not on the " + nm + " roster");
        if (!has && on) p.push("On the " + nm + " roster, no " + nm + " role in Discord"); });
    }
    if (p.length) issues.push(Object.assign(who, { problems: p, nick: m.n || "" }));
  });
  Object.keys(mem).forEach(id => { if (seen[id] || mem[id].g) return; const R = mem[id].r || [];
    if (lspdRoles.some(r => R.indexOf(r) !== -1) || rankRoles.some(r => R.indexOf(r) !== -1)) issues.push({ id: id, callsign: "", name: mem[id].n || id, rank: "", nick: mem[id].n || "", problems: ["Has LSPD roles in Discord but isn't on the roster"] }); });
  return { issues: issues, notConnected: notConnected, connected: Object.keys(mem).length, rosterCount: people.length, mapped: { rank: rankRoles.length, div: divRoles.length, lspd: lspdRoles.length } };
}
// ---- an officer's own duty time: last shift, this week, the last 14 days (from the Duty Log) ----
function dutySums_() {
  const cache = CacheService.getScriptCache(), hit = cache.get("duty_sum");
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const out = {}, sh = ss_().getSheetByName(DUTY_SHEET_), since = Date.now() - 35 * 864e5;
  if (sh && sh.getLastRow() > 1) { const from = Math.max(2, sh.getLastRow() - 4000 + 1);
    const ms = v => isDate_(v) ? v.getTime() : new Date(str_(v).replace(" ", "T")).getTime();    // the sheet turns "yyyy-MM-dd HH:mm" into a date
    sh.getRange(from, 1, sh.getLastRow() - from + 1, 7).getValues().forEach(r => {
      const id = str_(r[3]).replace(/^'/, ""), st = ms(r[4]), en = ms(r[5]), min = Number(r[6]) || 0;
      if (!id || isNaN(st) || st < since) return; (out[id] = out[id] || []).push([st, en, min]); }); }
  try { const js = JSON.stringify(out); if (js.length < 95000) cache.put("duty_sum", js, 3600); } catch (e) {}
  return out;
}
function dutyMine_(id, cur) {
  const s = (getConfig_().settings || {}), g = s.duty || {}, goalH = Number(g.goalHours) || 8, goalD = Number(g.goalDays) || 14, now = Date.now();
  const L = (dutySums_()[id] || []).slice().sort((a, b) => b[0] - a[0]), ws = (s.hours || {}).weekStart, wk0 = parseYmd_(weekOf_(new Date(), ws == null ? 1 : ws)); wk0.setHours(0, 0, 0, 0);
  const sum = from => L.filter(x => x[0] >= from).reduce((t, x) => t + x[2], 0), live = cur ? Math.round((now - cur[0]) / 60000) : 0;
  return { last: L[0] ? { start: L[0][0], end: L[0][1], minutes: L[0][2] } : null, week: sum(wk0.getTime()) + live, window: sum(now - goalD * 864e5) + live, live: live, goalMinutes: goalH * 60, goalDays: goalD };
}
// who's on duty right now (for the MDT and admin)
function dutyBoard_() {
  const cfg = dutyCfg_(); if (!cfg.on || !cfg.roleId) return null;
  const state = dutyState_(), now = Date.now();
  let last = {}; try { last = JSON.parse(PROPS_.getProperty("DUTY_LAST") || "{}"); } catch (e) {}
  const list = Object.keys(state).map(id => { const w = dutyWho_(id), ri = rankIndex_(w.rank);
      return { id: id, name: w.name, callsign: w.callsign, rank: w.rank, sup: ri >= 4, since: state[id][0], minutes: Math.round((now - state[id][0]) / 60000) }; })
    .sort((a, b) => (b.sup - a.sup) || (a.since - b.since));
  return { on: true, every: DUTY_EVERY_MIN_, checkedAt: last.t || 0, list: list, supervisors: list.filter(o => o.sup).length };
}
function officerHome_(d) {
  const acct = officerSession_(d.session); if (!acct) return { ok: false, error: "AUTH" };
  mark_("session"); const person = rosterPerson_(acct.id); mark_("roster"); const prof = acctProfile_(acct); mark_("profile"); const s = getConfig_().settings || {};
  const out = { ok: true, profile: prof, sop: str_(s.sopUrl) || SOP_URL_DEFAULT_ };
  out.paths = myPaths_(person); mark_("paths");
  out.fleet = fleetFor_(person && person.rank, person && person.onboarding); mark_("fleet");
  out.board = mdtBoard_(acct, prof, person); mark_("board");
  out.forms = myForms_(acct, prof); mark_("forms");
  out.ladder = (() => { try { return promoReqParse_(false); } catch (e) { return null; } })(); mark_("ladder");
  out.promoMe = promoMine_(acct); mark_("promo");
  out.race = officerRace_(acct); mark_("race");
  try { const b = dutyBoard_(); if (b) { const cur = dutyState_()[acct.id]; b.linked = dlinkHas_(acct.id); b.me = !!cur; b.mine = dutyMine_(acct.id, cur); out.duty = b; } } catch (e) {} mark_("duty");
  return out;
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
  // full words and the usual roster abbreviations (Sgt., Cpl, Lt, SSgt, PO II…); the most senior match wins
  const r = " " + str_(rank).toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim() + " ";
  if (!r.trim()) return "";
  const T = [[/ (sergeant major|sgt ?maj|sgm|sgtmaj) /, "Sergeant Major"], [/ (assistant chief|asst chief|aoc|a c o p) /, "Assistant Chief"], [/ (deputy chief|dep chief|doc) /, "Deputy Chief"],
    [/ (chief|cop) /, "Chief"], [/ (commander|cmdr|cdr) /, "Commander"], [/ (major|maj) /, "Major"], [/ (captain|capt|cpt) /, "Captain"],
    [/ (lieutenant|lieut|lt|1st lt|2nd lt) /, "Lieutenant"], [/ (staff sergeant|staff sgt|ssgt|s sgt) /, "Staff Sergeant"], [/ (sergeant|sgt) /, "Sergeant"],
    [/ (corporal|cpl) /, "Corporal"], [/ (detective|det) /, "Detective"],
    [/ (officer|ofc|off|po|po ?i+|po ?[123]|recruit|cadet|trainee|probationary|probie|rookie) /, "Officer"]];
  for (let i = 0; i < T.length; i++) if (T[i][0].test(r)) return T[i][1];
  // plural section headings ("SERGEANTS", "CORPORALS")
  const pl = r.replace(/s /g, " ");
  if (pl !== r) for (let i = 0; i < T.length; i++) if (T[i][0].test(pl)) return T[i][1];
  return "";
}
function voiceTitleFor_(person) {
  if (!person) return "";
  if (person.onboarding) return "Probationary Officer";     // everyone on the LSPD Onboarding Roster
  return voiceTitle_(person.rank) || voiceTitle_(person.section);
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
  return ((str_(acct.rankAs) || voiceTitleFor_(person) || "Officer") + (last ? " " + last : "")).replace(/[^A-Za-z0-9 '\-]/g, "").trim() + ".";
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
  if (a === "officerHome") return officerHome_(d);
  if (a === "promoBoard" || a === "promoCheck") return promoTrack_(d);
  if (a === "builderLog") return builderLog_(d);
  if (/^unit(View|Kudos|Award|Session|Join|SessionClose|CheckSave|CheckTake|CheckClose)$/.test(a)) return unitAct_(d);
  if (a === "mdtBriefPost" || a === "mdtBriefAck") return mdtBrief_(d);
  if (a === "recordsSearch") return recordsSearch_(d);
  if (a === "quickRef") return quickRef_(d);
  if (a === "mdtNoticePost" || a === "mdtNoticeClose") return mdtNotice_(d);

  if (d.session && (/^div(View|Report|Grade|Overview)$/.test(a) || /^hq(Post|Ack|Reply|Pin|Delete|Goal)$/.test(a))) return divOfficer_(d);

  const me = sessionAdmin_(d.token);
  if (!me) return { ok: false, error: "AUTH", message: "Your session expired. Please log in again." };
  const isOwner = me.role === "owner";
  const ownerOnly = () => { if (!isOwner) throw new Error("Only an owner can manage admin accounts."); };
  // division leaders: the Division Command page only (no forms, settings, webhooks or accounts)
  if (me.role === "leader" && !LEADER_ACTIONS_[a]) throw new Error("Division leader accounts can only use the Division Command page.");
  if (a === "divView") return divView_(d, me);
  if (a === "divOverview") return divOverview_(null, { username: me.username, role: me.role, key: "admin:" + me.username });
  if (/^hq(Post|Ack|Reply|Pin|Delete|Goal)$/.test(a)) { const hm = { username: me.username, role: me.role === "leader" ? "leader" : "admin", key: "admin:" + me.username }; const r = hqAct_(d, hm, me.role === "leader" ? [] : null); return r.ok ? divOverview_(null, hm) : r; }
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
    case "acctList": return { ok: true, accounts: acctList_(), discord: discordStatus_(), voice: voiceStatus_(), signon: signonCfg_(), divisionList: divList_() };
    case "acctDivisions": {      // which divisions a Leader runs in Division Command
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can assign divisions.");
      const acct = acctFind_(d.discordId); if (!acct) throw new Error("Account not found.");
      const all = divList_().map(x => x.id), ids = (Array.isArray(d.divisions) ? d.divisions : []).map(str_).filter(id => all.indexOf(id) !== -1);
      withLock_(() => { acctSheet_().getRange(acct.row, 15).setValue(ids.join(", ")); return { ok: true }; });
      logAdmin_(me.username, "officer account", "divisions " + str_(d.discordId) + " -> " + (ids.join(", ") || "none"));
      return { ok: true, accounts: acctList_() };
    }
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
      if (a === "acctSayAs") withLock_(() => { const sh = acctSheet_(); sh.getRange(acct.row, 13).setValue(cellSafe_(clip_(str_(d.sayAs), 60)));
        if (d.rankAs != null) sh.getRange(acct.row, 14).setValue(cellSafe_(clip_(str_(d.rankAs).replace(/[^A-Za-z '\-]/g, "").trim(), 40))); return { ok: true }; });
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
    case "fleetAdmin": {         // owner/admin: every vehicle and outfit read from the sheet, with photo links
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can manage Fleet & Uniforms.");
      const f = fleetParse_(!!d.fresh), s = getConfig_().settings || {};
      return { ok: true, fleet: f, photos: s.fleetPhotos || {}, sop: str_(s.sopUrl) || SOP_URL_DEFAULT_, ladder: (() => { try { return promoReqParse_(!!d.fresh); } catch (e) { return { tab: "", ranks: [], notes: [], error: errMsg_(e) }; } })() };
    }
    case "promoDocSet": {
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can change this.");
      const u = str_(d.url); if (u && !promoDocId_(u)) throw new Error("Paste the Google Doc's link (docs.google.com/document/d/…).");
      withLock_(() => { const cfg = getConfig_(); cfg.settings = cfg.settings || {}; cfg.settings.promoDocUrl = u; cfg.version = (Number(cfg.version) || 0) + 1; writeConfig_(cfg, me.username); return { ok: true }; });
      logAdmin_(me.username, "promotion guidelines doc", u || "(default)");
      try { CacheService.getScriptCache().remove("promoreq_v2"); } catch (e) {}
      return { ok: true, ladder: promoReqParse_(true) };
    }
    case "fleetPhoto": case "sopSet": {
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can change this.");
      return withLock_(() => {
        const cfg = getConfig_(); cfg.settings = cfg.settings || {};
        if (a === "sopSet") { const u = str_(d.url); if (u && !/^https:\/\//.test(u)) throw new Error("Use an https:// link."); cfg.settings.sopUrl = u; }
        else { const u = str_(d.url), k = str_(d.key); if (!k) throw new Error("Missing card."); if (u && !/^https:\/\//.test(u)) throw new Error("Use an https:// image link (imgur works well).");
          cfg.settings.fleetPhotos = cfg.settings.fleetPhotos || {}; if (u) cfg.settings.fleetPhotos[k] = clip_(u, 500); else delete cfg.settings.fleetPhotos[k]; }
        cfg.version = (Number(cfg.version) || 0) + 1; writeConfig_(cfg, me.username);
        logAdmin_(me.username, a === "sopSet" ? "SOP link" : "fleet photo", a === "sopSet" ? str_(d.url) : str_(d.key));
        return { ok: true, photos: cfg.settings.fleetPhotos || {}, sop: str_(cfg.settings.sopUrl) || SOP_URL_DEFAULT_ };
      });
    }
    case "builderStatus": return { ok: true, builder: builderStatus_() };
    case "extrasStatus": return { ok: true, dm: { on: PROPS_.getProperty("DM_ON") === "1", hasToken: !!PROPS_.getProperty("BOT_TOKEN") }, digest: { on: PROPS_.getProperty("DIGEST_ON") === "1", hasHook: !!PROPS_.getProperty("DIGEST_WEBHOOK_URL") } };
    case "extrasSetup": {        // owner: weekly digest webhook/switch, Discord DM bot token/switch
      ownerOnly();
      if (d.digestHook != null && str_(d.digestHook)) { if (!/^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\//.test(str_(d.digestHook))) throw new Error("That isn't a Discord webhook link."); PROPS_.setProperty("DIGEST_WEBHOOK_URL", str_(d.digestHook)); }
      if (d.digestOn != null) { PROPS_.setProperty("DIGEST_ON", d.digestOn ? "1" : ""); digestTrigger_(!!d.digestOn); }
      if (d.botToken != null && str_(d.botToken)) PROPS_.setProperty("BOT_TOKEN", str_(d.botToken));
      if (d.dmOn != null) PROPS_.setProperty("DM_ON", d.dmOn ? "1" : "");
      if (d.clearBot) { PROPS_.deleteProperty("BOT_TOKEN"); PROPS_.setProperty("DM_ON", ""); }
      logAdmin_(me.username, "extras", "digest " + (PROPS_.getProperty("DIGEST_ON") ? "on" : "off") + " · DMs " + (PROPS_.getProperty("DM_ON") ? "on" : "off"));
      return { ok: true, dm: { on: PROPS_.getProperty("DM_ON") === "1", hasToken: !!PROPS_.getProperty("BOT_TOKEN") }, digest: { on: PROPS_.getProperty("DIGEST_ON") === "1", hasHook: !!PROPS_.getProperty("DIGEST_WEBHOOK_URL") } };
    }
    case "digestTest": { ownerOnly(); return digestPost_(true); }
    case "builderSetup": {
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can change this.");
      return builderSetup_(me, d.on == null ? null : !!d.on);
    }
    case "formAccess": {         // owner/admin: who can file a form (Permissions page)
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can change permissions.");
      return withLock_(() => {
        const cfg = getConfig_(), f = cfg.forms.find(x => x.id === str_(d.formId)); if (!f) throw new Error("Form not found.");
        const lv = str_(d.minLevel); f.minLevel = ["officer", "fto", "leader", "command", "admin"].indexOf(lv) === -1 ? "" : lv;
        if (Array.isArray(d.accessTabs)) f.accessTabs = d.accessTabs.filter(t => t && !isNaN(Number(t.id))).slice(0, 12).map(t => ({ id: Number(t.id), name: clip_(str_(t.name), 100) }));
        cfg.version = (Number(cfg.version) || 0) + 1; writeConfig_(cfg, me.username);
        logAdmin_(me.username, "permissions", f.title + " -> " + (f.minLevel || "everyone") + ((f.accessTabs || []).length ? " · " + f.accessTabs.map(t => t.name).join(", ") : ""));
        return { ok: true, config: cfg };
      });
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
    case "dutySetup": {          // On Duty role from the server's own bot -> automatic duty hours
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can change this.");
      const rid = str_(d.roleId), sid = str_(d.sopRoleId), bad = x => x && !/^\d{15,21}$/.test(x);
      if (bad(rid) || bad(sid)) throw new Error("A role ID is a long number (Discord Developer Mode → right-click the role → Copy Role ID).");
      if (d.on && !rid && !sid) throw new Error("Paste the On Duty role ID first.");
      if (d.on && !discordStatus_().guildId) throw new Error("Add the LSPD Discord server ID under Sign in with Discord first.");
      const r = withLock_(() => { const cfg = getConfig_(); cfg.settings = cfg.settings || {};
        cfg.settings.duty = { on: !!d.on, roleId: rid, roleName: clip_(str_(d.roleName), 40), sopRoleId: sid };
        cfg.version = (Number(cfg.version) || 0) + 1; writeConfig_(cfg, me.username); return { ok: true }; });
      if (!r.ok) return r;
      try { dutyTrigger_(!!d.on); } catch (e) { return { ok: true, duty: dutyAdmin_(), warn: "Saved, but Google hasn't approved the background timer yet. In Apps Script, run authorizeAll once and press Allow." }; }
      logAdmin_(me.username, "duty tracking", (d.on ? "on" : "off") + (rid ? " role " + rid : ""));
      return { ok: true, duty: dutyAdmin_() };
    }
    case "dutyAdmin": return { ok: true, duty: dutyAdmin_() };
    case "roleMapAdmin": if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can see this."); return { ok: true, roles: roleSuggest_(), ranks: RANKS_, tabs: divTabs_(), connected: Object.keys(dmemAll_()).length };
    case "roleMapSave": {
      if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can change this.");
      const inMap = d.map || {}, out = {}, tabs = divTabs_();
      Object.keys(inMap).forEach(rid => { if (!/^\d{15,21}$/.test(rid)) return; const v = inMap[rid] || {};
        if (v.kind === "rank" && Number(v.rank) >= 0 && Number(v.rank) < RANKS_.length) out[rid] = { kind: "rank", rank: Number(v.rank) };
        else if (v.kind === "div") { const t = tabs.find(x => String(x.id) === String(v.tab)); if (t) out[rid] = { kind: "div", tab: t.id, name: t.name }; }
        else if (v.kind === "lspd" || v.kind === "ignore") out[rid] = { kind: v.kind }; });
      const r = withLock_(() => { const cfg = getConfig_(); cfg.settings = cfg.settings || {}; cfg.settings.roleMap = out; cfg.version = (Number(cfg.version) || 0) + 1; writeConfig_(cfg, me.username); return { ok: true }; });
      if (!r.ok) return r;
      logAdmin_(me.username, "Discord role map", Object.keys(out).length + " roles");
      return { ok: true, roles: roleSuggest_(), ranks: RANKS_, tabs: divTabs_(), connected: Object.keys(dmemAll_()).length };
    }
    case "discordAudit": if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can see this."); return Object.assign({ ok: true }, discordAudit_());
    case "dutyCheckNow": { if (["owner", "admin"].indexOf(me.role) === -1) throw new Error("Only an owner or admin can do this."); dutyPoll(); return { ok: true, duty: dutyAdmin_() }; }
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
  out.settings.sopUrl = /^https:\/\//.test(str_(s.sopUrl)) ? clip_(str_(s.sopUrl), 500) : "";
  out.settings.fleetPhotos = {}; Object.keys(s.fleetPhotos || {}).slice(0, 300).forEach(k => { const u = str_(s.fleetPhotos[k]); if (/^[uv]:/.test(k) && /^https:\/\//.test(u)) out.settings.fleetPhotos[clip_(k, 120)] = clip_(u, 500); });
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
      if (b.when) { if (str_(b.when.field)) b.when = { field: str_(b.when.field), is: (Array.isArray(b.when.is) ? b.when.is : []).map(x => clip_(str_(x), 120)).filter(Boolean).slice(0, 20) }; else delete b.when; }
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
    f.minLevel = ["officer", "fto", "leader", "command", "admin"].indexOf(str_(f.minLevel)) === -1 ? "" : str_(f.minLevel);
    f.accessTabs = (Array.isArray(f.accessTabs) ? f.accessTabs : []).filter(t => t && t.id !== "" && t.id != null && !isNaN(Number(t.id))).slice(0, 12).map(t => ({ id: Number(t.id), name: clip_(str_(t.name), 100) }));   // only officers on these roster tabs (divisions) can file it   // who can file it (blank = everyone, trainees included)
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
