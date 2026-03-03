import { SourcifyProvider } from "./sourcify.provider"
import type { VerificationResult, ContractSource, ABIEntry, CrossVerifyResult } from "../types"

/**
 * Avalanche Explorer uses sourcify.avax.network which only supports Sourcify v1 API,
 * not the v2 API used by sourcify.dev. We override check/getSource/submitVerification
 * to use v1 endpoints.
 */
export class AvalancheExplorerProvider extends SourcifyProvider {
  constructor() {
    super("avalanche-explorer", "Avalanche Explorer", "https://sourcify.avax.network")
  }

  explorerUrl(address: string, chainId: number): string {
    const base = chainId === 43113
      ? "https://subnets-test.avax.network"
      : "https://subnets.avax.network"
    return `${base}/c-chain/address/${address}?tab=code`
  }

  // sourcify.avax.network only supports Sourcify v1 API
  override async checkVerification(address: string, chainId: number): Promise<VerificationResult> {
    const url = `${this.baseUrl}/check-all-by-addresses?addresses=${address}&chainIds=${chainId}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    let response: Response
    try {
      response = await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
    if (!response.ok) {
      throw new Error(`${this.name} API error: ${response.status}`)
    }
    const json = await response.json()
    // Response: [{ address, chainIds: [{ chainId, status }] }]
    const entry = json?.[0]
    const chain = entry?.chainIds?.find((c: { chainId: string }) => c.chainId === String(chainId))
    if (!chain || (chain.status !== "perfect" && chain.status !== "partial")) {
      return { provider: this.id, verified: false }
    }
    return { provider: this.id, verified: true }
  }

  // sourcify.avax.network only supports Sourcify v1 API
  override async getSource(address: string, chainId: number): Promise<ContractSource> {
    const url = `${this.baseUrl}/files/any/${chainId}/${address}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    let response: Response
    try {
      response = await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
    if (!response.ok) {
      throw new Error(`${this.name} API error: ${response.status}`)
    }
    const json = await response.json()
    // Response: { status, files: [{ name, path, content }] }
    if (!json.files?.length) {
      throw new Error(`Contract source not available on ${this.name}`)
    }

    const files: Record<string, string> = {}
    let abi: ABIEntry[] | undefined
    let metadata: Record<string, unknown> | undefined
    let compilerVersion: string | undefined
    let language: string | undefined
    let compilerSettings: Record<string, unknown> | undefined

    for (const file of json.files as { name: string; content: string }[]) {
      if (file.name === "metadata.json") {
        try {
          const meta = JSON.parse(file.content)
          metadata = meta
          abi = meta.output?.abi
          compilerVersion = meta.compiler?.version
          language = meta.language
          compilerSettings = meta.settings
        } catch {
          // ignore malformed metadata
        }
      } else {
        files[file.name] = file.content
      }
    }

    return {
      provider: this.id,
      files,
      language,
      compilerVersion,
      compilerSettings,
      abi,
      metadata,
    }
  }

  // sourcify.avax.network/verify uses Sourcify v1 API — accepts files + metadata as JSON
  override async submitVerification(
    address: string,
    chainId: number,
    source: ContractSource,
  ): Promise<CrossVerifyResult> {
    let metadata = source.metadata

    // If source lacks metadata (e.g. came from Etherscan), fetch from Sourcify V2
    if (!metadata) {
      metadata = await this.fetchMetadataFromSourcify(address, chainId)
    }

    if (!metadata) {
      return {
        success: false,
        message: "Contract metadata not available — verify on Sourcify first, then retry",
      }
    }

    // Build the files object: source files + metadata.json
    const files: Record<string, string> = {}
    for (const [name, content] of Object.entries(source.files)) {
      files[name.endsWith(".sol") ? name : `${name}.sol`] = content
    }
    files["metadata.json"] = JSON.stringify(metadata)

    // Resolve chain-specific RPC URL and name required by the API
    const { rpcUrl, name } = this.getChainInfo(chainId)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          chain: String(chainId),
          files,
          rpcUrl,
          name,
          creatorTxHash: "",
          chosenContract: "0",
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    if (response.ok) {
      const json = await response.json()
      const result = json.result?.[0]
      if (result?.status === "perfect" || result?.status === "partial") {
        return { success: true, message: `Verified on ${this.name} (${result.status} match)` }
      }
      return { success: true, message: `Verified on ${this.name}` }
    }

    let errorMsg = `${this.name} API error: ${response.status}`
    try {
      const json = await response.json()
      errorMsg = json.error || json.message || errorMsg
    } catch {
      // Use default error message
    }
    return { success: false, message: errorMsg }
  }

  private getChainInfo(chainId: number): { rpcUrl: string; name: string } {
    if (chainId === 43113) {
      return { rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc", name: "Avalanche Fuji (C-Chain)" }
    }
    // Default to mainnet C-Chain for 43114 and any other chain
    return { rpcUrl: "https://api.avax.network/ext/bc/C/rpc", name: "Avalanche (C-Chain)" }
  }

  private async fetchMetadataFromSourcify(
    address: string,
    chainId: number,
  ): Promise<Record<string, unknown> | undefined> {
    const url = `https://sourcify.dev/server/v2/contract/${chainId}/${address}?fields=metadata`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) return undefined
      const json = await response.json()
      return json.metadata as Record<string, unknown> | undefined
    } catch {
      return undefined
    } finally {
      clearTimeout(timeoutId)
    }
  }
}
