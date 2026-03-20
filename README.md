# Drop

Paste a URL or topic, get a podcast episode. Runs entirely on your own machine — no cloud accounts required unless you want them.

Drop scrapes content, generates a dialogue script with a local or cloud LLM, synthesizes each line with text-to-speech, and stitches the audio into a single WAV file you can play, download, or save to a local library.

---

## Quick start

### Docker (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) and at least one API key or a local Ollama model.

```bash
git clone https://github.com/mojoro/drop.git
cd drop
cp .env.example .env.local
```

Open `.env.local` and add at least one LLM key. The fastest option with no local GPU required:

```
OPENROUTER_API_KEY=sk-or-...
```

Then:

```bash
docker compose up
```

Open [http://localhost:3000](http://localhost:3000).

> **First run:** Docker builds both images and the TTS sidecar downloads the pocket-tts model (~400 MB). This takes a few minutes. The app container waits until the TTS sidecar is healthy before starting, so the UI won't appear until the model is ready. You can watch progress with `docker compose logs tts`.

---

### Manual setup

Requires Node.js 20+, Python 3.12+, [uv](https://docs.astral.sh/uv/), and ffmpeg.

**Install ffmpeg:**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows — download from https://ffmpeg.org/download.html
```

**Install and start:**

```bash
git clone https://github.com/mojoro/drop.git
cd drop
npm install
cp .env.example .env.local
# edit .env.local — add at least one LLM key
```

Open two terminals:

```bash
# Terminal 1 — Next.js app
npm run dev

# Terminal 2 — TTS sidecar (downloads ~400 MB on first run)
cd tts-server && uv run uvicorn main:app
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

Copy `.env.example` to `.env.local` and fill in what you need. Everything is optional — configure at least one LLM backend.

```bash
# ── LLM backends ──────────────────────────────────────────────
# Drop tries them in order: Ollama → OpenRouter → Featherless → Claude

OLLAMA_MODEL=qwen2.5:7b              # enables local LLM — pull with: ollama pull qwen2.5:7b
OLLAMA_URL=http://localhost:11434    # Docker users: http://host.docker.internal:11434

OPENROUTER_API_KEY=                  # https://openrouter.ai — many models, free tier available
FEATHERLESS_API_KEY=                 # https://featherless.ai
ANTHROPIC_API_KEY=                   # Claude Haiku 4.5 — last fallback

# ── TTS backends ──────────────────────────────────────────────
# Local TTS (pocket-tts) is the default — no key needed.
# Cloud backends enable multilanguage and higher-quality voices.

ELEVENLABS_API_KEY=                  # https://elevenlabs.io
OPENAI_API_KEY=                      # OpenAI TTS voices

# ── Optional ──────────────────────────────────────────────────
NEEDLE_API_KEY=                      # fallback web scraper (built-in Readability used by default)
TTS_SERVER_URL=http://localhost:8000 # override if sidecar runs on a different port
DROP_ENCRYPTION_KEY=                 # auto-generated and saved to data/.key if not set
```

Keys can also be entered through the in-app **Settings** panel without touching `.env.local`. They're stored encrypted on disk (AES-256-GCM) and never sent to the browser.

---

## Local LLM with Ollama

Install [Ollama](https://ollama.com), pull a model, then set `OLLAMA_MODEL` in your `.env.local`:

```bash
ollama pull qwen2.5:7b
```

```
OLLAMA_MODEL=qwen2.5:7b
```

**Docker + Ollama:** Ollama runs on your host, not inside the container. Use `host.docker.internal` instead of `localhost`:

```
OLLAMA_URL=http://host.docker.internal:11434
OLLAMA_MODEL=qwen2.5:7b
```

---

## Default settings

Drop reads `drop.config.json` at the project root on startup and applies the values as UI defaults. Edit this file to change what you see when you first open the app — no code changes needed.

```json
{
  "defaults": {
    "hostA": "ALEX",
    "hostB": "SAM",
    "language": "English",
    "scriptLength": "short",
    "llmBackend": "auto",
    "ttsBackend": "local",
    "monologue": false
  }
}
```

All fields are optional and merge with the built-in fallbacks. See `lib/config.ts` for the full list of supported keys.

---

## Features

**Input**
- Paste a URL — content is scraped and turned into a podcast script
- Type a topic — script is generated from scratch
- Paste an existing transcript in `SPEAKER: line` format — skips the LLM and goes straight to voice synthesis

**Generation**
- Five length options: ~1 min, ~3 min, ~7 min, custom (1–240 min), or unlimited (no token cap — for very long episodes)
- Dialogue mode (two hosts debating) or monologue mode (single narrator)
- Configurable host names (default: ALEX and SAM)
- Cancel any in-progress generation

**LLM backends** (selectable per generation)
- **Auto** — cascades through configured backends in order
- **Ollama** — fully local, no internet required
- **OpenRouter** — cloud, access to many models
- **Featherless** — cloud
- **Claude** — Anthropic Haiku 4.5, used as last fallback

**TTS backends**
- **Local (pocket-tts)** — runs on-device, English only, 8 built-in voices (alba, marius, javert, jean, fantine, cosette, eponine, azelma)
- **ElevenLabs** — cloud, high quality, multilanguage
- **OpenAI** — cloud, multilanguage

**Voices**
- Clone a custom voice from a WAV file or microphone recording (local TTS)
- Add a voice by ID for ElevenLabs and OpenAI
- Choose different voices for each host independently

**After generation**
- Episodes are auto-saved to your local library
- Re-voice the same script with different voices (no LLM call)
- Download as MP3 (converted server-side via ffmpeg)
- Copy transcript to clipboard

**Library**
- Browse and play saved episodes
- Load a saved session — restores the script, voices, audio, and input
- Delete old episodes

**Advanced**
- Custom system and user prompts with template variables (`{{HOST_A}}`, `{{HOST_B}}`, `{{SOURCE}}`, `{{LANGUAGE}}`, `{{LINES_MIN}}`, etc.)
- Configurable LLM fallback order via the Prompt panel
- Encrypted settings profiles — create named profiles with different API keys and switch between them
- Multilanguage script and TTS (ElevenLabs and OpenAI backends only — pocket-tts is English-only)

---

## Architecture

```
URL or topic
  → lib/scrape.ts         Extract content (Readability + linkedom; Needle optional)
  → LLM backend           Generate HOST_A/HOST_B dialogue script
      lib/ollama.ts         Local (Ollama)
      lib/openrouter.ts     Cloud (OpenRouter)
      lib/featherless.ts    Cloud (Featherless)
      lib/claude.ts         Cloud (Claude Haiku 4.5)
  → TTS backend           Synthesize each line
      lib/tts.ts            Local (pocket-tts sidecar on port 8000)
      lib/tts-elevenlabs.ts Cloud (ElevenLabs)
      lib/tts-openai.ts     Cloud (OpenAI)
  → lib/wavStitching.ts   Concatenate WAV buffers with silence gaps
  → SSE stream            Stage events + per-line TTS progress sent to browser
```

Two services:

```
┌─────────────────────────────────────────────┐
│  Next.js (port 3000)                        │
│  app/api/generate   — full pipeline (SSE)   │
│  app/api/synthesize — TTS-only re-voice     │
│  app/api/library    — saved episodes        │
│  app/api/profiles   — encrypted key mgmt   │
│  app/api/voices     — list available voices │
└──────────────────┬──────────────────────────┘
                   │ HTTP
┌──────────────────▼──────────────────────────┐
│  Python TTS sidecar (port 8000)             │
│  FastAPI + pocket-tts (Kyutai, ~100M params)│
│  POST /tts/generate   — text → WAV         │
│  POST /tts/clone-voice — WAV → custom voice │
│  GET  /tts/voices     — list voices        │
└─────────────────────────────────────────────┘
```

**Data directory** (`data/`, gitignored):
- `data/podcasts/` — saved episodes (`.json` metadata + `.wav` audio)
- `data/settings/` — encrypted API key profiles (`.enc`)
- `data/.key` — auto-generated AES-256-GCM encryption key

---

## Development

```bash
npm run dev       # Next.js dev server with hot reload
npm run build     # Production build
npm run lint      # ESLint

# TTS sidecar
cd tts-server && uv run uvicorn main:app --reload

# Tests (no test runner — run directly with tsx)
npx tsx tests/script.test.ts
npx tsx tests/featherless.test.ts
```

---

## License

MIT
