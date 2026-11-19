import { describe, it, expect } from "vitest"
import { explorerUrl, appLinks } from "./explorer-links"
import { DEFAULT_NETWORKS, type Network } from "./models/network"

const [mainnet, fuji, localhost] = DEFAULT_NETWORKS
const custom: Network = { id: "c", name: "C", baseUrl: "https://x.io", chainId: 1, type: "custom" }

describe("explorerUrl", () => {
  it("builds snowtrace links per network", () => {
    expect(explorerUrl(mainnet, "tx", "0xabc")).toBe("https://snowtrace.io/tx/0xabc")
    expect(explorerUrl(fuji, "block", 12)).toBe("https://testnet.snowtrace.io/block/12")
  })

  it("builds subnets explorer links and strips P-/X- prefixes", () => {
    expect(explorerUrl(mainnet, "validator", "NodeID-1")).toBe("https://subnets.avax.network/validators/NodeID-1")
    expect(explorerUrl(fuji, "pAddress", "P-fuji1abc")).toBe("https://subnets-test.avax.network/p-chain/address/fuji1abc")
    expect(explorerUrl(mainnet, "xAddress", "X-avax1abc")).toBe("https://subnets.avax.network/x-chain/address/avax1abc")
  })

  it("returns null for local/custom networks and blockchain kind", () => {
    expect(explorerUrl(localhost, "tx", "0x1")).toBeNull()
    expect(explorerUrl(custom, "address", "0x1")).toBeNull()
    expect(explorerUrl(mainnet, "blockchain", "abc")).toBeNull()
  })
})

describe("appLinks", () => {
  it("encodes query values", () => {
    expect(appLinks.tx("0xab")).toBe("/explorer?tx=0xab")
    expect(appLinks.block(5)).toBe("/explorer?block=5")
    expect(appLinks.validator("NodeID-x")).toBe("/validators/status?nodeId=NodeID-x")
  })
})
