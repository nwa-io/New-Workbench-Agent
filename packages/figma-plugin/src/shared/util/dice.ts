export function diceCoefficient(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const A = bigrams(a);
  const B = bigrams(b);
  let intersection = 0;
  for (const [bg, count] of A) {
    if (B.has(bg)) intersection += Math.min(count, B.get(bg)!);
  }
  const total = (a.length - 1) + (b.length - 1);
  return total <= 0 ? 0 : (2 * intersection) / total;
}
