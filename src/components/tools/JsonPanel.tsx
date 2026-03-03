"use client"

import { Check, Copy } from "lucide-react"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { Button } from "@/components/ui/button"

interface JsonPanelProps {
  data: unknown
}

export function JsonPanel({ data }: JsonPanelProps) {
  const { copied, copy } = useCopyToClipboard()
  const json = JSON.stringify(data, null, 2)

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
          Raw JSON
        </span>
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => copy(json)}>
          {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="flex-1 overflow-auto p-3 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed">
        {json}
      </pre>
    </div>
  )
}
