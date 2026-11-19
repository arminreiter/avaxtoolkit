"use client"

import { useCallback, useMemo } from "react"
import { Contract } from "ethers/contract"
import { parseEther } from "ethers/utils"
import { type TransactionResponse } from "ethers/providers"
import { Wallet } from "lucide-react"
import { Accordion } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { FunctionAccordion, type CallResult } from "./FunctionAccordion"
import { CopyableId } from "@/components/tools/CopyableId"
import { useConfirm } from "@/components/tools/ConfirmDialog"
import { appLinks } from "@/lib/explorer-links"
import { useWallet } from "@/lib/contexts/wallet-context"
import { truncateId } from "@/lib/utils"
import { recordSentTx } from "@/lib/models/tx-history"
import { coerceArg } from "@/lib/utils/abi"
import type { ABIEntry } from "@/lib/services/verification"

interface ContractWriteProps {
  abi: ABIEntry[] | null
  address: string
  rpcUrl: string
}

export function ContractWrite({ abi, address }: ContractWriteProps) {
  const { activeWallet, openWalletDialog, getSigner } = useWallet()
  const { confirm, dialog } = useConfirm()

  const walletStatus = useMemo(() => activeWallet ? (
    <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/5 p-3">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-green-500" />
        <span className="text-sm text-green-600 dark:text-green-400">Connected:</span>
        <span className="font-mono text-sm text-muted-foreground">{truncateId(activeWallet.address, 10, 6)}</span>
      </div>
      <Button variant="outline" size="sm" onClick={openWalletDialog}>Switch</Button>
    </div>
  ) : (
    <Button variant="outline" className="w-full gap-2" onClick={openWalletDialog}>
      <Wallet className="h-4 w-4" /> Connect Wallet to Write
    </Button>
  ), [activeWallet, openWalletDialog])

  const handleCall = useCallback((entry: ABIEntry) => async (
    args: string[], value: string, onProgress: (r: CallResult) => void,
  ): Promise<CallResult> => {
    if (!activeWallet) {
      throw new Error("Connect a wallet first")
    }
    // Resolved on submit so a connected wallet on the wrong chain is only prompted when sending
    const signer = await getSigner()
    if (!signer) throw new Error("Connect a wallet first")

    // Full JSON entry (not a type-only fragment) so tuple inputs keep their components
    const contract = new Contract(address, [entry], signer)
    const fn = contract.getFunction(entry.name!)
    const coercedArgs = (entry.inputs ?? []).map((p, i) => coerceArg(args[i] ?? "", p))
    const amount = value.trim()
    const overrides = entry.stateMutability === "payable" && amount ? { value: parseEther(amount) } : {}

    const gas = await fn.estimateGas(...coercedArgs, overrides)
    const ok = await confirm({
      title: `Call ${entry.name}()?`,
      description: (
        <span className="block space-y-1 font-mono text-xs">
          <span className="block">Contract: {address}</span>
          {overrides.value !== undefined && <span className="block">Value: {amount} AVAX</span>}
          <span className="block">Estimated gas: {gas.toLocaleString("en-US")}</span>
        </span>
      ),
      confirmLabel: "Send",
    })
    if (!ok) throw new Error("Cancelled")

    const tx: TransactionResponse = await fn(...coercedArgs, overrides)
    recordSentTx(tx, `Call ${entry.name}()`)
    const show = (status: React.ReactNode): CallResult => ({
      text: tx.hash,
      node: (
        <span className="block space-y-1">
          <CopyableId value={tx.hash} href={appLinks.tx(tx.hash)} explorer="tx" />
          <span className="block text-xs">{status}</span>
        </span>
      ),
    })
    onProgress(show(<span className="text-muted-foreground">Pending confirmation…</span>))
    try {
      const receipt = await tx.wait()
      if (!receipt) return show(<span className="text-yellow-600 dark:text-yellow-400">Receipt unavailable — tx may have been dropped</span>)
      return show(<span className="text-green-600 dark:text-green-400">Confirmed in block {receipt.blockNumber.toLocaleString("en-US")}</span>)
    } catch (err) {
      onProgress(show(<span className="text-destructive">Failed</span>))
      throw err
    }
  }, [address, activeWallet, getSigner, confirm])

  const writeFunctions = useMemo(() => (abi ?? []).filter(
    entry =>
      entry.type === "function" &&
      (entry.stateMutability === "nonpayable" || entry.stateMutability === "payable")
  ), [abi])

  if (!abi || abi.length === 0) {
    return (
      <div className="space-y-4">
        {walletStatus}
        <div className="py-8 text-center text-muted-foreground">
          Verify the contract to interact with it
        </div>
      </div>
    )
  }

  if (writeFunctions.length === 0) {
    return (
      <div className="space-y-4">
        {walletStatus}
        <div className="py-8 text-center text-muted-foreground">
          No write functions found
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {walletStatus}
      <Accordion type="multiple">
        {writeFunctions.map((entry, index) => (
          <FunctionAccordion
            key={`${entry.name}-${index}`}
            accordionValue={`${entry.name}-${index}`}
            entry={entry}
            onCall={handleCall(entry)}
            disabled={!activeWallet}
          />
        ))}
      </Accordion>
      {dialog}
    </div>
  )
}
