import { describe, it, expect } from "vitest"
import { replacementFees, decodeTokenTransfer } from "./tx-history"

const gwei = (n: number) => BigInt(n) * BigInt(1e9)

describe("replacementFees", () => {
  it("bumps EIP-1559 fees by 25% when above current", () => {
    const fees = replacementFees(
      { maxFeePerGas: gwei(100), maxPriorityFeePerGas: gwei(2) },
      { maxFeePerGas: gwei(30), maxPriorityFeePerGas: gwei(1) },
    )
    expect(fees).toEqual({ maxFeePerGas: gwei(125), maxPriorityFeePerGas: BigInt(2.5e9) })
  })

  it("uses the current fee when it exceeds the bump", () => {
    const fees = replacementFees(
      { maxFeePerGas: gwei(10), maxPriorityFeePerGas: gwei(1) },
      { maxFeePerGas: gwei(50), maxPriorityFeePerGas: gwei(3) },
    )
    expect(fees).toEqual({ maxFeePerGas: gwei(50), maxPriorityFeePerGas: gwei(3) })
  })

  it("bumps legacy gasPrice for legacy txs", () => {
    expect(replacementFees({ gasPrice: gwei(40) }, { maxFeePerGas: gwei(30), gasPrice: gwei(25) }))
      .toEqual({ gasPrice: gwei(50) })
  })

  it("doubles current fees when the original tx is unknown", () => {
    expect(replacementFees(null, { maxFeePerGas: gwei(30), maxPriorityFeePerGas: gwei(1) }))
      .toEqual({ maxFeePerGas: gwei(60), maxPriorityFeePerGas: gwei(2) })
  })

  it("rounds up and keeps maxFee >= priority", () => {
    const fees = replacementFees({ maxFeePerGas: BigInt(1), maxPriorityFeePerGas: BigInt(1) }, { maxFeePerGas: BigInt(0), maxPriorityFeePerGas: BigInt(0) })
    expect(fees.maxPriorityFeePerGas).toBe(BigInt(2))
    expect(fees.maxFeePerGas).toBe(BigInt(2))
  })
})

describe("decodeTokenTransfer", () => {
  const to = "0x8db97C7cEcE249c2b98bDC0226Cc4C2A57BF52FC"
  // transfer(to, 1500000)
  const data = "0xa9059cbb" + to.slice(2).toLowerCase().padStart(64, "0") + (1500000).toString(16).padStart(64, "0")

  it("decodes ERC-20 transfer calldata", () => {
    expect(decodeTokenTransfer(data)).toEqual({ recipient: to, amount: "1500000" })
  })

  it("ignores other calldata", () => {
    expect(decodeTokenTransfer("0x")).toBeUndefined()
    expect(decodeTokenTransfer(undefined)).toBeUndefined()
    expect(decodeTokenTransfer("0xa9059cbb1234")).toBeUndefined()
  })
})
