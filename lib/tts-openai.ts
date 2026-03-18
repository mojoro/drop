const API_URL = "https://api.openai.com/v1/audio/speech";

export const OPENAI_VOICES = [
  { id: "alloy", name: "Alloy", gender: "neutral" },
  { id: "echo", name: "Echo", gender: "male" },
  { id: "fable", name: "Fable", gender: "neutral" },
  { id: "onyx", name: "Onyx", gender: "male" },
  { id: "nova", name: "Nova", gender: "female" },
  { id: "shimmer", name: "Shimmer", gender: "female" },
];

export const DEFAULT_ALEX_VOICE = "echo";
export const DEFAULT_SAM_VOICE = "nova";

/**
 * Generate speech via OpenAI TTS. Returns WAV ArrayBuffer.
 */
export async function generateVoice(text: string, voice: string, apiKey: string): Promise<ArrayBuffer> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
      response_format: "wav",
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`OpenAI TTS failed: ${msg}`);
  }

  return res.arrayBuffer();
}
