# Skills

Claude Code loads these automatically when it runs inside this repo. Start
with `motionkit`: it explains the film pipeline and routes to the rest.

Taken from the source repos: voice, editing, music and sound, plus two
picture skills (type, grade). `film-fx`, `subtitles` and the four Social
skills are written for this repo's own `lib/` and `tools/`. The Social set
takes its shape (shared brand profile, hook lab, carousel builder, repurpose,
variant ids fed by results) from ideas in public social-media skill packs; no
text or code was copied from them.

## Index

| Area | Skill | What it is for | From |
|---|---|---|---|
| Core | [motionkit](motionkit/SKILL.md) | Making, voicing, scoring and exporting a film in this repo; which skill next | new |
| Picture | [film-fx](film-fx/SKILL.md) | 26 effects and 6 drivers (grain to goo, beat pulse, shake, hit-stop, speed ramps), recipes, export traps; full reference in `references/effects.md` | new |
| Picture | [subtitles](subtitles/SKILL.md) | In-film captions (pop, karaoke, line), SRT/VTT/ASS, burn-in, free local transcription | new |
| Social | [social-promo](social-promo/SKILL.md) | Promo / ad videos from a brief: structure, product photos, badges, price, end card, safe zones, feed crops, variants, results loop | new |
| Social | [hook-lab](hook-lab/SKILL.md) | First 2–3 s: hook angles, scoring rubric, four-track spec, alternative openings, hook tests | new |
| Social | [carousel](carousel/SKILL.md) | Instagram / LinkedIn carousels as PNGs in the brand's look, from a deck JSON | new |
| Social | [repurpose](repurpose/SKILL.md) | One source → brief, video variants, carousel and checked post copy per platform | new |
| Picture | [kinetic-typography](kinetic-typography/SKILL.md) | Headline reveals, split-text staggers, lyric and title cards (CSS, GSAP, Remotion recipes) | iart-ai/kinetic-typography-skills |
| Picture | [color-grading-finishing](color-grading-finishing/SKILL.md) | Correction, shot matching, looks, LUTs, delivery colour for footage | calesthio/generative-media-skills |
| Voice | [piper-tts](piper-tts/SKILL.md) | Offline, free TTS (Norwegian too), used by `TTS_ENGINE=piper` | new, docs from piper1-gpl |
| Voice | [elevenlabs-text-to-speech](elevenlabs-text-to-speech/SKILL.md) | ElevenLabs TTS, models, voice settings, streaming | elevenlabs/skills |
| Voice | [genai-voice-designer](genai-voice-designer/SKILL.md) | Voice design, v3 audio tags, narration direction | AlterLab FC |
| Voice | [elevenlabs-speech-to-text](elevenlabs-speech-to-text/SKILL.md) | Transcripts with word timestamps, diarisation | elevenlabs/skills |
| Voice | [elevenlabs-voice-changer](elevenlabs-voice-changer/SKILL.md) | Speech-to-speech: your take, another voice | elevenlabs/skills |
| Voice | [elevenlabs-voice-isolator](elevenlabs-voice-isolator/SKILL.md) | Strip noise and music from a recording | elevenlabs/skills |
| Voice | [elevenlabs-dubbing](elevenlabs-dubbing/SKILL.md) | Dub a video into other languages | elevenlabs/skills |
| Voice | [elevenlabs-setup-api-key](elevenlabs-setup-api-key/SKILL.md) | Getting `ELEVENLABS_API_KEY` working | elevenlabs/skills |
| Editing | [i-hate-editing](i-hate-editing/SKILL.md) | Raw talking-head takes to a finished package: cut, captions, music, grade | ranahaani/i-hate-editing |
| Editing | [beat-sync-editing](beat-sync-editing/SKILL.md) | Cutting to the beat, J/L cuts, speed ramps, edit timelines | Gonzolt/claude-skills |
| Editing | [editing-montage](editing-montage/SKILL.md) | Structure, montage and pacing of a whole piece | Gonzolt/claude-skills |
| Editing | [ffmpeg-media-finishing](ffmpeg-media-finishing/SKILL.md) | Encode, conform, loudness, deliverables with ffmpeg | Gonzolt/claude-skills |
| Music | [music-supervision-scoring](music-supervision-scoring/SKILL.md) | Picking, cutting and placing music; licensing | Gonzolt/claude-skills |
| Music | [elevenlabs-music](elevenlabs-music/SKILL.md) | Generate music from a prompt or composition plan | elevenlabs/skills |
| Music | [genai-music-producer](genai-music-producer/SKILL.md) | Song structure, genre prompting, lyrics for AI music | AlterLab FC |
| Sound | [sound-design-foley](sound-design-foley/SKILL.md) | Sound design plan, Foley, layering, sync | Gonzolt/claude-skills |
| Sound | [audio-mixing-mastering](audio-mixing-mastering/SKILL.md) | Mix, levels, loudness targets, mastering | Gonzolt/claude-skills |
| Sound | [elevenlabs-sound-effects](elevenlabs-sound-effects/SKILL.md) | Generate a sound effect from text | elevenlabs/skills |
| Sound | [genai-sound-effects](genai-sound-effects/SKILL.md) | Prompt craft for AI sound effects and ambiences | AlterLab FC |
| Workflow | [agent-sounds](agent-sounds/SKILL.md) | Sounds when Claude Code finishes or needs you (not for films) | claude-code-hooks + peon-ping |

## Sources and licences

| Source | Licence | Taken |
|---|---|---|
| [TheSolyboy/motionkit](https://github.com/TheSolyboy/motionkit) | none stated, all rights reserved | the whole repo (this repo's history) |
| [elevenlabs/skills](https://github.com/elevenlabs/skills) | MIT | 8 skills; left out agents, realtime, speech-engine, onboarding, evals |
| [ranahaani/i-hate-editing](https://github.com/ranahaani/i-hate-editing) | MIT | skill, rules, scripts, templates, assets; left out demo media, tests, CI |
| [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl) | GPL-3.0 | usage docs only; the program installs from pip (`piper-tts`) |
| [shanraisshan/claude-code-hooks](https://github.com/shanraisshan/claude-code-hooks) | MIT | `hooks.py`, config, WAV sounds (with a Windows playback fix) |
| [PeonPing/peon-ping](https://github.com/PeonPing/peon-ping) | MIT | sound render and playback scripts; left out the packs, adapters, app |
| [AlterLab-IEU/AlterLab-FC-Skills](https://github.com/AlterLab-IEU/AlterLab-FC-Skills) via [Gonzolt/claude-skills](https://github.com/Gonzolt/claude-skills) | MIT | 3 GenAI audio skills |
| [Gonzolt/claude-skills](https://github.com/Gonzolt/claude-skills) project set | yours | 6 audio and editing skills |
| [iart-ai/kinetic-typography-skills](https://github.com/iart-ai/kinetic-typography-skills) | MIT | `kinetic-typography` (with contact-sheet scripts from the Gonzolt/claude-skills copy) |
| [calesthio/generative-media-skills](https://github.com/calesthio/generative-media-skills) via Gonzolt/claude-skills | MIT | `color-grading-finishing` |
| [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) | MIT | nothing: it has no voice, editing, music or sound skills |

Every copied folder keeps its upstream `LICENSE` where the source had one.
Skill names were prefixed (`elevenlabs-`, `genai-`) so they do not collide
with generic names; the content is unchanged apart from that, the `hooks.py`
fix noted above, and an "In this repo" note at the top of
`kinetic-typography`, `beat-sync-editing` and `elevenlabs-setup-api-key`
where the original points at skills or techniques that do not apply here.
