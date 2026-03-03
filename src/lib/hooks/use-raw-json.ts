import { useState, useCallback } from "react"
import { RpcService } from "@/lib/services/rpc.service"
import { CChainService } from "@/lib/services/cchain.service"

export function useRawJson() {
  const [rawJson, setRawJson] = useState<Record<string, unknown> | null>(null)

  const clearRaw = useCallback(() => {
    RpcService.clearRawResponses()
    CChainService.clearRawResponses()
  }, [])

  const captureRaw = useCallback(() => {
    const raw = {
      ...RpcService.getRawResponses(),
      ...CChainService.getRawResponses(),
    }
    if (Object.keys(raw).length > 0) {
      setRawJson(raw)
    }
  }, [])

  return { rawJson, clearRaw, captureRaw }
}
