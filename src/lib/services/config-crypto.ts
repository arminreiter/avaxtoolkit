import type { Network } from "@/lib/models/network"
import { type StoredWallet, isValidWallet } from "@/lib/models/wallet"

export interface ConfigPayload {
  customNetworks: Network[]
  activeNetworkId: string | null
  etherscanApiKey: string | null
  wallets?: StoredWallet[]
  activeWalletId?: string | null
}

export interface EncryptedConfigFile {
  version: 1
  createdAt: string
  includesWallets: boolean
  salt: string
  iv: string
  ciphertext: string
}

export interface PlainConfigFile {
  version: 1
  createdAt: string
  includesWallets: boolean
  encrypted: false
  payload: ConfigPayload
}

export type ConfigFile = EncryptedConfigFile | PlainConfigFile

const PBKDF2_ITERATIONS = 600_000

function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(arr.byteLength)
  new Uint8Array(buf).set(arr)
  return buf
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toArrayBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function encryptConfig(
  payload: ConfigPayload,
  password: string,
  includesWallets: boolean,
): Promise<EncryptedConfigFile> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)

  const enc = new TextEncoder()
  const plaintext = enc.encode(JSON.stringify(payload))

  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    plaintext,
  )

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    includesWallets,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(cipherBuf),
  }
}

export async function decryptConfig(
  file: EncryptedConfigFile,
  password: string,
): Promise<ConfigPayload> {
  const salt = fromBase64(file.salt)
  const iv = fromBase64(file.iv)
  const ciphertext = fromBase64(file.ciphertext)
  const key = await deriveKey(password, salt)

  let plainBuf: ArrayBuffer
  try {
    plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext),
    )
  } catch {
    throw new Error("Decryption failed. Wrong password or corrupted file.")
  }

  const dec = new TextDecoder()
  const parsed = JSON.parse(dec.decode(plainBuf))
  if (!isValidConfigPayload(parsed)) {
    throw new Error("Decrypted data has an invalid structure.")
  }
  return parsed
}

function isValidConfigPayload(obj: unknown): obj is ConfigPayload {
  if (typeof obj !== "object" || obj === null) return false
  const o = obj as Record<string, unknown>
  return (
    Array.isArray(o.customNetworks) &&
    (o.activeNetworkId === null || typeof o.activeNetworkId === "string") &&
    (o.etherscanApiKey === null || typeof o.etherscanApiKey === "string") &&
    (o.wallets === undefined || (Array.isArray(o.wallets) && (o.wallets as unknown[]).every(isValidWallet))) &&
    (o.activeWalletId === undefined || o.activeWalletId === null || typeof o.activeWalletId === "string")
  )
}

export function isEncryptedConfigFile(obj: unknown): obj is EncryptedConfigFile {
  if (typeof obj !== "object" || obj === null) return false
  const o = obj as Record<string, unknown>
  return (
    o.version === 1 &&
    typeof o.createdAt === "string" &&
    typeof o.includesWallets === "boolean" &&
    typeof o.salt === "string" &&
    typeof o.iv === "string" &&
    typeof o.ciphertext === "string"
  )
}

export function isPlainConfigFile(obj: unknown): obj is PlainConfigFile {
  if (typeof obj !== "object" || obj === null) return false
  const o = obj as Record<string, unknown>
  return (
    o.version === 1 &&
    typeof o.createdAt === "string" &&
    typeof o.includesWallets === "boolean" &&
    o.encrypted === false &&
    isValidConfigPayload(o.payload)
  )
}

export function isValidConfigFile(obj: unknown): obj is ConfigFile {
  return isEncryptedConfigFile(obj) || isPlainConfigFile(obj)
}

export function createPlainConfig(
  payload: ConfigPayload,
  includesWallets: boolean,
): PlainConfigFile {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    includesWallets,
    encrypted: false,
    payload,
  }
}
