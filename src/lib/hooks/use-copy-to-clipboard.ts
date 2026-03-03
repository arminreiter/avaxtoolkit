import { useState, useCallback, useRef, useEffect } from "react"

export function useCopyToClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const copy = useCallback(async (text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      timerRef.current = setTimeout(() => setCopied(false), timeout)
    } catch {
      // Clipboard access denied (permissions, non-HTTPS, unfocused tab)
    }
  }, [timeout])

  return { copied, copy }
}
