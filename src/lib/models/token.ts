export interface TrackedToken {
  address: string
  symbol: string
  name: string
  decimals: number
}

/** Per-chain user token list, keyed by chainId. */
const TOKEN_STORAGE_KEY = "avax-toolkit-tokens"

export const DEFAULT_TOKENS: Record<number, TrackedToken[]> = {
  43114: [
    { address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", symbol: "WAVAX", name: "Wrapped AVAX", decimals: 18 },
    { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", symbol: "USDt", name: "TetherToken", decimals: 6 },
  ],
  43113: [
    { address: "0xd00ae08403B9bbb9124bB305C09058E32C39A48c", symbol: "WAVAX", name: "Wrapped AVAX", decimals: 18 },
    { address: "0x5425890298aed601595a70AB815c96711a31Bc65", symbol: "USDC", name: "USD Coin", decimals: 6 },
  ],
}

/** WAVAX contract for a chain (from the defaults), or undefined where none is known. */
export function wavaxAddress(chainId: number): string | undefined {
  return DEFAULT_TOKENS[chainId]?.find(t => t.symbol === "WAVAX")?.address
}

export function isValidToken(t: unknown): t is TrackedToken {
  if (typeof t !== "object" || t === null) return false
  const o = t as Record<string, unknown>
  return typeof o.address === "string" && /^0x[0-9a-fA-F]{40}$/.test(o.address) &&
    typeof o.symbol === "string" && typeof o.name === "string" &&
    typeof o.decimals === "number" && Number.isInteger(o.decimals) && o.decimals >= 0 && o.decimals <= 255
}

/** Tokens for a chain: the user's saved list if present, otherwise the defaults. */
export function loadTokens(chainId: number): TrackedToken[] {
  try {
    const all = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) ?? "{}")
    const list = all?.[chainId]
    if (Array.isArray(list)) return list.filter(isValidToken)
  } catch { /* fall through to defaults */ }
  return DEFAULT_TOKENS[chainId] ?? []
}

export function saveTokens(chainId: number, tokens: TrackedToken[]) {
  try {
    const all = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) ?? "{}")
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ ...all, [chainId]: tokens }))
  } catch { /* storage unavailable */ }
}

/** Merge new tokens into a list, de-duplicating by address (case-insensitive). */
export function mergeTokens(existing: TrackedToken[], incoming: TrackedToken[]): TrackedToken[] {
  const seen = new Set(existing.map(t => t.address.toLowerCase()))
  const added = incoming.filter(t => {
    const key = t.address.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return [...existing, ...added]
}
