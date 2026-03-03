"use client"

import { useNetwork } from "@/lib/contexts/network-context"
import { useWallet } from "@/lib/contexts/wallet-context"
import { Moon, Sun, Wallet, ShieldAlert } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { truncateId } from "@/lib/utils"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function Header() {
  const { network, setNetwork, isConnected, connectionWarning, allNetworks } = useNetwork()
  const { activeWallet, openWalletDialog } = useWallet()
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <header className="flex items-center justify-between px-3 sm:px-6 h-11 border-b border-border bg-card/80">
      <div className="flex items-center gap-2 sm:gap-4 h-full min-w-0">
        {/* Network selector */}
        <div className="flex items-center gap-2 h-full min-w-0">
          <span className="text-[10px] font-mono text-muted-foreground tracking-wider hidden sm:inline">
            NET:
          </span>
          <Select value={network.id} onValueChange={(id) => {
            const found = allNetworks.find(n => n.id === id)
            if (found) setNetwork(found)
          }}>
            <SelectTrigger className="w-32 sm:w-48 h-7 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="font-mono">
              {allNetworks.map(n => (
                <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono shrink-0">
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="pulse-dot absolute inline-flex h-full w-full bg-[#007700] dark:bg-[#00ff41]" />
                <span className="relative inline-flex h-2 w-2 bg-[#007700] dark:bg-[#00ff41]" />
              </span>
              <span className="text-[#007700] dark:text-[#00ff41] tracking-wider uppercase hidden sm:inline">
                Connected
              </span>
            </>
          ) : (
            <>
              <span className="h-2 w-2 bg-red-500 shrink-0" />
              <span className="text-red-500 tracking-wider uppercase hidden sm:inline">
                Offline
              </span>
              {connectionWarning && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <ShieldAlert className="h-3.5 w-3.5 text-yellow-500 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {connectionWarning}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5 sm:gap-3 h-full shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs font-mono gap-1.5"
          onClick={openWalletDialog}
        >
          <Wallet className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {activeWallet ? truncateId(activeWallet.address, 6, 4) : "Connect"}
          </span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>
    </header>
  )
}
