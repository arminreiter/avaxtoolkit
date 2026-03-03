"use client"

import { useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { InfoCard } from "@/components/tools/InfoCard"

interface BalanceData {
  avax: string
  wei: string
}

export default function AddressBalancePage() {
  const { endpoints } = useNetwork()
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function handleFetch() {
    setLoading(true)
    setError("")
    setBalance(null)
    clearRaw()
    try {
      const addr = address.trim()
      if (!addr) {
        throw new Error("Please enter an address")
      }
      const result = await CChainService.getBalance(endpoints.cChain, addr)
      setBalance(result)
      captureRaw()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch balance")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolCard
      title="Address Balance"
      description="Check the AVAX balance of any C-Chain address."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <FormField
          label="Address"
          id="address"
          value={address}
          onChange={setAddress}
          placeholder="0x..."
          monospace
        />
        <LoadingButton loading={loading} onClick={handleFetch}>
          Check Balance
        </LoadingButton>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {balance && (
          <InfoCard label="Balance" rpcMethod="eth_getBalance">
            <div className="text-center space-y-1">
              <p className="text-3xl font-bold">{balance.avax} AVAX</p>
              <p className="text-sm text-muted-foreground font-mono break-all">
                {balance.wei} wei
              </p>
            </div>
          </InfoCard>
        )}
      </div>
    </ToolCard>
  )
}
