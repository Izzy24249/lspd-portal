/* =====================================================================
   LSPD Portal - shared form renderer (used by index.html and admin.html)
   Draws any form definition from the admin portal in the Excel-sheet style.
   ===================================================================== */
window.Portal = (function () {
  // The WebApp.gs version this website expects (admin.html warns when Google is running an older one).
  const BACKEND_NEEDS = 8;
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
        return `<select class="g${c}" data-f="${esc(f.id)}"><option value=""></option>${(f.options || []).map(o => `<option>${esc(o)}</option>`).join("")}</select>`;
      case "date":
        return `<input class="g c" type="date" data-f="${esc(f.id)}"><button type="button" data-today="${esc(f.id)}" title="Stamp today's date">Today</button>`;
      case "case_number":
        return `<div class="with-gen"><input class="g${c}" type="text" maxlength="60" data-f="${esc(f.id)}"${ph}><button type="button" class="mini" data-gen="${esc(f.id)}" data-prefix="${esc(f.prefix || "")}">Generate</button></div>`;
      case "static":
        return esc(f.text || "");
      case "discord_id":
      case "number":
        return `<input class="g${c}" type="text" inputmode="numeric" maxlength="${f.type === "discord_id" ? 21 : 30}" data-f="${esc(f.id)}"${ph}>`;
      default:
        return `<input class="g${c}" type="text" maxlength="200" data-f="${esc(f.id)}"${ph}>`;
    }
  }
  const req = f => f.required ? ' <i class="req">*</i>' : "";

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
          ? `<td class="lbl">${esc(fs[0].label)}${req(fs[0])}</td><td colspan="3" class="${fs[0].type === "date" ? "datecell" : ""}">${inputHTML(fs[0])}</td>`
          : fs.map(f => `<td class="lbl">${esc(f.label)}${req(f)}</td><td class="${f.type === "date" ? "datecell" : ""}">${inputHTML(f)}</td>`).join("");
        return `<tr class="inrow">${cells}</tr><tr class="gap2"><td colspan="4"></td></tr>`;
      }
      case "strip": {
        const fs = b.fields || [], sp = spans(fs.length);
        return `<tr class="gap3"><td colspan="4"></td></tr>` +
          `<tr class="hdr1">${fs.map((f, i) => `<td colspan="${sp[i]}">${esc(f.label)}${req(f)}</td>`).join("")}</tr>` +
          `<tr class="sess">${fs.map((f, i) => `<td colspan="${sp[i]}" class="${f.type === "date" ? "datecell" : f.type === "static" ? "c static" : ""}">${inputHTML(f, true)}</td>`).join("")}</tr>` +
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
  function hudBlockHTML(b, form) {
    switch (b.type) {
      case "banner":
        return `<div class="hud-hero">
          ${form && okImg(form.logoUrl) ? `<div class="hud-emblem"><span class="ring"></span><span class="ring r2"></span><img src="${esc(form.logoUrl)}" alt=""></div>` : ""}
          <div class="hud-htext"><div class="hud-kicker">LSPD · SECURE REPORT TERMINAL</div><h2>${esc(b.title)}</h2>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ""}</div>
          <div class="hud-status"><span class="pulse"></span>LINK SECURE</div>
        </div>`;
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
    const hud = form.theme === "hud";
    const theme = hud ? "theme-hud" : form.theme === "dossier" ? "theme-dossier" : "theme-sheet";
    const wm = watermarkCSS(form);
    const wmOpacity = Math.min(Math.max(Number(form.watermarkOpacity) || (theme === "theme-sheet" ? 6 : 8), 2), 30) / 100;
    const wmHTML = wm ? `<div class="wm ${form.watermarkMode === "repeat" ? "" : "single"}" style="background-image:${wm};opacity:${wmOpacity}"></div>` : "";
    mount.innerHTML = hud
      ? `<div class="paper-wrap theme-hud"><div class="paper hud">${wmHTML}<div class="hud-grid-bg"></div><div class="hud-scan"></div>
          ${blocks.map((b, i) => `<div class="hud-b k-${esc(b.type)}" data-b="${i}">${hudBlockHTML(b, form)}</div>`).join("")}${searchLists(form)}</div></div>`
      : `<div class="paper-wrap ${theme}"><div class="paper ${theme}">${wmHTML}<table class="xl">
      <colgroup><col style="width:26.6%"><col style="width:35%"><col style="width:21.1%"><col style="width:17.3%"></colgroup>
      ${blocks.map((b, i) => `<tbody data-b="${i}">${blockHTML(b, form)}</tbody>`).join("")}</table>${searchLists(form)}</div></div>`;
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
    }

    function addRow(b, vals) {
      const cols = (b.columns || []).slice(0, 3), sp = cols.length === 3 ? [1, 1, 1] : cols.length === 2 ? [1, 2] : [3];
      const ctl = c => c.type === "link"
          ? `<select class="g c" data-k="${esc(c.id)}" data-link="1"></select>`
          : c.type === "select"
          ? `<select class="g c" data-k="${esc(c.id)}">${(c.options || []).map(o => `<option>${esc(o)}</option>`).join("")}</select>`
          : `<input class="g" type="text" maxlength="200" data-k="${esc(c.id)}" placeholder="${esc(c.placeholder || "")}"${c.type === "search" ? ` list="${esc(listId(b, c))}" autocomplete="off"` : ""}>`;
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

    function refresh() {
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
    const res = await fetch(ENDPOINT + "?action=config&t=" + Date.now());
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Could not load forms");
    if (!data.config) throw new Error("The Apps Script backend is out of date: paste the new WebApp.gs and deploy a new version.");
    return data.config;
  }

  return { ENDPOINT, BACKEND_NEEDS, DEFAULT_GUIDES, withDefaults, render, post, loadConfig, esc, todayISO, sentence };
})();
