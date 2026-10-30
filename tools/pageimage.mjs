/* Image work done in the page we already have open.
 *
 * snapshot.mjs and onion.mjs need to decode, scale, compare and composite
 * PNGs. Node has no image decoder without a dependency; the headless browser
 * the capture tools drive has one built in. So the pixels go into a detached
 * canvas in that page (never attached to the DOM, so the film is untouched)
 * and come back as base64 PNG plus numbers.
 */

/** A PNG of the current frame, as base64. */
export async function grab(cdp) {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  return data;
}

const LOAD = `const load = (b64) => new Promise((ok, bad) => {
  const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('bad png')); i.src = 'data:image/png;base64,' + b64; });
const png = (c) => c.toDataURL('image/png').slice('data:image/png;base64,'.length);`;

/** Scale a base64 PNG by `k` (0.5 = half size). */
export function scaled(cdp, b64, k) {
  if (k === 1) return Promise.resolve(b64);
  return cdp.eval(`(async () => { ${LOAD}
    const img = await load(${JSON.stringify(b64)});
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * ${k}); c.height = Math.round(img.height * ${k});
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
    return png(c); })()`, true);
}

/**
 * Compare two base64 PNGs. A pixel counts as changed when any channel moved
 * more than `tol` (0–255). The diff image is the approved frame in faint grey
 * with every changed pixel in red, so a change reads at a glance.
 */
export function compare(cdp, approvedB64, actualB64, tol = 24) {
  return cdp.eval(`(async () => { ${LOAD}
    const [a, b] = await Promise.all([load(${JSON.stringify(approvedB64)}), load(${JSON.stringify(actualB64)})]);
    if (a.width !== b.width || a.height !== b.height)
      return { sizeMismatch: true, approved: [a.width, a.height], actual: [b.width, b.height] };
    const w = a.width, h = a.height;
    const ca = document.createElement('canvas'); ca.width = w; ca.height = h;
    const cb = document.createElement('canvas'); cb.width = w; cb.height = h;
    const xa = ca.getContext('2d', { willReadFrequently: true }), xb = cb.getContext('2d', { willReadFrequently: true });
    xa.drawImage(a, 0, 0); xb.drawImage(b, 0, 0);
    const A = xa.getImageData(0, 0, w, h), B = xb.getImageData(0, 0, w, h);
    const D = xa.createImageData(w, h);
    let changed = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let i = 0, p = 0; i < A.data.length; i += 4, p++) {
      const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
      if (d > ${Number(tol)}) {
        changed++;
        const x = p % w, y = (p / w) | 0;
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
        D.data[i] = 255; D.data[i + 1] = 40; D.data[i + 2] = 40; D.data[i + 3] = 255;
      } else {
        const g = (A.data[i] + A.data[i + 1] + A.data[i + 2]) / 3;
        D.data[i] = D.data[i + 1] = D.data[i + 2] = 128 + g / 4; D.data[i + 3] = 255;
      }
    }
    const cd = document.createElement('canvas'); cd.width = w; cd.height = h;
    cd.getContext('2d').putImageData(D, 0, 0);
    return { changed, ratio: changed / (w * h), bbox: changed ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null,
             diff: changed ? png(cd) : null };
  })()`, true);
}

/**
 * Onion skin: frames in time order into one image. On a dark film each frame
 * is laid on with 'lighten' after the older ones are dimmed a step, so the
 * newest pose is brightest and the path fades behind it; a light film uses
 * 'darken' and fades towards white. `blend` forces either.
 */
export function onion(cdp, frames, { blend = 'auto', fade = 0.28, label = '' } = {}) {
  return cdp.eval(`(async () => { ${LOAD}
    const imgs = [];
    for (const b of ${JSON.stringify(frames)}) imgs.push(await load(b));
    const w = imgs[0].width, h = imgs[0].height;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(imgs[0], 0, 0);
    let mode = ${JSON.stringify(blend)};
    if (mode === 'auto') {
      // Judge the whole range, not frame one: a move often starts on the tail of the previous scene.
      let s = 0, n = 0;
      const probe = document.createElement('canvas'); probe.width = 64; probe.height = Math.max(1, Math.round(64 * h / w));
      const px = probe.getContext('2d', { willReadFrequently: true });
      for (const im of imgs) {
        px.drawImage(im, 0, 0, probe.width, probe.height);
        const d = px.getImageData(0, 0, probe.width, probe.height).data;
        for (let i = 0; i < d.length; i += 4) { s += d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722; n++; }
      }
      mode = s / n > 128 ? 'darken' : 'lighten';
    }
    const veil = mode === 'darken' ? 'rgba(255,255,255,${fade})' : 'rgba(0,0,0,${fade})';
    for (let k = 1; k < imgs.length; k++) {
      x.globalCompositeOperation = 'source-over'; x.fillStyle = veil; x.fillRect(0, 0, w, h);
      x.globalCompositeOperation = mode; x.drawImage(imgs[k], 0, 0);
    }
    x.globalCompositeOperation = 'source-over';
    if (${JSON.stringify(label)}) {
      const fs = Math.round(Math.max(18, w / 45));
      x.font = '500 ' + fs + 'px ui-monospace, monospace';
      const t = ${JSON.stringify(label)}, tw = x.measureText(t).width;
      x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillRect(16, 16, tw + fs, fs * 1.8);
      x.fillStyle = '#fff'; x.fillText(t, 16 + fs / 2, 16 + fs * 1.25);
    }
    return { blend: mode, png: png(c) };
  })()`, true);
}
