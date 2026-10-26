/* The scene table, and why no timing in this kit is ever written in seconds.
 *
 * Absolute seconds work fine until the first time a beat moves. Then they are
 * a treasure hunt across five files, and one missed constant is a beat that
 * fires at the wrong moment with nothing on screen to say why. Retiming should
 * be editing the scene table and NOTHING else.
 *
 *   export const { SCENES, T, Tend, at, DURATION } = film([
 *     ['hook',  0,   2.4, 'The hook'],
 *     ['plate', 2.4, 5.2, 'The product'],
 *   ]);
 *
 *   const PLATE_SNAP = [T('plate', 0.55), T('plate', 0.8)];   // yes
 *   const PLATE_SNAP = [2.95, 3.2];                           // no
 *
 * For a film cut to music, build the table with `scenes()` from beatgrid.js
 * instead and hand the result to `fromScenes()` — the bar numbers survive, and
 * changing the BPM re-snaps every beat in the film without a number being
 * edited anywhere.
 */

/** Build a scene table from `[id, t0, t1, caption?]` rows. */
export function film(rows) {
  const SCENES = rows.map(([id, t0, t1, cap]) => ({ id, t0, t1, cap }));
  return fromScenes(SCENES);
}

/** Wrap an already-built scene table (e.g. from beatgrid's `scenes()`). */
export function fromScenes(SCENES) {
  const byId = new Map(SCENES.map((s) => [s.id, s]));

  for (let i = 0; i < SCENES.length; i++) {
    const s = SCENES[i];
    if (s.t1 <= s.t0) throw new Error(`scene "${s.id}" ends before it starts`);
    // A gap is almost always a typo, and it shows up as a frozen second in the
    // middle of the film that nobody can find in the code.
    if (i && Math.abs(SCENES[i - 1].t1 - s.t0) > 1e-6) {
      throw new Error(`gap or overlap between "${SCENES[i - 1].id}" (ends ${SCENES[i - 1].t1}) and "${s.id}" (starts ${s.t0})`);
    }
  }

  const at = (id) => {
    const s = byId.get(id);
    if (!s) throw new Error(`no scene "${id}" — the table has: ${SCENES.map((x) => x.id).join(', ')}`);
    return s;
  };

  /** Seconds, `off` into scene `id`. */
  const T = (id, off = 0) => at(id).t0 + off;
  /** Seconds, `off` BEFORE the end of scene `id` — for beats that land late. */
  const Tend = (id, off = 0) => at(id).t1 + off;
  /** A window covering the whole scene, for `win()` and `ramp()`. */
  const span = (id) => [at(id).t0, at(id).t1];

  const DURATION = SCENES[SCENES.length - 1].t1;

  /** Captions, ready for `captionAt()`, from the `cap` field of each scene. */
  const captions = ({ lead = 0.15, hold = 1.9 } = {}) =>
    SCENES.filter((s) => s.cap).map((s) => ({
      from: s.t0 + lead,
      to: Math.min(s.t0 + lead + hold, s.t1),
      text: s.cap,
    }));

  return { SCENES, byId, at, T, Tend, span, DURATION, captions };
}
