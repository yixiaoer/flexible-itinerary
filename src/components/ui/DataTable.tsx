import type { ReactNode } from 'react'

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  className?: string
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>
  rows: T[]
  getRowKey: (row: T, index: number) => string
  empty?: ReactNode
  className?: string
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  empty,
  className = '',
}: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>
  }

  return (
    <div className={`table-shell ${className}`}>
      <table className="w-full border-collapse">
        <thead className="table-head">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={`px-4 py-2.5 ${column.className ?? ''}`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey(row, index)} className="transition hover:bg-ink-50/70">
              {columns.map((column) => (
                <td key={column.key} className={`table-cell ${column.className ?? ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
