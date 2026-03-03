import { describe, it, expect, vi, beforeEach } from "vitest"
import { SourcifyProvider } from "../providers/sourcify.provider"

vi.stubGlobal("fetch", vi.fn())

describe("SourcifyProvider", () => {
  let provider: SourcifyProvider

  beforeEach(() => {
    vi.restoreAllMocks()
    provider = new SourcifyProvider()
  })

  describe("checkVerification", () => {
    it("returns verified: true when API returns 200 with match field set", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          match: "perfect",
        }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      const result = await provider.checkVerification("0xABC", 43114)

      expect(result).toEqual({
        provider: "sourcify",
        verified: true,
        contractName: undefined,
      })
    })

    it("returns verified: false on 404 response", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: vi.fn(),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      const result = await provider.checkVerification("0xABC", 43114)

      expect(result).toEqual({
        provider: "sourcify",
        verified: false,
      })
    })

    it("throws on non-ok non-404 response", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: vi.fn(),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      await expect(provider.checkVerification("0xABC", 43114)).rejects.toThrow(
        "Sourcify API error: 500"
      )
    })
  })

  describe("getSource", () => {
    it("returns files from sources field", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          sources: {
            "contracts/Token.sol": { content: "pragma solidity ^0.8.0; contract Token {}" },
            "contracts/IToken.sol": { content: "pragma solidity ^0.8.0; interface IToken {}" },
          },
          abi: [{ type: "function", name: "transfer" }],
          compilation: {
            language: "Solidity",
            compiler: { version: "0.8.20" },
            settings: { optimizer: { enabled: true } },
          },
          metadata: { compiler: { version: "0.8.20" } },
          stdJsonInput: { language: "Solidity" },
        }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      const result = await provider.getSource("0xABC", 43114)

      expect(result.provider).toBe("sourcify")
      expect(result.files).toEqual({
        "contracts/Token.sol": "pragma solidity ^0.8.0; contract Token {}",
        "contracts/IToken.sol": "pragma solidity ^0.8.0; interface IToken {}",
      })
      expect(result.abi).toEqual([{ type: "function", name: "transfer" }])
      expect(result.language).toBe("Solidity")
      expect(result.compilerVersion).toBe("0.8.20")
      expect(result.compilerSettings).toEqual({ optimizer: { enabled: true } })
      expect(result.metadata).toEqual({ compiler: { version: "0.8.20" } })
      expect(result.stdJsonInput).toEqual({ language: "Solidity" })
    })

    it("throws on non-ok response", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response)

      await expect(provider.getSource("0xABC", 43114)).rejects.toThrow(
        "Sourcify API error: 500"
      )
    })
  })

  describe("submitVerification", () => {
    it("uses v2 verify endpoint with correct URL and body", async () => {
      let capturedUrl = ""
      let capturedBody = ""
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.includes("/v2/verify/") && init?.method === "POST") {
          capturedUrl = url
          capturedBody = init?.body as string
          return {
            ok: false,
            status: 202,
            json: async () => ({ verificationId: "job-123" }),
          } as unknown as Response
        }
        // Poll response — return completed job
        return {
          ok: true,
          json: async () => ({ isJobCompleted: true, contract: { match: "perfect" } }),
        } as unknown as Response
      })

      const result = await provider.submitVerification("0xABC", 43114, {
        provider: "routescan",
        files: { "Test.sol": "pragma solidity ^0.8.0; contract Test {}" },
        compilerVersion: "v0.8.20",
      }, "Test")

      expect(capturedUrl).toBe("https://sourcify.dev/server/v2/verify/43114/0xABC")
      const body = JSON.parse(capturedBody)
      expect(body.stdJsonInput).toBeDefined()
      expect(body.compilerVersion).toBe("0.8.20")
      expect(body.contractIdentifier).toBe("Test.sol:Test")
      expect(result.success).toBe(true)
    })

    it("returns success for 409 (already verified)", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({ message: "Already verified" }),
      } as unknown as Response)

      const result = await provider.submitVerification("0xABC", 43114, {
        provider: "routescan",
        files: { "Test.sol": "pragma solidity ^0.8.0; contract Test {}" },
        compilerVersion: "0.8.20",
      })

      expect(result.success).toBe(true)
      expect(result.message).toContain("Already verified")
    })

    it("returns error message on 400 response", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ message: "Invalid compiler version" }),
      } as unknown as Response)

      const result = await provider.submitVerification("0xABC", 43114, {
        provider: "routescan",
        files: { "Test.sol": "pragma solidity ^0.8.0; contract Test {}" },
        compilerVersion: "0.8.20",
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe("Invalid compiler version")
    })
  })

  describe("explorerUrl", () => {
    it("returns correct URL", () => {
      const url = provider.explorerUrl("0xABC", 43114)
      expect(url).toBe("https://sourcify.dev/#/lookup/0xABC?chainId=43114")
    })
  })
})
