export function rgbToHex(c: RGB, a = 1): string {
  const ch = (x: number) =>
    Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0");
  const hex = `#${ch(c.r)}${ch(c.g)}${ch(c.b)}`;
  return a < 1 ? `${hex}${ch(a)}` : hex;
}

export function rgbaToHex(c: RGBA): string {
  const ch = (x: number) =>
    Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, "0");
  return `#${ch(c.r)}${ch(c.g)}${ch(c.b)}${ch(c.a)}`;
}
