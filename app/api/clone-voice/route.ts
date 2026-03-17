import { NextResponse } from "next/server";

const TTS_URL = process.env.TTS_SERVER_URL || "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const res = await fetch(`${TTS_URL}/tts/clone-voice`, {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.detail ?? `TTS server error: ${res.status}` },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Clone failed" },
      { status: 502 },
    );
  }
}
