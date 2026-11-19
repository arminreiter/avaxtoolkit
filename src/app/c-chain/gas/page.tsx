"use client"

import { useEffect, useState, useCallback } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { ToolCard } from "@/components/tools/ToolCard"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { RefreshControl } from "@/components/tools/RefreshControl"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useInterval } from "@/lib/hooks/use-interval"
import { errorMessage, formatGwei } from "@/lib/utils"

const REFRESH_MS = 10000

interface GasData {
  gasPrice: bigint
  baseFee: bigint | null
  maxFeePerGas: string | undefined
  maxPriorityFeePerGas: string | undefined
  currentBlock: number
}

function gwei(wei: bigint | string | null | undefined): string {
  return wei == null ? "N/A" : `${formatGwei(BigInt(wei))} gwei`
}

function GasTrackerPageInner() {
  const { endpoints } = useNetwork()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [gasData, setGasData] = useState<GasData | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const fetchGasData = useCallback(async () => {
    setLoading(true)
    setError("")
    clearRaw()
    try {
      const [gasResult, baseFee, blockNumber] = await Promise.all([
        CChainService.getGasPrice(endpoints.cChain),
        CChainService.getBaseFee(endpoints.cChain),
        CChainService.getBlockNumber(endpoints.cChain),
      ])
      setGasData({
        gasPrice: BigInt(gasResult.gasPrice),
        baseFee,
        maxFeePerGas: gasResult.maxFeePerGas,
        maxPriorityFeePerGas: gasResult.maxPriorityFeePerGas,
        currentBlock: blockNumber,
      })
      setUpdatedAt(Date.now())
      captureRaw()
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch gas data"))
    } finally {
      setLoading(false)
    }
  }, [endpoints.cChain, clearRaw, captureRaw])

  useEffect(() => {
    Promise.resolve().then(fetchGasData)
  }, [fetchGasData])

  useInterval(() => { if (!loading) fetchGasData() }, autoRefresh ? REFRESH_MS : null)

  return (
    <ToolCard
      title="Gas Tracker"
      description="Monitor current gas prices and block height on the C-Chain."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <RefreshControl
          updatedAt={updatedAt}
          loading={loading}
          onRefresh={fetchGasData}
          autoRefresh={autoRefresh}
          onAutoRefreshChange={setAutoRefresh}
        />

        {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

        {gasData && (
          <DetailGrid
            title="Current Gas Data"
            rpcMethod="eth_gasPrice, eth_feeData, eth_getBlockByNumber"
            columns={2}
            items={[
              { label: "Gas Price", value: gwei(gasData.gasPrice) },
              { label: "Current Block", value: gasData.currentBlock.toLocaleString() },
              { label: "Base Fee", value: gwei(gasData.baseFee), mono: true },
              { label: "Priority Fee", value: gwei(gasData.maxPriorityFeePerGas), mono: true },
              { label: "Max Fee Per Gas", value: gwei(gasData.maxFeePerGas), mono: true },
            ]}
          />
        )}
      </div>
    </ToolCard>
  )
}

export default function GasTrackerPage() {
  const { network } = useNetwork()
  return <GasTrackerPageInner key={network.id} />
}
