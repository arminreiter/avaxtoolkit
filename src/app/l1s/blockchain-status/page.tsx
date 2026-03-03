"use client"

import { useState } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { AvalancheService } from "@/lib/services/avalanche.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { InfoCard } from "@/components/tools/InfoCard"
import { CopyableId } from "@/components/tools/CopyableId"
import { Badge } from "@/components/ui/badge"

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  Validating: "default",
  Created: "secondary",
  Preferred: "default",
  Syncing: "secondary",
  Unknown: "destructive",
}

export default function BlockchainStatusPage() {
  const { network } = useNetwork()
  const [blockchainID, setBlockchainID] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function handleLookup() {
    if (!blockchainID.trim()) return
    setLoading(true)
    setError("")
    setStatus(null)
    clearRaw()
    try {
      const result = await AvalancheService.getBlockchainStatus(
        network.baseUrl,
        blockchainID.trim(),
      )
      setStatus(result.status)
      captureRaw()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch blockchain status")
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolCard
      title="Blockchain Status"
      description="Check the sync/validation status of a specific blockchain by its ID."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <FormField
          label="Blockchain ID"
          id="blockchain-id"
          value={blockchainID}
          onChange={setBlockchainID}
          placeholder="Enter blockchain ID..."
          monospace
        />
        <LoadingButton loading={loading} onClick={handleLookup}>
          Check Status
        </LoadingButton>

        {error && <p className="text-destructive text-sm">{error}</p>}

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
                <CopyableId value={blockchainID.trim()} className="text-xs text-muted-foreground font-mono" />
              </div>
            </div>
          </InfoCard>
        )}
      </div>
    </ToolCard>
  )
}
