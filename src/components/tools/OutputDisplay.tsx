"use client"

import { Check, Copy } from "lucide-react"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface OutputDisplayProps { label: string; value: string; monospace?: boolean }

export function OutputDisplay({ label, value, monospace = true }: OutputDisplayProps) {
  const { copied, copy } = useCopyToClipboard()
  if (!value) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copy(value)}>
          {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className={`bg-muted rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap break-all ${monospace ? "font-mono" : ""}`}>
        {value}
      </pre>
    </div>
  )
}
