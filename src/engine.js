// All file work runs in the browser. Nothing is uploaded.
import JSZip from 'jszip';
import {PDFDocument, PDFName, StandardFonts, rgb, degrees} from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
export const MARK = 'flisk studio';
export const FREE_FILES = 5;
export const kb = (n) => (n / 1024).toFixed(0) + ' KB';

// Unlock: set both, then point the Stripe Payment Link's after-payment redirect at /?unlocked=<UNLOCK_TOKEN>.
// Honour-system gate: the token is readable in the bundle. See README.
export const PAYMENT_LINK = 'https://buy.stripe.com/REPLACE_ME';
export const UNLOCK_TOKEN = 'REPLACE_WITH_RANDOM_STRING';
const KEY = 'studio-unlocked';
// Free for now: no file limit and no mark. Set to false to bring back the free tier and the Stripe unlock.
export const FREE_FOR_NOW = true;
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
export function initUnlock() {
  const qs = new URLSearchParams(location.search);
  if (qs.get('unlocked') === UNLOCK_TOKEN) { store.set(KEY, '1'); history.replaceState(null, '', location.pathname); }
  return FREE_FOR_NOW || store.get(KEY) === '1';
}

function stamp(g, w, h, text, unlocked) {
  const fs = Math.max(12, Math.round(w / 28));
  g.textBaseline = 'bottom';
  const draw = (t, x, y, a) => { g.fillStyle = `rgba(255,255,255,${a})`; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = fs / 12; g.strokeText(t, x, y); g.fillText(t, x, y); };
  if (text) { g.font = `600 ${fs}px sans-serif`; g.textAlign = 'center'; draw(text, w / 2, h / 2 + fs / 2, 0.55); }
  if (!unlocked) { g.font = `600 ${Math.round(fs * 0.6)}px sans-serif`; g.textAlign = 'right'; draw(MARK, w - fs / 2, h - fs / 2, 0.7); }
}

function unique(name, used) {
  let n = name, k = 1; const dot = name.lastIndexOf('.');
  while (used.has(n)) n = name.slice(0, dot) + '-' + (++k) + name.slice(dot);
  used.add(n); return n;
}

// Shrink in halves, then the last step with high-quality smoothing: one big jump makes text jagged and unreadable.
function resample(src, sx, sy, sw, sh, w, h, white) {
  let cur = src, cx = sx, cy = sy, cw = sw, ch = sh;
  while (cw / 2 > w && ch / 2 > h) {
    const t = document.createElement('canvas'); t.width = Math.ceil(cw / 2); t.height = Math.ceil(ch / 2);
    const g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cur, cx, cy, cw, ch, 0, 0, t.width, t.height);
    cur = t; cx = 0; cy = 0; cw = t.width; ch = t.height;
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  if (white) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
  g.drawImage(cur, cx, cy, cw, ch, 0, 0, w, h);
  return c;
}

// A small picture of page 1 plus the page count, for the list of picked files.
export async function pdfThumb(file) {
  const src = await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise;
  const pg = await src.getPage(1), base = pg.getViewport({scale: 1}), vp = pg.getViewport({scale: 120 / base.width});
  const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
  await pg.render({canvasContext: c.getContext('2d'), viewport: vp}).promise;
  const out = {url: c.toDataURL('image/jpeg', 0.7), pages: src.numPages};
  await src.destroy(); return out;
}

const FORMATS = {jpg: {mime: 'image/jpeg', ext: '.jpg'}, png: {mime: 'image/png', ext: '.png'}, webp: {mime: 'image/webp', ext: '.webp'}};
export async function photoBatch(files, o, say) {
  const zip = new JSZip(); const items = []; const used = new Set(); let before = 0, after = 0, i = 0;
  for (const f of files) {
    say(`Photo ${++i} of ${files.length}…`);
    const bmp = await createImageBitmap(f);
    let sw = bmp.width, sh = bmp.height, sx = 0, sy = 0, w, h;
    if (o.square) { const s = Math.min(sw, sh); sx = (sw - s) / 2; sy = (sh - s) / 2; sw = sh = s; w = h = Math.min(o.size, s); }
    else { const k = Math.min(1, o.size / Math.max(sw, sh)); w = Math.round(sw * k); h = Math.round(sh * k); }
    const c = resample(bmp, sx, sy, sw, sh, w, h, o.format === 'jpg'); bmp.close();
    const g = c.getContext('2d');
    stamp(g, w, h, o.mark, o.unlocked);
    const fmt = FORMATS[o.format] || FORMATS.jpg;
    const blob = await new Promise((r) => c.toBlob(r, fmt.mime, o.quality / 100));
    before += f.size; after += blob.size;
    const nm = unique(f.name.replace(/\.[^.]+$/, '') + fmt.ext, used);
    zip.file(nm, blob); items.push({name: nm, kind: 'image', dims: w + ' × ' + h, url: URL.createObjectURL(blob), before: f.size, after: blob.size});
  }
  return {blob: await zip.generateAsync({type: 'blob'}), name: 'photos.zip', items, msg: `Done. ${files.length} photo(s), ${kb(before)} → ${kb(after)}.`};
}

