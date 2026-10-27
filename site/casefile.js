/* Lays out a report as a printed case file (the same look as the CID case builder's plain-text file),
   from the form itself and the officer's answers, so every form and every field shows up, in order. */
window.CaseFile = (function () {
  "use strict";
  const T = s => String(s == null ? "" : s).trim();
  const N = (s, d) => T(s) || (d == null ? "N/A" : d);
  const noIds = s => T(s).split(";").map(x => x.replace(/\s*\(\d{15,21}\)\s*$/, "").trim()).filter(Boolean).join(", ");
  const CLASS_RE = /\((Felony|Misdemeanor|Infraction)[^)]*\)\s*$/i;
  const titleCase = t => T(t).replace(/:\s*$/, "").toLowerCase().replace(/(^|[\s/(&-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  const lbl = x => T(x && x.label).replace(/[:]\s*$/, "").replace(/\s*\(.*\)\s*$/, "") || (x && x.id) || "";
  const one = b => { const m = /^\s*\+?\s*add\s+(.+)$/i.exec(b.addLabel || ""); return m ? titleCase(m[1]) : titleCase(b.title || "Entry").replace(/s$/, ""); };
  const linked = s => T(s).split(";").map(x => x.trim()).filter(Boolean).join(", ");
  function cell(c, val) {
    if (c.type === "check" || c.type === "checkbox") return val === true || val === "TRUE" || val === "Yes" ? "Yes" : "No";
    if (c.type === "officer" || c.type === "officers" || c.type === "discord_id") return noIds(val);
    return T(val).replace(/\s*\(\d{15,21}\)/g, "");
  }
  const PEOPLE = /suspect|victim|witness|person|people|involved|trainee|student|cadet|recruit/i;
  const sentence = (text, n) => (window.Portal && Portal.sentence ? Portal.sentence(text, n) : { months: 0, fine: 0 });

  function sections(form, d) {
    const v = d.values || {}, R = d.repeaters || {}, S = [];
    let cur = null;
    const sec = h => { cur = { h: h, b: [] }; S.push(cur); return cur; };
    const fieldsBlock = rows => { if (!rows.length) return; if (!cur) sec("Report Information"); const last = cur.b[cur.b.length - 1]; if (last && last.k === "fields") last.rows.push(...rows); else cur.b.push({ k: "fields", rows: rows }); };
    const blocks = form.blocks || [], hasLead = blocks.some(b => (b.fields || []).some(f => f.id === "ccLead"));
    blocks.forEach(b => {
      if (b.type === "text" && b.style === "heading") { sec(titleCase(b.text)); return; }
      if (b.type === "fields" || b.type === "strip") {
        fieldsBlock((b.fields || []).filter(f => f.type !== "static").flatMap(f => {
          if (hasLead && (f.id === "ccRank" || f.id === "ccBadge")) return [];
          if (f.id === "ccLead") { const lead = [v.ccRank, cell(f, v.ccLead)].map(T).filter(Boolean).join(" "); return [["Lead Investigator", N(lead) + (T(v.ccBadge) ? " #" + T(v.ccBadge) : "")]]; }
          const val = cell(f, v[f.id]);
          return [[lbl(f), val || (f.type === "officers" ? "None" : "N/A")]];
        }));
        return;
      }
      if (b.type === "longtext") { const t = T(v[b.id]); if (t) sec(titleCase(b.title || b.id)).b.push(...t.split(/\n\s*\n/).map(p => ({ k: "p", text: p.trim() }))); cur = null; return; }
      if (b.type === "checklist") {
        const st = (d.checklists || {})[b.id];
        if (st && Object.values(st).some(Boolean)) sec(titleCase(b.title || "Checklist")).b.push({ k: "list", items: (b.items || []).map(it => (st[it.topic] ? "[x] " : "[ ] ") + it.topic) });
        else if (!st && T(v[b.id])) sec(titleCase(b.title || "Checklist")).b.push({ k: "list", items: T(v[b.id]).split(/\s*\|\s*/).filter(Boolean) });
        cur = null; return;
      }
      if (b.type !== "repeater") return;
      cur = null;
      const cols = (b.columns || []).concat(b.check ? [Object.assign({ type: "check" }, b.check)] : []), byId = id => cols.find(c => c.id === id);
      // answers saved before this layout existed: the list comes back as text, one entry per "; "
      if (!R[b.id] && T(v[b.id])) { sec(titleCase(b.title || b.id)).b.push({ k: "list", items: T(v[b.id]).split(/;\s(?=\S)/).map(x => x.replace(/\s*\(\d{15,21}\)/g, "")) }); return; }
      const rows = (R[b.id] || []).filter(r => cols.some(c => c.type !== "check" && T(r[c.id])));
      if (!rows.length) return;
      const s = sec(titleCase(b.title || b.id));
      const rest = (r, skip) => cols.filter(c => !skip.includes(c.id) && (c.type !== "check" || T(c.label))).map(c => [lbl(c), cell(c, r[c.id]), c.type]).filter(([, x, t]) => x || t === "check").map(([a, x]) => [a, x]);
      const chargeCol = byId("charge") || cols.find(c => c.type === "search" && /charge|penal/i.test(c.label || ""));
      if (chargeCol) {
        const sus = byId("suspect") || cols.find(c => c.type === "link"), cnt = byId("count") || cols.find(c => /count/i.test(c.label || ""));
        s.b.push({ k: "list", items: rows.filter(r => T(r[chargeCol.id])).map(r => {
          const ch = T(r[chargeCol.id]), n = Math.max(1, parseInt(cnt ? r[cnt.id] : 1, 10) || 1), x = sentence(ch, n), m = CLASS_RE.exec(ch), name = ch.replace(CLASS_RE, "").trim();
          const extra = [m ? m[1] : "", x.months ? x.months + " months" : "", x.fine ? "$" + x.fine.toLocaleString("en-US") : ""].filter(Boolean).join(" · ");
          return (sus ? N(r[sus.id], "Unassigned") + ": " : "") + name + " (x" + n + ")" + (extra ? " - " + extra : "") + (b.check && r[b.check.id] ? " · " + lbl(b.check).toLowerCase() : "");
        }) });
      } else if (byId("event") && cols.length <= 3) {
        s.b.push({ k: "list", items: rows.map(r => N(r.time, "--:--") + " — " + T(r.event)) });
      } else if (cols.filter(c => c.type !== "check").length <= 2 && !rows.some(r => T(r._tags))) {
        s.b.push({ k: "list", items: rows.map(r => cols.map(c => c.type === "check" ? (r[c.id] && T(c.label) ? "(" + lbl(c) + ")" : "") : cell(c, r[c.id])).filter(Boolean).join(" — ")) });
      } else {
        // people, evidence and any other list: one entry per row, its details lined up underneath
        const ev = byId("etag") && byId("type"), first = ev ? null : cols.find(c => c.type !== "check");
        rows.forEach((r, i) => {
          if (ev) s.b.push({ k: "sub", text: "[" + N(r.etag, "—") + "] " + N(r.type, "Evidence") });
          else s.b.push({ k: "sub", text: one(b) + " " + (i + 1) + ": " + N(cell(first, r[first.id]), PEOPLE.test(b.title || b.id) ? "Unidentified" : "—") });
          const f = rest(r, ev ? ["etag", "type"] : [first.id]);
          if (T(r._tags)) f.push(["Linked To", linked(r._tags)]);
          if (f.length) s.b.push({ k: "fields", rows: f });
        });
      }
    });
    return S.filter(x => x.b.length);
  }

  const W = 56, EQ = "=".repeat(W), DASH = "-".repeat(W), MAX = 78;
  // long values wrap under themselves, so the columns stay lined up
  function wrap(prefix, val, max) {
    const ind = " ".repeat(prefix.length), room = Math.max(24, (max || MAX) - prefix.length), out = [];
    String(val).split("\n").forEach((line, li) => {
      let cur = "";
      line.split(/\s+/).forEach(w => { if (cur && (cur + " " + w).length > room) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; });
      out.push(cur);
    });
    return out.map((l, i) => (i ? ind : prefix) + l);
  }
  const center = s => " ".repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s;
  // o: { dept, doc, number, filedBy, date }
  function text(form, data, o) {
    o = o || {};
    const S = sections(form, data || {}), out = [EQ, center(T(o.dept).toUpperCase()), center(T(o.doc || "OFFICIAL REPORT").toUpperCase())];
    if (T(o.number)) out.push(center(T(o.number)));
    out.push(EQ, "");
    S.forEach(s => {
      out.push("[ " + s.h.toUpperCase() + " ]", DASH);
      s.b.forEach(b => {
        if (b.k === "fields") { const w = Math.min(24, Math.max(...b.rows.map(([a]) => a.length))); b.rows.forEach(([a, c]) => out.push(...wrap((a + ":").padEnd(w + 2), c))); }
        else if (b.k === "p") out.push(...wrap("", b.text), "");
        else if (b.k === "sub") out.push("", ...wrap("> ", b.text));
        else b.items.forEach(i => out.push(...wrap("  • ", i)));
      });
      if (out[out.length - 1] !== "") out.push("");
    });
    return out.concat([DASH, "Filed by: " + N(o.filedBy, "________________"), "Date: " + N(o.date), EQ]).join("\n");
  }
  // re-wrap an already printed file (e.g. a CID case file) so long lines keep their columns
  function rewrap(t) {
    return String(t || "").split("\n").flatMap(line => {
      if (line.length <= MAX) return [line];
      let m = /^(\S[^:\n]{0,40}:\s{2,}|\S[^:\n]{0,40}:\s)(.*)$/.exec(line);
      if (m && m[1].length < 34) return wrap(m[1], m[2]);
      m = /^(\s*(?:•|-|\*|>)\s+)(.*)$/.exec(line); if (m) return wrap(m[1], m[2]);
      return wrap("", line);
    }).join("\n");
  }
  return { text: text, sections: sections, rewrap: rewrap };
})();
