"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { formatUnits, formatEther, parseEther, parseUnits } from "ethers/utils"
import { isAddress } from "ethers/address"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { CopyableId } from "@/components/tools/CopyableId"
import { useConfirm } from "@/components/tools/ConfirmDialog"
import { useWallet } from "@/lib/contexts/wallet-context"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { recordSentTx } from "@/lib/models/tx-history"
import { useQueryParam } from "@/lib/hooks/use-query-param"
import { appLinks } from "@/lib/explorer-links"
import { Button } from "@/components/ui/button"
import { AssetSelect, useAssetSelection } from "@/components/wallet/AssetSelect"
import { errorMessage, formatTokenAmount } from "@/lib/utils"

const NATIVE_TRANSFER_GAS = BigInt(21000)

export default function SendTransactionPage() {
  return (
    <Suspense fallback={null}>
      <SendTransactionPageInner />
    </Suspense>
  )
}

function SendTransactionPageInner() {
  const [assetParam] = useQueryParam("asset")
  const { activeWallet, requireWallet } = useWallet()
  const { network, endpoints } = useNetwork()
  const [to, setTo] = useState("")
  const [amount, setAmount] = useState("")
  const { tokens, asset, setAsset, token, symbol } = useAssetSelection(network.chainId, assetParam)
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState("")
  const [confirmedBlock, setConfirmedBlock] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [gasEstimate, setGasEstimate] = useState("")
  const [balance, setBalance] = useState<{ key: string; value: bigint | null } | null>(null)
  const [balanceNonce, setBalanceNonce] = useState(0)
  const { confirm, dialog } = useConfirm()

  // Clear results from the previous network (send forms don't remount on network switch)
  const [prevNetworkId, setPrevNetworkId] = useState(network.id)
  if (prevNetworkId !== network.id) {
    setPrevNetworkId(network.id)
    setTxHash("")
    setConfirmedBlock(null)
    setError("")
    setGasEstimate("")
  }

  const owner = activeWallet?.address
  const decimals = token?.decimals ?? 18
  const balanceKey = `${network.id}:${owner}:${asset}:${balanceNonce}`
  const available = balance?.key === balanceKey ? balance.value : null

  useEffect(() => {
    if (!owner) return
    let cancelled = false
    const request = token
      ? CChainService.getTokenBalances(endpoints.cChain, owner, [token.address]).then(([b]) => b)
      : CChainService.getProvider(endpoints.cChain).getBalance(owner)
    request.catch(() => null).then(value => { if (!cancelled) setBalance({ key: balanceKey, value }) })
    return () => { cancelled = true }
  }, [owner, token, endpoints.cChain, balanceKey])

  /** The tx request for the current form; ERC-20 sends call transfer() on the token contract. */
  function buildTx(value = amount) {
    if (!token) return { to: to.trim(), value: parseEther(value) }
    return CChainService.encodeTokenTransfer(token.address, to.trim(), parseUnits(value, token.decimals))
  }

  /** Gas limit and per-gas price (maxFeePerGas, else legacy gasPrice) for the current form. */
  async function estimateFee() {
    const provider = CChainService.getProvider(endpoints.cChain)
    const [gasData, gasLimit] = await Promise.all([
      CChainService.getGasPrice(endpoints.cChain),
      token && owner
        ? provider.estimateGas({ ...buildTx(), from: owner })
        : Promise.resolve(NATIVE_TRANSFER_GAS),
    ])
    const price = BigInt(gasData.maxFeePerGas ?? gasData.gasPrice)
    return { gasLimit, price, cost: gasLimit * price }
  }

  function describeFee({ gasLimit, price, cost }: Awaited<ReturnType<typeof estimateFee>>) {
    return `~${formatEther(cost)} AVAX (${gasLimit} gas @ ${formatUnits(price, "gwei")} Gwei)`
  }

  async function estimateGas() {
    if (!to || !amount) return
    try {
      setGasEstimate(describeFee(await estimateFee()))
    } catch (err) {
      setGasEstimate(err instanceof Error && "shortMessage" in err ? `Could not estimate gas: ${err.shortMessage}` : "Could not estimate gas")
    }
  }

  async function setMax() {
    if (available === null) return
    if (token) { setAmount(formatUnits(available, decimals)); return }
    try {
      const gasData = await CChainService.getGasPrice(endpoints.cChain)
      const max = available - NATIVE_TRANSFER_GAS * BigInt(gasData.maxFeePerGas ?? gasData.gasPrice)
      setAmount(formatEther(max > BigInt(0) ? max : BigInt(0)))
      setGasEstimate("")
    } catch (err) {
      setError(errorMessage(err, "Could not fetch gas price"))
    }
  }

  const isAddressValid = to.trim() === "" || isAddress(to.trim())

  async function handleSend() {
    setError("")
    setTxHash("")
    setConfirmedBlock(null)

    if (!isAddress(to.trim())) {
      setError("Invalid destination address")
      return
    }

    const parsedAmount = Number(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Amount must be a positive number")
      return
    }

    const fee = await estimateFee().then(describeFee).catch(() => "Could not estimate")
    const ok = await confirm({
      title: `Send ${amount} ${symbol}?`,
      confirmLabel: "Send",
      description: (
        <span className="block space-y-1 font-mono text-xs break-all">
          <span className="block">From: {owner ?? "(select wallet on send)"}</span>
          <span className="block">To: {to.trim()}</span>
          <span className="block">Amount: {amount} {symbol}{token && ` (${token.address})`}</span>
          <span className="block">Est. fee: {fee}</span>
        </span>
      ),
    })
    if (!ok) return

    setLoading(true)
    try {
      const request = buildTx()
      const signer = await requireWallet()
      const tx = await signer.sendTransaction(request)
      recordSentTx(tx, `Send ${amount} ${symbol}`)
      setTxHash(tx.hash)
      const receipt = await tx.wait()
      setConfirmedBlock(receipt?.blockNumber ?? null)
      setTo("")
      setAmount("")
      setGasEstimate("")
      setBalanceNonce(n => n + 1)
    } catch (err) {
      setError(errorMessage(err, "Transaction failed"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ToolCard title="Send Transaction" description="Send AVAX or an ERC-20 token on the C-Chain.">
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSend() }}>
        {activeWallet && (
          <div className="text-xs font-mono text-muted-foreground flex items-center gap-1">
            From: <CopyableId value={activeWallet.address} href={appLinks.address(activeWallet.address)} explorer="address" />
          </div>
        )}

        <AssetSelect tokens={tokens} value={asset} onChange={(v) => { setAsset(v); setGasEstimate("") }} />

        <FormField label="Destination Address" id="to" value={to} onChange={setTo}
          placeholder="0x..." monospace />
        {to.trim() && !isAddressValid && (
          <p className="text-xs text-destructive">Invalid Ethereum address</p>
        )}
        <FormField label={`Amount (${symbol})`} id="amount" value={amount} onChange={(v) => { setAmount(v); setGasEstimate("") }}
          placeholder="0.1" type="number" />
        {owner && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            Available: {available === null ? "…" : `${formatTokenAmount(available, decimals)} ${symbol}`}
            <Button type="button" variant="outline" size="sm" className="h-6 px-2 text-xs"
              onClick={setMax} disabled={available === null}>
              Max
            </Button>
          </div>
        )}

        {gasEstimate && (
          <p className="text-xs text-muted-foreground font-mono">Gas: {gasEstimate}</p>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={estimateGas} disabled={!to || !amount || !isAddressValid}>
            Estimate Gas
          </Button>
          <LoadingButton type="submit" loading={loading} disabled={!to || !amount || !isAddressValid}>
            Send
          </LoadingButton>
        </div>

        {txHash && (
          <div className="space-y-1 rounded-lg border p-3 text-sm">
            <p className={confirmedBlock === null ? "text-yellow-500" : "text-green-500"}>
              {confirmedBlock === null ? (loading ? "Pending…" : "Submitted") : `Confirmed in block ${confirmedBlock}`}
            </p>
            <div className="flex items-center gap-1 text-xs font-mono">
              Tx: <CopyableId value={txHash} href={appLinks.tx(txHash)} explorer="tx" />
            </div>
            <Link href="/transactions/history" className="text-xs text-primary hover:underline">
              View transaction history
            </Link>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
      </form>
      {dialog}
    </ToolCard>
  )
}
