"use client"

import { Check, Copy } from "lucide-react"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"

interface CopyableIdProps {
  value: string
  display?: string
  className?: string
}

export function CopyableId({ value, display, className = "" }: CopyableIdProps) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <span className={`inline-flex items-center gap-1 group ${className}`}>
      <span className="break-all">{display ?? value}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          copy(value)
        }}
        className="inline-flex items-center shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </span>
  )
}
