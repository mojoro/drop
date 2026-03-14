# Drop — App Write-Up for Blog Post

## The Event

AI Mini Hackathon Berlin, March 14, 2026. A single day, roughly 2.5 hours of build time, three sponsor API integrations, pitches in the afternoon. The format was fast and competitive — teams were expected to demo something live (or near-live) to a room that included people from the sponsoring companies.

The sponsors whose APIs we integrated: **Needle** (document/URL ingestion), **Featherless** (open-weight LLM inference), and **ElevenLabs** (text-to-speech).

---

## The Idea

The pitch in one sentence: *paste any URL or topic and get a shareable two-voice podcast episode in 60 seconds.*

The idea came from thinking about how people use AI in consuming their content and how we could integrate some of the sponsors of the event. ElevenLabs offers ElevenReader which uses their text to speech model to read out any text you put inside it, or any webpage that you point it at. AI summaries are also prevalent for people who don't have time to read a full write-up on something. The twist here is that it is a summary presented in a way that is more engaging than straight text-to-speech.

The app is called **Drop**.

---

## How It Works

The pipeline has three stages, each powered by a different sponsor:

1. **Needle** — takes whatever the user pastes (a URL or plain text) and returns clean, structured content. For URLs it creates a collection, indexes the page, runs a semantic search to pull the most relevant chunks, and returns joined plain text. For plain text topics it passes straight through. A direct HTML fetch fallback handles Needle timeouts.

2. **Featherless** — takes the extracted text and generates a dialogue script between two podcast hosts: Alex (curious, asks sharp questions) and Sam (the expert, gives direct takes). The prompt enforces strict `ALEX: ...` / `SAM: ...` formatting with 7–9 exchanges and a memorable last line from Sam. Anthropic Claude Sonnet acts as a silent fallback if Featherless fails.

3. **ElevenLabs** — generates audio for each line of the script in sequence using the correct host voice, then byte-concatenates the MP3 buffers into a single stitched file. The result plays as one continuous episode in the browser.

The frontend is a Next.js App Router app with a single card UI: textarea input, voice selector, generate button, pipeline visualization that lights up as each stage completes, then an audio player and scrollable transcript when done.

---

## The Team

Three people, three clearly divided roles:

- **John** — frontend, full API pipeline (`/api/generate` route), ElevenLabs integration, and the pitch. Effectively the integration lead — the other two handed over clean modules and John wired everything together.
- **Bernard** (Math PhD) — ElevenLabs SDK integration and audio stitching. Solved the problem of generating per-line audio and concatenating MP3 buffers correctly.
- **Rahul** (AI Masters student) — Needle URL ingestion and Featherless LLM integration. Built the validation and auto-repair logic for Featherless script output, which is less format-disciplined than Claude.

---

## The Build

**What went smoothly:** The core pipeline concept was clear from the start. The prompt engineering for the script format was locked in early and barely needed iteration — the `ALEX:` / `SAM:` constraint with a specific exchange count produced consistently usable output from the first test.

**What was hard:**

- **ElevenLabs SDK on Vercel** — Bernard's original integration used `writeFileSync` to track character usage to a CSV. Vercel's serverless runtime has a read-only filesystem, so this crashed every request in production. The fix was removing the tracking entirely and making the ElevenLabs client lazy-initialize (inside the function rather than at module load time), which also fixed a separate issue where `dotenv` hadn't populated `process.env` before the SDK constructor ran.

- **Needle reliability** — The Needle integration was failing on every call. Three separate root causes: the SDK constructor requires an explicit `{ apiKey }` argument (doesn't auto-read from environment), the `collections.create` call requires a `model` field (`"basilikum-minima"`) that wasn't documented prominently, and the polling loop was running for 120 seconds — longer than Vercel's function timeout. Fixed all three, added a direct HTML fetch fallback, and capped polling at 24 seconds.

- **Audio as two separate files** — The original approach generated all of Alex's lines as one audio file and all of Sam's as another, playing them sequentially. This didn't sound like a conversation. The fix was generating one audio clip per script line in dialogue order and stitching them — the same total ElevenLabs usage, but the result sounds like two people actually talking to each other.

- **Merging three branches** — Bernard and Rahul both had development branches. Each had introduced library files (`lib/elevenlabs.ts`, `lib/featherless.ts`, `lib/audioStitching.ts`, `lib/needle.ts`, `lib/script.ts`) but both had left the Next.js default `page.tsx` untouched. This made the merge clean — my UI was preserved completely, coworkers' lib files were brought in, and the API route was written to import from all of them.

---

## The Pitch

There were over 40 teams presenting in roughly a 45-minute block. The pressure to move fast was real — you had maybe two minutes before the room's attention moved on.

I was fixing things down to the wire. The Needle integration was the last major blocker, patched in the commit immediately before we presented (`31c6370`). By the time pitches started I had several browser tabs open with completed generations from earlier test runs, each showing a full transcript and audio player.

The actual presentation approach: I put a URL into the input live in front of the audience and hit Generate — so they could see the real interface and what you'd actually type, then switched to a tab with a completed run of the same url to show the transcript and play the audio. Waiting 40 seconds for a live generation to finish was not an option given the pace of the event. The tabs were a great safety net.

---

## Post-Hackathon: The Portfolio Demo

The live app requires active API keys and costs real credits on every generation, which makes it impractical to leave publicly accessible indefinitely. After the hackathon, a self-contained demo version was built for archival purposes — something that could live on a portfolio without needing to maintain keys or worry about usage costs.

The solution: a `/demo` route with a fully interactive mock pipeline. When a visitor clicks Generate, the UI animates through all three pipeline stages (Needle → Featherless → ElevenLabs) with realistic delays (~17 seconds total), then reveals a pre-baked audio episode and transcript — identical in appearance to a real generation. The audio was generated once locally using a one-shot script and committed as a static file.

The demo episode topic: **"Attention as Infrastructure — why the attention economy might be the defining public health crisis of the century."** Voiced by George (Alex) and Jessica (Sam) from ElevenLabs' creator tier. The script ends with: *"The most valuable thing you own isn't your house or your savings. It's the hours of genuine focus you have left in your life. The question is who you're going to let spend them."*

The root URL redirects to `/demo`. The live generator remains accessible for anyone who wants to clone and deply the repo and bring their own keys.

---

## Technical Stack Summary

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), TypeScript |
| Styling | native Next.js Styles (implemented), Tailwind CSS 4 (planned), JetBrains Mono + Syne (Google Fonts) |
| Content extraction | Needle (`@needle-ai/needle`) |
| Script generation | Featherless AI (OpenAI-compatible, Qwen 2.5-7B) |
| Script fallback | Anthropic Claude Sonnet (`claude-sonnet-4-20250514`) |
| Voice synthesis | ElevenLabs (`@elevenlabs/elevenlabs-js`) |
| Audio stitching | Manual MP3 byte concatenation |
| Deployment | Vercel |

---

## Numbers

- ~2.5 hours of active build time at the hackathon
- 3 sponsor API integrations in one pipeline
- ~1,645 ElevenLabs characters for the portfolio demo episode
- 17 voices available in the voice selector (creator tier)
- 12 lines of dialogue in the demo episode
- 1 live pitch, 2 minutes, one live-generated episode played for room
