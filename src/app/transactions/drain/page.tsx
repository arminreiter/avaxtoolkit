"use client"

import { useState, useMemo } from "react"
import { isAddress } from "ethers/address"
import { formatEther } from "ethers/utils"
import { Wallet } from "ethers/wallet"
import { type TransactionRequest } from "ethers/providers"
import { CChainService } from "@/lib/services/cchain.service"
import { Plus, Trash2 } from "lucide-react"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { useWallet } from "@/lib/contexts/wallet-context"
import { useNetwork } from "@/lib/contexts/network-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TxBatchResultTable } from "@/components/tools/TxBatchResultTable"
import { truncateId } from "@/lib/utils"

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

export default function DrainPage() {
  const { wallets } = useWallet()
  const { endpoints } = useNetwork()
  const [destination, setDestination] = useState("")
  const [sources, setSources] = useState<SourceWallet[]>([{ privateKey: "" }])
  const [useStoredWallets, setUseStoredWallets] = useState(false)
  const [selectedWalletIds, setSelectedWalletIds] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<DrainResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

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
    setLoading(true)
    setResults([])

    if (!isAddress(destination.trim())) {
      setError("Invalid destination address")
      setLoading(false)
      return
    }

    try {
      const provider = CChainService.getProvider(endpoints.cChain)

      const walletsToSign: Wallet[] = []

      for (let i = 0; i < sources.length; i++) {
        const s = sources[i]
        if (s.privateKey.trim()) {
          try {
            walletsToSign.push(new Wallet(s.privateKey.trim(), provider))
          } catch {
            setError(`Invalid private key at position ${i + 1}`)
            setLoading(false)
            return
          }
        }
      }

      if (useStoredWallets) {
        for (const id of selectedWalletIds) {
          const stored = wallets.find(w => w.id === id)
          if (stored?.privateKey) {
            walletsToSign.push(new Wallet(stored.privateKey, provider))
          }
        }
      }

      if (walletsToSign.length === 0) {
        setError("No source wallets provided")
        setLoading(false)
        return
      }

      const drainResults: DrainResult[] = walletsToSign.map(w => ({
        address: w.address, amount: "...", status: "pending" as const,
      }))
      setResults([...drainResults])

      const feeData = await provider.getFeeData()
      const balances = await Promise.all(walletsToSign.map(w => provider.getBalance(w.address)))

      for (let i = 0; i < walletsToSign.length; i++) {
        try {
          const wallet = walletsToSign[i]
          const balance = balances[i]
          const effectiveGasPrice = feeData.maxFeePerGas ?? feeData.gasPrice
          if (!effectiveGasPrice) {
            drainResults[i].status = "skipped"
            drainResults[i].error = "Could not determine gas price"
            setResults([...drainResults])
            continue
          }
          const gasCost = effectiveGasPrice * BigInt(21000)

          if (balance <= gasCost) {
            drainResults[i].amount = formatEther(balance)
            drainResults[i].status = "skipped"
            drainResults[i].error = "Insufficient balance for gas"
            setResults([...drainResults])
            continue
          }

          const sendAmount = balance - gasCost
          drainResults[i].amount = formatEther(sendAmount)
          drainResults[i].status = "sent"
          setResults([...drainResults])

          const txParams: TransactionRequest = {
            to: destination.trim(),
            value: sendAmount,
            gasLimit: 21000,
          }
          if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
            txParams.maxFeePerGas = feeData.maxFeePerGas
            txParams.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
          } else {
            txParams.gasPrice = feeData.gasPrice
          }
          const tx = await wallet.sendTransaction(txParams)
          drainResults[i].hash = tx.hash
          setResults([...drainResults])

          await tx.wait()
          drainResults[i].status = "confirmed"
          setResults([...drainResults])
        } catch (err) {
          drainResults[i].status = "failed"
          drainResults[i].error = err instanceof Error ? err.message : "Failed"
          setResults([...drainResults])
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Drain failed")
    } finally {
      setLoading(false)
    }
  }

  const storedWalletsWithKeys = useMemo(() => wallets.filter(w => w.privateKey), [wallets])

  return (
    <ToolCard title="Drain" description="Consolidate balances from multiple wallets into one destination.">
      <div className="space-y-4">
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
          <strong>Warning:</strong> This will send the full balance (minus gas) from each source wallet to the destination.
        </div>

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
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeSource(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <LoadingButton onClick={handleDrain} loading={loading} disabled={!destination.trim()}>
          Drain All Sources
        </LoadingButton>

        <TxBatchResultTable results={results} addressLabel="Source" showAmountUnit="AVAX" />

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>
    </ToolCard>
  )
}
