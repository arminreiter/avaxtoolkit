import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatUnits } from "ethers/utils"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function nAvaxToAvax(value: string | undefined, fractionDigits = 2): string {
  if (!value) return "0"
  try {
    const formatted = formatUnits(value, 9)
    return Number(formatted).toLocaleString(undefined, {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  } catch {
    return "0"
  }
}

export function truncateId(id: string, prefixLen = 14, suffixLen = 6): string {
  if (id.length <= prefixLen + suffixLen + 3) return id
  return `${id.slice(0, prefixLen)}...${id.slice(-suffixLen)}`
}

export function formatTimestamp(unixSeconds: string | number, style: "datetime" | "date" = "datetime"): string {
  const date = new Date(Number(unixSeconds) * 1000)
  if (style === "date") {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }
  return date.toLocaleString()
}


/** Bare bech32 Avalanche address with any HRP (avax1…, fuji1…, local1…, custom1…). */
const BARE_BECH32 = /^[a-z]+1[02-9ac-hj-np-z]{38}$/i

/** Auto-prefix P-Chain or X-Chain address if user pastes a bare `avax1...`/`fuji1...` */
export function normalizePChainAddress(input: string): string {
  const trimmed = input.trim()
  if (/^P-/i.test(trimmed)) return `P-${trimmed.slice(2)}`
  if (BARE_BECH32.test(trimmed)) return `P-${trimmed}`
  return trimmed
}

export function normalizeXChainAddress(input: string): string {
  const trimmed = input.trim()
  if (/^X-/i.test(trimmed)) return `X-${trimmed.slice(2)}`
  if (BARE_BECH32.test(trimmed)) return `X-${trimmed}`
  return trimmed
}

/** Format a raw integer token amount: thousands separators, trailing zeros trimmed. */
export function formatTokenAmount(raw: bigint, decimals: number, maxFractionDigits = 4): string {
  const ZERO = BigInt(0), TEN = BigInt(10), TWO = BigInt(2)
  const neg = raw < ZERO
  const abs = neg ? -raw : raw
  const digits = Math.min(decimals, Math.max(0, maxFractionDigits))
  // round half up at the cut-off digit, then split into whole/fraction
  const scale = TEN ** BigInt(decimals - digits)
  const rounded = scale > BigInt(1) ? (abs + scale / TWO) / scale : abs
  const fracBase = TEN ** BigInt(digits)
  const whole = (rounded / fracBase).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const frac = digits > 0 ? (rounded % fracBase).toString().padStart(digits, "0").replace(/0+$/, "") : ""
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`
}

/** Format a wei amount as AVAX (18 decimals, no unit). */
export function formatAvaxWei(wei: bigint, maxFractionDigits = 4): string {
  return formatTokenAmount(wei, 18, maxFractionDigits)
}

/** Format a wei amount in gwei with fixed fraction digits, e.g. '25.00'. */
export function formatGwei(wei: bigint, fractionDigits = 2): string {
  return Number(formatUnits(wei, 9)).toFixed(fractionDigits)
}

/** THE single uptime threshold set: >=90 green, >=80 yellow, else destructive. */
export function uptimeColor(pct: number): string {
  if (pct >= 90) return "text-green-500"
  if (pct >= 80) return "text-yellow-500"
  return "text-destructive"
}

/** Countdown to a unix timestamp (seconds): '3d 4h', '5h 12m', '12m', 'ended'. */
export function timeUntil(unixSeconds: number, nowMs = Date.now()): string {
  const diff = Math.floor(unixSeconds - nowMs / 1000)
  if (diff <= 0) return "ended"
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${diff}s`
}

/** Relative time display from a unix timestamp (seconds) */
export function relativeTime(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000 - timestamp)
  if (diff < 5) return "now"
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

/** Format gas values to compact human-readable form (e.g. 1.2M, 500K) */
export function formatGas(gas: number): string {
  const millions = gas / 1e6
  if (millions >= 1) return `${millions.toFixed(1)}M`
  const thousands = gas / 1e3
  if (thousands >= 1) return `${thousands.toFixed(0)}K`
  return String(gas)
}

/** Calculate gas usage percentage */
export function gasPercent(used: number, limit: number): number {
  if (limit === 0) return 0
  return Math.round((used / limit) * 100)
}

/** Color class for gas usage percentage */
export function gasColor(pct: number): string {
  if (pct > 80) return "text-red-500"
  if (pct > 50) return "text-amber-500"
  return "text-[#007700] dark:text-[#00ff41]"
}

/** Message of a thrown value, or `fallback` when it isn't an Error. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}
