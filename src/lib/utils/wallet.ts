import { HDNodeWallet, Mnemonic } from "ethers/wallet"
import { randomBytes, ripemd160, sha256, SigningKey } from "ethers/crypto"
import { getBytes } from "ethers/utils"
import type { StoredWallet } from "@/lib/models/wallet"

/** BIP-44 Ethereum base path; the address index is appended. */
export const DEFAULT_DERIVATION_BASE = "m/44'/60'/0'/0/"

// type alias (not interface) so it satisfies DataTable's Record<string, unknown> constraint
export type DerivedAddress = {
  index: number
  address: string
  privateKey: string
  path: string
}

/** Fresh BIP-39 phrase: 12 words = 128-bit entropy, 24 words = 256-bit. */
export function generateMnemonic(wordCount: 12 | 24): string {
  return Mnemonic.fromEntropy(randomBytes(wordCount === 24 ? 32 : 16)).phrase
}

export function deriveAddresses(mnemonic: string, basePath: string, count: number): DerivedAddress[] {
  return Array.from({ length: count }, (_, index) => {
    const path = `${basePath}${index}`
    const wallet = HDNodeWallet.fromPhrase(mnemonic, undefined, path)
    return { index, address: wallet.address, privateKey: wallet.privateKey, path }
  })
}

// --- Avalanche P-/X-Chain (bech32) addresses ---

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

function polymod(values: number[]): number {
  let chk = 1
  for (const v of values) {
    const top = chk >>> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i]
  }
  return chk
}

const hrpExpand = (hrp: string) => [...hrp].map(c => c.charCodeAt(0) >> 5).concat(0, [...hrp].map(c => c.charCodeAt(0) & 31))

function convertBits(data: ArrayLike<number>, from: number, to: number, pad: boolean): number[] {
  let acc = 0, bits = 0
  const out: number[] = []
  const max = (1 << to) - 1
  for (let i = 0; i < data.length; i++) {
    acc = (acc << from) | data[i]
    bits += from
    while (bits >= to) { bits -= to; out.push((acc >> bits) & max) }
  }
  if (pad && bits > 0) out.push((acc << (to - bits)) & max)
  else if (!pad && (bits >= from || ((acc << (to - bits)) & max))) throw new Error("Invalid bech32 padding")
  return out
}

export function bech32Encode(hrp: string, bytes: Uint8Array): string {
  const data = convertBits(bytes, 8, 5, true)
  const mod = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ 1
  const checksum = Array.from({ length: 6 }, (_, i) => (mod >>> (5 * (5 - i))) & 31)
  return `${hrp}1${[...data, ...checksum].map(d => CHARSET[d]).join("")}`
}

/** Decodes a bare bech32 string (no P-/X- prefix); throws on bad checksum/characters. */
export function bech32Decode(addr: string): { hrp: string; bytes: Uint8Array } {
  const lower = addr.toLowerCase()
  const sep = lower.lastIndexOf("1")
  if (sep < 1 || lower.length - sep < 7 || addr !== lower && addr !== addr.toUpperCase()) throw new Error("Invalid bech32 address")
  const hrp = lower.slice(0, sep)
  const data = [...lower.slice(sep + 1)].map(c => {
    const d = CHARSET.indexOf(c)
    if (d < 0) throw new Error("Invalid bech32 character")
    return d
  })
  if (polymod([...hrpExpand(hrp), ...data]) !== 1) throw new Error("Invalid bech32 checksum")
  return { hrp, bytes: Uint8Array.from(convertBits(data.slice(0, -6), 5, 8, false)) }
}

/** True for a valid 20-byte Avalanche bech32 address, with or without a P-/X- prefix. */
export function isBech32Address(s: string): boolean {
  try {
    return bech32Decode(s.trim().replace(/^[PX]-/i, "")).bytes.length === 20
  } catch {
    return false
  }
}

/** Bare bech32 address (e.g. 'avax1…') for a compressed secp256k1 public key; prefix with 'P-'/'X-'. */
export function pxAddressFromPublicKey(compressedPubKey: string, hrp: string): string {
  return bech32Encode(hrp, getBytes(ripemd160(sha256(compressedPubKey))))
}

/** Bare bech32 address (e.g. 'avax1…') for a private key; prefix with 'P-'/'X-'. */
export function pxAddressFromPrivateKey(privateKey: string, hrp: string): string {
  return pxAddressFromPublicKey(SigningKey.computePublicKey(privateKey, true), hrp)
}

/** Avalanche BIP-44 path (coin type 9000) used for P-/X-Chain keys of mnemonic wallets. */
export const AVAX_DERIVATION_PATH = "m/44'/9000'/0'/0/0"

/** Bare P-/X-Chain address of a stored wallet, or null for connected (injected) wallets. */
export function avaxAddressFromWallet(wallet: StoredWallet, hrp: string): string | null {
  if (wallet.type === "private-key" && wallet.privateKey) return pxAddressFromPrivateKey(wallet.privateKey, hrp)
  if (wallet.type === "mnemonic" && wallet.mnemonic) {
    return pxAddressFromPrivateKey(HDNodeWallet.fromPhrase(wallet.mnemonic, undefined, AVAX_DERIVATION_PATH).privateKey, hrp)
  }
  return null
}
