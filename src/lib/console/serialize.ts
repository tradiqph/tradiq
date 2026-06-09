function serializeTimestamp(value: unknown): { seconds: number } | null {
  if (!value) return null;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    const ms = (value as { toDate: () => Date }).toDate().getTime();
    return { seconds: Math.floor(ms / 1000) };
  }
  if (typeof (value as { _seconds?: number })._seconds === "number") {
    return { seconds: (value as { _seconds: number })._seconds };
  }
  if (typeof (value as { seconds?: number }).seconds === "number") {
    return { seconds: (value as { seconds: number }).seconds };
  }
  return null;
}

export function serializeDoc<T extends Record<string, unknown>>(
  data: T
): T & { createdAt?: { seconds: number } | null; reviewedAt?: { seconds: number } | null } {
  return {
    ...data,
    ...(data.createdAt !== undefined
      ? { createdAt: serializeTimestamp(data.createdAt) }
      : {}),
    ...(data.reviewedAt !== undefined
      ? { reviewedAt: serializeTimestamp(data.reviewedAt) }
      : {}),
  };
}
