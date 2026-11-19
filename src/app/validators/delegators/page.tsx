"use client"

import { Suspense, useState, useMemo, useCallback, useEffect } from "react"
import Link from "next/link"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { useNow } from "@/lib/hooks/use-now"
import { appLinks } from "@/lib/explorer-links"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DataTable, Column } from "@/components/tools/DataTable"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { CopyableId } from "@/components/tools/CopyableId"
import { InfoCard } from "@/components/tools/InfoCard"
import { formatUnits } from "ethers/utils"
import { nAvaxToAvax, formatTimestamp, truncateId, errorMessage, timeUntil, uptimeColor } from "@/lib/utils"
import type { Delegator, Validator } from "@/lib/models/avalanche"

type DelegatorRow = Delegator & Record<string, unknown>

// Primary Network: a validator's total weight is capped at min(5 × own stake, 3M AVAX).
const MAX_DELEGATION_FACTOR = BigInt(5)
const MAX_VALIDATOR_WEIGHT = BigInt("3000000000000000") // 3M AVAX in nAVAX

function EndCountdown({ endTime }: { endTime: string }) {
  const now = useNow(60_000)
  return (
    <span>
      {formatTimestamp(endTime, "date")}{" "}
      <span className="text-muted-foreground">({timeUntil(Number(endTime), now)})</span>
    </span>
  )
}

function RewardOwner({ addresses }: { addresses?: string[] }) {
  if (!addresses?.length) return <span className="text-muted-foreground">-</span>
  return (
    <span className="flex flex-col gap-1">
      {addresses.map(a => (
        <CopyableId
          key={a}
          value={a}
          display={truncateId(a, 12, 6)}
          href={appLinks.stakingHistory(a)}
          explorer="pAddress"
          className="font-mono text-xs"
        />
      ))}
    </span>
  )
}

const columns: Column<DelegatorRow>[] = [
  {
    key: "txID",
    label: "TX ID",
    render: (row) => (
      <CopyableId value={row.txID} display={truncateId(row.txID, 10, 6)} explorer="pTx" className="font-mono text-xs" />
    ),
    sortValue: (row) => row.txID,
  },
  {
    key: "stakeAmount",
    label: "Stake Amount (AVAX)",
    render: (row) => nAvaxToAvax(row.stakeAmount ?? row.weight),
    sortValue: (row) => Number(row.stakeAmount ?? row.weight ?? 0),
  },
  {
    key: "startTime",
    label: "Start Date",
    render: (row) => formatTimestamp(row.startTime, "date"),
    sortValue: (row) => Number(row.startTime ?? 0),
  },
  {
    key: "endTime",
    label: "End Date",
    render: (row) => <EndCountdown endTime={row.endTime} />,
    sortValue: (row) => Number(row.endTime ?? 0),
  },
  {
    key: "potentialReward",
    label: "Potential Reward (AVAX)",
    render: (row) => nAvaxToAvax(row.potentialReward),
    sortValue: (row) => Number(row.potentialReward ?? 0),
  },
  {
    key: "rewardOwner",
    label: "Reward Owner",
    render: (row) => <RewardOwner addresses={row.rewardOwner?.addresses} />,
    sortValue: (row) => row.rewardOwner?.addresses[0] ?? "",
  },
]

