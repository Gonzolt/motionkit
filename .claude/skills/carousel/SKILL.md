---
name: carousel
description: Instagram and LinkedIn carousel posts (swipeable slides) as PNGs in the brand's own look, from a deck JSON — layouts cover, point, list, stat, quote, cta and image, 4:5 or 1:1, page counter and handle on every slide, rendered with the same headless Chromium as the films so a carousel and a video of one campaign match. Use for "make a carousel", "slides for Instagram", "LinkedIn document post", "turn this into swipe posts", or as the carousel step of repurpose.
---

# carousel

```bash
node tools/carousel.mjs --deck campaigns/launch/carousel.json             # → out/launch/carousel/01.png … + _sheet.png
node tools/carousel.mjs --deck campaigns/launch/carousel.json --only 0,5  # re-render two slides
```

Open one slide in the browser to iterate:
`http://localhost:5178/tools/carousel/index.html?deck=/campaigns/launch/carousel.json&i=2`.

## The deck

```json
{ "brand": "lab", "size": "1080x1350", "handle": "github.com/Gonzolt/motionkit",
  "slides": [ { "type": "cover", "kicker": "MOTIONKIT", "title": "Stop editing videos. Write them.", "sub": "…" }, … ] }
```

| Layout | Fields | Use |
|---|---|---|
| `cover` | `kicker`, `title`, `sub`, `swipe` | slide 1: the hook, in the accent colour |
| `point` | `n`, `title`, `body` | one numbered idea per slide |
| `list` | `title`, `items[]` | 3–5 short items, never more |
| `stat` | `value`, `label`, `note` | one number with its meaning (and source) |
| `quote` | `text`, `who` | a real quote with a real name |
| `image` | `title`, `src`, `caption` | a product shot or a frame from the film |
| `cta` | `title`, `button`, `sub` | last slide: one action |

Any slide may set `bg` / `fg` to a palette role. Size: `1080x1350` (4:5, the
tallest the Instagram feed shows: default) or `1080x1080`. LinkedIn takes the
same PNGs combined into a PDF (`ffmpeg` or any PDF tool; LinkedIn shows PDFs as swipeable documents).

## The look comes from the brand

`tools/carousel/slide.js` loads `brands/<brand>/theme.js` and `theme.css`, and
maps roles through `profile.json`:

- `palette`: `bg`, `fg`, `accent` (+ any extra) → token names in `theme.C`
- `type`: `display`, `head`, `body`, `label` → the brand's `typo()` roles
- titles use the brand's `disp()` face when it has one, sized down with length

A new brand needs only those two maps in its profile; no carousel code changes.

## Writing slides

- **Slide 1 is the hook** (`hook-lab` rules: ≤ 8 words, a promise the deck keeps). It decides the swipe.
- **One idea per slide**, ≤ 25 words of body. If you need more, add a slide.
- 5–8 slides: enough to reward the swipe, short enough to finish. Instagram allows up to 20 (raised from 10 in 2024).
- The last slide is the action (`cta`), and the caption repeats it.
- Numbers and quotes follow the brand's claims rule: real, with a source.
- Read the sheet (`_sheet.png`) for rhythm: dark/light alternation, no two slides that look the same.
