import { NextResponse } from "next/server";
import { extractContent } from "@/lib/scrape";
import { generateScriptOpenRouter } from "@/lib/openrouter";
import { generateScriptFeatherless } from "@/lib/featherless";
import { generateScriptClaude } from "@/lib/claude";
import { generateScriptOllama } from "@/lib/ollama";
import { parseScript, getScriptStats } from "@/lib/script";
import { generateVoice, DEFAULT_ALEX_VOICE, DEFAULT_SAM_VOICE } from "@/lib/tts";
import { stitchWav } from "@/lib/wavStitching";
import { getProfile, type SettingsProfile } from "@/lib/storage";
import type { ScriptLength } from "@/lib/prompt";

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

    const alexVoice = typeof body?.alexVoice === "string" ? body.alexVoice : DEFAULT_ALEX_VOICE;
    const samVoice  = typeof body?.samVoice  === "string" ? body.samVoice  : DEFAULT_SAM_VOICE;
    const length: ScriptLength = ["short", "medium", "long"].includes(body?.length) ? body.length : "short";

    // Load active profile from server (keys never come from the client)
    let profile: SettingsProfile | null = null;
    if (typeof body?.profile === "string" && body.profile) {
      profile = await getProfile(body.profile);
    }

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

      // 1. Ollama (local)
      if (ollamaModel) {
        try {
          script = await generateScriptOllama(extracted, length);
          scriptBackend = "ollama";
        } catch (e) {
          console.warn("Ollama failed, falling back:", e);
        }
      }

      // 2. OpenRouter
      if (script === undefined && orKey) {
        try {
          script = await generateScriptOpenRouter(extracted, orKey, orModel, length);
          scriptBackend = "openrouter";
        } catch (e) {
          console.warn("OpenRouter failed, falling back:", e);
        }
      }

      // 3. Featherless
      if (script === undefined && flKey) {
        try {
          script = await generateScriptFeatherless(extracted, length);
          scriptBackend = "featherless";
        } catch (e) {
          console.warn("Featherless failed, falling back:", e);
        }
      }

      // 4. Claude (last resort)
      if (script === undefined) {
        if (!aKey) {
          throw new Error(
            "No LLM backend available. Configure Ollama, OpenRouter, Featherless, or Anthropic in settings."
          );
        }
        script = await generateScriptClaude(extracted, length);
        scriptBackend = "claude";
      }

      const scriptLines = parseScript(script);
      const stats = getScriptStats(scriptLines);

      // ── TTS: generate per line, stitch into one WAV ──────────────────────
      const buffers: ArrayBuffer[] = [];
      for (const line of scriptLines) {
        const voice = line.speaker === "ALEX" ? alexVoice : samVoice;
        const buf = await generateVoice(line.text, voice);
        buffers.push(buf);
      }

      const stitched = stitchWav(buffers);
      const audio = Buffer.from(stitched).toString("base64");

      return NextResponse.json({
        scriptLines,
        audio,
        scriptBackend,
        debug: {
          extractedPreview: extracted.slice(0, 2500),
          rawScript: script,
          ...stats,
        },
      });
    } finally {
      // Restore original env vars
      for (const [key, val] of Object.entries(envOverrides)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      }
    }
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
