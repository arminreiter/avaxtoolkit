"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * Read/write a single URL query param, preserving all others (notably ?network=).
 * Pages using this must render under <Suspense> or the static export build fails.
 */
export function useQueryParam(key: string): [value: string, setValue: (v: string | null) => void] {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const value = searchParams.get(key) ?? ""

  const setValue = useCallback((v: string | null) => {
    // read the live URL so back-to-back setters don't clobber each other
    const params = new URLSearchParams(window.location.search)
    if (v) params.set(key, v)
    else params.delete(key)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [key, pathname, router])

  return [value, setValue]
}
