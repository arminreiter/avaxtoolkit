export type NetworkType = "mainnet" | "fuji" | "localhost" | "custom"

export interface Network {
  id: string
  name: string
  baseUrl: string
  chainId: number
  type: NetworkType
  /** If true, baseUrl is a plain JSON-RPC endpoint (no Avalanche /ext/bc/ paths) */
  plainRpc?: boolean
}

export interface ChainEndpoints {
  cChain: string
  pChain: string
  xChain: string
  info: string
  health: string
}

export function deriveEndpoints(baseUrl: string, plainRpc?: boolean): ChainEndpoints {
  const base = baseUrl.replace(/\/+$/, "")
  if (plainRpc) {
    return {
      cChain: base,
      pChain: base,
      xChain: base,
      info: base,
      health: base,
    }
  }
  return {
    cChain: `${base}/ext/bc/C/rpc`,
    pChain: `${base}/ext/bc/P`,
    xChain: `${base}/ext/bc/X`,
    info: `${base}/ext/info`,
    health: `${base}/ext/health`,
  }
}

function isValidUrl(url: unknown): boolean {
  if (typeof url !== "string") return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch { return false }
}

export function isValidNetwork(n: unknown): n is Network {
  if (typeof n !== "object" || n === null) return false
  const obj = n as Record<string, unknown>
  return typeof obj.id === "string" && typeof obj.name === "string" &&
    typeof obj.baseUrl === "string" && typeof obj.chainId === "number" &&
    (obj.type === undefined || obj.type === "mainnet" || obj.type === "testnet" || obj.type === "local" || obj.type === "custom") &&
    isValidUrl(obj.baseUrl)
}

export const DEFAULT_NETWORKS: Network[] = [
  {
    id: "mainnet",
    name: "Avalanche Mainnet",
    baseUrl: "https://api.avax.network",
    chainId: 43114,
    type: "mainnet",
  },
  {
    id: "fuji",
    name: "Fuji Testnet",
    baseUrl: "https://api.avax-test.network",
    chainId: 43113,
    type: "fuji",
  },
  {
    id: "localhost",
    name: "Localhost",
    baseUrl: "http://127.0.0.1:9650",
    chainId: 43112,
    type: "localhost",
  },
]
