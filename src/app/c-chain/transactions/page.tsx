"use client"

import { Suspense, useEffect, useState } from "react"
import { formatEther } from "ethers/utils"
import type { TransactionReceipt, TransactionResponse } from "ethers"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { useRawJson } from "@/lib/hooks/use-raw-json"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { DetailGrid } from "@/components/tools/DetailGrid"
import { CopyableId } from "@/components/tools/CopyableId"
import { Badge } from "@/components/ui/badge"
import { appLinks } from "@/lib/explorer-links"
import { decodeKnownArgs, decodeMethodName } from "@/lib/method-signatures"
import { errorMessage, formatAvaxWei, formatGwei, formatTimestamp } from "@/lib/utils"

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/

interface TxData {
  tx: TransactionResponse
  receipt: TransactionReceipt | null // null → pending
  timestamp: number | null
}

function addressValue(addr: string) {
  return <CopyableId value={addr} href={appLinks.address(addr)} explorer="address" className="text-sm font-mono" />
}

function TransactionLookupPageInner() {
  const { endpoints } = useNetwork()
  const [txParam, setTxParam] = useQueryParam("tx")
  const [txHash, setTxHash] = useState(txParam)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [txData, setTxData] = useState<TxData | null>(null)
  const { rawJson, clearRaw, captureRaw } = useRawJson()

  async function fetchTx(hash: string) {
    setLoading(true)
    setError("")
    setTxData(null)
    clearRaw()
    try {
      if (!hash) {
        throw new Error("Please enter a transaction hash")
      }
      if (!TX_HASH_RE.test(hash)) {
        throw new Error("Invalid transaction hash: expected 0x followed by 64 hex characters")
      }
      const { tx, receipt } = await CChainService.getTransaction(endpoints.cChain, hash)
      if (!tx) {
        throw new Error("Transaction not found")
      }
      const block = receipt ? await CChainService.getBlock(endpoints.cChain, receipt.blockNumber) : null
      setTxData({ tx, receipt, timestamp: block?.timestamp ?? null })
      captureRaw()
    } catch (err) {
      setError(errorMessage(err, "Failed to fetch transaction"))
    } finally {
      setLoading(false)
    }
  }

  // runs on deep links and back button
  useEffect(() => {
    if (!txParam) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- input and fetch follow the URL param
    setTxHash(txParam)
    fetchTx(txParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the param changes
  }, [txParam])

  function handleSubmit() {
    const hash = txHash.trim()
    if (hash && TX_HASH_RE.test(hash) && hash !== txParam) setTxParam(hash) // the param effect fetches
    else fetchTx(hash)
  }

  const tx = txData?.tx
  const receipt = txData?.receipt
  const gasPrice = receipt?.gasPrice ?? tx?.gasPrice ?? null

  return (
    <ToolCard
      title="Transaction Lookup"
      description="Look up transaction details by transaction hash."
      rawJson={rawJson}
    >
      <div className="space-y-4">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
          <FormField
            label="Transaction Hash"
            id="tx-hash"
            value={txHash}
            onChange={setTxHash}
            placeholder="0x..."
            monospace
          />
          <LoadingButton type="submit" loading={loading}>
            Fetch Transaction
          </LoadingButton>
        </form>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {txData && tx && (
          <div className="space-y-3">
            <DetailGrid
              title="Transaction Overview"
              rpcMethod="eth_getTransactionByHash"
              columns={3}
              items={[
                {
                  label: "Status",
                  value: !receipt ? (
                    <Badge variant="secondary">Pending</Badge>
                  ) : receipt.status === 1 ? (
                    <Badge variant="default">Success</Badge>
                  ) : (
                    <Badge variant="destructive">Failed</Badge>
                  ),
                },
                {
                  label: "Block",
                  value: receipt ? (
                    <CopyableId value={String(receipt.blockNumber)} display={receipt.blockNumber.toLocaleString()} href={appLinks.block(receipt.blockNumber)} explorer="block" className="text-sm font-medium" />
                  ) : "Pending",
                },
                { label: "Timestamp", value: txData.timestamp === null ? "Pending" : formatTimestamp(txData.timestamp) },
                { label: "Method", value: tx.to ? decodeMethodName(tx.data) : "Contract Creation", mono: true },
                { label: "Value", value: `${formatEther(tx.value)} AVAX` },
                { label: "Nonce", value: tx.nonce.toString() },
                { label: "Gas Used", value: receipt ? receipt.gasUsed.toLocaleString() : "Pending" },
                { label: "Gas Price", value: gasPrice === null ? "—" : `${formatGwei(gasPrice)} gwei` },
                { label: "Fee", value: receipt ? `${formatAvaxWei(receipt.fee, 8)} AVAX` : "Pending" },
              ]}
            />
            <DetailGrid
              title="Addresses"
              rpcMethod="eth_getTransactionByHash"
              columns={2}
              items={[
                { label: "TX Hash", value: <CopyableId value={tx.hash} explorer="tx" className="text-sm font-mono" />, fullWidth: true },
                { label: "From", value: addressValue(tx.from) },
                tx.to
                  ? { label: "To", value: addressValue(tx.to) }
                  : { label: "Contract Created", value: receipt?.contractAddress ? addressValue(receipt.contractAddress) : "Pending" },
              ]}
            />
            {tx.data !== "0x" && (
              <DetailGrid
                title="Input Data"
                rpcMethod="eth_getTransactionByHash"
                items={[
                  ...(decodeKnownArgs(tx.data) ?? []).map((a) => ({
                    label: `${a.name} (${a.type})`,
                    value: a.type === "address" ? addressValue(a.value) : a.value,
                    mono: true,
                    fullWidth: true,
                  })),
                  {
                    label: "Raw",
                    fullWidth: true,
                    value: <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-64 overflow-y-auto bg-muted/50 p-2">{tx.data}</pre>,
                  },
                ]}
              />
            )}
          </div>
        )}
      </div>
    </ToolCard>
  )
}

export default function TransactionLookupPage() {
  const { network } = useNetwork()
  return (
    <Suspense fallback={null}>
      <TransactionLookupPageInner key={network.id} />
    </Suspense>
  )
}
