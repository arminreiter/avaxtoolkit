"use client"

import { useState } from "react"
import { getAddress } from "ethers"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { OutputDisplay } from "@/components/tools/OutputDisplay"

export default function AddressConverterPage() {
  const [inputAddress, setInputAddress] = useState("")
  const [checksummed, setChecksummed] = useState("")
  const [lowercase, setLowercase] = useState("")
  const [error, setError] = useState("")

  function handleConvert() {
    setError("")
    setChecksummed("")
    setLowercase("")

    const trimmed = inputAddress.trim()
    if (!trimmed) {
      setError("Please enter an address.")
      return
    }

    try {
      const checksumAddress = getAddress(trimmed)
      setChecksummed(checksumAddress)
      setLowercase(checksumAddress.toLowerCase())
    } catch {
      setError("Invalid Ethereum/C-Chain address. Please enter a valid 0x-prefixed address.")
    }
  }

  return (
    <ToolCard
      title="Address Format Converter"
      description="Validate and convert Ethereum/C-Chain addresses to checksummed format."
    >
      <div className="space-y-6">
        <FormField
          label="Address"
          id="input-address"
          value={inputAddress}
          onChange={setInputAddress}
          placeholder="0x..."
          monospace
        />

        <LoadingButton onClick={handleConvert}>
          Convert Address
        </LoadingButton>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {checksummed && (
          <div className="space-y-4">
            <OutputDisplay label="Checksummed Address (EIP-55)" value={checksummed} />
            <OutputDisplay label="Lowercase Address" value={lowercase} />
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <strong>Note:</strong> This tool currently supports C-Chain (EVM) addresses only.
          X-Chain and P-Chain address format conversion (Bech32 with &quot;avax&quot; prefix) is coming soon.
        </div>
      </div>
    </ToolCard>
  )
}
