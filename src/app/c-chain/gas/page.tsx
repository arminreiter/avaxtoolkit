"use client"

import { useEffect, useState, useCallback } from "react"
import { formatUnits } from "ethers"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { ToolCard } from "@/components/tools/ToolCard"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { useRawJson } from "@/lib/hooks/use-raw-json"

interface GasData {
  gasPriceGwei: string
  maxFeePerGas: string | undefined
  maxPriorityFeePerGas: string | undefined
  currentBlock: number
}

export default function GasTrackerPage() {
  const { endpoints } = useNetwork()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [gasData, setGasData] = useState<GasData | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const fetchGasData = useCallback(async () => {
    setLoading(true)
    setError("")
    clearRaw()
    try {
      const [gasResult, blockNumber] = await Promise.all([
        CChainService.getGasPrice(endpoints.cChain),
        CChainService.getBlockNumber(endpoints.cChain),
      ])
      setGasData({
        gasPriceGwei: gasResult.gasPriceGwei,
        maxFeePerGas: gasResult.maxFeePerGas,
        maxPriorityFeePerGas: gasResult.maxPriorityFeePerGas,
        currentBlock: blockNumber,
      })
      captureRaw()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch gas data")
    } finally {
      setLoading(false)
    }
  }, [endpoints.cChain, clearRaw, captureRaw])

  useEffect(() => {
    fetchGasData()
  }, [fetchGasData])

  function formatGwei(weiValue: string | undefined): string {
    if (!weiValue) return "N/A"
    return `${formatUnits(weiValue, "gwei")} gwei`
  }

  return (
    <ToolCard
      title="Gas Tracker"
      description="Monitor current gas prices and block height on the C-Chain."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <LoadingButton loading={loading} onClick={fetchGasData}>
          Refresh
        </LoadingButton>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {gasData && (
          <DetailGrid
            title="Current Gas Data"
            rpcMethod="eth_feeData"
            columns={2}
            items={[
              { label: "Gas Price", value: `${gasData.gasPriceGwei} gwei` },
              { label: "Current Block", value: gasData.currentBlock.toLocaleString() },
              { label: "Max Fee Per Gas", value: formatGwei(gasData.maxFeePerGas), mono: true },
              { label: "Max Priority Fee", value: formatGwei(gasData.maxPriorityFeePerGas), mono: true },
            ]}
          />
        )}
      </div>
    </ToolCard>
  )
}
