// scripts/test-Stitching.ts
// This tests the stitching of audio buffers
// Also saves the converstion in conversation.mp3
import 'dotenv/config'
import { writeFileSync } from 'fs'
import { generateVoice, SAM_VOICE_ID, ALEX_VOICE_ID } from '../lib/elevenlabs'
import { stitchAudio } from '../lib/audioStitching'

async function main() {
    console.log('🎙  Starting conversation generation...')

    const lines = [
        { text: "Hey Alex, how's it going?", voiceId: SAM_VOICE_ID, name: "Sam" },
        { text: "Great, Sam! Just testing some new features.", voiceId: ALEX_VOICE_ID, name: "Alex" },
        { text: "Awesome, let's see if this works!", voiceId: SAM_VOICE_ID, name: "Sam" }
    ]

    const buffers: ArrayBuffer[] = []

    for (const line of lines) {
        console.log(`   Generating for ${line.name}: "${line.text}"`)
        const audio = await generateVoice(line.text, line.voiceId)
        buffers.push(audio)
    }

    console.log('🧵 Stitching audio buffers...')
    const stitched = stitchAudio(buffers)
    const finalBuffer = Buffer.from(stitched)

    writeFileSync('conversation.mp3', finalBuffer)

    console.log(`✅ Success! Wrote ${finalBuffer.length} bytes to conversation.mp3`)
}

main().catch((err) => {
    console.error('❌ Stitching test failed:', err.message ?? err)
    process.exit(1)
})
