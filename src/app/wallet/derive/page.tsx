"use client"

import { useState, useMemo } from "react"
import { type DerivedAddress, DEFAULT_DERIVATION_BASE, deriveAddresses } from "@/lib/utils/wallet"
import { Check, Eye, EyeOff, Plus } from "lucide-react"
import { useWallet } from "@/lib/contexts/wallet-context"
import { CopyableId } from "@/components/tools/CopyableId"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DataTable, Column } from "@/components/tools/DataTable"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { errorMessage } from "@/lib/utils"

const MAX_ADDRESSES = 100

export default function DeriveAddressesPage() {
  const [seedPhrase, setSeedPhrase] = useState("")
  const [derivationPath, setDerivationPath] = useState(DEFAULT_DERIVATION_BASE)
  const [count, setCount] = useState("5")
  const [addresses, setAddresses] = useState<DerivedAddress[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [revealedKeys, setRevealedKeys] = useState<Set<number>>(new Set())
  const [addedIndices, setAddedIndices] = useState<Set<number>>(new Set())
  const [derivedPath, setDerivedPath] = useState("")
  const { addWallet } = useWallet()
  const [showSeedPhrase, setShowSeedPhrase] = useState(false)

  function handleDerive() {
    setError("")
    setAddresses([])
    setRevealedKeys(new Set())
    setAddedIndices(new Set())

    const trimmedPhrase = seedPhrase.trim()
    if (!trimmedPhrase) {
      setError("Please enter a seed phrase.")
      return
    }
    const numAddresses = parseInt(count)
    if (!(numAddresses >= 1 && numAddresses <= MAX_ADDRESSES)) {
      setError(`Number of addresses must be between 1 and ${MAX_ADDRESSES}.`)
      return
    }
    const path = derivationPath.trim()
    setLoading(true)

    // Yield to browser so loading spinner renders before CPU-bound derivation
    setTimeout(() => {
      try {
        setAddresses(deriveAddresses(trimmedPhrase, path, numAddresses))
        setDerivedPath(path)
      } catch (err) {
        setError(errorMessage(err, "Failed to derive addresses. Check your seed phrase."))
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
        <CopyableId value={row.address} explorer="address" className="font-mono text-xs" />
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
            type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0"
            aria-label={revealedKeys.has(row.index) ? "Hide private key" : "Reveal private key"}
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
    {
      key: "actions",
      label: "Wallet",
      render: (row) => (
        <Button
          type="button" variant="ghost" size="sm" className="h-7 text-xs"
          disabled={addedIndices.has(row.index)}
          onClick={() => {
            addWallet({
              id: crypto.randomUUID(),
              name: `Derived #${row.index}`,
              type: "private-key",
              address: row.address,
              privateKey: row.privateKey,
              createdAt: Date.now(),
            })
            setAddedIndices(prev => new Set(prev).add(row.index))
          }}
        >
          {addedIndices.has(row.index) ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {addedIndices.has(row.index) ? "Added" : "Add as wallet"}
        </Button>
      ),
    },
  ], [revealedKeys, addedIndices, addWallet])

  return (
    <ToolCard
      title="Derive Addresses"
      description="Derive multiple addresses from a BIP-39 seed phrase using HD wallet derivation paths."
    >
      <form className="space-y-6" onSubmit={e => { e.preventDefault(); handleDerive() }}>
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400">
          <strong>Security Warning:</strong> Never enter a real seed phrase on an untrusted device.
          This tool runs entirely in your browser and does not transmit data.
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="seed-phrase">Seed Phrase</Label>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowSeedPhrase(v => !v)}>
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
            label={`Number of Addresses (max ${MAX_ADDRESSES})`}
            id="address-count"
            value={count}
            onChange={setCount}
            placeholder="5"
            type="number"
          />
        </div>

        <LoadingButton type="submit" loading={loading}>
          Derive Addresses
        </LoadingButton>

        {error && (
          <p className="text-destructive text-sm">{error}</p>
        )}

        {addresses.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Derived {addresses.length} addresses from path {derivedPath}
            </p>
            <DataTable columns={columns} data={addresses} emptyMessage="No addresses derived" />
          </div>
        )}
      </form>
    </ToolCard>
  )
}
