"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { isAddress } from "ethers/address"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { CopyableId } from "@/components/tools/CopyableId"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { appLinks } from "@/lib/explorer-links"
import { errorMessage, formatTokenAmount } from "@/lib/utils"

interface TokenData {
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
}

function TokenInfoPageInner() {
  const { endpoints } = useNetwork()
  const [param, setParam] = useQueryParam("address")
  const [contractAddress, setContractAddress] = useState(param)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [token, setToken] = useState<TokenData | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const lookup = useCallback(async (addr: string) => {
    setLoading(true)
    setError("")
    setToken(null)
    clearRaw()
    try {
      const result = await CChainService.getTokenInfo(endpoints.cChain, addr)
      setToken({ address: addr, ...result })
      captureRaw()
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch token info"))
    } finally {
      setLoading(false)
    }
  }, [endpoints.cChain, clearRaw, captureRaw])

  // Deep links and back/forward: run whenever the URL param changes
  useEffect(() => {
    if (param && isAddress(param)) Promise.resolve().then(() => lookup(param))
  }, [param, lookup])

  function handleSubmit() {
    const addr = contractAddress.trim()
    if (!isAddress(addr)) {
      setError(addr ? "Invalid address: expected 0x followed by 40 hex characters" : "Please enter a contract address")
      return
    }
    if (addr === param) lookup(addr)
    else setParam(addr)
  }

  return (
    <ToolCard
      title="ERC-20 Token Info"
      description="Retrieve information about any ERC-20 token on the C-Chain."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSubmit() }}>
          <FormField
            label="Contract Address"
            id="contract-address"
            value={contractAddress}
            onChange={setContractAddress}
            placeholder="0x..."
            monospace
          />
          <LoadingButton type="submit" loading={loading}>
            Fetch Token Info
          </LoadingButton>
        </form>

        {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

        {token && (
          <DetailGrid
            title="Token Details"
            rpcMethod="ERC-20 contract calls"
            columns={4}
            items={[
              {
                label: "Contract",
                fullWidth: true,
                value: (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <CopyableId value={token.address} explorer="token" className="font-mono" />
                    <Link href={appLinks.contract(token.address)} className="text-xs text-primary hover:underline underline-offset-2">
                      Read / write contract
                    </Link>
                  </div>
                ),
              },
              { label: "Name", value: token.name },
              { label: "Symbol", value: token.symbol },
              { label: "Decimals", value: token.decimals.toString() },
              { label: "Total Supply", value: `${formatTokenAmount(BigInt(token.totalSupply), token.decimals)} ${token.symbol}`, mono: true },
            ]}
          />
        )}
      </div>
    </ToolCard>
  )
}

export default function TokenInfoPage() {
  const { network } = useNetwork()
  return <Suspense fallback={null}><TokenInfoPageInner key={network.id} /></Suspense>
}
