import { NextResponse } from "next/server";
import { extractContent } from "@/lib/needle";
import { generateScriptFeatherless } from "@/lib/featherless";
import { parseScript, getScriptStats } from "@/lib/script";
import { generateVoice, ALEX_VOICE_ID, SAM_VOICE_ID } from "@/lib/elevenlabs";

export const runtime = "nodejs";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function toBase64(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString("base64");
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

    const alexText = scriptLines
      .filter((l) => l.speaker === "ALEX")
      .map((l) => l.text)
      .join(" ");
    const samText = scriptLines
      .filter((l) => l.speaker === "SAM")
      .map((l) => l.text)
      .join(" ");

    const [alexBuffer, samBuffer] = await Promise.all([
      generateVoice(alexText, ALEX_VOICE_ID),
      generateVoice(samText, SAM_VOICE_ID),
    ]);

    return NextResponse.json({
      scriptLines,
      alexAudio: toBase64(alexBuffer),
      samAudio: toBase64(samBuffer),
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
