/**
 * One-shot demo episode generator.
 * Run once locally: npx tsx scripts/generate-demo.ts
 * Output: public/demos/portfolio.mp3
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { generateVoice } from '../lib/elevenlabs'
import { stitchAudio } from '../lib/audioStitching'

const GEORGE_VOICE = 'Fahco4VZzobUeiPqni1S' // Archer  — warm British male
const JESSICA_VOICE = 'BIvP0GN1cAtSRTxNHnWS' // Ellen — serious, direct German

const SCRIPT: { speaker: 'ALEX' | 'SAM'; text: string }[] = [
  { speaker: 'ALEX', text: "There's a framing I keep coming back to: attention as infrastructure. What do you mean by that?" },
  { speaker: 'SAM', text: "Think about what we protect as essential — roads, water, power. Attention is the substrate everything else runs on. When it's captured and monetized at scale, everything downstream degrades: democracy, mental health, the quality of decisions we make." },
  { speaker: 'ALEX', text: "Aren't people just choosing to use their phones?" },
  { speaker: 'SAM', text: "We said the same thing about cigarettes. The engineering effort that goes into keeping you scrolling would make a missile guidance system look unsophisticated." },
  { speaker: 'ALEX', text: "But governments regulate tobacco. Why hasn't that happened here?" },
  { speaker: 'SAM', text: "Because the harm is diffuse and delayed. Cigarettes gave you lung cancer. Attention capture gives you — what? A slightly shorter attention span? A vague sense that you're not living your actual life? It's harder to litigate." },
  { speaker: 'ALEX', text: "Is the problem the platforms, or is it something deeper about human psychology?" },
  { speaker: 'SAM', text: "Both. We didn't evolve to handle infinite novelty delivered at machine speed. Our reward systems weren't built for this. But the platforms know that, and they built their products around it deliberately." },
  { speaker: 'ALEX', text: "What does protecting attention actually look like in practice?" },
  { speaker: 'SAM', text: "It looks like treating distraction the way we treat pollution. You can pollute your own land — up to a point. But when your runoff gets into the shared water supply, that's a public health problem. Captured attention is the same. It degrades our collective ability to think." },
  { speaker: 'ALEX', text: "Last word?" },
  { speaker: 'SAM', text: "The most valuable thing you own isn't your house or your savings. It's the hours of genuine focus you have left in your life. The question is who you're going to let spend them." },
]

async function main() {
  console.log('🎙  Generating demo episode: "Attention as Infrastructure"\n')

  const buffers: ArrayBuffer[] = []

  for (const line of SCRIPT) {
    const voiceId = line.speaker === 'SAM' ? GEORGE_VOICE : JESSICA_VOICE
    const label = line.speaker === 'SAM' ? 'George (Sam)' : 'Jessica (Alex)'
    console.log(`   ${line.speaker}  [${label}]: "${line.text.slice(0, 60)}…"`)
    const audio = await generateVoice(line.text, voiceId)
    buffers.push(audio)
  }

  console.log('\n🧵 Stitching audio…')
  const stitched = stitchAudio(buffers)

  const outDir = join(process.cwd(), 'public', 'demos')
  const outFile = join(outDir, 'portfolio.mp3')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(outFile, Buffer.from(stitched))

  const kb = Math.round(Buffer.from(stitched).length / 1024)
  console.log(`\n✅  Saved ${kb} KB → public/demos/portfolio.mp3`)
  console.log(`   Total chars: ${SCRIPT.reduce((n, l) => n + l.text.length, 0)} (ElevenLabs usage)`)
}

main().catch(err => {
  console.error('❌', err.message ?? err)
  process.exit(1)
})
