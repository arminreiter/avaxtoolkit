"use client"

import { useMemo, useState } from "react"
import { Wallet } from "ethers/wallet"
import { Check, Plus } from "lucide-react"
import { AVAX_DERIVATION_PATH, DEFAULT_DERIVATION_BASE, avaxAddressFromWallet, generateMnemonic } from "@/lib/utils/wallet"
import type { StoredWallet } from "@/lib/models/wallet"
import { hrpForNetwork } from "@/lib/models/network"
import { useNetwork } from "@/lib/contexts/network-context"
import { useWallet } from "@/lib/contexts/wallet-context"
import { Button } from "@/components/ui/button"
import { ToolCard } from "@/components/tools/ToolCard"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { OutputDisplay } from "@/components/tools/OutputDisplay"
import { SensitiveDisplay } from "@/components/tools/SensitiveDisplay"

export default function GenerateWalletPage() {
  const { network } = useNetwork()
  const { addWallet } = useWallet()
  // Built on generate (minus id/name/createdAt, set on save) so the P/X address matches what the wallet list shows
  const [generated, setGenerated] = useState<Omit<StoredWallet, "id" | "name" | "createdAt"> | null>(null)
  const [saved, setSaved] = useState(false)
  const [wordCount, setWordCount] = useState<12 | 24>(12)

  function handleGenerateSeed() {
    const phrase = generateMnemonic(wordCount)
    const wallet = Wallet.fromPhrase(phrase) // ethers default path = m/44'/60'/0'/0/0
    setGenerated({ type: "mnemonic", address: wallet.address, privateKey: wallet.privateKey, mnemonic: phrase, derivationPath: `${DEFAULT_DERIVATION_BASE}0` })
    setSaved(false)
  }

  function handleGenerateKeyPair() {
    const wallet = Wallet.createRandom()
    setGenerated({ type: "private-key", address: wallet.address, privateKey: wallet.privateKey })
    setSaved(false)
  }

  function handleSave() {
    if (!generated) return
    addWallet({ ...generated, id: crypto.randomUUID(), name: `Wallet ${new Date().toLocaleTimeString()}`, createdAt: Date.now() })
    setSaved(true)
  }

  // Memoized: mnemonic derivation (PBKDF2) is too slow to repeat on every render
  const pxAddress = useMemo(
    () => generated ? avaxAddressFromWallet({ ...generated, id: "", name: "", createdAt: 0 }, hrpForNetwork(network)) : null,
    [generated, network],
  )

  return (
    <ToolCard
      title="Generate Seed & Keys"
      description="Generate a new seed phrase with derived keys, or a standalone key pair."
    >
      <div className="space-y-6">
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400">
          <strong>Security Warning:</strong> Never share your seed phrase or private key with anyone.
          These are generated locally in your browser and are not transmitted or stored anywhere.
          For production use, always use a hardware wallet or a secure key management solution.
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center border rounded-lg overflow-hidden h-9 text-xs">
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
          <LoadingButton onClick={handleGenerateSeed}>
            Generate Seed Phrase
          </LoadingButton>
          <LoadingButton variant="outline" onClick={handleGenerateKeyPair}>
            Generate Key Pair
          </LoadingButton>
        </div>

        {generated && (
          <div className="space-y-4">
            {generated.mnemonic && <SensitiveDisplay label="Seed Phrase (Mnemonic)" value={generated.mnemonic} />}
            <OutputDisplay label="C-Chain Address" value={generated.address} />
            {pxAddress && <OutputDisplay label={`P/X-Chain Address (${network.name}${generated.mnemonic ? `, ${AVAX_DERIVATION_PATH}` : ""})`} value={`P-${pxAddress}`} />}
            <SensitiveDisplay label="Private Key" value={generated.privateKey ?? ""} />
            <Button variant="outline" onClick={handleSave} disabled={saved}>
              {saved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saved ? "Saved to wallets" : "Save to wallets"}
            </Button>
          </div>
        )}
      </div>
    </ToolCard>
  )
}
