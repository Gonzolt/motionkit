/* The lab: a brand-less palette for motion experiments.
 *
 * Nothing here is a product. These films exist to try a technique and look at
 * it at 12 frames per second; the tokens are deliberately flat and high
 * contrast so that what you are judging is the movement, not the colour. */

export const C = {
  ink:     '#0A0A0C',
  bone:    '#EEE9DF',
  signal:  '#D7FF3A',
  cobalt:  '#3340FF',
  ember:   '#FF4D2E',
  mute:    '#8C8A84',
  panel:   '#141418',
  rule:    '#2A2A31',
};

/* Display type with the variable axes exposed: `s` is font-stretch (62–125),
   `w` weight. Animate width with css(el, 'font-variation-settings', …). */
export const FONT = { disp: "'Archivo'", mono: "'Plex Mono'" };
export const disp = (size, { w = 900, s = 100, lh = 0.86, ls = -2 } = {}) =>
  `font-family:${FONT.disp},sans-serif;font-size:${size}px;font-weight:${w};font-stretch:${s}%;` +
  `line-height:${lh};letter-spacing:${ls}px;`;
export const mono = (size, { lh = 1.25 } = {}) =>
  `font-family:${FONT.mono},monospace;font-size:${size}px;font-weight:500;line-height:${lh};`;

/* Type sizes are FRAME pixels (1080 wide), not app points. */
export const TYPO = {
  giant:  [270, 900, 0.86, -8],
  huge:   [210, 900, 0.9, -5],
  big:    [120, 800, 1.0, -2],
  line:   [64, 600, 1.2, 0],
  label:  [30, 700, 1.0, 4],
};

export const typo = (role) => {
  const [size, weight, lh, ls] = TYPO[role];
  return `font-size:${size}px;font-weight:${weight};line-height:${lh};letter-spacing:${ls}px;` +
    (role === 'label' ? 'text-transform:uppercase;' : '');
};
