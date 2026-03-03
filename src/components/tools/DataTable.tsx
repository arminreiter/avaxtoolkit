"use client"

import { useState, useMemo } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react"

interface Column<T> {
  key: string
  label: string
  render?: (row: T) => React.ReactNode
  sortValue?: (row: T) => string | number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  searchable?: boolean
  searchPlaceholder?: string
  rowKey?: (row: T, index: number) => string | number
  pageSize?: number
}

type SortDir = "asc" | "desc"

function SortIcon({ colKey, sortKey, sortDir }: { colKey: string; sortKey: string | null; sortDir: SortDir }) {
  if (sortKey !== colKey) return <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
  if (sortDir === "asc") return <ArrowUp className="h-3 w-3" />
  return <ArrowDown className="h-3 w-3" />
}

function defaultSortValue<T extends Record<string, unknown>>(row: T, key: string): string | number {
  const v = row[key]
  if (v === null || v === undefined) return ""
  if (typeof v === "number") return v
  if (typeof v === "boolean") return v ? 1 : 0
  return String(v)
}

export type { Column }

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = "No data",
  searchable = true,
  searchPlaceholder = "Filter...",
  rowKey,
  pageSize,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    if (!search.trim()) return data
    const term = search.trim().toLowerCase()
    return data.filter(row =>
      columns.some(col => {
        const v = col.sortValue ? col.sortValue(row) : defaultSortValue(row, col.key)
        return String(v).toLowerCase().includes(term)
      })
    )
  }, [data, search, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = columns.find(c => c.key === sortKey)
    if (!col) return filtered
    return [...filtered].sort((a, b) => {
      const aVal = col.sortValue ? col.sortValue(a) : defaultSortValue(a, col.key)
      const bVal = col.sortValue ? col.sortValue(b) : defaultSortValue(b, col.key)
      let cmp = 0
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal
      } else {
        cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
      }
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir, columns])

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1
  const currentPage = Math.min(page, totalPages - 1)
  const paginatedRows = pageSize ? sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : sorted

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDir === "asc") {
        setSortDir("desc")
      } else {
        setSortKey(null)
        setSortDir("asc")
      }
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  if (data.length === 0) return <p className="text-muted-foreground text-sm text-center py-8">{emptyMessage}</p>

  return (
    <div className="space-y-3">
      {searchable && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}
      {sorted.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">No matching results</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className="text-left py-3 px-4 font-medium text-muted-foreground cursor-pointer select-none group hover:text-foreground transition-colors"
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <SortIcon colKey={col.key} sortKey={sortKey} sortDir={sortDir} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, i) => (
                  <tr key={rowKey ? rowKey(row, i) : (row as Record<string, unknown>).id != null ? String((row as Record<string, unknown>).id) : (pageSize ? currentPage * pageSize + i : i)} className="border-b border-border/50 hover:bg-muted/50">
                    {columns.map(col => (
                      <td key={col.key} className="py-3 px-4">
                        {col.render ? col.render(row) : String(row[col.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageSize && totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span className="text-xs font-mono">
                {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sorted.length)} of {sorted.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-2 text-xs font-mono">
                  {currentPage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
