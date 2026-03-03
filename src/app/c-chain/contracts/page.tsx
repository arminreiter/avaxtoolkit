"use client"

import { useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { useNetwork } from "@/lib/contexts/network-context"
import { VerificationService } from "@/lib/services/verification"
import type { AggregatedVerification } from "@/lib/services/verification"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { VerificationStatus } from "@/components/contracts/VerificationStatus"
import { VerificationInstructions } from "@/components/contracts/VerificationInstructions"

const SourceViewer = dynamic(() => import("@/components/contracts/SourceViewer").then(m => ({ default: m.SourceViewer })), { ssr: false })
const ContractRead = dynamic(() => import("@/components/contracts/ContractRead").then(m => ({ default: m.ContractRead })), { ssr: false })
const ContractWrite = dynamic(() => import("@/components/contracts/ContractWrite").then(m => ({ default: m.ContractWrite })), { ssr: false })

export default function ContractVerificationPage() {
  const { network, endpoints } = useNetwork()
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState<AggregatedVerification | null>(null)

  async function handleCheck() {
    setLoading(true)
    setError("")
    setData(null)
    try {
      const addr = address.trim()
      if (!addr) throw new Error("Please enter a contract address")
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) throw new Error("Invalid address format")
      const result = await VerificationService.checkAll(addr, network.chainId, endpoints.cChain)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check verification")
    } finally {
      setLoading(false)
    }
  }

  // Re-check verification status after a successful cross-verify
  const handleVerified = useCallback(async () => {
    if (!data) return
    try {
      const result = await VerificationService.checkAll(data.address, data.chainId, endpoints.cChain)
      setData(result)
    } catch {
      // Silent — the verify button already shows the result
    }
  }, [data, endpoints.cChain])

  const anyVerified = data?.results.some(r => r.verified) ?? false
  const hasProxyAbi = !!(data?.proxy.isProxy && data.proxy.implementationAbi?.length)

  return (
    <ToolCard
      title="Smart Contract Verification"
      description="Check verification status across explorers, view source code, and interact with verified contracts."
    >
      <div className="space-y-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <FormField
              label="Contract Address"
              id="contract-address"
              value={address}
              onChange={setAddress}
              placeholder="0x..."
              monospace
            />
          </div>
          <LoadingButton loading={loading} onClick={handleCheck}>
            Check Verification
          </LoadingButton>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {(data || loading) && (
          <Tabs defaultValue="status">
            <TabsList>
              <TabsTrigger value="status">Status</TabsTrigger>
              <TabsTrigger value="source" disabled={!anyVerified}>Source</TabsTrigger>
              <TabsTrigger value="read" disabled={!anyVerified}>Read</TabsTrigger>
              <TabsTrigger value="write" disabled={!anyVerified}>Write</TabsTrigger>
              <TabsTrigger value="read-proxy" disabled={!hasProxyAbi}>Read as Proxy</TabsTrigger>
              <TabsTrigger value="write-proxy" disabled={!hasProxyAbi}>Write as Proxy</TabsTrigger>
            </TabsList>

            <TabsContent value="status" className="mt-4">
              <VerificationStatus data={data} loading={loading} onVerified={handleVerified} />
              {data && !anyVerified && (
                <div className="mt-6">
                  <VerificationInstructions address={data.address} chainId={data.chainId} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="source" className="mt-4">
              <SourceViewer source={data?.source ?? null} />
            </TabsContent>

            <TabsContent value="read" className="mt-4">
              <ContractRead
                abi={data?.abi ?? null}
                address={data?.address ?? ""}
                rpcUrl={endpoints.cChain}
              />
            </TabsContent>

            <TabsContent value="write" className="mt-4">
              <ContractWrite
                abi={data?.abi ?? null}
                address={data?.address ?? ""}
                rpcUrl={endpoints.cChain}
              />
            </TabsContent>

            <TabsContent value="read-proxy" className="mt-4">
              {hasProxyAbi ? (
                <ContractRead
                  abi={data!.proxy.implementationAbi!}
                  address={data!.address}
                  rpcUrl={endpoints.cChain}
                />
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Not a proxy contract, or the implementation contract is not verified
                </div>
              )}
            </TabsContent>

            <TabsContent value="write-proxy" className="mt-4">
              {hasProxyAbi ? (
                <ContractWrite
                  abi={data!.proxy.implementationAbi!}
                  address={data!.address}
                  rpcUrl={endpoints.cChain}
                />
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Not a proxy contract, or the implementation contract is not verified
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </ToolCard>
  )
}
