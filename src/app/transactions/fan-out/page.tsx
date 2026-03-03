"use client"

import { useState } from "react"
import { isAddress, parseEther, formatEther } from "ethers"
import { Plus, Trash2, Upload } from "lucide-react"
import { ToolCard } from "@/components/tools/ToolCard"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { useWallet } from "@/lib/contexts/wallet-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TxBatchResultTable } from "@/components/tools/TxBatchResultTable"

interface Recipient {
  address: string
  amount: string
}

interface TxResult {
  address: string
  amount: string
  hash?: string
  error?: string
  status: "pending" | "sent" | "confirmed" | "failed"
}

export default function FanOutPage() {
  const { activeWallet, requireWallet } = useWallet()
  const [recipients, setRecipients] = useState<Recipient[]>([{ address: "", amount: "" }])
  const [equalAmount, setEqualAmount] = useState("")
  const [useEqualAmount, setUseEqualAmount] = useState(false)
  const [results, setResults] = useState<TxResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [csvInput, setCsvInput] = useState("")

  function addRow() {
    setRecipients(prev => [...prev, { address: "", amount: "" }])
  }

  function removeRow(index: number) {
    setRecipients(prev => prev.filter((_, i) => i !== index))
  }

  function updateRecipient(index: number, field: keyof Recipient, value: string) {
    setRecipients(prev => {
      const updated = prev.map((r, i) => i === index ? { ...r, [field]: value } : r)
      // Auto-add a new row when the last row's address gets filled
      if (field === "address" && value.trim() && index === updated.length - 1) {
        updated.push({ address: "", amount: "" })
      }
      return updated
    })
  }

  function importCsv() {
    const lines = csvInput.trim().split("\n").filter(Boolean)
    const invalid: number[] = []
    const parsed: Recipient[] = lines.map((line, i) => {
      const [address, amount] = line.split(",").map(s => s.trim())
      if (address && !isAddress(address)) invalid.push(i + 1)
      return { address: address || "", amount: amount || "" }
    })
    if (invalid.length > 0) {
      setError(`Invalid address on line${invalid.length > 1 ? "s" : ""} ${invalid.join(", ")}`)
      return
    }
    if (parsed.length > 0) {
      setRecipients(parsed)
      setShowCsvImport(false)
      setCsvInput("")
    }
  }

  async function handleFanOut() {
    setError("")
    setLoading(true)
    const targets = recipients.map(r => ({
      address: r.address.trim(),
      amount: useEqualAmount ? equalAmount : r.amount,
    })).filter(r => r.address && r.amount)

    if (targets.length === 0) {
      setError("No valid recipients")
      setLoading(false)
      return
    }

    // Validate all addresses
    const invalidAddrs = targets.filter(t => !isAddress(t.address))
    if (invalidAddrs.length > 0) {
      setError(`Invalid address: ${invalidAddrs[0].address}`)
      setLoading(false)
      return
    }

    // Validate all amounts are positive numbers
    for (const t of targets) {
      const parsed = Number(t.amount)
      if (isNaN(parsed) || parsed <= 0) {
        setError(`Invalid amount "${t.amount}" for ${t.address}`)
        setLoading(false)
        return
      }
    }

    const txResults: TxResult[] = targets.map(t => ({
      address: t.address, amount: t.amount, status: "pending" as const,
    }))
    setResults([...txResults])

    try {
      const signer = await requireWallet()

      // Balance pre-check (includes estimated gas)
      const totalWei = targets.reduce((sum, t) => sum + parseEther(t.amount), BigInt(0))
      const feeData = await signer.provider!.getFeeData()
      const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? BigInt(0)
      const totalGas = gasPrice * BigInt(21000) * BigInt(targets.length)
      const totalRequired = totalWei + totalGas
      const balance = await signer.provider!.getBalance(await signer.getAddress())
      if (totalRequired > balance) {
        setError(`Insufficient balance: need ~${formatEther(totalRequired)} AVAX (incl. gas), have ${formatEther(balance)} AVAX`)
        setLoading(false)
        return
      }

      const baseNonce = await signer.getNonce()

      // Phase 1: Broadcast all transactions in parallel with pre-assigned nonces
      const pendingTxs: (Awaited<ReturnType<typeof signer.sendTransaction>> | null)[] = []
      for (let i = 0; i < targets.length; i++) {
        try {
          txResults[i].status = "sent"
          setResults([...txResults])

          const tx = await signer.sendTransaction({
            to: targets[i].address,
            value: parseEther(targets[i].amount),
            nonce: baseNonce + i,
          })
          txResults[i].hash = tx.hash
          pendingTxs.push(tx)
          setResults([...txResults])
        } catch (err) {
          txResults[i].status = "failed"
          txResults[i].error = err instanceof Error ? err.message : "Failed"
          pendingTxs.push(null)
          setResults([...txResults])
        }
      }

      // Phase 2: Await confirmations in parallel
      const confirmations = pendingTxs.map(async (tx, i) => {
        if (!tx) return
        try {
          await tx.wait()
          txResults[i].status = "confirmed"
        } catch (err) {
          txResults[i].status = "failed"
          txResults[i].error = err instanceof Error ? err.message : "Confirmation failed"
        }
        setResults([...txResults])
      })
      await Promise.allSettled(confirmations)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get signer")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolCard title="Fan Out" description="Distribute AVAX from one wallet to multiple addresses.">
      <div className="space-y-4">
        {activeWallet && (
          <div className="text-xs font-mono text-muted-foreground">
            From: {activeWallet.address}
          </div>
        )}

        {/* Equal amount toggle */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={useEqualAmount} onChange={e => setUseEqualAmount(e.target.checked)}
              className="rounded" />
            Send equal amount to all
          </label>
          {useEqualAmount && (
            <Input value={equalAmount} onChange={e => setEqualAmount(e.target.value)}
              placeholder="Amount (AVAX)" className="w-40 h-8 text-sm font-mono" type="number" />
          )}
        </div>

        {/* CSV Import */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCsvImport(!showCsvImport)} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> CSV Import
          </Button>
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Row
          </Button>
        </div>

        {showCsvImport && (
          <div className="space-y-2 border rounded-lg p-3">
            <Label className="text-xs">Paste CSV (address,amount per line)</Label>
            <Textarea value={csvInput} onChange={e => setCsvInput(e.target.value)}
              placeholder={"0xabc...,1.0\n0xdef...,2.5"} rows={4} className="font-mono text-xs" />
            <Button size="sm" onClick={importCsv}>Import</Button>
          </div>
        )}

        {/* Recipient rows */}
        <div className="space-y-2">
          {recipients.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={r.address} onChange={e => updateRecipient(i, "address", e.target.value)}
                placeholder="0x..." className="flex-1 font-mono text-sm h-8" />
              {!useEqualAmount && (
                <Input value={r.amount} onChange={e => updateRecipient(i, "amount", e.target.value)}
                  placeholder="AVAX" className="w-28 font-mono text-sm h-8" type="number" />
              )}
              {recipients.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRow(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <LoadingButton onClick={handleFanOut} loading={loading}
          disabled={recipients.every(r => !r.address)}>
          Send to {recipients.filter(r => r.address.trim()).length} Address{recipients.filter(r => r.address.trim()).length !== 1 ? "es" : ""}
        </LoadingButton>

        <TxBatchResultTable results={results} />

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>
    </ToolCard>
  )
}
