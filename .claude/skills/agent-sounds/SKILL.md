---
name: agent-sounds
description: Play a sound (or a spoken line) when Claude Code finishes, needs permission, fails a tool or commits — so you can look away while it works. Installs a ready hook set with one sound per hook event, and renders new custom sounds or voice lines with ElevenLabs, Piper or Windows' built-in voice. Use when the user wants notification sounds, audio cues for Claude Code, a custom sound pack, or to mute/tune those sounds.
---

# Agent sounds

Two upstream projects, trimmed to the sound part:

- `hooks/` from shanraisshan/claude-code-hooks (MIT): `hooks.py` plays
  `hooks/sounds/<event>/<event>.wav` for each of 30 Claude Code hook events,
  plus `pretooluse-git-committing` on `git commit`. 37 WAVs, works on
  Windows (winsound), macOS (afplay) and Linux (paplay/aplay).
- `scripts/` from PeonPing/peon-ping (MIT): `pack-render.py` renders a sound
  effect or voice line through ElevenLabs to 44.1 kHz WAV with a silence check,
  `win-play.ps1` plays MP3/WAV at a volume on Windows, `tts-native.ps1/.sh`
  speak text with the OS voice (SAPI5 on Windows, `say` on macOS).

## Install into a project

1. Copy the folder: `.claude/skills/agent-sounds/hooks` -> `<project>/.claude/hooks`
   (`hooks.py` finds `sounds/` and `config/` relative to itself).
2. Register the events you want in `<project>/.claude/settings.json`. Start
   small: every-tool sounds get old within minutes.

```json
{
  "hooks": {
    "Stop":              [{"hooks": [{"type": "command", "command": "python \"${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/hooks.py\"", "async": true, "timeout": 5000}]}],
    "Notification":      [{"hooks": [{"type": "command", "command": "python \"${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/hooks.py\"", "async": true, "timeout": 5000}]}],
    "PermissionRequest": [{"hooks": [{"type": "command", "command": "python \"${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/hooks.py\"", "async": true, "timeout": 5000}]}],
    "StopFailure":       [{"hooks": [{"type": "command", "command": "python \"${CLAUDE_PROJECT_DIR}/.claude/hooks/scripts/hooks.py\"", "async": true, "timeout": 5000}]}]
  }
}
```

Use `python` on Windows (`python3` is often the Store stub there), `python3`
elsewhere. For every project at once, put the same block in
`~/.claude/settings.json` and point the command at `~/.claude/hooks/...`.

Mute one event without touching settings: set `"disableStopHook": true` (etc.)
in `hooks/config/hooks-config.local.json`; it overrides `hooks-config.json`.
`HOOKS-README.md` lists all 30 events and what each receives.

## Which events are worth a sound

| Event | Sound? | Why |
|---|---|---|
| `Stop` | yes | the turn is done, come back |
| `PermissionRequest`, `Notification` | yes | it is waiting on you |
| `StopFailure` | yes | rate limit or auth error, it stopped |
| `PostToolUseFailure` | maybe | useful in long unattended runs |
| `PreToolUse`, `PostToolUse` | no | fires on every tool call |
| `pretooluse-git-committing` | fun | needs `PreToolUse` registered |

## Make your own sounds

Replace a WAV with your own (same folder and file name). Keep them short
(0.3-1.5 s), peak around -6 dBFS, and distinct per event: you should know
*which* event fired without looking.

Generate one with ElevenLabs (needs `ELEVENLABS_API_KEY`):

```bash
cat > job.json <<'EOF'
{"type": "sfx", "prompt": "short bright two-note marimba chime, done", "duration_seconds": 1, "out": "stop.wav"}
EOF
python scripts/pack-render.py --job job.json          # --mock writes a test tone, no API call
```

A spoken line instead: `{"type": "tts", "text": "Job's done.", "voice_id": "<id>", "out": "stop.wav"}`.
Free and offline: render the line with Piper and convert to WAV:

```bash
python tools/voice/tts.py --engine piper --text "Job's done." --out stop   # -> stop.piper.wav
```

Design them as a set (peon-ping's pack idea): one voice or one instrument for
all events, the same loudness, and an obvious difference between "done"
(resolving, falling) and "needs you" (rising, unresolved). Prompt craft for
effects: `genai-sound-effects` and `elevenlabs-sound-effects`.

Speak an arbitrary message on Windows with no install:

```powershell
"Build finished" | powershell -File scripts/tts-native.ps1
```

## Sources

- https://github.com/shanraisshan/claude-code-hooks (MIT) - `hooks/`, `LICENSE.claude-code-hooks`
- https://github.com/PeonPing/peon-ping (MIT) - `scripts/`, `LICENSE.peon-ping`
