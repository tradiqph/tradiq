export const CONSOLE_LIST_PAGE_SIZE = 15;

export function paginateByCursor<T extends { id: string }>(
  items: T[],
  cursor: string | null,
  limit: number
): {
  page: T[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
} {
  const total = items.length;

  let startIndex = 0;
  if (cursor) {
    const cursorIndex = items.findIndex((item) => item.id === cursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  }

  const slice = items.slice(startIndex, startIndex + limit + 1);
  const hasMore = slice.length > limit;
  const page = slice.slice(0, limit);
  const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;

  return { page, total, hasMore, nextCursor };
}

export function parseConsoleListLimit(
  raw: string | null,
  fallback = CONSOLE_LIST_PAGE_SIZE
): number {
  const parsed = parseInt(raw ?? String(fallback), 10);
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 100);
}