async function textPng(text, px) {
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  g.font = `700 ${px}px sans-serif`; c.width = Math.ceil(g.measureText(text).width) + 8; c.height = Math.ceil(px * 1.4);
  g.font = `700 ${px}px sans-serif`; g.fillStyle = '#808080'; g.textBaseline = 'middle'; g.fillText(text, 4, c.height / 2);
  return new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/png'))).arrayBuffer());
}
// The text is drawn as an image, so any language works (the built-in PDF fonts only know Latin).
async function watermarkDoc(doc, text, unlocked) {
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const img = text ? await doc.embedPng(await textPng(text, 120)) : null;
  for (const p of doc.getPages()) {
    const {width, height} = p.getSize();
    if (img) {
      const w = Math.min(width * 0.8, img.width), k = w / img.width, h = img.height * k;
      p.drawImage(img, {x: width * 0.12, y: height * 0.3, width: w, height: h, opacity: 0.25, rotate: degrees(35)});
    }
    if (!unlocked) p.drawText(MARK, {x: width - 90, y: 12, size: 9, font, color: rgb(0.4, 0.4, 0.4), opacity: 0.8});
  }
}
const pdfBlob = async (d) => new Blob([await d.save()], {type: 'application/pdf'});

// Detail steps for Shrink: the first is what the quality asks for, then less and less until the file is smaller than the original.
export function shrinkTiers(quality) {
  const q = quality / 100, scale = q >= 0.8 ? 2 : q >= 0.55 ? 1.5 : q >= 0.4 ? 1.2 : 1;
  return [[scale, q], ...[[1.5, 0.6], [1.2, 0.45], [1, 0.35]].filter(([s, qq]) => s < scale || (s === scale && qq < q))];
}

export async function pdfBatch(files, o, say) {
  if (o.action === 'merge') {
    const out = await PDFDocument.create();
    for (const f of files) {
      const d = await PDFDocument.load(await f.arrayBuffer(), {ignoreEncryption: true});
      (await out.copyPages(d, d.getPageIndices())).forEach((p) => out.addPage(p));
    }
    await watermarkDoc(out, o.mark, o.unlocked);
    return {blob: await pdfBlob(out), name: 'merged.pdf', items: [{name: 'merged.pdf', kind: 'pdf', url: URL.createObjectURL(await pdfBlob(out))}], msg: `Merged ${files.length} PDF(s) into ${out.getPageCount()} pages.`};
  }
  const zip = new JSZip(); const outs = []; const items = []; const used = new Set(); let kept = 0, lowered = 0, repacked = 0; let before = 0, after = 0, i = 0;
  for (const f of files) {
    say(`PDF ${++i} of ${files.length}…`); before += f.size;
    let blob;
    if (o.action === 'mark') {
      const out = await PDFDocument.load(await f.arrayBuffer(), {ignoreEncryption: true});
      await watermarkDoc(out, o.mark, o.unlocked); blob = await pdfBlob(out);
    } else {
      // Shrink: redraw each page as a JPEG. That strips hidden text and metadata; text is no longer selectable.
      // If that would come out bigger than the original (already-compressed scans, text PDFs), try less detail, step by step,
      // and keep the original only if even the lowest step is bigger.
      const src = await pdfjsLib.getDocument({data: await f.arrayBuffer()}).promise;
      const tiers = o.flatten ? [[2, o.quality / 100]] : shrinkTiers(o.quality);
      const total = src.numPages;
      const LANES = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
      for (let t = 0; t < tiers.length && !blob; t++) {
        const [scale, q] = tiers[t];
        const out = await PDFDocument.create();
        // Render several pages at once (each lane has its own canvas), then embed in order.
        const jpgs = new Array(total + 1); let next = 1, done = 0, rendered = 0, stop = false;
        await Promise.all(Array.from({length: LANES}, async () => {
          const c = document.createElement('canvas');
          while (!stop && next <= total) {
            const n = next++;
            const pg = await src.getPage(n), vp = pg.getViewport({scale});
            c.width = vp.width; c.height = vp.height;
            await pg.render({canvasContext: c.getContext('2d', {alpha: false}), viewport: vp}).promise;
            const jpg = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
            const base = pg.getViewport({scale: 1}); pg.cleanup();
            jpgs[n] = {jpg, w: base.width, h: base.height}; rendered += jpg.size; done++;
            say(`PDF ${i} of ${files.length}: page ${done} of ${total}${t ? ' (less detail)' : ''}…`);
            // After 3 pages, if the whole file would come out bigger than the original, stop this step.
            if (!o.flatten && done === 3 && rendered / 3 * total > f.size) stop = true;
          }
          c.width = c.height = 0;
        }));
        if (stop) continue;
        for (let n = 1; n <= total; n++) {
          const {jpg, w, h} = jpgs[n]; jpgs[n] = null;
          const img = await out.embedJpg(await jpg.arrayBuffer());
          out.addPage([w, h]).drawImage(img, {x: 0, y: 0, width: w, height: h});
          if (n % 20 === 0) await new Promise((r) => setTimeout(r));
        }
        await watermarkDoc(out, o.mark, o.unlocked);
        const made = await pdfBlob(out);
        if (!o.flatten && made.size >= f.size) continue;
        blob = made; if (t > 0) lowered++;
      }
      await src.destroy();
      if (!blob) {
        // Last step: keep the text selectable, but repack the file (object streams) and drop metadata. Use it only if it is smaller.
        const keep = await PDFDocument.load(await f.arrayBuffer(), {ignoreEncryption: true, updateMetadata: false});
        keep.context.trailerInfo.Info = undefined;
        keep.catalog.delete(PDFName.of('Metadata'));
        await watermarkDoc(keep, o.mark, o.unlocked);
        const packed = new Blob([await keep.save({useObjectStreams: true, updateFieldAppearances: false})], {type: 'application/pdf'});
        if (packed.size < f.size) { blob = packed; repacked++; }
        else { blob = !o.mark && o.unlocked ? f : await pdfBlob(keep); kept++; }
      }
    }
    const b = blob;
    const nm = unique(f.name, used);
    after += b.size; outs.push([nm, b]); items.push({name: nm, kind: 'pdf', url: URL.createObjectURL(b), before: f.size, after: b.size});
  }
  const msg = `Done. ${kb(before)} → ${kb(after)}.` + (lowered ? ` ${lowered} file(s) needed less detail than you asked for to get smaller.` : '') + (repacked ? ` ${repacked} text PDF(s) were only repacked (text stays selectable), so they shrink little.` : '') + (kept ? ` ${kept} file(s) could not be made smaller (they are already compact), so they were left as they were.` : '');
  if (outs.length === 1) return {blob: outs[0][1], name: outs[0][0], items, msg};
  outs.forEach(([n, b]) => zip.file(n, b));
  return {blob: await zip.generateAsync({type: 'blob'}), name: 'pdfs.zip', items, msg};
}

