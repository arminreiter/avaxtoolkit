import { describe, it, expect } from "vitest"
import { RpcService } from "./rpc.service"

describe("RpcService", () => {
  it("formats JSON-RPC request correctly", () => {
    const body = RpcService.buildRequest("platform.getCurrentValidators", { subnetID: "test" })
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      method: "platform.getCurrentValidators",
      params: { subnetID: "test" },
    })
    expect(body.id).toBeDefined()
  })

  it("buildRequest assigns incrementing IDs", () => {
    const a = RpcService.buildRequest("a", {})
    const b = RpcService.buildRequest("b", {})
    expect(b.id).toBeGreaterThan(a.id)
  })
})
