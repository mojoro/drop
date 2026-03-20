const API_URL = "https://api.elevenlabs.io/v1";

export const FALLBACK_VOICES = [
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

/**
 * Fetch voices dynamically from the ElevenLabs API.
 * Returns the same shape as FALLBACK_VOICES.
 */
export async function fetchVoices(apiKey: string): Promise<{ id: string; name: string; gender: string }[]> {
  const res = await fetch(`${API_URL}/voices`, {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs voices API failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    voices: { voice_id: string; name: string; labels?: { gender?: string } }[];
  };

  return data.voices.map((v) => ({
    id: v.voice_id,
    name: v.name,
    gender: v.labels?.gender ?? "unknown",
  }));
}

export const DEFAULT_ALEX_VOICE = "Fahco4VZzobUeiPqni1S"; // Archer
export const DEFAULT_SAM_VOICE = "BIvP0GN1cAtSRTxNHnWS"; // Ellen

/**
 * Generate speech via ElevenLabs. Returns MP3 ArrayBuffer.
 */
/** Map display language names to ElevenLabs language codes. */
const ELEVENLABS_LANG_MAP: Record<string, string> = {
  German: "de", French: "fr", Spanish: "es", Italian: "it",
  Portuguese: "pt", Dutch: "nl", Polish: "pl", Japanese: "ja",
  Chinese: "zh", Korean: "ko", Arabic: "ar", Hindi: "hi",
  Turkish: "tr", Russian: "ru",
};

export async function generateVoice(text: string, voiceId: string, apiKey: string, language?: string): Promise<ArrayBuffer> {
  const body: Record<string, unknown> = {
    text,
    model_id: "eleven_multilingual_v2",
    output_format: "mp3_44100_128",
  };
  if (language && ELEVENLABS_LANG_MAP[language]) {
    body.language_code = ELEVENLABS_LANG_MAP[language];
  }
  const res = await fetch(`${API_URL}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`ElevenLabs TTS failed: ${msg}`);
  }

  return res.arrayBuffer();
}
