/* Everything the two capture tools share: finding a browser, the bit of the
 * DevTools protocol we use, and the static server.
 *
 * Chromium comes from puppeteer's own download (npm install), so renders are
 * the same on every machine. A system chromium/chrome is the fallback.
 */

import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, normalize } from 'node:path';

/** The newest puppeteer-managed Chromium, or a system browser if one turns up. */
export function findChrome() {
  const cache = join(process.env.HOME, '.cache', 'puppeteer', 'chrome');
  if (existsSync(cache)) {
    const builds = readdirSync(cache).sort();
    for (const b of builds.reverse()) {
      const exe = join(cache, b, 'chrome-linux64', 'chrome');
      if (existsSync(exe)) return exe;
    }
  }
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'brave']) {
    const which = spawnSync('which', [name], { encoding: 'utf8' });
    if (which.status === 0) return which.stdout.trim();
  }
  throw new Error(
    'no Chromium found. Run `npm install` in the repo root — puppeteer ' +
    'downloads its own, and that is what the export is calibrated against.',
  );
}

/** `--fps 30 --film lab/nocode` → `{ fps: '30', film: 'lab/nocode' }` */
export function parseArgs(argv) {
  return Object.fromEntries(
    argv.join(' ').split('--').filter(Boolean)
      .map((s) => s.trim().split(/\s+/)).map(([k, v = 'true']) => [k, v]),
  );
}

/**
 * The flags every capture uses. One list, so the exporter and the frame-grabber
 * cannot disagree about what browser they are driving — a difference here is a
 * difference between what you reviewed and what shipped.
 *
 * `--no-sandbox` is not optional on this server. Ubuntu's AppArmor profile
 * disables unprivileged user namespaces, so Chromium aborts at startup with
 * "No usable sandbox!" and the only symptom the tool sees is a debugging port
 * that never opens. We are loading local files we wrote ourselves, so the
 * sandbox buys nothing here; on a machine that renders untrusted HTML it would
 * be a different decision.
 */
export function chromeFlags({ width, height, profile, port, gl = false }) {
  return [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',      // /dev/shm is small in containers; crashes look like hangs
    // There is no GPU on this server. A film that draws in WebGL opts in
    // (filmWantsGL) and gets SwiftShader, the same software GL the map bake
    // uses; every other film keeps the flag and renders exactly as before.
    ...(gl ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : ['--disable-gpu']),
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--force-device-scale-factor=1',
    `--window-size=${width},${height}`,
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
  ];
}

/**
 * The URL for a film, with the export flag in the QUERY rather than glued onto
 * the path — append it to `…/teaser.html` by hand and you ask the server for a
 * directory that is not there.
 */
/** Whether a film draws in WebGL: its .html says so with <html data-gl>. */
export function filmWantsGL(root, film) {
  if (!film) return false;
  const [brand, name] = String(film).split('/');
  try {
    return /<html[^>]*\bdata-gl\b/.test(readFileSync(join(root, 'brands', brand, 'films', `${name}.html`), 'utf8'));
  } catch { return false; }
}

export function filmUrl(port, film, extra = {}) {
  const [brand, name] = String(film).split('/');
  if (!brand || !name) throw new Error(`--film wants <brand>/<name>, got "${film}"`);
  const u = new URL(`http://127.0.0.1:${port}/brands/${brand}/films/${name}.html`);
  u.searchParams.set('export', '');
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
  return u.href.replace(/=(?=&|$)/g, '');
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
};

/**
 * A no-cache static server rooted at the kit. The only thing it adds over
 * `python -m http.server` is that it refuses to let the browser cache
 * anything — otherwise every edit needs a hard reload and you spend twenty
 * minutes debugging a stale file.
 *
 * In-process, so the capture tools do not need a server started by hand and
 * cannot race one that is still coming up.
 */
export function startServer(root, port = 5178) {
  const srv = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = resolve(root, '.' + normalize(path));
      if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
      const s = await stat(file);
      const target = s.isDirectory() ? join(file, 'index.html') : file;
      const body = await readFile(target);
      res.writeHead(200, {
        'Content-Type': MIME[extname(target)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store, must-revalidate',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not here');
    }
  });

  return new Promise((ok, fail) => {
    srv.on('error', (e) => {
      if (e.code === 'EADDRINUSE') { port += 1; srv.listen(port, '127.0.0.1'); return; }
      fail(e);
    });
    srv.listen(port, '127.0.0.1', () => ok({
      port: srv.address().port,
      close: () => srv.close(),
    }));
  });
}

/** The debugging port takes a moment to come up, and there is no signal for it. */
export async function waitForBrowser(port) {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return r.json();
    } catch { /* not up yet */ }
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error('the browser never opened its debugging port');
}

/** Just enough of the DevTools protocol: send a command, await its reply. */
export class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.next = 0;
    this.pending = new Map();
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      const slot = this.pending.get(msg.id);
      if (!slot) return;
      this.pending.delete(msg.id);
      msg.error ? slot.reject(new Error(msg.error.message)) : slot.resolve(msg.result);
    });
  }

  open() { return once(this.ws, 'open'); }

  send(method, params = {}) {
    const id = ++this.next;
    return new Promise((resolve_, reject) => {
      this.pending.set(id, { resolve: resolve_, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  /** Run an expression in the page and hand back its value. */
  async eval(expression, awaitPromise = false) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression, awaitPromise, returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? 'page threw');
    return result.value;
  }
}

/** Launch headless Chromium, run `fn(cdp)`, and always clean up after it. */
export async function withPage({ url, port, width = 1080, height = 1920, gl = false }, fn) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const profile = await mkdtemp(join(tmpdir(), 'motionkit-'));
  const browser = spawn(findChrome(), [...chromeFlags({ width, height, profile, port, gl })],
    { stdio: 'ignore' });

  let cdp = null;
  try {
    await waitForBrowser(port);
    const target = await (await fetch(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' },
    )).json();
    cdp = new CDP(target.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false,
    });
    return await fn(cdp);
  } finally {
    if (cdp) {
      await Promise.race([
        cdp.send('Browser.close').catch(() => {}),
        new Promise((res) => setTimeout(res, 1500)),
      ]);
      cdp.ws.close();
    }
    browser.kill();
    await new Promise((res) => setTimeout(res, 200));
    await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }).catch(() => {});
  }
}

/** Wait for `window.PK` and its assets, with a diagnosis rather than a hang. */
export async function waitForFilm(cdp, url) {
  /* Collect what the page says about itself BEFORE the wait, so a module that
     throws on import produces the actual error instead of a bare "PK never
     appeared". Without this the only signal is a stack trace from our own
     tool, which points at the tool and not at the film. */
  const errors = [];
  cdp.ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push(d.exception?.description ?? d.text ?? 'unknown exception');
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      errors.push(`${m.params.entry.text} (${m.params.entry.url ?? ''})`);
    }
  });
  await cdp.send('Log.enable').catch(() => {});

  for (let i = 0; i < 200; i++) {
    if (await cdp.eval('!!window.PK').catch(() => false)) break;
    await new Promise((res) => setTimeout(res, 100));
  }
  if (!(await cdp.eval('!!window.PK').catch(() => false))) {
    const why = errors.length
      ? `\n\nthe page reported:\n  ${[...new Set(errors)].join('\n  ')}`
      : '\n\nthe page reported no errors, so runFilm() was probably never reached.';
    throw new Error(`window.PK never appeared at ${url}${why}`);
  }
  await cdp.eval('window.PK.ready', true);
  return {
    duration: await cdp.eval('window.PK.DURATION'),
    scenes: await cdp.eval('window.PK.SCENES'),
  };
}
