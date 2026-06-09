/** Deterministic pseudo-random from bot id — same bot always gets the same chart shape. */
export function hashBotSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function buildScalpBaseline(
  botId: string,
  pointCount = 48
): number[] {
  const rng = createSeededRng(hashBotSeed(botId));
  const points: number[] = [];
  let y = 0.42 + rng() * 0.12;

  for (let i = 0; i < pointCount; i++) {
    const drift = (i / pointCount) * 0.28;
    const scalp = (rng() - 0.48) * 0.09;
    y = Math.max(0.08, Math.min(0.92, y + scalp + 0.004));
    points.push(y * (1 - drift * 0.15) + drift * 0.35);
  }

  return points;
}
