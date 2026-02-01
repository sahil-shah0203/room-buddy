/**
 * Lossless encoding/decoding for room designs using gzip compression + base64.
 * Used for copy/paste to keep strings shorter than raw JSON.
 */

// Compress string using gzip and encode as base64
export async function encodeDesign(json: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(json);

  // Compress using gzip
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();

  const compressedChunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    compressedChunks.push(value);
  }

  // Combine chunks
  const totalLength = compressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const compressed = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of compressedChunks) {
    compressed.set(chunk, offset);
    offset += chunk.length;
  }

  // Convert to base64
  const binary = String.fromCharCode(...compressed);
  const base64 = btoa(binary);

  // Add prefix so we can identify encoded strings
  return "RB1:" + base64;
}

// Decode base64 and decompress gzip back to JSON string
export async function decodeDesign(encoded: string): Promise<string> {
  // Check for prefix
  if (!encoded.startsWith("RB1:")) {
    throw new Error("Invalid encoded design format");
  }

  const base64 = encoded.slice(4);

  // Decode base64
  const binary = atob(base64);
  const compressed = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    compressed[i] = binary.charCodeAt(i);
  }

  // Decompress using gzip
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(compressed);
  writer.close();

  const decompressedChunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    decompressedChunks.push(value);
  }

  // Combine chunks
  const totalLength = decompressedChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const decompressed = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of decompressedChunks) {
    decompressed.set(chunk, offset);
    offset += chunk.length;
  }

  // Decode to string
  const decoder = new TextDecoder();
  return decoder.decode(decompressed);
}

// Check if a string is an encoded design
export function isEncodedDesign(str: string): boolean {
  return str.startsWith("RB1:");
}
