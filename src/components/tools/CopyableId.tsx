"use client"

import Link from "next/link"
import { Check, Copy, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { useNetwork } from "@/lib/contexts/network-context"
import { explorerUrl, type ExplorerKind } from "@/lib/explorer-links"

interface CopyableIdProps {
  value: string
  display?: string
  className?: string
  /** Internal link wrapped around the display text. */
  href?: string
  /** Adds an external explorer icon link (hidden on localhost/custom networks). */
  explorer?: ExplorerKind
}

export function CopyableId({ value, display, className = "", href, explorer }: CopyableIdProps) {
  const { copied, copy } = useCopyToClipboard()
  const { network } = useNetwork()
  const external = explorer ? explorerUrl(network, explorer, value) : null
  const text = display ?? value

  return (
    <span className={cn("inline-flex items-center gap-1 group", className)}>
      {href ? (
        <Link href={href} className="break-all hover:text-primary hover:underline underline-offset-2">{text}</Link>
      ) : (
        <span className="break-all">{text}</span>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          copy(value)
        }}
        className="inline-flex items-center shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
        title="Copy to clipboard"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
      {external && (
        <a
          href={external}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          title="View on explorer"
          aria-label="View on explorer"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </span>
  )
}
