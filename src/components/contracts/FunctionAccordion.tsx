"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/tools/LoadingButton"
import type { ABIEntry } from "@/lib/services/verification"
import { errorMessage } from "@/lib/utils"
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard"
import { Check, Copy } from "lucide-react"

const MAX_ERROR_LENGTH = 300

function truncateError(msg: string): string {
  if (msg.length <= MAX_ERROR_LENGTH) return msg
  return msg.slice(0, MAX_ERROR_LENGTH) + "..."
}

/** `text` is what gets copied; `node` (if set) is what gets rendered. */
export interface CallResult {
  text: string
  node?: React.ReactNode
}

interface FunctionAccordionProps {
  entry: ABIEntry
  /** `value` is the AVAX amount for payable functions ("" otherwise); `onProgress` shows interim results. */
  onCall: (args: string[], value: string, onProgress: (r: CallResult) => void) => Promise<CallResult>
  disabled?: boolean
  accordionValue?: string
  className?: string
  expanded?: boolean
  autoExecute?: boolean
}

export function FunctionAccordion({
  entry,
  onCall,
  disabled,
  accordionValue,
  className,
  expanded,
  autoExecute,
}: FunctionAccordionProps) {
  const inputs = useMemo(() => entry.inputs ?? [], [entry.inputs])
  const [args, setArgs] = useState<string[]>(() => inputs.map(() => ""))
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CallResult | null>(null)
  const [error, setError] = useState("")
  const { copied, copy } = useCopyToClipboard()

  const [prevInputs, setPrevInputs] = useState(inputs)
  if (inputs !== prevInputs) {
    setPrevInputs(inputs)
    setArgs(inputs.map(() => ""))
    setResult(null)
    setError("")
  }

  const run = useCallback(async (callArgs: string[], callValue: string) => {
    setLoading(true)
    setResult(null)
    setError("")
    try {
      setResult(await onCall(callArgs, callValue, setResult))
    } catch (err) {
      setError(truncateError(errorMessage(err, String(err))))
    } finally {
      setLoading(false)
    }
  }, [onCall])

  // Auto-execute on first expand for zero-arg read functions
  const autoExecuted = useRef(false)
  useEffect(() => {
    if (autoExecute && expanded && !autoExecuted.current && inputs.length === 0) {
      autoExecuted.current = true
      Promise.resolve().then(() => run([], ""))
    }
  }, [autoExecute, expanded, inputs.length, run])

  const functionName = entry.name ?? "constructor"
  const signature = `${functionName}(${inputs.map((p) => `${p.type} ${p.name}`).join(", ")})`
  const isReadOnly =
    entry.stateMutability === "view" || entry.stateMutability === "pure"
  const isPayable = entry.stateMutability === "payable"

  const handleArg = useCallback(
    (index: number, value: string) => {
      setArgs((prev) => {
        const next = [...prev]
        next[index] = value
        return next
      })
    },
    []
  )

  return (
    <AccordionItem value={accordionValue ?? functionName} className={className}>
      <AccordionTrigger className="font-mono text-sm">
        <div className="flex items-center gap-2">
          <span>{signature}</span>
          {entry.stateMutability && (
            <Badge variant="secondary" className="text-xs">
              {entry.stateMutability}
            </Badge>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4">
          {/* Input fields for each parameter */}
          {inputs.map((param, index) => (
            <div key={`${param.name}-${index}`} className="space-y-2">
              <Label htmlFor={`${functionName}-${param.name}-${index}`} className="font-mono text-sm">
                {param.name} ({param.type})
              </Label>
              <Input
                id={`${functionName}-${param.name}-${index}`}
                value={args[index]}
                onChange={(e) => handleArg(index, e.target.value)}
                placeholder={param.type}
                className="font-mono"
              />
            </div>
          ))}

          {isPayable && (
            <div className="space-y-2">
              <Label htmlFor={`${functionName}-value`} className="font-mono text-sm">
                Value (AVAX)
              </Label>
              <Input
                id={`${functionName}-value`}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
                className="font-mono"
              />
            </div>
          )}

          {/* Call button */}
          <LoadingButton
            loading={loading}
            disabled={disabled}
            onClick={() => run(args, value)}
            size="sm"
          >
            {isReadOnly ? (autoExecute ? "Refresh" : "Query") : "Write"}
          </LoadingButton>

          {/* Result display */}
          {result && (
            <div className="relative bg-muted rounded-lg p-3 pr-10 text-sm font-mono whitespace-pre-wrap break-all">
              {result.node ?? result.text}
              <button
                type="button"
                onClick={() => copy(result.text)}
                className="absolute top-2 right-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
                title="Copy result"
                aria-label="Copy result"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}

          {/* Error display */}
          {error && (
            <p className="text-destructive text-sm font-mono">{error}</p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
