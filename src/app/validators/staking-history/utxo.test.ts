import { describe, it, expect } from "vitest"
import { decodeUtxo } from "./utxo"

// Real Fuji platform.getUTXOs (hex) response entry
const FUJI_UTXO =
  "0x00004c56185e343c4e1716ca3d639124bb1ee5c6aaaaaa86a709a12cb98c00e1b2d7000000003d9bdac0ed1d761330cf680efdeb1a42159eb387d6d2950c96f7d28f61bbe2aa000000070000000000050c4c000000000000000000000001000000012ca8ec557ccc6c54f08a6d07e49e95fb515b967c3b882de4"

describe("decodeUtxo", () => {
  it("decodes a secp256k1 transfer output", () => {
    const u = decodeUtxo(FUJI_UTXO)!
    expect(u.amount).toBe("330828")
    expect(u.outputIndex).toBe(0)
    expect(u.locktime).toBe("0")
    expect(u.stakeableLocktime).toBeUndefined()
    expect(u.txID).toMatch(/^[1-9A-HJ-NP-Za-km-z]{48,50}$/)
  })

  it("unwraps a stakeable lock output", () => {
    // replace typeID 7 with 22 + locktime 1000 + inner typeID 7
    const hex = FUJI_UTXO.replace("000000070000000000050c4c", "0000001600000000000003e8000000070000000000050c4c")
    const u = decodeUtxo(hex)!
    expect(u.stakeableLocktime).toBe("1000")
    expect(u.amount).toBe("330828")
  })

  it("returns null for unknown output types", () => {
    expect(decodeUtxo(FUJI_UTXO.replace("000000070000000000050c4c", "000000080000000000050c4c"))).toBeNull()
  })
})
