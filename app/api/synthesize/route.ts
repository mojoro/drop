import { NextResponse } from "next/server";
import { synthesizeLine, getDefaultVoices, type TtsBackend, type TtsConfig } from "@/lib/tts-router";
import { stitchWav } from "@/lib/wavStitching";
import { getProfile } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Re-synthesize audio from an existing script (no LLM call).
 * Accepts { scriptLines, alexVoice, samVoice, ttsBackend?, profile? }.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scriptLines } = body;

    if (!Array.isArray(scriptLines) || scriptLines.length === 0) {
      return NextResponse.json({ error: "Missing scriptLines" }, { status: 400 });
    }

    // Resolve TTS config
    let profile = null;
    if (typeof body?.profile === "string" && body.profile) {
      profile = await getProfile(body.profile);
    }

    const ttsBackend: TtsBackend = (["local", "elevenlabs", "openai"].includes(body?.ttsBackend) ? body.ttsBackend
      : profile?.ttsBackend && ["local", "elevenlabs", "openai"].includes(profile.ttsBackend) ? profile.ttsBackend
      : "local") as TtsBackend;

    const language = typeof body?.language === "string" ? body.language : undefined;

    const ttsConfig: TtsConfig = {
      backend: ttsBackend,
      elevenlabsKey: profile?.elevenlabsKey || process.env.ELEVENLABS_API_KEY || "",
      openaiKey: profile?.openaiKey || process.env.OPENAI_API_KEY || "",
      language,
    };

    const hostA = (typeof body?.hostA === "string" && body.hostA.trim() ? body.hostA.trim().toUpperCase() : "ALEX");
    const defaults = getDefaultVoices(ttsBackend);
    const aVoice = typeof body?.alexVoice === "string" ? body.alexVoice : defaults.alex;
    const sVoice = typeof body?.samVoice === "string" ? body.samVoice : defaults.sam;

    const buffers: ArrayBuffer[] = [];
    for (const line of scriptLines) {
      const voice = line.speaker === hostA ? aVoice : sVoice;
      const buf = await synthesizeLine(line.text, voice, ttsConfig);
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
