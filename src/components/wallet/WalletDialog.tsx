"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { HDNodeWallet, Wallet as EthersWallet, Mnemonic } from "ethers/wallet"
import { randomBytes } from "ethers/crypto"
import { BrowserProvider } from "ethers/providers"
import { Wallet, Plus, Download, Link, Trash2, Check, Pencil, ChevronDown, ChevronRight, GitBranch, FlaskConical, Eye, EyeOff } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useWallet } from "@/lib/contexts/wallet-context"
import { useNetwork } from "@/lib/contexts/network-context"
import type { StoredWallet } from "@/lib/models/wallet"
import { truncateId } from "@/lib/utils"

export function WalletDialog() {
  const { wallets, activeWallet, setActiveWallet, addWallet, removeWallet, renameWallet,
    isWalletDialogOpen, closeWalletDialog } = useWallet()

  const existingAddresses = useMemo(() => wallets.map(w => w.address.toLowerCase()), [wallets])

  return (
    <Dialog open={isWalletDialogOpen} onOpenChange={(open) => { if (!open) closeWalletDialog() }}>
      <DialogContent className="sm:max-w-2xl max-h-[100dvh] sm:max-h-[85vh] h-full sm:h-auto flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display tracking-wider uppercase">
            <Wallet className="h-5 w-5" />
            Wallet Manager
          </DialogTitle>
          <DialogDescription>
            Manage your wallets. Generate, import, or connect a wallet to sign transactions.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="wallets" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="w-full justify-start shrink-0">
            <TabsTrigger value="wallets" className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Wallets</span>
            </TabsTrigger>
            <TabsTrigger value="generate" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Generate</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
            <TabsTrigger value="connect" className="gap-1.5">
              <Link className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Connect</span>
            </TabsTrigger>
            <TabsTrigger value="devtools" className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Dev</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallets" className="mt-4 flex-1 min-h-0 overflow-y-auto">
            <WalletListTab
              wallets={wallets}
              activeWallet={activeWallet}
              onSelect={setActiveWallet}
              onRemove={removeWallet}
              onRename={renameWallet}
              onAdd={addWallet}
            />
          </TabsContent>

          <TabsContent value="generate" className="mt-4 flex-1 min-h-0 overflow-y-auto">
            <GenerateTab onAdd={addWallet} />
          </TabsContent>

          <TabsContent value="import" className="mt-4 flex-1 min-h-0 overflow-y-auto">
            <ImportTab onAdd={addWallet} />
          </TabsContent>

          <TabsContent value="connect" className="mt-4 flex-1 min-h-0 overflow-y-auto">
            <ConnectTab onAdd={addWallet} wallets={wallets} />
          </TabsContent>

          <TabsContent value="devtools" className="mt-4 flex-1 min-h-0 overflow-y-auto">
            <DevWalletsTab onAdd={addWallet} existingAddresses={existingAddresses} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Derive Selector (shared by Generate & Import) ─────────────────── */

interface DerivedAddress {
  index: number
  address: string
  privateKey: string
  path: string
}

function deriveAddresses(mnemonic: string, basePath: string, count: number): DerivedAddress[] {
  const results: DerivedAddress[] = []
  for (let i = 0; i < count; i++) {
    const path = `${basePath}${i}`
    const wallet = HDNodeWallet.fromPhrase(mnemonic, undefined, path)
    results.push({ index: i, address: wallet.address, privateKey: wallet.privateKey, path })
  }
  return results
}

function DeriveSelector({ mnemonic, onSelect, basePath = "m/44'/60'/0'/0/" }: {
  mnemonic: string
  onSelect: (derived: DerivedAddress[]) => void
  basePath?: string
}) {
  const [count, setCount] = useState(5)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set([0]))

  const derived = useMemo(
    () => deriveAddresses(mnemonic, basePath, count),
    [mnemonic, basePath, count]
  )

  // Sync selection to parent via effect (avoids setState-during-render)
  useEffect(() => {
    const selected = derived.filter(d => selectedIndices.has(d.index))
    onSelect(selected)
  }, [selectedIndices, derived, onSelect])

  function toggleIndex(index: number) {
    setSelectedIndices(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function toggleAll() {
    const allSelected = derived.every(d => selectedIndices.has(d.index))
    if (allSelected) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(derived.map(d => d.index)))
    }
  }

  // Reset selection when mnemonic changes
  const [prevMnemonic, setPrevMnemonic] = useState(mnemonic)
  if (prevMnemonic !== mnemonic) {
    setPrevMnemonic(mnemonic)
    setSelectedIndices(new Set([0]))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs flex items-center gap-1.5">
          <GitBranch className="h-3 w-3" /> Select Derived Addresses
        </Label>
        <div className="flex items-center gap-2">
          <button onClick={toggleAll} className="text-[10px] text-primary hover:underline">
            {derived.every(d => selectedIndices.has(d.index)) ? "Deselect all" : "Select all"}
          </button>
          <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">{basePath}</span>
        </div>
      </div>
      <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
        {derived.map(d => (
          <div
            key={d.index}
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-xs ${
              selectedIndices.has(d.index)
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted/50"
            }`}
            onClick={() => toggleIndex(d.index)}
          >
            {selectedIndices.has(d.index) ? (
              <Check className="h-3 w-3 shrink-0" />
            ) : (
              <span className="w-3 shrink-0" />
            )}
            <span className="font-mono text-muted-foreground w-6 shrink-0">#{d.index}</span>
            <span className="font-mono truncate">{d.address}</span>
          </div>
        ))}
      </div>
      {selectedIndices.size > 0 && (
        <p className="text-[10px] text-muted-foreground">{selectedIndices.size} address{selectedIndices.size !== 1 ? "es" : ""} selected</p>
      )}
      <Button variant="ghost" size="sm" className="w-full text-xs gap-1" onClick={() => setCount(c => c + 5)}>
        <ChevronDown className="h-3 w-3" /> Show more
      </Button>
    </div>
  )
}

/* ─── Tab: Wallet List ──────────────────────────────────────────────── */

type WalletGroup =
  | { kind: "standalone"; wallet: StoredWallet }
  | { kind: "mnemonic"; root: StoredWallet; children: StoredWallet[] }

function groupWallets(wallets: StoredWallet[]): WalletGroup[] {
  const mnemonicGroups = new Map<string, StoredWallet[]>()
  const groups: WalletGroup[] = []
  const seen = new Set<string>()

  // Collect mnemonic groups
  for (const w of wallets) {
    if (w.type === "mnemonic" && w.mnemonic) {
      const group = mnemonicGroups.get(w.mnemonic) ?? []
      group.push(w)
      mnemonicGroups.set(w.mnemonic, group)
    }
  }

  // Sort each group by derivation index (using toSorted to avoid mutation)
  const sortedGroups = new Map<string, StoredWallet[]>()
  for (const [key, group] of mnemonicGroups.entries()) {
    sortedGroups.set(key, group.toSorted((a, b) => {
      const idxA = parseInt(a.derivationPath?.split("/").pop() ?? "0")
      const idxB = parseInt(b.derivationPath?.split("/").pop() ?? "0")
      return idxA - idxB
    }))
  }

  // Build output preserving original order (first occurrence of each group)
  for (const w of wallets) {
    if (seen.has(w.id)) continue
    if (w.type === "mnemonic" && w.mnemonic) {
      const group = sortedGroups.get(w.mnemonic)!
      if (seen.has(group[0].id)) {
        // Already emitted this group
        continue
      }
      for (const g of group) seen.add(g.id)
      groups.push({ kind: "mnemonic", root: group[0], children: group.slice(1) })
    } else {
      seen.add(w.id)
      groups.push({ kind: "standalone", wallet: w })
    }
  }
  return groups
}

function WalletListTab({ wallets, activeWallet, onSelect, onRemove, onRename, onAdd }: {
  wallets: StoredWallet[]
  activeWallet: StoredWallet | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  onAdd: (w: StoredWallet) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [derivingId, setDerivingId] = useState<string | null>(null)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const groups = useMemo(() => groupWallets(wallets), [wallets])

  if (wallets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Wallet className="h-8 w-8 mx-auto mb-3 opacity-40" />
        <p>No wallets yet. Generate, import, or connect one.</p>
      </div>
    )
  }

  function toggleCollapse(mnemonic: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(mnemonic)) next.delete(mnemonic)
      else next.add(mnemonic)
      return next
    })
  }

  function renderWalletRow(w: StoredWallet, opts: { showDerive: boolean; indented: boolean; groupKey?: string; childCount?: number; collapsed?: boolean }) {
    const isActive = activeWallet?.id === w.id
    const isEditing = editingId === w.id
    const isDeriving = derivingId === w.id
    return (
      <div key={w.id}>
        <div
          className={`flex items-start sm:items-center gap-2 sm:gap-3 p-2.5 sm:p-3 cursor-pointer transition-colors ${
            opts.indented
              ? `ml-4 border-l-2 pl-3 sm:pl-4 ${isActive ? "border-l-primary bg-primary/5" : "border-l-border hover:border-l-primary/30 hover:bg-muted/50"}`
              : `rounded-lg border ${isActive ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30 hover:bg-muted/50"}`
          } ${isDeriving && !opts.indented ? "rounded-b-none" : ""}`}
          onClick={() => !isEditing && onSelect(w.id)}
        >
          {/* Expand/collapse chevron for mnemonic roots with children */}
          {opts.groupKey && opts.childCount && opts.childCount > 0 ? (
            <button
              className="shrink-0 p-0.5 -ml-1 rounded hover:bg-muted/80 transition-colors mt-0.5 sm:mt-0"
              onClick={e => { e.stopPropagation(); toggleCollapse(opts.groupKey!) }}
              title={opts.collapsed ? "Expand" : "Collapse"}
            >
              {opts.collapsed ? (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          ) : null}
          {isActive && <Check className="h-4 w-4 text-primary shrink-0 mt-0.5 sm:mt-0" />}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="h-7 text-sm"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") { onRename(w.id, editName); setEditingId(null) }
                    if (e.key === "Escape") setEditingId(null)
                  }}
                />
                <Button size="xs" onClick={() => { onRename(w.id, editName); setEditingId(null) }}>
                  Save
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{w.name}</span>
                  {!opts.indented && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {w.type === "connected" ? w.connectorType : w.type}
                    </Badge>
                  )}
                  {w.derivationPath && (
                    <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">{w.derivationPath}</span>
                  )}
                  {opts.collapsed && opts.childCount ? (
                    <span className="text-[10px] text-muted-foreground">+{opts.childCount} more</span>
                  ) : null}
                </div>
                <p className="text-xs font-mono text-muted-foreground mt-0.5 truncate">
                  {truncateId(w.address, 10, 6)}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            {opts.showDerive && w.type === "mnemonic" && w.mnemonic && (
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                title="Derive another address"
                onClick={() => setDerivingId(isDeriving ? null : w.id)}
              >
                <GitBranch className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost" size="icon" className="h-7 w-7"
              onClick={() => { setEditingId(w.id); setEditName(w.name) }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onRemove(w.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {isDeriving && !opts.indented && w.mnemonic && (
          <DeriveInlineAdd wallet={w} onAdd={onAdd} onDone={() => setDerivingId(null)} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        if (group.kind === "standalone") {
          return renderWalletRow(group.wallet, { showDerive: false, indented: false })
        }
        const groupKey = group.root.id
        const collapsed = collapsedGroups.has(groupKey)
        return (
          <div key={groupKey} className="space-y-0">
            {renderWalletRow(group.root, {
              showDerive: true,
              indented: false,
              groupKey,
              childCount: group.children.length,
              collapsed,
            })}
            {!collapsed && group.children.map((child) =>
              renderWalletRow(child, { showDerive: false, indented: true })
            )}
          </div>
        )
      })}
    </div>
  )
}

function DeriveInlineAdd({ wallet: w, onAdd, onDone }: {
  wallet: StoredWallet
  onAdd: (w: StoredWallet) => void
  onDone: () => void
}) {
  const [selected, setSelected] = useState<DerivedAddress[]>([])

  function handleAdd() {
    for (const d of selected) {
      onAdd({
        id: crypto.randomUUID(),
        name: `${w.name} #${d.index}`,
        type: "mnemonic",
        address: d.address,
        privateKey: d.privateKey,
        mnemonic: w.mnemonic,
        derivationPath: d.path,
        createdAt: Date.now(),
      })
    }
    onDone()
  }

  return (
    <div className="border border-t-0 rounded-b-lg p-3 bg-muted/30 space-y-2" onClick={e => e.stopPropagation()}>
      <DeriveSelector mnemonic={w.mnemonic!} onSelect={setSelected} />
      <Button size="sm" onClick={handleAdd} disabled={selected.length === 0}>
        {selected.length > 1 ? `Add ${selected.length} Wallets` : "Add to Wallets"}
      </Button>
    </div>
  )
}

/* ─── Masked Key Display ───────────────────────────────────────────── */

function MaskedKeyField({ label, value }: { label: string; value: string }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setRevealed(r => !r)}>
          {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {revealed ? "Hide" : "Reveal"}
        </Button>
      </div>
      <p className="text-xs font-mono bg-muted p-2 rounded break-all select-all">
        {revealed ? value : "\u2022".repeat(32)}
      </p>
    </div>
  )
}

