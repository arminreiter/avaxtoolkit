"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { ethers } from "ethers"
import { ChevronRight, Pause, Play, Loader2, ArrowRight } from "lucide-react"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { ToolCard } from "@/components/tools/ToolCard"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { CopyableId } from "@/components/tools/CopyableId"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { relativeTime, formatGas, gasPercent, gasColor } from "@/lib/utils"
import { decodeMethodName } from "@/lib/method-signatures"

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlockInfo {
  number: number
  hash: string
  parentHash: string
  timestamp: number
  gasUsed: bigint
  gasLimit: bigint
  baseFeePerGas: bigint | null
  txCount: number
  miner: string
  transactions: string[]
}

interface TxDetail {
  hash: string
  from: string
  to: string | null
  value: string
  gasUsed: string
  gasPrice: string
  effectiveGasPrice: string
  status: number | null
  blockNumber: number
  nonce: number
  input: string
  gasLimit: string
  txType: number
  transactionIndex: number
  method: string
  txFee: string
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function truncateHash(hash: string, chars = 8): string {
  if (hash.length <= chars * 2 + 2) return hash
  return `${hash.slice(0, chars + 2)}\u2026${hash.slice(-chars)}`
}

// ─── TransactionDetail ───────────────────────────────────────────────────────

function TransactionDetail({ tx }: { tx: TxDetail }) {
  const [showInput, setShowInput] = useState(false)

  const txTypeName = tx.txType === 2 ? "EIP-1559" : tx.txType === 1 ? "EIP-2930" : "Legacy"

  return (
    <div className="animate-fade-in-up space-y-3">
      <DetailGrid
        columns={2}
        items={[
          {
            label: "Status",
            value:
              tx.status === 1 ? (
                <Badge variant="default" className="bg-[#007700] dark:bg-[#005500] text-white border-[#007700]/30 dark:border-[#00ff41]/30">
                  Success
                </Badge>
              ) : tx.status === 0 ? (
                <Badge variant="destructive">Failed</Badge>
              ) : (
                <Badge variant="outline">Pending</Badge>
              ),
          },
          {
            label: "Tx Type",
            value: txTypeName,
          },
          {
            label: "From",
            value: tx.from,
            mono: true,
            copyable: true,
          },
          {
            label: "To",
            value: tx.to ?? "Contract Creation",
            mono: true,
            copyable: !!tx.to,
          },
          {
            label: "Value",
            value: `${parseFloat(tx.value).toFixed(6)} AVAX`,
          },
          {
            label: "Tx Fee",
            value: `${parseFloat(tx.txFee).toFixed(8)} AVAX`,
          },
          {
            label: "Gas Used",
            value: BigInt(tx.gasUsed).toLocaleString(),
          },
          {
            label: "Gas Limit",
            value: BigInt(tx.gasLimit).toLocaleString(),
          },
          {
            label: "Gas Price",
            value: tx.gasPrice !== "0"
              ? `${parseFloat(ethers.formatUnits(tx.gasPrice, "gwei")).toFixed(4)} gwei`
              : "\u2014",
            mono: true,
          },
          {
            label: "Effective Gas Price",
            value: tx.effectiveGasPrice !== "0"
              ? `${parseFloat(ethers.formatUnits(tx.effectiveGasPrice, "gwei")).toFixed(4)} gwei`
              : "\u2014",
            mono: true,
          },
          {
            label: "Nonce",
            value: tx.nonce.toString(),
          },
          {
            label: "Position in Block",
            value: tx.transactionIndex.toString(),
          },
          {
            label: "Tx Hash",
            value: tx.hash,
            mono: true,
            fullWidth: true,
            copyable: true,
          },
        ]}
      />

      {/* Input Data */}
      {tx.input && tx.input !== "0x" && (
        <DetailGrid
          title={`Input Data (${tx.method})`}
          items={[
            {
              label: showInput ? "Raw Hex" : "",
              value: showInput ? (
                <div className="font-mono text-[11px] break-all bg-muted/20 p-2 max-h-40 overflow-y-auto">
                  <CopyableId value={tx.input} display={tx.input} className="text-[11px]" />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] font-mono px-3"
                  onClick={() => setShowInput(true)}
                >
                  show input data ({Math.floor((tx.input.length - 2) / 2)} bytes)
                </Button>
              ),
              fullWidth: true,
            },
          ]}
        />
      )}

    </div>
  )
}

// ─── TransactionRow ──────────────────────────────────────────────────────────

