import type { Network } from "@/lib/models/network"

export type ExplorerKind =
  | "address" | "tx" | "block" | "token"
  | "pAddress" | "pTx" | "xAddress" | "xTx"
  | "validator" | "l1" | "blockchain"

const SNOWTRACE: Partial<Record<string, string>> = {
  mainnet: "https://snowtrace.io",
  fuji: "https://testnet.snowtrace.io",
}

const SUBNETS: Partial<Record<string, string>> = {
  mainnet: "https://subnets.avax.network",
  fuji: "https://subnets-test.avax.network",
}

const stripPrefix = (id: string) => id.replace(/^[PX]-/i, "")

/** External explorer URL, or null for localhost/custom networks and unsupported kinds. */
export function explorerUrl(network: Network, kind: ExplorerKind, id: string | number): string | null {
  const snowtrace = SNOWTRACE[network.type]
  const subnets = SUBNETS[network.type]
  if (!snowtrace || !subnets) return null
  const v = encodeURIComponent(String(id))
  switch (kind) {
    case "address": return `${snowtrace}/address/${v}`
    case "tx": return `${snowtrace}/tx/${v}`
    case "block": return `${snowtrace}/block/${v}`
    case "token": return `${snowtrace}/token/${v}`
    case "validator": return `${subnets}/validators/${v}`
    case "l1": return `${subnets}/subnets/${v}`
    case "pTx": return `${subnets}/p-chain/tx/${v}`
    case "pAddress": return `${subnets}/p-chain/address/${encodeURIComponent(stripPrefix(String(id)))}`
    case "xTx": return `${subnets}/x-chain/tx/${v}`
    case "xAddress": return `${subnets}/x-chain/address/${encodeURIComponent(stripPrefix(String(id)))}`
    // ponytail: no confirmed blockchain-detail URL pattern on the subnets explorer
    case "blockchain": return null
  }
}

const q = (path: string, key: string, value: string | number) =>
  `${path}?${key}=${encodeURIComponent(String(value))}`

/** Internal deep links — single source of truth for cross-page navigation. */
export const appLinks = {
  tx: (hash: string) => q("/explorer", "tx", hash),
  block: (numOrHash: string | number) => q("/explorer", "block", numOrHash),
  address: (addr: string) => q("/c-chain/balances", "address", addr),
  contract: (addr: string) => q("/c-chain/contracts", "address", addr),
  token: (addr: string) => q("/c-chain/tokens", "address", addr),
  validator: (nodeId: string) => q("/validators/status", "nodeId", nodeId),
  validatorDashboard: (nodeId: string) => q("/validators/dashboard", "nodeId", nodeId),
  delegators: (nodeId: string) => q("/validators/delegators", "nodeId", nodeId),
  stakingHistory: (pAddr: string) => q("/validators/staking-history", "address", pAddr),
  l1: (subnetId: string) => q("/l1s/info", "l1", subnetId),
  l1Validators: (subnetId: string) => q("/l1s/validators", "l1", subnetId),
  blockchainStatus: (chainId: string) => q("/l1s/blockchain-status", "id", chainId),
  xBalance: (xAddr: string) => q("/wallet/x-chain-balance", "address", xAddr),
}
