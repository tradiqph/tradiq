import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Hide from mobile card layout (e.g. actions rendered separately) */
  hideOnMobile?: boolean;
  /** Primary field shown at top of mobile card */
  primary?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  rowKey: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage = "No data",
  rowKey,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="surface-flat p-8 text-center text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  const mobileColumns = columns.filter((col) => !col.hideOnMobile);
  const primaryCol =
    mobileColumns.find((col) => col.primary) ?? mobileColumns[0];
  const detailColumns = mobileColumns.filter((col) => col !== primaryCol);
  const actionCol = columns.find((col) => col.key === "actions");

  return (
    <>
      <div className="space-y-2 md:hidden">
        {data.map((row) => (
          <div
            key={rowKey(row)}
            className="surface-flat rounded-xl p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {primaryCol && (
                  <div className="text-sm">{primaryCol.cell(row)}</div>
                )}
              </div>
              {actionCol && (
                <div className="shrink-0">{actionCol.cell(row)}</div>
              )}
            </div>
            {detailColumns.length > 0 && (
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/5 pt-3">
                {detailColumns.map((col) => (
                  <div key={col.key}>
                    <dt className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                      {col.header || "\u00a0"}
                    </dt>
                    <dd className="mt-0.5 text-sm text-zinc-300">
                      {col.cell(row)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>

      <div className="surface-flat hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 text-xs text-zinc-500">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn("px-4 py-3 font-medium", col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-3", col.className)}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
