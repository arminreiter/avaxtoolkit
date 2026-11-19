"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { InfoCard } from "@/components/tools/InfoCard"
import { CopyableId } from "@/components/tools/CopyableId"
import { Badge } from "@/components/ui/badge"
import { errorMessage } from "@/lib/utils"

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  Validating: "default",
  Created: "secondary",
  Preferred: "default",
  Syncing: "secondary",
  Unknown: "destructive",
}

function BlockchainStatusPageInner() {
  const { network } = useNetwork()
  const [param, setParam] = useQueryParam("id")
  const [blockchainID, setBlockchainID] = useState(param)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  const lookup = useCallback(async (id: string) => {
    setLoading(true)
    setError("")
    setStatus(null)
    clearRaw()
    try {
      const result = await AvalancheService.getBlockchainStatus(network.baseUrl, id)
      setStatus(result.status)
      captureRaw()
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch blockchain status"))
    } finally {
      setLoading(false)
    }
  }, [network.baseUrl, clearRaw, captureRaw])

  // Deep links and back/forward: run whenever the URL param changes
  useEffect(() => {
    if (param && !network.plainRpc) Promise.resolve().then(() => lookup(param))
  }, [param, lookup, network.plainRpc])

  function handleSubmit() {
    const id = blockchainID.trim()
    if (!id) return
    if (id === param) lookup(id)
    else setParam(id)
  }

  return (
    <ToolCard
      title="Blockchain Status"
      description="Check the sync/validation status of a specific blockchain by its ID."
      rawJson={rawJson}
    >
      {network.plainRpc ? (
        <p className="text-sm text-muted-foreground">
          Blockchain lookups are not supported on this network (plain RPC endpoint, C-Chain only).
        </p>
      ) : (
        <div className="space-y-4">
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSubmit() }}>
            <FormField
              label="Blockchain ID"
              id="blockchain-id"
              value={blockchainID}
              onChange={setBlockchainID}
              placeholder="Enter blockchain ID..."
              monospace
            />
            <LoadingButton type="submit" loading={loading}>
              Check Status
            </LoadingButton>
          </form>

          {error && <p className="text-destructive text-sm" role="alert">{error}</p>}

          {status !== null && (
            <InfoCard label="Blockchain Status" rpcMethod="platform.getBlockchainStatus">
              <div className="space-y-3">
                <Badge variant={STATUS_VARIANTS[status] ?? "secondary"} className="text-sm">
                  {status}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {status === "Validating" && "This blockchain is being actively validated by the network."}
                  {status === "Created" && "This blockchain has been created but is not yet being validated."}
                  {status === "Preferred" && "This blockchain has been proposed and is preferred."}
                  {status === "Syncing" && "This blockchain is currently syncing."}
                  {status === "Unknown" && "This blockchain ID was not found on the network."}
                </p>
                <div className="pt-2 border-t">
                  <span className="text-xs text-muted-foreground">ID: </span>
                  <CopyableId value={param} className="text-xs text-muted-foreground font-mono" />
                </div>
              </div>
            </InfoCard>
          )}
        </div>
      )}
    </ToolCard>
  )
}

export default function BlockchainStatusPage() {
  const { network } = useNetwork()
  return <Suspense fallback={null}><BlockchainStatusPageInner key={network.id} /></Suspense>
}
