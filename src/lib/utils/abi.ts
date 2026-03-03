import { isAddress } from "ethers/address"
import type { ABIEntry, ABIParam } from "@/lib/services/verification"

export function coerceArg(value: string, param: ABIParam): unknown {
  const t = param.type
  if (/^u?int\d*$/.test(t)) return BigInt(value)
  if (t === "bool") return value === "true" || value === "1"
  if (t === "address") {
    if (!isAddress(value)) throw new Error(`Invalid address for "${param.name}"`)
    return value
  }
  if (/^bytes\d*$/.test(t)) {
    if (!/^0x[0-9a-fA-F]*$/.test(value)) throw new Error(`"${param.name}" must be hex (0x...)`)
    return value
  }
  if (t.includes("[")) {
    try { return JSON.parse(value) } catch { throw new Error(`"${param.name}" must be a JSON array`) }
  }
  if (t === "tuple" || t.startsWith("(")) {
    try { return JSON.parse(value) } catch { throw new Error(`"${param.name}" must be a JSON object/array`) }
  }
  return value
}

export function buildAbiFragment(entry: ABIEntry, defaultMutability?: string): string {
  const inputs = (entry.inputs ?? []).map(p => p.type).join(", ")
  const outputs = (entry.outputs ?? []).map(p => p.type).join(", ")
  const mutability = defaultMutability ?? (entry.stateMutability ?? "nonpayable")
  let fragment = `function ${entry.name}(${inputs}) ${mutability}`
  if (outputs) {
    fragment += ` returns (${outputs})`
  }
  return fragment
}
