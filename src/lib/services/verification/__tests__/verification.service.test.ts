import { describe, it, expect, vi, beforeEach } from "vitest"
import { VerificationService } from "../verification.service"
import type { ContractSource } from "../types"
import * as apiKeys from "../api-keys"

vi.stubGlobal("fetch", vi.fn())

function etherscanVerifiedResponse(source?: string) {
  return {
    ok: true,
    json: async () => ({
      status: "1",
      result: [
        {
          SourceCode: source ?? "pragma solidity ^0.8.0; contract Test {}",
          ContractName: "Test",
          CompilerVersion: "v0.8.20",
          OptimizationUsed: "1",
          Runs: "200",
          EVMVersion: "paris",
          LicenseType: "MIT",
          Proxy: "0",
          Implementation: "",
          ABI: '[{"type":"function","name":"transfer"}]',
        },
      ],
    }),
  } as unknown as Response
}

function etherscanNotVerifiedResponse() {
  return {
    ok: true,
    json: async () => ({ status: "0", result: [{ SourceCode: "" }] }),
  } as unknown as Response
}

function sourcifyVerifiedResponse(hasFields: boolean) {
  if (hasFields) {
    return {
      ok: true,
      json: async () => ({
        match: "perfect",
        sources: {
          "contracts/Test.sol": { content: "pragma solidity ^0.8.0; contract Test {}" },
        },
        abi: [{ type: "function", name: "balanceOf" }],
        compilation: {
          language: "Solidity",
          compiler: { version: "0.8.20" },
        },
      }),
    } as unknown as Response
  }
  return {
    ok: true,
    json: async () => ({ match: "perfect" }),
  } as unknown as Response
}

function sourcifyNotVerifiedResponse() {
  return {
    ok: false,
    status: 404,
    json: async () => ({}),
  } as unknown as Response
}

// Helper to create mock fetch responses for all providers
function mockFetchForProviders(options: {
  routescan?: { verified: boolean; source?: string }
  etherscan?: { verified: boolean; source?: string }
  sourcify?: { verified: boolean }
  avalancheExplorer?: { verified: boolean }
}) {
  const {
    routescan = { verified: false },
    etherscan = { verified: false },
    sourcify = { verified: false },
    avalancheExplorer = { verified: false },
  } = options

  vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString()

    // Routescan API calls
    if (url.includes("routescan.io")) {
      return routescan.verified
        ? etherscanVerifiedResponse(routescan.source)
        : etherscanNotVerifiedResponse()
    }

    // Etherscan V2 API calls
    if (url.includes("api.etherscan.io")) {
      return etherscan.verified
        ? etherscanVerifiedResponse(etherscan.source)
        : etherscanNotVerifiedResponse()
    }

    // Sourcify API calls (public sourcify.dev)
    if (url.includes("sourcify.dev")) {
      if (sourcify.verified) {
        return sourcifyVerifiedResponse(url.includes("fields="))
      }
      return sourcifyNotVerifiedResponse()
    }

    // Avalanche Explorer API calls (sourcify.avax.network) — uses Sourcify V1 API
    if (url.includes("sourcify.avax.network")) {
      if (url.includes("check-all-by-addresses")) {
        if (avalancheExplorer.verified) {
          return {
            ok: true,
            json: async () => ([{ address: "0x", chainIds: [{ chainId: "43114", status: "perfect" }] }]),
          } as unknown as Response
        }
        return { ok: true, json: async () => ([]) } as unknown as Response
      }
      if (url.includes("/files/any/")) {
        if (avalancheExplorer.verified) {
          return {
            ok: true,
            json: async () => ({
              status: "full",
              files: [
                { name: "metadata.json", content: JSON.stringify({ output: { abi: [{ type: "function", name: "transfer" }] }, compiler: { version: "0.8.20" }, language: "Solidity" }) },
                { name: "Test.sol", content: "pragma solidity ^0.8.0; contract Test {}" },
              ],
            }),
          } as unknown as Response
        }
        return { ok: false, status: 404 } as unknown as Response
      }
      return { ok: false, status: 404 } as unknown as Response
    }

    return { ok: false, status: 404 } as unknown as Response
  })
}

