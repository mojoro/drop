/**
 * Qwen3-TTS sidecar client.
 *
 * Calls the qwen-tts-server sidecar which exposes the same HTTP contract
 * as the pocket-tts sidecar, so this module mirrors lib/tts.ts exactly
 * but points to QWEN_TTS_SERVER_URL (default: http://localhost:8001).
 */

const QWEN_URL = process.env.QWEN_TTS_SERVER_URL || "http://localhost:8001";

export const DEFAULT_ALEX_VOICE = "ryan";
export const DEFAULT_SAM_VOICE = "serena";

export type VoiceList = {
  builtin: string[];
  custom: string[];
};

export async function fetchVoices(): Promise<VoiceList> {
  const res = await fetch(`${QWEN_URL}/tts/voices`);
  if (!res.ok) throw new Error(`Qwen TTS server error: ${res.status}`);
  return res.json();
}

export async function generateVoice(
  text: string,
  voice: string,
  language?: string,
): Promise<ArrayBuffer> {
  const res = await fetch(`${QWEN_URL}/tts/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, language }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Qwen TTS generation failed: ${msg}`);
  }
  return res.arrayBuffer();
}
