#!/usr/bin/env node
/* Lint what a frame SHOWS, not what the source says.
 *
 *   node tools/framelint.mjs --film lab/nocode                 # middle of every scene
 *   node tools/framelint.mjs --film lab/nocode --frames 1.2,4.8
 *   node tools/framelint.mjs --film lab/nocode --n 12 --json
 *
 * tools/lint.mjs guards the brand (tokens, determinism) by reading files. This
 * renders frames and measures the laid-out page, the way Kinetograph's `lint`
 * does, and names the frame and the element for each finding:
 *
 *   text-clipped       text cut off by an ancestor with overflow hidden/clip   error
 *   text-off-canvas    visible text partly outside the frame                   error
 *   missing-font       a font face the text uses failed to load                error
 *   missing-asset      an image, font or file answered 4xx/5xx or is broken     error
 *   text-overflow      text spilling past its own box (no clip, so it shows)   warning
 *   text-overlap       two different visible texts covering each other         warning
 *
 * Exit 1 when there is an error. Warnings print but do not fail: kinetic type
 * overlaps on purpose often enough that a hard rule would only be ignored.
 *
 * Only what a frame can show is checked: text at opacity ~0 (its own or an
 * ancestor's), visibility:hidden, or clipped away completely is skipped, so
 * a word waiting off-stage to slide in is not a finding. A clip that is a
 * reveal by design is not a finding either: splitText({ mask: true }) marks
 * its masks `data-mask`, and any box of your own with `data-mask` counts too.
 * Sample rest points (the default: the middle of each scene).
 *
 * A deliberate exception (a code wall bleeding off the frame as a backdrop)
 * says so on the element: data-lint-allow="code wall bleeds by design". The
 * reason is required, like lint.mjs's motionkit-allow, so it shows in review.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, filmUrl, filmWantsGL, startServer, withPage, waitForFilm } from './browser.mjs';
import { reporter, assertFilm, pickTimes } from './report.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));
const rep = reporter(args);
await assertFilm(ROOT, args.film, rep);

const PORT = Number(args.port ?? 9371);
const W = Number(args.width ?? 1080), H = Number(args.height ?? 1920);

/* Runs in the page after PK.frame(t). Returns findings for this frame. */
const CHECK = String.raw`(() => {
  const stage = document.getElementById('stage') ?? document.body;
  const S = stage.getBoundingClientRect();
  const out = [];
  const tag = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = [...el.classList].slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    return s;
  };
  const path = (el) => {
    const parts = [];
    for (let e = el; e && e !== stage && parts.length < 4; e = e.parentElement) parts.unshift(tag(e));
    return parts.join(' > ') || tag(el);
  };
  const opacityOf = (el) => {
    let o = 1;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      o *= parseFloat(getComputedStyle(e).opacity);
      if (o < 0.02) return 0;
    }
    return o;
  };
  const inter = (a, b) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const area = (a) => Math.max(0, a.r - a.l) * Math.max(0, a.b - a.t);
  const box = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const round = (a) => ({ x: Math.round(a.l - S.left), y: Math.round(a.t - S.top), w: Math.round(a.r - a.l), h: Math.round(a.b - a.t) });
  const snippet = (s) => { s = s.replace(/\s+/g, ' ').trim(); return s.length > 40 ? s.slice(0, 39) + '…' : s; };

  // Gather visible text: one entry per element, merged over its text nodes.
  const byEl = new Map();
  const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT,
    { acceptNode: (n) => (n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const range = document.createRange();
  /* Ink, not line boxes. A range's rects are the font's whole ascent+descent,
     so a big numeral's empty descent "overlaps" the label under it. Trim each
     line rect to the glyphs' measured ink, scaled by however the line was
     transformed (rect height over the font's own box height). */
  const meter = document.createElement('canvas').getContext('2d');
  const inkOf = (n, cs) => {
    meter.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const m = meter.measureText(n.nodeValue.trim());
    const fa = m.fontBoundingBoxAscent, fd = m.fontBoundingBoxDescent;
    let u = null;
    for (const q of range.getClientRects()) {
      if (q.width < 1 || q.height < 1) continue;
      let t = q.top, b = q.bottom;
      if (fa + fd > 0) {
        const k = q.height / (fa + fd);
        t = q.top + Math.max(0, fa - m.actualBoundingBoxAscent) * k;
        b = q.top + (fa + m.actualBoundingBoxDescent) * k;
      }
      u = u ? { l: Math.min(u.l, q.left), t: Math.min(u.t, t), r: Math.max(u.r, q.right), b: Math.max(u.b, b) }
            : { l: q.left, t, r: q.right, b };
    }
    return u;
  };
  for (let n; (n = walker.nextNode()); ) {
    const el = n.parentElement;
    if (!el) continue;
    const ecs = getComputedStyle(el);
    if (ecs.visibility === 'hidden') continue;
    const allow = el.closest('[data-lint-allow]');
    if (allow && allow.getAttribute('data-lint-allow').trim()) continue;
    range.selectNodeContents(n);
    const r = inkOf(n, ecs);
    if (!r || r.r - r.l < 1 || r.b - r.t < 1) continue;
    const e = byEl.get(el);
    if (e) { e.r = { l: Math.min(e.r.l, r.l), t: Math.min(e.r.t, r.t), r: Math.max(e.r.r, r.r), b: Math.max(e.r.b, r.b) }; e.text += n.nodeValue; }
    else byEl.set(el, { el, r, text: n.nodeValue });
  }

  /* Occlusion. A scene's layer sits under the next one's opaque background,
     so its text is laid out but not seen. Hit-test the text's centre with
     every element made hittable for the moment (films set pointer-events:none
     freely), and drop text that an opaque box painted above it covers. */
  const hit = document.createElement('style');
  hit.textContent = '#stage, #stage * { pointer-events: auto !important; }';
  document.head.appendChild(hit);
  const opaque = (e) => {
    if (/^(IMG|CANVAS|VIDEO|svg)$/i.test(e.tagName)) return true;
    const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(e).backgroundColor);
    if (!m) return false;
    const p = m[1].split(',').map(Number);
    return (p.length < 4 || p[3] >= 0.95) && opacityOf(e) >= 0.95;
  };
  const covered = (el, r) => {
    const cx = (r.l + r.r) / 2, cy = (r.t + r.b) / 2;
    for (const top of document.elementsFromPoint(cx, cy)) {
      if (top === el || el.contains(top) || top.contains(el)) return false; // reached the text first
      if (opaque(top)) return true;                                         // something solid above it
    }
    return false;
  };

  const visible = [];
  for (const item of byEl.values()) {
    const { el, r } = item;
    if (opacityOf(el) < 0.02 || covered(el, r)) continue;
    // Walk the clipping ancestors: what part of the text is actually drawn?
    let vis = r, clipper = null, gone = false;
    item.masked = !!el.closest('[data-mask]');
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const clips = /hidden|clip/.test(cs.overflowX + ' ' + cs.overflowY);
      if (clips && e.hasAttribute('data-mask')) {
        // A reveal mask: what it hides is not shown, what it shows is fine.
        vis = inter(vis, box(e.getBoundingClientRect()));
        if (area(vis) < 1) { gone = true; break; }
      } else if (clips) {
        const nv = inter(vis, box(e.getBoundingClientRect()));
        if (area(nv) < 1) { gone = true; break; }
        const er = e.getBoundingClientRect();
        // A full-frame layer clipping is the frame edge: that is text-off-canvas, below.
        const frameSized = er.width >= S.width - 2 && er.height >= S.height - 2;
        if (!clipper && e !== stage && !frameSized && (nv.r - nv.l < vis.r - vis.l - 1.5 || nv.b - nv.t < vis.b - vis.t - 1.5)) clipper = e;
        vis = nv;
      }
      if (e === stage) break;
    }
    if (gone) continue;
    const onCanvas = inter(vis, box(S));
    if (area(onCanvas) < 1) continue;                     // entirely off-stage: not shown, not a finding
    const label = snippet(item.text);
    if (clipper) {
      out.push({ code: 'text-clipped', severity: 'error', element: path(el), text: label, box: round(r),
                 message: 'text cut off by ' + path(clipper) + ' (overflow ' + getComputedStyle(clipper).overflow + ')' });
    }
    if (area(onCanvas) < area(vis) - 2 || area(vis) < area(r) - 2 && !clipper && !item.masked) {
      out.push({ code: 'text-off-canvas', severity: 'error', element: path(el), text: label, box: round(vis),
                 message: 'text runs past the frame edge' });
    }
    /* Sideways only: display type is set with line-height under 1, so glyphs
       always poke above and below their line box. Single letters (splitText)
       overhang their own spans by design too. */
    const own = box(el.getBoundingClientRect());
    const cs = getComputedStyle(el);
    const slack = Math.max(2, (own.r - own.l) * 0.02);
    if (cs.display !== 'inline' && item.text.trim().length >= 3 && (r.r > own.r + slack || r.l < own.l - slack)) {
      out.push({ code: 'text-overflow', severity: 'warning', element: path(el), text: label, box: round(r),
                 message: 'text spills sideways past its own box (' + Math.round(own.r - own.l) + 'px wide)' });
    }
    visible.push({ el, vis: onCanvas, text: item.text.trim(), label, opacity: opacityOf(el) });
  }

  // Overlap between different texts. Echoes (same string) and nesting are deliberate.
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i], b = visible[j];
      if (a.text === b.text || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      // Split letters touch their neighbours; a dimmed text is a backdrop.
      if ((a.text.length === 1 && b.text.length === 1) || a.opacity < 0.5 || b.opacity < 0.5) continue;
      const ov = area(inter(a.vis, b.vis));
      const small = Math.min(area(a.vis), area(b.vis));
      if (small > 0 && ov / small > 0.3) {
        out.push({ code: 'text-overlap', severity: 'warning', element: path(a.el), text: a.label, box: round(inter(a.vis, b.vis)),
                   message: 'overlaps "' + b.label + '" (' + path(b.el) + '), ' + Math.round((ov / small) * 100) + '% of the smaller' });
      }
    }
  }

  // Fonts the visible text asks for that did not load.
  const seen = new Set();
  for (const v of visible) {
    const cs = getComputedStyle(v.el);
    const fam = cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
    if (/^(serif|sans-serif|monospace|system-ui|cursive|fantasy|ui-[a-z-]+)$/i.test(fam)) continue;
    const spec = cs.fontStyle + ' ' + cs.fontWeight + ' 16px "' + fam + '"';
    if (seen.has(spec)) continue;
    seen.add(spec);
    if (!document.fonts.check(spec, v.text)) {
      out.push({ code: 'missing-font', severity: 'error', element: path(v.el), text: v.label, box: round(v.vis),
                 message: 'font "' + fam + '" (' + cs.fontWeight + ' ' + cs.fontStyle + ') is not loaded; the text falls back' });
    }
  }
  for (const f of document.fonts) {
    if (f.status === 'error') out.push({ code: 'missing-font', severity: 'error', element: '@font-face', text: f.family,
      message: 'font face ' + f.family + ' ' + f.weight + ' failed to load' });
  }

  // Assets: broken images in the frame, and any request that came back 4xx/5xx.
  for (const img of stage.querySelectorAll('img')) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
      out.push({ code: 'missing-asset', severity: 'error', element: path(img), text: img.getAttribute('src'),
                 message: 'image did not load: ' + img.getAttribute('src') });
    }
  }
  for (const e of performance.getEntriesByType('resource')) {
    if (e.responseStatus >= 400 && !/\/favicon\.ico$/.test(e.name)) out.push({ code: 'missing-asset', severity: 'error', element: e.initiatorType,
      text: e.name.replace(location.origin, ''), message: 'HTTP ' + e.responseStatus + ' for ' + e.name.replace(location.origin, '') });
  }
  hit.remove();
  return out;
})()`;

