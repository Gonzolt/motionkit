---
name: social-promo
description: Promo and ad videos for TikTok, Reels and Shorts with motionkit — from a campaign brief (audience, objective, message, proof, action) through hook → message → product → proof → CTA structure, product photos with Ken Burns, badges, price tags, rating stars, lower thirds, "link in bio" stickers and the end card, platform safe zones and feed crops (4:5, 1:1), to rendering every hook / message / CTA variant with an id and tracking results. Use for "make a promo", "ad for my product", "launch video", "social post for X", "UGC-style ad", "variants to A/B test", "end card", "price drop video", or any non-gaming promotional short. Hooks: hook-lab. Carousels: carousel. One topic into many posts: repurpose.
---

# social-promo

One campaign = one brief = many outputs. The brief holds the words; the film
holds the look; the URL picks the variant. Worked example, all of it real:

| File | What |
|---|---|
| `brands/lab/profile.json` | Brand VOICE: audience, tone, do/don't, banned words, handles, hashtags, provable claims, colour/type roles |
| `campaigns/launch/brief.json` | The campaign: audience, objective, message, proof, action, hooks, messages, CTAs, results |
| `brands/lab/films/promo.js` | 15 s promo reading the brief; `?v=H2-M1-C1` picks the variant |
| `lib/promo.js` | Pieces: photo + `kenBurns`, `badge`, `price`, `stars`, `lowerThird`, `sticker`, `endCard`; `SAFE`, `CROPS`, `variant()`, `variantIds()` |
| `tools/variants.mjs` | Renders every variant (frames or mp4) with a manifest |

`theme.js` owns the look, `profile.json` the voice, `brief.json` the campaign.
Never put campaign words in the film code: the next campaign reuses the film.

## 1. The brief first

Fill these before any picture (copy `campaigns/launch/brief.json`):

| Field | Answer in one line | Bad sign |
|---|---|---|
| `audience` | who, and the pain they already feel | "everyone" |
| `objective` | the one number this moves (stars, sign-ups, sales, follows) | three objectives |
| `message` | the single sentence they should repeat | a feature list |
| `proof` | facts a viewer could check | adjectives |
| `action` | the one thing to do next | "learn more" + "follow" + "buy" |

**Claims rule:** anything on screen is in `profile.json` → `claims` with its
proof, or it does not go on screen. No invented numbers, reviews, ratings,
testimonials, "as seen in", or before/after that did not happen. `makeStars`
is for ratings that exist (a store average with its source), never decoration.

## 2. Structure (15 s; scale for 7, 30, 60)

| Beat | Time | Job | Pieces |
|---|---|---|---|
| Hook | 0–2.4 s | stop the scroll, muted | one of the brief's hooks (`hook-lab`) |
| Message | 2.4–5 s | the one sentence | kinetic type, `lowerThird` for who's talking |
| Product | 5–9 s | show it working | `makePhoto` + `kenBurns`, phone frame, `shine`, `badge` |
| Proof | 9–11.8 s | why believe it | `countTo` stats, `stars` (real only), quote, logo row |
| CTA | 11.8–15 s | one action | `endCard` + `sticker` |

- 7 s: hook → product → CTA. 30 s: two product beats and two proofs. 60 s: a story (problem → attempt → fix).
- **Captions on** for anything spoken (`subtitles`): most people scroll with the sound off.
- **One idea per beat.** If a beat needs two lines of text, it is two beats.
- **Loop the end into the start** when the platform loops (TikTok): the last frame should cut cleanly into frame one.

## 3. Pieces (`lib/promo.js`)

| Piece | Call | Notes |
|---|---|---|
| Product photo | `makePhoto(layer, src, {x, y, w, hgt, radius, fit})` → `kenBurns(box, p, {from, to})` | 1.0 → 1.12 over the beat; never below 1.0 |
| Badge | `makeBadge(layer, 'NEW', {shape: 'burst'|'circle'|'pill', bg, fg, type})` → `badge(el, t, t0)` | lands with overshoot + tilt, then a slow wobble |
| Price | `makePrice(layer, {now, was, colour, strike, type, small})` → `price(P, t, t0)` | old price struck, new lands 0.25 s later |
| Stars | `makeStars(layer, 4.6, {colour})` → `stars(S, t, t0)` | fractional fill; **real ratings only** |
| Lower third | `makeLowerThird(layer, title, sub, {bar, type, small})` → `lowerThird(L, t, t0, t1)` | bar grows, lines rise from masks |
| Sticker | `makeSticker(layer, 'LINK IN BIO ↓', {bg, fg})` → `sticker(el, t, t0)` | nudges every 1.2 s, never strobes |
| End card | `makeEndCard(layer, {logo, headline, cta, handle, …, top})` → `endCard(K, t, t0)` | logo, one line, the button, the handle |

