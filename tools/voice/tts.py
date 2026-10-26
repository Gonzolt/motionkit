#!/usr/bin/env python3
"""One TTS clip per call, from any of three engines, for voiceover scripts.

    import tts
    tts.synth('Just code.', 'line04', rate='-8%')   # -> 'line04.mp3' (edge) / 'line04.piper.wav' ...

    python3 tools/voice/tts.py --engine piper --voice no_NO-talesyntese-medium --text 'Hei.' --out hei
    python3 tools/voice/tts.py --engine piper --list            # every downloadable Piper voice

Engine from $TTS_ENGINE (default edge), voice from $TTS_VOICE (default per engine):

| engine     | runs            | cost | default voice          | install                    |
| edge       | online, MS Edge | free | en-US-BrianNeural      | pip install edge-tts       |
| piper      | local, CPU      | free | en_US-ryan-high        | pip install piper-tts      |
| elevenlabs | online          | paid | JBFqnCBsd6RMkjVDRZzb   | ELEVENLABS_API_KEY in env  |

`rate` is edge-tts syntax ('+6%', '-10%') for every engine, so a script's LINES
table does not change when the engine does. Piper turns it into length_scale,
ElevenLabs into voice_settings.speed (clamped to its 0.7-1.2 range).

The clip name carries the engine (except edge, which keeps the original
`lineNN.mp3` names) so switching engines never reuses another engine's clips.
"""
import argparse, json, os, subprocess, sys, urllib.request, wave

ENGINE = os.environ.get('TTS_ENGINE', 'edge')
DEFAULT_VOICE = {'edge': 'en-US-BrianNeural', 'piper': 'en_US-ryan-high', 'elevenlabs': 'JBFqnCBsd6RMkjVDRZzb'}
EXT = {'edge': '.mp3', 'piper': '.piper.wav', 'elevenlabs': '.elevenlabs.mp3'}
PIPER_DATA = os.environ.get('PIPER_DATA', os.path.join(os.path.expanduser('~'), '.cache', 'piper'))
# edge-tts < 7.3 gets HTTP 403 from Microsoft's endpoint; keep it current
# (pip install -U edge-tts). Override the binary with EDGE_TTS=/path/to/edge-tts.
EDGE = os.environ.get('EDGE_TTS', 'edge-tts')
ELEVEN_MODEL = os.environ.get('ELEVENLABS_MODEL', 'eleven_multilingual_v2')


def pct(rate):
    """'+6%' -> 0.06"""
    return float(str(rate).strip().rstrip('%') or 0) / 100


def voice_for(engine):
    return os.environ.get('TTS_VOICE') or DEFAULT_VOICE[engine]


def clip_path(stem, engine=None):
    return stem + EXT[engine or ENGINE]


def synth(text, stem, rate='+0%', engine=None, voice=None):
    """Render `text` to `stem` + the engine's extension and return that path.
    An existing non-empty clip is kept: delete it to re-render one line."""
    engine = engine or ENGINE
    voice = voice or voice_for(engine)
    path = clip_path(stem, engine)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    if engine == 'edge':
        subprocess.run([EDGE, '--voice', voice, f'--rate={rate}', '--text', text, '--write-media', path], check=True)
    elif engine == 'piper':
        _piper(text, path, voice, rate)
    elif engine == 'elevenlabs':
        _elevenlabs(text, path, voice, rate)
    else:
        raise SystemExit(f'unknown TTS_ENGINE {engine!r}: use edge, piper or elevenlabs')
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        if os.path.exists(path):
            os.remove(path)   # never leave a 0-byte clip behind: it would be reused next run
        raise SystemExit(f'{engine} wrote no audio for {text!r}')
    return path


_piper_voices = {}


def _piper(text, path, voice, rate):
    from piper import PiperVoice, SynthesisConfig
    if voice not in _piper_voices:
        model = voice if voice.endswith('.onnx') else os.path.join(PIPER_DATA, voice + '.onnx')
        if not os.path.exists(model):
            os.makedirs(PIPER_DATA, exist_ok=True)
            subprocess.run([sys.executable, '-m', 'piper.download_voices', voice, '--data-dir', PIPER_DATA], check=True)
        _piper_voices[voice] = PiperVoice.load(model)
    # faster speech = shorter phonemes; noise scales stay at the voice's own defaults
    cfg = SynthesisConfig(length_scale=1 / max(0.3, 1 + pct(rate)))
    with wave.open(path, 'wb') as w:
        _piper_voices[voice].synthesize_wav(text, w, syn_config=cfg)


def _elevenlabs(text, path, voice, rate):
    key = os.environ.get('ELEVENLABS_API_KEY', '').strip()
    if not key:
        raise SystemExit('ELEVENLABS_API_KEY is not set (see .claude/skills/elevenlabs-setup-api-key)')
    body = {'text': text, 'model_id': ELEVEN_MODEL,
            'voice_settings': {'stability': 0.5, 'similarity_boost': 0.75,
                               'speed': min(1.2, max(0.7, 1 + pct(rate)))}}
    req = urllib.request.Request(
        f'https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=mp3_44100_128',
        data=json.dumps(body).encode(), headers={'xi-api-key': key, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, 'wb') as f:
        f.write(r.read())


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Render one line of speech.')
    ap.add_argument('--engine', default=ENGINE, choices=list(DEFAULT_VOICE))
    ap.add_argument('--voice')
    ap.add_argument('--rate', default='+0%')
    ap.add_argument('--text')
    ap.add_argument('--out', help='output stem; the engine adds the extension')
    ap.add_argument('--list', action='store_true', help='list available voices for the engine')
    a = ap.parse_args()
    if a.list:
        cmd = {'edge': [EDGE, '--list-voices'], 'piper': [sys.executable, '-m', 'piper.download_voices']}.get(a.engine)
        if not cmd:
            raise SystemExit('ElevenLabs voices: https://elevenlabs.io/app/voice-library (use the voice_id)')
        subprocess.run(cmd, check=True)
    elif a.text and a.out:
        print(synth(a.text, a.out, a.rate, a.engine, a.voice))
    else:
        ap.error('give --text and --out, or --list')
