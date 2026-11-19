"use client"

import { Suspense, useEffect, useRef, useState, useMemo, useCallback, startTransition } from "react"
import { useRouter } from "next/navigation"
import { formatUnits, formatEther } from "ethers/utils"
import { ChevronRight, Pause, Play, Loader2, ArrowRight, RotateCw, Search, X } from "lucide-react"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { ToolCard } from "@/components/tools/ToolCard"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { CopyableId } from "@/components/tools/CopyableId"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { relativeTime, formatGas, gasPercent, gasColor, truncateId, errorMessage } from "@/lib/utils"
import { decodeKnownArgs, decodeMethodName } from "@/lib/method-signatures"
import { appLinks } from "@/lib/explorer-links"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { useNow } from "@/lib/hooks/use-now"
import { useInterval } from "@/lib/hooks/use-interval"

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
  blockNumber: number | null
  timestamp: number | null
  nonce: number
  input: string
  gasLimit: string
  txType: number
  transactionIndex: number
  method: string
  txFee: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HASH_RE = /^0x[0-9a-fA-F]{64}$/
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/

type RawBlock = NonNullable<Awaited<ReturnType<typeof CChainService.getBlock>>>

function mapBlock(b: RawBlock): BlockInfo {
  return {
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
  }
}

/** Fetch blocks in the given order, silently dropping any that fail. */
async function fetchBlocks(rpcUrl: string, numbers: number[]): Promise<BlockInfo[]> {
  const results = await Promise.allSettled(numbers.map((n) => CChainService.getBlock(rpcUrl, n)))
  return results.flatMap((r) => (r.status === "fulfilled" && r.value ? [mapBlock(r.value)] : []))
}

/** Map a raw eth_getBlockBy* (full txs) + receipts response to BlockInfo and TxDetails. */
function parseFullBlock({ rawBlock, rawReceipts }: Awaited<ReturnType<typeof CChainService.getBlockFull>>) {
  const receiptsMap = new Map<string, Record<string, string>>()
  for (const r of rawReceipts ?? []) {
    receiptsMap.set(r.transactionHash?.toLowerCase(), r)
  }

  const blockNumber = parseInt(rawBlock.number, 16)
  const timestamp = parseInt(rawBlock.timestamp, 16)
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
      value: formatEther(BigInt(tx.value ?? "0x0")),
      gasUsed: BigInt(gasUsed).toString(),
      gasPrice: BigInt(tx.gasPrice ?? "0x0").toString(),
      effectiveGasPrice: BigInt(effectiveGasPrice).toString(),
      status: receipt ? parseInt(receipt.status, 16) : null,
      blockNumber,
      timestamp,
      nonce: parseInt(tx.nonce, 16),
      input: tx.input ?? "0x",
      gasLimit: BigInt(tx.gas ?? "0x0").toString(),
      txType: parseInt(tx.type ?? "0x0", 16),
      transactionIndex: receipt ? parseInt(receipt.transactionIndex, 16) : idx,
      method: decodeMethodName(tx.input),
      txFee: formatEther(fee),
    }
  })

  const block: BlockInfo = {
    number: blockNumber,
    hash: rawBlock.hash ?? "",
    parentHash: rawBlock.parentHash,
    timestamp,
    gasUsed: BigInt(rawBlock.gasUsed),
    gasLimit: BigInt(rawBlock.gasLimit),
    baseFeePerGas: rawBlock.baseFeePerGas ? BigInt(rawBlock.baseFeePerGas) : null,
    txCount: txs.length,
    miner: rawBlock.miner ?? "",
    transactions: txs.map((t) => t.hash),
  }
  return { block, txs, totalFees: formatEther(totalFees) }
}

