import { ZeroAddress } from "ethers/constants"
import { getAddress } from "ethers/address"
import { JsonRpcProvider } from "ethers/providers"
import { Contract } from "ethers/contract"

/**
 * EIP-1967 storage slots for proxy detection.
 * These are derived from: bytes32(uint256(keccak256('eip1967.proxy.<type>')) - 1)
 */
const SLOTS = {
  /** EIP-1967 implementation slot */
  implementation: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  /** EIP-1967 beacon slot */
  beacon: "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
  /** EIP-1967 admin slot */
  admin: "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
} as const

export type ProxyStandard = "EIP-1967" | "EIP-1967 Beacon" | "EIP-897" | "Unknown"

export interface ProxyInfo {
  isProxy: boolean
  standard?: ProxyStandard
  implementationAddress?: string
  adminAddress?: string
  beaconAddress?: string
}

const ZERO = "0x" + "0".repeat(64)

function slotToAddress(value: string): string | null {
  if (!value || value === ZERO) return null
  const addr = "0x" + value.slice(26)
  if (addr === ZeroAddress) return null
  return getAddress(addr)
}

/**
 * Detect if a contract is a proxy by reading well-known storage slots (EIP-1967)
 * and falling back to calling implementation() (EIP-897).
 */
export async function detectProxy(address: string, rpcUrl: string): Promise<ProxyInfo> {
  const provider = new JsonRpcProvider(rpcUrl)

  try {
    // Read implementation and beacon slots in parallel
    const [implResult, beaconResult] = await Promise.allSettled([
      provider.getStorage(address, SLOTS.implementation),
      provider.getStorage(address, SLOTS.beacon),
    ])

    // Check EIP-1967 implementation slot first
    if (implResult.status === "fulfilled") {
      const implAddr = slotToAddress(implResult.value)
      if (implAddr) {
        // Also check admin slot
        let adminAddress: string | undefined
        try {
          const adminSlot = await provider.getStorage(address, SLOTS.admin)
          adminAddress = slotToAddress(adminSlot) ?? undefined
        } catch {
          // admin slot is optional
        }
        return {
          isProxy: true,
          standard: "EIP-1967",
          implementationAddress: implAddr,
          adminAddress,
        }
      }
    }

    // Check EIP-1967 beacon slot
    if (beaconResult.status === "fulfilled") {
      const beaconAddr = slotToAddress(beaconResult.value)
      if (beaconAddr) {
        // Call implementation() on the beacon to get the actual impl
        try {
          const beacon = new Contract(
            beaconAddr,
            ["function implementation() view returns (address)"],
            provider,
          )
          const implAddr: string = await beacon.implementation()
          if (implAddr && implAddr !== ZeroAddress) {
            return {
              isProxy: true,
              standard: "EIP-1967 Beacon",
              implementationAddress: implAddr,
              beaconAddress: beaconAddr,
            }
          }
        } catch {
          // Beacon exists but implementation() call failed
          return {
            isProxy: true,
            standard: "EIP-1967 Beacon",
            beaconAddress: beaconAddr,
          }
        }
      }
    }

    // Fallback: EIP-897 — try calling implementation() directly on the contract
    try {
      const contract = new Contract(
        address,
        ["function implementation() view returns (address)"],
        provider,
      )
      const implAddr: string = await contract.implementation()
      if (implAddr && implAddr !== ZeroAddress) {
        return {
          isProxy: true,
          standard: "EIP-897",
          implementationAddress: implAddr,
        }
      }
    } catch {
      // Not a proxy or doesn't support implementation()
    }

    return { isProxy: false }
  } finally {
    provider.destroy()
  }
}
