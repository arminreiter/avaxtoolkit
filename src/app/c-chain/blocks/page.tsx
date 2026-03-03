"use client"

import { useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { useRawJson } from "@/lib/hooks/use-raw-json"

interface BlockData {
  number: number
  hash: string
  parentHash: string
  timestamp: number
  gasUsed: string
  gasLimit: string
  transactionCount: number
  miner: string
}

export default function BlockExplorerPage() {
  const { endpoints } = useNetwork()
  const [blockInput, setBlockInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [block, setBlock] = useState<BlockData | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function handleFetch() {
    setLoading(true)
    setError("")
    setBlock(null)
    clearRaw()
    try {
      const blockParam = blockInput.trim() === "" ? "latest" : Number(blockInput.trim())
      if (blockParam !== "latest" && isNaN(blockParam)) {
        throw new Error("Invalid block number")
      }
      const result = await CChainService.getBlock(endpoints.cChain, blockParam)
      if (!result) {
        throw new Error("Block not found")
      }
      setBlock({
        number: result.number,
        hash: result.hash ?? "",
        parentHash: result.parentHash,
        timestamp: result.timestamp,
        gasUsed: result.gasUsed.toString(),
        gasLimit: result.gasLimit.toString(),
        transactionCount: result.transactions.length,
        miner: result.miner ?? "",
      })
      captureRaw()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch block")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolCard
      title="Block Explorer"
      description="Look up block details by block number. Leave empty for the latest block."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <FormField
          label="Block Number"
          id="block-number"
          value={blockInput}
          onChange={setBlockInput}
          placeholder="Enter block number or leave empty for latest"
          type="number"
        />
        <LoadingButton loading={loading} onClick={handleFetch}>
          Fetch Block
        </LoadingButton>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {block && (
          <div className="space-y-3">
            <DetailGrid
              title="Block Overview"
              rpcMethod="eth_getBlockByNumber"
              columns={4}
              items={[
                { label: "Block Number", value: block.number.toLocaleString() },
                { label: "Timestamp", value: new Date(block.timestamp * 1000).toLocaleString() },
                { label: "Transactions", value: block.transactionCount.toString() },
                { label: "Gas Used / Limit", value: `${BigInt(block.gasUsed).toLocaleString()} / ${BigInt(block.gasLimit).toLocaleString()}` },
              ]}
            />
            <DetailGrid
              title="Hashes & Miner"
              rpcMethod="eth_getBlockByNumber"
              columns={2}
              items={[
                { label: "Block Hash", value: block.hash, mono: true, copyable: true },
                { label: "Parent Hash", value: block.parentHash, mono: true, copyable: true },
                { label: "Miner", value: block.miner, mono: true, fullWidth: true, copyable: true },
              ]}
            />
          </div>
        )}
      </div>
    </ToolCard>
  )
}
