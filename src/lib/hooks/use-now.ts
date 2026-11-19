"use client"

import { useState } from "react"
import { useInterval } from "./use-interval"

/** Date.now() that re-renders every `intervalMs` — keeps relative times/countdowns live. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useInterval(() => setNow(Date.now()), intervalMs)
  return now
}
