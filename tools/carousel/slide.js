/* One carousel slide, drawn from a deck JSON in a brand's own look.
 *
 *   /tools/carousel/index.html?deck=/campaigns/launch/carousel.json&i=0
 *
 * The deck names its brand; colours come from that brand's theme.js through
 * the role map in its profile.json (bg, fg, accent…), type from its typo()
 * roles and theme.css, so a carousel and a film of the same brand match.
 * tools/carousel.mjs captures every slide; open this page in the browser to
 * look at one. window.READY resolves when fonts and images are in.
 */

const q = new URLSearchParams(location.search);
const deck = await (await fetch(q.get('deck'))).json();
const i = Number(q.get('i') ?? 0);
const s = deck.slides[i];
const [W, H] = (deck.size ?? '1080x1350').split('x').map(Number);

const brandDir = `/brands/${deck.brand}`;
const theme = await import(`${brandDir}/theme.js`);
const profile = await (await fetch(`${brandDir}/profile.json`)).json();
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = `${brandDir}/theme.css`;
document.head.appendChild(link);
await new Promise((res) => { link.onload = res; link.onerror = res; });

const col = (role) => theme.C[profile.palette?.[role] ?? role] ?? role;
const type = (role) => theme.typo(profile.type?.[role] ?? role);
/* Big type in the brand's display face when it has one. Size steps down
   with length so a long title still fits in three lines. */
const display = (text, max = 130) => {
  const n = text.length;
  const size = n <= 14 ? max : n <= 28 ? Math.round(max * 0.85) : n <= 48 ? Math.round(max * 0.72) : Math.round(max * 0.55);
  // condensed faces squeeze the spaces too: give them back
  return (theme.disp ? theme.disp(size, { lh: 0.95, s: 92 }) : `${type('display')}font-size:${size}px;`) + 'word-spacing:0.14em;';
};
const mono = (px) => (theme.mono ? theme.mono(px) : '');

const root = document.getElementById('slide');
const bg = s.bg ? col(s.bg) : i === 0 || s.type === 'cta' ? col('accent') : col('bg');
const fg = s.fg ? col(s.fg) : i === 0 || s.type === 'cta' ? col('bg') : col('fg');
const accent = i === 0 || s.type === 'cta' ? col('bg') : col('accent');
root.style.cssText = `width:${W}px;height:${H}px;background:${bg};color:${fg};font-family:Inter,system-ui,sans-serif`;

const el = (tag, style, text) => {
  const e = document.createElement(tag);
  e.style.cssText = style;
  if (text != null) e.textContent = text;
  return e;
};
const PAD = 96;
const body = el('div', `position:absolute;left:${PAD}px;right:${PAD}px;top:${PAD + 70}px;bottom:${PAD + 70}px;display:flex;flex-direction:column;justify-content:center;gap:40px`);
root.appendChild(body);

/* the furniture every slide has: counter top right, handle bottom left */
root.appendChild(el('div', `position:absolute;right:${PAD}px;top:${PAD - 20}px;${mono(28)}color:${fg};opacity:.7`, `${i + 1}/${deck.slides.length}`));
root.appendChild(el('div', `position:absolute;left:${PAD}px;bottom:${PAD - 20}px;${mono(28)}color:${fg};opacity:.7`, deck.handle ?? ''));
root.appendChild(el('div', `position:absolute;left:${PAD}px;top:${PAD - 4}px;width:120px;height:10px;border-radius:5px;background:${accent}`));

const LAYOUT = {
  cover() {
    if (s.kicker) body.appendChild(el('div', `${type('label')}color:${fg};opacity:.8`, s.kicker));
    body.appendChild(el('div', `${display(s.title, 150)}text-wrap:balance`, s.title));
    if (s.sub) body.appendChild(el('div', `${type('body')}text-wrap:balance`, s.sub));
    root.appendChild(el('div', `position:absolute;right:${PAD}px;bottom:${PAD - 26}px;${type('label')}color:${fg}`, s.swipe ?? 'SWIPE →'));
  },
  point() {
    body.appendChild(el('div', `${display(String(s.n), 220)}color:${accent}`, String(s.n).padStart(2, '0')));
    body.appendChild(el('div', `${display(s.title, 130)}text-wrap:balance`, s.title));
    if (s.body) body.appendChild(el('div', `${type('body')}opacity:.85;text-wrap:pretty`, s.body));
  },
  list() {
    body.appendChild(el('div', `${display(s.title, 110)}text-wrap:balance`, s.title));
    const ul = el('div', 'display:flex;flex-direction:column;gap:26px');
    for (const item of s.items) {
      const row = el('div', 'display:flex;gap:28px;align-items:baseline');
      row.appendChild(el('div', `flex:none;width:22px;height:22px;border-radius:50%;background:${accent};translate:0 -6px`));
      row.appendChild(el('div', `${type('body')}`, item));
      ul.appendChild(row);
    }
    body.appendChild(ul);
  },
  stat() {
    body.style.alignItems = 'flex-start';
    body.appendChild(el('div', `${display(String(s.value), 360)}color:${accent}`, String(s.value)));
    body.appendChild(el('div', `${display(s.label, 96)}text-wrap:balance`, s.label));
    if (s.note) body.appendChild(el('div', `${mono(30)}opacity:.7`, s.note));
  },
  quote() {
    body.appendChild(el('div', `${display('“', 260)}color:${accent};height:140px`, '“'));
    body.appendChild(el('div', `${display(s.text, 96)}text-wrap:balance`, s.text));
    if (s.who) body.appendChild(el('div', `${mono(32)}opacity:.75`, `— ${s.who}`));
  },
  cta() {
    body.style.alignItems = 'center';
    body.style.textAlign = 'center';
    body.appendChild(el('div', `${display(s.title, 130)}text-wrap:balance`, s.title));
    body.appendChild(el('div', `padding:30px 60px;border-radius:999px;background:${col('bg')};color:${col('accent')};${type('body')}font-weight:900`, s.button));
    if (s.sub) body.appendChild(el('div', `${mono(30)}`, s.sub));
  },
  image() {
    body.appendChild(el('div', `${display(s.title, 100)}text-wrap:balance`, s.title));
    const img = el('img', `width:100%;max-height:${H * 0.5}px;object-fit:cover;border-radius:36px`);
    img.src = s.src;
    body.appendChild(img);
    if (s.caption) body.appendChild(el('div', `${type('body')}opacity:.85`, s.caption));
  },
};
if (!LAYOUT[s.type]) throw new Error(`slide ${i}: no layout "${s.type}" (have ${Object.keys(LAYOUT).join(', ')})`);
LAYOUT[s.type]();

// layout first, so the faces in use start loading before fonts.ready is asked
void root.offsetHeight;
window.READY = Promise.all([document.fonts.ready, ...[...document.images].map((im) => im.decode().catch(() => {}))])
  .then(() => ({ W, H, n: deck.slides.length }));
