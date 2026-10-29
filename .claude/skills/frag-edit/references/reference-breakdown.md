# Six reference edits, measured

Six Valorant edits downloaded from TikTok (October 2026), taken apart with
`tools/refscan.py` (1 fps sheets, 10 fps strips, 30 fps numbers) and by eye.
They are called R1–R6 here; the id is the start of the downloaded file name.
Lyrics were transcribed with faster-whisper to see which words go on screen;
only single on-screen words are quoted.

All six are **854x480, 16:9, 30 fps (one 29), AAC 44.1 kHz**: posted landscape,
letterboxed by the app. Each ends in a 4–6 s TikTok end card (dark screen,
logo, search bar) that is the platform's, not the edit's; the numbers below
stop where it starts.

## Numbers

| | R1 `v09025g4` | R2 `v12044gd` | R3 `v14025g5…cod2` | R4 `v14025g5…d759` | R5 `v24025gl…d3d5` | R6 `v24025gl…d4na` |
|---|---|---|---|---|---|---|
| Edit length | 30.8 s | 27.8 s | 19.7 s | 52.9 s | 35.4 s | 36.0 s |
| Song vocal | Japanese | little / unclear | English | English | English (rap) | little / unclear |
| Tempo (refscan) | 83 (or 166) | 79 (or 158) | 130 | 133 | 154 | 122 |
| Cuts / s | 1.72 | 1.40 | 1.52 | 1.47 | 1.27 | 0.58 |
| Median shot | 0.47 s | 0.33 s | 0.43 s | 0.10 s* | 0.40 s | 1.13 s |
| Longest shot | 2.0 s | 3.4 s | 2.3 s | 21.8 s (intro) | 4.7 s | 5.6 s |
| Burst spacing | 0.6 beat | 0.4 beat | 0.5 beat | 0.9 beat | 1.0 beat | 0.95 beat |
| Cut phase (8 bins) | spread | 3 bins | 1 bin | 2 bins | 4 adjacent bins | spread |
| Flashes | 25 | 2 | 7 | 6 | 5 | 13 |
| Worst 1 s window | **4/s** at 20.1 s | 1 | 2 | 3 | 1 | 2 |
| Monochrome total | 12.7 s | 5.3 s | 0.9 s | 1.1 s | 1.1 s | 6.2 s |
| Opens in B&W | yes | yes | no | yes | yes | yes |

\* R4's median is pulled down by a 4 s burst of 3-frame shots (43.4–47.6 s).

How to read the timing rows: cuts land "on the beat" only 8–33 % of the time
by refscan's grid, which at these tempos is close to chance. But in R3, R4 and
R5 the cuts pile into one or two phase bins and the quick cuts are spaced 0.5
or 1.0 beat: the edits *are* locked to the grid, refscan's beat 0 is off by a
fraction. R1 and R6 cut more freely and lock the *text and hits* to the vocal
instead. Treat these as shapes; confirm a specific beat in a strip.

R1 breaks the photosensitivity rule (4 flashes inside one second). Do not copy that.

## Per edit

**R1 — Japanese track, manga register.** Opens on a B&W manga panel, red
Japanese lyric word stacked three times at different sizes with a small serif
English translation in a black box under it ("unfair"). A white radial burst
with light streaks is the drop. Most of the edit is desaturated with colour
kept for the hits; manga/anime B&W inserts 0.2–1 s long return through it
(26–28 s). At 18–20 s one romanised syllable appears under the crosshair on
each kill, spelling the sung word kill by kill. Radial speed-line tunnel at
10 s. Ends on B&W hands, black hold.

**R2 — slow, cinematic, almost no type.** Soft low-contrast grade, sniper and
pistol kills held long (up to 3.4 s), whip-pan blurs hide the cuts, one
hand-drawn word ("Yeahhhh") early. A rapid section 16–24 s cuts every
0.2–0.3 s. A chibi character sticker at the start and end. The creator's
watermark sits low centre all the way through.

**R3 — one word per shot, social card portals.** Each sung word is its own
shot: the word lands in a hot colour (red, green) and settles to white in 2–3
frames. A black hold with a single purple-lit weapon (3–5 s) before a zoom
tunnel into the drop at 10 s. Twice an Instagram-style post card pops in over
the shot with a tilt, a heart pops on it, the card holds the *next* shot
inside its frame, and then flies at the camera until that shot fills the
frame (12–13 s, 18–19 s). Saturated purple/teal grade, little monochrome.

**R4 — longest, three-act.** 0–22 s is one skin-inspect shot (a knife
swinging in a sunset scene) with the lyric one word at a time in huge
condensed pink type that sits *behind* the swinging knife; letters are wiped
as the blade passes. A purple portal door is the transition into gameplay.
In gameplay the lyric word builds by syllable (RE → REA → READY) with a small
yellow script word hung off it ("you", "for?"), RGB split and motion blur on
the type; two words alternate in white and yellow. 43.4–47.6 s: the same
ability cast from about fifteen different rounds, three frames each, with the
grade drifting pink. Ends with a last word ("BACK") and a black hold.

**R5 — rap track, fastest tempo.** Opens black with a white streak, then a
katana inspect with a fire background as the intro. Kills come with purple
ink creeping in from the frame edges and a lyric word ("BOOTH") whose ghost
copy blows up and fades behind it. 24–27 s cuts on every beat (0.37–0.43 s
apart at 154 BPM). Ends with a "COUPES"-style word punched through speed lines
and a cut to black on "WON".

**R6 — editorial / magazine.** Opens with a white swirl on black. At 5–7 s the
gameplay shrinks into a phone held sideways on a white page, with giant black
type behind it, a cut-out eye strip, polaroid photos, a music-player card and
the creator's @handle: a collage, then the phone flies back to full frame.
Eyes cut-out on a white blown-out frame at 8–10 s. 21–24 s is a pure white
type page: words scattered in black, a purple marker scribble strikes one word
and the strike turns into the next word in purple. Longest shots of the six
(median 1.1 s); it breathes more than it cuts.

## What they share

1. **The song with vocals is the spine.** The on-screen text is the lyric,
   one word at a time, never a sentence. There are no clip names, kill
   counters or captions on top of it.
2. **Monochrome is a section marker.** Five of six open in B&W or near-B&W and
   go to colour on the drop; several end desaturated or on a black hold.
3. **One transition per section, and it is big**: a white burst, a zoom/speed
   tunnel, a portal, a card that swallows the frame. Inside a section, cuts
   are hard or hidden in whip blur.
4. **A burst near the end**: shots a beat, half a beat or three frames long,
   often the same move repeated from many rounds.
5. **Type is condensed, heavy, centred, with glow**; one accent style (script,
   serif-in-a-box, marker colour) per edit, not more.
6. **Each edit has one gimmick** it repeats (crosshair syllables, card
   portals, syllable builds, the scribble page). Six different gimmicks in six
   edits: the gimmick is the signature, the rest is shared grammar.
