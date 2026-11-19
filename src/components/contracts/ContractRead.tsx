"use client"

import { useState, useCallback, useMemo } from "react"
import { Contract } from "ethers/contract"
import { Accordion } from "@/components/ui/accordion"
import { FunctionAccordion, type CallResult } from "./FunctionAccordion"
import { CopyableId } from "@/components/tools/CopyableId"
import { coerceArg } from "@/lib/utils/abi"
import type { ABIEntry, ABIParam } from "@/lib/services/verification"

interface ContractReadProps {
  abi: ABIEntry[] | null
  address: string
  rpcUrl: string
}

const elementType = (p: ABIParam): ABIParam => ({ ...p, type: p.type.replace(/\[\d*\]$/, "") })
const fieldName = (p: ABIParam, i: number) => p.name || `[${i}]`

/** JSON-safe copy of a decoded value, keyed by ABI names (bigint → string). */
function toPlain(v: unknown, p: ABIParam): unknown {
  if (p.type.endsWith("]")) return (v as unknown[]).map(x => toPlain(x, elementType(p)))
  if (p.type === "tuple") {
    const t = v as unknown[]
    return Object.fromEntries((p.components ?? []).map((c, i) => [fieldName(c, i), toPlain(t[i], c)]))
  }
  return typeof v === "bigint" ? v.toString() : v
}

function renderValue(v: unknown, p: ABIParam): React.ReactNode {
  if (p.type.endsWith("]")) {
    const items = v as unknown[]
    if (items.length === 0) return <span className="text-muted-foreground">[]</span>
    return (
      <ol start={0} className="list-decimal pl-6">
        {items.map((x, i) => <li key={i}>{renderValue(x, elementType(p))}</li>)}
      </ol>
    )
  }
  if (p.type === "tuple") return <Fields params={p.components ?? []} values={v as unknown[]} />
  if (typeof v === "bigint") return v.toLocaleString("en-US")
  if (p.type === "address") return <CopyableId value={String(v)} explorer="address" />
  return String(v)
}

function Fields({ params, values }: { params: ABIParam[]; values: unknown[] }) {
  return (
    <dl className="space-y-1">
      {params.map((p, i) => (
        <div key={i}>
          <dt className="text-muted-foreground text-xs">{fieldName(p, i)} <span className="opacity-60">({p.type})</span></dt>
          <dd className="pl-3">{renderValue(values[i], p)}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ContractRead({ abi, address, rpcUrl }: ContractReadProps) {
  const [openItems, setOpenItems] = useState<string[]>([])

  const handleCall = useCallback((entry: ABIEntry) => async (args: string[]): Promise<CallResult> => {
    const { CChainService } = await import("@/lib/services/cchain.service")
    const provider = CChainService.getProvider(rpcUrl)
    // Full JSON entry (not a type-only fragment) so tuple components and output names survive
    const contract = new Contract(address, [entry], provider)
    const coercedArgs = (entry.inputs ?? []).map((p, i) => coerceArg(args[i] ?? "", p))
    const result = await contract[entry.name!].staticCallResult(...coercedArgs)
    const outputs = entry.outputs ?? []
    const values = outputs.map((_, i) => result[i])
    const plain = outputs.length === 1
      ? toPlain(values[0], outputs[0])
      : Object.fromEntries(outputs.map((p, i) => [fieldName(p, i), toPlain(values[i], p)]))
    return {
      text: typeof plain === "string" ? plain : JSON.stringify(plain, null, 2),
      node: outputs.length === 1 && !outputs[0].name ? renderValue(values[0], outputs[0]) : <Fields params={outputs} values={values} />,
    }
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
