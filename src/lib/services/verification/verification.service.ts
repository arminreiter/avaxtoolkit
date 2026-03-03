import type { VerificationProvider, VerificationResult, AggregatedVerification, ContractSource, ABIEntry, ProxyDetails, CrossVerifyResult } from "./types"
import { RoutescanProvider } from "./providers/routescan.provider"
import { SnowscanProvider } from "./providers/snowscan.provider"
import { SourcifyProvider } from "./providers/sourcify.provider"
import { AvalancheExplorerProvider } from "./providers/avalanche-explorer.provider"
import { detectProxy } from "./proxy-detection"

const providers: VerificationProvider[] = [
  new RoutescanProvider(),
  new SnowscanProvider(),
  new SourcifyProvider(),
  new AvalancheExplorerProvider(),
]

export class VerificationService {
  static getProviders(): VerificationProvider[] {
    return providers
  }

  static async checkAll(address: string, chainId: number, rpcUrl?: string): Promise<AggregatedVerification> {
    const { results, source, abi } = await this.checkProviders(address, chainId)

    // Proxy detection
    let proxy: ProxyDetails = { isProxy: false }

    if (rpcUrl) {
      try {
        const detected = await detectProxy(address, rpcUrl)
        if (detected.isProxy) {
          proxy = { ...detected }
        }
      } catch {
        // On-chain detection failed, fall through to API flag
      }
    }

    if (!proxy.isProxy) {
      const apiProxy = results.find(r => r.proxy && r.implementation)
      if (apiProxy) {
        proxy = {
          isProxy: true,
          standard: "Unknown",
          implementationAddress: apiProxy.implementation,
        }
      }
    }

    // If proxy detected, verify the implementation contract
    if (proxy.isProxy && proxy.implementationAddress) {
      const implCheck = await this.checkProviders(proxy.implementationAddress, chainId)
      proxy.implementationVerification = {
        results: implCheck.results,
        source: implCheck.source,
      }
      proxy.implementationAbi = implCheck.abi
    }

    return { address, chainId, results, source, abi, proxy }
  }

  private static async fetchConstructorArgs(address: string, chainId: number): Promise<string | undefined> {
    for (const provider of providers) {
      try {
        const source = await provider.getSource(address, chainId)
        if (source.constructorArgs) return source.constructorArgs
      } catch {
        // Try next provider
      }
    }
    return undefined
  }

  private static async checkProviders(address: string, chainId: number): Promise<{
    results: VerificationResult[]
    source: ContractSource | null
    abi: ABIEntry[] | null
  }> {
    const settled = await Promise.allSettled(
      providers.map(p => p.checkVerification(address, chainId))
    )

    const results = settled.map((r, i) => {
      if (r.status === "fulfilled") return r.value
      return {
        provider: providers[i].id,
        verified: false,
        unavailable: true,
        unavailableReason: r.reason instanceof Error ? r.reason.message : "Provider unavailable",
      }
    })

    let source: ContractSource | null = null
    let abi: ABIEntry[] | null = null
    const verifiedProvider = results.find(r => r.verified)
    if (verifiedProvider) {
      const provider = providers.find(p => p.id === verifiedProvider.provider)
      if (provider) {
        try {
          source = await provider.getSource(address, chainId)
          abi = source.abi ?? null
        } catch {
          for (const result of results) {
            if (result.verified && result.provider !== verifiedProvider.provider) {
              const fallback = providers.find(p => p.id === result.provider)
              if (fallback) {
                try {
                  source = await fallback.getSource(address, chainId)
                  abi = source.abi ?? null
                  break
                } catch {
                  // Continue to next
                }
              }
            }
          }
        }
      }
    }

    return { results, source, abi }
  }

  /**
   * Submit verification to a target provider using source from another verified provider.
   */
  static async crossVerify(
    address: string,
    chainId: number,
    targetProviderId: string,
    source: ContractSource,
    contractName?: string,
  ): Promise<CrossVerifyResult> {
    const provider = providers.find(p => p.id === targetProviderId)
    if (!provider) {
      return { success: false, message: `Unknown provider: ${targetProviderId}` }
    }
    if (!provider.submitVerification) {
      return { success: false, message: `${provider.name} does not support verification submission` }
    }

    // If source lacks constructor args, try to fetch them from Routescan
    let enrichedSource = source
    if (!source.constructorArgs) {
      const constructorArgs = await this.fetchConstructorArgs(address, chainId)
      if (constructorArgs) {
        enrichedSource = { ...source, constructorArgs }
      }
    }

    return provider.submitVerification(address, chainId, enrichedSource, contractName)
  }

  static getExplorerUrl(providerId: string, address: string, chainId: number): string {
    const provider = providers.find(p => p.id === providerId)
    return provider?.explorerUrl(address, chainId) ?? "#"
  }

}
