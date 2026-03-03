"use client"

import { useState } from "react"
import { formatUnits, formatEther, parseEther, isAddress } from "ethers"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { OutputDisplay } from "@/components/tools/OutputDisplay"
import { useWallet } from "@/lib/contexts/wallet-context"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { Button } from "@/components/ui/button"

export default function SendTransactionPage() {
  const { activeWallet, requireWallet } = useWallet()
  const { endpoints } = useNetwork()
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState("")
  const [error, setError] = useState("")
  const [gasEstimate, setGasEstimate] = useState("")

  async function estimateGas() {
    if (!to || !amount) return
    try {
      const gasData = await CChainService.getGasPrice(endpoints.cChain)
      const effectiveGasPrice = gasData.maxFeePerGas
        ? BigInt(gasData.maxFeePerGas)
        : BigInt(gasData.gasPrice)
      const effectiveGwei = gasData.maxFeePerGas
        ? formatUnits(gasData.maxFeePerGas, "gwei")
        : gasData.gasPriceGwei
      const gasCost = BigInt(21000) * effectiveGasPrice
      setGasEstimate(`~${formatEther(gasCost)} AVAX (${effectiveGwei} Gwei)`)
    } catch {
      setGasEstimate("Could not estimate gas")
    }
  }

  const isAddressValid = to.trim() === "" || isAddress(to.trim())

  async function handleSend() {
    setError("")
    setTxHash("")

    if (!isAddress(to.trim())) {
      setError("Invalid destination address")
      return
    }

    const parsedAmount = Number(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a positive number")
      return
    }

    setLoading(true)
    try {
      const signer = await requireWallet()
      const tx = await signer.sendTransaction({
        to: to.trim(),
        value: parseEther(amount),
      })
      setTxHash(tx.hash)
      await tx.wait()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolCard title="Send Transaction" description="Send AVAX to an address on the C-Chain.">
      <div className="space-y-4">
        {activeWallet && (
          <div className="text-xs font-mono text-muted-foreground">
            From: {activeWallet.address}
          </div>
        )}

        <FormField label="Destination Address" id="to" value={to} onChange={setTo}
          placeholder="0x..." monospace />
        {to.trim() && !isAddressValid && (
          <p className="text-xs text-destructive">Invalid Ethereum address</p>
        )}
        <FormField label="Amount (AVAX)" id="amount" value={amount} onChange={(v) => { setAmount(v); setGasEstimate("") }}
          placeholder="0.1" type="number" />

        {gasEstimate && (
          <p className="text-xs text-muted-foreground font-mono">Gas: {gasEstimate}</p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={estimateGas} disabled={!to || !amount}>
            Estimate Gas
          </Button>
          <LoadingButton onClick={handleSend} loading={loading} disabled={!to || !amount || !isAddressValid}>
            Send
          </LoadingButton>
        </div>

        {txHash && <OutputDisplay label="Transaction Hash" value={txHash} />}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </div>
    </ToolCard>
  )
}
