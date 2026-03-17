# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Drop** — paste a URL or topic, get a 2-voice podcast episode in ~60 seconds. Built at AI Mini Hackathon Berlin (March 14, 2026).

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
```

No test runner is configured. Test files in `/tests/` can be run directly with `tsx`:

```bash
npx tsx tests/script.test.ts
npx tsx tests/featherless.test.ts
```

## Environment Variables

Create `.env.local` in the root:

```
ELEVENLABS_API_KEY=
NEEDLE_API_KEY=
FEATHERLESS_API_KEY=
ANTHROPIC_API_KEY=     # Claude fallback for script generation
```

## Architecture

The app is a **3-stage pipeline** triggered by `POST /api/generate`:

```
User input (URL or topic)
  → lib/needle.ts       Stage 1: Extract content via Needle SDK
                        Fallback: direct HTML fetch if Needle fails
  → lib/featherless.ts  Stage 2: Generate ALEX/SAM dialogue script
                        Fallback: lib/claude.ts (Claude Sonnet)
  → lib/elevenlabs.ts   Stage 3: Text-to-speech, one call per script line
  → lib/audioStitching.ts  Concatenate MP3 buffers into single audio file
  → Returns { scriptLines, audio (base64) }
```

**Script format** — both generation and parsing depend on this exact format:
```
ALEX: <line text>
SAM: <line text>
```
`lib/script.ts` owns parsing (`parseScript`) and stats (`getScriptStats`). The Featherless module validates the format and attempts a repair call if the LLM output is malformed.

## Route Structure

- `/` → redirects to `/demo` (see `next.config.ts`)
- `/demo` → `app/demo/page.tsx` — static demo with pre-baked `public/demos/portfolio.mp3`, no API calls
- `app/page.tsx` — the live generation UI (reached directly, not via `/`)
- `app/for-chris/page.tsx` — standalone portfolio page
- `POST /api/generate` — the pipeline endpoint called by `app/page.tsx`

## Pre-generating Demo Audio

To regenerate `public/demos/portfolio.mp3`:

```bash
npx tsx scripts/generate-demo.ts
```

This runs the full pipeline locally and writes the MP3 to disk (requires all API keys in `.env.local`).

## Voice IDs

`voicesInfo.md` contains the full ElevenLabs voice catalogue (21 voices with IDs). The UI populates voice selectors from a hardcoded list in `app/page.tsx`. Default voices: Rachel (`21m00Tcm4TlvDq8ikWAM`) for Alex, Antoni (`ErXwobaYiN019PkySvjV`) for Sam.
