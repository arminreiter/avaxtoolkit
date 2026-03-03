"use client"

import { useState } from "react"
import { Check, Copy, Eye, EyeOff } from "lucide-react"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface SensitiveDisplayProps { label: string; value: string; monospace?: boolean }

export function SensitiveDisplay({ label, value, monospace = true }: SensitiveDisplayProps) {
  const { copied, copy } = useCopyToClipboard()
  const [revealed, setRevealed] = useState(false)

  if (!value) return null
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setRevealed(r => !r)}>
            {revealed ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
            {revealed ? "Hide" : "Reveal"}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copy(value)}>
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <pre className={`bg-muted rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap break-all ${monospace ? "font-mono" : ""}`}>
        {revealed ? value : "\u2022".repeat(Math.min(value.length, 32))}
      </pre>
    </div>
  )
}
