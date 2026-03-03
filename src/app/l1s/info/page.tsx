"use client"

import { useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { InfoTooltip } from "@/components/tools/InfoTooltip"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { CopyableId } from "@/components/tools/CopyableId"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface L1Info {
  id: string
  controlKeys: string[]
  threshold: number
}

export default function L1InfoPage() {
  const { network } = useNetwork()
  const [l1Id, setL1Id] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [l1, setL1] = useState<L1Info | null>(null)
  const [validatorCount, setValidatorCount] = useState<number | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function handleLookup() {
    if (!l1Id.trim()) return
    setLoading(true)
    setError("")
    setL1(null)
    setValidatorCount(null)
    clearRaw()
    try {
      const [results, validators] = await Promise.all([
        AvalancheService.getSubnets(network.baseUrl, [l1Id.trim()]),
        AvalancheService.getSubnetValidators(network.baseUrl, l1Id.trim()),
      ])
      if (results.length === 0) {
        setError("L1 not found")
        return
      }
      setL1(results[0] as L1Info)
      setValidatorCount((validators as unknown[]).length)
      captureRaw()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch L1 info")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolCard
      title="L1 Info"
      description="Look up detailed information for a specific L1."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <FormField
          label="L1 ID"
          id="l1-id"
          value={l1Id}
          onChange={setL1Id}
          placeholder="Enter L1 ID..."
          monospace
        />
        <LoadingButton loading={loading} onClick={handleLookup}>
          Look Up L1
        </LoadingButton>

        {error && <p className="text-destructive text-sm">{error}</p>}

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
                { label: "Validators", value: validatorCount !== null ? String(validatorCount) : "N/A" },
                { label: "L1 ID", value: l1.id, mono: true, fullWidth: true, copyable: true },
              ]}
            />

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
    </ToolCard>
  )
}
