import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export const runtime = "nodejs";

/** Convert WAV base64 → MP3 base64 using ffmpeg. */
export async function POST(req: Request) {
  let dir = "";
  try {
    const { audio } = await req.json();
    if (!audio) {
      return NextResponse.json({ error: "Missing audio" }, { status: 400 });
    }

    dir = await mkdtemp(join(tmpdir(), "drop-mp3-"));
    const wavPath = join(dir, "in.wav");
    const mp3Path = join(dir, "out.mp3");

    await writeFile(wavPath, Buffer.from(audio, "base64"));

    await new Promise<void>((resolve, reject) => {
      execFile("ffmpeg", ["-i", wavPath, "-codec:a", "libmp3lame", "-b:a", "128k", "-y", mp3Path], (err) => {
        if (err) reject(new Error(`ffmpeg failed: ${err.message}`));
        else resolve();
      });
    });

    const mp3 = await readFile(mp3Path);
    return NextResponse.json({ audio: mp3.toString("base64") });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Encoding failed" },
      { status: 500 }
    );
  } finally {
    if (dir) {
      await unlink(join(dir, "in.wav")).catch(() => {});
      await unlink(join(dir, "out.mp3")).catch(() => {});
      await unlink(dir).catch(() => {});
    }
  }
}
