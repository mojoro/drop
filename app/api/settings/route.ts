import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Returns which backends have env-var keys configured (no secrets exposed). */
export async function GET() {
  return NextResponse.json({
    ollama: !!process.env.OLLAMA_MODEL,
    ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL || "",
    openrouter: !!process.env.OPENROUTER_API_KEY,
    featherless: !!process.env.FEATHERLESS_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    needle: !!process.env.NEEDLE_API_KEY,
  });
}
