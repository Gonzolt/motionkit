---
name: piper-tts
description: Offline, free text-to-speech with Piper (OHF-Voice/piper1-gpl) — local neural voices in 40+ languages including Norwegian, no account or API key, runs on CPU. Use when a voiceover must be rendered locally, without paying, without sending the script anywhere, in Norwegian, or when edge-tts is failing; also for phoneme-level timing (alignments) and running Piper as a local HTTP server.
---

# Piper TTS

Piper is a fast local neural TTS (VITS models exported to ONNX). One voice is
one `.onnx` file plus its `.onnx.json` config, 20-120 MB. Quality sits below
ElevenLabs and roughly level with edge-tts; it is fully offline and free.

The program is GPL-3.0 and comes from pip, it is not vendored here. The
upstream docs are in `references/` (with `COPYING`).

## Install

```bash
pip install piper-tts              # 1.8+; pulls onnxruntime, no torch
pip install "piper-tts[alignment]" # only if you need phoneme alignments
```

Windows works natively (tested with Python 3.13). GPU: `pip install
onnxruntime-gpu` and load with `use_cuda=True`; CPU is already faster than
real time for short lines, so it is rarely worth it.

## In motionkit

`tools/voice/tts.py` wraps it. Voices download on first use to `$PIPER_DATA`
(default `~/.cache/piper`).

```bash
TTS_ENGINE=piper python brands/lab/audio/nocode/make_vo.py
python tools/voice/tts.py --engine piper --voice no_NO-talesyntese-medium --text "Hei." --out hei
```

`rate` (`'+6%'`) becomes `length_scale = 1 / (1 + 0.06)`. Note `--rate=-10%`
needs the `=` on the command line.

## Choosing a voice

Names are `<lang>_<REGION>-<name>-<quality>`; quality is `x_low`, `low`,
`medium` or `high`. Listen first: https://rhasspy.github.io/piper-samples

| Need | Voice |
|---|---|
| English male narrator (default here) | `en_US-ryan-high` |
| English female, clean | `en_US-lessac-high`, `en_US-amy-medium` |
| English, British | `en_GB-alan-medium`, `en_GB-cori-high` |
| Norwegian (Bokmål) | `no_NO-talesyntese-medium`, `no_NO-nvcc-medium` |
| Many speakers in one file | `en_US-libritts_r-medium` (pick with `speaker_id`) |

`python -m piper.download_voices` lists every voice.

## Python API

```python
import wave
from piper import PiperVoice, SynthesisConfig

voice = PiperVoice.load("en_US-ryan-high.onnx")
cfg = SynthesisConfig(length_scale=1.1)   # unset knobs use the voice's own defaults
with wave.open("out.wav", "wb") as w:
    voice.synthesize_wav("Just code.", w, syn_config=cfg)
```

| Knob | Effect |
|---|---|
| `length_scale` | > 1 slower, < 1 faster. 0.85-1.15 stays natural |
| `noise_scale` | variation in tone; lower = flatter, higher = livelier but riskier |
| `noise_w_scale` | variation in rhythm |
| `speaker_id` | which speaker in a multi-speaker voice |
| `normalize_audio=False` | keep the raw level (default normalises) |

## Making it sound less like TTS

- **One clip per line**, joined with hand-set gaps (that is what `make_vo.py`
  does). Piper reads a paragraph at one even pace; the pauses are the edit.
- Short sentences. Piper's prosody is per sentence, so a full stop is your
  strongest control. Write "Layers. Keyframes. Render." not a comma list.
- Fix a mispronounced word with raw phonemes: `I am [[ bˈætmæn ]]`. Get
  phonemes from `espeak-ng -v en-us --ipa=3 -q batman`.
- Numbers, brands and acronyms: spell them how they are said ("motion kit",
  "A I", "twenty twenty-six").
- Output is 22.05 kHz mono. `make_vo.py` resamples to 48 kHz; for anything
  else, resample once before mixing.

## Timing

For word starts use whisper on each short clip (as `make_vo.py` does): the
script is known, so whisper only supplies *when*. For lip-sync or per-phoneme
timing, load with `include_alignments=True` and read
`chunk.phoneme_alignments` from `voice.synthesize(...)` (see
`references/ALIGNMENTS.md`).

## Server

Loading a voice costs ~1 s; the CLI pays it on every call. For many lines in
another tool, `pip install "piper-tts[http]"`, run
`python -m piper.http_server -m en_US-ryan-high` (port 5000, with a test page)
and POST text to it (`references/API_HTTP.md`).

## Sources

- https://github.com/OHF-Voice/piper1-gpl (GPL-3.0), docs copied to `references/`
