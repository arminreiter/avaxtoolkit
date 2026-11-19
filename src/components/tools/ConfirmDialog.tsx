"use client"

import { useCallback, useRef, useState } from "react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ConfirmOptions {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  destructive?: boolean
}

/** Promise-based confirmation dialog. Render `dialog` once; `await confirm({...})` resolves true on confirm. */
export function useConfirm(): { confirm: (opts: ConfirmOptions) => Promise<boolean>; dialog: React.ReactNode } {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((o: ConfirmOptions) => {
    resolver.current?.(false)
    setOpts(o)
    return new Promise<boolean>(resolve => { resolver.current = resolve })
  }, [])

  const close = (result: boolean) => {
    resolver.current?.(result)
    resolver.current = null
    setOpts(null)
  }

  const dialog = (
    <AlertDialog open={opts !== null} onOpenChange={open => { if (!open) close(false) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display uppercase tracking-wider">{opts?.title}</AlertDialogTitle>
          {/* asChild: description may contain block elements (summaries, tables) */}
          <AlertDialogDescription asChild>
            <div className="text-sm text-muted-foreground break-words">{opts?.description}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant={opts?.destructive ? "destructive" : "default"} onClick={() => close(true)}>
            {opts?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirm, dialog }
}
