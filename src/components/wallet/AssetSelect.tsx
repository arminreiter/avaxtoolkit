"use client"

import { useState, useEffect } from "react"
import { type TrackedToken, loadTokens } from "@/lib/models/token"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Select value for native AVAX; any other value is a tracked token's contract address. */
export const NATIVE_ASSET = "AVAX"

/**
 * Asset picker state for a chain: the tracked token list, the selection (reset to AVAX on chain
 * switch) and the selected token (undefined = native AVAX). `initialAsset` preselects a tracked
 * token by contract address (e.g. from ?asset=); unknown addresses fall back to AVAX.
 */
export function useAssetSelection(chainId: number, initialAsset?: string) {
  const [tokens, setTokens] = useState<TrackedToken[]>([])
  const [asset, setAsset] = useState(NATIVE_ASSET)

  useEffect(() => {
    // localStorage is only readable after mount (static export)
    Promise.resolve().then(() => {
      const list = loadTokens(chainId)
      setTokens(list)
      const wanted = initialAsset?.toLowerCase()
      setAsset(list.find(t => t.address.toLowerCase() === wanted)?.address ?? NATIVE_ASSET)
    })
  }, [chainId, initialAsset])

  const token = tokens.find(t => t.address === asset)
  return { tokens, asset, setAsset, token, symbol: token?.symbol ?? NATIVE_ASSET }
}

interface AssetSelectProps {
  tokens: TrackedToken[]
  value: string
  onChange: (value: string) => void
}

export function AssetSelect({ tokens, value, onChange }: AssetSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="asset">Asset</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="asset" className="w-full sm:w-72"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NATIVE_ASSET}>AVAX (native)</SelectItem>
          {tokens.map(t => (
            <SelectItem key={t.address} value={t.address}>{t.symbol} — {t.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">Manage the token list on the Tokens page.</p>
    </div>
  )
}
