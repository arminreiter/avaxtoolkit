import { describe, it, expect } from "vitest"
import { encodeCalldata, decodeCalldata } from "./abi"

const to = "0x" + "11".repeat(20)

describe("calldata encode/decode", () => {
  it("encodes an ERC-20 transfer with the known selector", () => {
    const data = encodeCalldata("transfer(address,uint256)", [to, "1000"])
    expect(data.slice(0, 10)).toBe("0xa9059cbb")
    expect(data).toHaveLength(10 + 64 * 2)
  })

  it("accepts a 'function ' prefix and named params", () => {
    expect(encodeCalldata("function transfer(address to, uint256 amount)", [to, "1"]))
      .toBe(encodeCalldata("transfer(address,uint256)", [to, "1"]))
  })

  it("round-trips arrays, tuples and bools", () => {
    const sig = "f(uint256[] ids, (address,bool) pair, bool flag)"
    const data = encodeCalldata(sig, ["[1,2,3]", `["${to}", true]`, "true"])
    const { name, args } = decodeCalldata(sig, data)
    expect(name).toBe("f")
    expect(args.map(a => a.value)).toEqual(['["1","2","3"]', `["${to}",true]`, "true"])
    expect(args[1].type).toBe("(address,bool)")
    expect(decodeCalldata("transfer(address,uint256)", encodeCalldata("transfer(address,uint256)", [to, "1000"])).args[1].value).toBe("1000")
  })

  it("rejects wrong argument count and selector mismatch", () => {
    expect(() => encodeCalldata("transfer(address,uint256)", [to])).toThrow(/expects 2/)
    const data = encodeCalldata("approve(address,uint256)", [to, "1"])
    expect(() => decodeCalldata("transfer(address,uint256)", data)).toThrow()
  })
})
