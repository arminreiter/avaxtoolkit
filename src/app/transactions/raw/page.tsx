"use client"

import { useState } from "react"
import { isAddress } from "ethers/address"
import { formatUnits, isHexString, parseEther, parseUnits } from "ethers/utils"
import { type TransactionRequest } from "ethers/providers"
import { ToolCard } from "@/components/tools/ToolCard"
import { FormField } from "@/components/tools/FormField"
import { LoadingButton } from "@/components/tools/LoadingButton"
import { OutputDisplay } from "@/components/tools/OutputDisplay"
import { CopyableId } from "@/components/tools/CopyableId"
import { useConfirm } from "@/components/tools/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/contexts/wallet-context"
import { useNetwork } from "@/lib/contexts/network-context"
import { CChainService } from "@/lib/services/cchain.service"
import { recordSentTx } from "@/lib/models/tx-history"
import { encodeCalldata, decodeCalldata, type DecodedArg } from "@/lib/utils/abi"
import { decodeMethodName } from "@/lib/method-signatures"
import { appLinks } from "@/lib/explorer-links"
import { errorMessage } from "@/lib/utils"

type Action = "simulate" | "estimate" | "sign" | "send" | "broadcast" | "nonce" | "fees"

/** ethers errors carry the decoded revert reason / short message / revert data as extra fields. */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return "Request failed"
  const e = err as Error & { reason?: string | null; shortMessage?: string; data?: string | null }
  const head = e.reason ? `Reverted: ${e.reason}` : (e.shortMessage ?? e.message)
  return e.data && e.data !== "0x" ? `${head}\nRevert data: ${e.data}` : head
}

