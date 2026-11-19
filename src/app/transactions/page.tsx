"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Send, GitFork, ArrowDownToLine, Wallet, Coins, Layers, History, FileCode } from "lucide-react"
import { useWallet } from "@/lib/contexts/wallet-context"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { hrpForNetwork } from "@/lib/models/network"
import { loadTokens, type TrackedToken } from "@/lib/models/token"
import { avaxAddressFromWallet } from "@/lib/utils/wallet"
import { nAvaxToAvax, formatTokenAmount } from "@/lib/utils"
import { appLinks } from "@/lib/explorer-links"
import { ToolCard } from "@/components/tools/ToolCard"
import { CopyableId } from "@/components/tools/CopyableId"
import { RefreshControl } from "@/components/tools/RefreshControl"
import { StatCard } from "@/components/dashboard/StatCard"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const tools = [
  { href: "/transactions/send", icon: Send, title: "Send", description: "Send AVAX to an address" },
  { href: "/transactions/fan-out", icon: GitFork, title: "Fan Out", description: "Distribute AVAX or tokens to multiple addresses" },
  { href: "/transactions/drain", icon: ArrowDownToLine, title: "Drain", description: "Consolidate multiple wallets into one" },
  { href: "/transactions/tokens", icon: Layers, title: "Tokens", description: "ERC-20 balances of the active wallet" },
  { href: "/transactions/history", icon: History, title: "History", description: "Sent transactions, speed up or cancel" },
  { href: "/transactions/raw", icon: FileCode, title: "Raw Transaction", description: "Build, simulate, sign and broadcast" },
]

interface Balances {
  /** wallet+network the data belongs to; stale data from another key is not shown */
  key: string
  c: string | null
  p: string | null
  x: string | null
  tokens: { token: TrackedToken; balance: bigint }[]
  updatedAt: number
}

