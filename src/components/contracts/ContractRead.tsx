"use client"

import { useState, useCallback, useMemo } from "react"
import { Contract } from "ethers/contract"
import { Accordion } from "@/components/ui/accordion"
import { FunctionAccordion } from "./FunctionAccordion"
import { coerceArg, buildAbiFragment } from "@/lib/utils/abi"
import type { ABIEntry } from "@/lib/services/verification"

interface ContractReadProps {
  abi: ABIEntry[] | null
  address: string
  rpcUrl: string
}

function formatResult(result: unknown): string {
  if (result === null || result === undefined) {
    return String(result)
  }
  if (typeof result === "bigint") {
    return result.toString()
  }
  if (typeof result === "object") {
    return JSON.stringify(result, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    , 2)
  }
  return String(result)
}

export function ContractRead({ abi, address, rpcUrl }: ContractReadProps) {
  const [openItems, setOpenItems] = useState<string[]>([])

  const handleCall = useCallback((entry: ABIEntry) => async (args: string[]): Promise<string> => {
    const { CChainService } = await import("@/lib/services/cchain.service")
    const provider = CChainService.getProvider(rpcUrl)
    const mutability = entry.stateMutability === "pure" ? "pure" : "view"
    const abiFragment = buildAbiFragment(entry, mutability)
    const contract = new Contract(address, [abiFragment], provider)
    const coercedArgs = (entry.inputs ?? []).map((p, i) => coerceArg(args[i] ?? "", p))
    const result = await contract[entry.name!](...coercedArgs)
    return formatResult(result)
  }, [address, rpcUrl])

  const readFunctions = useMemo(() => (abi ?? []).filter(
    entry =>
      entry.type === "function" &&
      (entry.stateMutability === "view" || entry.stateMutability === "pure")
  ), [abi])

  const openSet = useMemo(() => new Set(openItems), [openItems])

  if (!abi || abi.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Verify the contract to interact with it
      </div>
    )
  }

  if (readFunctions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No read functions found
      </div>
    )
  }

  return (
    <Accordion type="multiple" value={openItems} onValueChange={setOpenItems}>
      {readFunctions.map((entry, index) => {
        const value = `${entry.name}-${index}`
        return (
          <FunctionAccordion
            key={value}
            accordionValue={value}
            entry={entry}
            onCall={handleCall(entry)}
            expanded={openSet.has(value)}
            autoExecute
          />
        )
      })}
    </Accordion>
  )
}
