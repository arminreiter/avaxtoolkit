import type { VerificationProvider, VerificationResult, ContractSource, ABIEntry, CrossVerifyResult } from "../types"
import { buildStdJsonInput, resolveQualifiedName } from "./etherscan.provider"

export class SourcifyProvider implements VerificationProvider {
  id: string
  name: string

  protected baseUrl: string

  constructor(id = "sourcify", name = "Sourcify", baseUrl = "https://sourcify.dev/server") {
    this.id = id
    this.name = name
    this.baseUrl = baseUrl
  }

  explorerUrl(address: string, chainId: number): string {
    return `https://sourcify.dev/#/lookup/${address}?chainId=${chainId}`
  }

  async checkVerification(address: string, chainId: number): Promise<VerificationResult> {
    const url = `${this.baseUrl}/v2/contract/${chainId}/${address}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    let response: Response
    try {
      response = await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
    if (response.status === 404) {
      return { provider: this.id, verified: false }
    }
    if (!response.ok) {
      throw new Error(`${this.name} API error: ${response.status}`)
    }
    const json = await response.json()
    if (!json.match) {
      return { provider: this.id, verified: false }
    }
    return {
      provider: this.id,
      verified: true,
      contractName: undefined,
    }
  }

  async getSource(address: string, chainId: number): Promise<ContractSource> {
    const url = `${this.baseUrl}/v2/contract/${chainId}/${address}?fields=abi,sources,compilation,stdJsonInput,metadata`
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
    if (!json.sources) {
      throw new Error(`Contract source not available on ${this.name}`)
    }

    const files: Record<string, string> = {}
    for (const [name, source] of Object.entries(json.sources)) {
      files[name] = (source as { content: string }).content
    }

    const abi: ABIEntry[] | undefined = json.abi
    const compilation = json.compilation as {
      language?: string
      compiler?: { version?: string }
      settings?: Record<string, unknown>
    } | undefined

    return {
      provider: this.id,
      files,
      language: compilation?.language,
      compilerVersion: compilation?.compiler?.version,
      compilerSettings: compilation?.settings,
      abi,
      metadata: json.metadata as Record<string, unknown> | undefined,
      stdJsonInput: json.stdJsonInput as Record<string, unknown> | undefined,
    }
  }

  async submitVerification(
    address: string,
    chainId: number,
    source: ContractSource,
    contractName?: string,
  ): Promise<CrossVerifyResult> {
    const stdJsonInput = source.stdJsonInput ?? buildStdJsonInput(source)

    // Normalize compiler version: Sourcify expects "0.8.20+commit.xxx" without leading "v"
    let compilerVersion = source.compilerVersion ?? ""
    if (compilerVersion.startsWith("v")) {
      compilerVersion = compilerVersion.slice(1)
    }

    // Build the contractIdentifier (filepath:ContractName) required by Sourcify v2
    const contractIdentifier = contractName
      ? resolveQualifiedName(contractName, stdJsonInput)
      : undefined

    const submitController = new AbortController()
    const submitTimeoutId = setTimeout(() => submitController.abort(), 30000)
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/v2/verify/${chainId}/${address}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stdJsonInput,
          compilerVersion,
          ...(contractIdentifier ? { contractIdentifier } : {}),
        }),
        signal: submitController.signal,
      })
    } finally {
      clearTimeout(submitTimeoutId)
    }

    // 409 = already verified
    if (response.status === 409) {
      return { success: true, message: `Already verified on ${this.name}` }
    }

    // 202 = verification job submitted, need to poll
    if (response.status === 202) {
      const json = await response.json()
      if (json.verificationId) {
        return this.pollVerificationJob(json.verificationId, submitController.signal)
      }
      return { success: true, message: `Verified on ${this.name}` }
    }

    if (response.ok) {
      return { success: true, message: `Verified on ${this.name}` }
    }

    let errorMsg = `${this.name} API error: ${response.status}`
    try {
      const json = await response.json()
      errorMsg = json.message || json.error || errorMsg
    } catch {
      // Use default error message
    }
    return { success: false, message: errorMsg }
  }

  private async pollVerificationJob(verificationId: string, signal?: AbortSignal): Promise<CrossVerifyResult> {
    const maxAttempts = 20
    const intervalMs = 3000

    for (let i = 0; i < maxAttempts; i++) {
      if (signal?.aborted) {
        return { success: false, message: "Verification cancelled" }
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs))
      if (signal?.aborted) {
        return { success: false, message: "Verification cancelled" }
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      if (signal) {
        signal.addEventListener("abort", () => controller.abort(), { once: true })
      }
      let response: Response
      try {
        response = await fetch(`${this.baseUrl}/v2/verify/${verificationId}`, { signal: controller.signal })
      } catch {
        clearTimeout(timeoutId)
        if (signal?.aborted) return { success: false, message: "Verification cancelled" }
        continue
      }
      clearTimeout(timeoutId)
      if (!response.ok) continue

      const json = await response.json()
      if (!json.isJobCompleted) continue

      // Job completed — check result
      if (json.error) {
        const msg = json.error.message || json.error.customCode || "Verification failed"
        return { success: false, message: msg }
      }

      const match = json.contract?.match
      if (match) {
        return { success: true, message: `Verified on ${this.name} (${match} match)` }
      }
      return { success: true, message: `Verified on ${this.name}` }
    }

    return { success: false, message: "Verification timed out — check Sourcify manually" }
  }
}
