"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, ExternalLink, Loader2, ArrowRight, Upload, MinusCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AggregatedVerification } from "@/lib/services/verification"
import { VerificationService } from "@/lib/services/verification"

const PROVIDER_NAMES: Record<string, string> = {
  routescan: "Snowtrace (Routescan)",
  etherscan: "Snowscan (Etherscan)",
  snowscan: "Snowscan",
  sourcify: "Sourcify",
  "avalanche-explorer": "Avalanche Explorer",
}

function providerDisplayName(id: string): string {
  return PROVIDER_NAMES[id] ?? id
}

interface VerificationStatusProps {
  data: AggregatedVerification | null
  loading: boolean
  onVerified?: () => void
}

export function VerificationStatus({ data, loading, onVerified }: VerificationStatusProps) {
  const [verifyingProvider, setVerifyingProvider] = useState<string | null>(null)
  const [verifyResults, setVerifyResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [implVerifyingProvider, setImplVerifyingProvider] = useState<string | null>(null)
  const [implVerifyResults, setImplVerifyResults] = useState<Record<string, { success: boolean; message: string }>>({})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Checking verification status...</span>
      </div>
    )
  }

  if (!data) return null

  const checkedResults = data.results.filter(r => !r.unavailable)
  const anyVerified = data.results.some(r => r.verified)
  const allCheckedVerified = checkedResults.length > 0 && checkedResults.every(r => r.verified)
  const canCrossVerify = anyVerified && data.source

  // Find contract name from any verified result
  const contractName = data.results.find(r => r.verified && r.contractName)?.contractName

  async function handleCrossVerify(targetProviderId: string) {
    if (!data?.source) return

    setVerifyingProvider(targetProviderId)
    setVerifyResults(prev => {
      const next = { ...prev }
      delete next[targetProviderId]
      return next
    })

    try {
      const result = await VerificationService.crossVerify(
        data.address,
        data.chainId,
        targetProviderId,
        data.source,
        contractName,
      )
      setVerifyResults(prev => ({ ...prev, [targetProviderId]: result }))
      if (result.success) {
        onVerified?.()
      }
    } catch (err) {
      setVerifyResults(prev => ({
        ...prev,
        [targetProviderId]: {
          success: false,
          message: err instanceof Error ? err.message : "Verification failed",
        },
      }))
    } finally {
      setVerifyingProvider(null)
    }
  }

  async function handleImplCrossVerify(targetProviderId: string) {
    if (!data?.proxy.implementationVerification?.source || !data?.proxy.implementationAddress) return

    setImplVerifyingProvider(targetProviderId)
    setImplVerifyResults(prev => {
      const next = { ...prev }
      delete next[targetProviderId]
      return next
    })

    try {
      const implContractName = data.proxy.implementationVerification.results
        .find(r => r.verified && r.contractName)?.contractName

      const result = await VerificationService.crossVerify(
        data.proxy.implementationAddress,
        data.chainId,
        targetProviderId,
        data.proxy.implementationVerification.source,
        implContractName,
      )
      setImplVerifyResults(prev => ({ ...prev, [targetProviderId]: result }))
      if (result.success) {
        onVerified?.()
      }
    } catch (err) {
      setImplVerifyResults(prev => ({
        ...prev,
        [targetProviderId]: {
          success: false,
          message: err instanceof Error ? err.message : "Verification failed",
        },
      }))
    } finally {
      setImplVerifyingProvider(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-4 ${anyVerified ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex items-center gap-2">
          {anyVerified ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
          <span className="font-display font-semibold">
            {allCheckedVerified ? "Verified on all sources" : anyVerified ? "Partially verified" : "Not verified"}
          </span>
        </div>
      </div>

      {/* Proxy detection banner */}
      {data.proxy.isProxy && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-500/50 text-amber-600 dark:text-amber-400">
              Proxy Contract
            </Badge>
            {data.proxy.standard && (
              <Badge variant="secondary" className="text-xs">
                {data.proxy.standard}
              </Badge>
            )}
          </div>
          {data.proxy.implementationAddress && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground font-mono">
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="truncate">Implementation: {data.proxy.implementationAddress}</span>
            </div>
          )}
          {data.proxy.implementationAbi ? (
            <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">
              Implementation ABI loaded — use &ldquo;Read as Proxy&rdquo; and &ldquo;Write as Proxy&rdquo; tabs
            </p>
          ) : data.proxy.implementationAddress ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Implementation contract is not verified — proxy read/write unavailable
            </p>
          ) : null}
          {data.proxy.implementationVerification && (
            <div className="mt-4 border-t border-amber-500/20 pt-3">
              <p className="text-sm font-medium mb-2">Implementation Verification</p>
              <div className="space-y-1.5">
                {data.proxy.implementationVerification.results.map(result => {
                  const implVerifyResult = implVerifyResults[result.provider]
                  const isImplVerifying = implVerifyingProvider === result.provider
                  const isUnavailable = result.unavailable
                  const canImplCrossVerify = data.proxy.implementationVerification?.source
                    && !result.verified && !implVerifyResult?.success && !isUnavailable

                  return (
                    <div key={result.provider} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {implVerifyResult?.success || result.verified ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : result.unavailable ? (
                          <MinusCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="text-muted-foreground">{providerDisplayName(result.provider)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {canImplCrossVerify && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isImplVerifying || implVerifyingProvider !== null}
                            onClick={() => handleImplCrossVerify(result.provider)}
                            className="text-xs gap-1 h-6 px-2"
                          >
                            {isImplVerifying ? (
                              <><Loader2 className="h-3 w-3 animate-spin" />Verifying...</>
                            ) : (
                              <><Upload className="h-3 w-3" />Verify</>
                            )}
                          </Button>
                        )}
                        {implVerifyResult?.success ? (
                          <Badge variant="default" className="text-xs h-5">Verified</Badge>
                        ) : result.unavailable ? (
                          <Badge variant="outline" className="text-xs h-5 text-muted-foreground">Unchecked</Badge>
                        ) : (
                          <Badge variant={result.verified ? "default" : "secondary"} className="text-xs h-5">
                            {result.verified ? "Verified" : "Not Verified"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {Object.entries(implVerifyResults).map(([providerId, vr]) => (
                <p key={providerId} className={`mt-1.5 text-xs ${vr.success ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                  {providerDisplayName(providerId)}: {vr.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {data.results.map(result => {
          const isVerifying = verifyingProvider === result.provider
          const verifyResult = verifyResults[result.provider]
          const isUnavailable = result.unavailable
          const showVerifyButton = canCrossVerify && !result.verified && !verifyResult?.success && !isUnavailable

          return (
            <Card key={result.provider}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {verifyResult?.success || result.verified ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : result.unavailable ? (
                      <MinusCircle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="font-medium">{providerDisplayName(result.provider)}</span>
                      {result.contractName && (
                        <span className="ml-2 text-sm text-muted-foreground">{result.contractName}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {result.verified && result.compilerVersion && (
                      <Badge variant="secondary" className="text-xs hidden sm:inline-flex">{result.compilerVersion}</Badge>
                    )}
                    {result.verified && result.optimizationUsed && (
                      <Badge variant="outline" className="text-xs hidden sm:inline-flex">Optimized ({result.runs} runs)</Badge>
                    )}
                    {result.verified && result.proxy && (
                      <Badge variant="outline" className="text-xs hidden sm:inline-flex">Proxy</Badge>
                    )}
                    {showVerifyButton && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isVerifying || verifyingProvider !== null}
                        onClick={() => handleCrossVerify(result.provider)}
                        className="text-xs gap-1.5"
                      >
                        {isVerifying ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <Upload className="h-3 w-3" />
                            Verify
                          </>
                        )}
                      </Button>
                    )}
                    {verifyResult?.success ? (
                      <Badge variant="default">Verified</Badge>
                    ) : result.unavailable ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Unchecked</Badge>
                    ) : (
                      <Badge variant={result.verified ? "default" : "secondary"}>
                        {result.verified ? "Verified" : "Not Verified"}
                      </Badge>
                    )}
                    <a
                      href={VerificationService.getExplorerUrl(result.provider, data.address, data.chainId)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  </div>
                </div>
                {/* Cross-verify result message */}
                {verifyResult && (
                  <p className={`mt-2 text-xs ${verifyResult.success ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                    {verifyResult.message}
                  </p>
                )}
                {/* Unavailable reason */}
                {result.unavailable && result.unavailableReason && !verifyResult && (
                  <p className="mt-2 text-xs text-muted-foreground">{result.unavailableReason}</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
