import { NextResponse } from "next/server";
import { listPodcasts, savePodcast } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const podcasts = await listPodcasts();
  return NextResponse.json(podcasts);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, input, scriptLines, scriptBackend, alexVoice, samVoice, audio, monologue, hostA, hostB } = body;

    if (!title || !scriptLines || !audio) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const podcast = await savePodcast(
      {
        title, input: input || "", scriptLines, scriptBackend: scriptBackend || "unknown",
        alexVoice: alexVoice || "", samVoice: samVoice || "",
        ...(monologue ? { monologue } : {}),
        ...(hostA && hostA !== "ALEX" ? { hostA } : {}),
        ...(hostB && hostB !== "SAM" ? { hostB } : {}),
      },
      audio
    );

    return NextResponse.json(podcast);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Save failed" },
      { status: 500 }
    );
  }
}