interface TransactionRowProps {
  tx: TxDetail
  expandedTx: string | null
  txLoading: Record<string, boolean>
  onToggle: (hash: string) => void
}

function TransactionRow({
  tx,
  expandedTx,
  txLoading,
  onToggle,
}: TransactionRowProps) {
  const isExpanded = expandedTx === tx.hash
  const isLoading = txLoading[tx.hash] ?? false

  return (
    <>
      <tr
        className="border-b border-border/10 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
        onClick={() => onToggle(tx.hash)}
      >
        <td className="px-2 py-1.5">
          <ChevronRight
            className="h-3 w-3 text-muted-foreground/40 shrink-0 transition-transform duration-150"
            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
          />
        </td>
        <td className="px-2 py-1.5">
          <CopyableId
            value={tx.hash}
            display={truncateHash(tx.hash, 8)}
            className="text-xs"
          />
        </td>
        <td className="px-2 py-1.5">
          <Badge
            variant="outline"
            className="text-[11px] font-mono px-1.5 py-0 h-5 max-w-[120px] truncate"
            title={tx.method}
          >
            {tx.method}
          </Badge>
        </td>
        <td className="px-2 py-1.5">
          <CopyableId
            value={tx.from}
            display={truncateHash(tx.from, 6)}
            className="text-xs"
          />
        </td>
        <td className="px-2 py-1.5 text-center">
          <ArrowRight className="h-3 w-3 text-muted-foreground/30 inline" />
        </td>
        <td className="px-2 py-1.5">
          {tx.to ? (
            <CopyableId
              value={tx.to}
              display={truncateHash(tx.to, 6)}
              className="text-xs"
            />
          ) : (
            <Badge variant="outline" className="text-[11px] font-mono px-1.5 py-0 h-5">
              Create
            </Badge>
          )}
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums">
          {parseFloat(tx.value) > 0 ? `${parseFloat(tx.value).toFixed(4)}` : "0"}
          <span className="text-muted-foreground/30 text-[11px] ml-0.5">AVAX</span>
        </td>
        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground/60">
          {parseFloat(tx.txFee).toFixed(6)}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={8} className="px-4 pb-3 pt-1">
            <TransactionDetail tx={tx} />
          </td>
        </tr>
      )}

      {isExpanded && isLoading && (
        <tr>
          <td colSpan={8} className="px-6 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>fetching details&hellip;</span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── BlockRow ────────────────────────────────────────────────────────────────

interface BlockRowProps {
  block: BlockInfo
  isNew: boolean
  isExpanded: boolean
  expandedTx: string | null
  txLoading: Record<string, boolean>
  onToggleBlock: (blockNumber: number) => void
  onToggleTx: (hash: string) => void
  blockTxData: TxDetail[] | undefined
  blockTxLoading: boolean
  blockFee: string | undefined
}

function BlockRow({
  block,
  isNew,
  isExpanded,
  expandedTx,
  txLoading,
  onToggleBlock,
  onToggleTx,
  blockTxData,
  blockTxLoading,
  blockFee,
}: BlockRowProps) {
  const gasPct = gasPercent(Number(block.gasUsed), Number(block.gasLimit))

  return (
    <div
      className={`border-b border-border/20 last:border-0 ${isNew ? "animate-slide-in" : ""}`}
    >
      {/* Compact block row */}
      <div
        className="flex items-center gap-3 py-2 px-1 hover:bg-muted/30 transition-colors cursor-pointer select-none"
        onClick={() => onToggleBlock(block.number)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onToggleBlock(block.number)}
      >
        <ChevronRight
          className="h-3 w-3 text-muted-foreground/40 shrink-0 transition-transform duration-150"
          style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
        />

        <span className="text-primary font-semibold min-w-[80px] tabular-nums">
          #{block.number.toLocaleString()}
        </span>

        <span className="text-muted-foreground/60 min-w-[100px] font-mono text-xs hidden sm:inline">
          <CopyableId
            value={block.hash}
            display={truncateHash(block.hash, 6)}
            className="text-xs"
          />
        </span>

        <span className="text-muted-foreground min-w-[40px] tabular-nums">
          {block.txCount}
          <span className="text-muted-foreground/30 text-[11px]"> tx</span>
        </span>

        <span
          className={`min-w-[70px] tabular-nums ${gasColor(gasPct)}`}
          title={`${gasPct}% (${formatGas(Number(block.gasUsed))} / ${formatGas(Number(block.gasLimit))})`}
        >
          {formatGas(Number(block.gasUsed))}
          <span className="text-muted-foreground/30 ml-1">{gasPct}%</span>
        </span>

        <span className="text-muted-foreground/60 min-w-[80px] tabular-nums hidden md:inline text-xs">
          {blockFee ? `${parseFloat(blockFee).toFixed(6)}` : "\u2014"}
          <span className="text-muted-foreground/30 text-xs ml-0.5">AVAX</span>
        </span>

        <span className="text-muted-foreground/50 ml-auto tabular-nums text-right min-w-[32px]">
          {relativeTime(block.timestamp)}
        </span>
      </div>

      {/* Expanded block details */}
      {isExpanded && (
        <div className="pb-2 px-1 animate-fade-in-up">
          <div className="mb-2 px-1">
            <DetailGrid
              columns={2}
              items={[
                {
                  label: "Block Hash",
                  value: block.hash || "\u2014",
                  mono: true,
                  fullWidth: true,
                  copyable: !!block.hash,
                },
                {
                  label: "Parent Hash",
                  value: block.parentHash,
                  mono: true,
                  fullWidth: true,
                  copyable: true,
                },
                {
                  label: "Miner",
                  value: block.miner || "\u2014",
                  mono: true,
                  fullWidth: true,
                  copyable: !!block.miner,
                },
                {
                  label: "Timestamp",
                  value: new Date(block.timestamp * 1000).toLocaleString(),
                },
                {
                  label: "Gas Used / Limit",
                  value: `${Number(block.gasUsed).toLocaleString()} / ${Number(block.gasLimit).toLocaleString()}`,
                },
              ]}
            />
          </div>

          {/* Transaction table */}
          {block.transactions.length === 0 && (
            <div className="px-6 py-2 text-xs text-muted-foreground/50 font-mono">
              no transactions in this block
            </div>
          )}

          {block.transactions.length > 0 && blockTxLoading && !blockTxData && (
            <div className="flex items-center gap-2 px-6 py-4 text-xs text-muted-foreground font-mono">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>loading transactions&hellip;</span>
            </div>
          )}

          {blockTxData && blockTxData.length > 0 && (
            <div className="border border-border/20 mt-2 overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/20 text-[11px] text-muted-foreground/40 uppercase tracking-wider">
                    <th className="px-2 py-1.5 text-left font-normal w-6"></th>
                    <th className="px-2 py-1.5 text-left font-normal">txn hash</th>
                    <th className="px-2 py-1.5 text-left font-normal">method</th>
                    <th className="px-2 py-1.5 text-left font-normal">from</th>
                    <th className="px-2 py-1.5 text-left font-normal w-4"></th>
                    <th className="px-2 py-1.5 text-left font-normal">to</th>
                    <th className="px-2 py-1.5 text-right font-normal">amount</th>
                    <th className="px-2 py-1.5 text-right font-normal">txn fee</th>
                  </tr>
                </thead>
                <tbody>
                  {blockTxData.map((tx) => (
                    <TransactionRow
                      key={tx.hash}
                      tx={tx}
                      expandedTx={expandedTx}
                      txLoading={txLoading}
                      onToggle={onToggleTx}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stats Bar ───────────────────────────────────────────────────────────────

function StatsBar({ blocks }: { blocks: BlockInfo[] }) {
  const stats = useMemo(() => {
    if (blocks.length === 0) {
      return { blocksPerMin: 0, avgTxPerBlock: 0, avgGasPercent: 0 }
    }

    const latest = blocks[0]
    const now = latest ? latest.timestamp : 0
    const recentBlocks = blocks.filter((b) => now - b.timestamp <= 60)
    const blocksPerMin = recentBlocks.length

    const avgTxPerBlock =
      blocks.reduce((sum, b) => sum + b.txCount, 0) / blocks.length

    const avgGasPercent =
      blocks.reduce(
        (sum, b) => sum + gasPercent(Number(b.gasUsed), Number(b.gasLimit)),
        0
      ) / blocks.length

    return {
      blocksPerMin,
      avgTxPerBlock: Math.round(avgTxPerBlock * 10) / 10,
      avgGasPercent: Math.round(avgGasPercent),
    }
  }, [blocks])

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs">
      <div>
        <span className="text-muted-foreground/40 uppercase tracking-wider text-[11px]">
          blocks/min{" "}
        </span>
        <span className="text-foreground tabular-nums">{stats.blocksPerMin}</span>
      </div>
      <div>
        <span className="text-muted-foreground/40 uppercase tracking-wider text-[11px]">
          avg tx/block{" "}
        </span>
        <span className="text-foreground tabular-nums">{stats.avgTxPerBlock}</span>
      </div>
      <div>
        <span className="text-muted-foreground/40 uppercase tracking-wider text-[11px]">
          avg gas%{" "}
        </span>
        <span className={`tabular-nums ${gasColor(stats.avgGasPercent)}`}>
          {stats.avgGasPercent}%
        </span>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const BLOCK_BUFFER_SIZE = 50
const INITIAL_BLOCK_COUNT = 10
const POLL_INTERVAL_MS = 2000

export default function ExplorerPage() {
  const { endpoints, isConnected } = useNetwork()
  const rpcUrl = endpoints.cChain

  const [blocks, setBlocks] = useState<BlockInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [txDetails, setTxDetails] = useState<Record<string, TxDetail>>({})
  const [txLoading, setTxLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState("")

  const [blockTxData, setBlockTxData] = useState<Record<number, TxDetail[]>>({})
  const [blockTxLoading, setBlockTxLoading] = useState<Record<number, boolean>>({})
  const [blockFees, setBlockFees] = useState<Record<number, string>>({})

  const lastBlockRef = useRef<number>(-1)
  const [newBlockNumbers, setNewBlockNumbers] = useState<Set<number>>(new Set())
  const pollingInFlight = useRef(false)
  const txDetailsRef = useRef(txDetails)
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { txDetailsRef.current = txDetails }, [txDetails])

  const mapBlock = useCallback(
    (b: NonNullable<Awaited<ReturnType<typeof CChainService.getBlock>>>): BlockInfo => ({
      number: b.number,
      hash: b.hash ?? "",
      parentHash: b.parentHash,
      timestamp: b.timestamp,
      gasUsed: b.gasUsed,
      gasLimit: b.gasLimit,
      baseFeePerGas: b.baseFeePerGas,
      txCount: b.transactions.length,
      miner: b.miner ?? "",
      transactions: b.transactions as string[],
    }),
    []
  )

  // Initial load
  useEffect(() => {
    let cancelled = false

    async function initialLoad() {
      setBlocks([])
      setError("")
      setLoading(true)
      setExpandedBlock(null)
      setExpandedTx(null)
      setTxDetails({})
      setTxLoading({})
      setBlockTxData({})
      setBlockTxLoading({})
      setBlockFees({})
      lastBlockRef.current = -1
      setNewBlockNumbers(new Set())
      pollingInFlight.current = false

      try {
        const latestNum = await CChainService.getBlockNumber(rpcUrl)
        if (cancelled) return

        const blockNumbers = Array.from(
          { length: INITIAL_BLOCK_COUNT },
          (_, i) => latestNum - i
        ).filter((n) => n >= 0)

        const results = await Promise.allSettled(
          blockNumbers.map((n) => CChainService.getBlock(rpcUrl, n))
        )
        if (cancelled) return

        const fetched: BlockInfo[] = results
          .filter(
            (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof CChainService.getBlock>>>> =>
              r.status === "fulfilled" && r.value !== null
          )
          .map((r) => mapBlock(r.value))

        lastBlockRef.current = latestNum
        setBlocks(fetched)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load blocks")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    initialLoad()
    return () => { cancelled = true }
  }, [rpcUrl, mapBlock])

  // Polling
  useEffect(() => {
    const id = setInterval(async () => {
      if (pausedRef.current) return
      if (lastBlockRef.current === -1) return
      if (pollingInFlight.current) return
      pollingInFlight.current = true

      try {
        const latestNum = await CChainService.getBlockNumber(rpcUrl)
        if (latestNum <= lastBlockRef.current) return

        const blockNumbers = Array.from(
          { length: latestNum - lastBlockRef.current },
          (_, i) => lastBlockRef.current + 1 + i
        )

        const results = await Promise.allSettled(
          blockNumbers.map((n) => CChainService.getBlock(rpcUrl, n))
        )

        const newBlocks: BlockInfo[] = results
          .filter(
            (r): r is PromiseFulfilledResult<NonNullable<Awaited<ReturnType<typeof CChainService.getBlock>>>> =>
              r.status === "fulfilled" && r.value !== null
          )
          .map((r) => mapBlock(r.value))

        if (newBlocks.length === 0) return

        setNewBlockNumbers((prev) => {
          const next = new Set(prev)
          newBlocks.forEach((b) => next.add(b.number))
          return next
        })

        const highestFetched = Math.max(...newBlocks.map((b) => b.number))
        lastBlockRef.current = highestFetched

        setBlocks((prev) =>
          [...newBlocks, ...prev].slice(0, BLOCK_BUFFER_SIZE)
        )

        setTimeout(() => {
          setNewBlockNumbers((prev) => {
            const next = new Set(prev)
            newBlocks.forEach((b) => next.delete(b.number))
            return next
          })
        }, 600)
      } catch {
        // Polling errors are silent
      } finally {
        pollingInFlight.current = false
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(id)
  }, [rpcUrl, mapBlock])

  // Compute estimated block fees from baseFeePerGas * gasUsed (no extra RPC calls).
  // Exact fees replace estimates when a block is expanded and receipts are fetched.
  useEffect(() => {
    if (blocks.length === 0) return
    const newFees: Record<number, string> = {}
    for (const b of blocks) {
      if (blockFees[b.number] !== undefined) continue
      if (b.baseFeePerGas) {
        newFees[b.number] = ethers.formatEther(b.baseFeePerGas * b.gasUsed)
      }
    }
    if (Object.keys(newFees).length > 0) {
      setBlockFees((prev) => ({ ...prev, ...newFees }))
    }
  }, [blocks, blockFees])

  const handleToggleBlock = useCallback(
    async (blockNumber: number) => {
      setExpandedBlock((prev) => (prev === blockNumber ? null : blockNumber))
      setExpandedTx(null)

      if (blockTxData[blockNumber]) return

      setBlockTxLoading((prev) => ({ ...prev, [blockNumber]: true }))
      try {
        const { rawBlock, rawReceipts } = await CChainService.getBlockFull(rpcUrl, blockNumber)
        if (!rawBlock?.transactions) return

        const receiptsMap = new Map<string, Record<string, string>>()
        if (rawReceipts) {
          for (const r of rawReceipts) {
            receiptsMap.set(r.transactionHash?.toLowerCase(), r)
          }
        }

        let totalFees = BigInt(0)
        const txs: TxDetail[] = rawBlock.transactions.map((tx: Record<string, string>, idx: number) => {
          const receipt = receiptsMap.get(tx.hash?.toLowerCase())
          const effectiveGasPrice = receipt?.effectiveGasPrice ?? tx.gasPrice ?? "0x0"
          const gasUsed = receipt?.gasUsed ?? "0x0"
          const fee = BigInt(gasUsed) * BigInt(effectiveGasPrice)
          totalFees += fee

          return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to ?? null,
            value: ethers.formatEther(BigInt(tx.value ?? "0x0")),
            gasUsed: BigInt(gasUsed).toString(),
            gasPrice: BigInt(tx.gasPrice ?? "0x0").toString(),
            effectiveGasPrice: BigInt(effectiveGasPrice).toString(),
            status: receipt ? parseInt(receipt.status, 16) : null,
            blockNumber,
            nonce: parseInt(tx.nonce, 16),
            input: tx.input ?? "0x",
            gasLimit: BigInt(tx.gas ?? "0x0").toString(),
            txType: parseInt(tx.type ?? "0x0", 16),
            transactionIndex: receipt ? parseInt(receipt.transactionIndex, 16) : idx,
            method: decodeMethodName(tx.input),
            txFee: ethers.formatEther(fee),
          }
        })

        setTxDetails((prev) => {
          const updated = { ...prev }
          for (const tx of txs) {
            updated[tx.hash] = tx
          }
          return updated
        })

        setBlockTxData((prev) => ({ ...prev, [blockNumber]: txs }))
        setBlockFees((prev) => ({ ...prev, [blockNumber]: ethers.formatEther(totalFees) }))
      } catch {
        // Silent failure
      } finally {
        setBlockTxLoading((prev) => ({ ...prev, [blockNumber]: false }))
      }
    },
    [rpcUrl, blockTxData]
  )

  const handleToggleTx = useCallback(
    async (hash: string) => {
      setExpandedTx((prev) => (prev === hash ? null : hash))

      if (txDetailsRef.current[hash]) return

      setTxLoading((prev) => ({ ...prev, [hash]: true }))

      try {
        const { tx, receipt } = await CChainService.getTransaction(rpcUrl, hash)
        if (!tx) return

        const effectiveGasPrice = receipt
          ? (receipt as unknown as { effectiveGasPrice?: bigint }).effectiveGasPrice?.toString() ?? tx.gasPrice?.toString() ?? "0"
          : tx.gasPrice?.toString() ?? "0"
        const gasUsed = receipt?.gasUsed?.toString() ?? "0"
        const txFee = ethers.formatEther(BigInt(gasUsed) * BigInt(effectiveGasPrice))

        const detail: TxDetail = {
          hash: tx.hash,
          from: tx.from,
          to: tx.to ?? null,
          value: ethers.formatEther(tx.value),
          gasUsed,
          gasPrice: tx.gasPrice?.toString() ?? "0",
          effectiveGasPrice,
          status: receipt?.status ?? null,
          blockNumber: receipt?.blockNumber ?? tx.blockNumber ?? 0,
          nonce: tx.nonce,
          input: tx.data ?? "0x",
          gasLimit: tx.gasLimit?.toString() ?? "0",
          txType: tx.type ?? 0,
          transactionIndex: receipt?.index ?? 0,
          method: decodeMethodName(tx.data),
          txFee,
        }
        setTxDetails((prev) => ({ ...prev, [hash]: detail }))
      } catch {
        // Leave txDetails[hash] undefined
      } finally {
        setTxLoading((prev) => ({ ...prev, [hash]: false }))
      }
    },
    [rpcUrl]
  )

  return (
    <ToolCard
      title="Block Explorer"
      description="Live C-Chain block feed with inline transaction details."
    >
      <div className="space-y-4">
        {/* Controls bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 font-mono text-xs">
            {paused ? (
              <span className="h-2 w-2 rounded-full bg-muted-foreground shrink-0" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-green-500 pulse-dot shrink-0" />
            )}
            <span className="text-muted-foreground uppercase tracking-wider text-[11px]">
              {paused ? "paused" : "live"}
            </span>
            <span className="text-muted-foreground/30">&mdash;</span>
            <span className="text-muted-foreground/50">
              {blocks.length} block{blocks.length !== 1 ? "s" : ""} cached
            </span>
          </div>

          {!loading && blocks.length > 0 && <StatsBar blocks={blocks} />}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaused((p) => !p)}
            className="font-mono text-xs uppercase tracking-wider h-7 px-3"
          >
            {paused ? (
              <>
                <Play className="h-3 w-3" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" />
                Pause
              </>
            )}
          </Button>
        </div>

        {error && (
          <p className="text-destructive text-xs font-mono">error: {error}</p>
        )}

        {!isConnected && !loading && blocks.length === 0 && !error && (
          <p className="text-muted-foreground text-xs font-mono">
            waiting for network connection&hellip;
          </p>
        )}

        <div className="font-mono text-[13px]">
          {/* Column headers */}
          <div className="flex items-center gap-3 py-1.5 pl-5 text-[11px] text-muted-foreground/40 uppercase tracking-wider border-b border-border/50">
            <span className="min-w-[80px]">block</span>
            <span className="min-w-[100px] hidden sm:inline">hash</span>
            <span className="min-w-[40px]">txs</span>
            <span className="min-w-[70px]">gas</span>
            <span className="min-w-[80px] hidden md:inline">fees</span>
            <span className="ml-auto">age</span>
          </div>

          {/* Loading skeletons */}
          {loading && (
            <div className="space-y-px pt-1">
              {Array.from({ length: INITIAL_BLOCK_COUNT }).map((_, i) => (
                <div
                  key={i}
                  className="h-8 shimmer"
                  style={{ opacity: 1 - i * 0.07 }}
                />
              ))}
            </div>
          )}

          {/* Block rows */}
          {!loading && blocks.length > 0 && (
            <div>
              {blocks.map((block) => (
                <BlockRow
                  key={block.number}
                  block={block}
                  isNew={newBlockNumbers.has(block.number)}
                  isExpanded={expandedBlock === block.number}
                  expandedTx={expandedTx}
                  txLoading={txLoading}
                  onToggleBlock={handleToggleBlock}
                  onToggleTx={handleToggleTx}
                  blockTxData={blockTxData[block.number]}
                  blockTxLoading={blockTxLoading[block.number] ?? false}
                  blockFee={blockFees[block.number]}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && blocks.length === 0 && !error && (
            <div className="py-8 text-center text-muted-foreground/40 text-xs font-mono uppercase tracking-wider">
              no blocks found
            </div>
          )}
        </div>
      </div>
    </ToolCard>
  )
}
