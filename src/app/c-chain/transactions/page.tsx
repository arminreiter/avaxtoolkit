"use client"

import { useState } from "react"
import { formatEther } from "ethers"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { Badge } from "@/components/ui/badge"

interface TxData {
  hash: string
  status: "success" | "fail"
  blockNumber: number
  from: string
  to: string
  value: string
  gasUsed: string
  gasPrice: string
  nonce: number
}

export default function TransactionLookupPage() {
  const { endpoints } = useNetwork()
  const [txHash, setTxHash] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [txData, setTxData] = useState<TxData | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function handleFetch() {
    setLoading(true)
    setError("")
    setTxData(null)
    clearRaw()
    try {
      const hash = txHash.trim()
      if (!hash) {
        throw new Error("Please enter a transaction hash")
      }
      const { tx, receipt } = await CChainService.getTransaction(
        endpoints.cChain,
        hash
      )
      if (!tx || !receipt) {
        throw new Error("Transaction not found")
      }
      setTxData({
        hash: tx.hash,
        status: receipt.status === 1 ? "success" : "fail",
        blockNumber: receipt.blockNumber,
        from: tx.from,
        to: tx.to ?? "",
        value: formatEther(tx.value),
        gasUsed: receipt.gasUsed.toString(),
        gasPrice: tx.gasPrice?.toString() ?? "0",
        nonce: tx.nonce,
      })
      captureRaw()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch transaction")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolCard
      title="Transaction Lookup"
      description="Look up transaction details by transaction hash."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <FormField
          label="Transaction Hash"
          id="tx-hash"
          value={txHash}
          onChange={setTxHash}
          placeholder="0x..."
          monospace
        />
        <LoadingButton loading={loading} onClick={handleFetch}>
          Fetch Transaction
        </LoadingButton>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {txData && (
          <div className="space-y-3">
            <DetailGrid
              title="Transaction Overview"
              rpcMethod="eth_getTransactionByHash"
              columns={3}
              items={[
                {
                  label: "Status",
                  value: txData.status === "success" ? (
                    <Badge variant="default">Success</Badge>
                  ) : (
                    <Badge variant="destructive">Failed</Badge>
                  ),
                },
                { label: "Block", value: txData.blockNumber.toLocaleString() },
                { label: "Nonce", value: txData.nonce.toString() },
                { label: "Value", value: `${txData.value} AVAX` },
                { label: "Gas Used", value: BigInt(txData.gasUsed).toLocaleString() },
                { label: "Gas Price", value: `${txData.gasPrice} wei`, mono: true },
              ]}
            />
            <DetailGrid
              title="Addresses"
              rpcMethod="eth_getTransactionByHash"
              columns={2}
              items={[
                { label: "TX Hash", value: txData.hash, mono: true, fullWidth: true, copyable: true },
                { label: "From", value: txData.from, mono: true, copyable: true },
                { label: "To", value: txData.to || "Contract Creation", mono: true, copyable: !!txData.to },
              ]}
            />
          </div>
        )}
      </div>
    </ToolCard>
  )
}
