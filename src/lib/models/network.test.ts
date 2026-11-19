import { describe, it, expect } from "vitest"
import { DEFAULT_NETWORKS, deriveEndpoints, isValidNetwork, hrpForNetwork } from "./network"

describe("network model", () => {
  it("has mainnet, fuji, and localhost defaults", () => {
    expect(DEFAULT_NETWORKS).toHaveLength(3)
    expect(DEFAULT_NETWORKS.map(n => n.id)).toEqual(["mainnet", "fuji", "localhost"])
  })

  it("derives chain endpoints from base URL", () => {
    const endpoints = deriveEndpoints("https://api.avax.network")
    expect(endpoints.cChain).toBe("https://api.avax.network/ext/bc/C/rpc")
    expect(endpoints.pChain).toBe("https://api.avax.network/ext/bc/P")
    expect(endpoints.xChain).toBe("https://api.avax.network/ext/bc/X")
    expect(endpoints.info).toBe("https://api.avax.network/ext/info")
    expect(endpoints.health).toBe("https://api.avax.network/ext/health")
  })

  it("handles trailing slash in base URL", () => {
    const endpoints = deriveEndpoints("https://api.avax.network/")
    expect(endpoints.cChain).toBe("https://api.avax.network/ext/bc/C/rpc")
  })

  it("mainnet has correct chain ID", () => {
    const mainnet = DEFAULT_NETWORKS.find(n => n.id === "mainnet")!
    expect(mainnet.chainId).toBe(43114)
  })

  it("fuji has correct chain ID", () => {
    const fuji = DEFAULT_NETWORKS.find(n => n.id === "fuji")!
    expect(fuji.chainId).toBe(43113)
  })

  it("isValidNetwork accepts real network types only", () => {
    const base = { id: "x", name: "X", baseUrl: "https://x.io", chainId: 1 }
    for (const type of ["mainnet", "fuji", "localhost", "custom"]) {
      expect(isValidNetwork({ ...base, type })).toBe(true)
    }
    expect(isValidNetwork({ ...base, type: "testnet" })).toBe(false)
    expect(isValidNetwork(base)).toBe(false)
    expect(isValidNetwork({ ...base, type: "custom", baseUrl: "ftp://x" })).toBe(false)
  })

  it("maps networks to bech32 HRPs", () => {
    expect(DEFAULT_NETWORKS.map(hrpForNetwork)).toEqual(["avax", "fuji", "local"])
  })
})
