---
name: motionkit
description: Make a film with this repo — kinetic type, transitions, camera rig and motion blur written as render(t), cut to a word-timed voiceover, with sound effects on the same cues and a music bed under it. Use for any request to make, retime, voice, score or export a motionkit film, to add effects or captions, to make social promos, carousels or post copy, to swap the voice engine (edge-tts, offline Piper, ElevenLabs), or to decide which of the picture / voice / editing / music / sound skills in this repo to load next.
---

# motionkit

A film is `brands/<brand>/films/<name>.html` plus a module exporting `render(t)`.
Headless Chromium steps through `t` one frame at a time and ffmpeg encodes it.
Picture, voice and sound all hang off one timeline: the word times.

## The one rule

`render(t)` sets every property from `t` alone. No clock, no accumulated state,
no CSS transitions, no `requestAnimationFrame`. Break it and scrubbing, strips
and motion blur (sub-frame sampling) all go wrong at once.

## Order of work

1. **Script first.** Write the lines in `brands/<brand>/audio/<film>/make_vo.py`
   as `(text, rate, gap_before)`. The gaps are the edit: a beat of silence
   before a punchline does more than any transition.
2. **Voice.** `python make_vo.py` renders one clip per line, joins them with the
   gaps, and gets word starts from faster-whisper. It writes
   `films/<film>.words.js`. Pick the engine with `TTS_ENGINE` (below).
3. **Cues.** `films/<film>.cues.js` turns word times into scene starts and hits.
   Never type seconds into a film; name scenes in `lib/scenes.js` style tables.
4. **Picture.** Build the DOM once, write `render(t)`. Check single moves with
   `node tools/strip.mjs --film <brand>/<film> --from A --to B --fps 30`, the
   whole film with `tools/shot.mjs --sheet 24`.
   Effects (grain, split, flash, leaks, sparks…) hang off the same cues:
   `film-fx`. Captions come from the same words.js: `subtitles`.
5. **Sound.** `make_sfx.py` synthesises effects on the *same* cues, so a thump
   and its camera punch land on the same frame. Then the music bed (below).
6. **Master and export.** Loudness, then `tools/export.mjs` (preview without
   `--blur`, final with `--blur 12 --shutter 0.4`).

## Voice engines

`tools/voice/tts.py` is shared by every `make_vo.py`. Same `LINES` table for
all engines; the rate string (`'+6%'`) is translated per engine.

| `TTS_ENGINE` | When | Notes |
|---|---|---|
| `edge` (default) | Fast, free, good English | Online. `pip install -U edge-tts` (>= 7.3 or HTTP 403) |
| `piper` | Offline, free, no account, Norwegian | `pip install piper-tts`. Voices download to `~/.cache/piper` on first use. See the `piper-tts` skill |
| `elevenlabs` | Best quality, emotion, cloned voice | Paid, `ELEVENLABS_API_KEY`. See `elevenlabs-text-to-speech`, `genai-voice-designer` |

```bash
TTS_ENGINE=piper TTS_VOICE=en_US-ryan-high python make_vo.py
TTS_ENGINE=piper TTS_VOICE=no_NO-talesyntese-medium python make_vo.py   # Norwegian
python tools/voice/tts.py --engine piper --list                         # all Piper voices
python tools/voice/tts.py --engine piper --rate=-10% --text "Test." --out test
```

Clips are cached per engine (`line00.mp3` edge, `line00.piper.wav`,
`line00.elevenlabs.mp3`). Delete one clip to re-render that line only. For a
non-English script also change `language='en'` in the whisper call of
`make_vo.py`, or whisper will mis-time the words.

Your own recording beats all three: drop takes in as `line00.mp3`... (edge
names) and keep `TTS_ENGINE` unset.

## Music bed

Lay it on the exported film, not inside the composition, so a level change
never costs a re-render. The i-hate-editing skill ships a sidechain ducker:

```bash
python .claude/skills/i-hate-editing/scripts/music.py out/film.mp4 bed.mp3 -o out/film-music.mp4
```

Choosing and cutting the track: `music-supervision-scoring`. Generating one:
`elevenlabs-music` (API) or `genai-music-producer` (Suno-style prompting).
Cutting picture to its beat: `beat-sync-editing`.

## Levels (measure the finished mix)

| Element | Peak | |
|---|---|---|
| Voice | -3 to -6 dBFS | the point of the film |
| Hits, whooshes | -10 to -18 dBFS | felt, not heard; never above the voice |
| Music bed | -18 to -22 dBFS | ducked further under speech |
| Room tone / texture | -20 to -30 dBFS | noticed only when removed |

Master: `ffmpeg -i mix.wav -af loudnorm=I=-14:TP=-1.5:LRA=11 mix.m4a` for
TikTok/Reels/Shorts. That is the loud end of the -16 to -14 LUFS social range
in `audio-mixing-mastering`; i-hate-editing lands talking heads at -15. Pick
-14 for music-led films, -15/-16 for speech-led. A sting can play, not clip, and still be inaudible when
the window misses its transient: see `i-hate-editing/rules/sound.md`.

**Check without listening:** run whisper on the final mix and diff it against
the script. A word that went missing is covered by an effect or the bed.

## Which skill next

| Job | Skill |
|---|---|
| Promo / ad for a product, launch video, variants to test | `social-promo` (worked example: `lab/promo` + `campaigns/launch/`) |
| The first 2–3 seconds, hook ideas and hook tests | `hook-lab` |
| Carousel / swipe posts | `carousel` |
| One topic → video, carousel and post copy for every platform | `repurpose` |
| Effects and polish: grain, glitch, flash, leaks, flare, glow, shine, sparks, shake, hit-stop, slow-mo ramps, grade | `film-fx` (catalogue film: `lab/fxlab`) |
| Gaming / Valorant edit cut to a song: lyric words, text behind the gun, card portals, bursts; analysing reference edits | `frag-edit` (catalogue film: `lab/fraglab`) |
| Captions in the film, SRT/VTT/ASS, burn-in, transcribe a clip | `subtitles` |
| Headline and title reveals, lyric videos | `kinetic-typography` (motionkit's own primitives: `lib/type.js`) |
| Grade footage, match shots, looks | `color-grading-finishing` |
| Raw talking-head footage to a finished, captioned package | `i-hate-editing` |
| Cut rhythm, J/L cuts, speed ramps, cutting to BPM | `beat-sync-editing` |
| Structure, montage, pacing of a whole piece | `editing-montage` |
| Encode, conform, loudness, deliverables | `ffmpeg-media-finishing` |
| Mix and master | `audio-mixing-mastering` |
| Sound effects plan, Foley, layering | `sound-design-foley` |
| Generate a sound effect from text | `elevenlabs-sound-effects`, prompting craft in `genai-sound-effects` |
| Music choice, edit points, licensing | `music-supervision-scoring` |
| Generate music | `elevenlabs-music`, `genai-music-producer` |
| Offline voice | `piper-tts` |
| Cloud voice, voice design, audio tags | `elevenlabs-text-to-speech`, `genai-voice-designer` |
| Transcribe with timestamps | free and local: `tools/transcribe.py` (see `subtitles`); paid with diarisation: `elevenlabs-speech-to-text` |
| Clean a noisy recording | `elevenlabs-voice-isolator` |
| Change the voice of a take, dub to another language | `elevenlabs-voice-changer`, `elevenlabs-dubbing` |
| Sounds when Claude finishes or needs you (not for films) | `agent-sounds` |