Effects that suit promo: `shine`, `glow`, `dust`, `spotlight`, gentle `grain`,
`leaks` on cuts (see `film-fx` recipes "product reveal" and "brand / calm").
Shake, glitch and flashes only if the brand is loud.

## 4. Safe zones and formats

`SAFE` in `lib/promo.js` holds each platform's ad-safe box on 1080x1920, and
`SAFE.all` the area clear on TikTok, Reels and Shorts together
(x 120–888, y 288–1248). **Design to `SAFE.all`** when one film goes
everywhere; centre text on its column (`(left + right) / 2` = 504), not on 540.
Open the film with `?guides` to see the box and the feed crops.

| Output | How |
|---|---|
| 9:16 TikTok / Reels / Shorts | the export |
| 4:5 feed (1080x1350) | `ffmpeg -i in.mp4 -vf crop=1080:1350:0:285 -c:v libx264 -crf 18 -pix_fmt yuv420p out.mp4` |
| 1:1 feed | `crop=1080:1080:0:420` |
| 16:9 YouTube | a separate layout: crops cannot make it |
| Carousel | `carousel` skill |

Everything inside `SAFE.all` is automatically inside the 4:5 crop.
Sources for the numbers disagree by tens of px and apps change: preview the
real upload (drafts / ad preview) before trusting a pixel.

## 5. Variants

Ids are `H<n>-M<n>-C<n>` (hook, message, CTA). The film calls
`variant(BRIEF)` and reads `V.hook.onscreen`, `V.message.line`, `V.cta.button`.

```bash
node tools/variants.mjs --film lab/promo --brief campaigns/launch/brief.json --shots          # hook test, frames (seconds)
node tools/variants.mjs --film lab/promo --brief campaigns/launch/brief.json --fps 30         # hook test, mp4s
node tools/variants.mjs --film lab/promo --brief campaigns/launch/brief.json --matrix --shots # every combination
node tools/variants.mjs --film lab/promo --brief campaigns/launch/brief.json --only H2-M1-C1 --fps 30 --audio mix.m4a
```

- **Test hooks first** (default): same body, different first 2.4 s. The hook
  decides whether anyone sees the rest; messages and CTAs only matter after.
- Name every upload with its id; `out/<campaign>/variants/manifest.csv` maps id → words → file.
- Hard cuts between beats (they are the variant seams); keep audio cues on the same beats in every variant.

## 6. Results back into the brief

After a few days, add what the platform reports to `brief.results`:

```json
{ "id": "H2-M1-C1", "platform": "tiktok", "days": 3, "views": 8200, "hold_3s": 0.41, "avg_watch_s": 6.3, "ctr": 0.012, "notes": "comments ask how the code part works" }
```

Read it in this order: **3-second hold** (the hook works?) → **average watch**
(the body holds?) → **CTR / action** (the ask works?). Keep the winning hook's
*angle*, write three new hooks around it (`hook-lab`), change one thing at a
time. Comments are free research: the questions people ask become the next hooks.

## 7. Before posting

1. `node tools/variants.mjs … --shots` and look at every hook's first frames.
2. `node tools/shot.mjs --url "http://127.0.0.1:5179/brands/<b>/films/<f>.html?export&v=<id>&guides" --serve 5179 --sheet 12`: nothing important outside the box.
3. Every claim on screen has its proof in `profile.json`.
4. Captions on and readable; music licensed for commercial use (`music-supervision-scoring`; TikTok ads need the Commercial Music Library or your own track).
5. Post copy checked: `node tools/copycheck.mjs campaigns/<c>/posts.json` (`repurpose`).
