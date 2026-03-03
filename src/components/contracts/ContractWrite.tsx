"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Contract } from "ethers/contract"
import { parseEther } from "ethers/utils"
import { type Signer, type TransactionResponse } from "ethers/providers"
import { Wallet } from "lucide-react"
import { Accordion } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { FunctionAccordion } from "./FunctionAccordion"
import { useWallet } from "@/lib/contexts/wallet-context"
import { truncateId } from "@/lib/utils"
import { coerceArg, buildAbiFragment } from "@/lib/utils/abi"
import type { ABIEntry } from "@/lib/services/verification"

interface ContractWriteProps {
  abi: ABIEntry[] | null
  address: string
  rpcUrl: string
}

export function ContractWrite({ abi, address }: ContractWriteProps) {
  const { activeWallet, openWalletDialog, getSigner } = useWallet()
  const [signer, setSigner] = useState<Signer | null>(null)

  // Reset signer when wallet changes
  useEffect(() => {
    let cancelled = false
    const resolve = activeWallet
      ? getSigner().catch(() => null as Signer | null)
      : Promise.resolve(null as Signer | null)
    resolve.then(s => { if (!cancelled) setSigner(s) })
    return () => { cancelled = true }
  }, [activeWallet, getSigner])

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

  const handleCall = useCallback((entry: ABIEntry) => async (args: string[]): Promise<string> => {
    if (!signer) {
      throw new Error("Connect a wallet first")
    }

    const abiFragment = buildAbiFragment(entry)
    const contract = new Contract(address, [abiFragment], signer)

    const inputs = entry.inputs ?? []
    let tx: TransactionResponse
    if (entry.stateMutability === "payable" && args.length > inputs.length) {
      const functionArgs = inputs.map((p, i) => coerceArg(args[i] ?? "", p))
      const value = parseEther(args[args.length - 1])
      tx = await contract[entry.name!](...functionArgs, { value })
    } else {
      const coercedArgs = inputs.map((p, i) => coerceArg(args[i] ?? "", p))
      tx = await contract[entry.name!](...coercedArgs)
    }

    const receipt = await tx.wait()
    if (!receipt) {
      return `Transaction sent: ${tx.hash} (receipt unavailable — tx may have been dropped)`
    }
    return `Transaction confirmed: ${receipt.hash}`
  }, [address, signer])

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
          <div key={`${entry.name}-${index}`} className="border-b last:border-b-0">
            {entry.stateMutability === "payable" && (
              <p className="px-1 pt-2 text-xs text-amber-600 dark:text-amber-400">
                This function accepts AVAX. Add value as the last argument.
              </p>
            )}
            <FunctionAccordion
              accordionValue={`${entry.name}-${index}`}
              entry={entry}
              onCall={handleCall(entry)}
              disabled={!signer}
              className="border-b-0"
            />
          </div>
        ))}
      </Accordion>
    </div>
  )
}
