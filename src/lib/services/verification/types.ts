export interface VerificationResult {
  provider: string
  verified: boolean
  unavailable?: boolean
  unavailableReason?: string
  contractName?: string
  compilerVersion?: string
  optimizationUsed?: boolean
  runs?: number
  evmVersion?: string
  license?: string
  proxy?: boolean
  implementation?: string
}

export interface ContractSource {
  provider: string
  files: Record<string, string>
  language?: string
  compilerVersion?: string
  compilerSettings?: Record<string, unknown>
  abi?: ABIEntry[]
  metadata?: Record<string, unknown>
  stdJsonInput?: Record<string, unknown>
  constructorArgs?: string
}

export type ABIEntry = {
  type: "function" | "event" | "constructor" | "fallback" | "receive" | "error"
  name?: string
  inputs?: ABIParam[]
  outputs?: ABIParam[]
  stateMutability?: "pure" | "view" | "nonpayable" | "payable"
  anonymous?: boolean
}

export type ABIParam = {
  name: string
  type: string
  indexed?: boolean
  components?: ABIParam[]
  internalType?: string
}

export interface CrossVerifyResult {
  success: boolean
  message: string
}

export interface VerificationProvider {
  id: string
  name: string
  explorerUrl(address: string, chainId: number): string
  checkVerification(address: string, chainId: number): Promise<VerificationResult>
  getSource(address: string, chainId: number): Promise<ContractSource>
  submitVerification?(
    address: string,
    chainId: number,
    source: ContractSource,
    contractName?: string,
  ): Promise<CrossVerifyResult>
}

export interface ProxyDetails {
  isProxy: boolean
  standard?: string
  implementationAddress?: string
  adminAddress?: string
  beaconAddress?: string
  implementationAbi?: ABIEntry[] | null
  implementationVerification?: {
    results: VerificationResult[]
    source: ContractSource | null
  }
}

export interface AggregatedVerification {
  address: string
  chainId: number
  results: VerificationResult[]
  source: ContractSource | null
  abi: ABIEntry[] | null
  proxy: ProxyDetails
}
