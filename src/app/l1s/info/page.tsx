"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { appLinks } from "@/lib/explorer-links"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { CopyableId } from "@/components/tools/CopyableId"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Blockchain, Subnet, SubnetInfo } from "@/lib/models/avalanche"
import { errorMessage } from "@/lib/utils"

function L1InfoPageInner() {
  const { network } = useNetwork()
  const [param, setParam] = useQueryParam("l1")
  const [l1Id, setL1Id] = useState(param)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [l1, setL1] = useState<Subnet | null>(null)
  const [info, setInfo] = useState<SubnetInfo | null>(null)
  const [chains, setChains] = useState<Blockchain[]>([])
  const [validatorCount, setValidatorCount] = useState<number | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const lookup = useCallback(async (id: string) => {
    setLoading(true)
    setError("")
    setL1(null)
    setInfo(null)
    setChains([])
    setValidatorCount(null)
    clearRaw()
    try {
      const [results, validators, blockchains, subnetInfo] = await Promise.all([
        AvalancheService.getSubnets(network.baseUrl, [id]),
        AvalancheService.getSubnetValidators(network.baseUrl, id),
        AvalancheService.getBlockchains(network.baseUrl),
        // ponytail: older nodes lack platform.getSubnet; conversion details are optional
        AvalancheService.getSubnet(network.baseUrl, id).catch(() => null),
      ])
      if (results.length === 0) {
        setError("L1 not found")
        return
      }
      setL1(results[0])
      setInfo(subnetInfo)
      setChains(blockchains.filter(b => b.subnetID === id))
      setValidatorCount(validators.length)
      captureRaw()
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch L1 info"))
    } finally {
      setLoading(false)
    }
  }, [network.baseUrl, clearRaw, captureRaw])

  // Deep links and back/forward: run whenever the URL param changes
  useEffect(() => {
    if (param && !network.plainRpc) Promise.resolve().then(() => lookup(param))
  }, [param, lookup, network.plainRpc])

  function handleSubmit() {
    const id = l1Id.trim()
    if (!id) return
    if (id === param) lookup(id)
    else setParam(id)
  }

  return (
    <ToolCard
      title="L1 Info"
      description="Look up detailed information for a specific L1."
      rawJson={rawJson}
    >
      {network.plainRpc ? (
        <p className="text-sm text-muted-foreground">
          L1 lookups are not supported on this network (plain RPC endpoint, C-Chain only).
        </p>
      ) : (
        <div className="space-y-4">
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSubmit() }}>
            <FormField
              label="L1 ID"
              id="l1-id"
              value={l1Id}
              onChange={setL1Id}
              placeholder="Enter L1 ID..."
              monospace
            />
            <LoadingButton type="submit" loading={loading}>
              Look Up L1
            </LoadingButton>
          </form>

          {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <div className="h-4 bg-muted rounded animate-pulse w-1/2 mb-2" />
                    <div className="h-6 bg-muted rounded animate-pulse w-3/4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && !error && l1 && (
            <div className="space-y-3">
              <DetailGrid
                title="L1 Details"
                rpcMethod="platform.getSubnets"
                columns={3}
                items={[
                  { label: "Threshold", value: String(l1.threshold) },
                  { label: "Control Keys", value: String(l1.controlKeys?.length ?? 0) },
                  {
                    label: "Validators",
                    value: validatorCount !== null ? (
                      <Link href={appLinks.l1Validators(l1.id)} className="text-sm font-medium hover:text-primary hover:underline underline-offset-2">
                        {validatorCount}
                      </Link>
                    ) : "N/A",
                  },
                  { label: "L1 ID", value: <CopyableId value={l1.id} explorer="l1" className="text-sm font-mono" />, fullWidth: true },
                ]}
              />

              {info && (
                <DetailGrid
                  title="Conversion"
                  rpcMethod="platform.getSubnet"
                  items={
                    info.isPermissioned
                      ? [{ label: "Type", value: "Permissioned (not converted to L1)", fullWidth: true }]
                      : [
                          { label: "Type", value: "Converted L1" },
                          {
                            label: "Manager Chain ID",
                            value: <CopyableId value={info.managerChainID} href={appLinks.blockchainStatus(info.managerChainID)} explorer="blockchain" className="text-sm font-mono" />,
                          },
                          { label: "Conversion ID", value: <CopyableId value={info.conversionID} className="text-sm font-mono" />, fullWidth: true },
                          ...(info.managerAddress
                            ? [{ label: "Manager Address", value: <CopyableId value={info.managerAddress} className="text-sm font-mono" />, fullWidth: true }]
                            : []),
                        ]
                  }
                />
              )}

              <Card>
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">Blockchains</CardTitle>
                    <InfoTooltip rpcMethod="platform.getBlockchains" />
                  </div>
                </CardHeader>
                <CardContent>
                  {chains.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No blockchains on this L1</p>
                  ) : (
                    <div className="space-y-1">
                      {chains.map((chain) => (
                        <div key={chain.id} className="flex flex-wrap items-center gap-x-2 text-xs">
                          <span className="font-medium">{chain.name}</span>
                          <CopyableId
                            value={chain.id}
                            href={appLinks.blockchainStatus(chain.id)}
                            explorer="blockchain"
                            className="font-mono text-muted-foreground"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {l1.controlKeys && l1.controlKeys.length > 0 && (
                <Card>
                  <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        Control Key Addresses
                      </CardTitle>
                      <InfoTooltip rpcMethod="platform.getSubnets" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {l1.controlKeys.map((key, i) => (
                        <CopyableId
                          key={i}
                          value={key}
                          explorer="pAddress"
                          className="text-xs font-mono text-muted-foreground"
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </ToolCard>
  )
}

export default function L1InfoPage() {
  const { network } = useNetwork()
  return <Suspense fallback={null}><L1InfoPageInner key={network.id} /></Suspense>
}
