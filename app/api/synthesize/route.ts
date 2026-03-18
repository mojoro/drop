import { NextResponse } from "next/server";
import { generateVoice, DEFAULT_ALEX_VOICE, DEFAULT_SAM_VOICE } from "@/lib/tts";
import { stitchWav } from "@/lib/wavStitching";

export const runtime = "nodejs";

/**
 * Re-synthesize audio from an existing script (no LLM call).
 * Accepts { scriptLines, alexVoice, samVoice }.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scriptLines, alexVoice, samVoice } = body;

    if (!Array.isArray(scriptLines) || scriptLines.length === 0) {
      return NextResponse.json({ error: "Missing scriptLines" }, { status: 400 });
    }

    const aVoice = typeof alexVoice === "string" ? alexVoice : DEFAULT_ALEX_VOICE;
    const sVoice = typeof samVoice === "string" ? samVoice : DEFAULT_SAM_VOICE;

    const buffers: ArrayBuffer[] = [];
    for (const line of scriptLines) {
      const voice = line.speaker === "ALEX" ? aVoice : sVoice;
      const buf = await generateVoice(line.text, voice);
      buffers.push(buf);
    }

    const stitched = stitchWav(buffers);
    const audio = Buffer.from(stitched).toString("base64");

    return NextResponse.json({ audio });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Synthesis failed" },
      { status: 500 }
    );
  }
}
