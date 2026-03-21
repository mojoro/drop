# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Drop** — open-source, self-hostable podcast generator. Paste a URL or topic, pick voices, get a two-host podcast episode. Runs fully local or with cloud backends.

## Commands

```bash
npm run dev       # Start Next.js dev server (localhost:3000)
npm run build     # Production build (uses standalone output for Docker)
npm run lint      # ESLint

# TTS sidecar (separate terminal)
cd tts-server && uv run uvicorn main:app

# Docker (both services)
docker compose up
```

Test files run directly with `tsx` (no test runner):

```bash
npx tsx tests/script.test.ts
npx tsx tests/test-scrape.ts
```

## Environment Variables

All optional — set at least one LLM backend. Keys can also be configured via encrypted Settings profiles in the UI.

```
OLLAMA_MODEL=              # e.g. qwen3.5:4b — enables local LLM
OLLAMA_URL=                # defaults to http://localhost:11434
OPENROUTER_API_KEY=        # cloud LLM (many models)
FEATHERLESS_API_KEY=       # cloud LLM
ANTHROPIC_API_KEY=         # Claude Haiku 4.5 fallback

ELEVENLABS_API_KEY=        # cloud TTS
OPENAI_API_KEY=            # cloud TTS (OpenAI voices)

NEEDLE_API_KEY=            # optional scraping — built-in Readability used by default
TTS_SERVER_URL=            # defaults to http://localhost:8000
DROP_ENCRYPTION_KEY=       # optional — auto-generated if not set
```

## Architecture

**3-stage pipeline** triggered by `POST /api/generate`:

```
User input (URL or topic)
  → lib/scrape.ts         Stage 1: Content extraction (Readability + linkedom)
                          Falls back to Needle if NEEDLE_API_KEY is set
  → LLM (selectable)     Stage 2: Generate ALEX/SAM dialogue script
    lib/ollama.ts           Local (Ollama, no token limit)
    lib/openrouter.ts       Cloud (OpenRouter)
    lib/featherless.ts      Cloud (Featherless)
    lib/claude.ts           Cloud (Claude Haiku 4.5)
  → TTS (selectable)     Stage 3: Text-to-speech
    lib/tts.ts              Local (pocket-tts sidecar)
    lib/tts-elevenlabs.ts   Cloud (ElevenLabs, MP3→WAV via ffmpeg)
    lib/tts-openai.ts       Cloud (OpenAI TTS, native WAV)
  → lib/tts-router.ts      Dispatches to selected TTS backend
  → lib/wavStitching.ts    Concatenate WAV buffers with silence gaps
  → Returns { scriptLines, audio (base64), scriptBackend, ttsBackend }
```

User selects LLM backend (auto/ollama/openrouter/featherless/claude) and TTS backend (local/elevenlabs/openai) from the toolbar. Auto mode cascades through configured backends.

**Script format** — host names are configurable (default ALEX/SAM):
```
HOST_A: <line text>
HOST_B: <line text>
```
`lib/script.ts` parses dynamically based on configured host names. `lib/featherless.ts` exports `validatePodcastScript` and `extractValidLines`. `lib/prompt.ts` has the prompts with length/language/host name support and strips `<think>` tags. Custom prompts can be provided from the UI via `PromptOptions.customSystemPrompt`/`customUserPrompt` with template variables like `{{SOURCE}}`, `{{HOST_A}}`, `{{HOST_B}}`, `{{LANGUAGE}}`, `{{LINES_MIN}}`, etc.

## Key Modules

- `lib/prompt.ts` — system/user/repair prompts, length configs (short/medium/long/custom), multilanguage, configurable host names, custom prompt overrides
- `lib/tts-router.ts` — TTS backend dispatch + MP3→WAV conversion
- `lib/storage.ts` — file-based storage for podcasts (`data/podcasts/`) and AES-256-GCM encrypted settings profiles (`data/settings/`)
- `lib/scrape.ts` — built-in content extraction, optional Needle fallback

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/generate` | POST | Full pipeline via SSE stream: scrape → script → TTS → stitch |
| `/api/synthesize` | POST | TTS-only from existing script (re-voice) |
| `/api/voices` | GET | List voices for selected TTS backend |
| `/api/library` | GET/POST | List/save podcasts |
| `/api/library/[id]` | GET/DELETE | Get/delete podcast |
| `/api/library/[id]/audio` | GET | Serve saved WAV |
| `/api/profiles` | GET/POST/DELETE | Manage encrypted settings profiles |
| `/api/settings` | GET | Report which backends have env vars |
| `/api/encode-mp3` | POST | WAV→MP3 via ffmpeg |
| `/api/clone-voice` | POST | Forward voice clone to TTS sidecar |

## Route Structure

- `/` → main generation UI (`app/page.tsx`)
- `/demo` → static demo page, pre-baked audio, no API calls
- `app/for-chris/page.tsx` — standalone portfolio page

## Components (components/)

UI is extracted into reusable components:
- `types.ts` — shared types (Voice, Stage, ScriptLine, Result, SavedPodcast, etc.)
- `PipelineViz.tsx` — 3-stage pipeline progress visualization
- `VoiceSelect.tsx` — voice dropdown with builtin/custom groups
- `ActionButton.tsx` — reusable hover-styled button
- `SettingsInput.tsx` — text/password input with show/hide toggle
- `SettingsPanel.tsx` — profiles, env status, create profile form
- `LibraryPanel.tsx` — saved podcasts with load/play/delete
- `PromptPanel.tsx` — custom prompt editor + LLM cascade order config
- `Toolbar.tsx` — bottom toolbar (length, LLM, language, TTS backend, generate)
- `ResultsSection.tsx` — audio player, save/download, transcript

## UI Features (app/page.tsx)

- Settings panel: encrypted profiles, backend status indicators
- Library panel: saved podcasts with load/play/delete
- Prompt panel: editable system/user prompts with template variables, configurable LLM fallback order
- Input card: textarea (URL, topic, or paste transcript), voice selection per TTS backend
- Voice management: clone for local (pocket-tts), add voice ID for ElevenLabs/OpenAI
- Host names: configurable (default ALEX/SAM), used in prompts, parsing, and transcript
- Toolbar: length (1m/3m/7m/custom), LLM selector with API key warnings, language (disabled for pocket-tts), TTS backend
- Results: audio player → save/download row → re-voice/copy → transcript with per-line progress
- SSE streaming: real-time stage updates + TTS progress bar during generation

## Known Issues / TODO

- pocket-tts is English-only — non-English requires ElevenLabs or OpenAI TTS
- demo page (`app/demo/page.tsx`) duplicates some components from the main UI
