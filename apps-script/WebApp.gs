/**
 * LSPD Forms Portal - Apps Script backend (Web App)
 *
 * Add this file to the SAME Apps Script project as your Google Sheet (Extensions > Apps Script),
 * then Deploy > New deployment > Web app:
 *   Execute as: Me      Who has access: Anyone
 * Paste the Web App URL into ENDPOINT in index.html.
 *
 * The Discord webhooks live in Script Properties (server side), never in the website or in GitHub.
 * This file replaces ALL of your old script. Delete the old code (including any old onOpen()),
 * then paste this whole file in. Only ONE onOpen() may exist in the project.
 */

// ====== CONFIG ======
// Webhook URLs are secrets, so they are NOT stored in this file (it lives on GitHub).
// Easiest: in the Google Sheet use the "🚔 LSPD Portal" menu > Set ... webhook.
// (They are stored in Project Settings > Script Properties under these names:)
//   FORUM_WEBHOOK_URL        academy forum channel webhook
//   LEADERBOARD_WEBHOOK_URL  leaderboard channel webhook
//   CID_WEBHOOK_URL          CID forum channel webhook
const PROPS_ = PropertiesService.getScriptProperties();
const FORUM_WEBHOOK_URL       = PROPS_.getProperty("FORUM_WEBHOOK_URL") || "";
const LEADERBOARD_WEBHOOK_URL = PROPS_.getProperty("LEADERBOARD_WEBHOOK_URL") || "";
const LEADERBOARD_MESSAGE_ID  = "1545068576946397295"; // leave "" to auto-create; the new ID is then stored automatically

const TAGS = {
  RA:        "1451941367843393679",
  PASSED:    "1441894255034630226",
  FAILED:    "1441894292082655263",
  HALFWAY:   "1490237728963690496",
  FLAGGED:   "1498495293719580753",
  FELONY:    "1544810175238508714"
};

// ====== CID REPORT BUILDER CONFIG ======
// Webhook for the CID forum channel: set CID_WEBHOOK_URL in Script Properties (see CONFIG above).
const CID_WEBHOOK_URL = PROPS_.getProperty("CID_WEBHOOK_URL") || "";

// Forum tag IDs for the CID channel (right-click a tag with Developer Mode on > Copy ID).
// Leave any you don't use as "" and it's simply skipped. Discord allows max 5 tags per post.
const CID_TAGS = {
  CASE_FILE: "",           // always applied, like RA on the academy forum
  // by status (matched on words in the status dropdown)
  OPEN:      "",
  PENDING:   "",
  CLOSED:    "",
  COLD:      "",
  // by case type (key must match the dropdown text exactly)
  TYPE: {
    "Homicide": "",
    "Attempted Murder": "",
    "Armed Robbery": "",
    "Bank / Store Robbery": "",
    "Burglary": "",
    "Grand Theft Auto": "",
    "Narcotics": "",
    "Weapons Trafficking": "",
    "Assault / Battery": "",
    "Kidnapping": "",
    "Fraud / Forgery": "",
    "Gang Activity": "",
    "Officer-Involved Shooting": "",
    "Other": ""
  },
  WARRANT:   ""            // added when any charge has "Warrant Req." checked
};

function doGet() {
  return json_({ ok: true, service: "LSPD Forms Portal" });
}

