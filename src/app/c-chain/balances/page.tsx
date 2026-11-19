"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { isAddress } from "ethers/address"
import { useNetwork } from "@/lib/contexts/network-context"
import { useWallet } from "@/lib/contexts/wallet-context"
import { CChainService } from "@/lib/services/cchain.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { loadTokens, type TrackedToken } from "@/lib/models/token"
import { appLinks } from "@/lib/explorer-links"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { InfoCard } from "@/components/tools/InfoCard"
import { CopyableId } from "@/components/tools/CopyableId"
import { RefreshControl } from "@/components/tools/RefreshControl"
import { errorMessage, formatAvaxWei, formatTokenAmount } from "@/lib/utils"

interface BalanceData {
  address: string
  wei: string
  tokens: { token: TrackedToken; balance: bigint }[]
}

function AddressBalancePageInner() {
  const { endpoints, network } = useNetwork()
  const { activeWallet } = useWallet()
  const [param, setParam] = useQueryParam("address")
  const [address, setAddress] = useState(param)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [balance, setBalance] = useState<BalanceData | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  // Prefill the active wallet's address once it loads, unless the user already typed something
  const walletAddress = activeWallet?.address ?? ""
  const [prevWalletAddress, setPrevWalletAddress] = useState("")
  if (walletAddress !== prevWalletAddress) {
    setPrevWalletAddress(walletAddress)
    if (!address) setAddress(walletAddress)
  }

  const lookup = useCallback(async (addr: string) => {
    setLoading(true)
    setError("")
    clearRaw()
    try {
      const tokens = loadTokens(network.chainId)
      const [result, tokenBalances] = await Promise.all([
        CChainService.getBalance(endpoints.cChain, addr),
        CChainService.getTokenBalances(endpoints.cChain, addr, tokens.map(t => t.address)),
      ])
      setBalance({
        address: addr,
        wei: result.wei,
        tokens: tokens.flatMap((token, i) => {
          const b = tokenBalances[i]
          return b === null ? [] : [{ token, balance: b }]
        }),
      })
      setUpdatedAt(Date.now())
      captureRaw()
    } catch (err) {
      setBalance(null)
      setError(errorMessage(err, "Failed to fetch balance"))
    } finally {
      setLoading(false)
    }
  }, [endpoints.cChain, network.chainId, clearRaw, captureRaw])

  // Deep links and back/forward: run whenever the URL param changes
  useEffect(() => {
    if (param && isAddress(param)) Promise.resolve().then(() => lookup(param))
  }, [param, lookup])

  function handleSubmit() {
    const addr = address.trim()
    if (!isAddress(addr)) {
      setError(addr ? "Invalid address: expected 0x followed by 40 hex characters" : "Please enter an address")
      return
    }
    if (addr === param) lookup(addr)
    else setParam(addr)
  }

  return (
    <ToolCard
      title="Address Balance"
      description="Check the AVAX and known ERC-20 token balances of any C-Chain address."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSubmit() }}>
          <FormField
            label="Address"
            id="address"
            value={address}
            onChange={setAddress}
            placeholder="0x..."
            monospace
          />
          <LoadingButton type="submit" loading={loading}>
            Check Balance
          </LoadingButton>
        </form>

        {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

        {balance && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CopyableId value={balance.address} explorer="address" className="font-mono text-sm" />
              <RefreshControl updatedAt={updatedAt} loading={loading} onRefresh={() => lookup(balance.address)} />
            </div>
            <InfoCard label="Balance" rpcMethod="eth_getBalance">
              <div className="text-center space-y-1">
                <p className="text-3xl font-bold">{formatAvaxWei(BigInt(balance.wei))} AVAX</p>
                <p className="text-sm text-muted-foreground font-mono break-all">
                  {balance.wei} wei
                </p>
              </div>
            </InfoCard>
            {balance.tokens.length > 0 && (
              <InfoCard label="Known Tokens" rpcMethod="balanceOf (ERC-20)">
                <ul className="divide-y divide-border">
                  {balance.tokens.map(({ token, balance: b }) => (
                    <li key={token.address} className="flex items-center justify-between gap-4 py-2 text-sm">
                      <CopyableId
                        value={token.address}
                        display={token.symbol}
                        href={appLinks.token(token.address)}
                        explorer="token"
                        className="font-medium"
                      />
                      <span className="font-mono">{formatTokenAmount(b, token.decimals)}</span>
                    </li>
                  ))}
                </ul>
              </InfoCard>
            )}
          </>
        )}
      </div>
    </ToolCard>
  )
}

export default function AddressBalancePage() {
  const { network } = useNetwork()
  return <Suspense fallback={null}><AddressBalancePageInner key={network.id} /></Suspense>
}
