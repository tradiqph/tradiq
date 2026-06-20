interface ConsoleTablePaginationProps {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  hasMore: boolean;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function ConsoleTablePagination({
  page,
  pageSize,
  pageCount,
  total,
  hasMore,
  loading = false,
  onPrev,
  onNext,
}: ConsoleTablePaginationProps) {
  const pageStart = pageCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = (page - 1) * pageSize + pageCount;

  return (
    <div className="flex flex-col gap-2 border-t border-white/5 pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-zinc-500">
        {pageCount === 0
          ? "No rows on this page"
          : `Showing ${pageStart}–${pageEnd} of ${total}`}
      </p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={onPrev}
          className="cursor-pointer text-xs text-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs text-zinc-500">Page {page}</span>
        <button
          type="button"
          disabled={!hasMore || loading}
          onClick={onNext}
          className="cursor-pointer text-xs text-zinc-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
