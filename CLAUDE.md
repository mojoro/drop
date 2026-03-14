# CLAUDE.md — Drop Hackathon Master Brief
## AI Mini Hackathon Berlin — March 14, 2026

---

## Project Overview

**App name:** Drop

**One-liner:** Paste any URL or topic and get a shareable 2-voice podcast episode in 60 seconds.

**How it works:**
1. User enters a URL or free-text topic
2. Needle extracts and chunks the content cleanly
3. Featherless (Llama-3.3-70B) writes a dialogue script between two hosts (Alex and Sam)
4. ElevenLabs generates audio for each host voice in parallel
5. Audio plays in the browser and can be shared via Superchat (WhatsApp — post-MVP)

**Stack:**
- Next.js (App Router) with TypeScript
- Tailwind CSS
- Featherless (Llama-3.3-70B) as primary LLM for script generation
- ElevenLabs free tier for TTS
- Needle for URL ingestion + automation
- Superchat for WhatsApp sharing (post-MVP, if time allows)

**Environment variables — create `.env.local` immediately:**
```
ELEVENLABS_API_KEY=
NEEDLE_API_KEY=
FEATHERLESS_API_KEY=
SUPERCHAT_API_KEY=
```

---

## ⚠️ ElevenLabs Free Tier Rules — Everyone Read This First

- Free tier = **10,000 characters per month per account**
- Each generated script uses ~1,500 characters of spoken text
- **Each team member uses their own ElevenLabs account and API key** — do not share one account
- **Test with this string only:** `"Hello, this is a test."` — never a full script during dev
- Pre-generate the 3 demo episodes before 13:00 and save them as files — do not regenerate during the pitch
- Bernard tracks character usage across all accounts out loud

**Demo episodes to pre-generate before 13:00:**
1. "The future of AI podcasting" — for Rod Rivera (podcast co-host, AI professor)
2. "How AI is changing strategy consulting" — for Carla Schneider (BCG)
3. "Open source vs closed models in 2025" — for Dan Makarov (BrowserStack, ex-Google)

Save as `/public/demos/rod.mp3`, `/public/demos/carla.mp3`, `/public/demos/dan.mp3`

---

## Team

| Person | Owns |
|--------|------|
| John | UI (front-end) + Pitch |
| Rahul (AI Masters Student) | Needle automation + Featherless script generation |
| Bernard (Math PhD) | ElevenLabs TTS + audio stitching |

---

## Timeline

| Time | Milestone |
|------|-----------|
| 11:00 | Repo running, roles confirmed, all API keys in `.env.local` |
| 11:20 | Rahul: Featherless returns a script from a hardcoded topic |
| 11:40 | Rahul: Needle returns clean text from a test URL |
| 11:40 | Bernard: ElevenLabs returns audio from hardcoded 1-line test string |
| 12:00 | **MVP MILESTONE — UI renders, topic in → script displayed in browser** |
| 12:20 | Full pipeline: URL in → Needle → Featherless → script + audio out |
| **12:30** | **DEMO MILESTONE — working demo locked. Stop adding features.** |
| 12:30–13:00 | Pre-generate 3 demo episodes, polish UI, wire fallback audio to `/public/demos/` |
| 13:00–13:30 | Superchat button (if time allows), pitch prep |
| 13:30 | Pitch rehearsal — run it twice out loud |
| 14:00 | Pitches begin |

---

## The Pitch (2 minutes — John presents)

> *"We built Drop. Paste any URL or topic and get a podcast episode in 60 seconds — two real voices, real conversation, shareable audio."*

> **[Play pre-generated Rod episode — do not generate live]**

> *"Needle handles the URL ingestion. Featherless runs the script generation — fully open-weight. ElevenLabs generates the voices. Share it instantly via WhatsApp through Superchat."*

> *"Three hours. Four sponsor integrations. One thing that actually works."*

**The Rod move:** Find Sina (the moderator) before pitches start. Tell her you generated an episode about AI podcasting and ask if Rod can hear it during the demo. Do this before 13:50.

---
---

# Team Member Briefs

---

