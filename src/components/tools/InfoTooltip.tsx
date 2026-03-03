"use client"

import { useState } from "react"
import { Info, Check, Copy } from "lucide-react"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { useNetwork } from "@/lib/contexts/network-context"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface InfoTooltipProps {
  rpcMethod: string
}

function getEndpointPath(method: string): string {
  if (method.startsWith("platform.")) return "/ext/bc/P"
  if (method.startsWith("info.")) return "/ext/info"
  if (method.startsWith("health.")) return "/ext/health"
  if (method.startsWith("avm.")) return "/ext/bc/X"
  if (method.startsWith("eth_")) return "/ext/bc/C/rpc"
  return "/ext/bc/C/rpc"
}

function buildCurlExample(method: string, baseUrl: string): string {
  const endpoint = getEndpointPath(method)
  return `curl -X POST --data '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "${method}",
  "params": {}
}' -H 'Content-Type: application/json' \\
  ${baseUrl}${endpoint}`
}

function buildJsExample(method: string, baseUrl: string): string {
  const endpoint = getEndpointPath(method)
  return `const response = await fetch("${baseUrl}${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "${method}",
    params: {},
  }),
});

const { result } = await response.json();
console.log(result);`
}

function CopyButton({ text }: { text: string }) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <button
      type="button"
      onClick={() => copy(text)}
      className="absolute top-2 right-2 p-1.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

export function InfoTooltip({ rpcMethod }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const { network } = useNetwork()
  const baseUrl = network.baseUrl

  // Handle composite methods like "platform.getTotalStake / platform.getCurrentSupply"
  const methods = rpcMethod.split(/\s*\/\s*/).map((m) => m.trim())
  const primary = methods[0]
  const endpoint = getEndpointPath(primary)

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              setOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                e.stopPropagation()
                setOpen(true)
              }
            }}
            className="inline-flex items-center justify-center shrink-0 rounded-sm p-0.5 -m-0.5 cursor-pointer text-muted-foreground/40 hover:text-muted-foreground transition-colors"
          >
            <Info className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <code className="text-xs">{rpcMethod}</code>
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{rpcMethod}</DialogTitle>
            <DialogDescription>
              JSON-RPC call details and usage examples.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Method details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Method</p>
                <p className="font-mono text-sm">{primary}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Endpoint</p>
                <p className="font-mono text-sm break-all">{baseUrl}{endpoint}</p>
              </div>
            </div>

            {methods.length > 1 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">All Methods</p>
                <div className="flex flex-wrap gap-1.5">
                  {methods.map((m) => (
                    <code key={m} className="text-xs bg-muted px-2 py-0.5 rounded">{m}</code>
                  ))}
                </div>
              </div>
            )}

            {/* Code examples */}
            <Tabs defaultValue="curl">
              <TabsList>
                <TabsTrigger value="curl">curl</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              </TabsList>

              <TabsContent value="curl" className="mt-3">
                <div className="space-y-3">
                  {methods.map((m) => (
                    <div key={m} className="relative">
                      {methods.length > 1 && (
                        <p className="text-xs text-muted-foreground mb-1 font-mono">{m}</p>
                      )}
                      <div className="relative">
                        <pre className="bg-muted rounded-md p-3 pr-10 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                          {buildCurlExample(m, baseUrl)}
                        </pre>
                        <CopyButton text={buildCurlExample(m, baseUrl)} />
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="javascript" className="mt-3">
                <div className="space-y-3">
                  {methods.map((m) => (
                    <div key={m} className="relative">
                      {methods.length > 1 && (
                        <p className="text-xs text-muted-foreground mb-1 font-mono">{m}</p>
                      )}
                      <div className="relative">
                        <pre className="bg-muted rounded-md p-3 pr-10 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                          {buildJsExample(m, baseUrl)}
                        </pre>
                        <CopyButton text={buildJsExample(m, baseUrl)} />
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  )
}
