"use client"

import { useState } from "react"
import { Wallet } from "ethers/wallet"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { OutputDisplay } from "@/components/tools/OutputDisplay"
import { SensitiveDisplay } from "@/components/tools/SensitiveDisplay"
import { Card, CardContent } from "@/components/ui/card"

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
        err instanceof Error ? err.message : "Failed to decrypt keystore. Check your JSON and password."
      )
    } finally {
      setImportLoading(false)
    }
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

    setExportLoading(true)
    try {
      const wallet = new Wallet(trimmedKey)
      const encrypted = await wallet.encrypt(trimmedPassword)
      setExportedKeystore(JSON.stringify(JSON.parse(encrypted), null, 2))
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : "Failed to create keystore. Check your private key."
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
              Paste a JSON keystore and enter its password to decrypt and reveal the address and private key.
            </p>

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

            <LoadingButton loading={importLoading} onClick={handleImport}>
              {importLoading ? "Decrypting..." : "Decrypt Keystore"}
            </LoadingButton>

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

            <LoadingButton loading={exportLoading} onClick={handleExport}>
              {exportLoading ? "Encrypting..." : "Generate Keystore"}
            </LoadingButton>

            {exportError && (
              <p className="text-destructive text-sm">{exportError}</p>
            )}

            {exportedKeystore && (
              <OutputDisplay label="Encrypted Keystore JSON" value={exportedKeystore} />
            )}
          </CardContent>
        </Card>
      </div>
    </ToolCard>
  )
}
