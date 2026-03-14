import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ALEX_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // User confirmed working ID
const SAM_VOICE_ID = 'ErXwobaYiN019PkySvjV'; // Antonia (may still be restricted)

const USAGE_FILE = join(process.cwd(), 'usage.csv');
const IS_READONLY_FS = !!process.env.VERCEL;

export { ALEX_VOICE_ID, SAM_VOICE_ID }

export function getCharacterCounter(): number {
    if (IS_READONLY_FS || !existsSync(USAGE_FILE)) {
        return 0;
    }
    try {
        const content = readFileSync(USAGE_FILE, 'utf-8');
        const total = parseInt(content.trim(), 10);
        return isNaN(total) ? 0 : total;
    } catch {
        return 0;
    }
}

export function addToCharacterCounter(count: number): void {
    if (IS_READONLY_FS) {
        console.log(`[ElevenLabs] chars used this request: ${count}`);
        return;
    }
    const current = getCharacterCounter();
    try {
        writeFileSync(USAGE_FILE, (current + count).toString(), 'utf-8');
    } catch {
        // Silently skip if filesystem is unexpectedly read-only
    }
}

const client = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function generateVoice(text: string, voiceId: string): Promise<ArrayBuffer> {
    const audioStream = await client.textToSpeech.convert(voiceId, {
        text,
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_128',
    });

    // Convert the readable stream to a buffer then to ArrayBuffer
    const chunks: Uint8Array[] = [];
    const reader = (audioStream as unknown as ReadableStream<Uint8Array>).getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);

    // Track usage after successful generation
    addToCharacterCounter(text.length);

    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}