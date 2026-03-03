import { RpcService } from "./rpc.service"
import type { Validator, Subnet, Blockchain } from "@/lib/models/avalanche"

function pChainUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/ext/bc/P`
}

function xChainUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/ext/bc/X`
}

function infoUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/ext/info`
}

function healthUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/+$/, "")}/ext/health`
}

export class AvalancheService {
  // --- Validators ---

  static async getValidators(baseUrl: string, subnetID?: string): Promise<Validator[]> {
    const params: Record<string, unknown> = {}
    if (subnetID) params.subnetID = subnetID
    const result = await RpcService.call<{ validators: Validator[] }>(
      pChainUrl(baseUrl),
      "platform.getCurrentValidators",
      params,
    )
    return result.validators
  }

  static async getValidatorByNodeId(baseUrl: string, nodeId: string): Promise<Validator | null> {
    const result = await RpcService.call<{ validators: Validator[] }>(
      pChainUrl(baseUrl),
      "platform.getCurrentValidators",
      { nodeIDs: [nodeId] },
    )
    return result.validators[0] ?? null
  }

  static async getValidatorsAt(
    baseUrl: string,
    height: number | "proposed",
    subnetID?: string,
  ) {
    const params: Record<string, unknown> = { height }
    if (subnetID) params.subnetID = subnetID
    return RpcService.call<Record<string, unknown>>(
      pChainUrl(baseUrl),
      "platform.getValidatorsAt",
      params,
    )
  }

  // --- Staking ---

  static async getStake(baseUrl: string, addresses: string[]) {
    return RpcService.call<{ staked: string; stakedOutputs: string[] }>(
      pChainUrl(baseUrl),
      "platform.getStake",
      { addresses },
    )
  }

  static async getMinStake(baseUrl: string, subnetID?: string) {
    const params: Record<string, unknown> = {}
    if (subnetID) params.subnetID = subnetID
    return RpcService.call<{
      minValidatorStake: string
      minDelegatorStake: string
    }>(pChainUrl(baseUrl), "platform.getMinStake", params)
  }

  static async getCurrentSupply(baseUrl: string, subnetID?: string) {
    const params: Record<string, unknown> = {}
    if (subnetID) params.subnetID = subnetID
    return RpcService.call<{ supply: string }>(
      pChainUrl(baseUrl),
      "platform.getCurrentSupply",
      params,
    )
  }

  // --- L1s (API still uses "subnet" naming) ---

  static async getSubnets(baseUrl: string, ids?: string[]): Promise<Subnet[]> {
    const params: Record<string, unknown> = {}
    if (ids) params.ids = ids
    const result = await RpcService.call<{ subnets: Subnet[] }>(
      pChainUrl(baseUrl),
      "platform.getSubnets",
      params,
    )
    return result.subnets
  }

  static async getSubnetValidators(baseUrl: string, subnetID: string): Promise<Validator[]> {
    return AvalancheService.getValidators(baseUrl, subnetID)
  }

  static async getBlockchains(baseUrl: string): Promise<Blockchain[]> {
    const result = await RpcService.call<{ blockchains: Blockchain[] }>(
      pChainUrl(baseUrl),
      "platform.getBlockchains",
      {},
    )
    return result.blockchains
  }

  // --- P-Chain info ---

  static async getPChainHeight(baseUrl: string) {
    return RpcService.call<{ height: string }>(
      pChainUrl(baseUrl),
      "platform.getHeight",
      {},
    )
  }

  static async getStakingAssetID(baseUrl: string) {
    return RpcService.call<{ assetID: string }>(
      pChainUrl(baseUrl),
      "platform.getStakingAssetID",
      {},
    )
  }

  // --- UTXOs ---

  static async getUTXOs(
    baseUrl: string,
    addresses: string[],
    limit?: number,
    sourceChain?: string,
  ) {
    const params: Record<string, unknown> = { addresses }
    if (limit) params.limit = limit
    if (sourceChain) params.sourceChain = sourceChain
    return RpcService.call<{
      numFetched: string
      utxos: string[]
      endIndex: { address: string; utxo: string }
    }>(pChainUrl(baseUrl), "platform.getUTXOs", params)
  }

  static async getRewardUTXOs(baseUrl: string, txID: string) {
    return RpcService.call<{
      numFetched: string
      utxos: string[]
    }>(pChainUrl(baseUrl), "platform.getRewardUTXOs", { txID })
  }

  // --- X-Chain ---

