import { execFile } from "child_process";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { generateVoice as generateLocal, fetchVoices as fetchLocalVoices } from "./tts";
import { generateVoice as generateElevenLabs, fetchVoices as fetchElevenLabsVoices, FALLBACK_VOICES as ELEVENLABS_FALLBACK, DEFAULT_ALEX_VOICE as EL_ALEX, DEFAULT_SAM_VOICE as EL_SAM } from "./tts-elevenlabs";
import { generateVoice as generateOpenAI, OPENAI_VOICES, DEFAULT_ALEX_VOICE as OA_ALEX, DEFAULT_SAM_VOICE as OA_SAM } from "./tts-openai";
import { generateVoice as generateQwen, fetchVoices as fetchQwenVoices, DEFAULT_ALEX_VOICE as QW_ALEX, DEFAULT_SAM_VOICE as QW_SAM } from "./tts-qwen";

export type TtsBackend = "local" | "elevenlabs" | "openai" | "qwen";

export type TtsConfig = {
  backend: TtsBackend;
  elevenlabsKey?: string;
  openaiKey?: string;
  language?: string;
};

export type VoiceInfo = {
  id: string;
  name: string;
  type: "builtin" | "custom";
};

/** Convert MP3 buffer to WAV via ffmpeg. */
async function mp3ToWav(mp3: ArrayBuffer): Promise<ArrayBuffer> {
  const dir = await mkdtemp(join(tmpdir(), "drop-tts-"));
  const mp3Path = join(dir, "in.mp3");
  const wavPath = join(dir, "out.wav");
  try {
    await writeFile(mp3Path, Buffer.from(mp3));
    await new Promise<void>((resolve, reject) => {
      execFile("ffmpeg", ["-i", mp3Path, "-ar", "24000", "-ac", "1", "-y", wavPath], (err) => {
        if (err) reject(new Error(`ffmpeg MP3→WAV failed: ${err.message}`));
        else resolve();
      });
    });
    const wav = await readFile(wavPath);
    return wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength);
  } finally {
    await unlink(mp3Path).catch(() => {});
    await unlink(wavPath).catch(() => {});
    await unlink(dir).catch(() => {});
  }
}

/** Get default voices for Alex and Sam per backend. */
export function getDefaultVoices(backend: TtsBackend): { alex: string; sam: string } {
  switch (backend) {
    case "elevenlabs": return { alex: EL_ALEX, sam: EL_SAM };
    case "openai":     return { alex: OA_ALEX, sam: OA_SAM };
    case "qwen":       return { alex: QW_ALEX, sam: QW_SAM };
    default:           return { alex: "alba", sam: "marius" };
  }
}

/** List available voices for a TTS backend. */
export async function listVoices(config: TtsConfig): Promise<VoiceInfo[]> {
  switch (config.backend) {
    case "elevenlabs": {
      let voices = ELEVENLABS_FALLBACK;
      if (config.elevenlabsKey) {
        try {
          voices = await fetchElevenLabsVoices(config.elevenlabsKey);
        } catch {
          // API call failed — use fallback list
        }
      }
      return voices.map(v => ({ id: v.id, name: v.name, type: "builtin" as const }));
    }

    case "openai":
      return OPENAI_VOICES.map(v => ({ id: v.id, name: v.name, type: "builtin" as const }));

    case "qwen": {
      try {
        const voices = await fetchQwenVoices();
        return [
          ...voices.builtin.map(name => ({ id: name, name, type: "builtin" as const })),
          ...voices.custom.map(name => ({ id: name, name, type: "custom" as const })),
        ];
      } catch {
        return [];
      }
    }

    case "local":
    default: {
      try {
        const voices = await fetchLocalVoices();
        return [
          ...voices.builtin.map(name => ({ id: name, name, type: "builtin" as const })),
          ...voices.custom.map(name => ({ id: name, name, type: "custom" as const })),
        ];
      } catch {
        return [];
      }
    }
  }
}

/** Generate speech for a single line. Always returns WAV ArrayBuffer. */
export async function synthesizeLine(text: string, voice: string, config: TtsConfig): Promise<ArrayBuffer> {
  switch (config.backend) {
    case "elevenlabs": {
      if (!config.elevenlabsKey) throw new Error("ElevenLabs API key not configured");
      const mp3 = await generateElevenLabs(text, voice, config.elevenlabsKey, config.language);
      return mp3ToWav(mp3);
    }

    case "openai": {
      if (!config.openaiKey) throw new Error("OpenAI API key not configured");
      return generateOpenAI(text, voice, config.openaiKey);
    }

    case "qwen":
      return generateQwen(text, voice, config.language);

    case "local":
    default:
      return generateLocal(text, voice, config.language);
  }
}