describe("VerificationService", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Mock API key so etherscan provider is active
    vi.spyOn(apiKeys, "getEtherscanApiKey").mockReturnValue("test-key")
  })

  describe("checkAll", () => {
    it("returns aggregated results from all providers", async () => {
      mockFetchForProviders({
        routescan: { verified: true },
        etherscan: { verified: true },
        sourcify: { verified: true },
        avalancheExplorer: { verified: true },
      })

      const result = await VerificationService.checkAll("0xABC", 43114)

      expect(result.address).toBe("0xABC")
      expect(result.chainId).toBe(43114)
      expect(result.results).toHaveLength(4)
      expect(result.results[0].provider).toBe("routescan")
      expect(result.results[0].verified).toBe(true)
      expect(result.results[1].provider).toBe("etherscan")
      expect(result.results[1].verified).toBe(true)
      expect(result.results[2].provider).toBe("sourcify")
      expect(result.results[2].verified).toBe(true)
      expect(result.results[3].provider).toBe("avalanche-explorer")
      expect(result.results[3].verified).toBe(true)
      // Source should be fetched from first verified provider (routescan)
      expect(result.source).not.toBeNull()
      expect(result.source!.provider).toBe("routescan")
      expect(result.abi).not.toBeNull()
    })

    it("handles one provider failing gracefully (returns verified: false for that provider)", async () => {
      // Make routescan fail (fetch throws) but sourcify succeed
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString()

        if (url.includes("routescan.io")) {
          throw new Error("Network error")
        }

        if (url.includes("sourcify.dev")) {
          return sourcifyVerifiedResponse(url.includes("fields="))
        }

        return { ok: false, status: 404 } as unknown as Response
      })

      const result = await VerificationService.checkAll("0xABC", 43114)

      expect(result.results).toHaveLength(4)
      // Routescan should be marked as not verified due to the rejection
      expect(result.results[0].provider).toBe("routescan")
      expect(result.results[0].verified).toBe(false)
      // Etherscan should be not verified (404 fallback from etherscan.io mock)
      expect(result.results[1].provider).toBe("etherscan")
      expect(result.results[1].verified).toBe(false)
      // Sourcify should be verified
      expect(result.results[2].provider).toBe("sourcify")
      expect(result.results[2].verified).toBe(true)
      // Avalanche Explorer should be not verified (404 fallback)
      expect(result.results[3].provider).toBe("avalanche-explorer")
      expect(result.results[3].verified).toBe(false)
      // Source should be fetched from sourcify (the only verified provider)
      expect(result.source).not.toBeNull()
      expect(result.source!.provider).toBe("sourcify")
    })

    it("etherscan returns unavailable when no API key", async () => {
      vi.spyOn(apiKeys, "getEtherscanApiKey").mockReturnValue(undefined)
      mockFetchForProviders({
        routescan: { verified: true },
        sourcify: { verified: false },
      })

      const result = await VerificationService.checkAll("0xABC", 43114)

      const etherscanResult = result.results.find(r => r.provider === "etherscan")
      expect(etherscanResult).toBeDefined()
      expect(etherscanResult!.verified).toBe(false)
      expect(etherscanResult!.unavailable).toBe(true)
    })

    it("fetches source from first verified provider", async () => {
      mockFetchForProviders({
        routescan: { verified: true },
        sourcify: { verified: false },
      })

      const result = await VerificationService.checkAll("0xABC", 43114)

      expect(result.source).not.toBeNull()
      expect(result.source!.provider).toBe("routescan")
      expect(result.source!.files).toHaveProperty("Test.sol")
    })
  })

  describe("getExplorerUrl", () => {
    it("returns correct URL for routescan provider", () => {
      const url = VerificationService.getExplorerUrl("routescan", "0xABC", 43114)
      expect(url).toBe("https://snowtrace.io/address/0xABC")
    })

    it("returns correct URL for etherscan provider", () => {
      const url = VerificationService.getExplorerUrl("etherscan", "0xABC", 43114)
      expect(url).toBe("https://snowscan.xyz/address/0xABC")
    })

    it("returns correct URL for sourcify provider", () => {
      const url = VerificationService.getExplorerUrl("sourcify", "0xABC", 43114)
      expect(url).toBe("https://sourcify.dev/#/lookup/0xABC?chainId=43114")
    })

    it("returns correct URL for avalanche-explorer provider", () => {
      const url = VerificationService.getExplorerUrl("avalanche-explorer", "0xABC", 43114)
      expect(url).toBe("https://subnets.avax.network/c-chain/address/0xABC?tab=code")
    })

    it("returns '#' for unknown provider", () => {
      const url = VerificationService.getExplorerUrl("unknown", "0xABC", 43114)
      expect(url).toBe("#")
    })
  })

  describe("fetchConstructorArgs", () => {
    it("fetches constructor args from routescan", async () => {
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString()
        if (url.includes("routescan.io")) {
          return {
            ok: true,
            json: async () => ({
              status: "1",
              result: [{
                SourceCode: "pragma solidity ^0.8.0; contract Test {}",
                ContractName: "Test",
                CompilerVersion: "v0.8.20",
                ABI: "[]",
                ConstructorArguments: "00000000000000000000000000000000000000000000000000000000000000640000000000000000000000001234567890abcdef1234567890abcdef12345678",
              }],
            }),
          } as unknown as Response
        }
        return { ok: false, status: 404 } as unknown as Response
      })

      const args = await (VerificationService as unknown as Record<string, (...args: unknown[]) => unknown>).fetchConstructorArgs("0xABC", 43114)
      expect(args).toBe("00000000000000000000000000000000000000000000000000000000000000640000000000000000000000001234567890abcdef1234567890abcdef12345678")
    })

    it("returns undefined when no constructor args available", async () => {
      vi.mocked(fetch).mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({
            status: "1",
            result: [{
              SourceCode: "pragma solidity ^0.8.0; contract Test {}",
              ContractName: "Test",
              CompilerVersion: "v0.8.20",
              ABI: "[]",
              ConstructorArguments: "",
            }],
          }),
        } as unknown as Response
      })

      const args = await (VerificationService as unknown as Record<string, (...args: unknown[]) => unknown>).fetchConstructorArgs("0xABC", 43114)
      expect(args).toBeUndefined()
    })
  })

  describe("crossVerify constructor args", () => {
    it("fetches constructor args from routescan when source lacks them", async () => {
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString()

        // Routescan getsourcecode — return constructor args
        if (url.includes("routescan.io") && url.includes("getsourcecode") && (!init || !init.method || init.method === "GET")) {
          return {
            ok: true,
            json: async () => ({
              status: "1",
              result: [{
                SourceCode: "pragma solidity ^0.8.0; contract Test {}",
                ContractName: "Test",
                CompilerVersion: "v0.8.20",
                ABI: "[]",
                ConstructorArguments: "0000000000000000000000000000000000000000000000000000000000000064",
              }],
            }),
          } as unknown as Response
        }

        // Routescan verifysourcecode POST
        if (url.includes("routescan.io") && init?.method === "POST") {
          const body = init?.body?.toString() ?? ""
          expect(body).toContain("constructorArguements=0000000000000000000000000000000000000000000000000000000000000064")
          return {
            ok: true,
            json: async () => ({ status: "1", result: "guid-123" }),
          } as unknown as Response
        }

        // Routescan checkverifystatus
        if (url.includes("routescan.io") && url.includes("checkverifystatus")) {
          return {
            ok: true,
            json: async () => ({ status: "1", result: "Pass - Verified" }),
          } as unknown as Response
        }

        return { ok: false, status: 404 } as unknown as Response
      })

      const source: ContractSource = {
        provider: "sourcify",
        files: { "Test.sol": "pragma solidity ^0.8.0; contract Test {}" },
        compilerVersion: "v0.8.20",
      }

      const result = await VerificationService.crossVerify("0xABC", 43114, "routescan", source, "Test")
      expect(result.success).toBe(true)
      // Original source object should not be mutated
      expect(source.constructorArgs).toBeUndefined()
    })
  })

  describe("implementation verification", () => {
    it("includes implementation verification results for proxy contracts", async () => {
      vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString()

        if (url.includes("routescan.io") && url.includes("0xPROXY")) {
          return {
            ok: true,
            json: async () => ({
              status: "1",
              result: [{
                SourceCode: "pragma solidity ^0.8.0; contract Proxy {}",
                ContractName: "Proxy",
                CompilerVersion: "v0.8.20",
                OptimizationUsed: "1",
                Runs: "200",
                EVMVersion: "paris",
                LicenseType: "MIT",
                Proxy: "1",
                Implementation: "0xIMPL",
                ABI: "[]",
              }],
            }),
          } as unknown as Response
        }

        if (url.includes("routescan.io") && url.includes("0xIMPL")) {
          return {
            ok: true,
            json: async () => ({
              status: "1",
              result: [{
                SourceCode: "pragma solidity ^0.8.0; contract Impl {}",
                ContractName: "Impl",
                CompilerVersion: "v0.8.20",
                OptimizationUsed: "1",
                Runs: "200",
                EVMVersion: "paris",
                LicenseType: "MIT",
                Proxy: "0",
                Implementation: "",
                ABI: '[{"type":"function","name":"balanceOf"}]',
              }],
            }),
          } as unknown as Response
        }

        if (url.includes("sourcify.dev") && url.includes("0xIMPL")) {
          if (url.includes("fields=")) {
            return {
              ok: true,
              json: async () => ({
                match: "perfect",
                sources: { "contracts/Impl.sol": { content: "pragma solidity ^0.8.0; contract Impl {}" } },
                abi: [{ type: "function", name: "balanceOf" }],
                compilation: { language: "Solidity", compiler: { version: "0.8.20" } },
              }),
            } as unknown as Response
          }
          return {
            ok: true,
            json: async () => ({ match: "perfect" }),
          } as unknown as Response
        }

        // Everything else not verified
        if (url.includes("sourcify.dev") || url.includes("sourcify.avax.network")) {
          return { ok: false, status: 404 } as unknown as Response
        }
        if (url.includes("api.etherscan.io")) {
          return {
            ok: true,
            json: async () => ({ status: "0", result: [{ SourceCode: "" }] }),
          } as unknown as Response
        }

        return { ok: false, status: 404 } as unknown as Response
      })

      const result = await VerificationService.checkAll("0xPROXY", 43114)

      expect(result.proxy.isProxy).toBe(true)
      expect(result.proxy.implementationAddress).toBe("0xIMPL")
      expect(result.proxy.implementationVerification).toBeDefined()
      expect(result.proxy.implementationVerification!.results).toHaveLength(4)

      const implRoutescan = result.proxy.implementationVerification!.results.find(r => r.provider === "routescan")
      expect(implRoutescan?.verified).toBe(true)

      const implSourcify = result.proxy.implementationVerification!.results.find(r => r.provider === "sourcify")
      expect(implSourcify?.verified).toBe(true)

      expect(result.proxy.implementationVerification!.source).not.toBeNull()
      expect(result.proxy.implementationAbi).not.toBeNull()
    })
  })
})