/** Fetch a single transaction (plus its block timestamp). null = not found. */
async function fetchTxDetail(rpcUrl: string, hash: string): Promise<TxDetail | null> {
  const { tx, receipt } = await CChainService.getTransaction(rpcUrl, hash)
  if (!tx) return null

  const effectiveGasPrice = receipt
    ? receipt.gasPrice.toString()
    : tx.gasPrice?.toString() ?? "0"
  const gasUsed = receipt?.gasUsed?.toString() ?? "0"
  const blockNumber = receipt?.blockNumber ?? tx.blockNumber ?? null
  const block = blockNumber !== null ? await CChainService.getBlock(rpcUrl, blockNumber) : null

  return {
    hash: tx.hash,
    from: tx.from,
    to: tx.to ?? null,
    value: formatEther(tx.value),
    gasUsed,
    gasPrice: tx.gasPrice?.toString() ?? "0",
    effectiveGasPrice,
    status: receipt?.status ?? null,
    blockNumber,
    timestamp: block?.timestamp ?? null,
    nonce: tx.nonce,
    input: tx.data ?? "0x",
    gasLimit: tx.gasLimit?.toString() ?? "0",
    txType: tx.type ?? 0,
    transactionIndex: receipt?.index ?? 0,
    method: decodeMethodName(tx.data),
    txFee: formatEther(BigInt(gasUsed) * BigInt(effectiveGasPrice)),
  }
}

/** Relative age that keeps ticking even while the feed is paused. */
function Age({ timestamp }: { timestamp: number }) {
  useNow()
  return <>{relativeTime(timestamp)}</>
}

function RetryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-2 text-xs font-mono text-destructive">
      <span>error: {message}</span>
      <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] font-mono px-2" onClick={onRetry}>
        <RotateCw className="h-3 w-3" />
        retry
      </Button>
    </div>
  )
}

const stopRowToggle = { onClick: (e: React.SyntheticEvent) => e.stopPropagation(), onKeyDown: (e: React.SyntheticEvent) => e.stopPropagation() }

// ─── TransactionDetail ───────────────────────────────────────────────────────

