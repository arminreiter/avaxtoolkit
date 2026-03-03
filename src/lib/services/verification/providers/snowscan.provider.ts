import { EtherscanProvider } from "./etherscan.provider"
import type { VerificationResult, ContractSource, CrossVerifyResult } from "../types"
import { getEtherscanApiKey } from "../api-keys"

/**
 * Etherscan V2 provider — replaces the deprecated Snowscan V1 API.
 * Uses the unified Etherscan V2 endpoint with chainid parameter.
 * Requires a free API key from etherscan.io.
 */
export class SnowscanProvider extends EtherscanProvider {
  id = "etherscan"
  name = "Snowscan (Etherscan)"

  protected getBaseUrl(chainId: number): string {
    const apiKey = getEtherscanApiKey()
    if (!apiKey) throw new Error("Etherscan API key required")
    return `/api/proxy/etherscan/v2/api?chainid=${chainId}&apikey=${apiKey}`
  }

  explorerUrl(address: string, chainId: number): string {
    if (chainId === 43113) return `https://testnet.snowscan.xyz/address/${address}`
    return `https://snowscan.xyz/address/${address}`
  }

  async checkVerification(address: string, chainId: number): Promise<VerificationResult> {
    const apiKey = getEtherscanApiKey()
    if (!apiKey) {
      return {
        provider: this.id,
        verified: false,
        unavailable: true,
        unavailableReason: "Etherscan API key required — add one in Settings",
      }
    }
    return super.checkVerification(address, chainId)
  }

  async getSource(address: string, chainId: number): Promise<ContractSource> {
    const apiKey = getEtherscanApiKey()
    if (!apiKey) {
      throw new Error("Etherscan API key required")
    }
    return super.getSource(address, chainId)
  }

  async submitVerification(
    address: string,
    chainId: number,
    source: ContractSource,
    contractName?: string,
  ): Promise<CrossVerifyResult> {
    const apiKey = getEtherscanApiKey()
    if (!apiKey) {
      return { success: false, message: "Etherscan API key required — add one in Settings" }
    }
    return super.submitVerification(address, chainId, source, contractName)
  }
}
