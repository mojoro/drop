import { NextResponse } from "next/server";
import { extractContent } from "@/lib/scrape";
import { generateScriptOpenRouter } from "@/lib/openrouter";
import { generateScriptFeatherless } from "@/lib/featherless";
import { generateScriptClaude } from "@/lib/claude";
import { generateScriptOllama } from "@/lib/ollama";
import { parseScript, getScriptStats } from "@/lib/script";
import { generateVoice, DEFAULT_ALEX_VOICE, DEFAULT_SAM_VOICE } from "@/lib/tts";
import { stitchWav } from "@/lib/wavStitching";

export const runtime = "nodejs";

type ScriptBackend = "ollama" | "openrouter" | "featherless" | "claude";

type ClientSettings = {
  openrouterKey?: string;
  openrouterModel?: string;
  featherlessKey?: string;
  anthropicKey?: string;
  needleKey?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
};

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
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

    // Client settings override env vars
    const settings: ClientSettings = body?.settings ?? {};

    // Temporarily override env vars with client-provided keys for this request
    const envOverrides: Record<string, string | undefined> = {};
    if (settings.needleKey) {
      envOverrides.NEEDLE_API_KEY = process.env.NEEDLE_API_KEY;
      process.env.NEEDLE_API_KEY = settings.needleKey;
    }
    if (settings.ollamaUrl) {
      envOverrides.OLLAMA_URL = process.env.OLLAMA_URL;
      process.env.OLLAMA_URL = settings.ollamaUrl;
    }
    if (settings.ollamaModel) {
      envOverrides.OLLAMA_MODEL = process.env.OLLAMA_MODEL;
      process.env.OLLAMA_MODEL = settings.ollamaModel;
    }
    if (settings.featherlessKey) {
      envOverrides.FEATHERLESS_API_KEY = process.env.FEATHERLESS_API_KEY;
      process.env.FEATHERLESS_API_KEY = settings.featherlessKey;
    }
    if (settings.anthropicKey) {
      envOverrides.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = settings.anthropicKey;
    }

    try {
      const extracted = await extractContent(input);

      // ── Script generation: Ollama → OpenRouter → Featherless → Claude ─────
      let script: string | undefined;
      let scriptBackend: ScriptBackend = "claude";

      // 1. Ollama (local)
      const ollamaModel = settings.ollamaModel || process.env.OLLAMA_MODEL;
      if (ollamaModel) {
        try {
          script = await generateScriptOllama(extracted);
          scriptBackend = "ollama";
        } catch (e) {
          console.warn("Ollama failed, falling back:", e);
        }
      }

      // 2. OpenRouter
      if (script === undefined) {
        const orKey = settings.openrouterKey || process.env.OPENROUTER_API_KEY;
        if (orKey) {
          try {
            script = await generateScriptOpenRouter(extracted, orKey, settings.openrouterModel);
            scriptBackend = "openrouter";
          } catch (e) {
            console.warn("OpenRouter failed, falling back:", e);
          }
        }
      }

      // 3. Featherless
      if (script === undefined) {
        const flKey = settings.featherlessKey || process.env.FEATHERLESS_API_KEY;
        if (flKey) {
          try {
            script = await generateScriptFeatherless(extracted);
            scriptBackend = "featherless";
          } catch (e) {
            console.warn("Featherless failed, falling back:", e);
          }
        }
      }

      // 4. Claude (last resort)
      if (script === undefined) {
        const aKey = settings.anthropicKey || process.env.ANTHROPIC_API_KEY;
        if (!aKey) {
          throw new Error(
            "No LLM backend available. Configure Ollama, OpenRouter, Featherless, or Anthropic in settings."
          );
        }
        script = await generateScriptClaude(extracted);
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