const server = await startServer(ROOT, Number(args.serve ?? 5191));
const url = filmUrl(server.port, args.film);
let result;
try {
  result = await withPage({ url, port: PORT, width: W, height: H, gl: filmWantsGL(ROOT, args.film) }, async (cdp) => {
    const film = await waitForFilm(cdp, url);
    const times = pickTimes(args, film);
    const issues = [];
    const once = new Set(); // page-wide findings (fonts, assets) are reported once, at the first frame
    for (const t of times) {
      await cdp.eval(`window.PK.frame(${t.toFixed(5)})`, true);
      for (const f of await cdp.eval(CHECK)) {
        const pageWide = f.code === 'missing-asset' && f.element !== 'img' || f.element === '@font-face';
        const key = pageWide ? `${f.code}|${f.text}` : null;
        if (key && once.has(key)) continue;
        if (key) once.add(key);
        issues.push({ t, ...f });
      }
    }
    return { film: args.film, width: W, height: H, frames: times, issues };
  });
} finally {
  server.close();
}

const errors = result.issues.filter((i) => i.severity === 'error').length;
const warnings = result.issues.length - errors;
if (!rep.json) {
  if (!result.issues.length) {
    console.log(`clean · ${args.film} · ${result.frames.length} frames (${result.frames.join(', ')} s)`);
  } else {
    const byCode = new Map();
    for (const i of result.issues) (byCode.get(i.code) ?? byCode.set(i.code, []).get(i.code)).push(i);
    for (const [code, list] of byCode) {
      console.log(`\n${code} (${list[0].severity}) ×${list.length}`);
      for (const i of list.slice(0, 12)) {
        const at = i.box ? ` @ ${i.box.x},${i.box.y} ${i.box.w}x${i.box.h}` : '';
        console.log(`  ${i.t.toFixed(2)}s  ${i.element}  "${i.text}"${at}\n         ${i.message}`);
      }
      if (list.length > 12) console.log(`  … and ${list.length - 12} more (--json for all)`);
    }
    console.log(`\n${errors} error(s), ${warnings} warning(s) over ${result.frames.length} frames`);
  }
}
rep.done({ ...result, errors, warnings }, errors ? 1 : 0);
