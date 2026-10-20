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
 *
 * FIRST ADMIN: open the Google Sheet, menu "🚔 LSPD Portal" > "Create / reset admin account".
 * Webhook URLs never belong in this file (it is stored on GitHub).
 */

const PROPS_ = PropertiesService.getScriptProperties();
const CONFIG_SHEET_ = "Portal Config";
const ADMINS_SHEET_ = "Portal Admins";
const LOG_SHEET_    = "Admin Log";
const LB_SHEET_     = "Leaderboard Log";
const SESSION_SECONDS_ = 6 * 60 * 60;   // admin login lasts 6 hours of inactivity
const MAX_LOGIN_FAILS_ = 5;             // then locked for 15 minutes

// =====================================================================
// ENTRY POINTS
// =====================================================================
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || "";
    if (action === "config") return json_({ ok: true, config: publicConfig_() });
    return json_({ ok: true, service: "LSPD Forms Portal" });
  } catch (err) {
    return json_({ ok: false, error: errMsg_(err) });
  }
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "Bad request." }); }
  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); } catch (err) { return json_({ ok: false, error: "Server busy, please press Submit again." }); }
  try {
    if (d.action) return json_(handleAdmin_(d));
    return json_(handleSubmit_(d));
  } catch (err) {
    return json_({ ok: false, error: errMsg_(err) });
  } finally {
    lock.releaseLock();
  }
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
function publicConfig_() {
  const cfg = getConfig_();
  return {
    version: cfg.version,
    settings: cfg.settings,
    forms: cfg.forms.filter(f => f.status !== "hidden")
  };
}

