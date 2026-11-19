import { describe, it, expect } from "vitest"
import { DEFAULT_TOKENS, isValidToken, mergeTokens } from "./token"

const t = (address: string, symbol = "T") => ({ address, symbol, name: symbol, decimals: 18 })

describe("token model", () => {
  it("default tokens are valid", () => {
    for (const list of Object.values(DEFAULT_TOKENS)) {
      for (const token of list) expect(isValidToken(token)).toBe(true)
    }
  })

  it("rejects malformed tokens", () => {
    expect(isValidToken({ ...t("0x123"), })).toBe(false)
    expect(isValidToken({ ...t("0x" + "a".repeat(40)), decimals: 1.5 })).toBe(false)
    expect(isValidToken(null)).toBe(false)
  })

  it("merges without duplicates, case-insensitive", () => {
    const a = "0x" + "a".repeat(40)
    const b = "0x" + "b".repeat(40)
    const merged = mergeTokens([t(a, "A")], [t(a.toUpperCase().replace("0X", "0x"), "A2"), t(b, "B"), t(b, "B2")])
    expect(merged.map(x => x.symbol)).toEqual(["A", "B"])
  })
})
