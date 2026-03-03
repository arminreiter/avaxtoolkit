let requestId = 1

export class RpcService {
  private static rawResponses: Record<string, unknown> = {}

  static getRawResponses() { return { ...RpcService.rawResponses } }
  static clearRawResponses() { RpcService.rawResponses = {} }

  static buildRequest(method: string, params: Record<string, unknown> | unknown[]) {
    return { jsonrpc: "2.0" as const, method, params, id: requestId++ }
  }

  static async call<T>(url: string, method: string, params: Record<string, unknown> | unknown[] = {}, timeoutMs = 15000): Promise<T> {
    const body = RpcService.buildRequest(method, params)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(`RPC request timed out after ${timeoutMs}ms`)
      }
      throw err
    }
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`RPC request failed: ${response.status} ${response.statusText}`)
    const json = await response.json()
    if (json.error) throw new Error(`RPC error: ${json.error.message || JSON.stringify(json.error)}`)
    if (json.id !== body.id) throw new Error(`RPC response id mismatch: expected ${body.id}, got ${json.id}`)
    RpcService.rawResponses[method] = json.result
    return json.result as T
  }

  static async healthCheck(baseUrl: string, plainRpc?: boolean): Promise<boolean> {
    try {
      const base = baseUrl.replace(/\/+$/, "")
      const url = plainRpc ? base : `${base}/ext/bc/C/rpc`
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!response.ok) return false
      const json = await response.json()
      return !!json.result
    } catch { return false }
  }
}
