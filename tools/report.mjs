/* One output contract for the tools, so an agent can drive them.
 *
 *   node tools/shot.mjs --film lab/nocode --scenes --json
 *
 * Without --json a tool talks to a person: progress lines on stdout, problems
 * on stderr. With --json it prints exactly ONE JSON object on stdout when it
 * finishes and nothing else there, and a failure is
 *
 *   { "error": { "code": "film-not-found", "message": "…" } }   (exit 1)
 *
 * so the caller parses one line instead of scraping log text. Progress still
 * goes to stderr, where it cannot corrupt the JSON.
 */

export function reporter(args) {
  const json = args.json !== undefined && args.json !== 'false';
  let finished = false;
  const r = {
    json,
    /** A progress line for a person. In JSON mode it goes to stderr. */
    log: (...a) => (json ? console.error(...a) : console.log(...a)),
    warn: (...a) => console.error(...a),
    /** The result. JSON mode prints it; text mode has already said it all. */
    done(result, exitCode = 0) {
      finished = true;
      if (json) process.stdout.write(JSON.stringify(result) + '\n');
      if (exitCode) process.exitCode = exitCode;
    },
    /** A failure with a stable code (kebab-case) a caller can branch on. */
    fail(code, message, exitCode = 1) {
      finished = true;
      if (json) process.stdout.write(JSON.stringify({ error: { code, message } }) + '\n');
      else console.error(message);
      process.exit(exitCode);
    },
  };
  // Anything that escapes a tool still honours the contract.
  const crash = (e) => {
    if (finished) return;
    r.fail(codeFor(e), String(e?.message ?? e));
  };
  process.on('uncaughtException', crash);
  process.on('unhandledRejection', crash);
  return r;
}

/** Map the errors the capture path throws to codes worth branching on. */
export function codeFor(e) {
  const m = String(e?.message ?? e);
  if (/window\.PK never appeared/.test(m)) return 'film-failed-to-load';
  if (/--film wants/.test(m)) return 'bad-film-name';
  if (/no Chromium found/.test(m)) return 'no-browser';
  if (/debugging port/.test(m)) return 'browser-did-not-start';
  return 'internal';
}

/** Does brands/<brand>/films/<name>.html exist? Checked up front, so a typo is
 *  a clear "film-not-found" instead of a 20-second wait for window.PK. */
export async function assertFilm(root, film, rep) {
  const { stat } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const [brand, name] = String(film ?? '').split('/');
  if (!brand || !name) rep.fail('bad-film-name', `--film wants <brand>/<name>, got "${film ?? ''}"`, 2);
  try {
    await stat(join(root, 'brands', brand, 'films', `${name}.html`));
  } catch {
    rep.fail('film-not-found', `no film at brands/${brand}/films/${name}.html`, 2);
  }
}

/**
 * The frames a check looks at: `--frames 0,4.5,9` (seconds) if given, else
 * one per scene at its middle (a rest point, past the transition in), else
 * `--n` frames spread evenly. Kinetograph's lint defaults to 8 spread out;
 * motionkit films have scene tables, and the middle of a scene is where a
 * layout bug is a bug rather than a frame of a move.
 */
export function pickTimes(args, { duration, scenes }) {
  if (args.frames) return String(args.frames).split(',').map(Number).filter((t) => Number.isFinite(t));
  if (scenes?.length && !args.n) return scenes.map((s) => +(s.t0 + (s.t1 - s.t0) / 2).toFixed(3));
  const n = Math.max(1, Number(args.n ?? 8));
  return Array.from({ length: n }, (_, i) => +(((i + 0.5) / n) * duration).toFixed(3));
}
