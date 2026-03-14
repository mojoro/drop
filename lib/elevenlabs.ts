import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ALEX_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // User confirmed working ID
const SAM_VOICE_ID = 'ErXwobaYiN019PkySvjV'; // Antonia (may still be restricted)

const USAGE_FILE = join(process.cwd(), 'usage.csv');

export { ALEX_VOICE_ID, SAM_VOICE_ID }

export function getCharacterCounter(): number {
    if (!existsSync(USAGE_FILE)) {
        return 0;
    }
    try {
        const content = readFileSync(USAGE_FILE, 'utf-8');
        const total = parseInt(content.trim(), 10);
        return isNaN(total) ? 0 : total;
    } catch (error) {
        console.error('Error reading usage.csv:', error);
        return 0;
    }
}

export function addToCharacterCounter(count: number): void {
    // Adds the number to the persistent counter
    const current = getCharacterCounter();
    const updated = current + count;
    try {
        writeFileSync(USAGE_FILE, updated.toString(), 'utf-8');
    } catch (error) {
        console.error('Error writing to usage.csv:', error);
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