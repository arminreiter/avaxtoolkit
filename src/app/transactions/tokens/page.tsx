"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { formatEther, parseEther } from "ethers/utils"
import { isAddress } from "ethers/address"
import { RefreshCw, Trash2, Radar, Send } from "lucide-react"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { CopyableId } from "@/components/tools/CopyableId"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/contexts/wallet-context"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { type TrackedToken, loadTokens, saveTokens, mergeTokens, wavaxAddress } from "@/lib/models/token"
import { recordSentTx } from "@/lib/models/tx-history"
import { appLinks } from "@/lib/explorer-links"
import { truncateId, errorMessage, formatTokenAmount, formatAvaxWei } from "@/lib/utils"

// ponytail: flat reserve covers a wrap tx (~50k gas) at any sane gas price; estimate it if fees spike
const GAS_RESERVE = parseEther("0.01")

export default function TokensPage() {
  const { activeWallet, openWalletDialog, requireWallet } = useWallet()
  const { network, endpoints } = useNetwork()
  const [tokens, setTokens] = useState<TrackedToken[]>([])
  const [balances, setBalances] = useState<Record<string, bigint | null>>({})
  const [loading, setLoading] = useState(false)
  const [newToken, setNewToken] = useState("")
  const [adding, setAdding] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [hideZero, setHideZero] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [wrapAmount, setWrapAmount] = useState("")
  const [wrapping, setWrapping] = useState<"wrap" | "unwrap" | null>(null)
  const [wrapBalances, setWrapBalances] = useState<{ avax: bigint; wavax: bigint } | null>(null)
  const [wrapHash, setWrapHash] = useState("")

  const canDiscover = network.type === "mainnet" || network.type === "fuji"
  const owner = activeWallet?.address
  const wavax = wavaxAddress(network.chainId)

  useEffect(() => {
    // localStorage is only readable after mount (static export)
    Promise.resolve().then(() => setTokens(loadTokens(network.chainId)))
  }, [network.chainId])

  const refresh = useCallback(async (list: TrackedToken[]) => {
    if (!owner) { setBalances({}); setWrapBalances(null); return }
    setLoading(true)
    setError("")
    try {
      const [result, avax, wavaxBalance] = await Promise.all([
        CChainService.getTokenBalances(endpoints.cChain, owner, list.map(t => t.address)),
        CChainService.getBalance(endpoints.cChain, owner),
        wavax ? CChainService.getTokenBalances(endpoints.cChain, owner, [wavax]).then(b => b[0]) : Promise.resolve(null),
      ])
      setBalances(Object.fromEntries(list.map((t, i) => [t.address, result[i]])))
      setWrapBalances({ avax: BigInt(avax.wei), wavax: wavaxBalance ?? BigInt(0) })
    } catch (err) {
      setError(errorMessage(err, "Failed to load balances"))
    } finally {
      setLoading(false)
    }
  }, [owner, endpoints.cChain, wavax])

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => { if (!cancelled) refresh(tokens) })
    return () => { cancelled = true }
  }, [tokens, refresh])

  function updateTokens(list: TrackedToken[]) {
    setTokens(list)
    saveTokens(network.chainId, list)
  }

  async function addToken() {
    setError("")
    setInfo("")
    const address = newToken.trim()
    if (!isAddress(address)) { setError("Invalid token contract address"); return }
    setAdding(true)
    try {
      const meta = await CChainService.getTokenInfo(endpoints.cChain, address)
      const merged = mergeTokens(tokens, [{ address, symbol: meta.symbol, name: meta.name, decimals: meta.decimals }])
      if (merged.length === tokens.length) setInfo(`${meta.symbol} is already tracked`)
      updateTokens(merged)
      setNewToken("")
    } catch (err) {
      setError(err instanceof Error ? `Not an ERC-20 token: ${err.message}` : "Not an ERC-20 token")
    } finally {
      setAdding(false)
    }
  }

  async function discover() {
    if (!owner) return
    setError("")
    setInfo("")
    setDiscovering(true)
    try {
      const found = await CChainService.discoverTokens(network.chainId, owner)
      // Transfer history includes spam airdrops and long-emptied tokens; keep only current holdings
      const held = await CChainService.getTokenBalances(endpoints.cChain, owner, found.map(t => t.address))
      const holding = found.filter((_, i) => (held[i] ?? BigInt(0)) > BigInt(0))
      const merged = mergeTokens(tokens, holding)
      setInfo(`Routescan found ${found.length} token${found.length === 1 ? "" : "s"}, ${holding.length} with a balance, ${merged.length - tokens.length} new`)
      updateTokens(merged)
    } catch (err) {
      setError(errorMessage(err, "Discovery failed"))
    } finally {
      setDiscovering(false)
    }
  }

  async function wrap(mode: "wrap" | "unwrap") {
    if (!wavax) return
    setError("")
    setInfo("")
    setWrapHash("")
    setWrapping(mode)
    try {
      const amount = parseEther(wrapAmount.trim())
      if (amount <= BigInt(0)) throw new Error("Amount must be positive")
      const request = mode === "wrap" ? CChainService.encodeWrap(wavax, amount) : CChainService.encodeUnwrap(wavax, amount)
      const signer = await requireWallet()
      const tx = await signer.sendTransaction(request)
      recordSentTx(tx, `${mode === "wrap" ? "Wrap" : "Unwrap"} ${wrapAmount.trim()} AVAX`)
      setWrapHash(tx.hash)
      await tx.wait()
      setWrapAmount("")
      await refresh(tokens)
    } catch (err) {
      setError(errorMessage(err, "Transaction failed"))
    } finally {
      setWrapping(null)
    }
  }

  const rows = tokens
    .map(token => ({ token, balance: balances[token.address] }))
    .filter(r => !hideZero || (r.balance != null && r.balance > BigInt(0)))

  return (
    <ToolCard title="Tokens" description="ERC-20 balances of the active wallet. Track tokens by contract address — no indexer required.">
      <div className="space-y-4">
        {!owner ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Connect a wallet to see token balances.</p>
            <Button variant="outline" size="sm" onClick={openWalletDialog}>Connect Wallet</Button>
          </div>
        ) : (
          <div className="text-xs font-mono text-muted-foreground break-all">Owner: {owner}</div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <FormField label="Add Token" id="token-address" value={newToken} onChange={setNewToken}
              placeholder="Token contract 0x..." monospace />
          </div>
          <LoadingButton onClick={addToken} loading={adding} disabled={!newToken.trim()}>Add</LoadingButton>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refresh(tokens)} disabled={!owner || loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {canDiscover && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={discover} disabled={!owner || discovering}
              title="Look up tokens this address has received via the Routescan API">
              <Radar className={`h-3.5 w-3.5 ${discovering ? "animate-pulse" : ""}`} /> Discover via Routescan
            </Button>
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer ml-auto">
            <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)} className="rounded" />
            Hide zero balances
          </label>
        </div>

        {info && <p className="text-xs text-muted-foreground font-mono">{info}</p>}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive break-all">{error}</p>
          </div>
        )}

        {tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens tracked on {network.name}. Add one by contract address.</p>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2">Token</th>
                  <th className="text-left p-2">Contract</th>
                  <th className="text-right p-2">Balance</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ token, balance }) => (
                  <tr key={token.address} className="border-b last:border-0">
                    <td className="p-2">
                      <div className="font-semibold">{token.symbol}</div>
                      <div className="text-muted-foreground truncate max-w-40">{token.name}</div>
                    </td>
                    <td className="p-2"><CopyableId value={token.address} display={truncateId(token.address, 8, 6)}
                      href={appLinks.token(token.address)} explorer="token" /></td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {loading && balance === undefined ? "…" : balance == null ? (owner ? "error" : "—") : formatTokenAmount(balance, token.decimals)}
                    </td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {/* ponytail: send page has no ?asset= param yet; user picks the token there */}
                      <Button asChild variant="ghost" size="icon" className="h-7 w-7" title={`Send ${token.symbol}`}>
                        <Link href={`/transactions/send?asset=${encodeURIComponent(token.address)}`} aria-label={`Send ${token.symbol}`}><Send className="h-3.5 w-3.5" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Stop tracking" aria-label={`Stop tracking ${token.symbol}`}
                        onClick={() => updateTokens(tokens.filter(t => t.address !== token.address))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {wavax && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{"// "}Wrap / Unwrap AVAX</h3>
            {wrapBalances && (
              <p className="text-xs font-mono text-muted-foreground">
                AVAX: {formatAvaxWei(wrapBalances.avax)} · WAVAX: {formatAvaxWei(wrapBalances.wavax)}
              </p>
            )}
            {wrapBalances && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={wrapBalances.avax <= GAS_RESERVE}
                  onClick={() => setWrapAmount(formatEther(wrapBalances.avax - GAS_RESERVE))}
                  title="AVAX balance minus 0.01 AVAX gas reserve">Max AVAX</Button>
                <Button variant="outline" size="sm" disabled={wrapBalances.wavax <= BigInt(0)}
                  onClick={() => setWrapAmount(formatEther(wrapBalances.wavax))}>Max WAVAX</Button>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1">
                <FormField label="Amount" id="wrap-amount" value={wrapAmount} onChange={setWrapAmount} placeholder="0.1" type="number" />
              </div>
              <div className="flex gap-2">
                <LoadingButton onClick={() => wrap("wrap")} loading={wrapping === "wrap"} disabled={!wrapAmount.trim() || wrapping !== null}>
                  Wrap
                </LoadingButton>
                <LoadingButton onClick={() => wrap("unwrap")} loading={wrapping === "unwrap"} disabled={!wrapAmount.trim() || wrapping !== null}>
                  Unwrap
                </LoadingButton>
              </div>
            </div>
            {wrapHash && (
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                Sent: <CopyableId value={wrapHash} display={truncateId(wrapHash, 10, 8)} href={appLinks.tx(wrapHash)} explorer="tx" />
              </div>
            )}
          </div>
        )}
      </div>
    </ToolCard>
  )
}
