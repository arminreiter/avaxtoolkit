"use client"

import { useState } from "react"
import { Wallet } from "ethers/wallet"
import { Download } from "lucide-react"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { OutputDisplay } from "@/components/tools/OutputDisplay"
import { SensitiveDisplay } from "@/components/tools/SensitiveDisplay"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { errorMessage } from "@/lib/utils"

export default function ImportExportKeystorePage() {
  // Import state
  const [keystoreJson, setKeystoreJson] = useState("")
  const [importPassword, setImportPassword] = useState("")
  const [importedAddress, setImportedAddress] = useState("")
  const [importedPrivateKey, setImportedPrivateKey] = useState("")
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState("")

  // Export state
  const [exportPrivateKey, setExportPrivateKey] = useState("")
  const [exportPassword, setExportPassword] = useState("")
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState("")
  const [exportedAddress, setExportedAddress] = useState("")
  const [exportedKeystore, setExportedKeystore] = useState("")
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState("")

  async function handleImport() {
    setImportError("")
    setImportedAddress("")
    setImportedPrivateKey("")

    const trimmedJson = keystoreJson.trim()
    const trimmedPassword = importPassword

    if (!trimmedJson) {
      setImportError("Please enter the keystore JSON.")
      return
    }
    if (!trimmedPassword) {
      setImportError("Please enter the keystore password.")
      return
    }

    setImportLoading(true)
    try {
      const wallet = await Wallet.fromEncryptedJson(trimmedJson, trimmedPassword)
      setImportedAddress(wallet.address)
      setImportedPrivateKey(wallet.privateKey)
    } catch (err) {
      setImportError(
        errorMessage(err, "Failed to decrypt keystore. Check your JSON and password.")
      )
    } finally {
      setImportLoading(false)
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setKeystoreJson(await file.text())
  }

  function handleDownload() {
    const url = URL.createObjectURL(new Blob([exportedKeystore], { type: "application/json" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `keystore-${exportedAddress}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExport() {
    setExportError("")
    setExportedKeystore("")

    const trimmedKey = exportPrivateKey.trim()
    const trimmedPassword = exportPassword

    if (!trimmedKey) {
      setExportError("Please enter a private key.")
      return
    }
    if (!trimmedPassword) {
      setExportError("Please enter a password to encrypt the keystore.")
      return
    }
    if (trimmedPassword !== exportPasswordConfirm) {
      setExportError("Passwords do not match.")
      return
    }

    setExportLoading(true)
    try {
      const wallet = new Wallet(trimmedKey)
      const encrypted = await wallet.encrypt(trimmedPassword)
      setExportedAddress(wallet.address)
      setExportedKeystore(JSON.stringify(JSON.parse(encrypted), null, 2))
    } catch (err) {
      setExportError(
        errorMessage(err, "Failed to create keystore. Check your private key.")
      )
    } finally {
      setExportLoading(false)
    }
  }

  return (
    <ToolCard
      title="Import / Export Keystore"
      description="Import a JSON keystore file to extract keys, or export a private key to encrypted keystore format."
    >
      <div className="space-y-8">
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400">
          <strong>Security Warning:</strong> Never share your private key or keystore password.
          All encryption and decryption happens locally in your browser.
        </div>

        {/* Import Section */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-base font-semibold">Import Keystore</h2>
            <p className="text-sm text-muted-foreground">
              Upload or paste a JSON keystore and enter its password to decrypt and reveal the address and private key.
            </p>

            <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleImport() }}>
              <div className="space-y-2">
                <Label htmlFor="keystore-file">Keystore File</Label>
                <Input
                  id="keystore-file"
                  type="file"
                  accept=".json,application/json"
                  onChange={e => handleFile(e.target.files?.[0])}
                />
              </div>

              <FormField
                label="Keystore JSON"
                id="keystore-json"
                value={keystoreJson}
                onChange={setKeystoreJson}
                placeholder='{"version":3,"id":"...","address":"...","crypto":{...}}'
                type="textarea"
                monospace
              />

              <FormField
                label="Password"
                id="import-password"
                value={importPassword}
                onChange={setImportPassword}
                placeholder="Enter keystore password"
                type="password"
              />

              <LoadingButton type="submit" loading={importLoading}>
                {importLoading ? "Decrypting..." : "Decrypt Keystore"}
              </LoadingButton>
            </form>

            {importError && (
              <p className="text-destructive text-sm">{importError}</p>
            )}

            {importedAddress && (
              <div className="space-y-4">
                <OutputDisplay label="Address" value={importedAddress} />
                <SensitiveDisplay label="Private Key" value={importedPrivateKey} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-base font-semibold">Export to Keystore</h2>
            <p className="text-sm text-muted-foreground">
              Enter a private key and password to generate an encrypted JSON keystore file.
            </p>

            <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleExport() }}>
              <FormField
                label="Private Key"
                id="export-private-key"
                value={exportPrivateKey}
                onChange={setExportPrivateKey}
                placeholder="0x..."
                type="password"
                monospace
              />

              <FormField
                label="Encryption Password"
                id="export-password"
                value={exportPassword}
                onChange={setExportPassword}
                placeholder="Choose a strong password"
                type="password"
              />

              <FormField
                label="Confirm Password"
                id="export-password-confirm"
                value={exportPasswordConfirm}
                onChange={setExportPasswordConfirm}
                placeholder="Repeat the password"
                type="password"
              />

              <LoadingButton type="submit" loading={exportLoading}>
                {exportLoading ? "Encrypting..." : "Generate Keystore"}
              </LoadingButton>
            </form>

            {exportError && (
              <p className="text-destructive text-sm">{exportError}</p>
            )}

            {exportedKeystore && (
              <div className="space-y-4">
                <Button variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download .json
                </Button>
                <OutputDisplay label="Encrypted Keystore JSON" value={exportedKeystore} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ToolCard>
  )
}
