"use client"

import { Suspense, useEffect, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { CopyableId } from "@/components/tools/CopyableId"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { useNow } from "@/lib/hooks/use-now"
import { appLinks } from "@/lib/explorer-links"
import { errorMessage, formatGwei, formatTimestamp, gasColor, gasPercent, relativeTime } from "@/lib/utils"

const BLOCK_HASH_RE = /^0x[0-9a-fA-F]{64}$/

interface BlockData {
  number: number
  hash: string
  parentHash: string
  timestamp: number
  gasUsed: bigint
  gasLimit: bigint
  baseFeePerGas: bigint | null
  transactions: readonly string[]
  miner: string
}

function BlockExplorerPageInner() {
  const { endpoints } = useNetwork()
  const [blockParam, setBlockParam] = useQueryParam("block")
  const [blockInput, setBlockInput] = useState(blockParam)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [block, setBlock] = useState<BlockData | null>(null)
  const [rpcMethod, setRpcMethod] = useState("eth_getBlockByNumber")
  const { rawJson, clearRaw, captureRaw } = useRawJson()
  useNow() // keep the relative timestamp live

  async function fetchBlock(input: string) {
    setLoading(true)
    setError("")
    setBlock(null)
    clearRaw()
    try {
      const value = input === "" ? "latest" : input
      if (value !== "latest" && !/^\d+$/.test(value) && !BLOCK_HASH_RE.test(value)) {
        throw new Error("Enter a block number, a 0x block hash, or 'latest'")
      }
      const result = await CChainService.getBlock(endpoints.cChain, value)
      if (!result) {
        throw new Error("Block not found")
      }
      setRpcMethod(BLOCK_HASH_RE.test(value) ? "eth_getBlockByHash" : "eth_getBlockByNumber")
      setBlock({
        number: result.number,
        hash: result.hash ?? "",
        parentHash: result.parentHash,
        timestamp: result.timestamp,
        gasUsed: result.gasUsed,
        gasLimit: result.gasLimit,
        baseFeePerGas: result.baseFeePerGas,
        transactions: result.transactions,
        miner: result.miner ?? "",
      })
      captureRaw()
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch block"))
    } finally {
      setLoading(false)
    }
  }

  // runs on deep links, back button and in-page navigation (prev/next/parent)
  useEffect(() => {
    if (!blockParam) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- input and fetch follow the URL param
    setBlockInput(blockParam)
    fetchBlock(blockParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the param changes
  }, [blockParam])

  function goTo(value: string) {
    if (value !== blockParam) setBlockParam(value || null) // the param effect fetches non-empty values
    if (!value || value === blockParam) fetchBlock(value)
  }

  const gasPct = block ? gasPercent(Number(block.gasUsed), Number(block.gasLimit)) : 0
  const rel = block ? relativeTime(block.timestamp) : ""

  return (
    <ToolCard
      title="Block Explorer"
      description="Look up block details by block number or hash. Leave empty for the latest block."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); goTo(blockInput.trim()) }}>
          <FormField
            label="Block Number or Hash"
            id="block-number"
            value={blockInput}
            onChange={setBlockInput}
            placeholder="Block number, 0x hash, or leave empty for latest"
            monospace
          />
          <LoadingButton type="submit" loading={loading}>
            Fetch Block
          </LoadingButton>
        </form>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {block && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={loading || block.number === 0} onClick={() => goTo(String(block.number - 1))}>
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => goTo(String(block.number + 1))}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <DetailGrid
              title="Block Overview"
              rpcMethod={rpcMethod}
              columns={3}
              items={[
                { label: "Block Number", value: block.number.toLocaleString() },
                {
                  label: "Timestamp",
                  value: (
                    <p className="text-sm font-medium">
                      {rel === "now" ? "just now" : `${rel} ago`}{" "}
                      <span className="text-muted-foreground">({formatTimestamp(block.timestamp)})</span>
                    </p>
                  ),
                },
                { label: "Transactions", value: block.transactions.length.toLocaleString() },
                {
                  label: "Gas Used / Limit",
                  value: (
                    <p className="text-sm font-medium">
                      {block.gasUsed.toLocaleString()} / {block.gasLimit.toLocaleString()}{" "}
                      <span className={gasColor(gasPct)}>({gasPct}%)</span>
                    </p>
                  ),
                },
                { label: "Base Fee", value: block.baseFeePerGas === null ? "—" : `${formatGwei(block.baseFeePerGas)} gwei` },
              ]}
            />
            <DetailGrid
              title="Hashes & Miner"
              rpcMethod={rpcMethod}
              columns={2}
              items={[
                {
                  label: "Block Hash",
                  value: <CopyableId value={block.hash} explorer="block" className="text-sm font-mono" />,
                },
                {
                  label: "Parent Hash",
                  value: <CopyableId value={block.parentHash} href={`/c-chain/blocks?block=${block.parentHash}`} explorer="block" className="text-sm font-mono" />,
                },
                {
                  label: "Miner",
                  value: <CopyableId value={block.miner} href={appLinks.address(block.miner)} explorer="address" className="text-sm font-mono" />,
                  fullWidth: true,
                },
              ]}
            />
            {block.transactions.length > 0 && (
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm font-medium uppercase tracking-wider">
                    Transactions ({block.transactions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="max-h-96 overflow-y-auto space-y-1">
                    {block.transactions.map((hash) => (
                      <li key={hash}>
                        <CopyableId value={hash} href={appLinks.tx(hash)} explorer="tx" className="text-sm font-mono" />
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </ToolCard>
  )
}

export default function BlockExplorerPage() {
  const { network } = useNetwork()
  return (
    <Suspense fallback={null}>
      <BlockExplorerPageInner key={network.id} />
    </Suspense>
  )
}
