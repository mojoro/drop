import { NextResponse } from "next/server";
import { extractContent } from "@/lib/needle";
import { generateScriptFeatherless } from "@/lib/featherless";
import { generateScriptClaude } from "@/lib/claude";
import { generateScriptOllama } from "@/lib/ollama";
import { parseScript, getScriptStats } from "@/lib/script";
import { generateVoice, DEFAULT_ALEX_VOICE, DEFAULT_SAM_VOICE } from "@/lib/tts";
import { stitchWav } from "@/lib/wavStitching";

export const runtime = "nodejs";

type ScriptBackend = "ollama" | "featherless" | "claude";

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

    const extracted = await extractContent(input);

    // ── Script generation: Ollama → Featherless → Claude ───────────────────
    let script: string | undefined;
    let scriptBackend: ScriptBackend = "claude";

    if (process.env.OLLAMA_MODEL) {
      try {
        script = await generateScriptOllama(extracted);
        scriptBackend = "ollama";
      } catch (e) {
        console.warn("Ollama failed, falling back:", e);
      }
    }

    if (script === undefined) {
      try {
        script = await generateScriptFeatherless(extracted);
        scriptBackend = "featherless";
      } catch (e) {
        console.warn("Featherless failed, falling back to Claude:", e);
      }
    }

    if (script === undefined) {
      script = await generateScriptClaude(extracted);
      scriptBackend = "claude";
    }

    const scriptLines = parseScript(script);
    const stats = getScriptStats(scriptLines);

    // ── TTS: generate per line, stitch into one WAV ─────────────────────────
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
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
