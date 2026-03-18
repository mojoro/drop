import { NextResponse } from "next/server";
import { listVoices, type TtsBackend, type TtsConfig } from "@/lib/tts-router";
import { getProfile } from "@/lib/storage";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const profileName = url.searchParams.get("profile") || "";
    const backendParam = url.searchParams.get("backend") || "";

    let ttsBackend: TtsBackend = "local";
    let elevenlabsKey = process.env.ELEVENLABS_API_KEY || "";
    let openaiKey = process.env.OPENAI_API_KEY || "";

    if (profileName) {
      const profile = await getProfile(profileName);
      if (profile) {
        if (profile.ttsBackend && ["local", "elevenlabs", "openai"].includes(profile.ttsBackend)) {
          ttsBackend = profile.ttsBackend as TtsBackend;
        }
        elevenlabsKey = profile.elevenlabsKey || elevenlabsKey;
        openaiKey = profile.openaiKey || openaiKey;
      }
    }

    if (["local", "elevenlabs", "openai"].includes(backendParam)) {
      ttsBackend = backendParam as TtsBackend;
    }

    const config: TtsConfig = { backend: ttsBackend, elevenlabsKey, openaiKey };
    const voices = await listVoices(config);

    return NextResponse.json({ backend: ttsBackend, voices });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch voices" },
      { status: 502 },
    );
  }
}
