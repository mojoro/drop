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
OLLAMA_MODEL=              # e.g. qwen2.5:7b — enables local LLM
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

**Script format** — all generation and parsing depends on:
```
ALEX: <line text>
SAM: <line text>
```
`lib/script.ts` parses (skips invalid lines gracefully). `lib/featherless.ts` exports `validatePodcastScript` and `extractValidLines`. `lib/prompt.ts` has the prompts with length/language support and strips `<think>` tags.

## Key Modules

- `lib/prompt.ts` — system/user/repair prompts, length configs (short/medium/long), multilanguage
- `lib/tts-router.ts` — TTS backend dispatch + MP3→WAV conversion
- `lib/storage.ts` — file-based storage for podcasts (`data/podcasts/`) and AES-256-GCM encrypted settings profiles (`data/settings/`)
- `lib/scrape.ts` — built-in content extraction, optional Needle fallback

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/generate` | POST | Full pipeline: scrape → script → TTS → stitch |
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

- `/` → redirects to `/demo` (see `next.config.ts`)
- `/demo` → static demo page, pre-baked audio, no API calls
- `app/page.tsx` — main generation UI (reached directly at `/`)
- `app/for-chris/page.tsx` — standalone portfolio page

## UI State (app/page.tsx)

Single-page app with these major sections:
- Settings panel: encrypted profiles, backend status indicators
- Library panel: saved podcasts with load/play/delete
- Input card: textarea (URL, topic, or paste ALEX:/SAM: transcript)
- Voice selection: dropdowns per backend, clone for local
- Toolbar: length (~1m/~3m/~7m), LLM selector, language (15 langs), TTS backend (local/11labs/openai)
- Results: audio player → save/download row → action buttons (re-voice/regenerate/copy) → transcript

## Known Issues / TODO

- **UI polish needed**: page.tsx is ~1400 lines of inline styles. Needs component extraction, proper CSS, and mobile testing.
- The `next.config.ts` redirect from `/` to `/demo` means the generation UI is only at the root when accessed directly — this is confusing.
- ElevenLabs voices list is hardcoded in `lib/tts-elevenlabs.ts` — could fetch from their API.
- No streaming for generation progress — the pipeline runs synchronously and returns all at once.
