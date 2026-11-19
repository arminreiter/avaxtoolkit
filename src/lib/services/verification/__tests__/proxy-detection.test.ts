import { describe, it, expect } from "vitest"
import { parseMinimalProxy } from "../proxy-detection"

describe("parseMinimalProxy", () => {
  it("extracts the checksummed implementation from EIP-1167 runtime code", () => {
    const code = "0x363d3d373d3d3d363d7309a26fc8fcef18192e267d7a6da9dfb4be81dd6a5af43d82803e903d91602b57fd5bf3"
    expect(parseMinimalProxy(code)).toBe("0x09a26fC8FCEF18192E267D7A6da9dFb4be81Dd6A")
  })

  it("is case-insensitive", () => {
    const code = "0x363D3D373D3D3D363D7309A26FC8FCEF18192E267D7A6DA9DFB4BE81DD6A5AF43D82803E903D91602B57FD5BF3"
    expect(parseMinimalProxy(code)).toBe("0x09a26fC8FCEF18192E267D7A6da9dFb4be81Dd6A")
  })

  it("returns null for regular contract code and empty accounts", () => {
    expect(parseMinimalProxy("0x6080604052348015600f57600080fd5b50")).toBeNull()
    expect(parseMinimalProxy("0x")).toBeNull()
  })
})
