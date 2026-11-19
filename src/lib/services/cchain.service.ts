import { JsonRpcProvider, Network } from "ethers/providers"
import { Contract } from "ethers/contract"
import { formatEther, formatUnits } from "ethers/utils"
import type { TrackedToken } from "@/lib/models/token"

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
]

const WAVAX_ABI = [
  "function deposit() payable",
  "function withdraw(uint256 amount)",
]

const BLOCK_HASH_RE = /^0x[0-9a-fA-F]{64}$/

/** RPC method + param for a block number, "latest" or a block hash. */
function blockRpcParam(block: number | string) {
  if (typeof block === "string" && BLOCK_HASH_RE.test(block)) return { method: "eth_getBlockByHash", param: block }
  return { method: "eth_getBlockByNumber", param: block === "latest" ? "latest" : "0x" + Number(block).toString(16) }
}

export class CChainService {
  private static providers = new Map<string, JsonRpcProvider>()
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
        const network = Network.from(chainId)
        provider = new JsonRpcProvider(rpcUrl, network, { staticNetwork: network })
      } else {
        provider = new JsonRpcProvider(rpcUrl)
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

  /** Accepts a block number, "latest", or a 0x-prefixed 32-byte block hash. */
  static async getBlock(rpcUrl: string, blockNumberOrHash: number | string) {
    const provider = CChainService.getProvider(rpcUrl)
    const { method, param } = blockRpcParam(blockNumberOrHash)
    const [block, raw] = await Promise.all([
      provider.getBlock(param),
      provider.send(method, [param, false]),
    ])
    CChainService.rawResponses[method] = raw
    return block
  }

  /** Accepts a block number or a 0x-prefixed 32-byte block hash. */
  static async getBlockFull(rpcUrl: string, blockNumberOrHash: number | string) {
    const provider = CChainService.getProvider(rpcUrl)
    const { method, param } = blockRpcParam(blockNumberOrHash)
    const [rawBlock, rawReceipts] = await Promise.all([
      provider.send(method, [param, true]),
      provider.send("eth_getBlockReceipts", [param]).catch(() => null),
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

  /** `tx === null` → not found; `receipt === null` with a tx → pending. */
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
      avax: formatEther(balance),
    }
  }

  static async getTokenInfo(rpcUrl: string, contractAddress: string) {
    const provider = CChainService.getProvider(rpcUrl)
    const contract = new Contract(contractAddress, ERC20_ABI, provider)
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

  /**
   * balanceOf for many tokens. ethers' JsonRpcProvider coalesces these concurrent calls into one
   * JSON-RPC batch request, so this works on any network without a Multicall contract.
   * A failing token (not a contract, non-standard) yields null instead of failing the whole list.
   */
  static async getTokenBalances(rpcUrl: string, owner: string, tokens: string[]): Promise<(bigint | null)[]> {
    const provider = CChainService.getProvider(rpcUrl)
    return Promise.all(tokens.map(address =>
      (new Contract(address, ERC20_ABI, provider).balanceOf(owner) as Promise<bigint>).catch(() => null)
    ))
  }

  /** Build an unsigned ERC-20 transfer (to = token contract, data = transfer calldata). */
  static encodeTokenTransfer(token: string, to: string, amount: bigint) {
    const contract = new Contract(token, ERC20_ABI)
    return { to: token, data: contract.interface.encodeFunctionData("transfer", [to, amount]) }
  }

  /** Wrap AVAX: WAVAX.deposit() with the amount as value. */
  static encodeWrap(wavax: string, amount: bigint) {
    const contract = new Contract(wavax, WAVAX_ABI)
    return { to: wavax, value: amount, data: contract.interface.encodeFunctionData("deposit") }
  }

  /** Unwrap WAVAX: WAVAX.withdraw(amount). */
  static encodeUnwrap(wavax: string, amount: bigint) {
    const contract = new Contract(wavax, WAVAX_ABI)
    return { to: wavax, data: contract.interface.encodeFunctionData("withdraw", [amount]) }
  }

  /**
   * Find ERC-20 tokens an address has interacted with, via Routescan's Etherscan-compatible
   * API (proxied, see vercel.json). Mainnet/Fuji only — plain RPC cannot enumerate holdings.
   */
  static async discoverTokens(chainId: number, address: string): Promise<TrackedToken[]> {
    const network = chainId === 43113 ? "testnet" : "mainnet"
    const params = new URLSearchParams({
      module: "account", action: "tokentx", address, sort: "desc", page: "1", offset: "1000",
    })
    const res = await fetch(`/api/proxy/routescan/v2/network/${network}/evm/${chainId}/etherscan/api?${params}`)
    if (!res.ok) throw new Error(`Routescan request failed (HTTP ${res.status})`)
    const body = await res.json() as { result: unknown }
    // Etherscan-style APIs return an error string in `result` (e.g. rate limits)
    if (!Array.isArray(body.result)) throw new Error(typeof body.result === "string" ? body.result : "Unexpected Routescan response")
    const byAddress = new Map<string, TrackedToken>()
    for (const tx of body.result as Record<string, string>[]) {
      const key = tx.contractAddress?.toLowerCase()
      if (!key || byAddress.has(key)) continue
      byAddress.set(key, {
        address: tx.contractAddress,
        symbol: tx.tokenSymbol || "???",
        name: tx.tokenName || "",
        decimals: Number(tx.tokenDecimal) || 0,
      })
    }
    return [...byAddress.values()]
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
        ? formatUnits(feeData.gasPrice, "gwei")
        : "0",
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
    }
  }

  /** Latest block's baseFeePerGas, or null if the chain has no EIP-1559 base fee. */
  static async getBaseFee(rpcUrl: string): Promise<bigint | null> {
    const block = await CChainService.getProvider(rpcUrl).getBlock("latest")
    return block?.baseFeePerGas ?? null
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
    const contract = new Contract(contractAddress, abi, provider)
    const fn = contract[method]
    if (typeof fn !== "function") {
      throw new Error(`Method "${method}" not found in contract ABI`)
    }
    return fn(...args)
  }
}
