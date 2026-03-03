export interface StoredWallet {
  id: string
  name: string
  type: "private-key" | "mnemonic" | "connected"
  address: string
  privateKey?: string
  mnemonic?: string
  derivationPath?: string
  connectorType?: "injected"
  createdAt: number
}

export function isValidWallet(w: unknown): w is StoredWallet {
  if (typeof w !== "object" || w === null) return false
  const obj = w as Record<string, unknown>
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.type === "string" &&
    (obj.type === "private-key" || obj.type === "mnemonic" || obj.type === "connected") &&
    typeof obj.address === "string" && obj.address.length > 0 &&
    typeof obj.createdAt === "number"
  )
}

export const WALLET_STORAGE_KEY = "avax-toolkit-wallets"
export const ACTIVE_WALLET_STORAGE_KEY = "avax-toolkit-active-wallet"
