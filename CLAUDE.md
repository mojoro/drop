# CLAUDE.md — Drop Hackathon Master Brief
## AI Mini Hackathon Berlin — March 14, 2026

---

## Project Overview

**App name:** Drop

**One-liner:** Paste any URL or topic and get a shareable 2-voice podcast episode in 60 seconds.

**How it works:**
1. User enters a URL or free-text topic
2. Needle extracts and chunks the content cleanly
3. Claude Sonnet writes a dialogue script between two hosts (Alex and Sam)
4. ElevenLabs generates audio for each host voice in parallel
5. Audio plays in the browser and can be shared via Superchat (WhatsApp)

**Stack:**
- Next.js (App Router) with TypeScript
- Tailwind CSS
- Anthropic Claude Sonnet (`claude-sonnet-4-20250514`) for script generation
- ElevenLabs free tier for TTS
- Needle for URL ingestion
- Featherless as an alternative LLM toggle
- Superchat for WhatsApp sharing

**Environment variables — create `.env.local` immediately:**
```
ANTHROPIC_API_KEY=
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
- AI Masters student tracks character usage across all three accounts out loud

**Demo episodes to pre-generate before 13:00:**
1. "The future of AI podcasting" — for Rod Rivera (podcast co-host, AI professor)
2. "How AI is changing strategy consulting" — for Carla Schneider (BCG)
3. "Open source vs closed models in 2025" — for Dan Makarov (BrowserStack, ex-Google)

Save as `/public/demos/rod.mp3`, `/public/demos/carla.mp3`, `/public/demos/dan.mp3`

---

## Team

| Person | Owns |
|--------|------|
| John | Claude API route + ElevenLabs + UI + Pitch |
| AI Masters Student | Needle integration + ElevenLabs budget tracking |
| Math PhD | Featherless integration + audio stitching |

---

## Timeline

| Time | Milestone |
|------|-----------|
| 11:00 | Repo running, roles confirmed, all API keys in `.env.local` |
| 11:20 | Claude API route returns a script from a hardcoded topic |
| 11:40 | ElevenLabs returns audio from a hardcoded 1-line test string |
| 11:50 | Needle returns clean text from a test URL |
| 12:00 | Full pipeline connected — URL in, audio out |
| 12:20 | UI wired to real API, audio plays in browser |
| **12:30** | **DEMO MILESTONE — working demo locked. Stop adding features.** |
| 12:30–13:00 | Pre-generate 3 demo episodes, add Featherless toggle, add Superchat button |
| 13:00–13:30 | UI polish, wire fallback audio players to `/public/demos/` |
| 13:30 | Pitch rehearsal — run it twice out loud |
| 14:00 | Pitches begin |

---

## The Pitch (2 minutes — John presents)

> *"We built Drop. Paste any URL or topic and get a podcast episode in 60 seconds — two real voices, real conversation, shareable audio."*

> **[Play pre-generated Rod episode — do not generate live]**

> *"Needle handles the URL ingestion. Claude Sonnet writes the script. ElevenLabs generates the voices. Toggle to Featherless if you want a fully open-weight stack. Share it instantly via WhatsApp through Superchat."*

> *"Three hours. Four sponsor integrations. One thing that actually works."*

**The Rod move:** Find Sina (the moderator) before pitches start. Tell her you generated an episode about AI podcasting and ask if Rod can hear it during the demo. Do this before 13:50.

---
---

# Team Member Briefs

---

## 👤 John — Pipeline Lead + ElevenLabs + UI + Pitch

### Your job
You own the most ground. Core pipeline, ElevenLabs integration, the frontend, and the pitch. The other two each hand you one clean module — Needle text extraction and a Featherless function — and you assemble everything. Your instinct at all times: **cut, don't add.** You decide what's in scope.

---

### What you build

**File 1: `app/api/generate/route.ts`** — the full pipeline

Receives `POST { input: string, model: "claude" | "featherless" }` and:
1. Calls `extractContent(input)` from AI Masters student → clean text
2. Calls Claude or Featherless depending on `model` → script string
3. Parses script into `{ speaker, text }[]` line array
4. Calls ElevenLabs twice in parallel → two audio buffers
5. Returns `{ scriptLines, alexAudio, samAudio }` as base64

**File 2: `app/page.tsx`** — the entire UI (build against mocked data first)

---

### The Claude API call

```typescript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: `You are a podcast script writer. Given the following content, write a punchy 90-second podcast dialogue between two hosts: Alex (curious, conversational, asks sharp questions) and Sam (the expert, gives direct takes with no fluff). Format every line strictly as "ALEX: ..." or "SAM: ..." with no other text, headers, or commentary. Aim for 7–9 exchanges total. End with a memorable one-line takeaway from Sam.\n\nContent: ${cleanedText}`
    }]
  })
})
const data = await response.json()
const script = data.content[0].text
```

Use `claude-sonnet-4-20250514`. Not Opus (too slow), not Haiku (quality too low).

---

### Script parsing

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

---

### ElevenLabs integration

```typescript
const ALEX_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel — clear, warm
const SAM_VOICE_ID  = 'ErXwobaYiN019PkySvjV'  // Antoni — deeper, authoritative

