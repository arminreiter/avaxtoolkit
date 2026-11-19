"use client"

import { useState, useEffect, useCallback } from "react"
import { formatEther } from "ethers/utils"
import { type TransactionRequest } from "ethers/providers"
import { RefreshCw, Trash2, Hash, Clock } from "lucide-react"
import { ToolCard } from "@/components/tools/ToolCard"
import { CopyableId } from "@/components/tools/CopyableId"
import { useConfirm } from "@/components/tools/ConfirmDialog"
import { StatCard } from "@/components/dashboard/StatCard"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/contexts/wallet-context"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { type SentTx, loadTxHistory, saveTxHistory, recordSentTx, replacementFees } from "@/lib/models/tx-history"
import { type TrackedToken, loadTokens } from "@/lib/models/token"
import { appLinks } from "@/lib/explorer-links"
import { useNow } from "@/lib/hooks/use-now"
import { useInterval } from "@/lib/hooks/use-interval"
import { truncateId, formatTimestamp, relativeTime, formatTokenAmount, errorMessage } from "@/lib/utils"

type Status = "pending" | "confirmed" | "failed" | "dropped"

const STATUS_COLORS: Record<Status, string> = {
  confirmed: "text-green-500",
  failed: "text-destructive",
  pending: "text-yellow-500",
  dropped: "text-muted-foreground",
}

const PENDING_POLL_MS = 5000

function timeAgo(ms: number): string {
  const rel = relativeTime(ms / 1000)
  return rel === "now" ? "just now" : `${rel} ago`
}

/** Token sends show the transferred token amount; everything else the native value. */
function formatValue(e: SentTx, tokens: TrackedToken[]): string {
  if (!e.tokenTransfer) return `${formatEther(e.value)} AVAX`
  const token = tokens.find(t => t.address.toLowerCase() === e.to?.toLowerCase())
  return token
    ? `${formatTokenAmount(BigInt(e.tokenTransfer.amount), token.decimals)} ${token.symbol}`
    : `${e.tokenTransfer.amount} units`
}

