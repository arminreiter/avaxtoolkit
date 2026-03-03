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

const MAX_ERROR_LENGTH = 300

function truncateError(msg: string): string {
  if (msg.length <= MAX_ERROR_LENGTH) return msg
  return msg.slice(0, MAX_ERROR_LENGTH) + "..."
}

interface FunctionAccordionProps {
  entry: ABIEntry
  onCall: (args: string[]) => Promise<string>
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
  const [loading, setLoading] = useState(false)

  const prevInputsLength = useRef(inputs.length)
  useEffect(() => {
    if (inputs.length !== prevInputsLength.current) {
      prevInputsLength.current = inputs.length
      setArgs(inputs.map(() => ""))
      setResult("")
      setError("")
    }
  }, [inputs.length, inputs])
  const [result, setResult] = useState("")
  const [error, setError] = useState("")

  // Auto-execute on first expand for zero-arg read functions
  const autoExecuted = useRef(false)
  useEffect(() => {
    if (autoExecute && expanded && !autoExecuted.current && inputs.length === 0 && !loading) {
      autoExecuted.current = true
      setLoading(true)
      setResult("")
      setError("")
      onCall([])
        .then(res => setResult(res))
        .catch(err => setError(truncateError(err instanceof Error ? err.message : String(err))))
        .finally(() => setLoading(false))
    }
  }, [autoExecute, expanded, inputs.length, loading, onCall])

  const functionName = entry.name ?? "constructor"
  const signature = `${functionName}(${inputs.map((p) => `${p.type} ${p.name}`).join(", ")})`
  const isReadOnly =
    entry.stateMutability === "view" || entry.stateMutability === "pure"

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

  const handleCall = useCallback(async () => {
    setLoading(true)
    setResult("")
    setError("")
    try {
      const res = await onCall(args)
      setResult(res)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(truncateError(msg))
    } finally {
      setLoading(false)
    }
  }, [onCall, args])

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

          {/* Call button */}
          <LoadingButton
            loading={loading}
            disabled={disabled}
            onClick={handleCall}
            size="sm"
          >
            {isReadOnly ? (autoExecute ? "Refresh" : "Query") : "Write"}
          </LoadingButton>

          {/* Result display */}
          {result && (
            <pre className="bg-muted rounded-lg p-3 text-sm font-mono whitespace-pre-wrap break-all">
              {result}
            </pre>
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
