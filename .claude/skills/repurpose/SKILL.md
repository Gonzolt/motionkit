---
name: repurpose
description: Turn one source (a product update, article, script, transcript, release notes or a finished motionkit film) into a whole social package — a campaign brief, hook variants, a vertical promo video, a carousel, and platform-native post copy for TikTok, Reels, Instagram, LinkedIn, X threads, Threads and YouTube Shorts, all in one brand voice and checked against platform limits. Use for "repurpose this", "turn this into posts", "launch content for X", "one video into a week of posts", "write the captions", or "content plan from this update".
---

# repurpose

One topic in, a campaign folder out:

```
campaigns/<name>/
  brief.json       audience, objective, message, proof, action, hooks, messages, ctas, results
  carousel.json    the swipe deck                    → node tools/carousel.mjs --deck …
  posts.json       copy per platform                 → node tools/copycheck.mjs …
out/<name>/variants/  the promo film per variant      ← node tools/variants.mjs …
out/<name>/carousel/  the slides
```

`campaigns/launch/` is a complete worked example from one source (the motionkit README).

## Order of work

1. **Read the source and the brand.** `brands/<b>/profile.json` for voice, banned
   words and provable `claims`. Pull out: the one message, 3–5 proof points
   (facts only), the action. Anything that isn't in the source or `claims` doesn't exist.
2. **Brief.** Write `brief.json` (see `social-promo` §1). This is the contract
   every output below is checked against.
3. **Hooks.** `hook-lab`: 10–12 candidates → 3 specced hooks in the brief. The
   same hooks open the video, the carousel cover and the posts' first lines.
4. **Video.** Copy `brands/lab/films/promo.*` (or adapt an existing film) to
   read the brief; render the hook test (`social-promo` §5).
5. **Carousel.** `carousel.json` from the same message and proof: cover = best
   hook, one slide per proof point, `cta` last. Render it (`carousel`).
6. **Posts.** `posts.json`, one entry per platform, then
   `node tools/copycheck.mjs campaigns/<c>/posts.json` until it passes clean.
7. **Captions file** for the video (`subtitles`), upload it with the post.

## Platform copy

The video is the same everywhere; the words around it are not.

| Platform | Field | Shape | Notes |
|---|---|---|---|
| TikTok | `caption` | one line + 3–5 tags | the video carries it; the caption is a nudge |
| Reels / Instagram | `caption` | hook line (≤ 125 chars), 2–4 short lines, CTA, tags | first line shows before "more" |
| Instagram carousel | `caption` | promise of the swipe + CTA | "Swipe for…" and the action |
| LinkedIn | `text` | first person, a claim, short paragraphs or a 3-item list, link last | no hashtag walls (≤ 3) |
| X | `thread[]` | 2–4 posts ≤ 280 chars, first one stands alone | link in the last post |
| Threads | `text` | ≤ 500 chars, conversational | |
| YouTube Shorts | `title`, `description` | title ≤ 100 (aim < 70), description with the link | |

`copycheck` enforces the hard limits (errors) and warns on: a first line past
the fold, hashtag counts (Instagram may cap at 5: reports since Dec 2025),
the profile's `words_avoid`, more than one "!", emoji walls. Limits drift:
the table in `tools/copycheck.mjs` is dated; check the app when it matters.

## Voice across formats

- Same claim, same numbers, same CTA wording everywhere. Different length, not different message.
- Write for the reader of that feed: LinkedIn reads "I built / we learned", TikTok reads "watch this", X reads "here's the thing".
- Never paste the same caption to every platform; never invent a stat to fill a slide.
- Link placement: TikTok/Instagram "link in bio" (the sticker says so), LinkedIn/X/YouTube the link itself.

## A week from one source

| Day | Post | From |
|---|---|---|
| 1 | Hook-test video (3 variants as separate posts or ad variants) | `variants.mjs` |
| 2 | Carousel | `carousel.mjs` |
| 3 | LinkedIn text post | `posts.json` |
| 4 | Winning hook, second message (M2) | `--only H?-M2-C1` |
| 5 | X thread + Short | `posts.json` |
| 7 | Results into `brief.results`; next round of hooks | `hook-lab` |
