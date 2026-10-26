#!/usr/bin/env python3
"""Voiceover for lab/nocode: one TTS clip per line, assembled with chosen gaps,
then word timestamps from faster-whisper so the film can cut on the words.

    python3 make_vo.py                      # writes vo.wav, words.json, ../../films/nocode.words.js
    TTS_ENGINE=piper python3 make_vo.py     # same, rendered offline with Piper (tools/voice/tts.py)

The pauses are the edit. TTS reads a paragraph at one even pace; the reference
style lives on hard stops ("No way." ... beat ... "Okay. Okay."), so every line
is its own clip and the silence between them is set here, by hand.
"""
import asyncio, json, os, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', 'tools', 'voice'))
import tts  # noqa: E402

VOICE = tts.voice_for(tts.ENGINE)   # en-US-BrianNeural on the default edge engine
SR = 48000

# (text, rate, gap BEFORE this line in seconds)
LINES = [
    ('No way.',                                   '-5%',  0.45),
    ('Okay. Okay.',                               '+0%',  0.55),
    ('This video? No After Effects.',             '+6%',  0.45),
    ('No video model. Not one generated image.',  '+8%',  0.30),
    ('Just code.',                                '-8%',  0.35),
    ('Every frame is a function of time.',        '+4%',  0.55),
    ('Now watch the letters stretch.',            '+0%',  0.45),
    ('Follow the camera,',                        '+0%',  0.40),
    ('and wait for the transition.',              '+0%',  0.25),
    ('Layers. Keyframes. Graph editor. Render.',  '+10%', 0.70),
    ('Nope.',                                     '-10%', 0.25),
    ('Write. Render. Look. Fix.',                 '+0%',  0.55),
    ('Made with code. Nothing else.',             '-4%',  0.55),
]
TAIL = 1.6


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    # trim TTS padding so the gaps above are the real gaps
    idx = np.where(np.abs(a) > 0.01)[0]
    return a[max(0, idx[0] - 480): idx[-1] + 1200] if len(idx) else a


async def main():
    parts, lines = [], []
    t = 0.0
    for i, (text, rate, gap) in enumerate(LINES):
        p = tts.synth(text, os.path.join(HERE, f'line{i:02d}'), rate, voice=VOICE)
        a = decode(p)
        parts.append(np.zeros(int(gap * SR), np.float32))
        t += gap
        lines.append({'i': i, 'text': text, 'start': round(t, 3), 'end': round(t + len(a) / SR, 3)})
        parts.append(a)
        t += len(a) / SR
    parts.append(np.zeros(int(TAIL * SR), np.float32))
    vo = np.concatenate(parts)
    vo = vo / max(1e-6, np.abs(vo).max()) * 0.89
    with wave.open(os.path.join(HERE, 'vo.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((vo * 32767).astype(np.int16).tobytes())
    dur = len(vo) / SR

    # word timestamps, per line (whisper on short known clips is near-exact,
    # and it cannot drift across the whole track)
    from faster_whisper import WhisperModel
    model = WhisperModel('small', device='cpu', compute_type='int8')
    words = []
    for L in lines:
        # 0.3 s of silence each side. Without it (and with initial_prompt) whisper
        # hallucinated "Thank you for watching." over a clean line.
        PAD = 0.3
        a = vo[int(L['start'] * SR): int(L['end'] * SR)][::3]  # 48k -> 16k
        pad = np.zeros(int(PAD * 16000), np.float32)
        norm = lambda x: ''.join(c for c in x.lower() if c.isalnum())
        truth = L['text'].split()
        ws = None
        # Plain first; then with the script as a prompt. Short exclamations ("Okay.
        # Okay.") get misheard without context, long lines hallucinate WITH it.
        # The script is known, so what we need from whisper is only WHEN: accept a
        # pass whose word count matches and label the words from the script.
        for prompt in (None, L['text']):
            segs, _ = model.transcribe(np.concatenate([pad, a, pad]), beam_size=5, word_timestamps=True,
                                       language='en', initial_prompt=prompt)
            got = [w for s in segs for w in (s.words or [])]
            heard = ''.join(w.word for w in got).strip()
            if norm(heard) == norm(L['text']) or len(got) == len(truth):
                ws, L['heard'] = got, heard
                break
        if ws is None:
            raise SystemExit(f"whisper could not place the words of {L['text']!r}")
        for w, word in zip(ws, truth):
            w.word = word
        for w in ws:
            words.append({'line': L['i'], 'w': w.word.strip(),
                          's': round(L['start'] + max(0, w.start - PAD), 3),
                          'e': round(L['start'] + max(0, w.end - PAD), 3)})
    json.dump({'duration': round(dur, 3), 'lines': lines, 'words': words},
              open(os.path.join(HERE, 'words.json'), 'w'), indent=1)
    js = os.path.join(HERE, '..', '..', 'films', 'nocode.words.js')
    with open(js, 'w') as f:
        f.write('/* GENERATED by brands/lab/audio/nocode/make_vo.py: do not edit. */\n')
        f.write(f'export const VO = {json.dumps({"duration": round(dur, 3), "lines": lines, "words": words})};\n')
    for L in lines:
        print(f"{L['start']:6.2f}-{L['end']:6.2f}  {L['text']:<44} heard: {L['heard']}")
    print(f'duration {dur:.2f} s, {len(words)} words')


asyncio.run(main())
