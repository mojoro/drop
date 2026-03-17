const TTS_URL = process.env.TTS_SERVER_URL || 'http://localhost:8000';

export const DEFAULT_ALEX_VOICE = 'alba';
export const DEFAULT_SAM_VOICE = 'marius';

export type VoiceList = {
  builtin: string[];
  custom: string[];
};

export async function fetchVoices(): Promise<VoiceList> {
  const res = await fetch(`${TTS_URL}/tts/voices`);
  if (!res.ok) throw new Error(`TTS server error: ${res.status}`);
  return res.json();
}

export async function cloneVoice(name: string, file: File): Promise<{ voice: string }> {
  const form = new FormData();
  form.append('name', name);
  form.append('file', file);
  const res = await fetch(`${TTS_URL}/tts/clone-voice`, { method: 'POST', body: form });
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`Voice cloning failed: ${msg}`);
  }
  return res.json();
}

export async function generateVoice(text: string, voice: string): Promise<ArrayBuffer> {
  const res = await fetch(`${TTS_URL}/tts/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`TTS generation failed: ${msg}`);
  }
  return res.arrayBuffer();
}