// ---- Download matrix: every task offers many ready-made variants, built on click from the same files and options. ----
const MARK_ROWS = (o) => {
  const rows = [];
  if (o.mark || !o.unlocked) rows.push({id: 'mark', label: 'With watermark', patch: {}});
  if (o.unlocked) rows.push({id: 'clean', label: o.mark ? 'Without watermark' : 'Clean', patch: {mark: '', unlocked: true}});
  return rows;
};
const cross = (a, b) => a.flatMap((x) => b.map((y) => ({id: x.id + '-' + y.id, label: x.label + ' · ' + y.label, patch: {...x.patch, ...y.patch}})));
export function matrix(task, o) {
  const marks = MARK_ROWS(o);
  if (task === 'photo') {
    const sizes = [{id: 'sized', label: o.size + ' px', patch: {}}, {id: 'orig', label: 'Original size', patch: {size: Infinity}}];
    return {rows: cross(sizes, marks), cols: [{id: 'jpg', label: 'JPEG', patch: {format: 'jpg'}}, {id: 'png', label: 'PNG', patch: {format: 'png'}}, {id: 'webp', label: 'WebP', patch: {format: 'webp'}}]};
  }
  if (task === 'merge') return {rows: marks, cols: [{id: 'full', label: 'Merged PDF', patch: {}}, {id: 'small', label: 'Smaller file', patch: {post: 60}}, {id: 'tiny', label: 'Smallest file', patch: {post: 35}}]};
  if (task === 'shrink') return {rows: marks, cols: [{id: 'light', label: 'Light 85%', patch: {quality: 85}}, {id: 'balanced', label: 'Balanced 60%', patch: {quality: 60}}, {id: 'strong', label: 'Strong 35%', patch: {quality: 35}}]};
  return {rows: marks, cols: [{id: 'pdf', label: 'Watermarked PDF', patch: {}}, {id: 'flat', label: 'Flattened (mark cannot be removed)', patch: {act: 'shrink', flatten: true, quality: 85}}]};
}
const withSuffix = (name, slug) => name.replace(/(\.[^.]+)$/, `-${slug}$1`);
export async function buildVariant(task, files, o, row, col, say) {
  const oo = {...o, ...row.patch, ...col.patch};
  let r = task === 'photo' ? await photoBatch(files, oo, say) : await pdfBatch(files, {...oo, action: oo.act || task}, say);
  r.items.forEach((i) => URL.revokeObjectURL(i.url));
  if (oo.post) {
    // Merge, then shrink the merged file. The mark is already on it, so it is not added twice.
    const merged = new File([r.blob], r.name, {type: 'application/pdf'});
    r = await pdfBatch([merged], {...oo, action: 'shrink', mark: '', unlocked: true, quality: oo.post}, say);
    r.items.forEach((i) => URL.revokeObjectURL(i.url));
  }
  return {blob: r.blob, name: withSuffix(r.name, `${col.id}-${row.id}`)};
}
