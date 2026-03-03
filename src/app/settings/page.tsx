"use client"

import { useState, useEffect, useRef } from "react"
import { useNetwork } from "@/lib/contexts/network-context"
import { useWallet } from "@/lib/contexts/wallet-context"
import { RpcService } from "@/lib/services/rpc.service"
import { DEFAULT_NETWORKS, isValidNetwork, type Network } from "@/lib/models/network"
import { WALLET_STORAGE_KEY, ACTIVE_WALLET_STORAGE_KEY, type StoredWallet } from "@/lib/models/wallet"
import { getEtherscanApiKey, setEtherscanApiKey } from "@/lib/services/verification/api-keys"
import { encryptConfig, decryptConfig, isValidConfigFile, isEncryptedConfigFile, createPlainConfig, type ConfigPayload, type ConfigFile } from "@/lib/services/config-crypto"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Trash2, FlaskConical, Download, Upload, AlertTriangle } from "lucide-react"

function isValidRpcUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

export default function SettingsPage() {
  const {
    network: activeNetwork,
    setNetwork,
    customNetworks,
    addCustomNetwork,
    removeCustomNetwork,
    allNetworks,
  } = useNetwork()
  const { wallets } = useWallet()

  const [name, setName] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [chainId, setChainId] = useState("")
  const [addError, setAddError] = useState("")
  const [addSuccess, setAddSuccess] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<boolean | null>(null)
  const [adding, setAdding] = useState(false)
  const [plainRpc, setPlainRpc] = useState(false)

  // Etherscan API key
  const [etherscanKey, setEtherscanKey] = useState("")
  const [etherscanKeySaved, setEtherscanKeySaved] = useState(false)

  // Export state
  const [exportMode, setExportMode] = useState<"settings" | "all">("settings")
  const [exportPassword, setExportPassword] = useState("")
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState("")
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState("")
  const [exportSuccess, setExportSuccess] = useState("")

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importFile, setImportFile] = useState<ConfigFile | null>(null)
  const [importFileName, setImportFileName] = useState("")
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge")
  const [importPassword, setImportPassword] = useState("")
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState("")
  const [importSuccess, setImportSuccess] = useState("")

  useEffect(() => {
    const saved = getEtherscanApiKey()
    if (saved) setEtherscanKey(saved)
  }, [])

  function handleSaveEtherscanKey() {
    const trimmed = etherscanKey.trim()
    setEtherscanApiKey(trimmed || undefined)
    setEtherscanKeySaved(true)
    setTimeout(() => setEtherscanKeySaved(false), 2000)
  }

  async function handleTestConnection() {
    setTestResult(null)
    setAddError("")

    const trimmedUrl = baseUrl.trim()
    if (!trimmedUrl) {
      setAddError("Please enter a base URL.")
      return
    }
    if (!isValidRpcUrl(trimmedUrl)) {
      setAddError("Invalid URL. Must start with http:// or https://.")
      return
    }

    setTesting(true)
    try {
      const healthy = await RpcService.healthCheck(trimmedUrl, plainRpc)
      setTestResult(healthy)
      if (!healthy) {
        setAddError("Connection failed. The RPC endpoint did not respond correctly.")
      }
    } catch {
      setTestResult(false)
      setAddError("Connection failed. Could not reach the RPC endpoint.")
    } finally {
      setTesting(false)
    }
  }

  function handleAddNetwork() {
    setAddError("")
    setAddSuccess("")

    const trimmedName = name.trim()
    const trimmedUrl = baseUrl.trim()
    const parsedChainId = parseInt(chainId.trim())

    if (!trimmedName) {
      setAddError("Please enter a network name.")
      return
    }
    if (!trimmedUrl) {
      setAddError("Please enter a base URL.")
      return
    }
    if (!isValidRpcUrl(trimmedUrl)) {
      setAddError("Invalid URL. Must start with http:// or https://.")
      return
    }
    if (!chainId.trim() || isNaN(parsedChainId)) {
      setAddError("Please enter a valid chain ID.")
      return
    }

    const id = `custom-${trimmedName.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`
    const newNetwork: Network = {
      id,
      name: trimmedName,
      baseUrl: trimmedUrl,
      chainId: parsedChainId,
      type: "custom",
      plainRpc,
    }

    setAdding(true)
    addCustomNetwork(newNetwork)
    setAddSuccess(`Network "${trimmedName}" added successfully.`)
    setName("")
    setBaseUrl("")
    setChainId("")
    setPlainRpc(false)
    setTestResult(null)
    setAdding(false)
  }

  function handleRemoveCustomNetwork(id: string) {
    if (activeNetwork.id === id) {
      setNetwork(DEFAULT_NETWORKS[0])
    }
    removeCustomNetwork(id)
  }

  async function handleExport() {
    setExportError("")
    setExportSuccess("")

    const includesWallets = exportMode === "all"
    const hasPassword = exportPassword.length > 0

    if (includesWallets && !hasPassword) {
      setExportError("Password is required when exporting wallets.")
      return
    }
    if (hasPassword && exportPassword.length < 8) {
      setExportError("Password must be at least 8 characters.")
      return
    }
    if (hasPassword && exportPassword !== exportPasswordConfirm) {
      setExportError("Passwords do not match.")
      return
    }

    setExporting(true)
    try {
      let storedWallets: StoredWallet[] = []
      let activeWalletId: string | null = null
      if (includesWallets) {
        try {
          const raw = localStorage.getItem(WALLET_STORAGE_KEY)
          if (raw) storedWallets = JSON.parse(raw)
          activeWalletId = localStorage.getItem(ACTIVE_WALLET_STORAGE_KEY)
        } catch { /* noop */ }
      }

      const payload: ConfigPayload = {
        customNetworks,
        activeNetworkId: activeNetwork.id,
        etherscanApiKey: getEtherscanApiKey() ?? null,
        ...(includesWallets && { wallets: storedWallets, activeWalletId }),
      }

      const configFile = hasPassword
        ? await encryptConfig(payload, exportPassword, includesWallets)
        : createPlainConfig(payload, includesWallets)
      const blob = new Blob([JSON.stringify(configFile, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `avax-toolkit-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)

      setExportSuccess("Backup exported successfully.")
      setExportPassword("")
      setExportPasswordConfirm("")
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.")
    } finally {
      setExporting(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError("")
    setImportSuccess("")
    setImportFile(null)
    setImportFileName("")

    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string)
        if (!isValidConfigFile(parsed)) {
          setImportError("Invalid backup file format.")
          return
        }
        setImportFile(parsed)
        setImportFileName(file.name)
      } catch {
        setImportError("Could not parse file. Expected a JSON backup file.")
      }
    }
    reader.readAsText(file)
    // Reset so the same file can be re-selected
    e.target.value = ""
  }

  async function handleImport() {
    if (!importFile) return
    setImportError("")
    setImportSuccess("")

    const isEncrypted = isEncryptedConfigFile(importFile)

    if (isEncrypted && !importPassword) {
      setImportError("Please enter the backup password.")
      return
    }

    setImporting(true)
    try {
      const payload = isEncrypted
        ? await decryptConfig(importFile, importPassword)
        : importFile.payload

      if (importMode === "replace") {
        // Clear all custom networks
        for (const net of customNetworks) {
          removeCustomNetwork(net.id)
        }
        // Add imported networks
        for (const net of payload.customNetworks) {
          if (isValidNetwork(net)) {
            addCustomNetwork(net)
          }
        }
        // Set active network
        if (payload.activeNetworkId) {
          const allNets = [...DEFAULT_NETWORKS, ...payload.customNetworks]
          const found = allNets.find(n => n.id === payload.activeNetworkId)
          if (found) setNetwork(found)
        }
        // Etherscan key
        setEtherscanApiKey(payload.etherscanApiKey ?? undefined)
        setEtherscanKey(payload.etherscanApiKey ?? "")
        // Wallets
        if (importFile.includesWallets && payload.wallets) {
          localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(payload.wallets))
          if (payload.activeWalletId) {
            localStorage.setItem(ACTIVE_WALLET_STORAGE_KEY, payload.activeWalletId)
          } else {
            localStorage.removeItem(ACTIVE_WALLET_STORAGE_KEY)
          }
          setImportSuccess("Import complete. Reloading to apply wallet changes...")
          setTimeout(() => window.location.reload(), 1000)
          return
        }
      } else {
        // Merge mode
        const existingIds = new Set(customNetworks.map(n => n.id))
        for (const net of payload.customNetworks) {
          if (!existingIds.has(net.id) && isValidNetwork(net)) {
            addCustomNetwork(net)
          }
        }
        // Etherscan key: only if currently empty
        if (!getEtherscanApiKey() && payload.etherscanApiKey) {
          setEtherscanApiKey(payload.etherscanApiKey)
          setEtherscanKey(payload.etherscanApiKey)
        }
        // Wallets: add if address not present (case-insensitive)
        if (importFile.includesWallets && payload.wallets) {
          const existingAddresses = new Set(wallets.map(w => w.address.toLowerCase()))
          const newWallets = payload.wallets.filter(
            w => !existingAddresses.has(w.address.toLowerCase())
          )
          if (newWallets.length > 0) {
            try {
              const raw = localStorage.getItem(WALLET_STORAGE_KEY)
              const current: StoredWallet[] = raw ? JSON.parse(raw) : []
              localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify([...current, ...newWallets]))
              setImportSuccess("Import complete. Reloading to apply wallet changes...")
              setTimeout(() => window.location.reload(), 1000)
              return
            } catch { /* noop */ }
          }
        }
      }

      setImportSuccess("Configuration imported successfully.")
      setImportPassword("")
      setImportFile(null)
      setImportFileName("")
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed.")
      setImportPassword("")
    } finally {
      setImporting(false)
    }
  }

  return (
    <ToolCard
      title="RPC Configuration"
      description="Manage network connections and custom RPC endpoints."
    >
      <div className="space-y-8">
        {/* Default Networks */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Default Networks</h2>
          <div className="space-y-2">
            {DEFAULT_NETWORKS.map((net) => (
              <Card key={net.id}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{net.name}</span>
                      {activeNetwork.id === net.id && (
                        <Badge variant="default">Active</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {net.baseUrl}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Chain ID: {net.chainId}
                    </p>
                  </div>
                  {activeNetwork.id !== net.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNetwork(net)}
                    >
                      Select
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* Custom Networks */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Custom Networks</h2>
          {customNetworks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No custom networks added yet.
            </p>
          ) : (
            <div className="space-y-2">
              {customNetworks.map((net) => (
                <Card key={net.id}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{net.name}</span>
                        {activeNetwork.id === net.id && (
                          <Badge variant="default">Active</Badge>
                        )}
                        <Badge variant="secondary">Custom</Badge>
                        {net.plainRpc && <Badge variant="outline">Plain RPC</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono">
                        {net.baseUrl}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Chain ID: {net.chainId}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeNetwork.id !== net.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNetwork(net)}
                        >
                          Select
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveCustomNetwork(net.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Quick Add Presets */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Quick Add</h2>
          <div className="flex flex-wrap gap-2">
            {[
              { name: "Anvil / Hardhat", url: "http://127.0.0.1:8545", chainId: 31337 },
              { name: "Ganache", url: "http://127.0.0.1:7545", chainId: 1337 },
            ].map(preset => {
              const exists = allNetworks.some(n =>
                n.baseUrl === preset.url
              )
              return (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={exists}
                  onClick={() => {
                    const net: Network = {
                      id: `custom-${preset.name.toLowerCase().replace(/[\s/]+/g, "-")}-${Date.now()}`,
                      name: preset.name,
                      baseUrl: preset.url,
                      chainId: preset.chainId,
                      type: "custom",
                      plainRpc: true,
                    }
                    addCustomNetwork(net)
                    setNetwork(net)
                  }}
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  {exists ? `${preset.name} (added)` : preset.name}
                </Button>
              )
            })}
          </div>
        </div>

        <Separator />

        {/* Add Custom Network */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Add Custom Network</h2>

          <FormField
            label="Network Name"
            id="network-name"
            value={name}
            onChange={setName}
            placeholder="My Custom Network"
          />

          <FormField
            label="Base URL"
            id="base-url"
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="https://api.example.com"
            monospace
          />

          <FormField
            label="Chain ID"
            id="chain-id"
            value={chainId}
            onChange={setChainId}
            placeholder="43114"
            type="number"
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={plainRpc}
              onChange={(e) => setPlainRpc(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span className="text-sm">
              Plain JSON-RPC endpoint
            </span>
            <span className="text-xs text-muted-foreground">
              (non-Avalanche chains like Anvil, Hardhat, Ganache)
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <LoadingButton
              variant="outline"
              loading={testing}
              onClick={handleTestConnection}
            >
              {testing ? "Testing..." : "Test Connection"}
            </LoadingButton>

            {testResult === true && (
              <span className="text-sm text-green-600 dark:text-green-400">
                Connection successful
              </span>
            )}
            {testResult === false && (
              <span className="text-sm text-destructive">
                Connection failed
              </span>
            )}
          </div>

          <LoadingButton loading={adding} onClick={handleAddNetwork}>
            Add Network
          </LoadingButton>

          {addError && (
            <p className="text-destructive text-sm">{addError}</p>
          )}

          {addSuccess && (
            <p className="text-sm text-green-600 dark:text-green-400">{addSuccess}</p>
          )}
        </div>

        <Separator />

        {/* API Keys */}
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold">API Keys</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional API keys for enhanced contract verification. Keys are stored locally in your browser.
            </p>
          </div>

          <div className="space-y-2">
            <FormField
              label="Etherscan API Key"
              id="etherscan-api-key"
              value={etherscanKey}
              onChange={(val) => { setEtherscanKey(val); setEtherscanKeySaved(false) }}
              placeholder="Your Etherscan API key"
              monospace
            />
            <p className="text-xs text-muted-foreground">
              Required for Etherscan verification checks. Get a free key at{" "}
              <a
                href="https://etherscan.io/myapikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4 hover:text-primary/80"
              >
                etherscan.io
              </a>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSaveEtherscanKey} size="sm">
              Save
            </Button>
            {etherscanKeySaved && (
              <span className="text-sm text-green-600 dark:text-green-400">Saved</span>
            )}
          </div>
        </div>

        <Separator />

        {/* Configuration Backup */}
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-semibold">Configuration Backup</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Export and import your configuration. Settings-only backups can be exported without a password. Backups containing wallets are always encrypted.
            </p>
          </div>

          {/* Export */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider font-display">Export</h3>

            <div className="space-y-2">
              <Label>What to include</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="export-mode"
                    checked={exportMode === "settings"}
                    onChange={() => setExportMode("settings")}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">Settings only</span>
                  <span className="text-xs text-muted-foreground">(networks + API keys)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="export-mode"
                    checked={exportMode === "all"}
                    onChange={() => setExportMode("all")}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">Settings + Wallets</span>
                  <span className="text-xs text-muted-foreground">(includes private keys and mnemonics)</span>
                </label>
              </div>
            </div>

            {exportMode === "all" && (
              <div className="flex items-start gap-2 rounded border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 p-3">
                <AlertTriangle className="h-4 w-4 text-yellow-700 dark:text-yellow-500 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-700 dark:text-yellow-500">
                  The backup will contain wallet private keys and mnemonics. Store the file securely and use a strong password.
                </p>
              </div>
            )}

            <FormField
              label={exportMode === "all" ? "Password" : "Password (optional)"}
              id="export-password"
              value={exportPassword}
              onChange={setExportPassword}
              placeholder={exportMode === "all" ? "Minimum 8 characters" : "Leave empty for unencrypted export"}
              type="password"
            />

            {exportPassword.length > 0 && (
              <FormField
                label="Confirm Password"
                id="export-password-confirm"
                value={exportPasswordConfirm}
                onChange={setExportPasswordConfirm}
                placeholder="Re-enter password"
                type="password"
              />
            )}

            <LoadingButton loading={exporting} onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export Backup
            </LoadingButton>

            {exportError && (
              <p className="text-destructive text-sm">{exportError}</p>
            )}
            {exportSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">{exportSuccess}</p>
            )}
          </div>

          <Separator />

          {/* Import */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider font-display">Import</h3>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Select Backup File
              </Button>
            </div>

            {importFile && (
              <Card>
                <CardContent className="py-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium font-mono">{importFileName}</span>
                    <Badge variant={importFile.includesWallets ? "destructive" : "secondary"}>
                      {importFile.includesWallets ? "Contains wallets" : "Settings only"}
                    </Badge>
                    <Badge variant={isEncryptedConfigFile(importFile) ? "outline" : "secondary"}>
                      {isEncryptedConfigFile(importFile) ? "Encrypted" : "Unencrypted"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created: {new Date(importFile.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            )}

            {importFile && (
              <>
                <div className="space-y-2">
                  <Label>Import mode</Label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="import-mode"
                        checked={importMode === "merge"}
                        onChange={() => setImportMode("merge")}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-sm">Merge</span>
                      <span className="text-xs text-muted-foreground">(add new items, keep existing)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="import-mode"
                        checked={importMode === "replace"}
                        onChange={() => setImportMode("replace")}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="text-sm">Replace</span>
                      <span className="text-xs text-muted-foreground">(overwrite all settings)</span>
                    </label>
                  </div>
                </div>

                {isEncryptedConfigFile(importFile) && (
                  <FormField
                    label="Backup Password"
                    id="import-password"
                    value={importPassword}
                    onChange={setImportPassword}
                    placeholder="Enter the backup password"
                    type="password"
                  />
                )}

                <LoadingButton loading={importing} onClick={handleImport}>
                  <Upload className="mr-2 h-4 w-4" />
                  Import Backup
                </LoadingButton>
              </>
            )}

            {importError && (
              <p className="text-destructive text-sm">{importError}</p>
            )}
            {importSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">{importSuccess}</p>
            )}
          </div>
        </div>
      </div>
    </ToolCard>
  )
}
