"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Send, GitFork, ArrowDownToLine, Wallet, Coins, Copy, Check } from "lucide-react"
import { useWallet } from "@/lib/contexts/wallet-context"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { ToolCard } from "@/components/tools/ToolCard"
import { StatCard } from "@/components/dashboard/StatCard"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const tools = [
  { href: "/transactions/send", icon: Send, title: "Send", description: "Send AVAX to an address" },
  { href: "/transactions/fan-out", icon: GitFork, title: "Fan Out", description: "Distribute AVAX to multiple addresses" },
  { href: "/transactions/drain", icon: ArrowDownToLine, title: "Drain", description: "Consolidate multiple wallets into one" },
]

export default function WalletDashboardPage() {
  const { activeWallet, openWalletDialog } = useWallet()
  const { network, endpoints } = useNetwork()
  const [balance, setBalance] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!activeWallet?.address) {
      Promise.resolve().then(() => {
        if (!cancelled) { setBalance(null); setLoading(false) }
      })
      return () => { cancelled = true }
    }

    Promise.resolve().then(() => { if (!cancelled) setLoading(true) })
    CChainService.getBalance(endpoints.cChain, activeWallet.address)
      .then(result => { if (!cancelled) setBalance(result.avax) })
      .catch(() => { if (!cancelled) setBalance(null) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [activeWallet?.address, endpoints.cChain])

  const copyAddress = () => {
    if (!activeWallet?.address) return
    navigator.clipboard.writeText(activeWallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <ToolCard title="Wallet" description="Active wallet overview and transaction tools.">
      <div className="space-y-6">
        {activeWallet ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Active Wallet</span>
              <span className="font-display text-sm font-semibold">{activeWallet.name}</span>
            </div>

            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-muted-foreground break-all">{activeWallet.address}</code>
              <button onClick={copyAddress} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <StatCard
                label="C-Chain Balance"
                value={balance !== null ? `${balance} AVAX` : "—"}
                icon={Coins}
                iconColor="cyan"
                loading={loading}
                rpcInfo="eth_getBalance"
              />
              <StatCard
                label="Network"
                value={network.name}
                icon={Wallet}
                iconColor="purple"
              />
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
