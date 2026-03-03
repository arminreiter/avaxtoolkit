"use client"

import { useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { useRawJson } from "@/lib/hooks/use-raw-json"

interface TokenData {
  name: string
  symbol: string
  decimals: number
  totalSupply: string
}

export default function TokenInfoPage() {
  const { endpoints } = useNetwork()
  const [contractAddress, setContractAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [token, setToken] = useState<TokenData | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function handleFetch() {
    setLoading(true)
    setError("")
    setToken(null)
    clearRaw()
    try {
      const addr = contractAddress.trim()
      if (!addr) {
        throw new Error("Please enter a contract address")
      }
      const result = await CChainService.getTokenInfo(endpoints.cChain, addr)
      setToken(result)
      captureRaw()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch token info")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolCard
      title="ERC-20 Token Info"
      description="Retrieve information about any ERC-20 token on the C-Chain."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <FormField
          label="Contract Address"
          id="contract-address"
          value={contractAddress}
          onChange={setContractAddress}
          placeholder="0x..."
          monospace
        />
        <LoadingButton loading={loading} onClick={handleFetch}>
          Fetch Token Info
        </LoadingButton>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {token && (
          <DetailGrid
            title="Token Details"
            rpcMethod="ERC-20 contract calls"
            columns={4}
            items={[
              { label: "Name", value: token.name },
              { label: "Symbol", value: token.symbol },
              { label: "Decimals", value: token.decimals.toString() },
              { label: "Total Supply", value: token.totalSupply, mono: true },
            ]}
          />
        )}
      </div>
    </ToolCard>
  )
}
