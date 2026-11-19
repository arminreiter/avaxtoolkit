import type { TransactionResponse } from "ethers/providers"
import { decodeCalldata } from "@/lib/utils/abi"

/** A transaction broadcast from this toolkit. Status is looked up live, not stored. */
export interface SentTx {
  hash: string
  chainId: number
  from: string
  to: string | null
  value: string // wei
  nonce: number
  label: string
  createdAt: number
  /** Set when the tx is an ERC-20 transfer(); `to` above is then the token contract. */
  tokenTransfer?: TokenTransfer
}

export interface TokenTransfer {
  recipient: string
  amount: string // raw token units
}

const TRANSFER_SELECTOR = "0xa9059cbb"

/** Decode ERC-20 transfer(address,uint256) calldata; undefined for anything else. */
export function decodeTokenTransfer(data: string | undefined): TokenTransfer | undefined {
  if (!data?.toLowerCase().startsWith(TRANSFER_SELECTOR)) return undefined
  try {
    const [recipient, amount] = decodeCalldata("transfer(address,uint256)", data).args
    return { recipient: recipient.value, amount: amount.value }
  } catch { return undefined }
}

const TX_HISTORY_STORAGE_KEY = "avax-toolkit-tx-history"
// ponytail: fixed cap keeps localStorage small; make configurable if anyone needs more
const MAX_ENTRIES = 500

export function loadTxHistory(): SentTx[] {
  try {
    const list = JSON.parse(localStorage.getItem(TX_HISTORY_STORAGE_KEY) ?? "[]")
    return Array.isArray(list) ? list : []
  } catch { return [] }
}

export function saveTxHistory(list: SentTx[]) {
  try {
    localStorage.setItem(TX_HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)))
  } catch { /* storage unavailable */ }
}

function toSentTx(tx: TransactionResponse, label: string, now = Date.now()): SentTx {
  return {
    hash: tx.hash,
    chainId: Number(tx.chainId),
    from: tx.from,
    to: tx.to,
    value: tx.value.toString(),
    nonce: tx.nonce,
    label,
    createdAt: now,
    tokenTransfer: decodeTokenTransfer(tx.data),
  }
}

/** Record a broadcast tx (newest first). Re-recording the same hash is a no-op. */
export function recordSentTx(tx: TransactionResponse, label: string) {
  const list = loadTxHistory()
  if (list.some(e => e.hash === tx.hash)) return
  saveTxHistory([toSentTx(tx, label), ...list])
}

export interface FeeFields {
  maxFeePerGas?: bigint | null
  maxPriorityFeePerGas?: bigint | null
  gasPrice?: bigint | null
}

// Nodes require a replacement to pay >= 10% more; 25% leaves headroom for rounding.
const bump = (v: bigint) => (v * BigInt(125) + BigInt(99)) / BigInt(100)

/**
 * Fees for a replacement tx (same nonce). Each fee is max(old * 1.25, current network fee).
 * Without the original tx (dropped from the mempool) we fall back to 2x the current fee.
 */
export function replacementFees(old: FeeFields | null, current: FeeFields): FeeFields {
  const pick = (o?: bigint | null, c?: bigint | null) => {
    const bumped = o != null ? bump(o) : (c ?? BigInt(0)) * BigInt(2)
    return c != null && c > bumped ? c : bumped
  }
  const oldIsLegacy = old != null && old.maxFeePerGas == null
  if (oldIsLegacy || current.maxFeePerGas == null) {
    return { gasPrice: pick(old?.gasPrice, current.gasPrice ?? current.maxFeePerGas) }
  }
  const maxPriorityFeePerGas = pick(old?.maxPriorityFeePerGas, current.maxPriorityFeePerGas)
  const maxFeePerGas = pick(old?.maxFeePerGas, current.maxFeePerGas)
  return { maxFeePerGas: maxFeePerGas > maxPriorityFeePerGas ? maxFeePerGas : maxPriorityFeePerGas, maxPriorityFeePerGas }
}
