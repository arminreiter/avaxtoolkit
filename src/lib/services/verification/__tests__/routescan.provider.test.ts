import { describe, it, expect, vi, beforeEach } from "vitest"
import { RoutescanProvider } from "../providers/routescan.provider"

vi.stubGlobal("fetch", vi.fn())

describe("RoutescanProvider", () => {
  let provider: RoutescanProvider

  beforeEach(() => {
    vi.restoreAllMocks()
    provider = new RoutescanProvider()
  })

  describe("checkVerification", () => {
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
        provider: "routescan",
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
        provider: "routescan",
        verified: false,
      })
    })

    it("returns verified: false on network error (fetch throws)", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("Network error"))

      await expect(provider.checkVerification("0xABC", 43114)).rejects.toThrow("Network error")
    })
  })

  describe("getSource", () => {
    it("parses double-brace standard JSON input correctly", async () => {
      const stdJsonInput = {
        sources: {
          "contracts/Token.sol": { content: "pragma solidity ^0.8.0; contract Token {}" },
          "contracts/IToken.sol": { content: "pragma solidity ^0.8.0; interface IToken {}" },
        },
      }
      const sourceCode = `{${JSON.stringify(stdJsonInput)}}`

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: "1",
          result: [
            {
              SourceCode: sourceCode,
              ContractName: "Token",
              CompilerVersion: "v0.8.20",
              ABI: '[{"type":"function","name":"transfer"}]',
            },
          ],
        }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      const result = await provider.getSource("0xABC", 43114)

      expect(result.provider).toBe("routescan")
      expect(result.files).toEqual({
        "contracts/Token.sol": "pragma solidity ^0.8.0; contract Token {}",
        "contracts/IToken.sol": "pragma solidity ^0.8.0; interface IToken {}",
      })
      expect(result.compilerVersion).toBe("v0.8.20")
      expect(result.abi).toEqual([{ type: "function", name: "transfer" }])
    })

    it("parses single-file source correctly (plain string)", async () => {
      const sourceCode = "pragma solidity ^0.8.0; contract Test { }"

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: "1",
          result: [
            {
              SourceCode: sourceCode,
              ContractName: "Test",
              CompilerVersion: "v0.8.20",
              ABI: "[]",
            },
          ],
        }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      const result = await provider.getSource("0xABC", 43114)

      expect(result.files).toEqual({
        "Test.sol": "pragma solidity ^0.8.0; contract Test { }",
      })
    })

    it("strips 0x prefix from ConstructorArguments", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: "1",
          result: [
            {
              SourceCode: "pragma solidity ^0.8.0; contract Test {}",
              ContractName: "Test",
              CompilerVersion: "v0.8.20",
              ABI: "[]",
              ConstructorArguments: "0x0000000000000000000000000000000000000000000000000000000000000064",
            },
          ],
        }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      const result = await provider.getSource("0xABC", 43114)

      expect(result.constructorArgs).toBe("0000000000000000000000000000000000000000000000000000000000000064")
    })

    it("handles ConstructorArguments without 0x prefix", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: "1",
          result: [
            {
              SourceCode: "pragma solidity ^0.8.0; contract Test {}",
              ContractName: "Test",
              CompilerVersion: "v0.8.20",
              ABI: "[]",
              ConstructorArguments: "0000000000000000000000000000000000000000000000000000000000000064",
            },
          ],
        }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      const result = await provider.getSource("0xABC", 43114)

      expect(result.constructorArgs).toBe("0000000000000000000000000000000000000000000000000000000000000064")
    })

    it("throws on non-verified contract (status '0')", async () => {
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
        "Contract source not available on Routescan"
      )
    })
  })

  describe("explorerUrl", () => {
    it("returns correct URL for mainnet (43114)", () => {
      const url = provider.explorerUrl("0xABC", 43114)
      expect(url).toBe("https://snowtrace.io/address/0xABC")
    })

    it("returns correct URL for fuji (43113)", () => {
      const url = provider.explorerUrl("0xABC", 43113)
      expect(url).toBe("https://testnet.snowtrace.io/address/0xABC")
    })

    it("returns correct URL for custom chains", () => {
      const url = provider.explorerUrl("0xABC", 99999)
      expect(url).toBe("https://routescan.io/address/0xABC?chainId=99999")
    })
  })
})
