/**
 * WAV-aware audio stitching.
 *
 * Parses each WAV file to extract raw PCM data, concatenates them
 * with short silence gaps between segments, and writes a single valid WAV.
 */

const SILENCE_BETWEEN_LINES_MS = 300;

// ── WAV parsing ──────────────────────────────────────────────────────────────

function readChunkId(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function parseWav(buffer: ArrayBuffer) {
  const view = new DataView(buffer);

  if (readChunkId(view, 0) !== 'RIFF' || readChunkId(view, 8) !== 'WAVE') {
    throw new Error('Not a valid WAV file');
  }

  let offset = 12;
  let sampleRate = 0;
  let numChannels = 0;
  let bitsPerSample = 0;
  let audioFormat = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= buffer.byteLength) {
    const chunkId = readChunkId(view, offset);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++; // pad to even boundary
  }

  if (!dataOffset) throw new Error('No data chunk found in WAV');

  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    audioFormat,
    data: new Uint8Array(buffer, dataOffset, dataSize),
  };
}

// ── WAV writing ──────────────────────────────────────────────────────────────

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function createWavHeader(
  dataSize: number,
  sampleRate: number,
  numChannels: number,
  bitsPerSample: number,
  audioFormat: number,
): ArrayBuffer {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, audioFormat, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  return header;
}

// ── Stitching ────────────────────────────────────────────────────────────────

function createSilence(
  durationMs: number,
  sampleRate: number,
  numChannels: number,
  bytesPerSample: number,
): Uint8Array {
  const numSamples = Math.round((sampleRate * durationMs) / 1000);
  return new Uint8Array(numSamples * numChannels * bytesPerSample); // zeros = silence
}

export function stitchWav(buffers: ArrayBuffer[]): ArrayBuffer {
  if (buffers.length === 0) throw new Error('No audio buffers to stitch');
  if (buffers.length === 1) return buffers[0];

  const parsed = buffers.map(parseWav);
  const first = parsed[0];

  for (let i = 1; i < parsed.length; i++) {
    if (
      parsed[i].sampleRate !== first.sampleRate ||
      parsed[i].numChannels !== first.numChannels ||
      parsed[i].bitsPerSample !== first.bitsPerSample
    ) {
      throw new Error(`WAV format mismatch at buffer ${i}`);
    }
  }

  const bytesPerSample = first.bitsPerSample / 8;
  const silence = createSilence(
    SILENCE_BETWEEN_LINES_MS,
    first.sampleRate,
    first.numChannels,
    bytesPerSample,
  );

  // Total size = all audio data + silence gaps between segments
  const totalDataSize =
    parsed.reduce((sum, p) => sum + p.data.byteLength, 0) +
    silence.byteLength * (parsed.length - 1);

  const header = createWavHeader(
    totalDataSize,
    first.sampleRate,
    first.numChannels,
    first.bitsPerSample,
    first.audioFormat,
  );

  const result = new Uint8Array(44 + totalDataSize);
  result.set(new Uint8Array(header), 0);

  let offset = 44;
  for (let i = 0; i < parsed.length; i++) {
    result.set(parsed[i].data, offset);
    offset += parsed[i].data.byteLength;

    if (i < parsed.length - 1) {
      result.set(silence, offset);
      offset += silence.byteLength;
    }
  }

  return result.buffer;
}
