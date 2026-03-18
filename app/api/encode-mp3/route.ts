import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Convert WAV base64 → MP3 base64 server-side (lamejs works fine in Node CJS).
 */
export async function POST(req: Request) {
  try {
    const { audio } = await req.json();
    if (!audio) {
      return NextResponse.json({ error: "Missing audio" }, { status: 400 });
    }

    // lamejs must be required (CJS) — dynamic import breaks in browser/ESM
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lamejs = require("lamejs");

    const wavBuf = Buffer.from(audio, "base64");
    const view = new DataView(wavBuf.buffer, wavBuf.byteOffset, wavBuf.byteLength);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    const numChannels = view.getUint16(22, true);

    // Find data chunk
    let dataOffset = 12;
    while (dataOffset < wavBuf.length - 8) {
      const id = String.fromCharCode(wavBuf[dataOffset], wavBuf[dataOffset + 1], wavBuf[dataOffset + 2], wavBuf[dataOffset + 3]);
      const size = view.getUint32(dataOffset + 4, true);
      if (id === "data") { dataOffset += 8; break; }
      dataOffset += 8 + size;
    }

    const bytesPerSample = bitsPerSample / 8;
    const numSamples = Math.floor((wavBuf.length - dataOffset) / (bytesPerSample * numChannels));
    const samples = new Int16Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      samples[i] = view.getInt16(dataOffset + i * bytesPerSample * numChannels, true);
    }

    const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
    const mp3Chunks: Buffer[] = [];
    const blockSize = 1152;
    for (let i = 0; i < samples.length; i += blockSize) {
      const chunk = samples.subarray(i, i + blockSize);
      const buf = encoder.encodeBuffer(chunk);
      if (buf.length > 0) mp3Chunks.push(Buffer.from(buf));
    }
    const end = encoder.flush();
    if (end.length > 0) mp3Chunks.push(Buffer.from(end));

    const mp3 = Buffer.concat(mp3Chunks).toString("base64");
    return NextResponse.json({ audio: mp3 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Encoding failed" },
      { status: 500 }
    );
  }
}
