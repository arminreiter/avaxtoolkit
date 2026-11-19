"use client"

import { useState } from "react"
import { getAddress } from "ethers/address"
import { computeAddress } from "ethers/transaction"
import { useNetwork } from "@/lib/contexts/network-context"
import { hrpForNetwork } from "@/lib/models/network"
import { appLinks, type ExplorerKind } from "@/lib/explorer-links"
import { bech32Decode, bech32Encode, pxAddressFromPrivateKey, pxAddressFromPublicKey } from "@/lib/utils/wallet"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { CopyableId } from "@/components/tools/CopyableId"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Mode = "c-address" | "private-key" | "public-key" | "bech32"

const MODES: { value: Mode; label: string; placeholder: string }[] = [
  { value: "c-address", label: "C-Chain address (0x)", placeholder: "0x..." },
  { value: "private-key", label: "Private key", placeholder: "0x... (64 hex chars)" },
  { value: "public-key", label: "Compressed public key", placeholder: "0x02... / 0x03... (66 hex chars)" },
  { value: "bech32", label: "P/X-Chain address (bech32)", placeholder: "P-avax1... / X-fuji1... / local1..." },
]

const HRPS = ["avax", "fuji", "local"]

interface Output { label: string; value: string; explorer?: ExplorerKind; href?: string }

function withHex(s: string) {
  return s.startsWith("0x") ? s : `0x${s}`
}

function pxOutputs(bare: string, explorer: boolean): Output[] {
  return [
    { label: "P-Chain Address", value: `P-${bare}`, explorer: explorer ? "pAddress" : undefined, href: explorer ? appLinks.stakingHistory(`P-${bare}`) : undefined },
    { label: "X-Chain Address", value: `X-${bare}`, explorer: explorer ? "xAddress" : undefined, href: explorer ? appLinks.xBalance(`X-${bare}`) : undefined },
  ]
}

export default function AddressConverterPage() {
  const { network } = useNetwork()
  const networkHrp = hrpForNetwork(network)
  const [mode, setMode] = useState<Mode>("c-address")
  const [input, setInput] = useState("")
  const [hrp, setHrp] = useState(HRPS.includes(networkHrp) ? networkHrp : "avax")
  const [outputs, setOutputs] = useState<Output[]>([])
  const [error, setError] = useState("")

  function convert(): Output[] {
    const value = input.trim()
    // ponytail: explorer/internal links only make sense when the HRP matches the selected network
    const links = hrp === networkHrp
    switch (mode) {
      case "c-address": {
        const checksummed = getAddress(value)
        return [
          { label: "Checksummed Address (EIP-55)", value: checksummed, explorer: "address", href: appLinks.address(checksummed) },
          { label: "Lowercase Address", value: checksummed.toLowerCase() },
        ]
      }
      case "private-key": {
        const key = withHex(value)
        const c = computeAddress(key)
        return [
          { label: "C-Chain Address", value: c, explorer: "address", href: appLinks.address(c) },
          ...pxOutputs(pxAddressFromPrivateKey(key, hrp), links),
        ]
      }
      case "public-key": {
        const pub = withHex(value)
        if (!/^0x0[23][0-9a-fA-F]{64}$/.test(pub)) throw new Error("Expected a 33-byte compressed public key (0x02/0x03 prefix).")
        const c = computeAddress(pub)
        return [
          { label: "C-Chain Address", value: c, explorer: "address", href: appLinks.address(c) },
          ...pxOutputs(pxAddressFromPublicKey(pub, hrp), links),
        ]
      }
      case "bech32": {
        const { bytes } = bech32Decode(value.replace(/^[PX]-/i, ""))
        if (bytes.length !== 20) throw new Error("Expected a 20-byte address.")
        return pxOutputs(bech32Encode(hrp, bytes), links)
      }
    }
  }

  function handleConvert() {
    setError("")
    setOutputs([])
    if (!input.trim()) {
      setError("Please enter a value.")
      return
    }
    try {
      setOutputs(convert())
    } catch (err) {
      const label = MODES.find(m => m.value === mode)!.label
      setError(`Invalid ${label.toLowerCase()}.${err instanceof Error && err.message.startsWith("Expected") ? ` ${err.message}` : ""}`)
    }
  }

  const current = MODES.find(m => m.value === mode)!

  return (
    <ToolCard
      title="Address Format Converter"
      description="Checksum C-Chain addresses and derive or re-encode P/X-Chain (bech32) addresses from a private key, public key, or address."
    >
      <div className="space-y-6">
        <form className="space-y-6" onSubmit={e => { e.preventDefault(); handleConvert() }}>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="space-y-2">
              <Label htmlFor="input-mode">Input</Label>
              <Select value={mode} onValueChange={v => { setMode(v as Mode); setInput(""); setOutputs([]); setError("") }}>
                <SelectTrigger id="input-mode" className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {mode !== "c-address" && (
              <div className="space-y-2">
                <Label htmlFor="hrp">Bech32 Prefix (HRP)</Label>
                <Select value={hrp} onValueChange={v => { setHrp(v); setOutputs([]) }}>
                  <SelectTrigger id="hrp" className="w-full sm:w-32 font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HRPS.map(h => <SelectItem key={h} value={h} className="font-mono">{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <FormField
            label={current.label}
            id="convert-input"
            value={input}
            onChange={setInput}
            placeholder={current.placeholder}
            type={mode === "private-key" ? "password" : "text"}
            monospace
          />

          <LoadingButton type="submit">Convert</LoadingButton>
        </form>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {outputs.length > 0 && (
          <div className="space-y-4">
            {outputs.map(o => (
              <div key={o.label} className="space-y-2">
                <Label>{o.label}</Label>
                <div className="bg-muted p-4 text-sm font-mono">
                  <CopyableId value={o.value} href={o.href} explorer={o.explorer} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolCard>
  )
}
