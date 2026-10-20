/* =====================================================================
   LSPD Portal - shared form renderer (used by index.html and admin.html)
   Draws any form definition from the admin portal in the Excel-sheet style.
   ===================================================================== */
window.Portal = (function () {
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
          <tr class="addrow"><td colspan="4"><button type="button" class="mini" data-add="${esc(b.id)}">${esc(b.addLabel || "+ Add Row")}</button></td></tr>`;
      }
      case "longtext":
        return `<tr class="gap3"><td colspan="4"></td></tr>
          <tr class="modhead"><td colspan="4">${esc(b.title)}${req(b)}</td></tr>` +
          (b.hint ? `<tr class="notehint"><td colspan="4">${esc(b.hint)}</td></tr>` : "") +
          `<tr class="txrow"><td colspan="4"><textarea class="g ${(b.maxLength || 1000) <= 1500 ? "short" : ""}" data-f="${esc(b.id)}" maxlength="${b.maxLength || 1000}"></textarea></td></tr>
          <tr class="cnt"><td colspan="4" data-count="${esc(b.id)}">0 / ${b.maxLength || 1000}</td></tr>`;
    }
    return "";
  }

  /**
   * Render a form definition into `mount`. Returns a controller.
   * opts: { draft: true|false, onStatus(msg) }
   */
  function render(form, mount, opts) {
    opts = opts || {};
    const blocks = form.blocks || [];
    const theme = form.theme === "dossier" ? "theme-dossier" : "theme-sheet";
    const wm = watermarkCSS(form);
    const wmOpacity = Math.min(Math.max(Number(form.watermarkOpacity) || (theme === "theme-dossier" ? 8 : 6), 2), 30) / 100;
    mount.innerHTML = `<div class="paper-wrap ${theme}"><div class="paper ${theme}">${wm ? `<div class="wm" style="background-image:${wm};opacity:${wmOpacity}"></div>` : ""}<table class="xl">
      <colgroup><col style="width:26.6%"><col style="width:35%"><col style="width:21.1%"><col style="width:17.3%"></colgroup>
      <tbody>${blocks.map(b => blockHTML(b, form)).join("")}</tbody></table></div></div>`;
    const root = mount.querySelector("table");
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
      const tr = document.createElement("tr");
      tr.className = "dyn"; tr.dataset.rep = b.id;
      tr.innerHTML = cols.map((c, i) => c.type === "select"
          ? `<td colspan="${sp[i]}"><select class="g c" data-k="${esc(c.id)}">${(c.options || []).map(o => `<option>${esc(o)}</option>`).join("")}</select></td>`
          : `<td colspan="${sp[i]}"><input class="g" type="text" maxlength="200" data-k="${esc(c.id)}" placeholder="${esc(c.placeholder || "")}"></td>`).join("") +
        `<td class="act"><div class="actcell">${b.check && b.check.id ? `<label class="xck"><input type="checkbox" data-k="${esc(b.check.id)}"><span class="bx">${CHECK_SVG}</span></label>` : "<span></span>"}<button type="button" class="rm" title="Remove row">✕</button></div></td>`;
      if (vals) tr.querySelectorAll("[data-k]").forEach(el => {
        const v = vals[el.dataset.k];
        if (el.type === "checkbox") el.checked = !!v; else if (v != null) el.value = v;
      });
      q(`[data-anchor="${CSS.escape(b.id)}"]`).before(tr);
      refresh();
      return tr;
    }

    function refresh() {
      blocks.forEach(b => {
        if (b.type === "checklist") {
          const boxes = qa(`[data-chk="${CSS.escape(b.id)}"]`);
          boxes.forEach(x => x.closest("tr").classList.toggle("done", x.checked));
          const cc = q(`[data-cc="${CSS.escape(b.id)}"]`);
          if (cc) cc.textContent = boxes.filter(x => x.checked).length + " / " + boxes.length;
        }
        if (b.type === "repeater") {
          const n = qa(`tr.dyn[data-rep="${CSS.escape(b.id)}"]`).length;
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
    root.addEventListener("click", e => {
      const t = e.target;
      const add = t.closest("[data-add]");
      if (add) {
        const tr = addRow(repeaters.find(b => b.id === add.dataset.add));
        (tr.querySelector("input[type=text]") || tr.querySelector("select")).focus();
        changed(); return;
      }
      const rm = t.closest(".rm");
      if (rm) { rm.closest("tr").remove(); refresh(); changed(); return; }
      const today = t.closest("[data-today]");
      if (today) { q(`[data-f="${CSS.escape(today.dataset.today)}"]`).value = todayISO(); changed(); return; }
      const gen = t.closest("[data-gen]");
      if (gen) { const el = q(`[data-f="${CSS.escape(gen.dataset.gen)}"]`); el.value = caseNumber(gen.dataset.prefix); el.classList.remove("err"); changed(); return; }
      const td = t.closest("td.ck");
      if (td && !t.closest("label")) td.querySelector("input").click();
    });
    root.addEventListener("input", () => { refresh(); changed(); });
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
        reps[b.id] = qa(`tr.dyn[data-rep="${CSS.escape(b.id)}"]`).map(tr => {
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
      qa("tr.dyn").forEach(tr => tr.remove());
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

  return { ENDPOINT, render, post, loadConfig, esc, todayISO };
})();
