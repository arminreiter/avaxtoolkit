"use client"

import { useState, useMemo } from "react"
import { isAddress } from "ethers/address"
import { formatEther, parseUnits, formatUnits } from "ethers/utils"
import { Plus, Trash2, Upload } from "lucide-react"
import { ToolCard } from "@/components/tools/ToolCard"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { useConfirm } from "@/components/tools/ConfirmDialog"
import { useWallet } from "@/lib/contexts/wallet-context"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { AssetSelect, useAssetSelection } from "@/components/wallet/AssetSelect"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TxBatchResultTable } from "@/components/tools/TxBatchResultTable"
import { recordSentTx } from "@/lib/models/tx-history"
import { errorMessage, formatAvaxWei } from "@/lib/utils"

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

/** Parses a positive amount into base units; null if empty, malformed, or <= 0. */
function parseAmount(amount: string, decimals: number): bigint | null {
  try {
    const units = parseUnits(amount.trim(), decimals)
    return units > BigInt(0) ? units : null
  } catch {
    return null
  }
}

export default function FanOutPage() {
  const { activeWallet, requireWallet } = useWallet()
  const { network, endpoints } = useNetwork()
  const { tokens, asset, setAsset, token, symbol } = useAssetSelection(network.chainId)
  const { confirm, dialog } = useConfirm()
  const [recipients, setRecipients] = useState<Recipient[]>([{ address: "", amount: "" }])
  const [equalAmount, setEqualAmount] = useState("")
  const [useEqualAmount, setUseEqualAmount] = useState(false)
  const [results, setResults] = useState<TxResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [csvInput, setCsvInput] = useState("")
  const [prevNetworkId, setPrevNetworkId] = useState(network.id)

  // Results belong to the previous network: clear them on switch (form inputs are kept)
  if (prevNetworkId !== network.id) {
    setPrevNetworkId(network.id)
    setResults([])
    setError("")
  }

  const decimals = token?.decimals ?? 18

  const rows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of recipients) {
      const a = r.address.trim().toLowerCase()
      if (a) counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    return recipients.map(r => {
      const address = r.address.trim()
      const amount = (useEqualAmount ? equalAmount : r.amount).trim()
      const empty = !address && (useEqualAmount || !amount)
      const units = parseAmount(amount, decimals)
      return {
        address,
        amount,
        units,
        empty,
        addressError: empty ? "" : !address ? "Address required" : !isAddress(address) ? "Invalid address" : "",
        amountError: empty || useEqualAmount || units !== null ? "" : !amount ? "Amount required" : "Amount must be a positive number",
        duplicate: (counts.get(address.toLowerCase()) ?? 0) > 1,
      }
    })
  }, [recipients, useEqualAmount, equalAmount, decimals])

  const filledRows = rows.filter(r => !r.empty)
  const hasErrors = filledRows.some(r => r.addressError || r.units === null)
  const validRows = filledRows.filter(r => !r.addressError && r.units !== null)
  const totalUnits = validRows.reduce((sum, r) => sum + r.units!, BigInt(0))
  const equalAmountInvalid = useEqualAmount && equalAmount.trim() !== "" && parseAmount(equalAmount, decimals) === null

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

  async function importCsv() {
    setError("")
    const lines = csvInput.trim().split("\n").filter(l => l.trim())
    const invalid: string[] = []
    const parsed: Recipient[] = lines.map((line, i) => {
      const [address = "", amount = ""] = line.split(",").map(s => s.trim())
      if (!isAddress(address)) invalid.push(`line ${i + 1}: invalid address`)
      else if (amount && parseAmount(amount, decimals) === null) invalid.push(`line ${i + 1}: invalid amount "${amount}"`)
      return { address, amount }
    })
    if (invalid.length > 0) {
      setError(`CSV import failed: ${invalid.join("; ")}`)
      return
    }
    if (parsed.length === 0) return
    if (filledRows.length > 0 && !(await confirm({
      title: "Replace recipients?",
      description: `This replaces ${filledRows.length} existing recipient${filledRows.length !== 1 ? "s" : ""} with ${parsed.length} from the CSV.`,
      confirmLabel: "Replace",
      destructive: true,
    }))) return
    setRecipients(parsed)
    setShowCsvImport(false)
    setCsvInput("")
  }

  async function handleFanOut() {
    setError("")
    if (validRows.length === 0 || hasErrors) {
      setError("Fix the highlighted recipients first")
      return
    }
    setLoading(true)
    const targets = validRows.map(r => ({ address: r.address, amount: r.amount, units: r.units! }))

    try {
      const signer = await requireWallet()

      // ERC-20 sends call transfer() on the token contract; AVAX sends are plain value transfers
      const buildTx = (to: string, units: bigint) => token
        ? CChainService.encodeTokenTransfer(token.address, to, units)
        : { to, value: units }

      // Balance pre-check (includes estimated gas)
      const from = await signer.getAddress()
      const [feeData, balance, tokenBalance] = await Promise.all([
        signer.provider!.getFeeData(),
        signer.provider!.getBalance(from),
        token ? CChainService.getTokenBalances(endpoints.cChain, from, [token.address]).then(b => b[0] ?? BigInt(0)) : Promise.resolve(BigInt(0)),
      ])
      // Check the token balance before estimating: estimateGas reverts on an underfunded transfer
      if (token && totalUnits > tokenBalance) {
        setError(`Insufficient ${token.symbol}: need ${formatUnits(totalUnits, token.decimals)}, have ${formatUnits(tokenBalance, token.decimals)}`)
        return
      }
      const gasPerTx = token
        ? await signer.provider!.estimateGas({ ...buildTx(targets[0].address, targets[0].units), from })
        : BigInt(21000)
      const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? BigInt(0)
      const totalGas = gasPrice * gasPerTx * BigInt(targets.length)
      const totalRequired = (token ? BigInt(0) : totalUnits) + totalGas
      if (totalRequired > balance) {
        setError(`Insufficient balance: need ~${formatEther(totalRequired)} AVAX (${token ? "gas" : "incl. gas"}), have ${formatEther(balance)} AVAX`)
        return
      }

      const ok = await confirm({
        title: `Send ${formatUnits(totalUnits, decimals)} ${symbol}?`,
        description: (
          <div className="space-y-1 font-mono text-xs">
            <div>Recipients: {targets.length}</div>
            <div>Total: {formatUnits(totalUnits, decimals)} {symbol}</div>
            <div>Est. max gas: ~{formatAvaxWei(totalGas, 6)} AVAX</div>
            <div className="break-all">From: {from}</div>
            <div>Network: {network.name}</div>
          </div>
        ),
        confirmLabel: `Send ${targets.length} transaction${targets.length !== 1 ? "s" : ""}`,
        destructive: true,
      })
      if (!ok) return

      const txResults: TxResult[] = targets.map(t => ({
        address: t.address, amount: t.amount, status: "pending" as const,
      }))
      setResults([...txResults])

      // Phase 1: broadcast sequentially. The nonce only advances after a successful broadcast;
      // after a failure it is re-read from the pending pool so later txs never sit behind a gap.
      let nonce = await signer.getNonce("pending")
      const pendingTxs: (Awaited<ReturnType<typeof signer.sendTransaction>> | null)[] = []
      for (let i = 0; i < targets.length; i++) {
        try {
          txResults[i].status = "sent"
          setResults([...txResults])

          const tx = await signer.sendTransaction({ ...buildTx(targets[i].address, targets[i].units), nonce })
          nonce++
          recordSentTx(tx, `Fan Out ${targets[i].amount} ${symbol}`)
          txResults[i].hash = tx.hash
          pendingTxs.push(tx)
          setResults([...txResults])
        } catch (err) {
          txResults[i].status = "failed"
          txResults[i].error = errorMessage(err, "Failed")
          pendingTxs.push(null)
          setResults([...txResults])
          nonce = await signer.getNonce("pending")
        }
      }

      // Phase 2: Await confirmations in parallel
      const confirmations = pendingTxs.map(async (tx, i) => {
        if (!tx) return
        try {
          await tx.wait()
          setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "confirmed" } : r))
        } catch (err) {
          setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "failed", error: errorMessage(err, "Confirmation failed") } : r))
        }
      })
      await Promise.allSettled(confirmations)
    } catch (err) {
      setError(errorMessage(err, "Failed to get signer"))
    } finally {
      setLoading(false)
    }
  }

  const validCount = validRows.length

  return (
    <ToolCard title="Fan Out" description="Distribute AVAX or an ERC-20 token from one wallet to multiple addresses.">
      <div className="space-y-4">
        {activeWallet && (
          <div className="text-xs font-mono text-muted-foreground">
            From: {activeWallet.address}
          </div>
        )}

        <AssetSelect tokens={tokens} value={asset} onChange={setAsset} />

        {/* Equal amount toggle */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={useEqualAmount} onChange={e => setUseEqualAmount(e.target.checked)}
              className="rounded" />
            Send equal amount to all
          </label>
          {useEqualAmount && (
            <Input value={equalAmount} onChange={e => setEqualAmount(e.target.value)} aria-invalid={equalAmountInvalid}
              placeholder={`Amount (${symbol})`} className="w-40 h-8 text-sm font-mono" type="number" />
          )}
          {equalAmountInvalid && <span className="text-xs text-destructive">Amount must be a positive number</span>}
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
          {recipients.map((r, i) => {
            const row = rows[i]
            const messages = [row.addressError, row.amountError, row.duplicate && !row.addressError ? "Duplicate recipient" : ""].filter(Boolean)
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input value={r.address} onChange={e => updateRecipient(i, "address", e.target.value)}
                    aria-invalid={!!row.addressError}
                    placeholder="0x..." className={`flex-1 font-mono text-sm h-8 ${row.duplicate && !row.addressError ? "border-yellow-500" : ""}`} />
                  {!useEqualAmount && (
                    <Input value={r.amount} onChange={e => updateRecipient(i, "amount", e.target.value)}
                      aria-invalid={!!row.amountError}
                      placeholder={symbol} className="w-28 font-mono text-sm h-8" type="number" />
                  )}
                  {recipients.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRow(i)} aria-label="Remove row">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {messages.length > 0 && (
                  <p className={`text-xs ${row.addressError || row.amountError ? "text-destructive" : "text-yellow-500"}`}>
                    {messages.join(" · ")}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {validCount > 0 && (
          <div className="text-xs font-mono text-muted-foreground">
            Total: {formatUnits(totalUnits, decimals)} {symbol} to {validCount} address{validCount !== 1 ? "es" : ""} (+ gas)
          </div>
        )}

        <LoadingButton onClick={handleFanOut} loading={loading}
          disabled={validCount === 0 || hasErrors}>
          Send to {validCount} Address{validCount !== 1 ? "es" : ""}
        </LoadingButton>

        <TxBatchResultTable results={results} showAmountUnit={symbol} />

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