function DelegatorsPageInner() {
  const { network } = useNetwork()
  const [param, setParam] = useQueryParam("nodeId")
  const [nodeID, setNodeID] = useState(param)
  const [validator, setValidator] = useState<Validator | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetched, setFetched] = useState(false)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const delegators = useMemo(() => (validator?.delegators ?? []) as DelegatorRow[], [validator])

  const totalDelegated = useMemo(
    () => delegators.reduce(
      (sum, d) => sum + parseFloat(formatUnits(d.stakeAmount ?? d.weight ?? "0", 9)),
      0
    ),
    [delegators]
  )

  const capacity = useMemo(() => {
    if (!validator) return null
    const stake = BigInt(validator.stakeAmount ?? validator.weight ?? "0")
    const delegated = delegators.reduce((sum, d) => sum + BigInt(d.stakeAmount ?? d.weight ?? "0"), BigInt(0))
    const max = stake * MAX_DELEGATION_FACTOR < MAX_VALIDATOR_WEIGHT ? stake * MAX_DELEGATION_FACTOR : MAX_VALIDATOR_WEIGHT
    const remaining = max - stake - delegated
    return { stake, remaining: remaining > BigInt(0) ? remaining : BigInt(0) }
  }, [validator, delegators])

  const lookup = useCallback(async (id: string) => {
    setLoading(true)
    setError("")
    setValidator(null)
    setFetched(false)
    clearRaw()
    try {
      const result = await AvalancheService.getValidatorByNodeID(network.baseUrl, id)
      if (!result) {
        setError("Validator not found for the given Node ID.")
      } else {
        setValidator(result)
      }
      captureRaw()
      setFetched(true)
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch validator"))
      setFetched(true)
    } finally {
      setLoading(false)
    }
  }, [network.baseUrl, clearRaw, captureRaw])

  // Deep links and back/forward: run whenever the URL param changes
  useEffect(() => {
    if (param) Promise.resolve().then(() => lookup(param))
  }, [param, lookup])

  function handleSubmit() {
    const id = nodeID.trim()
    if (!id) return
    if (id === param) lookup(id)
    else setParam(id)
  }

  return (
    <ToolCard
      title="Delegators"
      description="View all delegators for a specific validator by Node ID."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSubmit() }}>
          <FormField
            label="Node ID"
            id="node-id"
            value={nodeID}
            onChange={setNodeID}
            placeholder="NodeID-..."
            monospace
          />
          <LoadingButton type="submit" loading={loading}>
            Fetch Delegators
          </LoadingButton>
        </form>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {fetched && !error && validator && capacity && (
          <div className="space-y-4">
            <InfoCard label="Validator" rpcMethod="platform.getCurrentValidators">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <CopyableId
                    value={validator.nodeID}
                    href={appLinks.validator(validator.nodeID)}
                    explorer="validator"
                    className="font-mono text-sm break-all"
                  />
                  <Link href={appLinks.validatorDashboard(validator.nodeID)} className="text-xs text-primary hover:underline">
                    Open dashboard
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Delegation Fee</p>
                    <p className="font-bold">{validator.delegationFee ? `${validator.delegationFee}%` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Validator Stake</p>
                    <p className="font-bold">{nAvaxToAvax(capacity.stake.toString())} AVAX</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Delegated</p>
                    <p className="font-bold">
                      {totalDelegated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AVAX
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Remaining Capacity (est.)</p>
                    <p className="font-bold">{nAvaxToAvax(capacity.remaining.toString())} AVAX</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Uptime</p>
                    <p className={`font-bold ${validator.uptime ? uptimeColor(Number(validator.uptime)) : ""}`}>
                      {validator.uptime ? `${Number(validator.uptime).toFixed(2)}%` : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Validation Ends</p>
                    <p className="font-bold">{validator.endTime ? <EndCountdown endTime={validator.endTime} /> : "-"}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Capacity estimate: min(5 × validator stake, 3M AVAX) − validator stake − delegated.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Validation Reward Owner</p>
                    <RewardOwner addresses={validator.validationRewardOwner?.addresses} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Delegation Fee Reward Owner</p>
                    <RewardOwner addresses={validator.delegationRewardOwner?.addresses} />
                  </div>
                </div>
              </div>
            </InfoCard>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-muted-foreground">
                  {delegators.length} delegator{delegators.length !== 1 ? "s" : ""} found
                </p>
                <InfoTooltip rpcMethod="platform.getCurrentValidators" />
              </div>
            </div>
            <DataTable
              columns={columns}
              data={delegators}
              emptyMessage="No delegators found for this validator"
              searchPlaceholder="Search by TX ID..."
              pageSize={50}
            />
          </div>
        )}
      </div>
    </ToolCard>
  )
}

export default function DelegatorsPage() {
  const { network } = useNetwork()
  return <Suspense fallback={null}><DelegatorsPageInner key={network.id} /></Suspense>
}
