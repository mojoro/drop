import { NextResponse } from "next/server";
import { getPodcast, deletePodcast } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const podcast = await getPodcast(id);
  if (!podcast) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(podcast);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deletePodcast(id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