function TransactionDetail({ tx }: { tx: TxDetail }) {
  const [showInput, setShowInput] = useState(false)

  const txTypeName = tx.txType === 2 ? "EIP-1559" : tx.txType === 1 ? "EIP-2930" : "Legacy"
  const args = decodeKnownArgs(tx.input)

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
            label: "Block",
            value: tx.blockNumber !== null ? (
              <CopyableId
                value={String(tx.blockNumber)}
                display={`#${tx.blockNumber.toLocaleString()}`}
                href={appLinks.block(tx.blockNumber)}
                explorer="block"
                className="text-sm font-mono"
              />
            ) : "Pending",
          },
          {
            label: "Timestamp",
            value: tx.timestamp !== null ? new Date(tx.timestamp * 1000).toLocaleString() : "\u2014",
          },
          {
            label: "From",
            value: <CopyableId value={tx.from} href={appLinks.address(tx.from)} explorer="address" className="text-sm font-mono" />,
          },
          {
            label: "To",
            value: tx.to
              ? <CopyableId value={tx.to} href={appLinks.address(tx.to)} explorer="address" className="text-sm font-mono" />
              : "Contract Creation",
            mono: true,
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
              ? `${parseFloat(formatUnits(tx.gasPrice, "gwei")).toFixed(4)} gwei`
              : "\u2014",
            mono: true,
          },
          {
            label: "Effective Gas Price",
            value: tx.effectiveGasPrice !== "0"
              ? `${parseFloat(formatUnits(tx.effectiveGasPrice, "gwei")).toFixed(4)} gwei`
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
            value: <CopyableId value={tx.hash} explorer="tx" className="text-sm font-mono" />,
            fullWidth: true,
          },
        ]}
      />

      {/* Input Data */}
      {tx.input && tx.input !== "0x" && (
        <DetailGrid
          title={`Input Data (${tx.method})`}
          items={[
            ...(args ?? []).map((a) => ({
              label: `${a.name} (${a.type})`,
              value: a.type === "address"
                ? <CopyableId value={a.value} href={appLinks.address(a.value)} explorer="address" className="text-sm font-mono" />
                : a.value,
              mono: true,
              fullWidth: true,
            })),
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
  onToggle: (hash: string) => void
}

function TransactionRow({
  tx,
  expandedTx,
  onToggle,
}: TransactionRowProps) {
  const isExpanded = expandedTx === tx.hash

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
          <span {...stopRowToggle}>
            <CopyableId
              value={tx.hash}
              display={truncateId(tx.hash, 10, 8)}
              href={appLinks.tx(tx.hash)}
              explorer="tx"
              className="text-xs"
            />
          </span>
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
          <span {...stopRowToggle}>
            <CopyableId
              value={tx.from}
              display={truncateId(tx.from, 8, 6)}
              href={appLinks.address(tx.from)}
              explorer="address"
              className="text-xs"
            />
          </span>
        </td>
        <td className="px-2 py-1.5 text-center">
          <ArrowRight className="h-3 w-3 text-muted-foreground/30 inline" />
        </td>
        <td className="px-2 py-1.5">
          {tx.to ? (
            <span {...stopRowToggle}>
              <CopyableId
                value={tx.to}
                display={truncateId(tx.to, 8, 6)}
                href={appLinks.address(tx.to)}
                explorer="address"
                className="text-xs"
              />
            </span>
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
    </>
  )
}

// ─── BlockRow ────────────────────────────────────────────────────────────────

interface BlockRowProps {
  block: BlockInfo
  isNew: boolean
  isExpanded: boolean
  expandedTx: string | null
  onToggleBlock: (blockNumber: number) => void
  onToggleTx: (hash: string) => void
  blockTxData: TxDetail[] | undefined
  blockTxLoading: boolean
  blockTxError?: string
  onRetry?: (blockNumber: number) => void
  blockFee: string | undefined
}

function BlockRow({
  block,
  isNew,
  isExpanded,
  expandedTx,
  onToggleBlock,
  onToggleTx,
  blockTxData,
  blockTxLoading,
  blockTxError,
  onRetry,
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

        <span className="text-muted-foreground/60 min-w-[100px] font-mono text-xs hidden sm:inline" {...stopRowToggle}>
          <CopyableId
            value={block.hash}
            display={truncateId(block.hash, 8, 6)}
            href={appLinks.block(block.hash)}
            explorer="block"
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
          <Age timestamp={block.timestamp} />
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
                  value: block.hash
                    ? <CopyableId value={block.hash} explorer="block" className="text-sm font-mono" />
                    : "\u2014",
                  mono: true,
                  fullWidth: true,
                },
                {
                  label: "Parent Hash",
                  value: <CopyableId value={block.parentHash} href={appLinks.block(block.parentHash)} explorer="block" className="text-sm font-mono" />,
                  fullWidth: true,
                },
                {
                  label: "Miner",
                  value: block.miner
                    ? <CopyableId value={block.miner} href={appLinks.address(block.miner)} explorer="address" className="text-sm font-mono" />
                    : "\u2014",
                  mono: true,
                  fullWidth: true,
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

          {block.transactions.length > 0 && !blockTxLoading && !blockTxData && blockTxError && onRetry && (
            <div className="px-6 py-2">
              <RetryError message={blockTxError} onRetry={() => onRetry(block.number)} />
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

function ExplorerPageInner() {
  const { endpoints, isConnected } = useNetwork()
  const rpcUrl = endpoints.cChain
  const router = useRouter()
  const [txParam] = useQueryParam("tx")
  const [blockParam] = useQueryParam("block")
  const [addressParam] = useQueryParam("address")

  const [blocks, setBlocks] = useState<BlockInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [paused, setPaused] = useState(false)
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const [error, setError] = useState("")

  const [blockTxData, setBlockTxData] = useState<Record<number, TxDetail[]>>({})
  const [blockTxLoading, setBlockTxLoading] = useState<Record<number, boolean>>({})
  const [blockTxError, setBlockTxError] = useState<Record<number, string>>({})
  const [exactBlockFees, setExactBlockFees] = useState<Record<number, string>>({})

  const [search, setSearch] = useState(txParam || blockParam)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState("")

  const [lookup, setLookup] = useState<{ key: string; tx?: TxDetail; block?: BlockInfo } | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState("")
  const [lookupNonce, setLookupNonce] = useState(0)
  const detailKey = txParam ? `tx:${txParam}` : blockParam ? `block:${blockParam}` : ""

  const lastBlockRef = useRef<number>(-1)
  const [newBlockNumbers, setNewBlockNumbers] = useState<Set<number>>(new Set())
  const pollingInFlight = useRef(false)

  /** Push (not replace) so the back button closes/reopens the detail. Keeps ?network=. */
  const openDetail = useCallback((key: "tx" | "block" | null, value?: string) => {
    const params = new URLSearchParams(window.location.search)
    for (const k of ["tx", "block", "address"]) params.delete(k)
    if (key && value) params.set(key, value)
    const qs = params.toString()
    router.push(qs ? `/explorer?${qs}` : "/explorer", { scroll: false })
  }, [router])

  const goToAddress = useCallback(async (addr: string, replace: boolean) => {
    const code = await CChainService.getProvider(rpcUrl).getCode(addr).catch(() => "0x")
    const href = code !== "0x" ? appLinks.contract(addr) : appLinks.address(addr)
    if (replace) router.replace(href)
    else router.push(href)
  }, [rpcUrl, router])

  // ?address= deep link → hand off to the balances/contracts page
  useEffect(() => {
    if (addressParam) goToAddress(addressParam, true)
  }, [addressParam, goToAddress])

  // ?tx= / ?block= deep link (also covers search submits and back/forward)
  useEffect(() => {
    if (!detailKey) return
    let cancelled = false

    async function load() {
      setLookupError("")
      setLookupLoading(true)
      try {
        if (txParam) {
          if (!HASH_RE.test(txParam)) throw new Error("Invalid transaction hash")
          const tx = await fetchTxDetail(rpcUrl, txParam)
          if (!tx) throw new Error("Transaction not found")
          if (!cancelled) setLookup({ key: detailKey, tx })
        } else {
          const isHash = HASH_RE.test(blockParam)
          if (!isHash && !/^\d+$/.test(blockParam)) throw new Error("Invalid block number or hash")
          const full = await CChainService.getBlockFull(rpcUrl, isHash ? blockParam : Number(blockParam))
          if (!full.rawBlock) throw new Error("Block not found")
          const { block, txs, totalFees } = parseFullBlock(full)
          if (cancelled) return
          setBlockTxData((prev) => ({ ...prev, [block.number]: txs }))
          setExactBlockFees((prev) => ({ ...prev, [block.number]: totalFees }))
          setLookup({ key: detailKey, block })
        }
      } catch (err) {
        if (!cancelled) setLookupError(errorMessage(err, "Lookup failed"))
      } finally {
        if (!cancelled) setLookupLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [detailKey, txParam, blockParam, rpcUrl, lookupNonce])

  async function handleSearch() {
    const q = search.trim()
    setSearchError("")
    if (/^\d+$/.test(q)) return openDetail("block", q)
    if (ADDRESS_RE.test(q)) {
      setSearching(true)
      return goToAddress(q, false)
    }
    if (!HASH_RE.test(q)) {
      setSearchError("Enter a tx hash, block number, block hash or 0x address")
      return
    }
    setSearching(true)
    try {
      const { tx } = await CChainService.getTransaction(rpcUrl, q)
      if (tx) openDetail("tx", q)
      else if (await CChainService.getBlock(rpcUrl, q)) openDetail("block", q)
      else setSearchError("No transaction or block found for this hash")
    } catch (err) {
      setSearchError(errorMessage(err, "Search failed"))
    } finally {
      setSearching(false)
    }
  }

  // Initial load
  useEffect(() => {
    let cancelled = false

    async function initialLoad() {
      setBlocks([])
      setError("")
      setLoading(true)
      setExpandedBlock(null)
      setExpandedTx(null)
      setBlockTxData({})
      setBlockTxLoading({})
      setBlockTxError({})
      setExactBlockFees({})
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

        const fetched = await fetchBlocks(rpcUrl, blockNumbers)
        if (cancelled) return

        lastBlockRef.current = latestNum
        setBlocks(fetched)
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, "Failed to load blocks"))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    initialLoad()
    return () => { cancelled = true }
  }, [rpcUrl])

  // Polling
  useInterval(async () => {
    if (lastBlockRef.current === -1) return
    if (pollingInFlight.current) return
    pollingInFlight.current = true

    try {
      const latestNum = await CChainService.getBlockNumber(rpcUrl)
      if (latestNum <= lastBlockRef.current) return

      // Cap catch-up to the visible window: after a long pause, skip the gap
      const from = Math.max(lastBlockRef.current + 1, latestNum - BLOCK_BUFFER_SIZE + 1)
      const gap = from > lastBlockRef.current + 1
      const blockNumbers = Array.from({ length: latestNum - from + 1 }, (_, i) => latestNum - i)

      const newBlocks = await fetchBlocks(rpcUrl, blockNumbers)
      if (newBlocks.length === 0) return

      startTransition(() => {
        setNewBlockNumbers((prev) => {
          const next = new Set(prev)
          newBlocks.forEach((b) => next.add(b.number))
          return next
        })
      })

      lastBlockRef.current = newBlocks[0].number

      // Window never shrinks below what the user loaded via "Load older blocks"
      setBlocks((prev) =>
        gap ? newBlocks : [...newBlocks, ...prev].slice(0, Math.max(BLOCK_BUFFER_SIZE, prev.length))
      )

      setTimeout(() => {
        startTransition(() => {
          setNewBlockNumbers((prev) => {
            const next = new Set(prev)
            newBlocks.forEach((b) => next.delete(b.number))
            return next
          })
        })
      }, 600)
    } catch {
      // Polling errors are silent
    } finally {
      pollingInFlight.current = false
    }
  }, paused ? null : POLL_INTERVAL_MS)

  const oldestBlock = blocks.length > 0 ? blocks[blocks.length - 1].number : 0

  async function loadOlder() {
    setLoadingOlder(true)
    const numbers = Array.from({ length: INITIAL_BLOCK_COUNT }, (_, i) => oldestBlock - 1 - i).filter((n) => n >= 0)
    const older = await fetchBlocks(rpcUrl, numbers)
    if (older.length === 0) setError("Failed to load older blocks")
    setBlocks((prev) => [...prev, ...older.filter((b) => b.number < prev[prev.length - 1].number)])
    setLoadingOlder(false)
  }

  // Compute estimated block fees from baseFeePerGas * gasUsed (no extra RPC calls).
  // Exact fees (from receipts) replace estimates when a block is expanded.
  const blockFees = useMemo(() => {
    const estimated: Record<number, string> = {}
    for (const b of blocks) {
      if (b.baseFeePerGas) {
        estimated[b.number] = formatEther(b.baseFeePerGas * b.gasUsed)
      }
    }
    return { ...estimated, ...exactBlockFees }
  }, [blocks, exactBlockFees])

  const loadBlockTxs = useCallback(
    async (blockNumber: number) => {
      setBlockTxError((prev) => ({ ...prev, [blockNumber]: "" }))
      setBlockTxLoading((prev) => ({ ...prev, [blockNumber]: true }))
      try {
        const full = await CChainService.getBlockFull(rpcUrl, blockNumber)
        if (!full.rawBlock) throw new Error("Block not found")
        const { txs, totalFees } = parseFullBlock(full)
        setBlockTxData((prev) => ({ ...prev, [blockNumber]: txs }))
        setExactBlockFees((prev) => ({ ...prev, [blockNumber]: totalFees }))
      } catch (err) {
        setBlockTxError((prev) => ({ ...prev, [blockNumber]: errorMessage(err, "Failed to load transactions") }))
      } finally {
        setBlockTxLoading((prev) => ({ ...prev, [blockNumber]: false }))
      }
    },
    [rpcUrl]
  )

  const handleToggleBlock = useCallback(
    (blockNumber: number) => {
      const opening = expandedBlock !== blockNumber
      setExpandedBlock(opening ? blockNumber : null)
      setExpandedTx(null)
      if (opening && !blockTxData[blockNumber] && !blockTxLoading[blockNumber]) loadBlockTxs(blockNumber)
    },
    [expandedBlock, blockTxData, blockTxLoading, loadBlockTxs]
  )

  const handleToggleTx = useCallback((hash: string) => {
    setExpandedTx((prev) => (prev === hash ? null : hash))
  }, [])

  const shownLookup = lookup?.key === detailKey ? lookup : null

  return (
    <ToolCard
      title="Block Explorer"
      description="Live C-Chain block feed with inline transaction details."
    >
      <div className="space-y-4">
        {/* Search */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearch() }}
          className="space-y-1"
        >
          <div className="flex gap-2">
            <Input
              aria-label="Search by tx hash, block number, block hash or address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="tx hash / block number / block hash / 0x address"
              className="font-mono text-sm"
            />
            <LoadingButton type="submit" loading={searching}>
              {!searching && <Search className="h-4 w-4" />}
              Search
            </LoadingButton>
          </div>
          {searchError && <p className="text-destructive text-xs font-mono">{searchError}</p>}
        </form>

        {/* Deep-linked / searched detail */}
        {detailKey && (
          <div className="border border-border/50 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display uppercase tracking-wider text-sm truncate">
                {txParam ? "Transaction" : "Block"}{" "}
                <span className="font-mono normal-case text-muted-foreground">
                  {truncateId(txParam || blockParam, 10, 8)}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => openDetail(null)}
                aria-label="Close detail"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {lookupLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>loading&hellip;</span>
              </div>
            )}
            {!lookupLoading && lookupError && (
              <RetryError message={lookupError} onRetry={() => setLookupNonce((n) => n + 1)} />
            )}
            {!lookupLoading && !lookupError && shownLookup?.tx && <TransactionDetail tx={shownLookup.tx} />}
            {!lookupLoading && !lookupError && shownLookup?.block && (
              <div className="font-mono text-[13px]">
                <BlockRow
                  block={shownLookup.block}
                  isNew={false}
                  isExpanded
                  expandedTx={expandedTx}
                  onToggleBlock={() => openDetail(null)}
                  onToggleTx={handleToggleTx}
                  blockTxData={blockTxData[shownLookup.block.number]}
                  blockTxLoading={false}
                  blockFee={blockFees[shownLookup.block.number]}
                />
              </div>
            )}
          </div>
        )}

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
                  onToggleBlock={handleToggleBlock}
                  onToggleTx={handleToggleTx}
                  blockTxData={blockTxData[block.number]}
                  blockTxLoading={blockTxLoading[block.number] ?? false}
                  blockTxError={blockTxError[block.number]}
                  onRetry={loadBlockTxs}
                  blockFee={blockFees[block.number]}
                />
              ))}
            </div>
          )}

          {!loading && blocks.length > 0 && oldestBlock > 0 && (
            <div className="pt-3 text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadOlder}
                disabled={loadingOlder}
                className="font-mono text-xs uppercase tracking-wider h-7 px-3"
              >
                {loadingOlder && <Loader2 className="h-3 w-3 animate-spin" />}
                Load older blocks
              </Button>
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

export default function ExplorerPage() {
  const { network } = useNetwork()
  return (
    <Suspense fallback={null}>
      <ExplorerPageInner key={network.id} />
    </Suspense>
  )
}
