# Drop

Paste a URL or topic, get a two-voice podcast episode. Runs entirely on your hardware — no cloud accounts required.

Drop uses local TTS ([pocket-tts](https://github.com/nickovchinnikov/pocket-tts)) and local LLMs (via [Ollama](https://ollama.com)) by default, with optional cloud backends (OpenRouter, Featherless, Anthropic) for users who prefer them.

Built at AI Mini Hackathon Berlin, March 2026.

---

## How it works

```
URL or topic
  → Scrape & extract content    (Readability + linkedom)
  → Generate dialogue script    (Ollama / OpenRouter / Featherless / Claude)
  → Synthesize speech per line  (pocket-tts via Python sidecar)
  → Stitch into single WAV
  → Play, download, or save
```

Two hosts — **Alex** (curious, asks sharp questions) and **Sam** (direct, no-fluff answers) — debate whatever you throw at them.

## Quick start

### 1. Clone & install

```bash
git clone https://github.com/mojoro/drop.git
cd drop
npm install
```

### 2. Start the TTS sidecar

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/):

```bash
cd tts-server
uv run uvicorn main:app
```

This starts the pocket-tts server on `http://localhost:8000`. First run downloads the TTS model (~100MB).

### 3. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Configure an LLM

You need at least one LLM backend. Pick one:

**Local (Ollama)** — no API key needed:
```bash
ollama pull qwen2.5:7b
```
Then set in `.env.local`:
```
OLLAMA_MODEL=qwen2.5:7b
```

**Cloud (OpenRouter)** — one key, many models:
```
OPENROUTER_API_KEY=sk-or-...
```

Or configure keys through the in-app Settings panel — they're stored encrypted on disk, never in the browser.

---

## Features

**Generation**
- Paste a URL — content is extracted and turned into a podcast script
- Type a topic — script is generated from scratch
- Paste a transcript in `ALEX:`/`SAM:` format — skip the LLM, go straight to voice synthesis
- Three length options: ~1 min, ~3 min, ~7 min
- Cancel in-progress generation at any time

**Voices**
- 8 built-in voices from pocket-tts
- Clone your own voice from a WAV upload or microphone recording
- Choose different voices for Alex and Sam independently

**After generation**
- Re-voice the same script with different voices (no LLM call)
- Regenerate with a completely new script
- Download as MP3 (converted server-side via ffmpeg)
- Save to your local library with a title
- Copy transcript to clipboard

**Library**
- Browse and play saved podcasts
- Load a saved session — restores the script, voices, audio, and input
- Delete old episodes

**Settings profiles**
- Create named profiles with different API keys and LLM configurations
- Switch between profiles (e.g. "work" with OpenRouter, "local" with Ollama)
- Keys are encrypted at rest with AES-256-GCM — never stored in the browser

---

## Environment variables

Create `.env.local` in the project root. All variables are optional — configure at least one LLM backend.

```bash
# LLM backends (priority: Ollama → OpenRouter → Featherless → Claude)
OLLAMA_MODEL=qwen2.5:7b              # enables Ollama (local)
OLLAMA_URL=http://localhost:11434     # default
OPENROUTER_API_KEY=                   # cloud, many models
FEATHERLESS_API_KEY=                  # cloud
ANTHROPIC_API_KEY=                    # cloud, last fallback

# Content extraction
NEEDLE_API_KEY=                       # optional — built-in scraper used by default

# TTS sidecar
TTS_SERVER_URL=http://localhost:8000  # default

# Profile encryption
DROP_ENCRYPTION_KEY=                  # optional — auto-generated if not set
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Next.js App (port 3000)                    │
│                                             │
│  app/page.tsx          Main UI              │
│  app/api/generate      Pipeline endpoint    │
│  app/api/synthesize    TTS-only endpoint    │
│  app/api/library       Podcast storage      │
│  app/api/profiles      Encrypted key mgmt   │
│  app/api/encode-mp3    WAV→MP3 via ffmpeg   │
│                                             │
│  lib/scrape.ts         Readability extract  │
│  lib/ollama.ts         Local LLM            │
│  lib/openrouter.ts     Cloud LLM            │
│  lib/tts.ts            TTS client           │
│  lib/storage.ts        File storage + AES   │
│  lib/wavStitching.ts   Audio concatenation  │
└─────────────────┬───────────────────────────┘
                  │ HTTP
┌─────────────────▼───────────────────────────┐
│  Python TTS Sidecar (port 8000)             │
│                                             │
│  FastAPI + pocket-tts (Kyutai, 100M params) │
│  GET  /tts/voices      List voices          │
│  POST /tts/generate    Text → WAV           │
│  POST /tts/clone-voice WAV → custom voice   │
└─────────────────────────────────────────────┘
```

**Data directory** (`data/`, gitignored):
- `data/podcasts/` — saved episodes (`.json` metadata + `.wav` audio)
- `data/settings/` — encrypted API key profiles (`.enc`)
- `data/.key` — auto-generated encryption key

---

## Requirements

- **Node.js** 20+
- **Python** 3.12+ with [uv](https://docs.astral.sh/uv/)
- **ffmpeg** (for MP3 download)
- **Ollama** (for local LLM) or a cloud API key

---

## Scripts

```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # ESLint

# TTS sidecar
cd tts-server && uv run uvicorn main:app

# Tests (no test runner — run directly)
npx tsx tests/script.test.ts
npx tsx tests/test-scrape.ts

# Regenerate demo audio
npx tsx scripts/generate-demo.ts
```

---

## License

MIT
