"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react"
import { JsonRpcProvider, BrowserProvider, type Signer } from "ethers/providers"
import { Wallet } from "ethers/wallet"
import { type StoredWallet, isValidWallet, WALLET_STORAGE_KEY, ACTIVE_WALLET_STORAGE_KEY } from "@/lib/models/wallet"
import { useNetwork } from "@/lib/contexts/network-context"

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      isMetaMask?: boolean
    }
  }
}

interface WalletDataContextValue {
  wallets: StoredWallet[]
  activeWallet: StoredWallet | null
  setActiveWallet: (id: string) => void
  addWallet: (wallet: StoredWallet) => void
  removeWallet: (id: string) => void
  renameWallet: (id: string, name: string) => void
  getSigner: () => Promise<Signer | null>
  requireWallet: () => Promise<Signer>
}

interface WalletDialogContextValue {
  isWalletDialogOpen: boolean
  openWalletDialog: () => void
  closeWalletDialog: () => void
}

const WalletDataContext = createContext<WalletDataContextValue | null>(null)
const WalletDialogContext = createContext<WalletDialogContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const { endpoints } = useNetwork()
  const [wallets, setWallets] = useState<StoredWallet[]>([])
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)

  // Read persisted wallets from localStorage after hydration (client-only)
  /* eslint-disable react-hooks/set-state-in-effect -- Intentional: hydrate client-only localStorage state after mount to avoid SSR mismatch */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(WALLET_STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(isValidWallet)
          if (valid.length) setWallets(valid)
        }
      }
      const savedActive = localStorage.getItem(ACTIVE_WALLET_STORAGE_KEY)
      if (savedActive) setActiveWalletId(savedActive)
    } catch { /* localStorage not available */ }
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */
  const [isWalletDialogOpen, setIsWalletDialogOpen] = useState(false)

  const requireResolverRef = useRef<((signer: Signer) => void) | null>(null)
  const requireRejectRef = useRef<((reason: Error) => void) | null>(null)
  const activeWalletIdRef = useRef(activeWalletId)
  useEffect(() => { activeWalletIdRef.current = activeWalletId }, [activeWalletId])

  // Provider caching
  const jsonRpcProviderRef = useRef<{ url: string; provider: JsonRpcProvider } | null>(null)
  const browserProviderRef = useRef<BrowserProvider | null>(null)

  const persistWallets = useCallback((updated: StoredWallet[]) => {
    try { localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(updated)) } catch { /* noop */ }
  }, [])

  const activeWallet = useMemo(
    () => wallets.find(w => w.id === activeWalletId) ?? null,
    [wallets, activeWalletId]
  )

  const setActiveWallet = useCallback((id: string) => {
    setActiveWalletId(id)
    try { localStorage.setItem(ACTIVE_WALLET_STORAGE_KEY, id) } catch { /* noop */ }
  }, [])

  const addWallet = useCallback((wallet: StoredWallet) => {
    setWallets(prev => {
      const updated = [...prev, wallet]
      persistWallets(updated)
      return updated
    })
    setActiveWallet(wallet.id)
  }, [persistWallets, setActiveWallet])

  const removeWallet = useCallback((id: string) => {
    setWallets(prev => {
      const updated = prev.filter(w => w.id !== id)
      persistWallets(updated)
      return updated
    })
    if (activeWalletIdRef.current === id) {
      setActiveWalletId(null)
      try { localStorage.removeItem(ACTIVE_WALLET_STORAGE_KEY) } catch { /* noop */ }
    }
  }, [persistWallets])

  const renameWallet = useCallback((id: string, name: string) => {
    setWallets(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, name } : w)
      persistWallets(updated)
      return updated
    })
  }, [persistWallets])

  const getSigner = useCallback(async (): Promise<Signer | null> => {
    if (!activeWallet) return null

    if (activeWallet.type === "connected") {
      if (activeWallet.connectorType === "injected" && window.ethereum) {
        if (!browserProviderRef.current) {
          browserProviderRef.current = new BrowserProvider(window.ethereum)
        }
        return browserProviderRef.current.getSigner()
      }
      return null
    }

    if (activeWallet.privateKey) {
      const cached = jsonRpcProviderRef.current
      let provider: JsonRpcProvider
      if (cached && cached.url === endpoints.cChain) {
        provider = cached.provider
      } else {
        provider = new JsonRpcProvider(endpoints.cChain)
        jsonRpcProviderRef.current = { url: endpoints.cChain, provider }
      }
      return new Wallet(activeWallet.privateKey, provider)
    }

    return null
  }, [activeWallet, endpoints.cChain])

  // Clear browser provider cache when wallet changes (different MetaMask account)
  useEffect(() => {
    browserProviderRef.current = null
  }, [activeWallet?.id])

  const openWalletDialog = useCallback(() => setIsWalletDialogOpen(true), [])
  const closeWalletDialog = useCallback(() => {
    setIsWalletDialogOpen(false)
    if (requireRejectRef.current) {
      requireRejectRef.current(new Error("Wallet selection cancelled"))
    }
    requireResolverRef.current = null
    requireRejectRef.current = null
  }, [])

  const requireWallet = useCallback(async (): Promise<Signer> => {
    const existing = await getSigner()
    if (existing) return existing

    // Reject any previously pending requireWallet promise before creating a new one
    if (requireRejectRef.current) {
      requireRejectRef.current(new Error("Superseded by new wallet request"))
      requireResolverRef.current = null
      requireRejectRef.current = null
    }

    return new Promise<Signer>((resolve, reject) => {
      requireResolverRef.current = resolve
      requireRejectRef.current = reject
      setIsWalletDialogOpen(true)
    })
  }, [getSigner])

  useEffect(() => {
    if (activeWallet && requireResolverRef.current) {
      const currentResolver = requireResolverRef.current
      getSigner().then(signer => {
        // Only resolve if the refs still point to the same promise (not superseded or closed)
        if (signer && requireResolverRef.current === currentResolver) {
          requireResolverRef.current = null
          requireRejectRef.current = null
          setIsWalletDialogOpen(false)
          currentResolver(signer)
        }
      }).catch(() => {
        if (requireRejectRef.current && requireResolverRef.current === currentResolver) {
          const reject = requireRejectRef.current
          requireResolverRef.current = null
          requireRejectRef.current = null
          reject(new Error("Failed to get signer"))
        }
      })
    }
  }, [activeWallet, getSigner])

  const dataValue = useMemo(() => ({
    wallets, activeWallet, setActiveWallet, addWallet, removeWallet, renameWallet,
    getSigner, requireWallet,
  }), [wallets, activeWallet, setActiveWallet, addWallet, removeWallet, renameWallet,
    getSigner, requireWallet])

  const dialogValue = useMemo(() => ({
    isWalletDialogOpen, openWalletDialog, closeWalletDialog,
  }), [isWalletDialogOpen, openWalletDialog, closeWalletDialog])

  return (
    <WalletDataContext.Provider value={dataValue}>
      <WalletDialogContext.Provider value={dialogValue}>
        {children}
      </WalletDialogContext.Provider>
    </WalletDataContext.Provider>
  )
}

export function useWallet() {
  const data = useContext(WalletDataContext)
  const dialog = useContext(WalletDialogContext)
  if (!data || !dialog) throw new Error("useWallet must be used within a WalletProvider")
  return { ...data, ...dialog }
}

export function useWalletData() {
  const context = useContext(WalletDataContext)
  if (!context) throw new Error("useWalletData must be used within a WalletProvider")
  return context
}

export function useWalletDialog() {
  const context = useContext(WalletDialogContext)
  if (!context) throw new Error("useWalletDialog must be used within a WalletProvider")
  return context
}
