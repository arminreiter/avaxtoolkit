import { isAddress } from "ethers/address"
import { Interface, FunctionFragment } from "ethers/abi"
import type { ABIParam } from "@/lib/services/verification"

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

/** Parse a human-readable signature like "transfer(address to, uint256)"; a leading "function " is optional. */
function parseSignature(signature: string): FunctionFragment {
  return FunctionFragment.from(`function ${signature.trim().replace(/^function\s+/, "")}`)
}

/** Encode calldata from a signature and one string argument per input (arrays/tuples as JSON). */
export function encodeCalldata(signature: string, args: string[]): string {
  const fn = parseSignature(signature)
  if (args.length !== fn.inputs.length) {
    throw new Error(`${fn.name} expects ${fn.inputs.length} argument(s), got ${args.length}`)
  }
  // format() yields "uint256[]" / "(address,uint256)" — the shapes coerceArg recognises
  const values = fn.inputs.map((p, i) => coerceArg(args[i], { name: p.name || `argument ${i + 1}`, type: p.format() }))
  return new Interface([fn]).encodeFunctionData(fn, values)
}

export interface DecodedArg { name: string; type: string; value: string }

/** Decode calldata against a signature. Throws if the selector does not match. */
export function decodeCalldata(signature: string, data: string): { name: string; args: DecodedArg[] } {
  const fn = parseSignature(signature)
  const decoded = new Interface([fn]).decodeFunctionData(fn, data)
  const show = (v: unknown) => typeof v === "string" || typeof v === "bigint" ? String(v)
    : JSON.stringify(v, (_, x) => typeof x === "bigint" ? x.toString() : x)
  return {
    name: fn.name,
    args: fn.inputs.map((p, i) => ({ name: p.name, type: p.format(), value: show(decoded[i]) })),
  }
}