async function generateVoice(text: string, voiceId: string): Promise<ArrayBuffer> {
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

// In the route handler — call both in parallel:
const alexText = scriptLines.filter(l => l.speaker === 'ALEX').map(l => l.text).join(' ')
const samText  = scriptLines.filter(l => l.speaker === 'SAM').map(l => l.text).join(' ')

const [alexBuffer, samBuffer] = await Promise.all([
  generateVoice(alexText, ALEX_VOICE_ID),
  generateVoice(samText, SAM_VOICE_ID)
])

const toBase64 = (buf: ArrayBuffer) => Buffer.from(buf).toString('base64')

return Response.json({
  scriptLines,
  alexAudio: toBase64(alexBuffer),
  samAudio: toBase64(samBuffer)
})
```

---

### UI — `app/page.tsx`

Build against this mock first — do not wait for the backend:

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
1. Large text input — placeholder: *"Paste a URL or describe a topic..."*
2. Small toggle: **Claude Sonnet** / **Featherless** — default Claude
3. Big generate button
4. Loading states: *"Writing script..."* → *"Generating audio..."*
5. `<audio controls>` player wired to base64 response
6. Transcript — Alex lines in muted blue `#6b9fd4`, Sam lines in warm amber `#d4a843`
7. "Share on WhatsApp" button (Superchat)

Wiring the audio player:
```typescript
const src = `data:audio/mpeg;base64,${data.alexAudio}`
// <audio src={src} controls autoPlay />
// MVP: play Alex block then Sam block sequentially
```

Superchat share button:
```typescript
async function shareToWhatsApp(topic: string) {
  await fetch('https://api.superchat.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPERCHAT_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      channel: 'whatsapp',
      message: `🎙️ Just generated a podcast about "${topic}" with Drop.`
    })
  })
}
```

If Superchat proves complex, fall back to `navigator.clipboard.writeText()`. Don't lose time on it.

**Design:** dark background `#0a0a0a`, centered card `max-w-2xl`, clean sans-serif. Max 25 minutes on styling.

---

### Your success condition
`POST /api/generate` with `{ input: "artificial intelligence" }` returns base64 audio that plays in an `<audio>` element. Once that works, everything else is polish.

Wrap everything in `try/catch`. Return `{ error: string }` on failure — no silent errors.

---

## 👤 AI Masters Student — Needle Integration + ElevenLabs Budget

### Your job
Two things: build the Needle content extraction module that John imports, and track the team's ElevenLabs character usage. Both are critical to the demo surviving the day.

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
    // Plain text topic — pass straight through to Claude
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

Check Needle docs for exact method signatures — the flow is right: create collection → add URL → search → return joined text. Tell John when it's ready and which file it's in.

### Your success condition
`extractContent("https://www.bbc.com/news")` returns readable plain text — not HTML, not JSON, not an error. Quick `console.log` check is enough. Done.

### If you finish early
Try a tighter search query: `"key claims evidence conclusions"` instead of the general one. Better retrieval = better scripts. Worth 15 minutes of experimentation.

---

### Task 2: ElevenLabs budget tracking

You are the team's character counter. Announce usage out loud, don't track silently.

- **Dev testing:** `"Hello, this is a test."` only — 22 chars
- **Demo generation:** 3 episodes × ~1,500 chars = ~4,500 chars (on John's account)
- **Remaining buffer:** ~5,500 chars across the team for iteration

**Alert the group immediately if anyone's account approaches 8,000 characters.** This is the one thing that could silently kill the demo, and it's entirely preventable.

---

## 👤 Math PhD — Featherless Integration + Audio Stitching

### Your job
Two tasks. Wire up Featherless as an alternative LLM that John toggles to via request param. Then, if time allows, implement proper line-by-line audio interleaving for a more natural-sounding episode. Both are well-defined transformation problems.

---

### Task 1: Featherless integration

Create `lib/featherless.ts` and export one function. Featherless exposes an OpenAI-compatible API.

```typescript
// lib/featherless.ts
export async function generateScriptFeatherless(content: string): Promise<string> {
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

  // Safety check — Featherless is less strict about format than Claude
  if (!script.includes('ALEX:') || !script.includes('SAM:')) {
    throw new Error('Invalid script format from Featherless — retry')
  }

  return script
}
```

This function has the same signature as John's Claude call. He picks which one based on `model` in the request body. Good fallback model if Llama-3.3-70B is slow: `mistralai/Mixtral-8x7B-Instruct-v0.1`

### Your success condition
`generateScriptFeatherless("artificial intelligence")` returns a string containing both `"ALEX:"` and `"SAM:"` lines without throwing. Tell John it's ready.

Do not spend more than 50 minutes on Task 1. If stuck, ask John — unblocking the pipeline beats any individual task.

---

### Task 2: Audio stitching (only if Task 1 done before 12:45)

John's MVP joins all Alex lines into one block and all Sam lines into another. True interleaving generates one audio clip per line and plays them in dialogue order — sounds much more like a real conversation.

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

For this to work, John needs to call ElevenLabs once per script line in sequence and collect the buffers in order. Flag this to John — it costs more ElevenLabs characters and more API calls. Only pursue it if the character budget allows and the MVP is already stable.

Simple byte concatenation works for MP3 in most cases. If there are audible glitches at joins, insert a small silence buffer (a few hundred bytes of zeros) between segments.
