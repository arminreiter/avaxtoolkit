"use client"

import { useState, useMemo } from "react"
import { isAddress } from "ethers/address"
import { formatEther, formatUnits } from "ethers/utils"
import { Wallet } from "ethers/wallet"
import { type TransactionRequest } from "ethers/providers"
import { CChainService } from "@/lib/services/cchain.service"
import { Plus, Trash2 } from "lucide-react"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { useConfirm } from "@/components/tools/ConfirmDialog"
import { useWallet } from "@/lib/contexts/wallet-context"
import { useNetwork } from "@/lib/contexts/network-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TxBatchResultTable } from "@/components/tools/TxBatchResultTable"
import { truncateId, errorMessage } from "@/lib/utils"
import { recordSentTx } from "@/lib/models/tx-history"
import { AssetSelect, useAssetSelection } from "@/components/wallet/AssetSelect"

interface SourceWallet {
  privateKey: string
}

interface DrainResult {
  address: string
  amount: string
  hash?: string
  error?: string
  status: "pending" | "sent" | "confirmed" | "failed" | "skipped"
}

interface DrainPlan {
  wallet: Wallet
  balance: string // AVAX, formatted
  amount: string // amount that will be sent, formatted in the selected asset
  units?: bigint
  txParams?: TransactionRequest
  skip?: string
}

