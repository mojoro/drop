export function stitchAudio(buffers: ArrayBuffer[]): ArrayBuffer {
    const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const buffer of buffers) {
        result.set(new Uint8Array(buffer), offset)
        offset += buffer.byteLength
    }
    return result.buffer
}