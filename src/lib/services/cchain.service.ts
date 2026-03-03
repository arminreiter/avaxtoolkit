import { ethers } from "ethers"

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
]

export class CChainService {
  private static providers = new Map<string, ethers.JsonRpcProvider>()
  private static MAX_PROVIDERS = 10
  private static rawResponses: Record<string, unknown> = {}

  static getRawResponses() { return { ...CChainService.rawResponses } }
  static clearRawResponses() { CChainService.rawResponses = {} }

  static getProvider(rpcUrl: string, chainId?: number) {
    let provider = CChainService.providers.get(rpcUrl)
    if (!provider) {
      // Evict oldest entry if cache is full
      if (CChainService.providers.size >= CChainService.MAX_PROVIDERS) {
        const oldest = CChainService.providers.keys().next().value!
        const old = CChainService.providers.get(oldest)
        old?.destroy()
        CChainService.providers.delete(oldest)
      }
      // Use staticNetwork when chainId is known to skip _detectNetwork,
      // preventing infinite retry loops when the node is unreachable.
      if (chainId) {
        const network = ethers.Network.from(chainId)
        provider = new ethers.JsonRpcProvider(rpcUrl, network, { staticNetwork: network })
      } else {
        provider = new ethers.JsonRpcProvider(rpcUrl)
      }
      CChainService.providers.set(rpcUrl, provider)
    }
    return provider
  }

  /** Remove a cached provider (e.g. after a connection failure) */
  static destroyProvider(rpcUrl: string) {
    const provider = CChainService.providers.get(rpcUrl)
    if (provider) {
      provider.destroy()
      CChainService.providers.delete(rpcUrl)
    }
  }

  static async getBlock(rpcUrl: string, blockNumber: number | "latest") {
    const provider = CChainService.getProvider(rpcUrl)
    const blockParam = blockNumber === "latest" ? "latest" : "0x" + blockNumber.toString(16)
    const [block, raw] = await Promise.all([
      provider.getBlock(blockNumber),
      provider.send("eth_getBlockByNumber", [blockParam, false]),
    ])
    CChainService.rawResponses["eth_getBlockByNumber"] = raw
    return block
  }

  static async getBlockFull(rpcUrl: string, blockNumber: number) {
    const provider = CChainService.getProvider(rpcUrl)
    const blockParam = "0x" + blockNumber.toString(16)
    const [rawBlock, rawReceipts] = await Promise.all([
      provider.send("eth_getBlockByNumber", [blockParam, true]),
      provider.send("eth_getBlockReceipts", [blockParam]).catch(() => null),
    ])

    // Fallback: if eth_getBlockReceipts is unsupported, fetch individual receipts
    // Throttle to batches of 4 to avoid RPC rate limiting
    if (!rawReceipts && rawBlock?.transactions?.length > 0) {
      const txHashes: string[] = rawBlock.transactions.map((tx: Record<string, string>) => tx.hash)
      const allReceipts: Record<string, string>[] = []
      for (let i = 0; i < txHashes.length; i += 4) {
        const batch = txHashes.slice(i, i + 4)
        const results = await Promise.allSettled(
          batch.map((hash) => provider.send("eth_getTransactionReceipt", [hash]))
        )
        for (const r of results) {
          if (r.status === "fulfilled" && r.value !== null) {
            allReceipts.push(r.value)
          }
        }
      }
      return { rawBlock, rawReceipts: allReceipts.length > 0 ? allReceipts : null }
    }

    return { rawBlock, rawReceipts }
  }

  static async getTransaction(rpcUrl: string, txHash: string) {
    const provider = CChainService.getProvider(rpcUrl)
    const [tx, receipt, rawTx, rawReceipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
      provider.send("eth_getTransactionByHash", [txHash]),
      provider.send("eth_getTransactionReceipt", [txHash]),
    ])
    CChainService.rawResponses["eth_getTransactionByHash"] = rawTx
    CChainService.rawResponses["eth_getTransactionReceipt"] = rawReceipt
    return { tx, receipt }
  }

  static async getBalance(rpcUrl: string, address: string) {
    const provider = CChainService.getProvider(rpcUrl)
    const [balance, raw] = await Promise.all([
      provider.getBalance(address),
      provider.send("eth_getBalance", [address, "latest"]),
    ])
    CChainService.rawResponses["eth_getBalance"] = raw
    return {
      wei: balance.toString(),
      avax: ethers.formatEther(balance),
    }
  }

  static async getTokenInfo(rpcUrl: string, contractAddress: string) {
    const provider = CChainService.getProvider(rpcUrl)
    const contract = new ethers.Contract(contractAddress, ERC20_ABI, provider)
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
    ])
    const result = {
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: totalSupply.toString(),
    }
    CChainService.rawResponses["erc20_tokenInfo"] = result
    return result
  }

  static async getGasPrice(rpcUrl: string) {
    const provider = CChainService.getProvider(rpcUrl)
    const [feeData, rawGasPrice] = await Promise.all([
      provider.getFeeData(),
      provider.send("eth_gasPrice", []),
    ])
    CChainService.rawResponses["eth_gasPrice"] = rawGasPrice
    return {
      gasPrice: feeData.gasPrice?.toString() ?? "0",
      gasPriceGwei: feeData.gasPrice
        ? ethers.formatUnits(feeData.gasPrice, "gwei")
        : "0",
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
    }
  }

  static async getBlockNumber(rpcUrl: string) {
    const provider = CChainService.getProvider(rpcUrl)
    const [blockNumber, raw] = await Promise.all([
      provider.getBlockNumber(),
      provider.send("eth_blockNumber", []),
    ])
    CChainService.rawResponses["eth_blockNumber"] = raw
    return blockNumber
  }

  static async readContract(
    rpcUrl: string,
    contractAddress: string,
    abi: string[],
    method: string,
    args: unknown[] = [],
  ) {
    const provider = CChainService.getProvider(rpcUrl)
    const contract = new ethers.Contract(contractAddress, abi, provider)
    const fn = contract[method]
    if (typeof fn !== "function") {
      throw new Error(`Method "${method}" not found in contract ABI`)
    }
    return fn(...args)
  }
}
