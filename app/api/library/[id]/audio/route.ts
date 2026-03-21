import { getPodcastAudio } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const audio = await getPodcastAudio(id);
  if (!audio) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(audio), {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(audio.byteLength),
      "Content-Disposition": `inline; filename="${id}.wav"`,
    },
  });
}
