"use client"

import { Suspense, useState, useCallback, useEffect, useMemo } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { appLinks } from "@/lib/explorer-links"
import { DataTable, Column } from "@/components/tools/DataTable"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { OutputDisplay } from "@/components/tools/OutputDisplay"
import { SectionHeading } from "@/components/tools/SectionHeading"
import { InfoCard } from "@/components/tools/InfoCard"
import { CopyableId } from "@/components/tools/CopyableId"
import { normalizePChainAddress, nAvaxToAvax, errorMessage, formatTimestamp, truncateId } from "@/lib/utils"
import { TimeProgress } from "@/components/tools/TimeProgress"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Validator } from "@/lib/models/avalanche"
import { decodeUtxo, type DecodedUtxo } from "./utxo"

const UTXO_PAGE_MAX = 1024

interface StakeResult {
  staked: string
  stakedOutputs: string[]
}

interface StakingPosition {
  role: "Validator" | "Delegator"
  nodeID: string
  stakeAmount: string
  potentialReward: string
  startTime: string
  endTime: string
  delegationFee?: string
  txID: string
}

type UtxoRow = DecodedUtxo & Record<string, unknown>

const utxoColumns: Column<UtxoRow>[] = [
  {
    key: "txID",
    label: "TX ID",
    render: (row) => (
      <CopyableId value={row.txID} display={truncateId(row.txID, 10, 6)} explorer="pTx" className="font-mono text-xs" />
    ),
  },
  { key: "outputIndex", label: "Output" },
  {
    key: "amount",
    label: "Amount (AVAX)",
    render: (row) => nAvaxToAvax(row.amount, 4),
    sortValue: (row) => Number(row.amount),
  },
  {
    key: "stakeableLocktime",
    label: "Status",
    render: (row) => row.stakeableLocktime
      ? `Locked (stakeable) until ${formatTimestamp(row.stakeableLocktime, "date")}`
      : row.locktime !== "0" ? `Locked until ${formatTimestamp(row.locktime, "date")}` : "Unlocked",
    sortValue: (row) => Number(row.stakeableLocktime ?? row.locktime),
  },
]

/** Case-insensitive key; the API returns "P-avax1…", users may type "avax1…" or mixed case. */
function addrKey(a: string): string {
  return normalizePChainAddress(a).toLowerCase()
}

function findPositionsForAddress(validators: Validator[], address: string): StakingPosition[] {
  const positions: StakingPosition[] = []
  const normalizedAddr = addrKey(address)

  for (const v of validators) {
    const rewardAddrs: string[] = v.validationRewardOwner?.addresses ?? []
    const matchesValidator = rewardAddrs.some(
      a => addrKey(a) === normalizedAddr
    )

    if (matchesValidator) {
      positions.push({
        role: "Validator",
        nodeID: v.nodeID,
        stakeAmount: v.stakeAmount ?? v.weight ?? "0",
        potentialReward: v.potentialReward ?? "0",
        startTime: v.startTime ?? "0",
        endTime: v.endTime ?? "0",
        delegationFee: v.delegationFee,
        txID: v.txID ?? "",
      })
    }

    const delegators = v.delegators ?? []
    for (const d of delegators) {
      const delRewardAddrs: string[] = d.rewardOwner?.addresses ?? []
      const matchesDelegator = delRewardAddrs.some(
        a => addrKey(a) === normalizedAddr
      )
      if (matchesDelegator) {
        positions.push({
          role: "Delegator",
          nodeID: v.nodeID,
          stakeAmount: d.stakeAmount ?? d.weight ?? "0",
          potentialReward: d.potentialReward ?? "0",
          startTime: d.startTime,
          endTime: d.endTime,
          txID: d.txID,
        })
      }
    }
  }

  return positions
}

