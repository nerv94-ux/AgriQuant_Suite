import type { ReactNode } from "react";

export type DataTableColumn<TRow> = {
  key: string;
  header: ReactNode;
  cell: (row: TRow) => ReactNode;
  className?: string;
};

type DataTableProps<TRow> = {
  rows: TRow[];
  columns: DataTableColumn<TRow>[];
  getRowKey: (row: TRow, index: number) => string;
  emptyMessage?: ReactNode;
  minWidthClassName?: string;
};

export function DataTable<TRow>({
  rows,
  columns,
  getRowKey,
  emptyMessage = "표시할 데이터가 없습니다.",
  minWidthClassName = "min-w-[720px]",
}: DataTableProps<TRow>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-auto">
        <table className={`${minWidthClassName} w-full text-left text-sm`}>
          <thead className="bg-zinc-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-semibold text-zinc-800 ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={getRowKey(row, idx)} className="border-t border-zinc-100">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length || 1}
                  className="px-4 py-10 text-center text-sm text-zinc-600"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