  static async getXChainBalances(baseUrl: string, address: string) {
    const result = await RpcService.call<{
      balances: { asset: string; balance: string }[]
    }>(xChainUrl(baseUrl), "avm.getAllBalances", { address })
    return result.balances
  }

  // --- Node info ---

  static async getNodeUptime(baseUrl: string, subnetID?: string) {
    const params: Record<string, unknown> = {}
    if (subnetID) params.subnetID = subnetID
    return RpcService.call<{
      rewardingStakePercentage: string
      weightedAveragePercentage: string
    }>(infoUrl(baseUrl), "info.uptime", params)
  }

  static async getNodeId(baseUrl: string) {
    return RpcService.call<{ nodeID: string; nodePOP: unknown }>(
      infoUrl(baseUrl),
      "info.getNodeID",
      {},
    )
  }

  static async getPeers(baseUrl: string) {
    return RpcService.call<{
      numPeers: string
      peers: { ip: string; publicIP: string; nodeID: string; version: string; lastSent: string; lastReceived: string }[]
    }>(infoUrl(baseUrl), "info.peers", {})
  }

  static async getNodeVersion(baseUrl: string) {
    return RpcService.call<{
      version: string
      databaseVersion: string
      gitCommit: string
      vmVersions: Record<string, string>
    }>(infoUrl(baseUrl), "info.getNodeVersion", {})
  }

  static async isBootstrapped(baseUrl: string, chain: string) {
    return RpcService.call<{ isBootstrapped: boolean }>(
      infoUrl(baseUrl),
      "info.isBootstrapped",
      { chain },
    )
  }

  static async getNetworkID(baseUrl: string) {
    return RpcService.call<{ networkID: string }>(
      infoUrl(baseUrl),
      "info.getNetworkID",
      {},
    )
  }

  static async getNetworkName(baseUrl: string) {
    return RpcService.call<{ networkName: string }>(
      infoUrl(baseUrl),
      "info.getNetworkName",
      {},
    )
  }

  static async getNodeIP(baseUrl: string) {
    return RpcService.call<{ ip: string }>(
      infoUrl(baseUrl),
      "info.getNodeIP",
      {},
    )
  }

  static async getVMs(baseUrl: string) {
    return RpcService.call<{ vms: Record<string, string[]> }>(
      infoUrl(baseUrl),
      "info.getVMs",
      {},
    )
  }

  static async getUpgrades(baseUrl: string) {
    return RpcService.call<Record<string, unknown>>(
      infoUrl(baseUrl),
      "info.upgrades",
      {},
    )
  }

  static async getACPs(baseUrl: string) {
    return RpcService.call<Record<string, unknown>>(
      infoUrl(baseUrl),
      "info.acps",
      {},
    )
  }

  // --- Health API ---

  static async healthCheck(baseUrl: string, tags?: string[]) {
    const params: Record<string, unknown> = {}
    if (tags && tags.length > 0) params.tags = tags
    return RpcService.call<{
      healthy: boolean
      checks: Record<string, unknown>
    }>(healthUrl(baseUrl), "health.health", params)
  }

  static async healthReadiness(baseUrl: string, tags?: string[]) {
    const params: Record<string, unknown> = {}
    if (tags && tags.length > 0) params.tags = tags
    return RpcService.call<{
      healthy: boolean
      checks: Record<string, unknown>
    }>(healthUrl(baseUrl), "health.readiness", params)
  }

  static async healthLiveness(baseUrl: string) {
    return RpcService.call<{ healthy: boolean }>(
      healthUrl(baseUrl),
      "health.liveness",
      {},
    )
  }

  // --- P-Chain aggregate stats ---

  static async getTotalStake(baseUrl: string, subnetID?: string) {
    const params: Record<string, unknown> = {}
    if (subnetID) params.subnetID = subnetID
    return RpcService.call<{ stake: string; weight: string }>(
      pChainUrl(baseUrl),
      "platform.getTotalStake",
      params,
    )
  }

  static async getPChainTimestamp(baseUrl: string) {
    return RpcService.call<{ timestamp: string }>(
      pChainUrl(baseUrl),
      "platform.getTimestamp",
      {},
    )
  }

  static async getBlockchainStatus(baseUrl: string, blockchainID: string) {
    return RpcService.call<{ status: string }>(
      pChainUrl(baseUrl),
      "platform.getBlockchainStatus",
      { blockchainID },
    )
  }
}
