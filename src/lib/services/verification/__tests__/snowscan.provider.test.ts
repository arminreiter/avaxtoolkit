import { describe, it, expect, vi, beforeEach } from "vitest"
import { SnowscanProvider } from "../providers/snowscan.provider"
import * as apiKeys from "../api-keys"

vi.stubGlobal("fetch", vi.fn())

describe("SnowscanProvider (Etherscan V2)", () => {
  let provider: SnowscanProvider

  beforeEach(() => {
    vi.restoreAllMocks()
    provider = new SnowscanProvider()
  })

  describe("checkVerification without API key", () => {
    it("returns unavailable when no API key is set", async () => {
      vi.spyOn(apiKeys, "getEtherscanApiKey").mockReturnValue(undefined)

      const result = await provider.checkVerification("0xABC", 43114)

      expect(result).toEqual({
        provider: "etherscan",
        verified: false,
        unavailable: true,
        unavailableReason: "Etherscan API key required — add one in Settings",
      })
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe("checkVerification with API key", () => {
    beforeEach(() => {
      vi.spyOn(apiKeys, "getEtherscanApiKey").mockReturnValue("test-key")
    })

    it("returns verified: true with contract metadata when API returns status '1' with SourceCode", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: "1",
          result: [
            {
              SourceCode: "pragma solidity ^0.8.0; contract Test {}",
              ContractName: "Test",
              CompilerVersion: "v0.8.20+commit.a1b79de6",
              OptimizationUsed: "1",
              Runs: "200",
              EVMVersion: "paris",
              LicenseType: "MIT",
              Proxy: "0",
              Implementation: "",
            },
          ],
        }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      const result = await provider.checkVerification("0xABC", 43114)

      expect(result).toEqual({
        provider: "etherscan",
        verified: true,
        contractName: "Test",
        compilerVersion: "v0.8.20+commit.a1b79de6",
        optimizationUsed: true,
        runs: 200,
        evmVersion: "paris",
        license: "MIT",
        proxy: false,
        implementation: undefined,
      })
    })

    it("returns verified: false when API returns status '0'", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: "0",
          result: [{ SourceCode: "", ContractName: "" }],
        }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      const result = await provider.checkVerification("0xABC", 43114)

      expect(result).toEqual({
        provider: "etherscan",
        verified: false,
      })
    })

    it("uses Etherscan V2 API URL with chainid and apikey", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ status: "0", result: [{ SourceCode: "" }] }),
      } as unknown as Response)

      await provider.checkVerification("0xABC", 43114)

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/proxy/etherscan/v2/api?chainid=43114&apikey=test-key"),
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
  })

  describe("getSource with API key", () => {
    beforeEach(() => {
      vi.spyOn(apiKeys, "getEtherscanApiKey").mockReturnValue("test-key")
    })

    it("parses single-file source correctly", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: "1",
          result: [
            {
              SourceCode: "pragma solidity ^0.8.0; contract Test { }",
              ContractName: "Test",
              CompilerVersion: "v0.8.20",
              ABI: '[{"type":"function","name":"transfer"}]',
            },
          ],
        }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      const result = await provider.getSource("0xABC", 43114)

      expect(result.provider).toBe("etherscan")
      expect(result.files).toEqual({
        "Test.sol": "pragma solidity ^0.8.0; contract Test { }",
      })
      expect(result.abi).toEqual([{ type: "function", name: "transfer" }])
    })

    it("throws on non-verified contract", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: "0",
          message: "NOTOK",
          result: [],
        }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      await expect(provider.getSource("0xABC", 43114)).rejects.toThrow(
        "Contract source not available on Snowscan (Etherscan)"
      )
    })
  })

  describe("getSource without API key", () => {
    it("throws when no API key is set", async () => {
      vi.spyOn(apiKeys, "getEtherscanApiKey").mockReturnValue(undefined)

      await expect(provider.getSource("0xABC", 43114)).rejects.toThrow(
        "Etherscan API key required"
      )
    })
  })

  describe("explorerUrl", () => {
    it("returns correct URL for mainnet (43114)", () => {
      const url = provider.explorerUrl("0xABC", 43114)
      expect(url).toBe("https://snowscan.xyz/address/0xABC")
    })

    it("returns correct URL for fuji (43113)", () => {
      const url = provider.explorerUrl("0xABC", 43113)
      expect(url).toBe("https://testnet.snowscan.xyz/address/0xABC")
    })
  })
})