## 👤 John — Front-End + Pitch

### Your job
You own the UI and the pitch. Rahul hands you a working `/api/generate` endpoint that returns `{ scriptLines, alexAudio, samAudio }`. Build the frontend against a mock first — don't wait for the backend. Your instinct at all times: **cut, don't add.** You decide what's in scope.

---

### What you build

**`app/page.tsx`** — the entire UI

**MVP goal:** text box centered on screen, explanatory text, go button, script returned and displayed. Audio is a bonus once the script display works.

Build against this mock first:

```typescript
const MOCK = {
  scriptLines: [
    { speaker: 'ALEX', text: "So what's actually happening with open source AI?" },
    { speaker: 'SAM', text: "It's moving faster than anyone expected. Llama 3 basically closed the gap." },
    { speaker: 'ALEX', text: "Does that threaten the big labs?" },
    { speaker: 'SAM', text: "It changes their business model more than it threatens them." }
  ],
  alexAudio: null,
  samAudio: null
}
```

Page elements (top to bottom):
1. App name + one-line explainer: *"Paste a URL or topic. Get a podcast episode in 60 seconds."*
2. Large text input — placeholder: *"Paste a URL or describe a topic..."*
3. Big generate button
4. Loading states: *"Extracting content..."* → *"Writing script..."* → *"Generating audio..."*
5. Transcript — Alex lines in muted blue `#6b9fd4`, Sam lines in warm amber `#d4a843`
6. `<audio controls>` player wired to base64 response (once Bernard's audio is ready)
7. "Share on WhatsApp" button — Superchat **post-MVP only**, fall back to `navigator.clipboard.writeText()` if complex

Wiring the audio player (once backend is ready):
```typescript
const src = `data:audio/mpeg;base64,${data.alexAudio}`
// <audio src={src} controls autoPlay />
// MVP: play Alex block then Sam block sequentially
```

**Design:** dark background `#0a0a0a`, centered card `max-w-2xl`, clean sans-serif. Max 25 minutes on styling.

---

### Your success condition
Topic entered → Go clicked → script transcript displays in the browser. Audio playing is the next milestone. Everything else is polish.

Wrap API calls in `try/catch`. Show `{ error: string }` inline on failure — no silent errors.

---

## 👤 Rahul — Needle Automation + Featherless Script Generation

### Your job
Two tasks that form the core backend pipeline: Needle content extraction and Featherless script generation. You own `app/api/generate/route.ts` — the full pipeline endpoint that John's UI calls.

---

### Task 1: Needle integration

Create `lib/needle.ts` and export one function.

```bash
npm install needle-ai
```

```typescript
// lib/needle.ts
import Needle from 'needle-ai'

const needle = new Needle({ apiKey: process.env.NEEDLE_API_KEY })

export async function extractContent(input: string): Promise<string> {
  const isUrl = input.startsWith('http://') || input.startsWith('https://')

  if (!isUrl) {
    // Plain text topic — pass straight through to Featherless
    return input
  }

  // URL — use Needle to extract and chunk content properly
  const collection = await needle.collections.create({ name: `drop-${Date.now()}` })
  await needle.files.add({ collectionId: collection.id, url: input })

  const results = await needle.search({
    collectionId: collection.id,
    text: 'main content key points arguments',
    top_k: 5
  })

  return results.map((r: any) => r.content).join('\n\n')
}
```

Check Needle docs for exact method signatures — flow is: create collection → add URL → search → return joined text.

### Your success condition (Task 1)
`extractContent("https://www.bbc.com/news")` returns readable plain text — not HTML, not JSON, not an error.

### If you finish early
Try a tighter search query: `"key claims evidence conclusions"` — better retrieval = better scripts.

---

### Task 2: Featherless script generation

Create `lib/featherless.ts` and export one function. Featherless exposes an OpenAI-compatible API.

```typescript
// lib/featherless.ts
export async function generateScript(content: string): Promise<string> {
  const res = await fetch('https://api.featherless.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.FEATHERLESS_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      messages: [{
        role: 'user',
        content: `You are a podcast script writer. Given the following content, write a punchy 90-second podcast dialogue between two hosts: Alex (curious, conversational, asks sharp questions) and Sam (the expert, gives direct takes with no fluff). Format every line strictly as "ALEX: ..." or "SAM: ..." with no other text, headers, or commentary. Aim for 7–9 exchanges total. End with a memorable one-line takeaway from Sam.\n\nContent: ${content}`
      }],
      max_tokens: 1000
    })
  })
  const data = await res.json()
  const script = data.choices[0].message.content

  if (!script.includes('ALEX:') || !script.includes('SAM:')) {
    throw new Error('Invalid script format from Featherless — retry')
  }

  return script
}
```

Fallback model if Llama-3.3-70B is slow: `mistralai/Mixtral-8x7B-Instruct-v0.1`

### Your success condition (Task 2)
`generateScript("artificial intelligence")` returns a string with both `"ALEX:"` and `"SAM:"` lines.

---

### Task 3: Wire the API route

Create `app/api/generate/route.ts`. Receives `POST { input: string }` and:
1. Calls `extractContent(input)` → clean text
2. Calls `generateScript(cleanedText)` → script string
3. Parses script into `{ speaker, text }[]` lines
4. Calls Bernard's `generateVoice` function for both speakers in parallel
5. Returns `{ scriptLines, alexAudio, samAudio }` as base64

```typescript
function parseScript(script: string) {
  return script.split('\n')
    .filter(l => l.trim())
    .map(line => ({
      speaker: line.startsWith('ALEX:') ? 'ALEX' : 'SAM',
      text: line.replace(/^(ALEX|SAM): /, '').trim()
    }))
}
```

Tell John when the route is working so he can wire the UI.

---

## 👤 Bernard — ElevenLabs TTS + Audio Stitching

### Your job
Two tasks: get ElevenLabs generating voice audio from script text, then (if time allows) implement proper line-by-line audio interleaving for a more natural-sounding episode. You also track the team's ElevenLabs character budget — announce usage out loud.

---

### Task 1: ElevenLabs TTS

Create `lib/elevenlabs.ts` and export a `generateVoice` function.

```typescript
// lib/elevenlabs.ts
const ALEX_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel — clear, warm
const SAM_VOICE_ID  = 'ErXwobaYiN019PkySvjV'  // Antoni — deeper, authoritative

export { ALEX_VOICE_ID, SAM_VOICE_ID }

export async function generateVoice(text: string, voiceId: string): Promise<ArrayBuffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1', // use this on free tier
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  })
  return res.arrayBuffer()
}
```

Rahul's API route calls this. Test with `"Hello, this is a test."` only during dev — 22 chars, never a full script.

### Your success condition (Task 1)
`generateVoice("Hello, this is a test.", ALEX_VOICE_ID)` returns an ArrayBuffer that plays as MP3 audio. Tell Rahul when it's ready so he can wire it into the route.

---

### Task 2: ElevenLabs budget tracking

You are the team's character counter. Announce usage out loud, don't track silently.

- **Dev testing:** `"Hello, this is a test."` only — 22 chars
- **Demo generation:** 3 episodes × ~1,500 chars = ~4,500 chars
- **Remaining buffer:** ~5,500 chars across the team for iteration

**Alert the group immediately if anyone's account approaches 8,000 characters.**

---

### Task 3: Audio stitching (only if Tasks 1+2 done before 12:45)

The MVP joins all Alex lines into one block and all Sam lines into another. True interleaving generates one audio clip per line and plays them in dialogue order — sounds much more like a real conversation.

```typescript
// lib/audio.ts
export function stitchAudio(buffers: ArrayBuffer[]): ArrayBuffer {
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const buffer of buffers) {
    result.set(new Uint8Array(buffer), offset)
    offset += buffer.byteLength
  }
  return result.buffer
}
```

Flag to Rahul before pursuing — it costs more ElevenLabs characters and more API calls. Only do it if the character budget allows and the MVP is already stable.

Simple byte concatenation works for MP3 in most cases. If there are audible glitches at joins, insert a small silence buffer (a few hundred bytes of zeros) between segments.
