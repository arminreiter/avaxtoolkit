"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { type Network, type ChainEndpoints, DEFAULT_NETWORKS, deriveEndpoints, isValidNetwork } from "@/lib/models/network"
import { RpcService } from "@/lib/services/rpc.service"
import { CChainService } from "@/lib/services/cchain.service"

const STORAGE_KEY_NETWORK = "avax-toolkit-network"
const STORAGE_KEY_CUSTOM = "avax-toolkit-custom-networks"

interface NetworkContextValue {
  network: Network
  endpoints: ChainEndpoints
  setNetwork: (network: Network) => void
  isConnected: boolean
  customNetworks: Network[]
  addCustomNetwork: (network: Network) => void
  removeCustomNetwork: (id: string) => void
  allNetworks: Network[]
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>(DEFAULT_NETWORKS[0])
  const [isConnected, setIsConnected] = useState(false)
  const [customNetworks, setCustomNetworks] = useState<Network[]>([])

  /* eslint-disable react-hooks/set-state-in-effect -- SSR-safe: must use useEffect for localStorage to avoid hydration mismatch */
  useEffect(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEY_NETWORK)
      const savedCustom = localStorage.getItem(STORAGE_KEY_CUSTOM)

      let parsedCustom: Network[] = []
      if (savedCustom) {
        const raw = JSON.parse(savedCustom)
        if (Array.isArray(raw)) {
          parsedCustom = raw.filter(isValidNetwork)
        }
        setCustomNetworks(parsedCustom)
      }

      if (savedId) {
        const allNets = [...DEFAULT_NETWORKS, ...parsedCustom]
        const found = allNets.find(n => n.id === savedId)
        if (found) setNetworkState(found)
      }

      const params = new URLSearchParams(window.location.search)
      const urlNetwork = params.get("network")
      if (urlNetwork) {
        const found = [...DEFAULT_NETWORKS, ...parsedCustom].find(n => n.id === urlNetwork)
        if (found) setNetworkState(found)
      }
    } catch {
      // localStorage not available
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsConnected(false)

    // Pre-configure ethers provider with staticNetwork to prevent
    // infinite _detectNetwork retry loops when the node is unreachable.
    const ep = deriveEndpoints(network.baseUrl, network.plainRpc)
    CChainService.getProvider(ep.cChain, network.chainId)

    RpcService.healthCheck(network.baseUrl, network.plainRpc)
      .then(ok => { if (!cancelled) setIsConnected(ok) })
      .catch(() => { if (!cancelled) setIsConnected(false) })

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
    network, endpoints, setNetwork, isConnected,
    customNetworks, addCustomNetwork, removeCustomNetwork, allNetworks,
  }), [network, endpoints, setNetwork, isConnected, customNetworks, addCustomNetwork, removeCustomNetwork, allNetworks])

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
