"use client"

import { useState, useCallback } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { OutputDisplay } from "@/components/tools/OutputDisplay"
import { SectionHeading } from "@/components/tools/SectionHeading"
import { InfoCard } from "@/components/tools/InfoCard"
import { CopyableId } from "@/components/tools/CopyableId"
import { normalizePChainAddress, nAvaxToAvax } from "@/lib/utils"
import { TimeProgress } from "@/components/tools/TimeProgress"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Validator } from "@/lib/models/avalanche"

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

function findPositionsForAddress(validators: Validator[], address: string): StakingPosition[] {
  const positions: StakingPosition[] = []
  const normalizedAddr = address.toLowerCase()

  for (const v of validators) {
    const rewardAddrs: string[] = v.validationRewardOwner?.addresses ?? []
    const matchesValidator = rewardAddrs.some(
      a => a.toLowerCase() === normalizedAddr
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
        a => a.toLowerCase() === normalizedAddr
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

export default function StakingHistoryPage() {
  const { network } = useNetwork()
  const [address, setAddress] = useState("")
  const [stakeData, setStakeData] = useState<StakeResult | null>(null)
  const [positions, setPositions] = useState<StakingPosition[]>([])
  const [utxoData, setUtxoData] = useState<{ numFetched: string; utxos: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fetched, setFetched] = useState(false)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function handleLookup() {
    if (!address.trim()) return
    setLoading(true)
    setError("")
    setStakeData(null)
    setPositions([])
    setUtxoData(null)
    setFetched(false)
    clearRaw()
    const normalizedAddress = normalizePChainAddress(address)
    try {
      const stakeResult = await AvalancheService.getStake(network.baseUrl, [normalizedAddress])
      setStakeData(stakeResult)

      const [validatorsResult, utxosResult] = await Promise.allSettled([
        AvalancheService.getValidators(network.baseUrl),
        AvalancheService.getUTXOs(network.baseUrl, [normalizedAddress]),
      ])

      if (validatorsResult.status === "fulfilled") {
        const found = findPositionsForAddress(validatorsResult.value, normalizedAddress)
        setPositions(found)
      }

      if (utxosResult.status === "fulfilled") {
        setUtxoData(utxosResult.value)
      }

      captureRaw()
      setFetched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch staking data")
      setFetched(true)
    } finally {
      setLoading(false)
    }
  }

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
    a.download = `staking-data-${address.trim()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [stakeData, positions, address])

  const exportJSON = useCallback(() => {
    if (!stakeData) return
    const data = {
      address: normalizePChainAddress(address),
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
    a.download = `staking-data-${address.trim()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [stakeData, positions, utxoData, address])

  return (
    <ToolCard
      title="Staking History"
      description="Look up staking data, active positions, and UTXOs for a P-Chain address."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <div className="space-y-4">
          <FormField
            label="P-Chain Address"
            id="p-address"
            value={address}
            onChange={setAddress}
            placeholder="P-avax1... or avax1..."
            monospace
          />
          <LoadingButton loading={loading} onClick={handleLookup}>
            Fetch Staking Data
          </LoadingButton>
        </div>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {fetched && stakeData && (
          <div className="space-y-4">
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

              {positions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active staking positions found for this address.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {positions.map((p, i) => (
                    <Card key={`${p.txID}-${i}`}>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Badge variant={p.role === "Validator" ? "default" : "secondary"}>
                            {p.role}
                          </Badge>
                          <CopyableId value={p.nodeID} className="font-mono text-sm truncate" />
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
                    Found {utxoData.numFetched} UTXO{utxoData.numFetched !== "1" ? "s" : ""}
                  </p>
                  {utxoData.utxos.length > 0 && (
                    <OutputDisplay
                      label="UTXO Data"
                      value={JSON.stringify(utxoData.utxos, null, 2)}
                    />
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
