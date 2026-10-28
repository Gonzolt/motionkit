#!/usr/bin/env node
/* Sidecar subtitles from the same word times the film is cut to.
 *
 *   node tools/subs.mjs --words brands/lab/films/nocode.words.js --srt out/nocode.srt
 *   node tools/subs.mjs --words clip.words.json --vtt out/clip.vtt --ass out/clip.ass --accent "#D7FF3A"
 *   node tools/subs.mjs --words clip.words.json --ass out/clip.ass --preset karaoke --font Archivo --size 84
 *
 * The breaks come from lib/captions.js chunk(), so a burned-in caption and the
 * uploaded SRT never disagree. SRT/VTT are for the platform's own caption
 * track (searchable, can be switched off, translatable); ASS is for burning
 * captions into footage motionkit did not draw:
 *
 *   ffmpeg -i clip.mp4 -vf "ass=out/clip.ass" -c:a copy clip-captioned.mp4
 *
 * Options: --max-words 3  --late 0.08  --no-emph  --emph "Claude,AE"  --upper
 *          --res 1080x1920  --y 1380 (caption centre, frame px)
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from './browser.mjs';
import { chunk } from '../lib/captions.js';

/** words.js (`export const VO = …`) or words.json → { duration, words }. */
export async function loadWords(file) {
  const abs = resolve(file);
  if (abs.endsWith('.js')) {
    const m = await import(pathToFileURL(abs).href);
    return m.VO ?? Object.values(m)[0];
  }
  return JSON.parse(await readFile(abs, 'utf8'));
}

const pad = (n, w = 2) => String(n).padStart(w, '0');
function stamp(sec, sep) {
  const ms = Math.max(0, Math.round(sec * 1000));
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
}
/* ASS wants centiseconds and a single-digit hour. */
function assStamp(sec) {
  const cs = Math.max(0, Math.round(sec * 100));
  return `${Math.floor(cs / 360000)}:${pad(Math.floor(cs / 6000) % 60)}:${pad(Math.floor(cs / 100) % 60)}.${pad(cs % 100)}`;
}

export const toSrt = (chunks) =>
  chunks.map((c, i) => `${i + 1}\n${stamp(c.s, ',')} --> ${stamp(c.e, ',')}\n${c.text}\n`).join('\n');

export const toVtt = (chunks) =>
  'WEBVTT\n\n' + chunks.map((c) => `${stamp(c.s, '.')} --> ${stamp(c.e, '.')}\n${c.text}\n`).join('\n');

/** "#RRGGBB" → ASS "&H00BBGGRR". */
function assColour(hex) {
  const v = hex.replace('#', '');
  return `&H00${v.slice(4, 6)}${v.slice(2, 4)}${v.slice(0, 2)}`.toUpperCase();
}

/**
 * ASS with the emphasis word in the accent and bigger. `karaoke` lights each
 * word in the accent as it is spoken (\k timing, rendered by libass).
 */
export function toAss(chunks, { res = [1080, 1920], y = 1380, font = 'Arial', size = 84, colour = '#FFFFFF',
  accent = '#FFFFFF', preset = 'pop', upper = false, emphScale = 1.25 } = {}) {
  const [W, H] = res;
  const marginV = Math.round(H - y - size / 2);
  // libass draws a \k word in SecondaryColour until it is spoken, then PrimaryColour.
  const [prim, sec] = preset === 'karaoke' ? [accent, colour] : [colour, accent];
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,${font},${size},${assColour(prim)},${assColour(sec)},&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,5,3,2,90,210,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const big = `{\\fscx${Math.round(emphScale * 100)}\\fscy${Math.round(emphScale * 100)}\\c${assColour(accent)}}`;
  const lines = chunks.map((c) => {
    const words = c.words.map((x, i) => {
      const w = (upper ? x.w.toUpperCase() : x.w).replace(/[{}]/g, '');
      if (preset === 'karaoke') {
        // \k counts in centiseconds from the line start: word i lights when spoken
        const until = (c.words[i + 1]?.s ?? x.e) - x.s;
        const lead = i === 0 ? `{\\k${Math.max(0, Math.round((x.s - c.s) * 100))}}` : '';
        return `${lead}{\\k${Math.max(1, Math.round(until * 100))}}${w}`;
      }
      return i === c.emph ? `${big}${w}{\\r}` : w;
    });
    return `Dialogue: 0,${assStamp(c.s)},${assStamp(c.e)},Cap,,0,0,0,,${words.join(' ')}`;
  });
  return head + lines.join('\n') + '\n';
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.words || !(a.srt || a.vtt || a.ass)) {
    console.error('need --words <file.words.js|.json> and at least one of --srt --vtt --ass <out>');
    process.exit(2);
  }
  const vo = await loadWords(a.words);
  const chunks = chunk(vo.words, {
    ...(a['max-words'] ? { maxWords: Number(a['max-words']) } : {}),
    ...(a.late ? { late: Number(a.late) } : {}),
    emphasis: a['no-emph'] ? false : a.emph ? String(a.emph).split(',') : null,
  });
  const write = async (p, s) => { await mkdir(dirname(resolve(p)), { recursive: true }); await writeFile(p, s, 'utf8'); console.log(`wrote ${p}`); };
  if (a.srt) await write(a.srt, toSrt(chunks));
  if (a.vtt) await write(a.vtt, toVtt(chunks));
  if (a.ass) {
    await write(a.ass, toAss(chunks, {
      res: String(a.res ?? '1080x1920').split('x').map(Number),
      y: Number(a.y ?? 1380), font: a.font ?? 'Arial', size: Number(a.size ?? 84),
      colour: a.colour ?? '#FFFFFF', accent: a.accent ?? '#FFFFFF', preset: a.preset ?? 'pop', upper: !!a.upper,
    }));
  }
  console.log(`${chunks.length} captions, ${vo.words.length} words`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
