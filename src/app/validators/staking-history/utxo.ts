import { encodeBase58, getBytes, sha256 } from "ethers"

export interface DecodedUtxo {
  txID: string
  outputIndex: number
  /** nAVAX */
  amount: string
  /** Unix seconds; 0 = unlocked */
  locktime: string
  /** Set for StakeableLockOut (P-Chain locked-stakeable funds) */
  stakeableLocktime?: string
}

function cb58(bytes: Uint8Array): string {
  const checksum = getBytes(sha256(bytes)).slice(-4)
  const out = new Uint8Array(bytes.length + 4)
  out.set(bytes)
  out.set(checksum, bytes.length)
  return encodeBase58(out)
}

/**
 * Decodes a hex UTXO from platform.getUTXOs (json encoding is not supported by the P-Chain).
 * Layout: codec(2) txID(32) outputIndex(4) assetID(32) typeID(4) output...
 * Returns null for output types other than secp256k1 transfer (7) and stakeable lock (22).
 */
export function decodeUtxo(hex: string): DecodedUtxo | null {
  const bytes = getBytes(hex)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const txID = cb58(bytes.slice(2, 34))
  const outputIndex = view.getUint32(34)
  let off = 70
  let typeID = view.getUint32(off)
  let stakeableLocktime: string | undefined
  if (typeID === 22) {
    stakeableLocktime = view.getBigUint64(off + 4).toString()
    off += 12
    typeID = view.getUint32(off)
  }
  if (typeID !== 7) return null
  return {
    txID,
    outputIndex,
    amount: view.getBigUint64(off + 4).toString(),
    locktime: view.getBigUint64(off + 12).toString(),
    stakeableLocktime,
  }
}
