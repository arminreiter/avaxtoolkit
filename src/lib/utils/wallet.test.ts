import { describe, it, expect } from "vitest"
import {
  deriveAddresses, generateMnemonic, DEFAULT_DERIVATION_BASE,
  pxAddressFromPrivateKey, avaxAddressFromWallet, isBech32Address, bech32Decode, bech32Encode,
} from "./wallet"
import type { StoredWallet } from "@/lib/models/wallet"

// Well-known Hardhat/Anvil dev mnemonic — public test vector, holds no funds.
const DEV_MNEMONIC = "test test test test test test test test test test test junk"

describe("deriveAddresses", () => {
  it("derives the known dev accounts with their paths", () => {
    const [a0, a1] = deriveAddresses(DEV_MNEMONIC, DEFAULT_DERIVATION_BASE, 2)
    expect(a0).toMatchObject({ index: 0, path: "m/44'/60'/0'/0/0", address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" })
    expect(a1.address).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
  })
})

describe("generateMnemonic", () => {
  it("produces 12 or 24 words", () => {
    expect(generateMnemonic(12).split(" ")).toHaveLength(12)
    expect(generateMnemonic(24).split(" ")).toHaveLength(24)
  })
})

// Well-known "ewoq" local-network key — public test vector, holds no real funds.
const EWOQ_KEY = "0x56289e99c94b6912bfc12adc093c9b51124f0dc54ac7a766b2bc5ccf558d8027"

describe("Avalanche bech32 addresses", () => {
  it("derives the ewoq address for local and mainnet HRPs", () => {
    expect(pxAddressFromPrivateKey(EWOQ_KEY, "local")).toBe("local18jma8ppw3nhx5r4ap8clazz0dps7rv5u00z96u")
    expect(pxAddressFromPrivateKey(EWOQ_KEY, "avax")).toBe("avax18jma8ppw3nhx5r4ap8clazz0dps7rv5ukulre5")
  })

  it("round-trips encode/decode", () => {
    const { hrp, bytes } = bech32Decode("avax18jma8ppw3nhx5r4ap8clazz0dps7rv5ukulre5")
    expect(hrp).toBe("avax")
    expect(bytes).toHaveLength(20)
    expect(bech32Encode("fuji", bytes)).toBe(pxAddressFromPrivateKey(EWOQ_KEY, "fuji"))
  })

  it("validates addresses with or without chain prefix", () => {
    expect(isBech32Address("X-avax18jma8ppw3nhx5r4ap8clazz0dps7rv5ukulre5")).toBe(true)
    expect(isBech32Address("avax18jma8ppw3nhx5r4ap8clazz0dps7rv5ukulre5")).toBe(true)
    expect(isBech32Address("avax18jma8ppw3nhx5r4ap8clazz0dps7rv5ukulre6")).toBe(false)
    expect(isBech32Address("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).toBe(false)
  })

  it("derives addresses from stored wallets", () => {
    const base = { id: "1", name: "w", address: "0x", createdAt: 0 }
    expect(avaxAddressFromWallet({ ...base, type: "private-key", privateKey: EWOQ_KEY }, "avax"))
      .toBe("avax18jma8ppw3nhx5r4ap8clazz0dps7rv5ukulre5")
    expect(avaxAddressFromWallet({ ...base, type: "mnemonic", mnemonic: DEV_MNEMONIC } as StoredWallet, "avax")).toMatch(/^avax1/)
    expect(avaxAddressFromWallet({ ...base, type: "connected" }, "avax")).toBeNull()
  })
})
