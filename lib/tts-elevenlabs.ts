const API_URL = "https://api.elevenlabs.io/v1";

export const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: "female" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", gender: "male" },
  { id: "Fahco4VZzobUeiPqni1S", name: "Archer", gender: "male" },
  { id: "BIvP0GN1cAtSRTxNHnWS", name: "Ellen", gender: "female" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", gender: "female" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", gender: "female" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", gender: "male" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", gender: "male" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", gender: "male" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", gender: "male" },
];

export const DEFAULT_ALEX_VOICE = "Fahco4VZzobUeiPqni1S"; // Archer
export const DEFAULT_SAM_VOICE = "BIvP0GN1cAtSRTxNHnWS"; // Ellen

/**
 * Generate speech via ElevenLabs. Returns MP3 ArrayBuffer.
 */
export async function generateVoice(text: string, voiceId: string, apiKey: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`ElevenLabs TTS failed: ${msg}`);
  }

  return res.arrayBuffer();
}
