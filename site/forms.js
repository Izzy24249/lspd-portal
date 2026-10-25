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
      `<datalist id="${esc(listId(b, c))}">${(c.options || []).filter(o => !isHeader(o)).map(o => `<option value="${esc(o)}"></option>`).join("")}</datalist>`).join("")).join("");
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
          `<tr class="sess">${fs.map((f, i) => `<td colspan="${sp[i]}" data-label="${esc(f.label)}" class="${f.type === "date" || f.type === "time" ? "datecell" : f.type === "static" ? "c static" : ""}">${inputHTML(f, true)}</td>`).join("")}</tr>` +
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
            <td class="topic">${esc(it.topic)}</td><td colspan="2" class="std">${esc(it.standard)}</td>
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
          <tr class="addrow"><td colspan="4">${browseCol(b) && (b.columns || []).some(x => x.type === "link") ? `<div class="whobar" data-whobar="${esc(b.id)}"></div>` : `<button type="button" class="mini" data-add="${esc(b.id)}">${esc(b.addLabel || "+ Add Row")}</button>${browseCol(b) ? ` <button type="button" class="mini browse" data-browse="${esc(b.id)}">${esc(browseLabel(b))}</button>` : ""}`}</td></tr>`;
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
  // ---- charge categories for the "Browse charges" pop-out ----
  // A list can set its own groups with header lines like "# Drug Offenses"; otherwise charges are sorted by keywords.
  const CHARGE_CATS = [
    ["Boating & Watercraft", "🚤", /\bboat|vessel|wake zone/i],
    ["Aviation", "✈️", /aircraft|pilot|\bfaa\b|flight restriction|hijack|aboard|boarding/i],
    ["Customs, Immigration & Federal", "🛂", /immigra|smuggl|customs|declar|agricultur|importing prohibited|re-entry|improper entry|passport|visa|federal|checkpoint|currency|alien|human traffick|unauthorized location|unlawful transportation/i],
    ["Commercial Vehicles", "🚛", /commercial|inspection|overweight|logbook|hazardous|permits|hours of service|medical certificate|load securement|defective equipment|proper documentation/i],
    ["Drug Offenses", "💊", /drug|controlled substance|narcotic|paraphernalia|prescription|intent to distribute/i],
    ["Weapons & Firearms", "🔫", /firearm|weapon|\bgun|ammunition|explosive|brandish|discharge|open carry|straw purchase|prohibited person/i],
    ["Wildlife, Animals & Environment", "🦌", /fish|catch limit|hunt|wildlife|animal|species|poach|logging|mining|dumping/i],
    ["Cyber Crimes", "💻", /phishing|computer|online|cyber/i],
    ["Fraud & Financial", "💰", /fraud|embezzle|tax evasion|launder|insider|forgery|ponzi|counterfeit|espionage|bribery|marked bills|identity theft/i],
    ["Serious Vehicle Crimes", "🚨", /\bdui\b|under the influence|hit and run|street racing|fleeing|elude|stolen vehicle|felony speeding|grand theft auto|carjack|vehicular|unauthorized use of a vehicle/i],
    ["Property & Theft", "🏚️", /theft|burglar|vandal|shoplift|stolen|graffiti|trespass|arson|breaking|squat|destruction|property|piracy|extortion|mischief|grave/i],
    ["Crimes Against Persons", "🩸", /murder|homicide|manslaughter|assault|battery|kidnap|stalk|robbery|domestic|threat|endanger|harass/i],
    ["Traffic & Parking", "🚦", /driv|vehicle|park|lane|yield|speed|plate|signal|tint|headlight|helmet|horn|traffic|u-turn|insurance|tow|tailgat|underglow|freeway|crosswalk|intersection|railroad|lighting|motorcycle|bus stop|sidewalk|alley|red light|double yellow|shoulder|move over|meter|roadway|hauling|riding in a|road rage|wrong way|careless|passing/i],
    ["Public Order & Obstruction", "⚖️", /./]
  ];
  // lists with a long "type to search" column get a pop-out to browse and tick several at once
  const browseCol = b => (b.columns || []).find(c => c.type === "search" && (c.options || []).filter(o => !isHeader(o)).length >= 12);
  const isChargeList = c => { const o = (c.options || []).filter(x => !isHeader(x)); return o.length && o.filter(x => CLASS_RE.test(x)).length >= o.length / 2; };
  const browseLabel = b => { const c = browseCol(b); return b.browseLabel || (c && isChargeList(c) ? "⚖️ Browse charges" : "☰ Browse list"); };
  const isHeader = o => /^#\s*\S/.test(String(o || ""));
  function chargeGroups(options) {
    const opts = (options || []).filter(o => String(o || "").trim());
    if (opts.some(isHeader)) {                                  // the list brings its own groups
      const out = []; let cur = null;
      opts.forEach(o => { if (isHeader(o)) { cur = { name: String(o).replace(/^#\s*/, "").trim(), icon: "📁", items: [] }; out.push(cur); } else { if (!cur) { cur = { name: "Other", icon: "📁", items: [] }; out.push(cur); } cur.items.push(o); } });
      return out.filter(g => g.items.length);
    }
    const map = new Map(CHARGE_CATS.map(([n, i]) => [n, { name: n, icon: i, items: [] }]));
    opts.forEach(o => { const name = CLASS_RE.exec(o) ? CLASS_RE.exec(o)[1] : o; const cat = CHARGE_CATS.find(([, , re]) => re.test(name)); map.get(cat[0]).items.push(o); });
    return [...map.values()].filter(g => g.items.length);
  }
  function chargeItem(o) {
    const m = CLASS_RE.exec(o), x = sentence(o, 1);
    if (!m) return { label: o, value: o, search: o.toLowerCase() };
    const sub = [x.months ? x.months + " months" : "", x.fine ? "$" + x.fine.toLocaleString("en-US") + " fine" : ""].filter(Boolean).join(" · ");
    return { label: m[1], value: o, sub: sub, badge: m[2][0].toUpperCase(), cls: m[2].toLowerCase(), search: o.toLowerCase() };
  }
  // optional division filter, e.g. "CID, Detectives" (matches the roster tab names)
  // "…matches" accepts a callsign pattern and/or words, comma-separated, e.g. "L-5##", "FTO", "L-4##, Sergeant"
  //   callsign pattern (has a digit, # or *): letters/digits only, # = any digit, * = anything ("L-501", "L501" both match)
  //   word: found anywhere in the cell as a whole word, any capitals ("FTO" matches "Senior FTO" but not "FTOS")
  const onlyTest = pat => {
    const tests = String(pat || "").split(",").map(t => t.trim()).filter(Boolean).map(t => {
      if (/[0-9#*]/.test(t)) {
        const re = new RegExp("^" + t.toUpperCase().replace(/[^A-Z0-9#*]/g, "").replace(/#/g, "\\d").replace(/\*/g, "[A-Z0-9]*") + "$");
        return v => re.test(v.toUpperCase().replace(/[^A-Z0-9]/g, ""));
      }
      const re = new RegExp("(^|[^a-z0-9])" + t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[^a-z0-9])", "i");
      return v => re.test(v);
    });
    return v => tests.some(t => t(String(v || "")));
  };
  const onlyFilter = (list, f) => {
    if (!f || !f.onlyCol || !f.onlyMatch || !list.some(p => p.more && f.onlyCol in p.more)) return list;   // column not loaded yet: show everyone
    const ok = onlyTest(f.onlyMatch);
    return list.filter(p => ok((p.more || {})[f.onlyCol]));
  };
  const rosterItems = (only, f) => onlyFilter(fieldRoster(f) || ROSTER, f).filter(p => {
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
        ${steps.length ? `<button type="button" class="ng-btn" data-draft="${esc(b.id)}" title="Writes a first draft from everything already filled in above">⚡ Draft from my report</button><button type="button" class="ng-btn ghost" data-outline="${esc(b.id)}">Blank outline</button>` : ""}
        ${tips.length ? `<button type="button" class="ng-btn ghost" data-tips="${esc(b.id)}">Tips</button>` : ""}</div>
      ${steps.length ? `<div class="ng-steps">${steps.map((st, i) => `<button type="button" class="ng-step" data-step="${i}" data-for="${esc(b.id)}" data-help="${esc(st.help || "")}"><b>${i + 1}</b>${esc(st.label)}</button>`).join("")}</div>
      <div class="ng-help" data-ghelp="${esc(b.id)}">Click a step to add it. Steps use what you've already entered (people, evidence, vehicles, charges); type over anything in <b>[brackets]</b>.</div>` : ""}
      <div class="ng-syncrow"><label class="ng-sync"><input type="checkbox" data-sync="${esc(b.id)}"><span class="sw"></span>🔄 Keep in sync with the report</label><span class="ng-syncst" data-gsync="${esc(b.id)}"></span></div>
      <div class="ng-gaps" data-ggaps="${esc(b.id)}" hidden></div>
      ${tips.length ? `<ul class="ng-tips" data-gtips="${esc(b.id)}" hidden>${tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <div class="ng-checks" data-gchecks="${esc(b.id)}"></div>
    </div>`;
  }

  // ===================== FUTURISTIC HUD LAYOUT (form Look = "hud") =====================
  // column widths: "narrow" | "normal" | "wide" (searchable lists default to wide)
  const colW = c => ({ narrow: ".45fr", wide: "2.1fr" }[c.width || (c.type === "search" || c.type === "officer" ? "wide" : "normal")] || "1fr");
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
          <div class="hud-rhead${browseCol(b) && (b.columns || []).some(x => x.type === "link") ? " sf-hide" : ""}" style="grid-template-columns:${hudCols(b)}">${cols.map(c => `<span>${esc(c.label)}</span>`).join("")}<span class="r">${esc(b.check && b.check.id ? b.check.label : "")}</span></div>
          <div class="hud-empty" data-empty="${esc(b.id)}">Nothing added yet.</div>
          <div class="anchor" data-anchor="${esc(b.id)}" style="display:none"></div>
          ${b.totals && b.totals.on ? `<div class="hud-sum" data-sum="${esc(b.id)}" style="display:none"><span></span></div>` : ""}
          ${browseCol(b) && (b.columns || []).some(x => x.type === "link") ? `<div class="whobar hud-whobar" data-whobar="${esc(b.id)}"></div>` : `<div class="hud-addrow"><button type="button" class="hud-add" data-add="${esc(b.id)}"><span>＋</span>${esc(String(b.addLabel || "Add Row").replace(/^\+\s*/, ""))}</button>${browseCol(b) ? `<button type="button" class="hud-add hud-browse" data-browse="${esc(b.id)}">${esc(browseLabel(b))}</button>` : ""}</div>`}
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
          : `<input class="g" type="text" maxlength="200" data-k="${esc(c.id)}" placeholder="${esc(c.placeholder || (c.type === "officer" ? "Search the roster…" : b.numbered ? c.label : ""))}"${c.type === "search" || c.type === "officer" ? ` data-search="1" autocomplete="off"` : ""}>`;
      const hasCheck = b.check && b.check.id;
      let tr;
      if (hud) {
        tr = document.createElement("div");
        tr.className = "dyn hud-row"; tr.dataset.rep = b.id;
        tr.style.gridTemplateColumns = hudCols(b);
        tr.innerHTML = cols.map((c, i) => `<div class="cell${c.type === "link" ? " linkcell" : ""}" data-label="${esc(c.label)}">${i === 0 && b.numbered ? '<span class="rnum"></span>' : ""}${ctl(c)}</div>`).join("") +
          (factList(b) ? `<input type="hidden" data-k="_id">` : "") +
          (tagSrc(b) ? `<input type="hidden" data-k="_tags"><div class="tagline"><button type="button" class="tag-add" data-tag>🔗 Link person</button><span class="tag-chips"></span></div>` : "") +
          `<div class="act">${hasCheck ? `<label class="hud-tick" title="${esc(b.check.label)}"><input type="checkbox" data-k="${esc(b.check.id)}"><span class="bx"></span><em>${esc(b.check.label)}</em></label>` : ""}<button type="button" class="rm" title="Remove row">✕</button></div>`;
      } else {
        tr = document.createElement("tr");
        tr.className = "dyn" + (b.numbered ? " numd" : ""); tr.dataset.rep = b.id;
        tr.innerHTML = cols.map((c, i) => `<td colspan="${sp[i]}" data-label="${esc(c.label)}"${c.type === "link" ? ' class="linkcell"' : ""}>${i === 0 && b.numbered ? '<span class="rnum"></span>' : ""}${ctl(c)}${i === 0 && factList(b) ? `<input type="hidden" data-k="_id">` : ""}${i === 0 && tagSrc(b) ? `<input type="hidden" data-k="_tags"><div class="tagline"><button type="button" class="tag-add" data-tag>🔗 Link person</button><span class="tag-chips"></span></div>` : ""}</td>`).join("") +
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
      const idEl = tr.querySelector('[data-k="_id"]'); if (idEl && !idEl.value) idEl.value = Math.random().toString(36).slice(2, 9);
      if (suspectFirst(b)) tr.classList.add("sf");
      q(`[data-anchor="${CSS.escape(b.id)}"]`).before(tr);
      refresh();
      return tr;
    }

    // ---- "Browse charges" pop-out: suspect first, then tap charges (one category at a time), set counts, add them all ----
    // ---- tag evidence / vehicles to people from Involved Persons ----
    // automatic for lists titled Evidence / Vehicles when the form has a persons list (Role + Name); a list can set  tag: false  to opt out
    function tagSrc(b) {
      if (!b || b.tag === false) return null;
      const src = repeaters.find(x => x !== b && (x.columns || []).some(c => /^name$/i.test(c.id) || /\bname\b/i.test(c.label || "")) && (x.columns || []).some(c => /role/i.test(c.id + " " + (c.label || ""))));
      if (!src) return null;
      if (!(b.tag && b.tag.source) && !/evidence|vehicle|propert|item|weapon/i.test(b.title || "")) return null;
      const nc = src.columns.find(c => /^name$/i.test(c.id)) || src.columns.find(c => /\bname\b/i.test(c.label || "")), rc = src.columns.find(c => /role/i.test(c.id + " " + (c.label || "")));
      return { source: (b.tag && b.tag.source) || src.id, col: nc.id, roleCol: rc && rc.id };
    }
    const tagList = v => String(v || "").split(";").map(x => x.trim()).filter(Boolean);
    function tagPeople(b) {
      const t = tagSrc(b); if (!t) return [];
      const seen = new Set(), out = [];
      rowsOf(t.source).forEach(r => { const n = String(r[t.col] || "").trim(); if (n && !seen.has(n)) { seen.add(n); out.push({ name: n, role: t.roleCol ? r[t.roleCol] || "" : "" }); } });
      return out;
    }
    const roleCls = r => "r-" + String(r || "other").toLowerCase().replace(/[^a-z]+/g, "-");
    const initials = n => ((n.match(/\b[A-Za-z]/g) || ["?"]).slice(0, 2).join("")).toUpperCase();
    function drawTags() {
      repeaters.filter(tagSrc).forEach(b => {
        const people = tagPeople(b), roleOf = n => (people.find(p => p.name === n) || {}).role;
        qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).forEach(tr => {
          const hid = tr.querySelector('[data-k="_tags"]'), box = tr.querySelector(".tag-chips"), btn = tr.querySelector("[data-tag]"); if (!hid || !box) return;
          const names = tagList(hid.value), key = JSON.stringify([names, names.map(roleOf), tr.classList.contains("tg")]);
          if (box.dataset.ck === key) return; box.dataset.ck = key;
          box.innerHTML = names.map(n => { const r = roleOf(n); return `<span class="tchip ${roleCls(r)}${r === undefined ? " gone" : ""}" title="${r === undefined ? "No longer in Involved Persons" : esc(r)}"><i>${esc(initials(n))}</i>${esc(n)}${r ? `<small>${esc(r)}</small>` : ""}<button type="button" class="tx" data-untag="${esc(n)}" aria-label="Unlink ${esc(n)}">✕</button></span>`; }).join("");
          btn.textContent = names.length ? (tr.classList.contains("tg") ? "🔗 Change link" : "＋ Link") : "🔗 Link person";
        });
      });
    }
    let TAGPOP = null;
    function closeTagPop() { if (TAGPOP) { TAGPOP.remove(); TAGPOP = null; } }
    function openTagPop(btn) {
      closeTagPop();
      const tr = btn.closest(".dyn"), b = repeaters.find(x => x.id === tr.dataset.rep), hid = tr.querySelector('[data-k="_tags"]');
      const people = tagPeople(b), src = blocks.find(x => x.id === tagSrc(b).source);
      const pop = document.createElement("div"); pop.className = "tag-pop"; TAGPOP = pop;
      const draw = () => { const cur = tagList(hid.value);
        pop.innerHTML = `<div class="tp-h">Link to someone in ${esc(titleWords((src && src.title) || "Involved Persons"))}</div>` + (people.length
          ? people.map(p => `<button type="button" class="tp-i${cur.includes(p.name) ? " on" : ""}" data-n="${esc(p.name)}"><span class="tp-ck"></span><i class="${roleCls(p.role)}">${esc(initials(p.name))}</i><b>${esc(p.name)}</b>${p.role ? `<small>${esc(p.role)}</small>` : ""}</button>`).join("")
          : `<div class="tp-none">Nobody listed yet. Add people in ${esc(titleWords((src && src.title) || "Involved Persons"))} first.</div>`) + `<button type="button" class="tp-done">Done</button>`; };
      draw();
      pop.addEventListener("click", e => {
        const i = e.target.closest(".tp-i");
        if (i) { const cur = tagList(hid.value), n = i.dataset.n; hid.value = (cur.includes(n) ? cur.filter(x => x !== n) : cur.concat(n)).join("; "); draw(); drawTags(); refresh(); changed(); return; }
        if (e.target.closest(".tp-done")) closeTagPop();
      });
      document.body.appendChild(pop);
      const r = btn.getBoundingClientRect(), w = Math.min(300, innerWidth - 16);
      pop.style.width = w + "px"; pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
      const below = innerHeight - r.bottom;
      if (below < 260 && r.top > below) { pop.style.bottom = (innerHeight - r.top + 6) + "px"; } else pop.style.top = (r.bottom + 6) + "px";
      setTimeout(() => document.addEventListener("mousedown", function off(e) { if (!pop.contains(e.target) && e.target !== btn) { closeTagPop(); document.removeEventListener("mousedown", off); } }), 0);
    }
    const titleWords = t => String(t || "").toLowerCase().replace(/\b\w/g, m => m.toUpperCase());

    // ---- what the report already says, turned into narrative sentences ----
    function reportFacts() {
      const F = { date: "", time: "", location: "", type: "", persons: [], evidence: [], vehicles: [], charges: [] };
      const fv = re => { const f = fieldDefs.find(x => re.test(x.id + " " + (x.label || "")) && x.type !== "static"); const el = f && q(`[data-f="${CSS.escape(f.id)}"]`); return el ? el.value.trim() : ""; };
      const df = fieldDefs.find(x => x.type === "date"); if (df) { const v = (q(`[data-f="${CSS.escape(df.id)}"]`) || {}).value || ""; if (v) F.date = new Date(v + "T00:00").toLocaleDateString("en-US"); }
      const tf = fieldDefs.find(x => x.type === "time"); if (tf) { const v = (q(`[data-f="${CSS.escape(tf.id)}"]`) || {}).value || ""; if (v) F.time = v.replace(":", ""); }
      F.location = fv(/location|postal|address|where/i); F.type = fv(/case type|incident type|call type|\btype\b/i);
      const col = (b, re) => (b.columns || []).find(c => re.test(c.id + " " + (c.label || "")));
      repeaters.forEach(b => {
        const rows = rowsOf(b.id), t = (b.title || "") + " " + b.id;
        const g = (r, c) => c ? String(r[c.id] == null ? "" : r[c.id]).trim() : "";
        if (tagSrc(b) === null && col(b, /role/i) && col(b, /\bname\b|^name/i)) {
          const rc = col(b, /role/i), nc = col(b, /\bname\b|^name/i), oc = col(b, /note|detail|info/i);
          rows.forEach(r => { if (g(r, nc)) F.persons.push({ id: r._id || g(r, nc), role: g(r, rc), name: g(r, nc), notes: g(r, oc) }); });
        } else if (/evidence/i.test(t)) {
          const tc = col(b, /type|kind|item/i), dc = col(b, /desc/i), wc = col(b, /serial|where|location|found/i);
          rows.forEach(r => { if (g(r, tc) || g(r, dc)) F.evidence.push({ id: r._id || g(r, dc) || g(r, tc), type: g(r, tc), desc: g(r, dc), where: g(r, wc), whereLabel: wc ? wc.label : "", logged: !!(b.check && r[b.check.id]), tags: tagList(r._tags) }); });
        } else if (/vehicle/i.test(t)) {
          const pc = col(b, /plate|tag/i), cc = col(b, /colou?r/i), mc = col(b, /make|model/i);
          rows.forEach(r => { if (g(r, pc) || g(r, mc)) F.vehicles.push({ id: r._id || g(r, pc), plate: g(r, pc), color: g(r, cc), model: g(r, mc), run: !!(b.check && r[b.check.id]), tags: tagList(r._tags) }); });
        } else if (suspectFirst(b)) {
          const lc = linkColOf(b), c = browseCol(b), by = {};
          rows.forEach(r => { const who = g(r, lc) || "the suspect", ch = g(r, c); if (!ch) return; const m = CLASS_RE.exec(ch); (by[who] = by[who] || { suspect: who, items: [], warrant: false }).items.push({ name: m ? m[1] : ch, count: Math.max(1, parseInt(r[(b.totals && b.totals.countCol) || "count"], 10) || 1) }); if (b.check && r[b.check.id]) by[who].warrant = true; });
          F.charges = Object.values(by);
        }
      });
      return F;
    }
    const a_n = w => /^[aeiou]/i.test(w) ? "an " : "a ";
    // evidence type -> how it reads in a sentence ("narcotics", "video footage", not "a narcotics")
    const EV_NOUNS = { "narcotics": ["narcotics", 1], "bodycam / video": ["video footage", 1], "vehicle / fragment": ["vehicle fragment", 0], "blood sample": ["blood sample", 0], "document": ["document", 0], "photograph": ["photograph", 0], "fingerprint": ["fingerprint", 0], "shell casing": ["shell casing", 0], "firearm": ["firearm", 0] };
    function evNoun(type) {
      const t = String(type || "").trim().toLowerCase(), m = EV_NOUNS[t];
      if (m) return { word: m[0], mass: !!m[1] };
      if (!t || t === "other") return { word: "item", mass: false };
      return { word: t.replace(/\s*\/\s*/g, " / "), mass: /s$/.test(t) && !/ss$/.test(t) };
    }
    const S = {
      call: F => `On ${F.date || "[date]"} at approximately ${F.time || "[time]"} hours, I [was dispatched / responded] to ${F.location || "[location]"} regarding a reported ${F.type ? F.type.toLowerCase() : "[incident]"}.`,
      person: p => /victim|complain/i.test(p.role) ? `I made contact with the ${p.role.toLowerCase()}, ${p.name}${p.notes ? " (" + p.notes + ")" : ""}, who stated "[their words]".`
        : /witness/i.test(p.role) ? `I spoke with a witness, ${p.name}${p.notes ? " (" + p.notes + ")" : ""}, who stated that [what they saw].`
        : /suspect/i.test(p.role) ? `I identified ${p.name}${p.notes ? " (" + p.notes + ")" : ""} as a suspect based on [probable cause].`
        : `${p.name}${p.notes ? " (" + p.notes + ")" : ""} was identified as ${p.role ? a_n(p.role) + p.role.toLowerCase() : "an involved person"} because [reason].`,
      evPhrase: e => { const noun = evNoun(e.type), what = noun.word + (e.desc ? " (" + e.desc + ")" : "");
        const where = e.where ? (/serial/i.test(e.whereLabel) && !/\s/.test(e.where) ? `, serial number ${e.where}` : /^(at|in|on|under|behind|inside|outside|near|next|beside|by|from|along|across|between|underneath|beneath)\b/i.test(e.where) ? ` ${e.where}` : ` at ${e.where}`) : " at [where it was found]";
        return ((noun.mass ? "" : a_n(what)) + what + where).replace(/ +/g, " "); },
      evidence: e => `I located ${S.evPhrase(e)}${e.tags.length ? ", which is linked to " + nice(e.tags) : ""}. ${e.logged ? "I collected it and logged it into CAD evidence." : "I collected it and [logged it into CAD evidence]."}`,
      // several items linked to the same person(s): name them once, then list what was found
      evidenceGroup: (tags, list) => `I located the following evidence linked to ${nice(tags)}: ${list.length > 2 ? list.slice(0, -1).map(S.evPhrase).join("; ") + "; and " + S.evPhrase(list[list.length - 1]) : list.map(S.evPhrase).join(" and ")}. ${list.every(e => e.logged) ? "I collected each item and logged it into CAD evidence." : "I collected each item and [logged it into CAD evidence]."}`,
      vhPhrase: v => `${v.color || v.model ? "a" : "a vehicle"}${v.color ? " " + v.color.toLowerCase() : ""}${v.model ? " " + v.model : ""}${v.plate ? " bearing plate " + v.plate.toUpperCase() : " [plate]"}`,
      vehicle: v => { const p = S.vhPhrase(v); return `${p[0].toUpperCase() + p.slice(1)} was involved${v.tags.length ? " and is linked to " + nice(v.tags) : ""}. ${v.run ? "I ran the plate in CAD, which showed [registered owner / flags]." : "[I ran the plate in CAD, which showed registered owner / flags.]"}`; },
      vehicleGroup: (tags, list) => `The following vehicles are linked to ${nice(tags)}: ${nice(list.map(S.vhPhrase))}. ${list.every(v => v.run) ? "I ran the plates in CAD, which showed [registered owners / flags]." : "[I ran the plates in CAD, which showed registered owners / flags.]"}`,
      charges: c => `Based on the above, I charged ${c.suspect} with ${nice(c.items.map(i => i.count > 1 ? i.name + " (" + i.count + " counts)" : i.name))}.${c.warrant ? " A warrant was requested." : ""}`
    };
    function factSentences(kind, F) {
      F = F || reportFacts();
      if (kind === "call") return S.call(F);
      if (kind === "persons") return F.persons.filter(p => !/suspect/i.test(p.role)).map(S.person).join(" ");
      if (kind === "suspects") return F.persons.filter(p => /suspect/i.test(p.role)).map(S.person).concat(F.charges.map(S.charges)).join(" ");
      if (kind === "evidence") { const its = factItems(F); return [its.filter(i => i.kind === "evidence").map(i => i.text).join(" "), its.filter(i => i.kind === "vehicles").map(i => i.text).join(" ")].filter(Boolean).join("\n\n"); }
      return "";
    }
    // which guide step a sentence group belongs to
    const stepKind = label => /dispatch|call|respond/i.test(label) ? "call" : /contact|statement|victim|witness/i.test(label) ? "persons" : /evidence|vehicle/i.test(label) ? "evidence" : /suspect|arrest|charge/i.test(label) ? "suspects" : "";
    function stepText(st) {
      const k = stepKind(st.label || ""), auto = k ? factSentences(k) : "";
      return auto || fillStarter(st.starter);
    }
    // ===== narrative <-> report sync =====
    // Every sentence written from the report is remembered with what it came from. When the report changes, that sentence is rewritten
    // (or removed) in place; new people/evidence/vehicles/charges are added to the right paragraph. A sentence the officer edits by hand is theirs: it's left alone.
    const factList = b => !!(tagSrc(b) || ((b.columns || []).some(c => /role/i.test(c.id + " " + (c.label || ""))) && (b.columns || []).some(c => /^name$/i.test(c.id) || /\bname\b/i.test(c.label || ""))));
    const KINDS = ["call", "arrival", "persons", "investigation", "evidence", "vehicles", "suspects", "outcome"];
    const KIND_RE = { call: /\b(dispatched|responded to|was called|i was sent)\b/i, arrival: /\b(upon arrival|on scene|arrived)\b/i, persons: /\b(made contact|spoke with|interviewed|witness|victim)\b/i,
      investigation: /\b(investigation|i ran|i checked|reviewed|canvass)/i, evidence: /\b(located|evidence|casing|collected)\b/i, vehicles: /\b(bearing plate|vehicle|plate)\b/i,
      suspects: /\b(suspect|charged|probable cause|under arrest|miranda)\b/i, outcome: /\b(transported|booked|case remains|pending)\b/i };
    function factItems(F) {
      F = F || reportFacts();
      const out = [{ key: "call", kind: "call", text: S.call(F), label: F.location, icon: "📍", mention: F.location }];
      F.persons.forEach(p => { const nm = p.name.split(/[·,(]/)[0].trim();
        out.push({ key: "p:" + p.id, kind: /suspect/i.test(p.role) ? "suspects" : "persons", text: S.person(p), label: nm + (p.role ? " · " + p.role : ""), icon: /suspect/i.test(p.role) ? "🎯" : /victim/i.test(p.role) ? "🩹" : "👤", mention: nm }); });
      const grouped = (list, kind, one, many, keyP, lab, icon, ment) => {
        const groups = new Map();
        list.forEach(x => { const k = x.tags.length ? x.tags.slice().sort().join("|") : "~" + x.id; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
        groups.forEach((items, k) => {
          if (items.length === 1) { const x = items[0]; out.push({ key: keyP + ":" + x.id, kind: kind, text: one(x), label: lab(x), icon: icon, mention: ment(x) }); }
          else out.push({ key: keyP + "g:" + k, kind: kind, text: many(items[0].tags, items), label: (kind === "evidence" ? "Evidence" : "Vehicles") + " linked to " + nice(items[0].tags) + " (" + items.length + ")", icon: icon, mention: ment(items[0]) });
        });
      };
      grouped(F.evidence, "evidence", S.evidence, S.evidenceGroup, "e", e => (e.type || "Evidence") + (e.desc ? ": " + e.desc : ""), "🧪", e => e.desc || e.where);
      grouped(F.vehicles, "vehicles", S.vehicle, S.vehicleGroup, "v", v => [v.color, v.model, v.plate].filter(Boolean).join(" "), "🚗", v => v.plate || v.model);
      F.charges.forEach(c => out.push({ key: "c:" + c.suspect, kind: "suspects", text: S.charges(c), label: "Charges for " + c.suspect, icon: "⚖️", mention: "charged " + c.suspect }));
      return out;
    }
    const NARR = {};
    const narrKey = id => "lspd_narr_" + form.id + "_" + id;
    function narr(id) {
      if (!NARR[id]) { let v = null; try { v = JSON.parse(localStorage.getItem(narrKey(id)) || "null"); } catch (e) {} NARR[id] = v && Array.isArray(v.items) ? v : { on: false, items: [], own: [] }; }
      return NARR[id];
    }
    function saveNarr(id) { try { const n = narr(id); if (!n.on && !n.items.length) localStorage.removeItem(narrKey(id)); else localStorage.setItem(narrKey(id), JSON.stringify(n)); } catch (e) {} }
    const paras = t => String(t || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
    function kindOf(par, tracked) {
      const hit = tracked.find(it => par.includes(it.text)); if (hit) return hit.kind;
      for (const k of KINDS) if (KIND_RE[k].test(par)) return k;
      return "";
    }
    // put a sentence at the end of its section's paragraph, or start that section in the right order
    function placeSentence(text, kind, value, tracked) {
      const ps = paras(value), kinds = ps.map(p => kindOf(p, tracked));
      const last = kinds.lastIndexOf(kind);
      if (last > -1) { ps[last] = ps[last] + " " + text; return ps.join("\n\n"); }
      const order = KINDS.indexOf(kind); let at = 0;
      kinds.forEach((k, i) => { if (k && KINDS.indexOf(k) <= order) at = i + 1; });
      if (!kinds.some(k => k) && ps.length) at = ps.length;              // nothing recognisable yet: add to the end
      ps.splice(at, 0, text); return ps.join("\n\n");
    }
    function setNarrative(ta, value) {
      if (ta.value === value) return;
      const focused = document.activeElement === ta, caret = ta.selectionEnd;
      ta.value = value.slice(0, Number(ta.maxLength) > 0 ? ta.maxLength : 1e6);
      if (focused) ta.setSelectionRange(Math.min(caret, ta.value.length), Math.min(caret, ta.value.length));
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function track(id, item) { const n = narr(id); n.items = n.items.filter(x => x.key !== item.key).concat({ key: item.key, kind: item.kind, text: item.text }); saveNarr(id); }
    function addFact(b, item) {
      const ta = q(`[data-f="${CSS.escape(b.id)}"]`), n = narr(b.id);
      setNarrative(ta, placeSentence(item.text, item.kind, ta.value, n.items)); track(b.id, item);
    }
    let SYNCING = false, READY = !opts.draft;                // READY: don't touch the narrative until a saved draft has been put back
    function syncNarrative(b) {
      const n = narr(b.id), ta = q(`[data-f="${CSS.escape(b.id)}"]`); if (!READY || !ta || (!n.items.length && !n.on) || SYNCING) return;
      n.own = n.own || [];
      SYNCING = true;
      try {
        const now = factItems(), byKey = {}; now.forEach(it => byKey[it.key] = it);
        let v = ta.value;
        n.items = n.items.filter(it => {
          if (!v.includes(it.text)) { if (!n.own.includes(it.key)) n.own.push(it.key); return false; }   // edited by hand (or deleted): it's the officer's now, never re-added
          const cur = byKey[it.key];
          if (!cur) { v = v.replace(it.text, "").replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(); return false; }   // the thing was removed from the report
          if (cur.text !== it.text) { v = v.replace(it.text, cur.text); it.text = cur.text; }
          return true;
        });
        if (n.on) {                                                        // new things in the report go into the right paragraph
          const known = new Set(n.items.map(it => it.key)), low = v.toLowerCase();
          now.forEach(it => {
            if (known.has(it.key) || it.key === "call" || n.own.includes(it.key)) return;
            const m = mentionOf(it); if (m && low.includes(m.toLowerCase())) return;   // already written about by hand
            v = placeSentence(it.text, it.kind, v, n.items); n.items.push({ key: it.key, kind: it.kind, text: it.text });
          });
        }
        setNarrative(ta, v); saveNarr(b.id);
      } finally { SYNCING = false; }
      const st = q(`[data-gsync="${CSS.escape(b.id)}"]`);
      if (st) st.textContent = n.on ? `Synced · ${n.items.length} sentence${n.items.length === 1 ? "" : "s"} follow your report. Edit one yourself and it stops changing.` : n.items.length ? `${n.items.length} added sentence${n.items.length === 1 ? "" : "s"} follow your report.` : "";
    }
    // a word that shows the narrative already covers a fact (used to avoid writing it twice)
    function mentionOf(it) { return it.mention || ""; }
    // the full first draft: report facts in their sections, plus the guide's starters for what only the officer knows
    function buildDraft(b) {
      const F = reportFacts(), items = factItems(F), by = k => items.filter(it => it.kind === k);
      const starterFor = k => { const st = (b.guide.steps || []).find(x => (stepKind(x.label || "") || labelKind(x.label || "")) === k); return st ? fillStarter(st.starter) : ""; };
      const out = [], tracked = [];
      KINDS.forEach(k => {
        const its = by(k);
        if (its.length) { out.push(its.map(it => it.text).join(" ")); its.forEach(it => tracked.push(it)); }
        else if (["arrival", "investigation", "outcome"].includes(k) || (k === "persons" && !F.persons.length) || (k === "evidence" && !F.evidence.length && !F.vehicles.length)) { const t = starterFor(k); if (t) out.push(t); }
      });
      return { text: out.join("\n\n"), tracked: tracked };
    }
    const labelKind = l => /arriv/i.test(l) ? "arrival" : /investig/i.test(l) ? "investigation" : /outcome|result|transport|close/i.test(l) ? "outcome" : "";

    // facts in the report the narrative doesn't mention yet (tap one to add its sentence)
    function narrativeGaps(b) {
      const low = ((q(`[data-f="${CSS.escape(b.id)}"]`) || {}).value || "").toLowerCase(), n = narr(b.id), tracked = new Set(n.items.map(it => it.key));
      return factItems().filter(it => {
        if (tracked.has(it.key) || (n.own || []).includes(it.key)) return false;
        if (it.key === "call") return it.mention && !low.includes(it.mention.toLowerCase());
        const m = mentionOf(it); return !(m && low.includes(m.toLowerCase()));
      }).map(it => ({ icon: it.icon, label: it.label, item: it }));
    }
    function drawGaps() {
      blocks.filter(b => b.type === "longtext" && hasGuide(b)).forEach(b => {
        const box = q(`[data-ggaps="${CSS.escape(b.id)}"]`); if (!box) return;
        const gaps = narrativeGaps(b); box._gaps = gaps;
        const html = gaps.length ? `<span class="ng-gl">📋 From your report, not in the narrative yet:</span>${gaps.map((g, i) => `<button type="button" class="ng-gap" data-gap="${i}" data-for="${esc(b.id)}" title="Adds to the right paragraph: ${esc(g.item.text)}">${g.icon} ${esc(g.label)}<em>＋</em></button>`).join("")}` : "";
        if (box.dataset.ck !== html) { box.dataset.ck = html; box.innerHTML = html; box.hidden = !gaps.length; }
      });
    }

    const linkColOf = b => (b.columns || []).find(x => x.type === "link");
    const suspectFirst = b => !!(browseCol(b) && linkColOf(b));          // charges list: no blank rows, start from a suspect
    // "Add charges for:  [John Doe · 2]  [Jane Roe]" — one button per suspect listed in Involved Persons
    function drawWhoBars() {
      repeaters.filter(suspectFirst).forEach(b => {
        const bar = q(`[data-whobar="${CSS.escape(b.id)}"]`); if (!bar) return;
        const lc = linkColOf(b), who = linkChoices(lc), noun = (lc.filterValue || lc.label || "suspect").toLowerCase();
        const counts = {}; qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).forEach(tr => { const el = tr.querySelector(`[data-k="${CSS.escape(lc.id)}"]`); const v = el ? el.value : ""; if (v) counts[v] = (counts[v] || 0) + 1; });
        const key = JSON.stringify([who, counts]); if (bar.dataset.ck === key) return; bar.dataset.ck = key;
        bar.innerHTML = who.length
          ? `<span class="wb-l">${browseCol(b) && isChargeList(browseCol(b)) ? "⚖️ Add charges for" : "Add for"}</span>${who.map(w => `<button type="button" class="wb-who" data-browse="${esc(b.id)}" data-who="${esc(w)}"><span class="wb-av">${esc((w.match(/\b\w/g) || ["?"]).slice(0, 2).join("").toUpperCase())}</span>${esc(w)}${counts[w] ? `<i>${counts[w]}</i>` : ""}</button>`).join("")}`
          : `<span class="wb-none">Add a ${esc(noun)} in ${esc(((blocks.find(x => x.id === lc.source) || {}).title || "the persons list").replace(/\b\w+/g, w => w[0] + w.slice(1).toLowerCase()))} first, then tap their name here to charge them.</span>`;
      });
    }
    // one header per suspect with their charges bracketed underneath (rows stay real rows, so saving works as before)
    let RID = 0;
    const whoOf = (b, tr) => { const el = tr.querySelector(`[data-k="${CSS.escape(linkColOf(b).id)}"]`); return el ? el.value : ""; };
    const rowsFor = (b, w) => qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).filter(tr => whoOf(b, tr) === w);
    function groupRows(b) {
      const anchor = q(`[data-anchor="${CSS.escape(b.id)}"]`); if (!anchor) return;
      const lc = linkColOf(b), c = browseCol(b), rows = qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`);
      rows.forEach(tr => { if (!tr.dataset.rid) tr.dataset.rid = String(++RID); tr.classList.add("sf"); });
      const order = linkChoices(lc), names = [...new Set(order.filter(n => rows.some(r => whoOf(b, r) === n)).concat(rows.map(r => whoOf(b, r))))];
      const groups = names.map(n => ({ n: n, rows: rows.filter(r => whoOf(b, r) === n) }));
      const key = JSON.stringify(groups.map(g => [g.n, g.rows.map(r => r.dataset.rid)]));
      const sheet = anchor.tagName === "TR";
      if (anchor.dataset.gk !== key) {
        anchor.dataset.gk = key;
        qa(`[data-sg="${CSS.escape(b.id)}"]`).forEach(x => x.remove());
        groups.forEach(g => {
          const head = document.createElement(sheet ? "tr" : "div");
          head.className = "sg-head"; head.dataset.sg = b.id; head.dataset.who = g.n;
          const inner = `<div class="sg-br"><span class="sg-l"></span><button type="button" class="sg-name" data-browse="${esc(b.id)}" data-who="${esc(g.n)}" title="Edit ${esc(g.n || "these")}'s charges"><span class="sg-av">${esc(((g.n || "?").match(/\b\w/g) || ["?"]).slice(0, 2).join("").toUpperCase())}</span><b>${esc(g.n || "No suspect picked")}</b><em>✎ Edit</em></button><span class="sg-l"></span></div><div class="sg-meta"></div>`;
          head.innerHTML = sheet ? `<td colspan="4">${inner}</td>` : inner;
          anchor.before(head);
          g.rows.forEach((r, i) => { r.classList.toggle("sg-first", i === 0); r.classList.toggle("sg-last", i === g.rows.length - 1); anchor.before(r); });
        });
      }
      // live totals in each header
      groups.forEach(g => {
        const head = q(`[data-sg="${CSS.escape(b.id)}"][data-who="${CSS.escape(g.n)}"]`); if (!head) return;
        let mo = 0, fine = 0, n = 0;
        g.rows.forEach(r => { const cv = (r.querySelector(`[data-k="${CSS.escape(c.id)}"]`) || {}).value || "", cnt = countOf(b, r); if (!cv.trim()) return; n += cnt; const x = sentence(cv, cnt); mo += x.months; fine += x.fine; });
        const meta = head.querySelector(".sg-meta");
        const html = `<span><b>${n}</b> charge${n === 1 ? "" : "s"}</span>${mo || fine ? `<span><b>${mo}</b> months</span><span><b>$${fine.toLocaleString("en-US")}</b> fine</span>` : ""}`;
        if (meta.innerHTML !== html) meta.innerHTML = html;
      });
      const sr = b.totals && b.totals.on && q(`[data-sum="${CSS.escape(b.id)}"]`);
      if (sr && groups.length < 2) sr.style.display = "none";          // one suspect: their header already shows the total
    }
    // ---- evidence / vehicles: same look as charges — one bracketed header per person, their items underneath ----
    const tagKey = tr => { const h = tr.querySelector('[data-k="_tags"]'); return tagList(h && h.value).join("; "); };
    const itemNoun = b => /vehicle/i.test(b.title || b.id) ? ["vehicle", "vehicles", "🚗"] : /evidence/i.test(b.title || b.id) ? ["item", "items", "🧪"] : ["entry", "entries", "📄"];
    function setupTagBars() {
      repeaters.filter(tagSrc).forEach(b => {
        const add = q(`[data-add="${CSS.escape(b.id)}"]`); if (!add || q(`[data-tagbar="${CSS.escape(b.id)}"]`)) return;
        const bar = document.createElement("div"); bar.className = "whobar" + (add.classList.contains("hud-add") ? " hud-whobar" : ""); bar.dataset.tagbar = b.id;
        add.before(bar); add.hidden = true;
      });
    }
    function drawTagBars() {
      repeaters.filter(tagSrc).forEach(b => {
        const bar = q(`[data-tagbar="${CSS.escape(b.id)}"]`); if (!bar) return;
        const people = tagPeople(b), counts = {}, nn = itemNoun(b);
        qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).forEach(tr => tagList((tr.querySelector('[data-k="_tags"]') || {}).value).forEach(n => counts[n] = (counts[n] || 0) + 1));
        const key = JSON.stringify([people, counts]); if (bar.dataset.ck === key) return; bar.dataset.ck = key;
        const what = /vehicle/i.test(b.title || b.id) ? "a vehicle" : /evidence/i.test(b.title || b.id) ? "evidence" : "an entry";
        bar.innerHTML = `<span class="wb-l">${nn[2]} Add ${what} for</span>` + people.map(p => `<button type="button" class="wb-who ${roleCls(p.role)}" data-addfor="${esc(b.id)}" data-who="${esc(p.name)}" title="${esc(p.role || "")}"><span class="wb-av">${esc(initials(p.name))}</span>${esc(p.name)}${counts[p.name] ? `<i>${counts[p.name]}</i>` : ""}</button>`).join("")
          + `<button type="button" class="wb-who wb-free" data-addfor="${esc(b.id)}" data-who=""><span class="wb-av">＋</span>Not linked to anyone</button>`;
      });
    }
    function groupTagRows(b) {
      const anchor = q(`[data-anchor="${CSS.escape(b.id)}"]`); if (!anchor) return;
      const rows = qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`), people = tagPeople(b).map(p => p.name), nn = itemNoun(b);
      rows.forEach(tr => { if (!tr.dataset.rid) tr.dataset.rid = String(++RID); tr.classList.add("tg"); });
      const keys = [...new Set(rows.map(tagKey))];
      const rank = k => { if (!k) return 1e6; const i = people.indexOf(tagList(k)[0]); return i === -1 ? 1e5 : i * 10 + tagList(k).length; };
      keys.sort((a, c) => rank(a) - rank(c));
      const groups = keys.map(k => ({ k: k, rows: rows.filter(r => tagKey(r) === k) }));
      const key = JSON.stringify(groups.map(g => [g.k, g.rows.map(r => r.dataset.rid)]));
      const sheet = anchor.tagName === "TR";
      if (anchor.dataset.gk !== key) {
        anchor.dataset.gk = key;
        qa(`[data-sg="${CSS.escape(b.id)}"]`).forEach(x => x.remove());
        groups.forEach(g => {
          const names = tagList(g.k), head = document.createElement(sheet ? "tr" : "div");
          head.className = "sg-head" + (names.length ? "" : " sg-free"); head.dataset.sg = b.id; head.dataset.who = g.k;
          const av = names.length ? names.map(n => `<span class="sg-av">${esc(initials(n))}</span>`).join("") : `<span class="sg-av">?</span>`;
          const inner = `<div class="sg-br"><span class="sg-l"></span><button type="button" class="sg-name" data-addfor="${esc(b.id)}" data-who="${esc(g.k)}" title="Add another ${esc(nn[0])} for ${esc(names.length ? nice(names) : "no one")}">${av}<b>${esc(names.length ? nice(names) : "Not linked to anyone")}</b><em>＋ Add</em></button><span class="sg-l"></span></div><div class="sg-meta"></div>`;
          head.innerHTML = sheet ? `<td colspan="4">${inner}</td>` : inner;
          anchor.before(head);
          g.rows.forEach((r, i) => { r.classList.toggle("sg-first", i === 0); r.classList.toggle("sg-last", i === g.rows.length - 1); anchor.before(r); });
        });
      }
      groups.forEach(g => {
        const head = q(`[data-sg="${CSS.escape(b.id)}"][data-who="${CSS.escape(g.k)}"]`); if (!head) return;
        const done = b.check && b.check.id ? g.rows.filter(r => { const c = r.querySelector(`[data-k="${CSS.escape(b.check.id)}"]`); return c && c.checked; }).length : null;
        const roles = tagList(g.k).map(n => (tagPeople(b).find(p => p.name === n) || {}).role).filter(Boolean);
        const html = `<span><b>${g.rows.length}</b> ${g.rows.length === 1 ? nn[0] : nn[1]}</span>${done != null ? `<span><b>${done}</b> ${esc(String(b.check.label || "").toLowerCase())}</span>` : ""}${roles.length ? `<span>${esc([...new Set(roles)].join(" · "))}</span>` : ""}`;
        const meta = head.querySelector(".sg-meta"); if (meta.innerHTML !== html) meta.innerHTML = html;
      });
    }
    function countOf(b, tr) {
      const cc = (b.columns || []).find(x => x.id === (b.totals && b.totals.countCol)) || (b.columns || []).find(x => /count|qty|quantity/i.test(x.id + " " + x.label));
      const el = cc && tr.querySelector(`[data-k="${CSS.escape(cc.id)}"]`);
      return Math.max(1, parseInt(el && el.value, 10) || 1);
    }
    function openBrowser(b, preWho) {
      const c = browseCol(b); if (!c) return;
      const linkC = linkColOf(b);
      const countC = (b.columns || []).find(x => x.id === (b.totals && b.totals.countCol)) || (b.columns || []).find(x => x !== c && x !== linkC && /count|qty|quantity/i.test(x.id + " " + x.label));
      const charges = isChargeList(c), groups = chargeGroups(c.options), picked = new Map();
      const who = linkC ? linkChoices(linkC) : [];
      if (preWho && who.indexOf(preWho) === -1) who.unshift(preWho);
      const slip = charges && window.CHG_SLIP !== false;   // live booking slip beside the bubbles (on for charge lists)
      const style = (window.CHG_STYLE || "pills");   // "pills" (bubbles, the default) or "tiles" (squares)
      let active = 0;                                   // the category being shown
      const ov = document.createElement("div");
      ov.className = "chg-ov";
      ov.innerHTML = `<div class="chg-modal" role="dialog" aria-modal="true" aria-label="${esc(charges ? "Add charges" : "Add from list")}">
        <header class="chg-head"><div><b>${charges ? "⚖️ Add charges" : "☰ " + esc(c.label || "Add from list")}</b><small>${charges ? "Tap every charge for this " + esc((linkC && linkC.filterValue || "suspect").toLowerCase()) + ", set counts, then add them all at once." : "Tap everything you need, then add them all at once."}</small></div>
          ${linkC && who.length ? `<div class="chg-who"><label>${esc(linkC.label || "Suspect")}</label><select class="chg-sel">${who.map(w => `<option${w === preWho ? " selected" : ""}>${esc(w)}</option>`).join("")}</select></div>` : ""}
          <button type="button" class="chg-x" aria-label="Close">✕</button></header>
        <div class="chg-body"><nav class="chg-nav"><div class="chg-search"><input type="search" placeholder="${charges ? "Search all charges…" : "Search…"}" autocomplete="off"></div>
          <button type="button" class="chg-picked" data-g="picked"><span>✅</span><em>Selected</em><i>0</i></button>
          ${groups.map((g, i) => `<button type="button" data-g="${i}"><span>${g.icon}</span><em>${esc(g.name)}</em><i>${g.items.length}</i></button>`).join("")}</nav>
          <div class="chg-list"></div>${slip ? `<aside class="chg-slip"><div class="sl-paper"><div class="sl-head"><b>LOS SANTOS POLICE DEPARTMENT</b><span>BOOKING SLIP</span></div>
            <div class="sl-meta"><div><small>${esc((linkC && linkC.label) || "Suspect").toUpperCase()}</small><b class="sl-who">—</b></div><div><small>DATE</small><b>${esc(new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" }))}</b></div></div>
            <div class="sl-lines"></div><div class="sl-tot"></div></div><button type="button" class="sl-toggle"></button></aside>` : ""}</div>
        <footer class="chg-foot"><div class="chg-sum">Nothing selected</div><button type="button" class="chg-clear">Clear</button><button type="button" class="chg-go" disabled>Add</button></footer></div>`;
      document.body.appendChild(ov);
      document.documentElement.classList.add("chg-lock");
      const $ = sel => ov.querySelector(sel), list = $(".chg-list"), search = $(".chg-search input");
      const badge = o => { const m = CLASS_RE.exec(o); return m ? m[2][0].toUpperCase() : ""; };
      const nameOf = o => { const m = CLASS_RE.exec(o); return m ? m[1] : o; };
      const sub = o => { if (!charges) return ""; const x = sentence(o, 1); return [x.months ? x.months + " mo" : "", x.fine ? "$" + x.fine.toLocaleString("en-US") : ""].filter(Boolean).join(" · "); };
      const CLS = { F: "Felony", M: "Misdemeanor", I: "Infraction" };
      const tile = o => { const on = picked.has(o), k = badge(o);
        return `<div class="chg-tile c-${k || "x"}${on ? " on" : ""}" data-o="${esc(o)}" role="button" tabindex="0" aria-pressed="${on}">
          ${style === "tiles" ? `<div class="ct-top">${k ? `<span class="chg-cls c-${k}">${CLS[k]}</span>` : "<span></span>"}<span class="ct-ck"></span></div>` : `<span class="ct-ck"></span>`}
          <b>${esc(nameOf(o))}</b>${sub(o) ? `<small>${esc(sub(o))}</small>` : ""}${style !== "tiles" && k ? `<span class="ct-dot c-${k}" title="${CLS[k]}"></span>` : ""}
          ${countC && on ? `<span class="chg-cnt"><button type="button" data-d="-1" aria-label="Fewer">−</button><input type="text" inputmode="numeric" value="${picked.get(o) || 1}" aria-label="Counts"><button type="button" data-d="1" aria-label="More">+</button></span>` : ""}</div>`; };
      function draw() {
        const qv = search.value.trim().toLowerCase(), toks = qv.split(/\s+/).filter(Boolean);
        const match = o => toks.every(t => o.toLowerCase().indexOf(t) !== -1);
        const grid = its => `<div class="chg-grid ${style}">${its.map(tile).join("")}</div>`;
        let html = "";
        if (toks.length) {                                   // searching: results from every category
          groups.forEach(g => { const its = g.items.filter(match); if (its.length) html += `<h4><span>${g.icon}</span>${esc(g.name)}<i>${its.length}</i></h4>${grid(its)}`; });
          if (!html) html = `<div class="chg-empty">No ${charges ? "charges" : "matches"} match “${esc(search.value)}”.</div>`;
        } else if (active === "picked") {
          const its = [...picked.keys()];
          html = its.length ? `<h4><span>✅</span>Selected<i>${its.length}</i></h4>${grid(its)}` : `<div class="chg-empty">Nothing selected yet. Pick a category on the left and tap the charges.</div>`;
        } else {
          const g = groups[active];
          html = `<h4><span>${g.icon}</span>${esc(g.name)}<i>${g.items.length}</i></h4>${grid(g.items)}`;
        }
        list.innerHTML = html;
        ov.querySelectorAll(".chg-nav button[data-g]").forEach(bt => bt.classList.toggle("act", !toks.length && String(active) === bt.dataset.g));
        marks();
      }
      function marks() {
        ov.querySelectorAll(".chg-nav button[data-g]").forEach(bt => { if (bt.dataset.g === "picked") return; const n = groups[+bt.dataset.g].items.filter(o => picked.has(o)).length; bt.classList.toggle("has", n > 0); bt.querySelector("i").textContent = n ? n + " ✓" : groups[+bt.dataset.g].items.length; });
        $(".chg-picked i").textContent = picked.size; $(".chg-picked").classList.toggle("has", picked.size > 0);
      }
      function sum() {
        const n = picked.size; let mo = 0, fine = 0;
        picked.forEach((cnt, o) => { const x = sentence(o, cnt); mo += x.months; fine += x.fine; });
        $(".chg-sum").innerHTML = n ? `<b>${n}</b> selected${charges && (mo || fine) ? ` · <b>${mo}</b> months · <b>$${fine.toLocaleString("en-US")}</b>` : ""}` : "Nothing selected";
        const sel = $(".chg-sel"), go = $(".chg-go");
        const had = linkC && sel ? rowsFor(b, sel.value).length : 0;
        go.disabled = !n && !had;
        go.textContent = had ? (n ? `Save ${n} ${charges ? (n === 1 ? "charge" : "charges") : (n === 1 ? "item" : "items")} for ${sel.value}` : `Remove all charges from ${sel.value}`)
          : n ? `Add ${n} ${charges ? (n === 1 ? "charge" : "charges") : (n === 1 ? "item" : "items")}${sel && sel.value ? " to " + sel.value : ""}` : "Add";
        marks(); drawSlip();
      }
      // the booking slip: every picked charge with its count, then the running sentence
      function drawSlip() {
        if (!slip) return;
        const sel = $(".chg-sel"), lines = [...picked.entries()];
        $(".sl-who").textContent = sel && sel.value ? sel.value : "—";
        $(".chg-slip").classList.toggle("empty", !lines.length);
        let mo = 0, fine = 0; const cls = { F: 0, M: 0, I: 0 };
        $(".sl-lines").innerHTML = lines.length ? lines.map(([o, cnt]) => {
          const x = sentence(o, cnt), k = badge(o); mo += x.months; fine += x.fine; if (k) cls[k] += cnt;
          return `<div class="sl-line" data-o="${esc(o)}"><span class="sl-n">${cnt}×</span><span class="sl-c"><b>${esc(nameOf(o))}</b><small>${k ? `<i class="ct-dot c-${k}"></i>${CLS[k]}` : ""}${x.months ? " · " + x.months + " mo" : ""}${x.fine ? " · $" + x.fine.toLocaleString("en-US") : ""}</small></span><button type="button" class="sl-x" title="Remove">✕</button></div>`;
        }).join("") : `<div class="sl-empty">Tap charges to add them to the slip.</div>`;
        $(".sl-tot").innerHTML = lines.length ? `<div class="sl-row"><span>Felonies</span><b>${cls.F}</b></div><div class="sl-row"><span>Misdemeanors</span><b>${cls.M}</b></div><div class="sl-row"><span>Infractions</span><b>${cls.I}</b></div>
          <div class="sl-big"><div><small>TOTAL TIME</small><b>${mo} <em>months</em></b></div><div><small>TOTAL FINE</small><b>$${fine.toLocaleString("en-US")}</b></div></div>` : "";
        $(".chg-slip").style.setProperty("--slip-bottom", $(".chg-foot").offsetHeight + "px");
        $(".sl-toggle").innerHTML = lines.length ? `🧾 Booking slip · <b>${lines.length}</b> charge${lines.length === 1 ? "" : "s"} · <b>${mo}</b> mo · <b>$${fine.toLocaleString("en-US")}</b><span>▴</span>` : "🧾 Booking slip · empty";
      }
      function toggle(o) { if (picked.has(o)) picked.delete(o); else picked.set(o, 1); const sc = list.scrollTop; draw(); list.scrollTop = sc; sum(); }
      function close() { ov.remove(); document.documentElement.classList.remove("chg-lock"); document.removeEventListener("keydown", onKey, true); }
      function onKey(e) { if (e.key === "Escape") { e.preventDefault(); close(); } }
      document.addEventListener("keydown", onKey, true);
      ov.addEventListener("mousedown", e => { if (e.target === ov) close(); });
      $(".chg-x").onclick = close;
      search.addEventListener("input", draw);
      ov.querySelector(".chg-nav").addEventListener("click", e => {
        const bt = e.target.closest("button[data-g]"); if (!bt) return;
        active = bt.dataset.g === "picked" ? "picked" : +bt.dataset.g; search.value = ""; list.scrollTop = 0; draw();
      });
      list.addEventListener("click", e => {
        const t = e.target.closest(".chg-tile"); if (!t) return;
        const o = t.dataset.o, d = e.target.closest("button[data-d]");
        if (d) { const inp = t.querySelector(".chg-cnt input"); const v = Math.max(1, Math.min(99, (parseInt(inp.value, 10) || 1) + +d.dataset.d)); inp.value = v; picked.set(o, v); sum(); return; }
        if (e.target.closest(".chg-cnt")) return;
        toggle(o);
      });
      list.addEventListener("keydown", e => { const t = e.target.closest(".chg-tile"); if (t && e.target === t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggle(t.dataset.o); } });
      list.addEventListener("input", e => { const t = e.target.closest(".chg-tile"); if (!t || !e.target.closest(".chg-cnt")) return; picked.set(t.dataset.o, Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1))); sum(); });
      $(".chg-clear").onclick = () => { picked.clear(); draw(); sum(); };
      if (slip) {
        $(".chg-slip").addEventListener("click", e => {
          if (e.target.closest(".sl-toggle")) { $(".chg-slip").classList.toggle("open"); return; }
          const x = e.target.closest(".sl-x"); if (!x) return;
          picked.delete(x.closest(".sl-line").dataset.o); const sc = list.scrollTop; draw(); list.scrollTop = sc; sum();
        });
        $(".chg-modal").classList.add("has-slip");
      }
      $(".chg-go").onclick = () => {
        const sel = $(".chg-sel"), suspect = sel ? sel.value : "";
        qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).forEach(tr => { const el = tr.querySelector(`[data-k="${CSS.escape(c.id)}"]`); if (el && !el.value.trim()) tr.remove(); });
        // this suspect's existing rows: keep (and update counts) what's still ticked, remove what was unticked
        const left = new Map(picked);
        (linkC ? rowsFor(b, suspect) : []).forEach(tr => {
          const v = (tr.querySelector(`[data-k="${CSS.escape(c.id)}"]`) || {}).value || "";
          if (!left.has(v)) { tr.remove(); return; }
          if (countC) { const el = tr.querySelector(`[data-k="${CSS.escape(countC.id)}"]`); if (el) el.value = String(left.get(v)); }
          left.delete(v);
        });
        left.forEach((cnt, o) => { const v = {}; v[c.id] = o; if (linkC) v[linkC.id] = suspect; if (countC) v[countC.id] = String(cnt); addRow(b, v); });
        fillLinks(b); refresh(); changed(); close();
        const head = suspect && q(`[data-sg="${CSS.escape(b.id)}"][data-who="${CSS.escape(suspect)}"]`);
        const to = head || qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).pop(); if (to && to.scrollIntoView) to.scrollIntoView({ behavior: "smooth", block: "center" });
      };
      // editing: a suspect's existing charges start ticked; switching suspect loads theirs
      const loadWho = w => {
        picked.clear();
        if (!linkC) return;
        rowsFor(b, w).forEach(tr => { const v = (tr.querySelector(`[data-k="${CSS.escape(c.id)}"]`) || {}).value || ""; if (v.trim()) picked.set(v, (picked.get(v) || 0) + countOf(b, tr)); });
      };
      const selEl = $(".chg-sel");
      loadWho(selEl ? selEl.value : preWho || "");
      if (selEl) selEl.onchange = () => { loadWho(selEl.value); draw(); sum(); };
      draw(); sum();
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
        if (c && c.type === "officer") {                     // a person from a roster tab, inside a list row: "L-801 | A. Ramirez (8010…)"
          return { items: rosterItems(null, c), noun: "on the roster", emptyText: "Not on the roster. What you typed will be kept.",
            onPick: it => { if (!it) return; el.value = it.label + (it.id ? " (" + it.id + ")" : ""); el.title = el.value; el.dispatchEvent(new Event("input", { bubbles: true })); pkClose(); } };
        }
        return { items: (c.options || []).filter(o => !isHeader(o)).map(chargeItem), noun: c.label ? "options" : "options", emptyText: "No match. Your text will be kept as typed.",
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
      drawWhoBars();
      drawTags();
      drawTagBars();
      blocks.filter(b => b.type === "longtext" && hasGuide(b)).forEach(b => { const sw = q(`[data-sync="${CSS.escape(b.id)}"]`); if (sw) sw.checked = !!narr(b.id).on; syncNarrative(b); });
      drawGaps();
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
          const rows = qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`), n = b.startRows ? rows.filter(tr => [...tr.querySelectorAll("[data-k]")].some(el => el.type === "checkbox" ? el.checked : el.value.trim())).length : rows.length;
          if (b.numbered) rows.forEach((tr, i) => { const r = tr.querySelector(".rnum"); if (r) r.textContent = String(i + 1).padStart(2, "0"); });
          q(`[data-rc="${CSS.escape(b.id)}"]`).textContent = n + (n === 1 ? " entry" : " entries");
          q(`[data-empty="${CSS.escape(b.id)}"]`).style.display = (b.startRows ? rows.length : n) ? "none" : "";
          if (suspectFirst(b)) groupRows(b);
          else if (tagSrc(b)) { groupTagRows(b); drawTags(); }
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
        const k = stepKind(st.label || ""), facts = k ? factItems().filter(it => k === "evidence" ? (it.kind === "evidence" || it.kind === "vehicles") : it.kind === k) : [];
        const n = narr(b.id), fresh = facts.filter(it => !n.items.some(x => x.key === it.key));
        if (fresh.length) fresh.forEach(it => addFact(b, it)); else insertText(q(`[data-f="${CSS.escape(b.id)}"]`), fillStarter(st.starter));
        step.classList.add("used"); return;
      }
      const addFor = t.closest("[data-addfor]");
      if (addFor) {
        const b = repeaters.find(x => x.id === addFor.dataset.addfor), tr = addRow(b, { _tags: addFor.dataset.who || "" });
        drawTags(); refresh(); changed();
        const f = tr.querySelector("input[type=text],select"); if (f) { f.focus(); if (tr.scrollIntoView) tr.scrollIntoView({ behavior: "smooth", block: "center" }); }
        return;
      }
      const tagB = t.closest("[data-tag]");
      if (tagB) { if (TAGPOP) closeTagPop(); else openTagPop(tagB); return; }
      const untag = t.closest("[data-untag]");
      if (untag) { const hid = untag.closest(".dyn").querySelector('[data-k="_tags"]'); hid.value = tagList(hid.value).filter(x => x !== untag.dataset.untag).join("; "); drawTags(); refresh(); changed(); return; }
      const gap = t.closest("[data-gap]");
      if (gap) { const box = gap.closest("[data-ggaps]"), g = box._gaps && box._gaps[+gap.dataset.gap]; if (g) addFact(blocks.find(x => x.id === gap.dataset.for), g.item); return; }
      const syncT = t.closest("[data-sync]");
      if (syncT) { const b = blocks.find(x => x.id === syncT.dataset.sync), n = narr(b.id); n.on = syncT.checked; saveNarr(b.id); syncNarrative(b); drawGaps(); return; }
      const draft = t.closest("[data-draft]");
      if (draft) {
        const b = blocks.find(x => x.id === draft.dataset.draft), ta = q(`[data-f="${CSS.escape(b.id)}"]`), n = narr(b.id);
        if (ta.value.trim() && !confirm("Replace what's in the narrative with a fresh draft from your report?\n\nCancel keeps your text and just adds anything from the report that's missing.")) {
          n.on = true; saveNarr(b.id); syncNarrative(b); drawGaps(); return;
        }
        const d = buildDraft(b);
        n.items = d.tracked.map(it => ({ key: it.key, kind: it.kind, text: it.text })); n.own = []; n.on = true; saveNarr(b.id);
        setNarrative(ta, d.text); ta.focus();
        const br = ta.value.indexOf("["), end = br > -1 ? ta.value.indexOf("]", br) : -1; if (br > -1 && end > br) ta.setSelectionRange(br, end + 1);
        const sw = q(`[data-sync="${CSS.escape(b.id)}"]`); if (sw) sw.checked = true;
        syncNarrative(b); drawGaps();
        return;
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
      const browse = t.closest("[data-browse]");
      if (browse) { openBrowser(repeaters.find(b => b.id === browse.dataset.browse), browse.dataset.who || ""); return; }
      const add = t.closest("[data-add]");
      if (add) {
        const tr = addRow(repeaters.find(b => b.id === add.dataset.add));
        (tr.querySelector("input[type=text]") || tr.querySelector("select")).focus();
        changed(); return;
      }
      const rm = t.closest(".rm");
      if (rm) { rm.closest(".dyn").remove(); fillRows(); refresh(); changed(); return; }
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
        }).filter(o => !b.startRows || Object.values(o).some(v => v));   // pre-filled blank rows aren't sent
      });
      return { form: form.id, values: values, checklists: checklists, repeaters: reps };
    }

    // lists with "startRows": show that many blank, numbered rows ready to fill in (like a paper sheet)
    function fillRows() {
      const phone = window.matchMedia && matchMedia("(max-width:760px)").matches;
      repeaters.forEach(b => { if (!b.startRows) return; const want = phone ? Math.min(b.startRows, 5) : b.startRows; let n = qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).length; while (n < want) { addRow(b); n++; } });
    }
    function load(d) {
      if (!d) return;
      Object.keys(d.values || {}).forEach(k => { const el = q(`[data-f="${CSS.escape(k)}"]`); if (el) el.value = d.values[k]; });
      Object.keys(d.checklists || {}).forEach(id => qa(`[data-chk="${CSS.escape(id)}"]`).forEach(x => x.checked = !!d.checklists[id][x.dataset.topic]));
      repeaters.forEach(b => { if (b.startRows) qa(`.dyn[data-rep="${CSS.escape(b.id)}"]`).forEach(tr => tr.remove()); ((d.repeaters || {})[b.id] || []).forEach(r => addRow(b, r)); });
      fillRows(); refresh();
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
      blocks.filter(b => b.type === "longtext").forEach(b => { NARR[b.id] = { on: false, items: [], own: [] }; saveNarr(b.id); });
      setDefaults(); fillRows(); refresh(); clearDraft();
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
        if (!isEmpty(collect())) { status("✓ Draft restored"); READY = true; refresh(); return d.t; }
      } catch (e) {}
      finally { READY = true; }
      return null;
    }

    setDefaults();
    fillRows();
    setupTagBars();
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
