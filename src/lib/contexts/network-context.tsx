"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { type Network, type ChainEndpoints, DEFAULT_NETWORKS, deriveEndpoints, isValidNetwork } from "@/lib/models/network"
import { RpcService } from "@/lib/services/rpc.service"
import { CChainService } from "@/lib/services/cchain.service"

/** Check if a URL points to a private/local network address */
function isPrivateUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    )
  } catch {
    return false
  }
}

/** Check if the current page is served from localhost */
function isLocalOrigin(): boolean {
  if (typeof window === "undefined") return true
  const h = window.location.hostname
  return h === "localhost" || h === "127.0.0.1" || h === "::1"
}

/** Detect browser/extension and return an appropriate warning */
function detectConnectionWarning(): string {
  if (typeof window !== "undefined") {
    // Brave exposes navigator.brave
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const brave = (window.navigator as any).brave
    if (brave && typeof brave.isBrave === "function") {
      return "Brave Shields may be blocking requests to local networks. Disable Shields for this site or add an exception in brave://settings/shields."
    }
  }
  return "Your browser or an extension (e.g. ad blocker) may be blocking requests to local networks. Try disabling your ad blocker for this site, or use a different browser."
}

const STORAGE_KEY_NETWORK = "avax-toolkit-network"
const STORAGE_KEY_CUSTOM = "avax-toolkit-custom-networks"

interface NetworkContextValue {
  network: Network
  endpoints: ChainEndpoints
  setNetwork: (network: Network) => void
  isConnected: boolean
  /** Warning message when a local/private endpoint is blocked (e.g. by an ad blocker) */
  connectionWarning: string | null
  customNetworks: Network[]
  addCustomNetwork: (network: Network) => void
  removeCustomNetwork: (id: string) => void
  allNetworks: Network[]
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

/** Read custom networks from localStorage (returns [] on failure or SSR) */
function readCustomNetworks(): Network[] {
  if (typeof window === "undefined") return []
  try {
    const savedCustom = localStorage.getItem(STORAGE_KEY_CUSTOM)
    if (savedCustom) {
      const raw = JSON.parse(savedCustom)
      if (Array.isArray(raw)) return raw.filter(isValidNetwork)
    }
  } catch { /* localStorage not available */ }
  return []
}

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [customNetworks, setCustomNetworks] = useState<Network[]>([])

  const [network, setNetworkState] = useState<Network>(DEFAULT_NETWORKS[0])

  // Read persisted network/custom networks from localStorage after hydration (client-only)
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: hydrate client-only localStorage state after mount to avoid SSR mismatch */
  useEffect(() => {
    try {
      const parsedCustom = readCustomNetworks()
      if (parsedCustom.length) setCustomNetworks(parsedCustom)
      const allNets = [...DEFAULT_NETWORKS, ...parsedCustom]

      const params = new URLSearchParams(window.location.search)
      const urlNetwork = params.get("network")
      if (urlNetwork) {
        const found = allNets.find(n => n.id === urlNetwork)
        if (found) { setNetworkState(found); return }
      }

      const savedId = localStorage.getItem(STORAGE_KEY_NETWORK)
      if (savedId) {
        const found = allNets.find(n => n.id === savedId)
        if (found) { setNetworkState(found); return }
      }
    } catch { /* localStorage not available */ }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const [isConnected, setIsConnected] = useState(false)
  const [connectionWarning, setConnectionWarning] = useState<string | null>(null)

  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: reset connection state synchronously when network changes before async health check */
  useEffect(() => {
    let cancelled = false
    setIsConnected(false)
    setConnectionWarning(null)

    // Pre-configure ethers provider with staticNetwork to prevent
    // infinite _detectNetwork retry loops when the node is unreachable.
    const ep = deriveEndpoints(network.baseUrl, network.plainRpc)
    CChainService.getProvider(ep.cChain, network.chainId)

    RpcService.healthCheck(network.baseUrl, network.plainRpc)
      .then(ok => {
        if (cancelled) return
        setIsConnected(ok)
        if (!ok && isPrivateUrl(network.baseUrl) && !isLocalOrigin()) {
          setConnectionWarning(detectConnectionWarning())
        }
      })
      .catch(() => {
        if (cancelled) return
        setIsConnected(false)
        if (isPrivateUrl(network.baseUrl) && !isLocalOrigin()) {
          setConnectionWarning(detectConnectionWarning())
        }
      })

    return () => { cancelled = true }
  }, [network.baseUrl, network.plainRpc, network.chainId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const setNetwork = useCallback((n: Network) => {
    setNetworkState(n)
    try { localStorage.setItem(STORAGE_KEY_NETWORK, n.id) } catch { /* noop */ }
  }, [])

  const addCustomNetwork = useCallback((n: Network) => {
    setCustomNetworks(prev => {
      const updated = [...prev, n]
      try { localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(updated)) } catch { /* noop */ }
      return updated
    })
  }, [])

  const removeCustomNetwork = useCallback((id: string) => {
    setCustomNetworks(prev => {
      const updated = prev.filter(n => n.id !== id)
      try { localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(updated)) } catch { /* noop */ }
      return updated
    })
  }, [])

  const endpoints = useMemo(() => deriveEndpoints(network.baseUrl, network.plainRpc), [network.baseUrl, network.plainRpc])
  const allNetworks = useMemo(() => [...DEFAULT_NETWORKS, ...customNetworks], [customNetworks])

  const value = useMemo(() => ({
    network, endpoints, setNetwork, isConnected, connectionWarning,
    customNetworks, addCustomNetwork, removeCustomNetwork, allNetworks,
  }), [network, endpoints, setNetwork, isConnected, connectionWarning, customNetworks, addCustomNetwork, removeCustomNetwork, allNetworks])

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  )
}

export function useNetwork() {
  const context = useContext(NetworkContext)
  if (!context) throw new Error("useNetwork must be used within a NetworkProvider")
  return context
}
