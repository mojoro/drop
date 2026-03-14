import { NextResponse } from "next/server";
import { extractContent } from "@/lib/needle";
import { generateScriptFeatherless } from "@/lib/featherless";
import { parseScript, getScriptStats } from "@/lib/script";
import { generateVoice, ALEX_VOICE_ID, SAM_VOICE_ID } from "@/lib/elevenlabs";
import { stitchAudio } from "@/lib/audioStitching";

export const runtime = "nodejs";

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

    const extracted = await extractContent(input);
    const script = await generateScriptFeatherless(extracted);
    const scriptLines = parseScript(script);
    const stats = getScriptStats(scriptLines);

    // Generate audio per line in dialogue order, then stitch into one file
    const buffers: ArrayBuffer[] = [];
    for (const line of scriptLines) {
      const voiceId = line.speaker === "ALEX" ? ALEX_VOICE_ID : SAM_VOICE_ID;
      const buf = await generateVoice(line.text, voiceId);
      buffers.push(buf);
    }

    const stitched = stitchAudio(buffers);
    const audio = Buffer.from(stitched).toString("base64");

    return NextResponse.json({
      scriptLines,
      audio,
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
