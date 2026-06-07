// Chunked Uint8Array → base64. Works in both the main runtime sandbox
// (which exposes figma.base64Encode) and the UI iframe (which has btoa).
export function uint8ToBase64(bytes: Uint8Array): string {
  const fb = (globalThis as unknown as {
    figma?: { base64Encode?: (b: Uint8Array) => string };
  }).figma?.base64Encode;
  if (typeof fb === "function") return fb(bytes);

  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return (globalThis as unknown as { btoa: (s: string) => string }).btoa(binary);
}

// Manual UTF-8 decoder — the Figma main-runtime sandbox does not expose
// TextDecoder, so we cannot rely on it across both contexts.
export function decodeUtf8(bytes: Uint8Array): string {
  let result = "";
  let i = 0;
  const len = bytes.length;
  while (i < len) {
    const b1 = bytes[i++];
    if (b1 < 0x80) {
      result += String.fromCharCode(b1);
    } else if ((b1 & 0xe0) === 0xc0) {
      const b2 = bytes[i++];
      result += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
    } else if ((b1 & 0xf0) === 0xe0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      result += String.fromCharCode(
        ((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f)
      );
    } else if ((b1 & 0xf8) === 0xf0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      const code =
        ((b1 & 0x07) << 18) |
        ((b2 & 0x3f) << 12) |
        ((b3 & 0x3f) << 6) |
        (b4 & 0x3f);
      const offset = code - 0x10000;
      result += String.fromCharCode(0xd800 + (offset >> 10));
      result += String.fromCharCode(0xdc00 + (offset & 0x3ff));
    }
  }
  return result;
}
