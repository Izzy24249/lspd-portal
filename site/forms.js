/* =====================================================================
   LSPD Portal - shared form renderer (used by index.html and admin.html)
   Draws any form definition from the admin portal in the Excel-sheet style.
   ===================================================================== */
window.Portal = (function () {
  // The WebApp.gs version this website expects (admin.html warns when Google is running an older one).
  const BACKEND_NEEDS = 29;
  // Apps Script Web App URL (Deploy > Manage deployments). Used by both pages.
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbyQlnEtA7DJRHnnLJsalqvsvNK3yiuOmoBAlzNWM9qk2AebZEwyHkjtfKqxW9hB65jB/exec";

  const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function todayISO() {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }
  function caseNumber(prefix) {
    const d = new Date(), p = n => String(n).padStart(2, "0");
    return (prefix ? prefix + "-" : "") + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + (Math.floor(Math.random() * 9000) + 1000);
  }
  // Original LSPD CID seal used as the dossier watermark (tall canvas = spacing when it repeats).
  const CID_SEAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 760">
    <defs><path id="top" d="M70 300a130 130 0 0 1 260 0"/><path id="bot" d="M58 300a142 142 0 0 0 284 0"/></defs>
    <g fill="none" stroke="#f1dfa6">
      <circle cx="200" cy="300" r="178" stroke-width="7"/>
      <circle cx="200" cy="300" r="160" stroke-width="2"/>
      <circle cx="200" cy="300" r="108" stroke-width="3"/>
      <path d="M200 205 270 232v52c0 48-30 82-70 96-40-14-70-48-70-96v-52z" stroke-width="5"/>
      <circle cx="190" cy="285" r="30" stroke-width="9"/>
      <path d="M212 307 246 341" stroke-width="14" stroke-linecap="round"/>
    </g>
    <g fill="#f1dfa6" font-family="Arial Black,Arial,sans-serif" font-weight="900" text-anchor="middle">
      <text font-size="25" letter-spacing="4"><textPath href="#top" startOffset="50%">LOS SANTOS POLICE</textPath></text>
      <text font-size="17" letter-spacing="3"><textPath href="#bot" startOffset="50%">CRIMINAL INVESTIGATION DIVISION</textPath></text>
      <circle cx="58" cy="300" r="6"/><circle cx="342" cy="300" r="6"/>
      <text x="200" y="540" font-size="64" letter-spacing="18">LSPD</text>
      <text x="200" y="590" font-size="30" letter-spacing="22">C · I · D</text>
    </g></svg>`;
  // image links: https URLs, or files on this site like img/cid-logo.png
  const IMG_RE = /^(https:\/\/[^\s"'()<>\\]+|(?!.*\.\.)[A-Za-z0-9_\-\/.]+\.(png|jpe?g|webp|gif|svg))$/i;
  const okImg = u => IMG_RE.test(String(u || ""));
  function watermarkCSS(form) {
    if (form.watermark === "cid") return `url('data:image/svg+xml,${encodeURIComponent(CID_SEAL.replace(/\s+/g, " "))}')`;
    if (form.watermark === "custom" && okImg(form.watermarkUrl)) return `url('${form.watermarkUrl}')`;
    return "";
  }

  // Reads "(Felony, 18 Months - $9,000 Fine)" style charges; count multiplies it.
  function sentence(text, count) {
    const m = /(\d+)\s*Months?/i.exec(text || ""), f = /\$\s*([\d,]+)\s*Fine/i.exec(text || "");
    const n = Math.max(1, parseInt(count, 10) || 1);
    return { any: !!(m || f), months: m ? +m[1] * n : 0, fine: f ? +f[1].replace(/,/g, "") * n : 0 };
  }

  // "Searchable list" columns: a text box with type-to-filter suggestions (HTML datalist)
  const listId = (b, c) => "dl-" + b.id + "-" + c.id;
  function searchLists(form) {
    return (form.blocks || []).filter(b => b.type === "repeater").map(b => (b.columns || []).filter(c => c.type === "search").map(c =>
      `<datalist id="${esc(listId(b, c))}">${(c.options || []).map(o => `<option value="${esc(o)}"></option>`).join("")}</datalist>`).join("")).join("");
  }

  // how many of the sheet's 4 columns each item spans
  function spans(n) { return n >= 4 ? [1, 1, 1, 1] : n === 3 ? [1, 2, 1] : n === 2 ? [2, 2] : [4]; }

  function inputHTML(f, centered) {
    const c = centered ? " c" : "";
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
    switch (f.type) {
      case "select":
        return `<select class="g${c}" data-f="${esc(f.id)}"><option value=""></option>${(f.options || []).map(o => `<option${f.default === o ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
      case "date":
        return `<input class="g c" type="date" data-f="${esc(f.id)}"><button type="button" data-today="${esc(f.id)}" title="Stamp today's date">Today</button>`;
      case "time":
        return `<input class="g c" type="time" data-f="${esc(f.id)}"><button type="button" data-now="${esc(f.id)}" title="Stamp the current time">Now</button>`;
      case "case_number":
        return `<div class="with-gen"><input class="g${c}" type="text" maxlength="60" data-f="${esc(f.id)}"${ph}><button type="button" class="mini" data-gen="${esc(f.id)}" data-prefix="${esc(f.prefix || "")}">Generate</button></div>`;
      case "static":
        return esc(f.text || "");
      case "officer":
      case "officers":
        return `<div class="ofc${f.type === "officer" ? " single" : ""}" data-ofc="${esc(f.id)}"${f.type === "officer" ? ' data-max="1"' : ""}><input type="hidden" data-f="${esc(f.id)}"><span class="ofc-chips"></span><input type="text" class="ofc-in" data-ofcin="${esc(f.id)}" autocomplete="off" placeholder="${f.type === "officer" ? "Search the roster…" : (fieldRoster(f) || ROSTER).length ? "Search the roster or type a Discord ID…" : "Type a name or Discord ID, then Enter…"}"></div>`;
      case "discord_id":
      case "number":
        return `<input class="g${c}" type="text" inputmode="${f.roster ? "text" : "numeric"}" maxlength="${f.type === "discord_id" ? (f.roster ? 80 : 21) : 30}" data-f="${esc(f.id)}"${ph}${rosterAttrs(f)}>`;
      default:
        return `<input class="g${c}" type="text" maxlength="200" data-f="${esc(f.id)}"${ph}${rosterAttrs(f)}>`;
    }
  }
  const req = f => f.required ? ' <i class="req">*</i>' : "";
  const rosterAttrs = f => f.roster ? ` data-roster="1" autocomplete="off"${f.fillId ? ` data-fill="${esc(f.fillId)}"` : ""}` : "";

  function blockHTML(b, form) {
    switch (b.type) {
      case "banner":
        return (form && okImg(form.logoUrl) ? `<tr class="banner logo"><td colspan="4"><img class="flogo" src="${esc(form.logoUrl)}" alt=""></td></tr>` : "") +
          `<tr class="banner"><td colspan="4" class="t1">${esc(b.title)}</td></tr>` +
          (b.subtitle ? `<tr class="banner"><td colspan="4" class="t2">${esc(b.subtitle)}</td></tr>` : "") +
          `<tr class="gap3"><td colspan="4"></td></tr>`;
      case "fields": {
        const fs = b.fields || [];
        const cells = fs.length === 1
          ? `<td class="lbl">${esc(fs[0].label)}${req(fs[0])}</td><td colspan="3" class="${fs[0].type === "date" || fs[0].type === "time" ? "datecell" : ""}">${inputHTML(fs[0])}</td>`
          : fs.map(f => `<td class="lbl">${esc(f.label)}${req(f)}</td><td class="${f.type === "date" || f.type === "time" ? "datecell" : ""}">${inputHTML(f)}</td>`).join("");
        return `<tr class="inrow">${cells}</tr><tr class="gap2"><td colspan="4"></td></tr>`;
      }
      case "strip": {
        const fs = b.fields || [], sp = spans(fs.length);
        return `<tr class="gap3"><td colspan="4"></td></tr>` +
          `<tr class="hdr1">${fs.map((f, i) => `<td colspan="${sp[i]}">${esc(f.label)}${req(f)}</td>`).join("")}</tr>` +
          `<tr class="sess">${fs.map((f, i) => `<td colspan="${sp[i]}" class="${f.type === "date" || f.type === "time" ? "datecell" : f.type === "static" ? "c static" : ""}">${inputHTML(f, true)}</td>`).join("")}</tr>` +
          `<tr class="gap3"><td colspan="4"></td></tr>`;
      }
      case "text": {
        const cls = { rule: "rl", warning: "warnrow", heading: "golden", hint: "notehint" }[b.style] || "rl";
        return `<tr class="${cls}"><td colspan="4" class="${b.style === "warning" ? "wn" : ""}">${esc(b.text)}</td></tr>`;
      }
      case "checklist":
        return `<tr class="gap3"><td colspan="4"></td></tr>
          <tr class="modhead"><td colspan="4">${esc(b.title)}<span class="mc" data-cc="${esc(b.id)}">0 / ${(b.items || []).length}</span></td></tr>
          <tr class="colhdr"><td>${esc(b.colTopic || "Topic")}</td><td colspan="2">${esc(b.colStandard || "Standard")}</td><td>${esc(b.colCheck || "Done")}</td></tr>` +
          (b.items || []).map((it, i) => `
          <tr class="item ${i % 2 ? "z" : ""}">
            <td class="topic">${esc(it.topic)}</td><td colspan="2">${esc(it.standard)}</td>
            <td class="ck"><label class="xck"><input type="checkbox" data-chk="${esc(b.id)}" data-topic="${esc(it.topic)}"><span class="bx">${CHECK_SVG}</span></label></td>
          </tr>`).join("");
      case "repeater": {
        const cols = (b.columns || []).slice(0, 3), sp = cols.length === 3 ? [1, 1, 1] : cols.length === 2 ? [1, 2] : [3];
        return `<tr class="gap3"><td colspan="4"></td></tr>
          <tr class="modhead"><td colspan="4">${esc(b.title)}<span class="mc" data-rc="${esc(b.id)}">0 entries</span></td></tr>
          <tr class="colhdr">${cols.map((c, i) => `<td colspan="${sp[i]}">${esc(c.label)}</td>`).join("")}<td>${esc(b.check && b.check.id ? b.check.label : "")}</td></tr>
          <tr class="empty" data-empty="${esc(b.id)}"><td colspan="4">None added.</td></tr>
          <tr class="anchor" data-anchor="${esc(b.id)}" style="display:none"><td colspan="4"></td></tr>
          ${b.totals && b.totals.on ? `<tr class="sumrow" data-sum="${esc(b.id)}" style="display:none"><td colspan="4"></td></tr>` : ""}
          <tr class="addrow"><td colspan="4"><button type="button" class="mini" data-add="${esc(b.id)}">${esc(b.addLabel || "+ Add Row")}</button></td></tr>`;
      }
      case "longtext":
        return `<tr class="gap3"><td colspan="4"></td></tr>
          <tr class="modhead"><td colspan="4">${esc(b.title)}${req(b)}</td></tr>` +
          (b.hint ? `<tr class="notehint"><td colspan="4">${esc(b.hint)}</td></tr>` : "") +
          (hasGuide(b) ? `<tr class="guiderow"><td colspan="4">${guideHTML(b)}</td></tr>` : "") +
          `<tr class="txrow"><td colspan="4"><textarea class="g ${(b.maxLength || 1000) <= 1500 ? "short" : ""}" data-f="${esc(b.id)}" maxlength="${b.maxLength || 1000}"></textarea></td></tr>
          <tr class="cnt"><td colspan="4" data-count="${esc(b.id)}">0 / ${b.maxLength || 1000}</td></tr>`;
    }
    return "";
  }

  // ===================== ROSTER + SEARCH PICKER POPUP =====================
  let ROSTER = [];   // [{name, id, extra}] older single roster (fields without a roster tab chosen)
  let ROSTERS = {};  // { tabId: [{name, id, extra}] } each field picks its own roster tab
  function setRoster(list) { ROSTER = Array.isArray(list) ? list.filter(p => p && (p.name || p.id)) : []; }
  function setRosters(map) { ROSTERS = map && typeof map === "object" ? map : {}; }
  const fieldRoster = f => f && f.rosterTabId != null && f.rosterTabId !== "" ? (ROSTERS[f.rosterTabId] || []) : null;
  const CLASS_RE = /^(.*?)\s*\(((?:Felony|Misdemeanor|Infraction))[^)]*\)\s*$/i;
  function chargeItem(o) {
    const m = CLASS_RE.exec(o), x = sentence(o, 1);
    if (!m) return { label: o, value: o, search: o.toLowerCase() };
    const sub = [x.months ? x.months + " months" : "", x.fine ? "$" + x.fine.toLocaleString("en-US") + " fine" : ""].filter(Boolean).join(" · ");
    return { label: m[1], value: o, sub: sub, badge: m[2][0].toUpperCase(), cls: m[2].toLowerCase(), search: o.toLowerCase() };
  }
  // optional division filter, e.g. "CID, Detectives" (matches the roster tab names)
  const rosterItems = (only, f) => (fieldRoster(f) || ROSTER).filter(p => {
    const want = fieldRoster(f) ? [] : String(only || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
    if (!want.length) return true;
    const has = String(p.division || "").toLowerCase().split(",").map(x => x.trim()).filter(Boolean);
    // "CID" also matches a tab called "Criminal Investigation Division"
    const initials = h => h.split(/[\s\-_/&]+/).filter(w => w && !/^(of|and|the)$/.test(w)).map(w => w[0]).join("");
    return want.some(w => has.some(h => h === w || h.indexOf(w) !== -1 || initials(h) === w));
  }).map(p => {
    const pair = f && f.pairCol && p.more ? String(p.more[f.pairCol] || "").trim() : "";
    // callsign from this tab's own column when the main roster didn't give one: "L-801 | A. Ramirez"
    const cs = f && f.callCol && p.more ? String(p.more[f.callCol] || "").trim() : "";
    const name = cs && p.name.indexOf("|") === -1 && p.name.indexOf(cs) === -1 ? cs + " | " + p.name : p.name;
    p = Object.assign({}, p, { name: name });
    return { label: p.name, value: p.name, id: p.id, pair: pair, sub: [p.extra, pair ? "↳ " + pair : "", p.id ? "ID " + p.id : "no Discord ID"].filter(Boolean).join(" · "), search: (p.name + " " + (p.extra || "") + " " + pair + " " + (p.id || "")).toLowerCase() };
  });

  let PK = null;
  function pkClose() { if (PK) { PK.panel.remove(); PK = null; } }
  function pkTheme(el) { const dw = el.closest("[class*=' div-']"); return el.closest(".hud") ? "pk-hud" + (dw ? " pk-" + (dw.className.match(/div-(\w+)/) || [])[1] : "") : el.closest(".theme-dossier") ? "pk-dossier" : "pk-light"; }
  function pkPlace() {
    if (!PK) return;
    const r = PK.input.getBoundingClientRect(), p = PK.panel, vw = innerWidth, vh = innerHeight;
    const w = Math.min(Math.max(r.width, 380), vw - 16);
    p.style.width = w + "px";
    p.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + "px";
    const below = vh - r.bottom - 12, above = r.top - 12;
    if (below < 240 && above > below) { p.style.top = ""; p.style.bottom = (vh - r.top + 6) + "px"; p.style.maxHeight = Math.min(380, above) + "px"; }
    else { p.style.bottom = ""; p.style.top = (r.bottom + 6) + "px"; p.style.maxHeight = Math.min(380, below) + "px"; }
  }
  addEventListener("scroll", () => pkPlace(), true);
  addEventListener("resize", () => pkPlace());
  function hl(text, toks) {
    let h = esc(text);
    toks.forEach(t => { if (t) h = h.replace(new RegExp("(" + esc(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); });
    return h;
  }
  function pkRender() {
    if (!PK) return;
    const q = PK.typed ? PK.input.value.trim().toLowerCase() : "";
    const toks = q.split(/\s+/).filter(Boolean);
    let list = PK.items.filter(it => !PK.exclude || !PK.exclude(it));
    if (toks.length) {
      list = list.filter(it => toks.every(t => it.search.indexOf(t) !== -1));
      // best first: name starts with what you typed > name contains every word > matched only via rank/ID
      const q1 = q.trim(), score = it => { const l = it.label.toLowerCase(); return (l.startsWith(q1) ? 4 : 0) + (toks.every(t => l.indexOf(t) !== -1) ? 2 : 0) + (l.startsWith(toks[0]) ? 1 : 0); };
      list = list.map((it, i) => ({ it, i, s: score(it) })).sort((a, b) => b.s - a.s || a.i - b.i).map(x => x.it);
    }
    PK.list = list.slice(0, 80);
    if (PK.idx >= PK.list.length) PK.idx = PK.list.length - 1;
    if (PK.idx < 0 && PK.list.length && toks.length) PK.idx = 0;
    const head = `<div class="pk-head">${toks.length ? list.length + " match" + (list.length === 1 ? "" : "es") : PK.items.length + " " + PK.noun + " · type to filter"}<span>↑↓ Enter · Esc</span></div>`;
    const body = PK.list.length ? PK.list.map((it, i) => `<div class="pk-item${i === PK.idx ? " on" : ""}${it.value === PK.input.value && !PK.multi ? " cur" : ""}" data-i="${i}">
        ${it.badge ? `<span class="pk-b ${esc(it.cls)}">${esc(it.badge)}</span>` : `<span class="pk-av">${esc((it.label || "?").replace(/^[^A-Za-z0-9]*/, "").charAt(0).toUpperCase())}</span>`}
        <span class="pk-t"><span class="pk-l">${hl(it.label, toks)}</span>${it.sub ? `<span class="pk-s">${hl(it.sub, toks)}</span>` : ""}</span></div>`).join("")
      : `<div class="pk-none">${PK.emptyText}</div>`;
    PK.panel.innerHTML = head + `<div class="pk-list">${body}</div>`;
    const on = PK.panel.querySelector(".pk-item.on"); if (on) on.scrollIntoView({ block: "nearest" });
    pkPlace();
  }
  function pkOpen(input, cfg) {
    if (PK && PK.input === input) return;
    pkClose();
    const panel = document.createElement("div");
    panel.className = "pk-panel " + pkTheme(input);
    document.body.appendChild(panel);
    PK = Object.assign({ input: input, panel: panel, idx: -1, typed: false, list: [] }, cfg);
    panel.addEventListener("mousedown", e => {
      e.preventDefault();                                   // keep focus in the input
      const it = e.target.closest(".pk-item"); if (it && PK) PK.onPick(PK.list[+it.dataset.i]);
    });
    pkRender();
  }

  // officers field value: "Name (123…); Name; (456…)"
  const parseOfc = v => String(v || "").split(";").map(x => x.trim()).filter(Boolean).map(x => { const m = /^(.*?)\s*\((\d{15,21})\)$/.exec(x); return m ? { name: m[1], id: m[2] } : { name: x, id: "" }; });
  const fmtOfc = list => list.map(o => (o.name || "") + (o.id ? (o.name ? " " : "") + "(" + o.id + ")" : "")).join("; ");

  // ===================== NARRATIVE WRITING GUIDE (big text box option) =====================
  // Built-in guides, used when a text box with this ID has never had a guide saved
  // (so the CID narrative gets its guide without importing anything).
  const DEFAULT_GUIDES = { cidNarrative: {"on": true, "steps": [{"label": "Call / Dispatch", "help": "How did you get involved? When, where, and who sent you?", "starter": "On {cidDate} at approximately [time] hours, I [was dispatched / responded] to {cidLocation} regarding a reported {cidType}."}, {"label": "Arrival", "help": "What did you see, hear and smell when you arrived? Who was there?", "starter": "Upon arrival, I observed [describe the scene, the people present and anything out of place]."}, {"label": "Contacts & statements", "help": "Who did you speak to and what did they tell you? Quote key words exactly.", "starter": "I made contact with {persons.name?role=Victim}, who stated \"[their words]\"."}, {"label": "Investigation", "help": "What did you do to find out what happened? CAD checks, prints, serials, footage, canvassing.", "starter": "During my investigation, I [ran / checked / reviewed] [what you did], which showed [what you found]."}, {"label": "Evidence", "help": "What did you collect, where exactly was it found, and was it logged in CAD?", "starter": "I located [evidence] at [where it was found]. I collected it and logged it into CAD evidence."}, {"label": "Suspect & arrest", "help": "How was the suspect identified? What was your probable cause? When was Miranda read?", "starter": "I identified {persons.name?role=Suspect} as the suspect(s) based on [probable cause]. I placed {persons.name?role=Suspect} under arrest at approximately [time] hours and read Miranda rights at [time] hours."}, {"label": "Outcome", "help": "How did it end? Transport, booking, and what is still open.", "starter": "{persons.name?role=Suspect} was transported to [location] and booked. This case remains [open / closed] pending [next steps]."}], "tips": ["Write in first person and past tense: \"I observed\", not \"Officer observed\" or \"I observe\".", "Tell it in the order it happened, with times (e.g. 2315 hours).", "Stick to facts you saw, heard, or were told. Leave out opinions like \"he looked guilty\".", "Quote important statements word for word in \"quotation marks\".", "Say how you know each fact: \"I saw\", \"the victim stated\", \"CAD showed\".", "Explain your probable cause for every stop, search and arrest.", "Note when Miranda rights were read if anyone was questioned in custody.", "Re-read it once: would someone who wasn't there understand exactly what happened?"], "mention": [{"label": "Names every suspect", "ref": "{persons.name?role=Suspect}"}, {"label": "Mentions the location", "ref": "{cidLocation}"}], "keywords": [{"label": "Probable cause explained", "words": ["probable cause", "based on", "because"]}, {"label": "Miranda noted", "words": ["miranda"]}]} };
  function withDefaults(form) {
    let changed = false;
    const blocks = (form.blocks || []).map(b => {
      if (b.type === "longtext" && b.guide === undefined && DEFAULT_GUIDES[b.id]) { changed = true; return Object.assign({}, b, { guide: JSON.parse(JSON.stringify(DEFAULT_GUIDES[b.id])) }); }
      return b;
    });
    return changed ? Object.assign({}, form, { blocks: blocks }) : form;
  }
  const hasGuide = b => b.guide && b.guide.on && ((b.guide.steps || []).length || (b.guide.tips || []).length);
  function guideHTML(b) {
    const g = b.guide, steps = g.steps || [], tips = g.tips || [];
    return `<div class="nguide" data-guide="${esc(b.id)}">
      <div class="ng-top"><span class="ng-title">✍️ Writing guide</span>
        ${steps.length ? `<button type="button" class="ng-btn" data-outline="${esc(b.id)}">Insert full outline</button>` : ""}
        ${tips.length ? `<button type="button" class="ng-btn ghost" data-tips="${esc(b.id)}">Tips</button>` : ""}</div>
      ${steps.length ? `<div class="ng-steps">${steps.map((st, i) => `<button type="button" class="ng-step" data-step="${i}" data-for="${esc(b.id)}" data-help="${esc(st.help || "")}"><b>${i + 1}</b>${esc(st.label)}</button>`).join("")}</div>
      <div class="ng-help" data-ghelp="${esc(b.id)}">Click a step to add its sentence starter, then type over the <b>[brackets]</b>. Hover a step to see what to cover.</div>` : ""}
      ${tips.length ? `<ul class="ng-tips" data-gtips="${esc(b.id)}" hidden>${tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <div class="ng-checks" data-gchecks="${esc(b.id)}"></div>
    </div>`;
  }

  // ===================== FUTURISTIC HUD LAYOUT (form Look = "hud") =====================
  // column widths: "narrow" | "normal" | "wide" (searchable lists default to wide)
  const colW = c => ({ narrow: ".45fr", wide: "2.1fr" }[c.width || (c.type === "search" ? "wide" : "normal")] || "1fr");
  const hudCols = b => (b.columns || []).slice(0, 3).map(c => "minmax(0," + colW(c) + ")").join(" ") + " " + (b.check && b.check.id ? "minmax(118px,auto)" : "44px");
  function hudField(f) {
    if (f.type === "static") return `<div class="hud-field"><span class="hud-lbl">${esc(f.label)}</span><div class="hud-static">${esc(f.text || "")}</div></div>`;
    return `<div class="hud-field"><span class="hud-lbl">${esc(String(f.label || "").replace(/:\s*$/, ""))}${req(f)}</span><div class="hud-ctl">${inputHTML(f)}</div></div>`;
  }
  // Division looks: the HUD layout with each unit's own colours, emblem and backdrop.
  const DIVS = {
    k9: { kicker: "LSPD · K9 UNIT · FIELD OPERATIONS", status: "K9 ON DUTY",
      svg: '<svg viewBox="0 0 64 64" fill="currentColor"><ellipse cx="17" cy="26" rx="6" ry="8" transform="rotate(-18 17 26)"/><ellipse cx="27" cy="15" rx="6" ry="8.5" transform="rotate(-6 27 15)"/><ellipse cx="39" cy="15" rx="6" ry="8.5" transform="rotate(6 39 15)"/><ellipse cx="49" cy="26" rx="6" ry="8" transform="rotate(18 49 26)"/><path d="M33 31c-8 0-15 9-15 16 0 6 5 8 9 7 3-1 4-2 6-2s3 1 6 2c4 1 9-1 9-7 0-7-7-16-15-16z"/></svg>' },
    asu: { kicker: "LSPD · AIR SUPPORT UNIT · FLIGHT DECK", status: "AIRBORNE",
      svg: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 17h48M32 17v7"/><path d="M20 34c0-6 5-10 12-10h4c7 0 11 5 11 11v1c0 3-2 5-5 5H25c-3 0-5-3-5-7z" fill="currentColor" fill-opacity=".18"/><path d="M47 33h9l3-5M37 25v7h9M27 41l-3 7M40 41l3 7M19 48h30"/></svg>' },
    cru: { kicker: "LSPD · CRISIS RESPONSE UNIT · TECHNICAL RESCUE", status: "RESCUE READY",
      svg: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="21" fill="none" stroke="currentColor" stroke-width="10"/><g stroke="#fff" stroke-width="10" fill="none" stroke-dasharray="11 22" stroke-dashoffset="5.5"><circle cx="32" cy="32" r="21"/></g><circle cx="32" cy="32" r="26.5" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".6"/></svg>' }
  };
  function hudBlockHTML(b, form) {
    switch (b.type) {
      case "banner": {
        const dv = form && DIVS[form.theme];
        const emblem = form && okImg(form.logoUrl) ? `<img src="${esc(form.logoUrl)}" alt="">` : dv ? `<span class="div-ico">${dv.svg}</span>` : "";
        return `<div class="hud-hero">
          ${emblem ? `<div class="hud-emblem"><span class="ring"></span><span class="ring r2"></span>${emblem}</div>` : ""}
          <div class="hud-htext"><div class="hud-kicker">${dv ? dv.kicker : "LSPD · SECURE REPORT TERMINAL"}</div><h2>${esc(b.title)}</h2>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ""}</div>
          <div class="hud-status"><span class="pulse"></span>${dv ? dv.status : "LINK SECURE"}</div>
        </div>`;
      }
      case "fields":
      case "strip": {
        const fs = b.fields || [];
        return `<div class="hud-fields n${Math.min(fs.length, 4)}${b.type === "strip" ? " strip" : ""}">${fs.map(hudField).join("")}</div>`;
      }
      case "text":
        if (b.style === "warning") return `<div class="hud-alert"><span class="ic">⚠</span><div>${esc(b.text)}</div></div>`;
        if (b.style === "heading") return `<div class="hud-heading">${esc(b.text)}</div>`;
        if (b.style === "hint") return `<div class="hud-hint">${esc(b.text)}</div>`;
        return `<div class="hud-note">${esc(b.text)}</div>`;
      case "checklist":
        return `<section class="hud-card">
          <header class="hud-chead"><h3>${esc(b.title)}</h3><span class="hud-chip" data-cc="${esc(b.id)}">0 / ${(b.items || []).length}</span></header>
          <div class="hud-progress"><i data-pbar="${esc(b.id)}"></i></div>
          <div class="hud-checks">${(b.items || []).map(it => `
            <label class="item hud-check"><input type="checkbox" data-chk="${esc(b.id)}" data-topic="${esc(it.topic)}"><span class="sw"></span>
              <span class="t"><b>${esc(it.topic)}</b>${it.standard ? `<small>${esc(it.standard)}</small>` : ""}</span></label>`).join("")}
          </div></section>`;
      case "repeater": {
        const cols = (b.columns || []).slice(0, 3);
        return `<section class="hud-card">
          <header class="hud-chead"><h3>${esc(b.title)}</h3><span class="hud-chip" data-rc="${esc(b.id)}">0 entries</span></header>
          <div class="hud-rhead" style="grid-template-columns:${hudCols(b)}">${cols.map(c => `<span>${esc(c.label)}</span>`).join("")}<span class="r">${esc(b.check && b.check.id ? b.check.label : "")}</span></div>
          <div class="hud-empty" data-empty="${esc(b.id)}">Nothing added yet.</div>
          <div class="anchor" data-anchor="${esc(b.id)}" style="display:none"></div>
          ${b.totals && b.totals.on ? `<div class="hud-sum" data-sum="${esc(b.id)}" style="display:none"><span></span></div>` : ""}
          <button type="button" class="hud-add" data-add="${esc(b.id)}"><span>＋</span>${esc(String(b.addLabel || "Add Row").replace(/^\+\s*/, ""))}</button>
        </section>`;
      }
      case "longtext":
        return `<section class="hud-card">
          <header class="hud-chead"><h3>${esc(b.title)}${req(b)}</h3><span class="hud-chip" data-count="${esc(b.id)}">0 / ${b.maxLength || 1000}</span></header>
          ${b.hint ? `<div class="hud-hint">${esc(b.hint)}</div>` : ""}
          ${hasGuide(b) ? guideHTML(b) : ""}
          <textarea class="g hud-ta ${(b.maxLength || 1000) <= 1500 ? "short" : ""}" data-f="${esc(b.id)}" maxlength="${b.maxLength || 1000}" placeholder="Type here…"></textarea>
        </section>`;
    }
    return "";
  }

  /**
   * Render a form definition into `mount`. Returns a controller.
   * opts: { draft: true|false, onStatus(msg) }
   */
  function render(form, mount, opts) {
    opts = opts || {};
    form = withDefaults(form);
    const blocks = form.blocks || [];
    const div = DIVS[form.theme] ? form.theme : "";
    const hud = form.theme === "hud" || !!div;
    const theme = hud ? "theme-hud" : form.theme === "dossier" ? "theme-dossier" : "theme-sheet";
    const wm = watermarkCSS(form);
    const wmOpacity = Math.min(Math.max(Number(form.watermarkOpacity) || (theme === "theme-sheet" ? 6 : 8), 2), 30) / 100;
    const wmHTML = wm ? `<div class="wm ${form.watermarkMode === "repeat" ? "" : "single"}" style="background-image:${wm};opacity:${wmOpacity}"></div>` : "";
    mount.innerHTML = hud
      ? `<div class="paper-wrap theme-hud${div ? " div-" + div : ""}"><div class="paper hud">${wmHTML}<div class="hud-grid-bg"></div>${div ? '<div class="div-deco"><i></i><i></i><i></i></div>' : ""}<div class="hud-scan"></div>
          ${blocks.map((b, i) => `<div class="hud-b k-${esc(b.type)}" data-b="${i}">${hudBlockHTML(b, form)}</div>`).join("")}</div></div>`
      : `<div class="paper-wrap ${theme}"><div class="paper ${theme}">${wmHTML}<table class="xl">
      <colgroup><col style="width:26.6%"><col style="width:35%"><col style="width:21.1%"><col style="width:17.3%"></colgroup>
      ${blocks.map((b, i) => `<tbody data-b="${i}">${blockHTML(b, form)}</tbody>`).join("")}</table></div></div>`;
    const root = mount.querySelector(".paper");
    const q = sel => root.querySelector(sel);
    const qa = sel => [...root.querySelectorAll(sel)];
    const repeaters = blocks.filter(b => b.type === "repeater");
    const fieldDefs = [];
    blocks.forEach(b => {
      if (b.type === "fields" || b.type === "strip") (b.fields || []).forEach(f => { if (f.type !== "static") fieldDefs.push(f); });
      if (b.type === "longtext") fieldDefs.push({ id: b.id, label: b.title, required: b.required, type: "longtext" });
    });

    function setDefaults() {
      fieldDefs.forEach(f => { if (f.type === "date" && f.defaultToday) { const el = q(`[data-f="${CSS.escape(f.id)}"]`); if (el && !el.value) el.value = todayISO(); } });
      fieldDefs.forEach(f => { if (f.type === "select" && f.default) { const el = q(`[data-f="${CSS.escape(f.id)}"]`); if (el && !el.value) el.value = f.default; } });
    }

    function addRow(b, vals) {
      const cols = (b.columns || []).slice(0, 3), sp = cols.length === 3 ? [1, 1, 1] : cols.length === 2 ? [1, 2] : [3];
      const ctl = c => c.type === "link"
          ? `<select class="g c" data-k="${esc(c.id)}" data-link="1"></select>`
          : c.type === "select"
          ? `<select class="g c" data-k="${esc(c.id)}">${c.blank ? `<option value="">— choose —</option>` : ""}${(c.options || []).map(o => `<option>${esc(o)}</option>`).join("")}</select>`
          : `<input class="g" type="text" maxlength="200" data-k="${esc(c.id)}" placeholder="${esc(c.placeholder || "")}"${c.type === "search" ? ` data-search="1" autocomplete="off"` : ""}>`;
      const hasCheck = b.check && b.check.id;
      let tr;
      if (hud) {
        tr = document.createElement("div");
        tr.className = "dyn hud-row"; tr.dataset.rep = b.id;
        tr.style.gridTemplateColumns = hudCols(b);
        tr.innerHTML = cols.map(c => `<div class="cell" data-label="${esc(c.label)}">${ctl(c)}</div>`).join("") +
          `<div class="act">${hasCheck ? `<label class="hud-tick" title="${esc(b.check.label)}"><input type="checkbox" data-k="${esc(b.check.id)}"><span class="bx"></span><em>${esc(b.check.label)}</em></label>` : ""}<button type="button" class="rm" title="Remove row">✕</button></div>`;
      } else {
        tr = document.createElement("tr");
        tr.className = "dyn"; tr.dataset.rep = b.id;
        tr.innerHTML = cols.map((c, i) => `<td colspan="${sp[i]}">${ctl(c)}</td>`).join("") +
          `<td class="act"><div class="actcell">${hasCheck ? `<label class="xck"><input type="checkbox" data-k="${esc(b.check.id)}"><span class="bx">${CHECK_SVG}</span></label>` : "<span></span>"}<button type="button" class="rm" title="Remove row">✕</button></div></td>`;
      }
      // a new row's "pick from list" boxes default to the previous row's choice (same suspect)
      const prev = qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).pop();
      tr.querySelectorAll("select[data-link]").forEach(el => {
        el.dataset.v = vals ? (vals[el.dataset.k] || "") : (prev ? prev.querySelector(`[data-k="${CSS.escape(el.dataset.k)}"]`).value : "");
      });
      if (vals) tr.querySelectorAll("[data-k]").forEach(el => {
        const v = vals[el.dataset.k];
        if (el.dataset.link) return;
        if (el.type === "checkbox") el.checked = !!v; else if (v != null) { el.value = v; if (el.list) el.title = v; }
      });
      q(`[data-anchor="${CSS.escape(b.id)}"]`).before(tr);
      refresh();
      return tr;
    }

    // values from another list in this form, e.g. the names of rows whose Role is "Suspect"
    function linkChoices(c) {
      const seen = new Set();
      qa(`.dyn[data-rep="${CSS.escape(c.source || "")}"]`).forEach(tr => {
        const get = k => { const el = tr.querySelector(`[data-k="${CSS.escape(k)}"]`); return el ? el.value.trim() : ""; };
        if (c.filterCol && c.filterValue && get(c.filterCol).toLowerCase() !== String(c.filterValue).toLowerCase()) return;
        const v = get(c.sourceCol || ""); if (v) seen.add(v);
      });
      return [...seen];
    }
    function fillLinks(b) {
      (b.columns || []).filter(c => c.type === "link").forEach(c => {
        const choices = linkChoices(c);
        qa(`.dyn[data-rep="${CSS.escape(b.id)}"] select[data-k="${CSS.escape(c.id)}"]`).forEach(sel => {
          let cur = sel.dataset.v != null ? sel.dataset.v : sel.value;
          delete sel.dataset.v;
          if (!cur && choices.length) cur = choices[0];
          const opts = choices.includes(cur) || !cur ? choices.slice() : [cur].concat(choices);
          const key = opts.join("\u0001");
          if (sel.dataset.opts !== key) {
            sel.innerHTML = opts.length ? opts.map(o => `<option>${esc(o)}</option>`).join("")
              : `<option value="">— add a ${esc(String(c.filterValue || "person").toLowerCase())} above —</option>`;
            sel.dataset.opts = key;
          }
          sel.value = cur || "";
        });
      });
    }
    function totalsHTML(b) {
      const t = b.totals, groups = {}, order = [];
      qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).forEach(tr => {
        const get = k => { const el = tr.querySelector(`[data-k="${CSS.escape(k)}"]`); return el ? el.value.trim() : ""; };
        const s = sentence(get(t.col), get(t.countCol));
        if (!s.any) return;
        const g = (b.groupBy && get(b.groupBy)) || "Total";
        if (!groups[g]) { groups[g] = { m: 0, f: 0 }; order.push(g); }
        groups[g].m += s.months; groups[g].f += s.fine;
      });
      return order.map(g => `<b>${esc(g)}</b>: ${groups[g].m} months · $${groups[g].f.toLocaleString("en-US")}`).join("<span class='sep'>|</span>");
    }

    // {fieldId} -> that answer; {list.col} -> names from a list; {list.col?filterCol=Value} -> only matching rows
    function rowsOf(id) {
      return qa(`.dyn[data-rep="${CSS.escape(id)}"]`).map(tr => {
        const o = {}; tr.querySelectorAll("[data-k]").forEach(el => o[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value.trim()); return o;
      });
    }
    function refValues(a, col, fcol, fval) {
      if (col) return rowsOf(a).filter(r => !fcol || String(r[fcol] || "").toLowerCase() === String(fval).toLowerCase()).map(r => r[col]).filter(Boolean);
      const f = fieldDefs.find(x => x.id === a), el = q(`[data-f="${CSS.escape(a)}"]`);
      let v = el ? el.value.trim() : "";
      if (v && f && f.type === "date") v = new Date(v + "T00:00").toLocaleDateString("en-US");
      return v ? [v] : [];
    }
    const nice = arr => arr.length < 3 ? arr.join(" and ") : arr.slice(0, -1).join(", ") + " and " + arr[arr.length - 1];
    const REF = /\{(\w+)(?:\.(\w+))?(?:\?(\w+)=([^}]+))?\}/g;
    function fillStarter(tpl) {
      return String(tpl || "").replace(REF, (m, a, col, fcol, fval) => {
        const vals = refValues(a, col, fcol, fval);
        if (vals.length) return nice(vals);
        const f = fieldDefs.find(x => x.id === a);
        return "[" + (fval ? fval.toLowerCase() + " name" : (f ? String(f.label || a).replace(/[:(].*$/, "").trim().toLowerCase() : (col || a))) + "]";
      });
    }
    function insertText(ta, text) {
      // add after the paragraph the cursor is in (never split a sentence)
      const caret = Math.min(ta.dataset.caret != null ? +ta.dataset.caret : ta.value.length, ta.value.length);
      const nextBreak = ta.value.indexOf("\n\n", caret);
      const start = nextBreak === -1 ? ta.value.length : nextBreak;
      const before = ta.value.slice(0, start).replace(/\s+$/, ""), after = ta.value.slice(start);
      const sep = before ? "\n\n" : "";
      ta.value = (before + sep + text + (after.trim() ? "\n\n" + after.replace(/^\s+/, "") : "")).slice(0, Number(ta.maxLength) > 0 ? ta.maxLength : 1e6);
      const from = before.length + sep.length, br = ta.value.indexOf("[", from), end = br > -1 ? ta.value.indexOf("]", br) : -1;
      ta.focus();
      if (br > -1 && end > br && br < from + text.length) ta.setSelectionRange(br, end + 1); // select the first [bracket] to type over
      else ta.setSelectionRange(from + text.length, from + text.length);
      ta.dataset.caret = ta.selectionEnd;
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    ["keyup", "mouseup", "select", "input"].forEach(ev => root.addEventListener(ev, e => {
      if (e.target.tagName === "TEXTAREA") e.target.dataset.caret = e.target.selectionEnd;
    }));
    function guideChecks(b) {
      const g = b.guide, t = (q(`[data-f="${CSS.escape(b.id)}"]`) || {}).value || "", low = t.toLowerCase(), out = [];
      out.push(["Written in first person", /\b(I|my|me)\b/.test(t)]);
      out.push(["Includes times", /\b\d{3,4}\s*(hrs|hours)\b|\b\d{1,2}:\d{2}\b/i.test(t)]);
      (g.mention || []).forEach(m => {
        const mm = /\{(\w+)(?:\.(\w+))?(?:\?(\w+)=([^}]+))?\}/.exec(m.ref || "");
        if (!mm) return;
        const vals = refValues(mm[1], mm[2], mm[3], mm[4]);
        if (vals.length) out.push([m.label, vals.every(v => low.includes(v.toLowerCase()))]);
      });
      (g.keywords || []).forEach(k => out.push([k.label, (k.words || []).some(w => w && low.includes(String(w).toLowerCase()))]));
      if (t.trim()) out.push(["No [brackets] left", !/\[[^\]\n]{1,80}\]/.test(t)]);
      return out;
    }

    function renderOfc() {
      qa("[data-ofc]").forEach(box => {
        const hid = box.querySelector("[data-f]"), chips = box.querySelector(".ofc-chips");
        const f = fieldDefs.find(x => x.id === hid.dataset.f), list = parseOfc(hid.value);
        box.classList.toggle("full", box.dataset.max === "1" && list.length >= 1);
        if (f && f.type === "officer" && f.fillId) {                // keep the linked Discord ID box in step
          const t = q(`[data-f="${CSS.escape(f.fillId)}"]`), want = list[0] ? list[0].id : "";
          if (t && t.value !== want && (want || t.dataset.filled)) { t.value = want; t.dataset.filled = want ? "1" : ""; t.classList.remove("err"); }
        }
        if (chips.dataset.k === hid.value) return;
        chips.dataset.k = hid.value;
        chips.innerHTML = parseOfc(hid.value).map((o, i) => `<span class="ofc-chip" title="${esc(o.id ? "Discord ID " + o.id : "No Discord ID (won't be mentioned)")}">${esc(o.name || "@" + o.id)}${o.id ? "" : " <i>no ID</i>"}<b class="ofc-x" data-i="${i}" title="Remove">×</b></span>`).join("");
      });
    }
    function ofcAdd(id, entry) {
      const hid = q(`[data-f="${CSS.escape(id)}"]`), box = hid.closest("[data-ofc]");
      let list = parseOfc(hid.value);
      if (list.some(o => (entry.id && o.id === entry.id) || (!entry.id && o.name.toLowerCase() === entry.name.toLowerCase()))) return;
      if (box.dataset.max === "1") { list = [entry]; pkClose(); } else list.push(entry);
      hid.value = fmtOfc(list);
      hid.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function pickerFor(el) {
      if (el.dataset.search) {
        const row = el.closest(".dyn"), b = repeaters.find(x => x.id === row.dataset.rep), c = (b.columns || []).find(x => x.id === el.dataset.k);
        return { items: (c.options || []).map(chargeItem), noun: c.label ? "options" : "options", emptyText: "No match. Your text will be kept as typed.",
          onPick: it => { if (!it) return; el.value = it.value; el.title = it.value; el.dispatchEvent(new Event("input", { bubbles: true })); pkClose();
            const next = row.querySelectorAll("input[type=text],select")[[...row.querySelectorAll("input[type=text],select")].indexOf(el) + 1]; if (next) next.focus(); } };
      }
      if (el.dataset.ofcin) {
        const id = el.dataset.ofcin, hid = q(`[data-f="${CSS.escape(id)}"]`);
        const of = fieldDefs.find(x => x.id === id);
        const list = rosterItems(of && of.rosterDivisions, of);
        const strict = of && (of.rosterStrict || (fieldRoster(of) && !of.allowTyped)) && list.length;
        return { multi: true, strict: strict, items: list, noun: "on the roster", emptyText: strict ? "Not on the roster. Only roster officers can be added." : ROSTER.length ? "Not on the roster. Press Enter to add it as typed (paste a Discord ID to mention them)." : "Type a name, or paste a Discord ID, then press Enter.",
          exclude: it => parseOfc(hid.value).some(o => o.id ? o.id === it.id : o.name === it.label),
          onPick: it => { if (!it) return; ofcAdd(id, { name: it.label, id: it.id || "" });
            if (of && of.pairFill && it.pair) { const t = q(`[data-f="${CSS.escape(of.pairFill)}"]`); if (t) { t.value = it.pair; t.dispatchEvent(new Event("input", { bubbles: true })); t.dispatchEvent(new Event("change", { bubbles: true })); } } el.value = ""; if (PK) { PK.typed = false; PK.idx = -1; pkRender(); } } };
      }
      if (el.dataset.roster) {
        const f = fieldDefs.find(x => x.id === el.dataset.f), isId = f && f.type === "discord_id";
        return { items: rosterItems(f && f.rosterDivisions, f), noun: "on the roster", emptyText: "Not on the roster. What you typed will be kept.",
          onPick: it => { if (!it) return;
            el.value = isId ? (it.id || "") : it.label;
            if (el.dataset.fill && it.id) { const t = q(`[data-f="${CSS.escape(el.dataset.fill)}"]`); if (t) { t.value = it.id; t.classList.remove("err"); } }
            el.classList.remove("err"); el.dispatchEvent(new Event("input", { bubbles: true })); pkClose(); } };
      }
      return null;
    }
    root.addEventListener("focusin", e => { const el = e.target; if (el.matches && el.matches("[data-search],[data-ofcin],[data-roster]")) { const c = pickerFor(el); if (c && (c.items.length || el.dataset.ofcin)) pkOpen(el, c); } });
    root.addEventListener("focusout", e => { if (PK && PK.input === e.target) setTimeout(() => { if (PK && document.activeElement !== PK.input) pkClose(); }, 120); });
    const reopen = el => { if (el.matches && el.matches("[data-search],[data-ofcin],[data-roster]") && (!PK || PK.input !== el)) { const c = pickerFor(el); if (c && (c.items.length || el.dataset.ofcin)) pkOpen(el, c); } };
    root.addEventListener("input", e => {
      reopen(e.target);                                    // typing after Esc brings the list back
      if (PK && PK.input === e.target) { PK.typed = true; PK.idx = -1; pkRender(); }
    }, true);
    root.addEventListener("click", e => reopen(e.target));
    root.addEventListener("keydown", e => {
      const el = e.target;
      if (el.dataset && el.dataset.ofcin && e.key === "Backspace" && !el.value) {
        const hid = q(`[data-f="${CSS.escape(el.dataset.ofcin)}"]`), list = parseOfc(hid.value);
        if (list.length) { list.pop(); hid.value = fmtOfc(list); hid.dispatchEvent(new Event("change", { bubbles: true })); }
        return;
      }
      if (!PK || PK.input !== el) {
        if (e.key === "ArrowDown" && el.matches && el.matches("[data-search],[data-ofcin],[data-roster]")) { const c = pickerFor(el); if (c) { pkOpen(el, c); e.preventDefault(); } }
        if (e.key === "Enter" && el.matches && el.matches("[data-search],[data-ofcin],[data-roster]")) e.preventDefault();
        return;
      }
      if (e.key === "ArrowDown") { PK.idx = Math.min(PK.list.length - 1, PK.idx + 1); pkRender(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { PK.idx = Math.max(0, PK.idx - 1); pkRender(); e.preventDefault(); }
      else if (e.key === "Escape") { pkClose(); e.preventDefault(); }
      else if (e.key === "Enter") {
        e.preventDefault();
        if (PK.idx >= 0 && PK.list[PK.idx]) PK.onPick(PK.list[PK.idx]);
        else if (el.dataset.ofcin && el.value.trim() && PK.strict) { /* roster-only: ignore free text */ }
        else if (el.dataset.ofcin && el.value.trim()) {
          const t = el.value.trim(), digits = t.replace(/\D/g, "");
          const hit = ROSTER.find(p => p.id && p.id === digits);
          ofcAdd(el.dataset.ofcin, /^\d{15,21}$/.test(digits) && digits.length === t.replace(/\s/g, "").length ? { name: hit ? hit.name : "", id: digits } : { name: t, id: "" });
          el.value = ""; PK.typed = false; pkRender();
        } else pkClose();
      } else if (e.key === "Tab") pkClose();
    });

    function refresh() {
      renderOfc();
      blocks.forEach(b => {
        if (b.type === "longtext" && hasGuide(b)) {
          const box = q(`[data-gchecks="${CSS.escape(b.id)}"]`);
          if (box) box.innerHTML = guideChecks(b).map(([l, ok]) => `<span class="ng-chk${ok ? " ok" : ""}">${ok ? "✓" : "○"} ${esc(l)}</span>`).join("");
        }
        if (b.type === "repeater") {
          fillLinks(b);
          const sr = b.totals && b.totals.on && q(`[data-sum="${CSS.escape(b.id)}"]`);
          if (sr) { const html = totalsHTML(b); sr.style.display = html ? "" : "none"; sr.firstElementChild.innerHTML = "⚖️ Sentence total — " + html; }
        }
        if (b.type === "checklist") {
          const boxes = qa(`[data-chk="${CSS.escape(b.id)}"]`);
          boxes.forEach(x => x.closest(".item").classList.toggle("done", x.checked));
          const pb = q(`[data-pbar="${CSS.escape(b.id)}"]`);
          if (pb) pb.style.width = (boxes.length ? Math.round(100 * boxes.filter(x => x.checked).length / boxes.length) : 0) + "%";
          const cc = q(`[data-cc="${CSS.escape(b.id)}"]`);
          if (cc) cc.textContent = boxes.filter(x => x.checked).length + " / " + boxes.length;
        }
        if (b.type === "repeater") {
          const n = qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).length;
          q(`[data-rc="${CSS.escape(b.id)}"]`).textContent = n + (n === 1 ? " entry" : " entries");
          q(`[data-empty="${CSS.escape(b.id)}"]`).style.display = n ? "none" : "";
        }
        if (b.type === "longtext") {
          const el = q(`[data-f="${CSS.escape(b.id)}"]`), cnt = q(`[data-count="${CSS.escape(b.id)}"]`);
          const max = b.maxLength || 1000;
          cnt.textContent = el.value.length + " / " + max;
          cnt.classList.toggle("over", el.value.length > max * 0.95);
        }
      });
    }

    // ---- events ----
    root.addEventListener("mouseover", e => {
      const st = e.target.closest("[data-step]");
      if (st && st.dataset.help) { const h = q(`[data-ghelp="${CSS.escape(st.dataset.for)}"]`); if (h) h.textContent = "Step " + (+st.dataset.step + 1) + ": " + st.dataset.help; }
    });
    root.addEventListener("click", e => {
      const t = e.target;
      const x = t.closest(".ofc-x");
      if (x) {
        const hid = x.closest("[data-ofc]").querySelector("[data-f]"), list = parseOfc(hid.value);
        list.splice(+x.dataset.i, 1); hid.value = fmtOfc(list); hid.dispatchEvent(new Event("change", { bubbles: true })); return;
      }
      const box = t.closest("[data-ofc]");
      if (box && !t.closest(".ofc-in")) { box.querySelector(".ofc-in").focus(); }
      const step = t.closest("[data-step]");
      if (step) {
        const b = blocks.find(x => x.id === step.dataset.for), st = b.guide.steps[+step.dataset.step];
        insertText(q(`[data-f="${CSS.escape(b.id)}"]`), fillStarter(st.starter));
        step.classList.add("used"); return;
      }
      const outline = t.closest("[data-outline]");
      if (outline) {
        const b = blocks.find(x => x.id === outline.dataset.outline), ta = q(`[data-f="${CSS.escape(b.id)}"]`);
        if (ta.value.trim() && !confirm("Add the full outline below what you've already written?")) return;
        ta.setSelectionRange(ta.value.length, ta.value.length);
        insertText(ta, b.guide.steps.map(st => fillStarter(st.starter)).join("\n\n"));
        return;
      }
      const tips = t.closest("[data-tips]");
      if (tips) { const ul = q(`[data-gtips="${CSS.escape(tips.dataset.tips)}"]`); ul.hidden = !ul.hidden; tips.classList.toggle("on", !ul.hidden); return; }
      const add = t.closest("[data-add]");
      if (add) {
        const tr = addRow(repeaters.find(b => b.id === add.dataset.add));
        (tr.querySelector("input[type=text]") || tr.querySelector("select")).focus();
        changed(); return;
      }
      const rm = t.closest(".rm");
      if (rm) { rm.closest(".dyn").remove(); refresh(); changed(); return; }
      const nowB = t.closest("[data-now]");
      if (nowB) { const d = new Date(); q(`[data-f="${CSS.escape(nowB.dataset.now)}"]`).value = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); changed(); return; }
      const today = t.closest("[data-today]");
      if (today) { q(`[data-f="${CSS.escape(today.dataset.today)}"]`).value = todayISO(); changed(); return; }
      const gen = t.closest("[data-gen]");
      if (gen) { const el = q(`[data-f="${CSS.escape(gen.dataset.gen)}"]`); el.value = caseNumber(gen.dataset.prefix); el.classList.remove("err"); changed(); return; }
      const td = t.closest("td.ck");
      if (td && !t.closest("label")) td.querySelector("input").click();
    });
    root.addEventListener("input", e => { if (e.target.list) e.target.title = e.target.value; refresh(); changed(); });
    root.addEventListener("change", () => { refresh(); changed(); });

    // ---- data ----
    function collect() {
      const values = {}, checklists = {}, reps = {};
      fieldDefs.forEach(f => { const el = q(`[data-f="${CSS.escape(f.id)}"]`); values[f.id] = el ? el.value.trim() : ""; });
      blocks.filter(b => b.type === "checklist").forEach(b => {
        checklists[b.id] = {};
        qa(`[data-chk="${CSS.escape(b.id)}"]`).forEach(x => checklists[b.id][x.dataset.topic] = x.checked);
      });
      repeaters.forEach(b => {
        reps[b.id] = qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).map(tr => {
          const o = {};
          tr.querySelectorAll("[data-k]").forEach(el => o[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value.trim());
          return o;
        });
      });
      return { form: form.id, values: values, checklists: checklists, repeaters: reps };
    }

    function load(d) {
      if (!d) return;
      Object.keys(d.values || {}).forEach(k => { const el = q(`[data-f="${CSS.escape(k)}"]`); if (el) el.value = d.values[k]; });
      Object.keys(d.checklists || {}).forEach(id => qa(`[data-chk="${CSS.escape(id)}"]`).forEach(x => x.checked = !!d.checklists[id][x.dataset.topic]));
      repeaters.forEach(b => ((d.repeaters || {})[b.id] || []).forEach(r => addRow(b, r)));
      refresh();
    }

    function isEmpty(d) {
      return !Object.keys(d.values).some(k => {
        const f = fieldDefs.find(x => x.id === k);
        return d.values[k] && !(f && f.type === "date" && f.defaultToday);
      }) && !Object.values(d.checklists).some(c => Object.values(c).some(Boolean)) && !Object.values(d.repeaters).some(r => r.length);
    }

    function validate() {
      qa(".err").forEach(x => x.classList.remove("err"));
      for (const f of fieldDefs) {
        const el = q(`[data-f="${CSS.escape(f.id)}"]`);
        const v = el ? el.value.trim() : "";
        if (f.required && !v) { el.classList.add("err"); el.focus(); return (f.label || f.id).replace(/[:(].*$/, "").trim() + " is required."; }
        if (v && f.roster && f.rosterStrict && (fieldRoster(f) || ROSTER).length && !rosterItems(f.rosterDivisions, f).some(it => (f.type === "discord_id" ? it.id : it.label) === v)) {
          el.classList.add("err"); el.focus(); return (f.label || f.id).replace(/[:(].*$/, "").trim() + ": pick a name from the roster list.";
        }
        if (v && f.type === "discord_id" && !/^\d{15,21}$/.test(v)) { el.classList.add("err"); el.focus(); return "Discord IDs are the 17-20 digit number (Developer Mode → right-click user → Copy User ID)."; }
      }
      return "";
    }

    function clear() {
      qa("input,select,textarea").forEach(el => { if (el.type === "checkbox") el.checked = false; else el.value = ""; });
      qa(".dyn").forEach(tr => tr.remove());
      qa(".err").forEach(x => x.classList.remove("err"));
      setDefaults(); refresh(); clearDraft();
    }

    function toText() {
      const d = collect(), L = [form.title.toUpperCase(), "=".repeat(Math.min(60, form.title.length + 8))];
      blocks.forEach(b => {
        if (b.type === "fields" || b.type === "strip") (b.fields || []).forEach(f => {
          if (f.type === "static") return;
          let v = d.values[f.id];
          if (v && f.type === "date") v = new Date(v + "T00:00").toLocaleDateString("en-US");
          L.push((f.label || f.id).replace(/:\s*$/, "") + ": " + (v || "-"));
        });
        if (b.type === "checklist") { L.push("", b.title + ":"); (b.items || []).forEach(it => L.push(`  [${d.checklists[b.id][it.topic] ? "X" : " "}] ${it.topic}`)); }
        if (b.type === "repeater") {
          const rows = d.repeaters[b.id] || [];
          if (rows.length) {
            L.push("", b.title + ":");
            rows.forEach((r, i) => L.push(`  ${i + 1}. ` + (b.columns || []).map(c => r[c.id]).filter(Boolean).join(" — ") + (b.check && b.check.id && r[b.check.id] ? ` (${b.check.label})` : "")));
          }
        }
        if (b.type === "longtext" && d.values[b.id]) L.push("", b.title + ":", d.values[b.id]);
      });
      return L.join("\n");
    }

    // ---- drafts (this browser only) ----
    const KEY = "lspd_draft_" + form.id;
    let timer;
    const status = msg => opts.onStatus && opts.onStatus(msg);
    function saveDraft() {
      if (!opts.draft) return;
      try {
        const d = collect();
        if (isEmpty(d)) { localStorage.removeItem(KEY); status(""); return; }
        d.t = Date.now();
        localStorage.setItem(KEY, JSON.stringify(d));
        status("✓ Draft auto-saved");
      } catch (e) {}
    }
    function clearDraft() { try { localStorage.removeItem(KEY); } catch (e) {} status(""); }
    function changed() {
      if (!opts.draft) return;
      clearTimeout(timer); status("Saving…"); timer = setTimeout(saveDraft, 400);
    }
    function restoreDraft() {
      if (!opts.draft) return null;
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        load(d);
        if (!isEmpty(collect())) { status("✓ Draft restored"); return d.t; }
      } catch (e) {}
      return null;
    }

    setDefaults();
    refresh();
    return { collect, validate, clear, toText, restoreDraft, saveDraft: () => { clearTimeout(timer); saveDraft(); } };
  }

  async function post(body) {
    // text/plain avoids a CORS preflight, which Apps Script web apps don't answer.
    const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
    return res.json();
  }
  async function loadConfig() {
    const ac = typeof AbortController === "function" ? new AbortController() : null, timer = ac && setTimeout(() => ac.abort(), 30000);
    let res;
    try { res = await fetch(ENDPOINT + "?action=config&t=" + Date.now(), ac ? { signal: ac.signal } : undefined); }
    catch (e) { throw new Error(e.name === "AbortError" ? "Google took too long to answer (30s)." : e.message); }
    finally { if (timer) clearTimeout(timer); }
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Could not load forms");
    if (!data.config) throw new Error("The Apps Script backend is out of date: paste the new WebApp.gs and deploy a new version.");
    return data.config;
  }

  return { ENDPOINT, BACKEND_NEEDS, DEFAULT_GUIDES, withDefaults, setRoster, setRosters, render, post, loadConfig, esc, todayISO, sentence };
})();
