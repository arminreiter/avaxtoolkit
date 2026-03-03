/**
 * Typed interfaces for Avalanche Platform API (P-Chain) responses.
 *
 * Numeric values that arrive as strings from the JSON-RPC API (e.g. nAVAX
 * amounts, Unix timestamps, percentages) are typed as `string` to match
 * the wire format. Callers should convert with helpers such as
 * `nAvaxToAvax()` or `parseFloat()` as needed.
 */

// ---------------------------------------------------------------------------
// Reward owner
// ---------------------------------------------------------------------------

/** An owner descriptor returned by the platform API for reward distribution. */
export interface RewardOwner {
  locktime: string
  threshold: string
  addresses: string[]
}

// ---------------------------------------------------------------------------
// Delegator
// ---------------------------------------------------------------------------

/** A single delegation entry nested inside a Validator or returned standalone. */
export interface Delegator {
  /** Transaction ID that created this delegation. */
  txID: string
  /** Unix timestamp (seconds) when the delegation period started. */
  startTime: string
  /** Unix timestamp (seconds) when the delegation period ends. */
  endTime: string
  /**
   * Delegated amount in nAVAX.
   * Present on primary-network delegators; L1 delegators may use `weight` instead.
   */
  stakeAmount?: string
  /** Weight assigned to this delegation (used by some L1 responses instead of stakeAmount). */
  weight?: string
  /** Node ID of the validator this delegation targets. */
  nodeID: string
  /** Address set that receives delegation rewards. */
  rewardOwner?: RewardOwner
  /** Estimated reward in nAVAX if the delegation completes successfully. */
  potentialReward?: string
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/** A validator entry returned by `platform.getCurrentValidators`. */
export interface Validator {
  /** Unique node identifier (e.g. "NodeID-..."). */
  nodeID: string
  /** Transaction ID that created this validation. */
  txID?: string
  /** Unix timestamp (seconds) when the validation period started. */
  startTime?: string
  /** Unix timestamp (seconds) when the validation period ends. */
  endTime?: string
  /**
   * Staked amount in nAVAX.
   * Present on primary-network validators; L1 validators may use `weight` instead.
   */
  stakeAmount?: string
  /** Weight assigned to this validator (used by some L1 responses instead of stakeAmount). */
  weight?: string
  /** Whether the node is currently connected to the queried RPC node. */
  connected: boolean
  /** Observed uptime as a percentage string (e.g. "99.1234"). */
  uptime?: string
  /** Delegation fee as a percentage string (e.g. "2.0000"). */
  delegationFee?: string
  /** Estimated reward in nAVAX if the validation completes successfully. */
  potentialReward?: string
  /** Number of active delegators (may be provided as a pre-computed count). */
  delegatorCount?: number
  /** Total weight/stake of all delegators in nAVAX. */
  delegatorWeight?: string
  /** Inline array of delegator entries. */
  delegators?: Delegator[]
  /** Address set that receives validation rewards. */
  validationRewardOwner?: RewardOwner
  /** Address set that receives delegation rewards distributed to the validator. */
  delegationRewardOwner?: RewardOwner
  /** L1 (subnet) this validator belongs to, if not the primary network. */
  subnetID?: string
}

// ---------------------------------------------------------------------------
// Subnet (L1)
// ---------------------------------------------------------------------------

/** A subnet/L1 entry returned by `platform.getSubnets`. */
export interface Subnet {
  /** Unique subnet identifier. */
  id: string
  /** Control key addresses that can manage this subnet. */
  controlKeys: string[]
  /** Signature threshold required among control keys. */
  threshold: number
}

// ---------------------------------------------------------------------------
// Blockchain
// ---------------------------------------------------------------------------

/** A blockchain entry returned by `platform.getBlockchains`. */
export interface Blockchain {
  /** Unique blockchain identifier. */
  id: string
  /** Human-readable blockchain name. */
  name: string
  /** Subnet (L1) this blockchain belongs to. */
  subnetID: string
  /** Virtual machine identifier running this blockchain. */
  vmID: string
}
