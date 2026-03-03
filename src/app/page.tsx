"use client"

import { useEffect, useState, useCallback } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { CChainService } from "@/lib/services/cchain.service"
import { StatCard } from "@/components/dashboard/StatCard"
import { NetworkHealth } from "@/components/dashboard/NetworkHealth"
import { StakingRatio } from "@/components/dashboard/StakingRatio"
import { RecentBlocks } from "@/components/dashboard/RecentBlocks"
import { Shield, Coins, Fuel, Network, Mountain, ArrowDown, ArrowUp, Weight, Clock } from "lucide-react"
import { nAvaxToAvax } from "@/lib/utils"

const STAT_KEYS = [
  "validatorCount", "supply", "gasPrice", "l1Count",
  "height", "totalStake", "timestamp", "minValidatorStake", "minDelegatorStake",
] as const

type StatKey = (typeof STAT_KEYS)[number]

const DEFAULTS: Record<StatKey, string> = {
  validatorCount: "\u2014",
  supply: "\u2014",
  gasPrice: "\u2014",
  l1Count: "\u2014",
  height: "\u2014",
  totalStake: "\u2014",
  timestamp: "\u2014",
  minValidatorStake: "\u2014",
  minDelegatorStake: "\u2014",
}

function DashboardContent() {
  const { network, endpoints } = useNetwork()
  const [values, setValues] = useState<Record<StatKey, string>>(DEFAULTS)
  const [loadingSet, setLoadingSet] = useState<Set<StatKey>>(() => new Set(STAT_KEYS))
  const [stakingData, setStakingData] = useState<{ staked: string | null; supply: string | null }>({ staked: null, supply: null })

  const setVal = useCallback((key: StatKey, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }))
  }, [])

  const setDone = useCallback((key: StatKey) => {
    setLoadingSet(prev => {
      const next = new Set(prev)
      next.delete(key)
      return next
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    function fetchStat(key: StatKey, fetcher: () => Promise<string>) {
      fetcher()
        .then(v => { if (!cancelled) setVal(key, v) })
        .catch(() => {})
        .finally(() => { if (!cancelled) setDone(key) })
    }

    fetchStat("supply", async () => {
      const result = await AvalancheService.getCurrentSupply(network.baseUrl)
      if (!cancelled) setStakingData(prev => ({ ...prev, supply: result.supply }))
      return `${(Number(result.supply) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 0 })} AVAX`
    })

    fetchStat("gasPrice", async () => {
      const data = await CChainService.getGasPrice(endpoints.cChain)
      return `${parseFloat(data.gasPriceGwei).toFixed(2)} nAVAX`
    })

    fetchStat("l1Count", async () => {
      const l1s = await AvalancheService.getSubnets(network.baseUrl)
      return l1s.length.toLocaleString()
    })

    fetchStat("height", async () => {
      const result = await AvalancheService.getPChainHeight(network.baseUrl)
      return Number(result.height).toLocaleString()
    })

    fetchStat("totalStake", async () => {
      const result = await AvalancheService.getTotalStake(network.baseUrl)
      if (!cancelled) setStakingData(prev => ({ ...prev, staked: result.stake || result.weight }))
      return `${nAvaxToAvax(result.stake || result.weight, 0)} AVAX`
    })

    fetchStat("timestamp", async () => {
      const result = await AvalancheService.getPChainTimestamp(network.baseUrl)
      return new Date(result.timestamp).toLocaleString()
    })

    // Single call for both min stakes (async-parallel: avoid duplicate requests)
    AvalancheService.getMinStake(network.baseUrl)
      .then(result => {
        if (cancelled) return
        setVal("minValidatorStake", `${nAvaxToAvax(result.minValidatorStake, 0)} AVAX`)
        setDone("minValidatorStake")
        setVal("minDelegatorStake", `${nAvaxToAvax(result.minDelegatorStake, 0)} AVAX`)
        setDone("minDelegatorStake")
      })
      .catch(() => {
        if (!cancelled) {
          setDone("minValidatorStake")
          setDone("minDelegatorStake")
        }
      })

    // Defer the heavy getValidators call (huge payload) so lighter RPCs
    // grab connections first and aren't queued behind it.
    const timer = setTimeout(() => {
      fetchStat("validatorCount", async () => {
        const validators = await AvalancheService.getValidators(network.baseUrl)
        return validators.length.toLocaleString()
      })
    }, 50)

    return () => { cancelled = true; clearTimeout(timer) }
  }, [network.baseUrl, endpoints.cChain, setVal, setDone])

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3">
          <span className="text-primary font-mono text-sm select-none">$</span>
          <h1 className="text-2xl font-bold font-display tracking-wider uppercase">Dashboard</h1>
          <span className="cursor-blink text-primary text-lg leading-none">_</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 font-mono pl-5">
          <span className="text-muted-foreground/40">{"//"} </span>
          network_overview &mdash; endpoint:<span className="text-foreground/80">{network.name}</span>
        </p>
      </div>

      {/* Section: Primary stats */}
      <div>
        <div className="flex items-center gap-2 mb-2 pl-1">
          <span className="ascii-sep">{"["}</span>
          <span className="text-[11px] font-mono text-muted-foreground/60 tracking-[0.15em] uppercase">core metrics</span>
          <span className="ascii-sep">{"]"}</span>
          <span className="ascii-sep flex-1">{"─".repeat(30)}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <StatCard
            label="Active Validators"
            value={values.validatorCount}
            icon={Shield}
            loading={loadingSet.has("validatorCount")}
            rpcInfo="platform.getCurrentValidators"
            iconColor="red"
            delay={50}
          />
          <StatCard
            label="Current Supply"
            value={values.supply}
            icon={Coins}
            loading={loadingSet.has("supply")}
            rpcInfo="platform.getCurrentSupply"
            iconColor="amber"
            delay={100}
          />
          <StatCard
            label="Gas Price"
            value={values.gasPrice}
            icon={Fuel}
            loading={loadingSet.has("gasPrice")}
            rpcInfo="eth_feeData"
            iconColor="cyan"
            delay={150}
          />
          <StatCard
            label="L1s"
            value={values.l1Count}
            icon={Network}
            loading={loadingSet.has("l1Count")}
            rpcInfo="platform.getSubnets"
            iconColor="purple"
            delay={200}
          />
        </div>
      </div>

      {/* Section: Extended stats */}
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <StatCard
            label="P-Chain Height"
            value={values.height}
            icon={Mountain}
            loading={loadingSet.has("height")}
            rpcInfo="platform.getHeight"
            delay={250}
          />
          <StatCard
            label="Total Stake"
            value={values.totalStake}
            icon={Weight}
            loading={loadingSet.has("totalStake")}
            rpcInfo="platform.getTotalStake"
            delay={300}
          />
          <StatCard
            label="P-Chain Time"
            value={values.timestamp}
            icon={Clock}
            loading={loadingSet.has("timestamp")}
            rpcInfo="platform.getTimestamp"
            delay={350}
          />
          <StatCard
            label="Min Validator Stake"
            value={values.minValidatorStake}
            icon={ArrowUp}
            loading={loadingSet.has("minValidatorStake")}
            rpcInfo="platform.getMinStake"
            delay={400}
          />
          <StatCard
            label="Min Delegator Stake"
            value={values.minDelegatorStake}
            icon={ArrowDown}
            loading={loadingSet.has("minDelegatorStake")}
            rpcInfo="platform.getMinStake"
            delay={450}
          />
        </div>
      </div>

      {/* Section: Widgets */}
      <div>
        <div className="flex items-center gap-2 mb-2 pl-1">
          <span className="ascii-sep">{"["}</span>
          <span className="text-[11px] font-mono text-muted-foreground/60 tracking-[0.15em] uppercase">system status</span>
          <span className="ascii-sep">{"]"}</span>
          <span className="ascii-sep flex-1">{"─".repeat(30)}</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-3">
            <NetworkHealth />
            <StakingRatio staked={stakingData.staked} supply={stakingData.supply} />
          </div>
          <RecentBlocks />
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { network, endpoints } = useNetwork()
  const networkKey = `${network.baseUrl}|${endpoints.cChain}`

  // Use key to auto-reset all state when network changes (instead of setState-during-render)
  return <DashboardContent key={networkKey} />
}
