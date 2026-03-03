"use client"

import { truncateId } from "@/lib/utils"

export interface TxBatchResult {
  address: string
  amount: string
  hash?: string
  error?: string
  status: string
}

interface TxBatchResultTableProps {
  results: TxBatchResult[]
  addressLabel?: string
  showAmountUnit?: string
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: "text-green-500",
  failed: "text-destructive",
  sent: "text-yellow-500",
  skipped: "text-yellow-500",
  pending: "text-muted-foreground",
}

export function TxBatchResultTable({ results, addressLabel = "Address", showAmountUnit }: TxBatchResultTableProps) {
  if (results.length === 0) return null

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left p-2">{addressLabel}</th>
            <th className="text-left p-2">Amount</th>
            <th className="text-left p-2">Status</th>
            <th className="text-left p-2">Tx Hash</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="p-2">{truncateId(r.address, 8, 4)}</td>
              <td className="p-2">{r.amount}{showAmountUnit ? ` ${showAmountUnit}` : ""}</td>
              <td className="p-2">
                <span className={STATUS_COLORS[r.status] ?? "text-muted-foreground"}>
                  {r.status}
                </span>
              </td>
              <td className="p-2">{r.hash ? truncateId(r.hash, 8, 4) : r.error || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
