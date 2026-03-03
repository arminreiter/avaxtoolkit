import { describe, it, expect } from "vitest"
import {
  encryptConfig,
  decryptConfig,
  isValidConfigFile,
  isEncryptedConfigFile,
  isPlainConfigFile,
  createPlainConfig,
  type ConfigPayload,
} from "./config-crypto"

const samplePayload: ConfigPayload = {
  customNetworks: [
    { id: "custom-test-1", name: "Test Net", baseUrl: "http://localhost:9650", chainId: 99999, type: "custom" },
  ],
  activeNetworkId: "mainnet",
  etherscanApiKey: "abc123",
  wallets: [
    {
      id: "w1",
      name: "Test Wallet",
      type: "private-key",
      address: "0x1234567890abcdef1234567890abcdef12345678",
      privateKey: "0xdeadbeef",
      createdAt: 1700000000000,
    },
  ],
  activeWalletId: "w1",
}

describe("config-crypto", () => {
  it("round-trip encrypt/decrypt preserves payload", async () => {
    const encrypted = await encryptConfig(samplePayload, "testpassword", true)
    const decrypted = await decryptConfig(encrypted, "testpassword")
    expect(decrypted).toEqual(samplePayload)
  })

  it("wrong password throws descriptive error", async () => {
    const encrypted = await encryptConfig(samplePayload, "correct", true)
    await expect(decryptConfig(encrypted, "wrong")).rejects.toThrow(
      "Decryption failed. Wrong password or corrupted file."
    )
  })

  it("different invocations produce different ciphertext", async () => {
    const a = await encryptConfig(samplePayload, "pass", false)
    const b = await encryptConfig(samplePayload, "pass", false)
    expect(a.salt).not.toBe(b.salt)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  describe("plain config", () => {
    it("createPlainConfig produces valid structure", () => {
      const plain = createPlainConfig(samplePayload, false)
      expect(plain.version).toBe(1)
      expect(plain.encrypted).toBe(false)
      expect(plain.includesWallets).toBe(false)
      expect(plain.payload).toEqual(samplePayload)
      expect(typeof plain.createdAt).toBe("string")
    })

    it("plain config round-trips without password", () => {
      const plain = createPlainConfig(samplePayload, true)
      expect(plain.payload).toEqual(samplePayload)
    })
  })

  describe("isValidConfigFile", () => {
    it("returns true for encrypted structure", async () => {
      const encrypted = await encryptConfig(samplePayload, "pw", false)
      expect(isValidConfigFile(encrypted)).toBe(true)
      expect(isEncryptedConfigFile(encrypted)).toBe(true)
      expect(isPlainConfigFile(encrypted)).toBe(false)
    })

    it("returns true for plain structure", () => {
      const plain = createPlainConfig(samplePayload, false)
      expect(isValidConfigFile(plain)).toBe(true)
      expect(isPlainConfigFile(plain)).toBe(true)
      expect(isEncryptedConfigFile(plain)).toBe(false)
    })

    it("returns false for null", () => {
      expect(isValidConfigFile(null)).toBe(false)
    })

    it("returns false for non-object", () => {
      expect(isValidConfigFile("string")).toBe(false)
    })

    it("returns false when version is wrong", () => {
      expect(isValidConfigFile({ version: 2, createdAt: "", includesWallets: false, salt: "", iv: "", ciphertext: "" })).toBe(false)
    })

    it("returns false when fields are missing", () => {
      expect(isValidConfigFile({ version: 1, createdAt: "" })).toBe(false)
    })
  })
})
