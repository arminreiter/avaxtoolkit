"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react"
import { JsonRpcProvider, BrowserProvider, type Signer } from "ethers/providers"
import { Wallet } from "ethers/wallet"
import { type StoredWallet, isValidWallet, WALLET_STORAGE_KEY, ACTIVE_WALLET_STORAGE_KEY } from "@/lib/models/wallet"
import { useNetwork } from "@/lib/contexts/network-context"
import type { Network } from "@/lib/models/network"

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      isMetaMask?: boolean
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

type InjectedProvider = NonNullable<Window["ethereum"]>

/** Switches (or adds) the injected wallet to the network's C-Chain. Returns true if the chain changed. */
async function ensureInjectedChain(eth: InjectedProvider, network: Network, rpcUrl: string): Promise<boolean> {
  const current = await eth.request({ method: "eth_chainId" }) as string
  if (parseInt(current, 16) === network.chainId) return false
  const chainId = `0x${network.chainId.toString(16)}`
  const rejected = (err: unknown) => (err as { code?: number })?.code === 4001
    ? new Error(`Network switch rejected. Switch your wallet to ${network.name} (chain ID ${network.chainId}) to continue.`)
    : err
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] })
  } catch (err) {
    if ((err as { code?: number })?.code !== 4902) throw rejected(err)
    try {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId,
          chainName: network.name,
          rpcUrls: [rpcUrl],
          nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
        }],
      })
    } catch (addErr) {
      throw rejected(addErr)
    }
  }
  return true
}

interface WalletDataContextValue {
  wallets: StoredWallet[]
  activeWallet: StoredWallet | null
  setActiveWallet: (id: string) => void
  /** Returns false (and just selects the existing wallet) if the address is already stored. */
  addWallet: (wallet: StoredWallet) => boolean
  removeWallet: (id: string) => void
  renameWallet: (id: string, name: string) => void
  importWallets: (incoming: StoredWallet[], mode: "merge" | "replace", activeId?: string | null) => void
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
  const { network, endpoints } = useNetwork()
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
    const existing = wallets.find(w => w.address.toLowerCase() === wallet.address.toLowerCase())
    if (existing) {
      setActiveWallet(existing.id)
      return false
    }
    const updated = [...wallets, wallet]
    setWallets(updated)
    persistWallets(updated)
    setActiveWallet(wallet.id)
    return true
  }, [wallets, persistWallets, setActiveWallet])

  // Removing the active wallet falls back to the first remaining one (or none).
  const removeWallet = useCallback((id: string) => {
    const updated = wallets.filter(w => w.id !== id)
    setWallets(updated)
    persistWallets(updated)
    if (activeWalletIdRef.current === id) {
      if (updated.length) {
        setActiveWallet(updated[0].id)
      } else {
        setActiveWalletId(null)
        try { localStorage.removeItem(ACTIVE_WALLET_STORAGE_KEY) } catch { /* noop */ }
      }
    }
  }, [wallets, persistWallets, setActiveWallet])

  const renameWallet = useCallback((id: string, name: string) => {
    setWallets(prev => {
      const updated = prev.map(w => w.id === id ? { ...w, name } : w)
      persistWallets(updated)
      return updated
    })
  }, [persistWallets])

  // Merge skips addresses already present (case-insensitive) and keeps the active wallet;
  // replace swaps the whole list and adopts the imported active wallet.
  const importWallets = useCallback((incoming: StoredWallet[], mode: "merge" | "replace", activeId: string | null = null) => {
    setWallets(prev => {
      const known = new Set(prev.map(w => w.address.toLowerCase()))
      const updated = mode === "replace"
        ? incoming
        : [...prev, ...incoming.filter(w => !known.has(w.address.toLowerCase()))]
      persistWallets(updated)
      return updated
    })
    if (mode === "merge") return
    if (activeId) {
      setActiveWallet(activeId)
    } else {
      setActiveWalletId(null)
      try { localStorage.removeItem(ACTIVE_WALLET_STORAGE_KEY) } catch { /* noop */ }
    }
  }, [persistWallets, setActiveWallet])

  const getSigner = useCallback(async (): Promise<Signer | null> => {
    if (!activeWallet) return null

    if (activeWallet.type === "connected") {
      if (activeWallet.connectorType === "injected" && window.ethereum) {
        if (await ensureInjectedChain(window.ethereum, network, endpoints.cChain)) {
          browserProviderRef.current = null
        }
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
  }, [activeWallet, network, endpoints.cChain])

  // Clear browser provider cache when wallet changes (different MetaMask account)
  useEffect(() => {
    browserProviderRef.current = null
  }, [activeWallet?.id])

  // Follow account/chain changes made inside the injected wallet.
  useEffect(() => {
    const eth = window.ethereum
    if (!eth?.on || !eth.removeListener) return
    const onAccountsChanged = (accounts: unknown) => {
      browserProviderRef.current = null
      const injected = wallets.find(w => w.type === "connected" && w.connectorType === "injected")
      if (!injected) return
      const next = (accounts as string[])[0]
      if (!next) {
        removeWallet(injected.id)
        return
      }
      if (next.toLowerCase() === injected.address.toLowerCase()) return
      const updated = wallets.map(w => w.id === injected.id ? { ...w, address: next } : w)
      setWallets(updated)
      persistWallets(updated)
    }
    const onChainChanged = () => { browserProviderRef.current = null }
    eth.on("accountsChanged", onAccountsChanged)
    eth.on("chainChanged", onChainChanged)
    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged)
      eth.removeListener?.("chainChanged", onChainChanged)
    }
  }, [wallets, removeWallet, persistWallets])

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
      }).catch((err: unknown) => {
        if (requireRejectRef.current && requireResolverRef.current === currentResolver) {
          const reject = requireRejectRef.current
          requireResolverRef.current = null
          requireRejectRef.current = null
          reject(err instanceof Error ? err : new Error("Failed to get signer"))
        }
      })
    }
  }, [activeWallet, getSigner])

  const dataValue = useMemo(() => ({
    wallets, activeWallet, setActiveWallet, addWallet, removeWallet, renameWallet,
    importWallets, getSigner, requireWallet,
  }), [wallets, activeWallet, setActiveWallet, addWallet, removeWallet, renameWallet,
    importWallets, getSigner, requireWallet])

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
