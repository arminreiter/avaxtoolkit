"use client"

import { useState, useMemo } from "react"
import { HDNodeWallet } from "ethers/wallet"
import { Eye, EyeOff } from "lucide-react"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DataTable, Column } from "@/components/tools/DataTable"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"

interface DerivedAddress {
  index: number
  address: string
  privateKey: string
  [key: string]: unknown
}

export default function DeriveAddressesPage() {
  const [seedPhrase, setSeedPhrase] = useState("")
  const [derivationPath, setDerivationPath] = useState("m/44'/60'/0'/0/")
  const [count, setCount] = useState("5")
  const [addresses, setAddresses] = useState<DerivedAddress[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set())
  const [showSeedPhrase, setShowSeedPhrase] = useState(false)

  function handleDerive() {
    setError("")
    setAddresses([])
    setLoading(true)

    const trimmedPhrase = seedPhrase.trim()
    if (!trimmedPhrase) {
      setError("Please enter a seed phrase.")
      setLoading(false)
      return
    }

    // Yield to browser so loading spinner renders before CPU-bound derivation
    setTimeout(() => {
      try {
        const numAddresses = Math.min(Math.max(parseInt(count) || 1, 1), 100)
        const basePath = derivationPath.trim()
        const results: DerivedAddress[] = []

        for (let i = 0; i < numAddresses; i++) {
          const path = `${basePath}${i}`
          const wallet = HDNodeWallet.fromPhrase(trimmedPhrase, undefined, path)
          results.push({
            index: i,
            address: wallet.address,
            privateKey: wallet.privateKey,
          })
        }

        setAddresses(results)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to derive addresses. Check your seed phrase.")
      } finally {
        setLoading(false)
      }
    }, 0)
  }

  const columns = useMemo<Column<DerivedAddress>[]>(() => [
    {
      key: "index",
      label: "Index",
      render: (row) => (
        <span className="font-mono text-xs">{row.index}</span>
      ),
      sortValue: (row) => row.index,
    },
    {
      key: "address",
      label: "Address",
      render: (row) => (
        <span className="font-mono text-xs break-all">{row.address}</span>
      ),
      sortValue: (row) => row.address,
    },
    {
      key: "privateKey",
      label: "Private Key",
      render: (row) => (
        <span className="font-mono text-xs break-all flex items-center gap-1">
          {revealedKeys.has(row.index) ? row.privateKey : "\u2022".repeat(16)}
          <Button
            variant="ghost" size="icon" className="h-5 w-5 shrink-0"
            onClick={() => setRevealedKeys(prev => {
              const next = new Set(prev)
              if (next.has(row.index)) next.delete(row.index)
              else next.add(row.index)
              return next
            })}
          >
            {revealedKeys.has(row.index) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </Button>
        </span>
      ),
      sortValue: (row) => row.privateKey,
    },
  ], [revealedKeys])

  return (
    <ToolCard
      title="Derive Addresses"
      description="Derive multiple addresses from a BIP-39 seed phrase using HD wallet derivation paths."
    >
      <div className="space-y-6">
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400">
          <strong>Security Warning:</strong> Never enter a real seed phrase on an untrusted device.
          This tool runs entirely in your browser and does not transmit data.
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="seed-phrase">Seed Phrase</Label>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowSeedPhrase(v => !v)}>
              {showSeedPhrase ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {showSeedPhrase ? "Hide" : "Show"}
            </Button>
          </div>
          {showSeedPhrase ? (
            <Textarea
              id="seed-phrase"
              value={seedPhrase}
              onChange={e => setSeedPhrase(e.target.value)}
              placeholder="Enter your 12 or 24 word seed phrase..."
              className="font-mono text-sm"
              rows={4}
              autoComplete="off"
            />
          ) : (
            <Input
              id="seed-phrase"
              type="password"
              value={seedPhrase}
              onChange={e => setSeedPhrase(e.target.value)}
              placeholder="Enter your 12 or 24 word seed phrase..."
              className="font-mono text-sm"
              autoComplete="off"
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Derivation Path"
            id="derivation-path"
            value={derivationPath}
            onChange={setDerivationPath}
            placeholder="m/44'/60'/0'/0/"
            monospace
          />
          <FormField
            label="Number of Addresses"
            id="address-count"
            value={count}
            onChange={setCount}
            placeholder="5"
            type="number"
          />
        </div>

        <LoadingButton loading={loading} onClick={handleDerive}>
          Derive Addresses
        </LoadingButton>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {addresses.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Derived {addresses.length} addresses from path {derivationPath}
            </p>
            <DataTable columns={columns} data={addresses} emptyMessage="No addresses derived" />
          </div>
        )}
      </div>
    </ToolCard>
  )
}
