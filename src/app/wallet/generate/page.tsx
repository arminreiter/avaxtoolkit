"use client"

import { useState } from "react"
import { Wallet, Mnemonic, randomBytes } from "ethers"
import { ToolCard } from "@/components/tools/ToolCard"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { OutputDisplay } from "@/components/tools/OutputDisplay"
import { SensitiveDisplay } from "@/components/tools/SensitiveDisplay"

export default function GenerateWalletPage() {
  const [mnemonic, setMnemonic] = useState("")
  const [address, setAddress] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [mode, setMode] = useState<"seed" | "keypair" | null>(null)
  const [wordCount, setWordCount] = useState<12 | 24>(12)

  function handleGenerateSeed() {
    const entropy = randomBytes(wordCount === 24 ? 32 : 16)
    const mn = Mnemonic.fromEntropy(entropy)
    const wallet = Wallet.fromPhrase(mn.phrase)
    setMnemonic(mn.phrase)
    setAddress(wallet.address)
    setPrivateKey(wallet.privateKey)
    setMode("seed")
  }

  function handleGenerateKeyPair() {
    const wallet = Wallet.createRandom()
    setMnemonic("")
    setAddress(wallet.address)
    setPrivateKey(wallet.privateKey)
    setMode("keypair")
  }

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

        {mode === "seed" && mnemonic && (
          <div className="space-y-4">
            <OutputDisplay label="Seed Phrase (Mnemonic)" value={mnemonic} />
            <OutputDisplay label="Address" value={address} />
            <SensitiveDisplay label="Private Key" value={privateKey} />
          </div>
        )}

        {mode === "keypair" && address && (
          <div className="space-y-4">
            <OutputDisplay label="Address" value={address} />
            <SensitiveDisplay label="Private Key" value={privateKey} />
          </div>
        )}
      </div>
    </ToolCard>
  )
}
