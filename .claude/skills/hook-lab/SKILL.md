---
name: hook-lab
description: Write, score and build the first 2–3 seconds of a short video — generate hook candidates across proven angles (contrarian, demo-first, number, pain, before/after, question, POV, social proof, curiosity gap), rank them on a rubric, spec the winners as four tracks (visual, on-screen text, voice line, sound), add them to the campaign brief as H1/H2/H3, build each as an alternative opening in a motionkit film, render them side by side and iterate from results. Use for "write hooks", "better opening", "first 3 seconds", "why do people scroll past", "hook variants", "A/B test the intro", or before any promo or social video.
---

# hook-lab

The hook is the only part every viewer sees. Same film, different first 2.4 s
is the cheapest test there is. Output lands in `campaigns/<c>/brief.json` →
`hooks`, and the film builds one opening per hook (see `lab/promo`).

## 1. Inputs

Read the brief (`audience`, `message`, `proof`, `action`) and the brand
profile (`voice`, `claims`). A hook may only promise what the body delivers
and what `claims` can prove. No proof, no hook.

## 2. Generate 10–12 candidates across angles

At least five different angles; never ten versions of one.

| Angle | Formula | Example (motionkit) |
|---|---|---|
| Contrarian | "Stop doing X" / "X is wrong" | STOP EDITING VIDEOS |
| Demo-first | show the result, then the claim | THIS VIDEO IS CODE |
| Number | "0 X. 1 Y." / "3 things…" | 0 TIMELINES. 1 FUNCTION. |
| Pain | name the pain in their words | 4 HOURS ON A 15 SECOND VIDEO? |
| Before / after | the old way, cut, the new way | timeline chaos → one function |
| Question | a question they already ask | WHAT IF VIDEOS WERE CODE? |
| POV | "POV: you …" | POV: YOUR EDITOR IS A TEXT FILE |
| Social proof | a real result, with source | only with a real number in `claims` |
| Curiosity gap | open a loop the body closes | THE LAST FRAME IS THE PROOF |
| Pattern break | something visually wrong for the feed | a timeline that deletes itself |

Write each candidate as on-screen text first (≤ 6 words, readable in 1 s
muted), then the voice line (≤ 2 s spoken), then the visual, then the sound.

## 3. Score and keep three

Score 1–5 on each; keep the top three **from different angles**.

| Criterion | 5 means |
|---|---|
| Stop power | muted, in 1 s, it is clearly not another ad |
| Clarity | the audience knows what this is about by 2 s |
| Relevance | it names their pain or their goal, not ours |
| Truth | the body pays it off and `claims` proves it |
| Visual-ability | it is a picture, not a sentence |
| Brand fit | sounds like `profile.voice` |

Record `score` as the mean. Ties go to the more visual one.

## 4. Spec the winners (the four tracks)

```json
{ "id": "H2", "angle": "demo-first", "formula": "Show the result before the claim",
  "onscreen": "THIS VIDEO IS CODE", "vo": "This video is code.",
  "visual": "The finished frame first, then it slides aside to reveal the render(t) that draws it",
  "sound": "whoosh on the slide", "score": 4.5 }
```

- **onscreen**: what is read muted. Big, inside `SAFE.all`, in by 0.25 s.
- **vo**: what is heard; may differ from onscreen but never contradicts it.
- **visual**: the motion, in one sentence a film can be built from.
- **sound**: the one cue that lands with the visual beat (`sound-design-foley`).
- First frame matters: it is the thumbnail in many feeds. No black or empty frame 0.

## 5. Build them as openings

In the film, build every hook's DOM once and show the chosen one:

```js
const V = variant(BRIEF);                  // ?v=H2-M1-C1
css(h1, 'display', V.hook.id === 'H1' ? 'block' : 'none');
```

Rules: every hook ends at the same time (the scene table's `hook` row) and
hands over to the same next beat, so only the hook differs. Text comes from
`V.hook.onscreen`, never typed into the film.

## 6. Compare

```bash
node tools/variants.mjs --film lab/promo --brief campaigns/launch/brief.json --shots --at 0.2,0.8,1.6,2.3
```

Look at the frames as a grid, hook per row: is each readable at 0.8 s? Does
frame 0.2 already say something? Then export the hook test (`--fps 30`) and
post the three as separate posts or ad variants with their ids.

## 7. Iterate

From `brief.results`: a hook with a weak 3-second hold failed, whatever
happened later. Keep the winning **angle**, write three new hooks in it, and
one wild card from an angle not tried yet. Comments and replies are the best
hook source: a question people ask is a hook people want answered.