// =====================================================================
// WEBHOOKS (Script Properties, never sent to the website)
// =====================================================================
const LEGACY_WEBHOOK_KEYS_ = { "academy-forum": "FORUM_WEBHOOK_URL", "leaderboard": "LEADERBOARD_WEBHOOK_URL", "cid-forum": "CID_WEBHOOK_URL" };
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

  // ---- build Discord content ----
  const embedFields = [], followTexts = [], archiveCols = [];
  form.blocks.forEach(b => {
    if (b.type === "fields" || b.type === "strip") {
      (b.fields || []).forEach(f => {
        if (f.type === "static") return;
        const v = str_(values[f.id]);
        embedFields.push({ name: clip_(f.label || f.id, 256), value: clip_(displayValue_(f, v), 1024), inline: true });
        archiveCols.push({ id: f.id, label: f.label || f.id, value: v });
      });
    } else if (b.type === "checklist") {
      const st = checklists[b.id] || {};
      const items = b.items || [];
      const done = items.filter(it => st[it.topic] === true).length;
      addListFields_(embedFields, "📘 " + clip_(b.title || "Checklist", 230) + " (" + done + "/" + items.length + ")",
        items.map(it => (st[it.topic] === true ? "✅" : "❌") + " `" + clip_(it.topic, 120) + "`"));
      archiveCols.push({ id: b.id, label: b.title || b.id, value: done + "/" + items.length + " done" +
        (done < items.length ? " | missing: " + items.filter(it => st[it.topic] !== true).map(it => it.topic).join(", ") : "") });
    } else if (b.type === "repeater") {
      const rows = (repeaters[b.id] || []).filter(r => (b.columns || []).some(c => c.type !== "select" && str_(r[c.id])));
      const lines = rows.map((r, i) => {
        const parts = (b.columns || []).map((c, ci) => {
          const v = str_(r[c.id]) || "—";
          return ci === 0 ? "**" + v + "**" : v;
        });
        let line = "`" + (i + 1) + "` " + parts.join(" · ");
        if (b.check && b.check.id) line += r[b.check.id] ? " ✅ " + (b.check.label || "") : " ▫️ no " + (b.check.label || "check");
        return clip_(line, 1000);
      });
      addListFields_(embedFields, clip_(b.title || "List", 240), lines);
      archiveCols.push({ id: b.id, label: b.title || b.id, value: rows.map(r => (b.columns || []).map(c => str_(r[c.id])).filter(Boolean).join(" / ") + (b.check && r[b.check.id] ? " [" + b.check.label + "]" : "")).join("; ") });
    } else if (b.type === "longtext") {
      const v = str_(values[b.id]).substring(0, b.maxLength || 8000);
      if (b.followUp) {
        if (v) followTexts.push({ title: b.title || "Notes", text: v });
      } else {
        const quoted = v ? "> " + clip_(v, 1000).split("\n").join("\n> ") : "> *Nothing provided.*";
        embedFields.push({ name: "📝 " + clip_(b.title || "Notes", 240), value: clip_(quoted, 1024), inline: false });
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
  tags = tags.map(str_).filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 5);

  // ---- post ----
  const color = parseInt(String(form.color || "#3498db").replace("#", ""), 16) || 3447003;
  const title = clip_(fillTemplate_(form.embedTitle || form.title, values), 256);
  const embeds = packEmbeds_(embedFields, title, color);
  const isForum = webhook.kind !== "text";

  const first = { embeds: [embeds[0]], allowed_mentions: { parse: [] } };
  if (isForum) {
    first.thread_name = clip_(fillTemplate_(form.threadTitle || form.title, values) || form.title, 100);
    if (tags.length) first.applied_tags = tags;
  }
  const r1 = discordPost_(webhook.url, first, null);
  if (!r1.ok) return { ok: false, error: r1.error };
  const threadId = isForum && r1.body ? r1.body.channel_id : null;

  const follow = embeds.slice(1).map(e => ({ embeds: [e] }));
  followTexts.forEach(t => chunk_(t.text, 4000).forEach((part, i, all) => follow.push({
    embeds: [{ title: "📝 " + clip_(t.title, 200) + (all.length > 1 ? " (" + (i + 1) + "/" + all.length + ")" : ""), description: part, color: color }]
  })));
  let warning = "";
  for (let i = 0; i < follow.length; i++) {
    Utilities.sleep(350);
    follow[i].allowed_mentions = { parse: [] };
    const r = discordPost_(webhook.url, follow[i], threadId);
    if (!r.ok) { warning = "posted, but part " + (i + 2) + " failed: " + r.error; break; }
  }

  // ---- archive + leaderboard (after Discord so a failed post isn't logged as filed) ----
  archiveRow_(form, archiveCols);
  const lb = form.leaderboard;
  if (lb && lb.enabled && lb.countField && str_(values[lb.countField])) {
    lbSheet_().appendRow([new Date(), form.id, "'" + str_(values[lb.countField])]);
    try { updateLeaderboard_(form); } catch (e) { warning = warning || "leaderboard not updated: " + errMsg_(e); }
  }
  return warning ? { ok: true, warning: warning } : { ok: true };
}

function allFields_(form) {
  const out = [];
  (form.blocks || []).forEach(b => {
    if (b.type === "fields" || b.type === "strip") (b.fields || []).forEach(f => { if (f.type !== "static") out.push(f); });
    if (b.type === "longtext") out.push({ id: b.id, label: b.title, required: b.required, type: "longtext" });
  });
  return out;
}

function displayValue_(f, v) {
  if (!v) return "—";
  if (f.type === "discord_id") return "<@" + v + ">";
  if (f.type === "case_number") return "`" + v + "`";
  if (f.type === "date") {
    const p = v.split("-");
    if (p.length === 3) return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-US");
  }
  return v;
}

function fillTemplate_(tpl, values) {
  return String(tpl || "").replace(/\{(\w+)\}/g, (m, k) => str_(values[k])).replace(/\s*\|\s*(\|\s*)+/g, " | ").replace(/^\s*\|\s*|\s*\|\s*$/g, "").trim();
}

function ruleMatches_(r, values, repeaters) {
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

function packEmbeds_(fields, title, color) {
  const out = [];
  let cur = { title: title, color: color, fields: [] }, size = title.length;
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

function discordPost_(webhookUrl, payload, threadId) {
  let url = webhookUrl + (webhookUrl.indexOf("?") !== -1 ? "&" : "?") + "wait=true";
  if (threadId) url += "&thread_id=" + threadId;
  const res = UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true });
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
    sh.appendRow(["Username", "Role", "Salt", "Password Hash", "Created", "Last Login"]);
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  return sh;
}
function getAdmins_() {
  const data = adminsSheet_().getDataRange().getValues();
  const out = [];
  for (let i = 1; i < data.length; i++) {
    if (!str_(data[i][0])) continue;
    out.push({ row: i + 1, username: str_(data[i][0]), role: str_(data[i][1]) || "admin", salt: str_(data[i][2]), hash: str_(data[i][3]), created: data[i][4], lastLogin: data[i][5] });
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
  if (role !== "owner" && role !== "admin") role = "admin";
  const salt = Utilities.getUuid();
  const hash = hashPw_(password, salt);
  const sh = adminsSheet_(), existing = findAdmin_(username);
  if (existing) sh.getRange(existing.row, 2, 1, 3).setValues([[role, salt, hash]]);
  else sh.appendRow([username, role, salt, hash, new Date(), ""]);
}

function newSession_(admin) {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "");
  CacheService.getScriptCache().put("sess_" + token, admin.username, SESSION_SECONDS_);
  return token;
}
function sessionAdmin_(token) {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const cache = CacheService.getScriptCache();
  const username = cache.get("sess_" + token);
  if (!username) return null;
  const admin = findAdmin_(username);           // removed admins lose access immediately
  if (!admin) { cache.remove("sess_" + token); return null; }
  cache.put("sess_" + token, username, SESSION_SECONDS_); // sliding expiry
  return admin;
}

function logAdmin_(user, action, detail) {
  const ss = ss_();
  let sh = ss.getSheetByName(LOG_SHEET_);
  if (!sh) { sh = ss.insertSheet(LOG_SHEET_); sh.appendRow(["When", "Admin", "Action", "Detail"]); sh.setFrozenRows(1); }
  sh.appendRow([new Date(), user, action, cellSafe_(clip_(detail || "", 1000))]);
}
function readLog_(n) {
  const sh = ss_().getSheetByName(LOG_SHEET_);
  if (!sh || sh.getLastRow() < 2) return [];
  const count = Math.min(n, sh.getLastRow() - 1);
  return sh.getRange(sh.getLastRow() - count + 1, 1, count, 4).getValues().reverse()
    .map(r => ({ when: isDate_(r[0]) ? r[0].toISOString() : String(r[0]), user: r[1], action: r[2], detail: r[3] }));
}

// =====================================================================
// ADMIN API
// =====================================================================
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
    adminsSheet_().getRange(admin.row, 6).setValue(new Date());
    logAdmin_(admin.username, "login", "");
    return { ok: true, token: newSession_(admin), me: { username: admin.username, role: admin.role } };
  }

  const me = sessionAdmin_(d.token);
  if (!me) return { ok: false, error: "AUTH", message: "Your session expired. Please log in again." };
  const isOwner = me.role === "owner";
  const ownerOnly = () => { if (!isOwner) throw new Error("Only an owner can manage admin accounts."); };

  switch (a) {
    case "logout":
      CacheService.getScriptCache().remove("sess_" + d.token);
      return { ok: true };

    case "getAll": {
      const cfg = getConfig_();
      return {
        ok: true,
        me: { username: me.username, role: me.role },
        config: cfg,
        webhooks: maskWebhooks_(),
        admins: isOwner ? getAdmins_().map(x => ({ username: x.username, role: x.role, created: x.created ? new Date(x.created).toISOString() : "", lastLogin: x.lastLogin ? new Date(x.lastLogin).toISOString() : "" })) : [],
        log: readLog_(200)
      };
    }

    case "saveConfig": {
      const cur = getConfig_();
      if (Number(d.baseVersion) !== Number(cur.version)) {
        return { ok: false, error: "CONFLICT", message: (cur.updatedBy || "Another admin") + " saved changes since you loaded the page. Reload to get their version (your unsaved edits will be lost)." };
      }
      const next = validateConfig_(d.config);
      next.version = Number(cur.version) + 1;
      writeConfig_(next, me.username);
      logAdmin_(me.username, "save config", diffSummary_(cur, next));
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

    case "leaderboardRefresh": {
      const form = getConfig_().forms.find(f => f.id === d.formId);
      if (!form || !form.leaderboard || !form.leaderboard.enabled) throw new Error("That form has no leaderboard turned on.");
      updateLeaderboard_(form);
      logAdmin_(me.username, "refresh leaderboard", form.title);
      return { ok: true };
    }

    case "changePassword": {
      if (hashPw_(String(d.current || ""), me.salt) !== me.hash) throw new Error("Current password is wrong.");
      setAdmin_(me.username, d.next, me.role);
      logAdmin_(me.username, "change own password", "");
      return { ok: true };
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
      adminsSheet_().getRange(t.row, 2).setValue(d.role === "owner" ? "owner" : "admin");
      logAdmin_(me.username, "change role", t.username + " -> " + d.role);
      return { ok: true };
    }
    case "adminRemove": {
      ownerOnly();
      const t = findAdmin_(d.username);
      if (!t) throw new Error("Admin not found.");
      if (t.username === me.username) throw new Error("You can't remove yourself.");
      if (t.role === "owner" && getAdmins_().filter(x => x.role === "owner").length < 2) throw new Error("There must always be at least one owner.");
      adminsSheet_().deleteRow(t.row);
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
  const FIELD_TYPES = ["text", "number", "date", "select", "discord_id", "case_number", "static"];
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
    announcement: { text: clip_(str_(s.announcement && s.announcement.text), 500), style: (s.announcement && s.announcement.style) === "warning" ? "warning" : "info" },
    maintenance: { on: !!(s.maintenance && s.maintenance.on), message: clip_(str_(s.maintenance && s.maintenance.message), 300) }
  };
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
        });
      }
      if (b.type === "checklist") { b.id = key(b.id, b.title || "checklist"); b.items = (b.items || []).filter(it => str_(it.topic)); }
      if (b.type === "repeater") {
        b.id = key(b.id, b.title || "list");
        if (!(b.columns || []).length || b.columns.length > 3) throw new Error(f.title + ": list \"" + b.title + "\" needs 1-3 columns.");
        const ck = {};
        b.columns.concat(b.check && b.check.id ? [b.check] : []).forEach(col => {
          if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(str_(col.id)) || ck[col.id]) throw new Error(f.title + ": list \"" + b.title + "\" has a missing or repeated column ID.");
          ck[col.id] = 1;
        });
      }
      if (b.type === "longtext") { b.id = key(b.id, b.title || "text box"); b.maxLength = Math.min(Math.max(Number(b.maxLength) || 1000, 50), 8000); }
    });
    if (f.status === "live" && !(f.blocks || []).length) throw new Error(f.title + " is set to Live but has no blocks.");
    if (f.leaderboard && f.leaderboard.enabled) {
      if (!f.leaderboard.countField || !keys[f.leaderboard.countField]) throw new Error(f.title + ": pick which Discord ID field the leaderboard counts.");
    }
    f.status = ["live", "soon", "hidden"].indexOf(f.status) === -1 ? "hidden" : f.status;
    f.theme = f.theme === "dossier" ? "dossier" : "sheet";
    f.watermark = ["cid", "custom"].indexOf(f.watermark) === -1 ? "" : f.watermark;
    if (f.watermark === "custom" && !/^https:\/\/[^\s"'()<>\\]+$/.test(str_(f.watermarkUrl))) throw new Error(f.title + ": the watermark image link must start with https:// and contain no spaces or quotes.");
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
function defaultConfig_() {
  const items = arr => arr.map(x => ({ topic: x[0], standard: x[1] }));
  return {
    settings: {
      portalName: "LSPD",
      portalSub: "LOS SANTOS POLICE DEPT.",
      heroTag: "OFFICIAL FORMS PORTAL",
      heroText: "Select a form below to file an official record to Discord.",
      footer: "LOS SANTOS POLICE DEPARTMENT · INTERNAL USE ONLY",
      announcement: { text: "", style: "info" },
      maintenance: { on: false, message: "The forms portal is down for maintenance. Please try again shortly." }
    },
    forms: [
      {
        id: "academy", status: "live", icon: "🎓", title: "Academy Evaluation",
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
            { id: "traineeCallsign", label: "Trainee callsign (L-8XX | J. Doe ):", type: "text", required: true },
            { id: "traineeDiscordId", label: "Trainee Discord ID:", type: "discord_id" } ] },
          { type: "fields", fields: [
            { id: "ftoCallsign", label: "Instructor Callsign: ( L-XXX | J. Doe )", type: "text" },
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
        theme: "dossier", watermark: "cid", watermarkUrl: "", watermarkOpacity: 8,
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
            { id: "cidLead", label: "Lead Detective: ( L-XXX | J. Doe )", type: "text", required: true },
            { id: "cidLeadId", label: "Lead Detective Discord ID:", type: "discord_id", required: true } ] },
          { type: "fields", fields: [
            { id: "cidAssist", label: "Assisting Units:", type: "text", placeholder: "L-112, L-245 …" },
            { id: "cidSupervisor", label: "Supervisor Notified:", type: "text" } ] },
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
          { type: "repeater", id: "charges", title: "CHARGES", addLabel: "+ Add Charge",
            columns: [ { id: "suspect", label: "Suspect", type: "text" },
                       { id: "charge", label: "Charge / Penal Code", type: "text", placeholder: "PC 211 - Robbery" },
                       { id: "count", label: "Counts", type: "text", placeholder: "1" } ],
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
          { type: "longtext", id: "cidNarrative", title: "CASE NARRATIVE", hint: "Who, what, when, where, how. Write in first person, chronological order, per the LSPD report-writing standard.", maxLength: 8000, required: true, followUp: true },
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
