import { NextResponse } from "next/server";
import { fetchVoices } from "@/lib/tts";

export async function GET() {
  try {
    const voices = await fetchVoices();
    return NextResponse.json(voices);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch voices" },
      { status: 502 },
    );
  }
}
