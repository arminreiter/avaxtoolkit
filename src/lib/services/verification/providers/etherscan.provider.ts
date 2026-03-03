import type { VerificationProvider, VerificationResult, ContractSource, ABIEntry, CrossVerifyResult } from "../types"

const MAX_POLL_ATTEMPTS = 20
const POLL_INTERVAL_MS = 3000

export abstract class EtherscanProvider implements VerificationProvider {
  abstract id: string
  abstract name: string

  protected abstract getBaseUrl(chainId: number): string
  abstract explorerUrl(address: string, chainId: number): string

  async checkVerification(address: string, chainId: number): Promise<VerificationResult> {
    const base = this.getBaseUrl(chainId)
    const sep = base.includes("?") ? "&" : "?"
    const url = `${base}${sep}module=contract&action=getsourcecode&address=${address}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    let response: Response
    try {
      response = await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
    if (!response.ok) {
      return { provider: this.id, verified: false }
    }
    const json = await response.json()
    if (json.status !== "1" || !json.result?.[0]?.SourceCode) {
      return { provider: this.id, verified: false }
    }
    const result = json.result[0]
    return {
      provider: this.id,
      verified: true,
      contractName: result.ContractName || undefined,
      compilerVersion: result.CompilerVersion || undefined,
      optimizationUsed: result.OptimizationUsed === "1",
      runs: result.Runs ? Number(result.Runs) : undefined,
      evmVersion: result.EVMVersion || undefined,
      license: result.LicenseType || undefined,
      proxy: result.Proxy === "1",
      implementation: result.Implementation || undefined,
    }
  }

  async getSource(address: string, chainId: number): Promise<ContractSource> {
    const base = this.getBaseUrl(chainId)
    const sep = base.includes("?") ? "&" : "?"
    const url = `${base}${sep}module=contract&action=getsourcecode&address=${address}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)
    let response: Response
    try {
      response = await fetch(url, { signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
    if (!response.ok) throw new Error(`${this.name} API error: ${response.status}`)
    const json = await response.json()
    if (json.status !== "1" || !json.result?.[0]) {
      throw new Error(`Contract source not available on ${this.name}`)
    }
    const result = json.result[0]
    const { files, stdJsonInput } = this.parseSourceCodeFull(result.SourceCode, result.ContractName)
    let abi: ABIEntry[] | undefined
    try {
      abi = JSON.parse(result.ABI)
    } catch {
      // ABI may not be valid JSON
    }

    const compilerSettings: Record<string, unknown> = {}
    if (result.OptimizationUsed === "1" || result.OptimizationUsed === "0") {
      compilerSettings.optimizer = {
        enabled: result.OptimizationUsed === "1",
        runs: result.Runs ? Number(result.Runs) : 200,
      }
    }
    if (result.EVMVersion && result.EVMVersion !== "Default") {
      compilerSettings.evmVersion = result.EVMVersion
    }

    return {
      provider: this.id,
      files,
      compilerVersion: result.CompilerVersion || undefined,
      compilerSettings: Object.keys(compilerSettings).length > 0 ? compilerSettings : undefined,
      abi,
      stdJsonInput,
      constructorArgs: result.ConstructorArguments
        ? result.ConstructorArguments.replace(/^0x/i, "")
        : undefined,
    }
  }

  async submitVerification(
    address: string,
    chainId: number,
    source: ContractSource,
    contractName?: string,
  ): Promise<CrossVerifyResult> {
    const base = this.getBaseUrl(chainId)
    const stdJsonInput = source.stdJsonInput ?? buildStdJsonInput(source)

    // Determine the qualified contract name (filepath:ContractName)
    const qualifiedName = contractName
      ? resolveQualifiedName(contractName, stdJsonInput)
      : undefined

    const params = new URLSearchParams()
    params.set("module", "contract")
    params.set("action", "verifysourcecode")
    params.set("contractaddress", address)
    params.set("sourceCode", JSON.stringify(stdJsonInput))
    params.set("codeformat", "solidity-standard-json-input")
    params.set("contractname", qualifiedName ?? "")
    params.set("compilerversion", source.compilerVersion ?? "")
    if (source.constructorArgs) {
      params.set("constructorArguements", source.constructorArgs)
    }

    const submitController = new AbortController()
    const submitTimeoutId = setTimeout(() => submitController.abort(), 30000)
    let response: Response
    try {
      response = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        signal: submitController.signal,
      })
    } finally {
      clearTimeout(submitTimeoutId)
    }

    if (!response.ok) {
      return { success: false, message: `${this.name} API error: ${response.status}` }
    }

    const json = await response.json()
    if (json.status !== "1") {
      const msg = typeof json.result === "string" ? json.result : "Submission failed"
      // Already verified is a success
      if (msg.includes("Already Verified")) {
        return { success: true, message: "Already verified" }
      }
      return { success: false, message: msg }
    }

    return this.pollVerificationStatus(json.result, chainId)
  }