export default function WalletDashboardPage() {
  const { activeWallet, openWalletDialog } = useWallet()
  const { network, endpoints } = useNetwork()
  const [data, setData] = useState<Balances | null>(null)
  const [loading, setLoading] = useState(false)
  const [reload, setReload] = useState(0)

  const address = activeWallet?.address
  const pxSupported = !network.plainRpc
  const avaxAddr = useMemo(
    () => (activeWallet ? avaxAddressFromWallet(activeWallet, hrpForNetwork(network)) : null),
    [activeWallet, network],
  )
  const key = `${network.id}:${address ?? ""}`
  const current = data?.key === key ? data : null

  useEffect(() => {
    if (!address) return
    let cancelled = false
    const k = `${network.id}:${address}`
    const tokens = loadTokens(network.chainId)
    const withPx = pxSupported && avaxAddr

    Promise.resolve().then(() => { if (!cancelled) setLoading(true) })
    Promise.all([
      CChainService.getBalance(endpoints.cChain, address).then(r => r.avax).catch(() => null),
      withPx
        ? AvalancheService.getPChainBalance(network.baseUrl, [`P-${avaxAddr}`]).then(r => nAvaxToAvax(r.balance, 4)).catch(() => null)
        : Promise.resolve(null),
      withPx
        // ponytail: avm.getAllBalances reports AVAX under its "AVAX" alias
        ? AvalancheService.getXChainBalances(network.baseUrl, `X-${avaxAddr}`)
            .then(b => nAvaxToAvax(b.find(x => x.asset === "AVAX")?.balance ?? "0", 4)).catch(() => null)
        : Promise.resolve(null),
      CChainService.getTokenBalances(endpoints.cChain, address, tokens.map(t => t.address)).catch(() => tokens.map(() => null)),
    ]).then(([c, p, x, tokenBalances]) => {
      if (cancelled) return
      setData({
        key: k, c, p, x,
        tokens: tokens.flatMap((token, i) => {
          const balance = tokenBalances[i]
          return balance ? [{ token, balance }] : []
        }),
        updatedAt: Date.now(),
      })
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [address, avaxAddr, pxSupported, network.id, network.chainId, network.baseUrl, endpoints.cChain, reload])

  const pxValue = (v: string | null | undefined) => {
    if (!avaxAddr) return "N/A"
    return v ? `${v} AVAX` : "—"
  }

  return (
    <ToolCard title="Wallet" description="Active wallet overview and transaction tools.">
      <div className="space-y-6">
        {activeWallet ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Active Wallet</span>
                <span className="font-display text-sm font-semibold">{activeWallet.name}</span>
              </div>
              <RefreshControl updatedAt={current?.updatedAt ?? null} loading={loading} onRefresh={() => setReload(r => r + 1)} />
            </div>

            <dl className="grid gap-1 text-xs font-mono">
              <div className="flex items-center gap-2 flex-wrap">
                <dt className="text-muted-foreground w-16 shrink-0">C-Chain</dt>
                <dd className="min-w-0 break-all">
                  <CopyableId value={activeWallet.address} href={appLinks.address(activeWallet.address)} explorer="address" />
                </dd>
              </div>
              {pxSupported && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <dt className="text-muted-foreground w-16 shrink-0">P-Chain</dt>
                    <dd className="min-w-0 break-all">
                      {avaxAddr
                        ? <CopyableId value={`P-${avaxAddr}`} href={appLinks.stakingHistory(`P-${avaxAddr}`)} explorer="pAddress" />
                        : <span className="text-muted-foreground">not available for connected wallets</span>}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <dt className="text-muted-foreground w-16 shrink-0">X-Chain</dt>
                    <dd className="min-w-0 break-all">
                      {avaxAddr
                        ? <CopyableId value={`X-${avaxAddr}`} href={appLinks.xBalance(`X-${avaxAddr}`)} explorer="xAddress" />
                        : <span className="text-muted-foreground">not available for connected wallets</span>}
                    </dd>
                  </div>
                </>
              )}
            </dl>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="C-Chain Balance"
                value={current?.c != null ? `${current.c} AVAX` : "—"}
                icon={Coins}
                iconColor="cyan"
                loading={loading && !current}
                rpcInfo="eth_getBalance"
              />
              {pxSupported && (
                <>
                  <StatCard
                    label="P-Chain Balance"
                    value={pxValue(current?.p)}
                    icon={Coins}
                    iconColor="cyan"
                    loading={loading && !current && !!avaxAddr}
                    rpcInfo="platform.getBalance"
                  />
                  <StatCard
                    label="X-Chain Balance"
                    value={pxValue(current?.x)}
                    icon={Coins}
                    iconColor="cyan"
                    loading={loading && !current && !!avaxAddr}
                    rpcInfo="avm.getAllBalances"
                  />
                </>
              )}
              <StatCard
                label="Network"
                value={network.name}
                icon={Wallet}
                iconColor="purple"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{"// "}ERC-20 Tokens</h3>
                <Link href="/transactions/tokens" className="text-xs font-mono text-primary hover:underline">Manage tokens</Link>
              </div>
              {current ? (
                current.tokens.length > 0 ? (
                  <ul className="grid gap-1 text-xs font-mono sm:grid-cols-2">
                    {current.tokens.map(({ token, balance }) => (
                      <li key={token.address} className="flex justify-between gap-2 border border-border px-3 py-2">
                        <span>{token.symbol}</span>
                        <span>{formatTokenAmount(balance, token.decimals)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No token balances.</p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">{loading ? "Loading…" : "—"}</p>
              )}
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 flex flex-col items-center gap-4 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <p className="font-display text-sm uppercase tracking-wider">No Wallet Connected</p>
                <p className="text-xs text-muted-foreground mt-1">Connect or import a wallet to view your balance.</p>
              </div>
              <Button onClick={openWalletDialog} variant="outline" size="sm">
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        )}

        <div>
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">{"// "}Transaction Tools</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {tools.map(t => (
              <Link key={t.href} href={t.href}>
                <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                  <CardContent className="pt-4 flex flex-col items-center text-center gap-2">
                    <t.icon className="h-6 w-6 text-primary" />
                    <h3 className="font-display text-sm font-semibold uppercase tracking-wider">{t.title}</h3>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </ToolCard>
  )
}