function StakingHistoryPageInner() {
  const { network } = useNetwork()
  const [param, setParam] = useQueryParam("address")
  const [address, setAddress] = useState(param)
  const [lookedUp, setLookedUp] = useState("")
  const [stakeData, setStakeData] = useState<StakeResult | null>(null)
  const [validators, setValidators] = useState<Validator[]>([])
  const [positions, setPositions] = useState<StakingPosition[]>([])
  const [utxoData, setUtxoData] = useState<{ numFetched: string; utxos: string[]; endIndex: { address: string; utxo: string } } | null>(null)
  const [loadingMoreUtxos, setLoadingMoreUtxos] = useState(false)
  const [scan, setScan] = useState<{ done: number; total: number } | null>(null)
  const [scanned, setScanned] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetched, setFetched] = useState(false)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const lookup = useCallback(async (normalizedAddress: string) => {
    setLoading(true)
    setError("")
    setStakeData(null)
    setValidators([])
    setPositions([])
    setUtxoData(null)
    setScan(null)
    setScanned(false)
    setFetched(false)
    setLookedUp(normalizedAddress)
    clearRaw()
    try {
      const [stakeSettled, validatorsResult, utxosResult] = await Promise.allSettled([
        AvalancheService.getStake(network.baseUrl, [normalizedAddress]),
        AvalancheService.getValidators(network.baseUrl),
        AvalancheService.getUTXOs(network.baseUrl, [normalizedAddress]),
      ])

      if (stakeSettled.status === "fulfilled") {
        setStakeData(stakeSettled.value)
      } else {
        throw stakeSettled.reason
      }

      if (validatorsResult.status === "fulfilled") {
        setValidators(validatorsResult.value)
        setPositions(findPositionsForAddress(validatorsResult.value, normalizedAddress))
      }

      if (utxosResult.status === "fulfilled") {
        setUtxoData(utxosResult.value)
      }

      captureRaw()
      setFetched(true)
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch staking data"))
      setFetched(true)
    } finally {
      setLoading(false)
    }
  }, [network.baseUrl, clearRaw, captureRaw])

  const loadMoreUtxos = async () => {
    if (!utxoData) return
    setLoadingMoreUtxos(true)
    try {
      const next = await AvalancheService.getUTXOs(network.baseUrl, [lookedUp], undefined, undefined, utxoData.endIndex)
      setUtxoData({ ...next, utxos: [...utxoData.utxos, ...next.utxos] })
    } catch (err) {
      setError(errorMessage(err, "Failed to load more UTXOs"))
    } finally {
      setLoadingMoreUtxos(false)
    }
  }

  // Deep links and back/forward: run whenever the URL param changes
  useEffect(() => {
    if (param) Promise.resolve().then(() => lookup(normalizePChainAddress(param)))
  }, [param, lookup])

  function handleSubmit() {
    const addr = normalizePChainAddress(address)
    if (!addr) return
    if (addr === param) lookup(addr)
    else setParam(addr)
  }

  // ponytail: getCurrentValidators only returns `delegators` when exactly ONE nodeID is passed
  // (verified on Fuji: a multi-nodeID call omits them), so this is one call per validator with
  // delegators, 8 in flight, on explicit request only. Failed nodes are skipped.
  async function scanDelegations() {
    const candidates = validators.filter(v => Number(v.delegatorCount ?? 0) > 0).map(v => v.nodeID)
    setScan({ done: 0, total: candidates.length })
    const found: StakingPosition[] = []
    let next = 0
    let done = 0
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (next < candidates.length) {
        const nodeID = candidates[next++]
        const vals = await AvalancheService.getValidators(network.baseUrl, undefined, [nodeID]).catch(() => [])
        found.push(...findPositionsForAddress(vals, lookedUp).filter(p => p.role === "Delegator"))
        setScan({ done: ++done, total: candidates.length })
      }
    }))
    setPositions(prev => [...prev.filter(p => p.role === "Validator"), ...found])
    setScan(null)
    setScanned(true)
  }

  // memoized: DataTable resets to page 0 whenever the data array identity changes
  const decodedUtxos = useMemo(
    () => (utxoData?.utxos ?? []).map(decodeUtxo).filter((u): u is DecodedUtxo => u !== null) as UtxoRow[],
    [utxoData],
  )
  const undecodedCount = (utxoData?.utxos.length ?? 0) - decodedUtxos.length

  const exportCSV = useCallback(() => {
    if (!stakeData) return
    function csvField(v: string | number | undefined): string {
      const s = String(v ?? "").replace(/"/g, '""')
      return `"${s}"`
    }
    const rows: string[] = ["type,nodeID,stakeAmount,potentialReward,startTime,endTime,delegationFee,txID"]
    for (const p of positions) {
      rows.push(
        [p.role, p.nodeID, p.stakeAmount, p.potentialReward, p.startTime, p.endTime, p.delegationFee ?? "", p.txID]
          .map(f => csvField(f))
          .join(",")
      )
    }
    if (rows.length === 1) {
      rows.push([csvField("stake"), "", csvField(stakeData.staked), "", "", "", "", ""].join(","))
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `staking-data-${lookedUp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [stakeData, positions, lookedUp])

  const exportJSON = useCallback(() => {
    if (!stakeData) return
    const data = {
      address: lookedUp,
      staked: stakeData.staked,
      stakedOutputs: stakeData.stakedOutputs,
      positions,
      utxos: utxoData,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `staking-data-${lookedUp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [stakeData, positions, utxoData, lookedUp])

  const delegationCandidates = validators.filter(v => Number(v.delegatorCount ?? 0) > 0).length

  return (
    <ToolCard
      title="Staking History"
      description="Look up staking data, active positions, and UTXOs for a P-Chain address."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSubmit() }}>
          <FormField
            label="P-Chain Address"
            id="p-address"
            value={address}
            onChange={setAddress}
            placeholder="P-avax1... or avax1..."
            monospace
          />
          <LoadingButton type="submit" loading={loading}>
            Fetch Staking Data
          </LoadingButton>
        </form>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {fetched && stakeData && (
          <div className="space-y-4">
            <CopyableId value={lookedUp} explorer="pAddress" className="font-mono text-sm break-all" />

            {/* Section 1: Current Stake */}
            <InfoCard label="Current Staked Amount" rpcMethod="platform.getStake">
              <p className="text-3xl font-bold">
                {nAvaxToAvax(stakeData.staked, 4)} AVAX
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stakeData.staked} nAVAX
              </p>
            </InfoCard>

            {stakeData.stakedOutputs.length > 0 && (
              <OutputDisplay
                label="Staked Outputs"
                value={JSON.stringify(stakeData.stakedOutputs, null, 2)}
              />
            )}

            {/* Section 2: Active Staking Positions */}
            <div className="space-y-4">
              <SectionHeading title="Active Staking Positions" rpcMethod="platform.getCurrentValidators" />

              {!scanned && delegationCandidates > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="outline" disabled={scan !== null} onClick={scanDelegations}>
                    {scan ? `Scanning ${scan.done}/${scan.total}…` : "Scan for delegations"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Delegations are only returned per validator, so this queries {delegationCandidates} validators.
                  </p>
                </div>
              )}

              {positions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active {scanned ? "" : "validator "}staking positions found for this address.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {positions.map((p, i) => (
                    <Card key={`${p.txID}-${i}`}>
                      <CardHeader>
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant={p.role === "Validator" ? "default" : "secondary"}>
                            {p.role}
                          </Badge>
                          <CopyableId
                            value={p.nodeID}
                            href={appLinks.validator(p.nodeID)}
                            explorer="validator"
                            className="font-mono text-sm truncate"
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Stake Amount</p>
                            <p className="font-bold">{nAvaxToAvax(p.stakeAmount, 4)} AVAX</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Potential Reward</p>
                            <p className="font-bold">{nAvaxToAvax(p.potentialReward, 4)} AVAX</p>
                          </div>
                          {p.delegationFee && (
                            <div>
                              <p className="text-xs text-muted-foreground">Delegation Fee</p>
                              <p className="font-bold">{p.delegationFee}%</p>
                            </div>
                          )}
                        </div>
                        <TimeProgress startTime={p.startTime} endTime={p.endTime} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: UTXOs */}
            <div className="space-y-4">
              <SectionHeading title="UTXOs" rpcMethod="platform.getUTXOs" />

              {utxoData ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Found {utxoData.utxos.length} UTXO{utxoData.utxos.length !== 1 ? "s" : ""}
                    {undecodedCount > 0 && ` (${undecodedCount} of an unsupported output type not shown)`}
                  </p>
                  {decodedUtxos.length > 0 && (
                    <DataTable
                      columns={utxoColumns}
                      data={decodedUtxos}
                      rowKey={(row) => `${row.txID}-${row.outputIndex}`}
                      searchPlaceholder="Search by TX ID..."
                      pageSize={25}
                    />
                  )}
                  {/* ponytail: a full page (node max 1024) means there may be more */}
                  {Number(utxoData.numFetched) >= UTXO_PAGE_MAX && (
                    <LoadingButton type="button" variant="outline" loading={loadingMoreUtxos} onClick={loadMoreUtxos}>
                      Load more UTXOs
                    </LoadingButton>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No UTXO data available.</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={exportCSV}>
                Export CSV
              </Button>
              <Button variant="outline" onClick={exportJSON}>
                Export JSON
              </Button>
            </div>
          </div>
        )}
      </div>
    </ToolCard>
  )
}

export default function StakingHistoryPage() {
  const { network } = useNetwork()
  return <Suspense fallback={null}><StakingHistoryPageInner key={network.id} /></Suspense>
}