  private async pollVerificationStatus(guid: string, chainId: number): Promise<CrossVerifyResult> {
    const base = this.getBaseUrl(chainId)

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

      const sep = base.includes("?") ? "&" : "?"
      const url = `${base}${sep}module=contract&action=checkverifystatus&guid=${guid}`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      let response: Response
      try {
        response = await fetch(url, { signal: controller.signal })
      } catch {
        clearTimeout(timeoutId)
        continue
      }
      clearTimeout(timeoutId)
      if (!response.ok) continue

      const json = await response.json()
      if (json.status === "1") {
        return { success: true, message: json.result ?? "Verified" }
      }

      const result = typeof json.result === "string" ? json.result : ""
      // Still pending — keep polling
      if (result.includes("Pending")) continue
      // Actual failure
      return { success: false, message: result || "Verification failed" }
    }

    return { success: false, message: "Verification timed out — check the explorer manually" }
  }

  protected parseSourceCode(sourceCode: string, contractName: string): Record<string, string> {
    return this.parseSourceCodeFull(sourceCode, contractName).files
  }

  private parseSourceCodeFull(
    sourceCode: string,
    contractName: string,
  ): { files: Record<string, string>; stdJsonInput?: Record<string, unknown> } {
    if (!sourceCode) return { files: {} }

    // Solidity Standard JSON Input is double-brace wrapped: {{...}}
    if (sourceCode.startsWith("{{")) {
      try {
        const jsonStr = sourceCode.slice(1, -1)
        const stdInput = JSON.parse(jsonStr)
        if (stdInput.sources) {
          const files: Record<string, string> = {}
          for (const [name, source] of Object.entries(stdInput.sources)) {
            files[name] = (source as { content: string }).content
          }
          return { files, stdJsonInput: stdInput }
        }
      } catch {
        // Fall through to single-file handling
      }
    }

    // Single-brace JSON (multiple files without standard JSON input wrapper)
    if (sourceCode.startsWith("{")) {
      try {
        const parsed = JSON.parse(sourceCode)
        if (typeof parsed === "object") {
          const files: Record<string, string> = {}
          for (const [name, source] of Object.entries(parsed)) {
            files[name] = typeof source === "string" ? source : (source as { content: string }).content
          }
          return { files }
        }
      } catch {
        // Fall through to single-file handling
      }
    }

    // Single file
    return { files: { [`${contractName || "Contract"}.sol`]: sourceCode } }
  }
}

/**
 * Build a standard JSON input from source files and compiler settings.
 */
export function buildStdJsonInput(source: ContractSource): Record<string, unknown> {
  const sources: Record<string, { content: string }> = {}
  for (const [name, content] of Object.entries(source.files)) {
    sources[name] = { content }
  }

  const settings: Record<string, unknown> = {
    outputSelection: {
      "*": {
        "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"],
      },
    },
  }

  if (source.compilerSettings) {
    if (source.compilerSettings.optimizer) {
      settings.optimizer = source.compilerSettings.optimizer
    }
    if (source.compilerSettings.evmVersion) {
      settings.evmVersion = source.compilerSettings.evmVersion
    }
  }

  return {
    language: source.language ?? "Solidity",
    sources,
    settings,
  }
}

/**
 * Resolve the qualified contract name (filepath:ContractName) needed by Etherscan API.
 */
export function resolveQualifiedName(contractName: string, stdJsonInput: Record<string, unknown>): string {
  // Already qualified
  if (contractName.includes(":")) return contractName

  const sources = stdJsonInput.sources as Record<string, unknown> | undefined
  if (!sources) return contractName

  // Look for a source file containing `contract <ContractName>`
  const escaped = contractName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = new RegExp(`\\bcontract\\s+${escaped}\\b`)
  for (const filePath of Object.keys(sources)) {
    const src = sources[filePath] as { content?: string } | undefined
    if (src?.content && pattern.test(src.content)) {
      return `${filePath}:${contractName}`
    }
  }

  return contractName
}