/* ─── Tab: Generate ─────────────────────────────────────────────────── */

function GenerateTab({ onAdd }: { onAdd: (w: StoredWallet) => void }) {
  const [mnemonic, setMnemonic] = useState("")
  const [keypairResult, setKeypairResult] = useState<{ address: string; privateKey: string } | null>(null)
  const [selectedDerived, setSelectedDerived] = useState<DerivedAddress[]>([])
  const [name, setName] = useState("")
  const [mode, setMode] = useState<"seed" | "keypair" | null>(null)
  const [wordCount, setWordCount] = useState<12 | 24>(12)

  function generateSeed() {
    const entropy = randomBytes(wordCount === 24 ? 32 : 16)
    const mn = Mnemonic.fromEntropy(entropy)
    const phrase = mn.phrase
    setMnemonic(phrase)
    setKeypairResult(null)
    setMode("seed")
    setName("")
    const first = deriveAddresses(phrase, "m/44'/60'/0'/0/", 1)
    setSelectedDerived(first)
  }

  function generateKeyPair() {
    const wallet = EthersWallet.createRandom()
    setKeypairResult({ address: wallet.address, privateKey: wallet.privateKey })
    setMnemonic("")
    setSelectedDerived([])
    setMode("keypair")
    setName("")
  }

  function saveWallets() {
    if (mode === "seed" && mnemonic && selectedDerived.length > 0) {
      for (const d of selectedDerived) {
        onAdd({
          id: crypto.randomUUID(),
          name: selectedDerived.length === 1
            ? (name || `Wallet ${new Date().toLocaleTimeString()}`)
            : `${name || "Wallet"} #${d.index}`,
          type: "mnemonic",
          address: d.address,
          privateKey: d.privateKey,
          mnemonic,
          derivationPath: d.path,
          createdAt: Date.now(),
        })
      }
      setMnemonic("")
      setSelectedDerived([])
      setMode(null)
      setName("")
    } else if (mode === "keypair" && keypairResult) {
      onAdd({
        id: crypto.randomUUID(),
        name: name || `Wallet ${new Date().toLocaleTimeString()}`,
        type: "private-key",
        address: keypairResult.address,
        privateKey: keypairResult.privateKey,
        createdAt: Date.now(),
      })
      setKeypairResult(null)
      setMode(null)
      setName("")
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
        <strong>Warning:</strong> Keys are generated locally and stored in your browser. Never share them.
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center border rounded-lg overflow-hidden h-8 text-xs">
          <button
            className={`px-3 h-full transition-colors ${wordCount === 12 ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => setWordCount(12)}
          >
            12 words
          </button>
          <button
            className={`px-3 h-full transition-colors ${wordCount === 24 ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => setWordCount(24)}
          >
            24 words
          </button>
        </div>
        <Button onClick={generateSeed} variant="outline" size="sm" className="text-xs">Seed Phrase</Button>
        <Button onClick={generateKeyPair} variant="outline" size="sm" className="text-xs">Key Pair</Button>
      </div>

      {mode === "seed" && mnemonic && (
        <div className="space-y-3 border rounded-lg p-4">
          <div className="space-y-1">
            <Label className="text-xs">Seed Phrase</Label>
            <p className="text-xs font-mono bg-muted p-2 rounded break-all select-all">{mnemonic}</p>
          </div>

          <DeriveSelector mnemonic={mnemonic} onSelect={setSelectedDerived} />

          <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Wallet Name{selectedDerived.length > 1 ? " (prefix)" : ""}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Wallet" className="h-8 text-sm" />
            </div>
            <Button size="sm" onClick={saveWallets} disabled={selectedDerived.length === 0} className="shrink-0">
              {selectedDerived.length > 1 ? `Save ${selectedDerived.length} Wallets` : "Save to Wallets"}
            </Button>
          </div>
        </div>
      )}

      {mode === "keypair" && keypairResult && (
        <div className="space-y-3 border rounded-lg p-4">
          <div className="space-y-1">
            <Label className="text-xs">Address</Label>
            <p className="text-xs font-mono bg-muted p-2 rounded break-all select-all">{keypairResult.address}</p>
          </div>
          <MaskedKeyField label="Private Key" value={keypairResult.privateKey} />

          <div className="flex items-end gap-2 pt-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Wallet Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Wallet" className="h-8 text-sm" />
            </div>
            <Button size="sm" onClick={saveWallets}>Save to Wallets</Button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Tab: Import ───────────────────────────────────────────────────── */

function ImportTab({ onAdd }: { onAdd: (w: StoredWallet) => void }) {
  const [importType, setImportType] = useState<"key" | "seed">("key")
  const [input, setInput] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [validMnemonic, setValidMnemonic] = useState("")
  const [selectedDerived, setSelectedDerived] = useState<DerivedAddress[]>([])

  function handleValidateSeed() {
    setError("")
    try {
      const trimmed = input.trim()
      HDNodeWallet.fromPhrase(trimmed)
      setValidMnemonic(trimmed)
      const first = deriveAddresses(trimmed, "m/44'/60'/0'/0/", 1)
      setSelectedDerived(first)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid seed phrase")
    }
  }

  function handleImport() {
    setError("")
    try {
      if (importType === "key") {
        const wallet = new EthersWallet(input.trim())
        onAdd({
          id: crypto.randomUUID(),
          name: name || `Imported ${new Date().toLocaleTimeString()}`,
          type: "private-key",
          address: wallet.address,
          privateKey: wallet.privateKey,
          createdAt: Date.now(),
        })
        setInput("")
        setName("")
      } else if (validMnemonic && selectedDerived.length > 0) {
        for (const d of selectedDerived) {
          onAdd({
            id: crypto.randomUUID(),
            name: selectedDerived.length === 1
              ? (name || `Imported ${new Date().toLocaleTimeString()}`)
              : `${name || "Imported"} #${d.index}`,
            type: "mnemonic",
            address: d.address,
            privateKey: d.privateKey,
            mnemonic: validMnemonic,
            derivationPath: d.path,
            createdAt: Date.now(),
          })
        }
        setInput("")
        setName("")
        setValidMnemonic("")
        setSelectedDerived([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid input")
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
        <strong>Warning:</strong> Never enter your private key on untrusted sites.
      </div>

      <div className="flex gap-2">
        <Button variant={importType === "key" ? "default" : "outline"} size="sm" onClick={() => { setImportType("key"); setValidMnemonic(""); setSelectedDerived([]) }}>
          Private Key
        </Button>
        <Button variant={importType === "seed" ? "default" : "outline"} size="sm" onClick={() => { setImportType("seed"); setValidMnemonic(""); setSelectedDerived([]) }}>
          Seed Phrase
        </Button>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">{importType === "key" ? "Private Key" : "Seed Phrase"}</Label>
          {importType === "key" ? (
            <Input type="password" value={input} onChange={e => setInput(e.target.value)}
              placeholder="0x..." className="font-mono text-sm" />
          ) : (
            <Textarea value={input} onChange={e => { setInput(e.target.value); setValidMnemonic(""); setSelectedDerived([]) }}
              placeholder="word1 word2 word3 ..." className="font-mono text-sm" rows={3} />
          )}
        </div>

        {importType === "seed" && !validMnemonic && (
          <Button size="sm" variant="outline" onClick={handleValidateSeed} disabled={!input.trim()}>
            Validate & Show Addresses
          </Button>
        )}

        {importType === "seed" && validMnemonic && (
          <DeriveSelector mnemonic={validMnemonic} onSelect={setSelectedDerived} />
        )}

        <div className="space-y-1">
          <Label className="text-xs">Wallet Name{selectedDerived.length > 1 ? " (prefix)" : " (optional)"}</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Wallet" className="h-8 text-sm" />
        </div>

        <Button size="sm" onClick={handleImport}
          disabled={importType === "key" ? !input.trim() : selectedDerived.length === 0}>
          {importType === "seed" && selectedDerived.length > 1 ? `Import ${selectedDerived.length} Wallets` : "Import"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}

/* ─── Tab: Connect ──────────────────────────────────────────────────── */

function ConnectTab({ onAdd, wallets }: { onAdd: (w: StoredWallet) => void; wallets: StoredWallet[] }) {
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const connectedWallet = wallets.find(w => w.type === "connected" && w.connectorType === "injected")

  async function connectInjected() {
    setError("")
    setLoading(true)
    try {
      if (!window.ethereum) {
        throw new Error("No browser wallet detected. Install MetaMask or Core.")
      }
      const provider = new BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      onAdd({
        id: crypto.randomUUID(),
        name: `Browser Wallet ${truncateId(address, 6, 4)}`,
        type: "connected",
        address,
        connectorType: "injected",
        createdAt: Date.now(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {connectedWallet ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-400" />
            <span className="text-sm font-display uppercase tracking-wider">Connected</span>
          </div>
          <p className="text-xs font-mono text-muted-foreground break-all">{connectedWallet.address}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Button onClick={connectInjected} disabled={loading} className="w-full justify-start gap-2" variant="outline">
            {loading ? "Connecting..." : "Connect Browser Wallet (MetaMask / Core)"}
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Connected wallets use your browser extension to sign. Your private key never leaves the extension.
      </p>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}

/* ─── Tab: Dev Wallets (Anvil / Hardhat) ────────────────────────────── */

const ANVIL_HARDHAT_MNEMONIC = "test test test test test test test test test test test junk"

function DevWalletsTab({ onAdd, existingAddresses }: {
  onAdd: (w: StoredWallet) => void
  existingAddresses: string[]
}) {
  const { allNetworks, addCustomNetwork, setNetwork } = useNetwork()
  const [selectedDerived, setSelectedDerived] = useState<DerivedAddress[]>([])
  const [imported, setImported] = useState(false)
  const importedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (importedTimerRef.current) clearTimeout(importedTimerRef.current)
    }
  }, [])

  const anvilNetworkExists = allNetworks.some(n =>
    n.baseUrl.includes("127.0.0.1:8545") || n.baseUrl.includes("localhost:8545")
  )

  const alreadyHasMnemonic = existingAddresses.length > 0 && (() => {
    try {
      const first = deriveAddresses(ANVIL_HARDHAT_MNEMONIC, "m/44'/60'/0'/0/", 1)[0]
      return existingAddresses.includes(first.address.toLowerCase())
    } catch { return false }
  })()

  function addAnvilNetwork() {
    const net = {
      id: `custom-anvil-${Date.now()}`,
      name: "Anvil / Hardhat (localhost)",
      baseUrl: "http://127.0.0.1:8545",
      chainId: 31337,
      type: "custom" as const,
      plainRpc: true,
    }
    addCustomNetwork(net)
    setNetwork(net)
  }

  function handleImport() {
    if (selectedDerived.length === 0) return
    for (const d of selectedDerived) {
      onAdd({
        id: crypto.randomUUID(),
        name: `Anvil #${d.index}`,
        type: "mnemonic",
        address: d.address,
        privateKey: d.privateKey,
        mnemonic: ANVIL_HARDHAT_MNEMONIC,
        derivationPath: d.path,
        createdAt: Date.now(),
      })
    }
    setImported(true)
    if (importedTimerRef.current) clearTimeout(importedTimerRef.current)
    importedTimerRef.current = setTimeout(() => setImported(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-700 dark:text-cyan-400">
        <strong>Dev Only:</strong> These are the default Anvil / Hardhat test accounts. Never use them on a real network.
      </div>

      {/* Network quick-add */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">Network</Label>
        {anvilNetworkExists ? (
          <p className="text-xs text-muted-foreground">Anvil / Hardhat network already configured.</p>
        ) : (
          <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={addAnvilNetwork}>
            <FlaskConical className="h-3.5 w-3.5" />
            Add Anvil / Hardhat Network (localhost:8545, chain 31337)
          </Button>
        )}
      </div>

      {/* Seed phrase display */}
      <div className="space-y-1">
        <Label className="text-xs">Seed Phrase</Label>
        <p className="text-xs font-mono bg-muted p-2 rounded break-all select-all">{ANVIL_HARDHAT_MNEMONIC}</p>
      </div>

      {/* Derive selector — same as seed phrase import */}
      <DeriveSelector mnemonic={ANVIL_HARDHAT_MNEMONIC} onSelect={setSelectedDerived} />

      <Button size="sm" onClick={handleImport} disabled={selectedDerived.length === 0}>
        {imported ? "Added!" : selectedDerived.length > 1 ? `Add ${selectedDerived.length} Wallets` : "Add to Wallets"}
      </Button>

      {alreadyHasMnemonic && (
        <p className="text-xs text-muted-foreground">
          Tip: You can derive more addresses from existing Anvil wallets using the branch icon in the Wallets tab.
        </p>
      )}
    </div>
  )
}
