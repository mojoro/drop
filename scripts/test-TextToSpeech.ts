// scripts/test-tts.ts
// Quick smoke-test: generates a short MP3 and writes it to test-output.mp3
// Usage:  npx ts-node scripts/test-tts.ts

import 'dotenv/config'
import { writeFileSync } from 'fs'
import { generateVoice, SAM_VOICE_ID, ALEX_VOICE_ID } from '../lib/elevenlabs'

const TEST_TEXT = 'Hello, this is a test.' // 22 chars — minimal budget hit

async function main() {
    console.log(`🎙  Generating voice for: "${TEST_TEXT}"`)
    console.log(`   Characters used: ${TEST_TEXT.length}`)
    console.log(`   Voice ID: ${SAM_VOICE_ID} `)
    console.log()

    const audio = await generateVoice(TEST_TEXT, SAM_VOICE_ID)
    const buffer = Buffer.from(audio)

    writeFileSync('test-output.mp3', buffer)

    console.log(`✅ Success! Wrote ${buffer.length} bytes to test-output.mp3`)
    console.log(`   📊 ElevenLabs budget: ${TEST_TEXT.length} characters consumed this run`)
}

main().catch((err) => {
    console.error('❌ TTS test failed:', err.message ?? err)
    process.exit(1)
})
