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


/** Auto-prefix P-Chain or X-Chain address if user pastes bare `avax1...` */
export function normalizePChainAddress(input: string): string {
  const trimmed = input.trim()
  if (/^P-/i.test(trimmed)) return `P-${trimmed.slice(2)}`
  if (/^avax1/i.test(trimmed)) return `P-${trimmed}`
  return trimmed
}

export function normalizeXChainAddress(input: string): string {
  const trimmed = input.trim()
  if (/^X-/i.test(trimmed)) return `X-${trimmed.slice(2)}`
  if (/^avax1/i.test(trimmed)) return `X-${trimmed}`
  return trimmed
}

/** Relative time display from a unix timestamp (seconds) */
export function relativeTime(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000 - timestamp)
  if (diff < 5) return "now"
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
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