export default function TxHistoryPage() {
  const { activeWallet, requireWallet } = useWallet()
  const { network, endpoints } = useNetwork()
  const [history, setHistory] = useState<SentTx[]>([])
  const [statuses, setStatuses] = useState<Record<string, Status>>({})
  const [nonces, setNonces] = useState<{ latest: number; pending: number } | null>(null)
  const [onlyActive, setOnlyActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [tokens, setTokens] = useState<TrackedToken[]>([])
  const { confirm, dialog } = useConfirm()
  useNow() // re-render so relative times stay live

  const owner = activeWallet?.address
  // Without an active wallet the filter would hide everything, so show all entries instead
  const filterActive = onlyActive && !!owner
  const entries = history.filter(e => e.chainId === network.chainId &&
    (!filterActive || e.from.toLowerCase() === owner?.toLowerCase()))

  const refresh = useCallback(async () => {
    const all = loadTxHistory()
    setHistory(all)
    setTokens(loadTokens(network.chainId))
    setError("")
    setLoading(true)
    try {
      const provider = CChainService.getProvider(endpoints.cChain)
      const onChain = all.filter(e => e.chainId === network.chainId)
      const senders = [...new Set(onChain.map(e => e.from.toLowerCase()))]
      const [receipts, latestBySender, ownerNonces] = await Promise.all([
        Promise.all(onChain.map(e => provider.getTransactionReceipt(e.hash).catch(() => null))),
        Promise.all(senders.map(s => provider.getTransactionCount(s, "latest"))),
        owner
          ? Promise.all([provider.getTransactionCount(owner, "latest"), provider.getTransactionCount(owner, "pending")])
          : Promise.resolve(null),
      ])
      const latest = Object.fromEntries(senders.map((s, i) => [s, latestBySender[i]]))
      const next: Record<string, Status> = {}
      onChain.forEach((e, i) => {
        const r = receipts[i]
        if (r) next[e.hash] = r.status === 1 ? "confirmed" : "failed"
        // No receipt but the sender's nonce moved past it: another tx with this nonce was mined
        else next[e.hash] = latest[e.from.toLowerCase()] > e.nonce ? "dropped" : "pending"
      })
      setStatuses(next)
      setNonces(ownerNonces ? { latest: ownerNonces[0], pending: ownerNonces[1] } : null)
    } catch (err) {
      setError(errorMessage(err, "Failed to load transaction status"))
    } finally {
      setLoading(false)
    }
  }, [endpoints.cChain, network.chainId, owner])

  useEffect(() => {
    Promise.resolve().then(refresh)
  }, [refresh])

  // Keep re-checking receipts while anything is still pending
  const hasPending = Object.values(statuses).includes("pending")
  useInterval(() => { if (!loading) refresh() }, hasPending ? PENDING_POLL_MS : null)

  /**
   * Re-send at the same nonce with higher fees. "speedup" repeats the original tx;
   * "cancel" sends 0 AVAX to yourself, which also works when the original was never recorded here.
   */
  async function replace(mode: "speedup" | "cancel", nonce: number, entry?: SentTx) {
    setError("")
    setBusy(`${mode}-${nonce}`)
    try {
      const signer = await requireWallet()
      const from = await signer.getAddress()
      if (entry && entry.from.toLowerCase() !== from.toLowerCase()) {
        throw new Error(`Switch the active wallet to ${entry.from} to replace this transaction`)
      }
      const provider = CChainService.getProvider(endpoints.cChain)
      const [original, feeData] = await Promise.all([
        entry ? provider.getTransaction(entry.hash) : Promise.resolve(null),
        provider.getFeeData(),
      ])
      if (mode === "speedup" && !original) {
        throw new Error("Original transaction is no longer known to the node (dropped). Use Cancel instead.")
      }
      const fees = replacementFees(original, feeData)
      const request: TransactionRequest = mode === "cancel"
        ? { to: from, value: 0, gasLimit: 21000, nonce, ...fees }
        : { to: original!.to, value: original!.value, data: original!.data, gasLimit: original!.gasLimit, nonce, ...fees }
      const tx = await signer.sendTransaction(request)
      recordSentTx(tx, mode === "cancel" ? `Cancel nonce ${nonce}` : `Speed up: ${entry!.label}`)
      await refresh()
    } catch (err) {
      setError(errorMessage(err, "Replacement failed"))
    } finally {
      setBusy(null)
    }
  }

  async function clearHistory() {
    if (!(await confirm({
      title: `Clear ${network.name} history?`,
      description: "Removes all local history entries for this network. Transactions on-chain are not affected.",
      confirmLabel: "Clear",
      destructive: true,
    }))) return
    saveTxHistory(loadTxHistory().filter(e => e.chainId !== network.chainId))
    refresh()
  }

  const stuck = nonces ? nonces.pending - nonces.latest : 0

  return (
    <ToolCard title="Transaction History" description="Transactions sent from this toolkit (stored locally), plus nonce control for stuck transactions.">
      <div className="space-y-4">
        {owner && nonces && (
          <div className="space-y-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard label="Confirmed Nonce" value={String(nonces.latest)} icon={Hash} iconColor="cyan"
                rpcInfo='eth_getTransactionCount("latest")' />
              <StatCard label="Pending in Mempool" value={String(stuck)} icon={Clock} iconColor={stuck > 0 ? "amber" : "green"}
                rpcInfo='eth_getTransactionCount("pending")' />
            </div>
            {stuck > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs flex-1 min-w-48">
                  {stuck} transaction{stuck === 1 ? " is" : "s are"} waiting. Nonce {nonces.latest} blocks everything after it.
                </p>
                <Button size="sm" variant="outline" disabled={busy !== null}
                  onClick={() => replace("cancel", nonces.latest, entries.find(e => e.nonce === nonces.latest))}>
                  Cancel nonce {nonces.latest}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={clearHistory}
            disabled={!history.some(e => e.chainId === network.chainId)}>
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
          <label className={`flex items-center gap-2 text-sm ml-auto ${owner ? "cursor-pointer" : "text-muted-foreground"}`}
            title={owner ? undefined : "No active wallet: showing all entries"}>
            <input type="checkbox" checked={filterActive} disabled={!owner} onChange={e => setOnlyActive(e.target.checked)} className="rounded" />
            Active wallet only
          </label>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive break-all">{error}</p>
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No transactions recorded on {network.name}. Transactions sent via Send, Fan Out, Drain, Raw Transaction or Contract Write appear here.
          </p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2">Action</th>
                  <th className="text-left p-2">Tx Hash</th>
                  <th className="text-right p-2">Nonce</th>
                  <th className="text-right p-2">Value</th>
                  <th className="text-left p-2">Status</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {entries.map(e => {
                  const status = statuses[e.hash]
                  return (
                    <tr key={e.hash} className="border-b last:border-0">
                      <td className="p-2">
                        <div className="truncate max-w-56">{e.label}</div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span title={formatTimestamp(e.createdAt / 1000)}>{timeAgo(e.createdAt)}</span>
                          {!filterActive && <>· <CopyableId value={e.from} display={truncateId(e.from, 6, 4)}
                            href={appLinks.address(e.from)} explorer="address" /></>}
                        </div>
                      </td>
                      <td className="p-2">
                        <CopyableId value={e.hash} display={truncateId(e.hash, 10, 6)} href={appLinks.tx(e.hash)} explorer="tx" />
                      </td>
                      <td className="p-2 text-right">{e.nonce}</td>
                      <td className="p-2 text-right whitespace-nowrap">{formatValue(e, tokens)}</td>
                      <td className={`p-2 ${status ? STATUS_COLORS[status] : "text-muted-foreground"}`}>{status ?? "…"}</td>
                      <td className="p-2 text-right whitespace-nowrap">
                        {status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy !== null}
                              onClick={() => replace("speedup", e.nonce, e)}>Speed up</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy !== null}
                              onClick={() => replace("cancel", e.nonce, e)}>Cancel</Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {dialog}
    </ToolCard>
  )
}
