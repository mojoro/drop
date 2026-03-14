import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const ALEX_VOICE_ID = 'Fahco4VZzobUeiPqni1S'; // Archer — warm British male
const SAM_VOICE_ID  = 'BIvP0GN1cAtSRTxNHnWS'; // Ellen  — serious, direct German

export { ALEX_VOICE_ID, SAM_VOICE_ID }

function getClient() {
    return new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
}

export async function generateVoice(text: string, voiceId: string): Promise<ArrayBuffer> {
    const audioStream = await getClient().textToSpeech.convert(voiceId, {
        text,
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_128',
    });

    const chunks: Uint8Array[] = [];
    const reader = (audioStream as unknown as ReadableStream<Uint8Array>).getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}