function doPost(e) {
  // Queue simultaneous submissions so the Archive rows and the leaderboard stay accurate.
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return json_({ ok: false, error: "Server busy, please press Submit again." });
  }
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.form === "cid") return json_(handleCid_(d));
    return json_(handleAcademy_(d)); // academy (also the default for older pages that don't send "form")
  } catch (err) {
    return json_({ ok: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function handleAcademy_(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const traineeCallsign = String(d.traineeCallsign || "").trim();
  const traineeDiscordId = String(d.traineeDiscordId || "").trim();
  const ftoCallsign = String(d.ftoCallsign || "").trim();
  const ftoDiscordId = String(d.ftoDiscordId || "").trim();
  const finalResult = String(d.finalResult || "").trim();
  const cadCheck = String(d.cadCheck || "").trim();

  if (!traineeCallsign) return { ok: false, error: "Trainee Callsign is empty." };
  if (!ftoDiscordId)    return { ok: false, error: "Instructor Discord ID is empty." };
  if (!FORUM_WEBHOOK_URL) return { ok: false, error: "FORUM_WEBHOOK_URL is not set in Script Properties." };

  // Archive tab (leaderboard source)
  let archive = ss.getSheetByName("Archive");
  if (!archive) archive = ss.insertSheet("Archive");
  archive.appendRow([new Date(), traineeCallsign, ftoDiscordId, finalResult]);

  // Date
  let dateString;
  if (d.dateCompleted) {
    const p = d.dateCompleted.split("-");               // yyyy-mm-dd
    dateString = new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-US");
  } else {
    dateString = new Date().toLocaleDateString("en-US");
  }

  // Notes (max 4 lines, 1000 chars)
  let notes = String(d.notes || "").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 4).join("\n");
  if (notes.length > 1000) notes = notes.substring(0, 997) + "...";

  // Status text
  const upper = finalResult.toUpperCase();
  let statusText = "• PENDING";
  if (upper.includes("PASS"))      statusText = "• ✅ **" + upper + "**";
  else if (upper.includes("FAIL")) statusText = "• ❌ **" + upper + "**";
  else if (upper.includes("HALF")) statusText = "• 🟡 **" + upper + "**";
  else if (finalResult)            statusText = "• **" + finalResult + "**";

  // Forum tags
  let tagList = [TAGS.RA];
  if (upper.includes("PASS"))      tagList.push(TAGS.PASSED);
  else if (upper.includes("FAIL")) tagList.push(TAGS.FAILED);
  else if (upper.includes("HALF")) tagList.push(TAGS.HALFWAY);

  const cad = cadCheck.toLowerCase();
  if (cad.includes("misdemeanor")) {
    tagList.push(TAGS.FLAGGED);
  } else if (cad.includes("felony")) {
    tagList.push(TAGS.FLAGGED);
    tagList.push(TAGS.FELONY);
  }
  tagList = tagList.filter((x, i) => tagList.indexOf(x) === i);

  // Embed fields
  const fields = [
    { name: "Instructor", value: ftoCallsign + " (<@" + ftoDiscordId + ">)", inline: true },
    { name: "Trainee", value: traineeCallsign + " (<@" + traineeDiscordId + ">)", inline: true },
    { name: "Session Date", value: dateString, inline: true },
    { name: "Evaluation Status", value: statusText, inline: false }
  ];

  if (cadCheck) {
    fields.push({ name: "📘 FTO GOLDEN RULES", value: "**CAD - Trainee Name Check:** " + cadCheck, inline: false });
  }

  (d.modules || []).forEach(m => {
    let content = "";
    (m.items || []).forEach(it => {
      content += (it.checked ? "✅" : "❌") + " `" + it.topic + "`\n";
    });
    if (content) fields.push({ name: "📘 " + (m.title || "Training Module"), value: content, inline: false });
  });

  const formattedNotes = notes ? "> " + notes.split("\n").join("\n> ") : "> *No specific notes provided.*";
  fields.push({ name: "📝 Instructor Performance Notes & Feedback", value: formattedNotes, inline: false });

  const payload = {
    thread_name: traineeCallsign,
    applied_tags: tagList,
    embeds: [{ title: "🚔 LSPD Academy Evaluation Record", color: 3447003, fields: fields }]
  };

  const url = FORUM_WEBHOOK_URL + (FORUM_WEBHOOK_URL.includes("?") ? "&" : "?") + "wait=true";
  const res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code !== 200 && code !== 201 && code !== 204) {
    return { ok: false, error: "Discord (" + code + "): " + res.getContentText() };
  }

  updateInstructorLeaderboard(ss);
  return { ok: true };
}

// Monthly leaderboard (same logic as your original script)
function updateInstructorLeaderboard(ss) {
  const archive = ss.getSheetByName("Archive");
  if (!archive || !LEADERBOARD_WEBHOOK_URL) return;
  const data = archive.getDataRange().getValues();
  if (data.length < 1) return;

  const now = new Date();
  const counts = {};
  for (let i = 0; i < data.length; i++) {
    const ts = new Date(data[i][0]);
    const id = String(data[i][2]).trim();
    if (!id || isNaN(ts)) continue;
    if (ts.getMonth() === now.getMonth() && ts.getFullYear() === now.getFullYear()) {
      counts[id] = (counts[id] || 0) + 1;
    }
  }

  const stamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "MM/dd/yyyy 'at' h:mm a");
  let description = "📊 **Ride Along - FTO Submission Tracker** 📊\n*Tracking total academy sign-offs for this month. Resets automatically on the 1st.*\n*Last updated: " + stamp + "*\n\n";

  const sorted = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  if (!sorted.length) {
    description += "_No submissions recorded for this month yet._";
  } else {
    sorted.forEach((id, j) => {
      const emoji = j === 0 ? "🥇" : j === 1 ? "🥈" : j === 2 ? "🥉" : "🔹";
      const name = /^\d+$/.test(id) ? "<@" + id + ">" : id;
      description += emoji + " **" + name + "** — " + counts[id] + " submission" + (counts[id] === 1 ? "" : "s") + "\n";
    });
  }

  const payload = { content: "", embeds: [{ title: "LSPD Academy - Monthly Leaderboard", description: description, color: 3447003 }] };
  const props = PropertiesService.getScriptProperties();
  const msgId = LEADERBOARD_MESSAGE_ID || props.getProperty("LEADERBOARD_MESSAGE_ID") || "";

  if (!msgId) {
    const res = UrlFetchApp.fetch(LEADERBOARD_WEBHOOK_URL + "?wait=true", {
      method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200 || res.getResponseCode() === 201) {
      props.setProperty("LEADERBOARD_MESSAGE_ID", JSON.parse(res.getContentText()).id); // remembered automatically
    }
    return;
  }

  const res = UrlFetchApp.fetch(LEADERBOARD_WEBHOOK_URL + "/messages/" + msgId, {
    method: "patch", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200 && res.getResponseCode() !== 204) {
    Logger.log("Leaderboard Patch Error (" + res.getResponseCode() + "): " + res.getContentText());
  }
}

// =====================================================================
// CID REPORT BUILDER
// =====================================================================
// Discord limits: field value 1024, embed description 4096, 25 fields per embed,
// 6000 characters per message. Long lists are split across fields, and the
// narrative is posted as follow-up message(s) inside the same forum thread.

function handleCid_(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const s = v => String(v == null ? "" : v).trim();

  const caseNumber = s(d.caseNumber);
  const leadCallsign = s(d.leadCallsign);
  const leadId = s(d.leadDiscordId);
  const caseType = s(d.caseType);
  const status = s(d.status);
  const narrative = s(d.narrative);

  if (!caseNumber) return { ok: false, error: "Case Number is empty." };
  if (!leadCallsign) return { ok: false, error: "Lead Detective is empty." };
  if (!/^\d{15,21}$/.test(leadId)) return { ok: false, error: "Lead Detective Discord ID is invalid." };
  if (!caseType) return { ok: false, error: "Case Type is empty." };
  if (!narrative) return { ok: false, error: "Case Narrative is empty." };
  if (!CID_WEBHOOK_URL) return { ok: false, error: "CID_WEBHOOK_URL is not set in Script Properties." };

  const persons = Array.isArray(d.persons) ? d.persons : [];
  const evidence = Array.isArray(d.evidence) ? d.evidence : [];
  const charges = Array.isArray(d.charges) ? d.charges : [];
  const checklist = Array.isArray(d.checklist) ? d.checklist : [];

  // ---- Archive row (CID Archive tab) ----
  let archive = ss.getSheetByName("CID Archive");
  if (!archive) {
    archive = ss.insertSheet("CID Archive");
    archive.appendRow(["Submitted", "Case #", "CAD #", "Case Type", "Status", "Incident Date", "Location",
      "Lead Detective", "Lead Discord ID", "Suspects", "Evidence Items", "Charges", "Narrative"]);
    archive.setFrozenRows(1);
  }
  const suspects = persons.filter(p => s(p.role) === "Suspect").map(p => s(p.name) || "Unknown");
  archive.appendRow([
    new Date(), caseNumber, s(d.cadCase), caseType, status, s(d.incidentDate), s(d.location),
    leadCallsign, "'" + leadId,                 // leading ' keeps the ID from turning into 1.2E+17
    suspects.join(", "), evidence.length,
    charges.map(c => (s(c.suspect) || "?") + ": " + s(c.charge) + (s(c.count) ? " x" + s(c.count) : "")).join("; "),
    narrative.substring(0, 49000)
  ]);

  // ---- Date ----
  let dateString = new Date().toLocaleDateString("en-US");
  if (d.incidentDate) {
    const p = String(d.incidentDate).split("-");
    if (p.length === 3) dateString = new Date(p[0], p[1] - 1, p[2]).toLocaleDateString("en-US");
  }

  // ---- Tags ----
  const st = status.toLowerCase();
  let tags = [CID_TAGS.CASE_FILE];
  if (st.includes("open")) tags.push(CID_TAGS.OPEN);
  else if (st.includes("pending")) tags.push(CID_TAGS.PENDING);
  else if (st.includes("closed")) tags.push(CID_TAGS.CLOSED);
  else if (st.includes("cold")) tags.push(CID_TAGS.COLD);
  tags.push(CID_TAGS.TYPE[caseType]);
  if (charges.some(c => c.warrant)) tags.push(CID_TAGS.WARRANT);
  tags = tags.filter((x, i) => x && tags.indexOf(x) === i).slice(0, 5);

  // ---- Embed fields ----
  const fields = [
    { name: "Case Number", value: "`" + caseNumber + "`", inline: true },
    { name: "CAD Case #", value: s(d.cadCase) || "—", inline: true },
    { name: "Incident Date", value: dateString, inline: true },
    { name: "Case Type", value: caseType, inline: true },
    { name: "Status", value: status || "—", inline: true },
    { name: "Location", value: s(d.location) || "—", inline: true },
    { name: "Lead Detective", value: leadCallsign + " (<@" + leadId + ">)", inline: true },
    { name: "Assisting Units", value: s(d.assisting) || "—", inline: true },
    { name: "Supervisor Notified", value: s(d.supervisor) || "—", inline: true }
  ];

  const roleIcon = { "Suspect": "🔴", "Victim": "🔵", "Witness": "🟢", "Person of Interest": "🟠", "Complainant": "⚪" };
  addListFields_(fields, "👥 Involved Persons", persons.map(p =>
    (roleIcon[s(p.role)] || "▫️") + " **" + s(p.role) + ":** " + (s(p.name) || "Unknown") +
    (s(p.notes) ? " — " + s(p.notes) : "") + (p.profileRun ? " `CAD ✓`" : "")));

  addListFields_(fields, "🧪 Evidence Log", evidence.map((ev, i) =>
    "`#" + (i + 1) + "` **" + s(ev.type) + "** — " + (s(ev.desc) || "No description") +
    (s(ev.serial) ? " · " + s(ev.serial) : "") + (ev.logged ? " ✅" : " ⚠️ *not logged in CAD*")));

  addListFields_(fields, "⚖️ Charges", charges.map(c =>
    "**" + (s(c.suspect) || "Unknown") + "** — " + (s(c.charge) || "—") +
    (s(c.count) ? " ×" + s(c.count) : "") + (c.warrant ? " 📜 *warrant requested*" : "")));

  if (checklist.length) {
    const done = checklist.filter(c => c.done).length;
    addListFields_(fields, "📘 Investigative Checklist (" + done + "/" + checklist.length + ")",
      checklist.map(c => (c.done ? "✅" : "❌") + " `" + s(c.task) + "`"));
  }

  const followup = s(d.followup);
  if (followup) addListFields_(fields, "📌 Follow-Up / Next Steps", ["> " + followup.substring(0, 1000).split("\n").join("\n> ")]);

  // ---- Pack fields into messages (25 fields / ~5800 chars each) ----
  const title = "🕵️ LSPD CID Case Report — " + caseNumber;
  const color = 15381256; // gold, to tell CID posts apart from academy blue
  const embeds = packEmbeds_(fields, title, color);

  // First message creates the forum thread
  const threadName = (caseNumber + " | " + caseType + " | " + (suspects[0] || leadCallsign)).substring(0, 100);
  const first = discordPost_(CID_WEBHOOK_URL, {
    thread_name: threadName,
    applied_tags: tags,
    embeds: [embeds[0]],
    allowed_mentions: { parse: [] }
  }, null);
  if (!first.ok) return { ok: false, error: first.error };
  const threadId = first.body && first.body.channel_id;

  // Follow-ups inside the same thread: overflow fields, then the narrative
  const followups = embeds.slice(1).map(e => ({ embeds: [e] }));
  chunk_(narrative, 4000).forEach((part, i, all) => {
    followups.push({ embeds: [{
      title: "📝 Case Narrative" + (all.length > 1 ? " (" + (i + 1) + "/" + all.length + ")" : ""),
      description: part, color: color
    }] });
  });

  let warning = "";
  for (let i = 0; i < followups.length; i++) {
    Utilities.sleep(350); // stay under Discord's webhook rate limit
    followups[i].allowed_mentions = { parse: [] };
    const r = discordPost_(CID_WEBHOOK_URL, followups[i], threadId);
    if (!r.ok) { warning = "thread created, but part " + (i + 2) + " failed: " + r.error; break; }
  }

  return warning ? { ok: true, warning: warning } : { ok: true };
}

// Adds one or more fields for a list, splitting at 1024 chars so nothing is cut off.
function addListFields_(fields, name, lines) {
  if (!lines.length) { fields.push({ name: name, value: "*None recorded.*", inline: false }); return; }
  let buf = "", part = 0;
  const flush = () => {
    fields.push({ name: part ? name + " (cont.)" : name, value: buf, inline: false });
    part++; buf = "";
  };
  lines.forEach(line => {
    line = line.length > 1000 ? line.substring(0, 997) + "..." : line;
    if (buf && (buf.length + 1 + line.length) > 1024) flush();
    buf += (buf ? "\n" : "") + line;
  });
  if (buf) flush();
}

// Splits fields into embeds that each respect Discord's 25-field / 6000-char limits.
function packEmbeds_(fields, title, color) {
  const out = [];
  let cur = { title: title, color: color, fields: [] }, size = title.length;
  fields.forEach(f => {
    const fs = f.name.length + f.value.length;
    if (cur.fields.length >= 25 || size + fs > 5800) {
      out.push(cur);
      cur = { title: title + " (cont.)", color: color, fields: [] };
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
  let url = webhookUrl + (webhookUrl.includes("?") ? "&" : "?") + "wait=true";
  if (threadId) url += "&thread_id=" + threadId;
  const res = UrlFetchApp.fetch(url, {
    method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code !== 200 && code !== 201 && code !== 204) {
    return { ok: false, error: "Discord (" + code + "): " + res.getContentText().substring(0, 300) };
  }
  let body = null;
  try { body = JSON.parse(res.getContentText()); } catch (e) {}
  return { ok: true, body: body };
}

// =====================================================================
// SETUP MENU (in the Google Sheet: "🚔 LSPD Portal" menu at the top)
// Lets you paste/replace webhooks without opening Project Settings.
// If you see the menu missing, reload the Sheet once.
// =====================================================================
const WEBHOOK_KEYS_ = [
  ["FORUM_WEBHOOK_URL",       "Academy forum webhook"],
  ["LEADERBOARD_WEBHOOK_URL", "Leaderboard channel webhook"],
  ["CID_WEBHOOK_URL",         "CID forum webhook"]
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu("🚔 LSPD Portal")
    .addItem("Set Academy forum webhook", "setForumWebhook")
    .addItem("Set Leaderboard webhook", "setLeaderboardWebhook")
    .addItem("Set CID forum webhook", "setCidWebhook")
    .addSeparator()
    .addItem("Check webhooks", "checkWebhooks")
    .addToUi();
}

function setForumWebhook()       { promptWebhook_("FORUM_WEBHOOK_URL", "Academy forum webhook"); }
function setLeaderboardWebhook() { promptWebhook_("LEADERBOARD_WEBHOOK_URL", "Leaderboard channel webhook"); }
function setCidWebhook()         { promptWebhook_("CID_WEBHOOK_URL", "CID forum webhook"); }

function promptWebhook_(key, label) {
  const ui = SpreadsheetApp.getUi();
  const current = PROPS_.getProperty(key);
  const r = ui.prompt("Set " + label,
    (current ? "A webhook is already saved. Pasting a new one replaces it.\n\n" : "") +
    "Paste the Discord webhook URL (Channel > Edit > Integrations > Webhooks > Copy Webhook URL):",
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const url = r.getResponseText().trim();
  if (!/^https:\/\/(ptb\.|canary\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url)) {
    ui.alert("That doesn't look like a Discord webhook URL. Nothing was saved.");
    return;
  }
  const check = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (check.getResponseCode() !== 200) {
    ui.alert("Discord rejected that webhook (" + check.getResponseCode() + "). It may have been deleted or regenerated. Nothing was saved.");
    return;
  }
  PROPS_.setProperty(key, url);
  const name = JSON.parse(check.getContentText()).name || "webhook";
  ui.alert("✅ Saved " + label + " (\"" + name + "\").\n\nNo redeploy needed: the website uses it on the next submission.");
}

function checkWebhooks() {
  const lines = WEBHOOK_KEYS_.map(([key, label]) => {
    const url = PROPS_.getProperty(key);
    if (!url) return "❌ " + label + ": not set";
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return "❌ " + label + ": Discord says invalid (" + res.getResponseCode() + ")";
    return "✅ " + label + ": OK (\"" + (JSON.parse(res.getContentText()).name || "webhook") + "\")";
  });
  SpreadsheetApp.getUi().alert("Webhook status\n\n" + lines.join("\n"));
}
