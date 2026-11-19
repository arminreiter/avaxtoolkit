"use client"

import { Suspense, useState, useCallback, useEffect } from "react"
import dynamic from "next/dynamic"
import { isAddress } from "ethers/address"
import { useNetwork } from "@/lib/contexts/network-context"
import { VerificationService, type AggregatedVerification } from "@/lib/services/verification"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AlertTriangle } from "lucide-react"
import { errorMessage } from "@/lib/utils"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { CopyableId } from "@/components/tools/CopyableId"
const VerificationStatus = dynamic(() => import("@/components/contracts/VerificationStatus").then(m => ({ default: m.VerificationStatus })))
const VerificationInstructions = dynamic(() => import("@/components/contracts/VerificationInstructions").then(m => ({ default: m.VerificationInstructions })))

const SourceViewer = dynamic(() => import("@/components/contracts/SourceViewer").then(m => ({ default: m.SourceViewer })), { ssr: false })
const ContractRead = dynamic(() => import("@/components/contracts/ContractRead").then(m => ({ default: m.ContractRead })), { ssr: false })
const ContractWrite = dynamic(() => import("@/components/contracts/ContractWrite").then(m => ({ default: m.ContractWrite })), { ssr: false })

function ContractVerificationPageInner() {
  const { network, endpoints } = useNetwork()
  const [param, setParam] = useQueryParam("address")
  const [address, setAddress] = useState(param)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState<AggregatedVerification | null>(null)
  const [tab, setTab] = useState("status")

  const check = useCallback(async (addr: string) => {
    setLoading(true)
    setError("")
    setData(null)
    setTab("status")
    try {
      const result = await VerificationService.checkAll(addr, network.chainId, endpoints.cChain)
      setData(result)
    } catch (err) {
      setError(errorMessage(err, "Failed to check verification"))
    } finally {
      setLoading(false)
    }
  }, [network.chainId, endpoints.cChain])

  // Deep links and back/forward: run whenever the URL param changes
  useEffect(() => {
    if (param && isAddress(param)) Promise.resolve().then(() => check(param))
  }, [param, check])

  function handleSubmit() {
    const addr = address.trim()
    if (!isAddress(addr)) {
      setError(addr ? "Invalid address format" : "Please enter a contract address")
      return
    }
    if (addr === param) check(addr)
    else setParam(addr)
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
  const isSupported = network.type === "mainnet" || network.type === "fuji"

  return (
    <ToolCard
      title="Smart Contract Verification"
      description="Check verification status across explorers, view source code, and interact with verified contracts."
    >
      {!isSupported ? (
        <div className="flex items-center gap-3 rounded border border-yellow-600/40 bg-yellow-100 dark:bg-yellow-950/20 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="size-5 shrink-0" />
          <span>
            Contract verification is only available on <strong>Mainnet</strong> and <strong>Fuji</strong>.
            Switch your network to use this feature.
          </span>
        </div>
      ) : (
      <div className="space-y-6">
        <form className="flex gap-3 items-end" onSubmit={e => { e.preventDefault(); handleSubmit() }}>
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
          <LoadingButton loading={loading} type="submit">
            Check Verification
          </LoadingButton>
        </form>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {data && (
          <div className="text-sm">
            <span className="text-muted-foreground">Contract: </span>
            <CopyableId value={data.address} explorer="address" className="font-mono" />
          </div>
        )}

        {(data || loading) && (
          <Tabs value={tab} onValueChange={setTab}>
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
              <SourceViewer
                source={data?.source ?? null}
                abi={data?.abi}
                address={data?.address}
                contractName={data?.results.find(r => r.contractName)?.contractName}
              />
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
      )}
    </ToolCard>
  )
}

export default function ContractVerificationPage() {
  const { network } = useNetwork()
  return <Suspense fallback={null}><ContractVerificationPageInner key={network.id} /></Suspense>
}