export default function RawTransactionPage() {
  const { activeWallet, requireWallet } = useWallet()
  const { endpoints } = useNetwork()
  const [to, setTo] = useState("")
  const [value, setValue] = useState("")
  const [data, setData] = useState("")
  const [gasLimit, setGasLimit] = useState("")
  const [nonce, setNonce] = useState("")
  const [maxFee, setMaxFee] = useState("")
  const [priorityFee, setPriorityFee] = useState("")
  const [rawTx, setRawTx] = useState("")
  const [signature, setSignature] = useState("")
  const [argsText, setArgsText] = useState("")
  const [decoded, setDecoded] = useState<{ name: string; args: DecodedArg[] } | null>(null)
  const [helperError, setHelperError] = useState("")
  const [running, setRunning] = useState<Action | null>(null)
  const [output, setOutput] = useState<{ label: string; value: string } | null>(null)
  const [txHash, setTxHash] = useState("")
  const [error, setError] = useState("")
  const { confirm, dialog } = useConfirm()

  /** Turn the form into a request. Empty optional fields are left for the node/wallet to fill. */
  function buildRequest(): TransactionRequest {
    const target = to.trim()
    if (target && !isAddress(target)) throw new Error("Invalid 'to' address")
    const calldata = data.trim() || "0x"
    if (!isHexString(calldata)) throw new Error("Data must be 0x-prefixed hex")
    if (!target && calldata === "0x") throw new Error("Contract creation needs bytecode in Data")
    const int = (v: string, name: string) => {
      if (!/^\d+$/.test(v.trim())) throw new Error(`${name} must be a whole number`)
      return Number(v.trim())
    }
    const req: TransactionRequest = { to: target || null, value: parseEther(value.trim() || "0"), data: calldata }
    if (gasLimit.trim()) req.gasLimit = int(gasLimit, "Gas limit")
    if (nonce.trim()) req.nonce = int(nonce, "Nonce")
    if (maxFee.trim()) req.maxFeePerGas = parseUnits(maxFee.trim(), "gwei")
    if (priorityFee.trim()) req.maxPriorityFeePerGas = parseUnits(priorityFee.trim(), "gwei")
    return req
  }

  function encode() {
    setHelperError("")
    setDecoded(null)
    try {
      // One argument per line; arrays and tuples as JSON, e.g. [1,2] or ["0x…", true]
      const args = argsText.split("\n").map(l => l.trim()).filter(Boolean)
      setData(encodeCalldata(signature, args))
    } catch (err) {
      setHelperError(errorMessage(err, "Encoding failed"))
    }
  }

  function decode() {
    setHelperError("")
    setDecoded(null)
    const calldata = data.trim()
    if (!signature.trim()) {
      // No signature: the best we can do is name the selector if it is a well-known one
      const name = decodeMethodName(calldata)
      setHelperError(name.startsWith("0x")
        ? `Unknown selector ${name}. Enter the function signature to decode the arguments.`
        : `Selector matches "${name}". Enter its full signature to decode the arguments.`)
      return
    }
    try {
      setDecoded(decodeCalldata(signature, calldata))
    } catch (err) {
      setHelperError(err instanceof Error && "shortMessage" in err ? String(err.shortMessage) : errorMessage(err, "Decoding failed"))
    }
  }

  async function run(action: Action) {
    setError("")
    setOutput(null)
    setTxHash("")
    setRunning(action)
    try {
      const provider = CChainService.getProvider(endpoints.cChain)
      if (action === "broadcast") {
        const tx = await provider.broadcastTransaction(rawTx.trim())
        recordSentTx(tx, "Broadcast raw tx")
        setTxHash(tx.hash)
        return
      }
      if (action === "nonce") {
        const from = activeWallet?.address ?? await (await requireWallet()).getAddress()
        setNonce(String(await provider.getTransactionCount(from, "pending")))
        return
      }
      if (action === "fees") {
        const fees = await provider.getFeeData()
        if (fees.maxFeePerGas != null) setMaxFee(formatUnits(fees.maxFeePerGas, "gwei"))
        if (fees.maxPriorityFeePerGas != null) setPriorityFee(formatUnits(fees.maxPriorityFeePerGas, "gwei"))
        return
      }
      const req = buildRequest()
      if (action === "simulate") {
        const result = await provider.call({ ...req, from: activeWallet?.address })
        setOutput({ label: "eth_call Result (success)", value: result })
      } else if (action === "estimate") {
        const gas = await provider.estimateGas({ ...req, from: activeWallet?.address })
        setOutput({ label: "Estimated Gas", value: gas.toString() })
      } else {
        const signer = await requireWallet()
        if (action === "sign") {
          // Injected wallets (MetaMask) only sign-and-send; eth_signTransaction is not exposed
          if (activeWallet?.type === "connected") throw new Error("Connected wallets cannot sign without sending. Use a private-key or mnemonic wallet.")
          const signed = await signer.signTransaction(await signer.populateTransaction(req))
          setOutput({ label: "Signed Raw Transaction", value: signed })
        } else {
          const calldata = String(req.data)
          const ok = await confirm({
            title: to.trim() ? "Send raw transaction?" : "Deploy contract?",
            confirmLabel: "Send",
            description: (
              <div className="space-y-1 text-xs font-mono break-all">
                <div>To: {to.trim() || "(contract creation)"}</div>
                <div>Value: {value.trim() || "0"} AVAX</div>
                <div>Data: {calldata.length > 66 ? `${calldata.slice(0, 66)}… (${(calldata.length - 2) / 2} bytes)` : calldata}</div>
              </div>
            ),
          })
          if (!ok) return
          const tx = await signer.sendTransaction(req)
          recordSentTx(tx, to.trim() ? "Raw tx" : "Contract deployment")
          setTxHash(tx.hash)
        }
      }
    } catch (err) {
      setError(describeError(err))
    } finally {
      setRunning(null)
    }
  }

  return (
    <ToolCard title="Raw Transaction" description="Build any C-Chain transaction by hand. Simulate with eth_call before sending, sign offline, or broadcast a signed tx.">
      <div className="space-y-6">
        <div className="space-y-4">
          {activeWallet && (
            <div className="text-xs font-mono text-muted-foreground break-all">From: {activeWallet.address}</div>
          )}
          <FormField label="To (empty = contract creation)" id="raw-to" value={to} onChange={setTo} placeholder="0x..." monospace />
          <FormField label="Value (AVAX)" id="raw-value" value={value} onChange={setValue} placeholder="0" type="number" />
          <div className="space-y-3 rounded-lg border p-3">
            <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{"// "}Calldata Helper</h3>
            <FormField label="Function Signature" id="raw-sig" value={signature} onChange={setSignature}
              placeholder="transfer(address to, uint256 amount)" monospace />
            <FormField label="Arguments (one per line, arrays/tuples as JSON)" id="raw-args" value={argsText} onChange={setArgsText}
              placeholder={"0x...\n1000000"} type="textarea" monospace />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={encode} disabled={!signature.trim()}>Encode → Data</Button>
              <Button variant="outline" size="sm" onClick={decode} disabled={!data.trim()}>Decode Data</Button>
            </div>
            {helperError && <p className="text-xs text-destructive break-all">{helperError}</p>}
            {decoded && (
              <div className="text-xs font-mono space-y-1">
                <div className="font-semibold">{decoded.name}()</div>
                {decoded.args.map((a, i) => (
                  <div key={i} className="break-all">
                    <span className="text-muted-foreground">{a.type}{a.name ? ` ${a.name}` : ""}:</span> {a.value}
                  </div>
                ))}
              </div>
            )}
          </div>
          <FormField label="Data" id="raw-data" value={data} onChange={setData} placeholder="0x..." type="textarea" monospace />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Gas Limit (optional)" id="raw-gas" value={gasLimit} onChange={setGasLimit} placeholder="auto" monospace />
            <FormField label="Nonce (optional)" id="raw-nonce" value={nonce} onChange={setNonce} placeholder="auto" monospace />
            <FormField label="Max Fee (Gwei, optional)" id="raw-maxfee" value={maxFee} onChange={setMaxFee} placeholder="auto" monospace />
            <FormField label="Priority Fee (Gwei, optional)" id="raw-prio" value={priorityFee} onChange={setPriorityFee} placeholder="auto" monospace />
          </div>
          <div className="flex flex-wrap gap-2">
            <LoadingButton variant="outline" size="sm" onClick={() => run("nonce")} loading={running === "nonce"} disabled={running !== null}>Fill Current Nonce</LoadingButton>
            <LoadingButton variant="outline" size="sm" onClick={() => run("fees")} loading={running === "fees"} disabled={running !== null}>Fill Current Fees</LoadingButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <LoadingButton variant="outline" size="sm" onClick={() => run("simulate")} loading={running === "simulate"} disabled={running !== null}>Simulate (eth_call)</LoadingButton>
            <LoadingButton variant="outline" size="sm" onClick={() => run("estimate")} loading={running === "estimate"} disabled={running !== null}>Estimate Gas</LoadingButton>
            <LoadingButton variant="outline" size="sm" onClick={() => run("sign")} loading={running === "sign"} disabled={running !== null}>Sign Only</LoadingButton>
            <LoadingButton onClick={() => run("send")} loading={running === "send"} disabled={running !== null}>Send</LoadingButton>
          </div>
        </div>

        <div className="space-y-4 border-t pt-4">
          <FormField label="Broadcast Signed Transaction" id="raw-signed" value={rawTx} onChange={setRawTx}
            placeholder="0x02f8..." type="textarea" monospace />
          <LoadingButton onClick={() => run("broadcast")} loading={running === "broadcast"} disabled={running !== null || !rawTx.trim()}>
            Broadcast
          </LoadingButton>
        </div>

        {output && <OutputDisplay label={output.label} value={output.value} />}
        {txHash && (
          <div className="space-y-1">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Transaction Hash</p>
            <CopyableId value={txHash} href={appLinks.tx(txHash)} explorer="tx" className="text-sm break-all" />
          </div>
        )}
        {dialog}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <pre className="text-sm text-destructive whitespace-pre-wrap break-all font-mono">{error}</pre>
          </div>
        )}
      </div>
    </ToolCard>
  )
}