export default function DrainPage() {
  const { wallets, activeWallet } = useWallet()
  const { network, endpoints } = useNetwork()
  const { tokens, asset, setAsset, token, symbol } = useAssetSelection(network.chainId)
  const [destination, setDestination] = useState("")
  const [sources, setSources] = useState<SourceWallet[]>([{ privateKey: "" }])
  const [useStoredWallets, setUseStoredWallets] = useState(false)
  const [selectedWalletIds, setSelectedWalletIds] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<DrainResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [prevNetworkId, setPrevNetworkId] = useState(network.id)
  const [prefilled, setPrefilled] = useState(false)
  const { confirm, dialog } = useConfirm()

  // Results belong to the previous network: clear them on switch (form inputs are kept)
  if (prevNetworkId !== network.id) {
    setPrevNetworkId(network.id)
    setResults([])
    setError("")
  }

  // Prefill the destination once with the active wallet (wallets load from storage after mount)
  if (!prefilled && activeWallet) {
    setPrefilled(true)
    if (!destination) setDestination(activeWallet.address)
  }

  function addSource() {
    setSources(prev => [...prev, { privateKey: "" }])
  }

  function removeSource(index: number) {
    setSources(prev => prev.filter((_, i) => i !== index))
  }

  function updateSource(index: number, value: string) {
    setSources(prev => prev.map((s, i) => i === index ? { privateKey: value } : s))
  }

  function toggleStoredWallet(id: string) {
    setSelectedWalletIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleDrain() {
    setError("")
    setResults([])

    const dest = destination.trim()
    if (!isAddress(dest)) {
      setError("Invalid destination address")
      return
    }

    setLoading(true)
    try {
      const provider = CChainService.getProvider(endpoints.cChain)

      const walletsToSign: Wallet[] = []
      const addWallet = (w: Wallet) => {
        if (!walletsToSign.some(x => x.address === w.address)) walletsToSign.push(w)
      }

      for (let i = 0; i < sources.length; i++) {
        const s = sources[i]
        if (s.privateKey.trim()) {
          try {
            addWallet(new Wallet(s.privateKey.trim(), provider))
          } catch {
            setError(`Invalid private key at position ${i + 1}`)
            return
          }
        }
      }

      if (useStoredWallets) {
        for (const id of selectedWalletIds) {
          const stored = wallets.find(w => w.id === id)
          if (stored?.privateKey) addWallet(new Wallet(stored.privateKey, provider))
        }
      }

      if (walletsToSign.length === 0) {
        setError("No source wallets provided")
        return
      }

      const self = walletsToSign.find(w => w.address.toLowerCase() === dest.toLowerCase())
      if (self) {
        setError(`Destination ${self.address} is also a source wallet. Remove it from the sources or pick another destination.`)
        return
      }

      // Plan every transfer up front so the confirmation can show exactly what will be sent
      const feeData = await provider.getFeeData()
      const effectiveGasPrice = feeData.maxFeePerGas ?? feeData.gasPrice
      if (!effectiveGasPrice) {
        setError("Could not determine gas price")
        return
      }
      const plans: DrainPlan[] = await Promise.all(walletsToSign.map(async (wallet): Promise<DrainPlan> => {
        const balance = await provider.getBalance(wallet.address)
        const base = { wallet, balance: formatEther(balance) }
        if (token) {
          // Token mode: send the full token balance; the wallet's AVAX only pays gas
          const [tokenBalance] = await CChainService.getTokenBalances(endpoints.cChain, wallet.address, [token.address])
          if (!tokenBalance) return { ...base, amount: "0", skip: `No ${token.symbol} balance` }
          const amount = formatUnits(tokenBalance, token.decimals)
          const transfer = CChainService.encodeTokenTransfer(token.address, dest, tokenBalance)
          const gasLimit = await provider.estimateGas({ ...transfer, from: wallet.address })
          if (balance < effectiveGasPrice * gasLimit) return { ...base, amount, skip: "Insufficient AVAX for gas" }
          return { ...base, amount, units: tokenBalance, txParams: { ...transfer, gasLimit } }
        }
        const gasCost = effectiveGasPrice * BigInt(21000)
        if (balance <= gasCost) return { ...base, amount: formatEther(balance), skip: "Insufficient balance for gas" }
        const value = balance - gasCost
        return { ...base, amount: formatEther(value), units: value, txParams: { to: dest, value, gasLimit: 21000 } }
      }))

      const sendable = plans.filter(p => p.txParams)
      if (sendable.length === 0) {
        setResults(plans.map(p => ({ address: p.wallet.address, amount: p.amount, status: "skipped" as const, error: p.skip })))
        setError("Nothing to drain: no source wallet has a sendable balance")
        return
      }
      const total = sendable.reduce((sum, p) => sum + p.units!, BigInt(0))
      const decimals = token?.decimals ?? 18
      const ok = await confirm({
        title: `Drain ${formatUnits(total, decimals)} ${symbol}?`,
        description: (
          <div className="space-y-2 text-xs">
            <div className="font-mono break-all">To: {dest}</div>
            <div className="max-h-60 overflow-auto border">
              <table className="w-full font-mono">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-1.5">Source</th>
                    <th className="text-right p-1.5">AVAX balance</th>
                    <th className="text-right p-1.5">Sends ({symbol})</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map(p => (
                    <tr key={p.wallet.address} className="border-b last:border-0">
                      <td className="p-1.5">{truncateId(p.wallet.address, 6, 4)}</td>
                      <td className="p-1.5 text-right">{p.balance}</td>
                      <td className={`p-1.5 text-right ${p.skip ? "text-yellow-500" : ""}`}>{p.skip ? `skip: ${p.skip}` : p.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="font-mono">Total: {formatUnits(total, decimals)} {symbol} from {sendable.length} wallet{sendable.length !== 1 ? "s" : ""} on {network.name}</div>
          </div>
        ),
        confirmLabel: "Drain",
        destructive: true,
      })
      if (!ok) return

      const drainResults: DrainResult[] = plans.map(p => ({
        address: p.wallet.address, amount: p.amount,
        status: p.skip ? "skipped" as const : "pending" as const, error: p.skip,
      }))
      setResults([...drainResults])

      for (let i = 0; i < plans.length; i++) {
        const { wallet, amount, txParams } = plans[i]
        if (!txParams) continue
        try {
          drainResults[i].status = "sent"
          setResults([...drainResults])

          if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
            txParams.maxFeePerGas = feeData.maxFeePerGas
            txParams.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
          } else {
            txParams.gasPrice = feeData.gasPrice
          }
          const tx = await wallet.sendTransaction(txParams)
          recordSentTx(tx, `Drain ${amount} ${symbol}`)
          drainResults[i].hash = tx.hash
          setResults([...drainResults])

          await tx.wait()
          drainResults[i].status = "confirmed"
          setResults([...drainResults])
        } catch (err) {
          drainResults[i].status = "failed"
          drainResults[i].error = errorMessage(err, "Failed")
          setResults([...drainResults])
        }
      }
    } catch (err) {
      setError(errorMessage(err, "Drain failed"))
    } finally {
      setLoading(false)
    }
  }

  const storedWalletsWithKeys = useMemo(() => wallets.filter(w => w.privateKey), [wallets])

  return (
    <ToolCard title="Drain" description="Consolidate AVAX or ERC-20 balances from multiple wallets into one destination.">
      <div className="space-y-4">
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
          <strong>Warning:</strong> {token
            ? `This will send the full ${token.symbol} balance from each source wallet to the destination. Each source needs AVAX for gas.`
            : "This will send the full balance (minus gas) from each source wallet to the destination."}
        </div>

        <AssetSelect tokens={tokens} value={asset} onChange={setAsset} />

        <FormField label="Destination Address" id="destination" value={destination} onChange={setDestination}
          placeholder="0x..." monospace />

        {/* Stored wallets selection */}
        {storedWalletsWithKeys.length > 0 && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={useStoredWallets} onChange={e => setUseStoredWallets(e.target.checked)}
                className="rounded" />
              Use stored wallets as sources
            </label>

            {useStoredWallets && (
              <div className="space-y-1 pl-6">
                {storedWalletsWithKeys.map(w => (
                  <label key={w.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={selectedWalletIds.has(w.id)}
                      onChange={() => toggleStoredWallet(w.id)} className="rounded" />
                    <span className="font-medium">{w.name}</span>
                    <span className="font-mono text-muted-foreground">{truncateId(w.address, 8, 4)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual private keys */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Source Private Keys</Label>
            <Button variant="outline" size="sm" onClick={addSource} className="gap-1.5 h-7">
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
          {sources.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input type="password" value={s.privateKey} onChange={e => updateSource(i, e.target.value)}
                placeholder="Private key..." className="flex-1 font-mono text-sm h-8" />
              {sources.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeSource(i)} aria-label="Remove source">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <LoadingButton onClick={handleDrain} loading={loading} disabled={!destination.trim()}>
          Drain All Sources
        </LoadingButton>

        <TxBatchResultTable results={results} addressLabel="Source" showAmountUnit={symbol} />

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>
      {dialog}
    </ToolCard>
  )
}
