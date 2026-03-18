import { NextResponse } from "next/server";
import { extractContent } from "@/lib/scrape";
import { generateScriptOpenRouter } from "@/lib/openrouter";
import { generateScriptFeatherless } from "@/lib/featherless";
import { generateScriptClaude } from "@/lib/claude";
import { generateScriptOllama } from "@/lib/ollama";
import { parseScript, getScriptStats } from "@/lib/script";
import { synthesizeLine, getDefaultVoices, type TtsBackend, type TtsConfig } from "@/lib/tts-router";
import { stitchWav } from "@/lib/wavStitching";
import { getProfile, type SettingsProfile } from "@/lib/storage";
import type { ScriptLength, ScriptLanguage } from "@/lib/prompt";

export const runtime = "nodejs";

type ScriptBackend = "ollama" | "openrouter" | "featherless" | "claude";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/** Resolve a config value: profile → env var → fallback. */
function cfg(profileVal: string | undefined, envKey: string, fallback = ""): string {
  return profileVal || process.env[envKey] || fallback;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = typeof body?.input === "string" ? body.input.trim() : "";

    if (!input) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const length: ScriptLength = ["short", "medium", "long"].includes(body?.length) ? body.length : "short";
    const language: ScriptLanguage | undefined = typeof body?.language === "string" && body.language ? body.language : undefined;

    // Load active profile from server (keys never come from the client)
    let profile: SettingsProfile | null = null;
    if (typeof body?.profile === "string" && body.profile) {
      profile = await getProfile(body.profile);
    }

    // Resolve TTS backend and config
    const ttsBackend: TtsBackend = (["local", "elevenlabs", "openai"].includes(body?.ttsBackend) ? body.ttsBackend
      : profile?.ttsBackend && ["local", "elevenlabs", "openai"].includes(profile.ttsBackend) ? profile.ttsBackend
      : "local") as TtsBackend;

    const ttsConfig: TtsConfig = {
      backend: ttsBackend,
      elevenlabsKey: cfg(profile?.elevenlabsKey, "ELEVENLABS_API_KEY"),
      openaiKey: cfg(profile?.openaiKey, "OPENAI_API_KEY"),
    };

    const defaults = getDefaultVoices(ttsBackend);
    const alexVoice = typeof body?.alexVoice === "string" ? body.alexVoice : defaults.alex;
    const samVoice  = typeof body?.samVoice  === "string" ? body.samVoice  : defaults.sam;

    // LLM config
    const ollamaModel = cfg(profile?.ollamaModel, "OLLAMA_MODEL");
    const ollamaUrl   = cfg(profile?.ollamaUrl, "OLLAMA_URL", "http://localhost:11434");
    const orKey       = cfg(profile?.openrouterKey, "OPENROUTER_API_KEY");
    const orModel     = profile?.openrouterModel || "";
    const flKey       = cfg(profile?.featherlessKey, "FEATHERLESS_API_KEY");
    const aKey        = cfg(profile?.anthropicKey, "ANTHROPIC_API_KEY");
    const needleKey   = cfg(profile?.needleKey, "NEEDLE_API_KEY");

    // Temporarily set env vars so downstream modules can read them
    const envOverrides: Record<string, string | undefined> = {};
    function setEnv(key: string, val: string) {
      if (val) {
        envOverrides[key] = process.env[key];
        process.env[key] = val;
      }
    }
    setEnv("OLLAMA_URL", ollamaUrl);
    setEnv("OLLAMA_MODEL", ollamaModel);
    setEnv("FEATHERLESS_API_KEY", flKey);
    setEnv("ANTHROPIC_API_KEY", aKey);
    setEnv("NEEDLE_API_KEY", needleKey);

    try {
      const extracted = await extractContent(input);

      // ── Script generation: Ollama → OpenRouter → Featherless → Claude ─────
      let script: string | undefined;
      let scriptBackend: ScriptBackend = "claude";

      if (ollamaModel) {
        try {
          script = await generateScriptOllama(extracted, length, language);
          scriptBackend = "ollama";
        } catch (e) {
          console.warn("Ollama failed, falling back:", e);
        }
      }

      if (script === undefined && orKey) {
        try {
          script = await generateScriptOpenRouter(extracted, orKey, orModel, length, language);
          scriptBackend = "openrouter";
        } catch (e) {
          console.warn("OpenRouter failed, falling back:", e);
        }
      }

      if (script === undefined && flKey) {
        try {
          script = await generateScriptFeatherless(extracted, length, language);
          scriptBackend = "featherless";
        } catch (e) {
          console.warn("Featherless failed, falling back:", e);
        }
      }

      if (script === undefined) {
        if (!aKey) {
          throw new Error(
            "No LLM backend available. Configure Ollama, OpenRouter, Featherless, or Anthropic in settings."
          );
        }
        script = await generateScriptClaude(extracted, length, language);
        scriptBackend = "claude";
      }

      const scriptLines = parseScript(script);
      const stats = getScriptStats(scriptLines);

      // ── TTS: generate per line, stitch into one WAV ──────────────────────
      const buffers: ArrayBuffer[] = [];
      for (const line of scriptLines) {
        const voice = line.speaker === "ALEX" ? alexVoice : samVoice;
        const buf = await synthesizeLine(line.text, voice, ttsConfig);
        buffers.push(buf);
      }

      const stitched = stitchWav(buffers);
      const audio = Buffer.from(stitched).toString("base64");

      return NextResponse.json({
        scriptLines,
        audio,
        scriptBackend,
        ttsBackend,
        debug: {
          extractedPreview: extracted.slice(0, 2500),
          rawScript: script,
          ...stats,
        },
      });
    } finally {
      for (const [key, val] of Object.entries(envOverrides)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      }
    }
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
