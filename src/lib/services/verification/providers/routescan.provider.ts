import { EtherscanProvider } from "./etherscan.provider"

export class RoutescanProvider extends EtherscanProvider {
  id = "routescan"
  name = "Routescan"

  protected getBaseUrl(chainId: number): string {
    const network = chainId === 43113 ? "testnet" : "mainnet"
    return `https://api.routescan.io/v2/network/${network}/evm/${chainId}/etherscan/api`
  }

  explorerUrl(address: string, chainId: number): string {
    if (chainId === 43114) return `https://snowtrace.io/address/${address}`
    if (chainId === 43113) return `https://testnet.snowtrace.io/address/${address}`
    return `https://routescan.io/address/${address}?chainId=${chainId}`
  }
}
