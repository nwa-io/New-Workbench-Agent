export async function loadArray<T>(key: string): Promise<T[]> {
  try {
    const raw = await figma.clientStorage.getAsync(key);
    return Array.isArray(raw) ? (raw as T[]) : [];
  } catch {
    return [];
  }
}

export async function saveValue(key: string, value: unknown): Promise<void> {
  await figma.clientStorage.setAsync(key, value);
}
