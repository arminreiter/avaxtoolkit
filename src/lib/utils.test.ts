import { describe, it, expect } from "vitest"
import {
  normalizePChainAddress, normalizeXChainAddress, formatTokenAmount, formatAvaxWei,
  formatGwei, uptimeColor, timeUntil,
} from "./utils"

const BARE = "18jma8ppw3nhx5r4ap8clazz0dps7rv5ukulre5"

describe("normalize addresses", () => {
  it("prefixes bare addresses with any HRP", () => {
    expect(normalizePChainAddress(`avax${BARE}`)).toBe(`P-avax${BARE}`)
    expect(normalizePChainAddress(` fuji${BARE} `)).toBe(`P-fuji${BARE}`)
    expect(normalizeXChainAddress(`local${BARE}`)).toBe(`X-local${BARE}`)
    expect(normalizeXChainAddress(`custom${BARE}`)).toBe(`X-custom${BARE}`)
  })
  it("normalizes prefix case and leaves other input alone", () => {
    expect(normalizePChainAddress(`p-avax${BARE}`)).toBe(`P-avax${BARE}`)
    expect(normalizePChainAddress("0xabc")).toBe("0xabc")
    expect(normalizeXChainAddress("avax1short")).toBe("avax1short")
  })
})

describe("formatTokenAmount", () => {
  it("adds separators and trims zeros", () => {
    expect(formatTokenAmount(BigInt("1234567500000"), 6)).toBe("1,234,567.5")
    expect(formatTokenAmount(BigInt("1000"), 0)).toBe("1,000")
    expect(formatTokenAmount(-BigInt("15"), 1)).toBe("-1.5")
  })
  it("rounds at maxFractionDigits", () => {
    expect(formatTokenAmount(BigInt("199999"), 5, 2)).toBe("2")
    expect(formatTokenAmount(BigInt("123456"), 5, 2)).toBe("1.23")
  })
  it("formats wei and gwei", () => {
    expect(formatAvaxWei(BigInt("1500000000000000000"))).toBe("1.5")
    expect(formatGwei(BigInt("25000000000"))).toBe("25.00")
  })
})

describe("uptimeColor", () => {
  it("uses the 90/80 thresholds", () => {
    expect(uptimeColor(95)).toBe("text-green-500")
    expect(uptimeColor(85)).toBe("text-yellow-500")
    expect(uptimeColor(50)).toBe("text-destructive")
  })
})

describe("timeUntil", () => {
  it("formats countdowns", () => {
    const now = 1_000_000_000
    expect(timeUntil(now / 1000 + 3 * 86400 + 4 * 3600, now)).toBe("3d 4h")
    expect(timeUntil(now / 1000 + 12 * 60, now)).toBe("12m")
    expect(timeUntil(now / 1000 - 1, now)).toBe("ended")
  })
})
