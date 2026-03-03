import {
  LayoutDashboard, Shield, Blocks, Network, Wallet, Settings, Server, Info,
  Search, KeyRound,
  type LucideIcon,
} from "lucide-react"

export interface NavSection {
  label: string
  href: string
  icon: LucideIcon
  children?: { label: string; href: string }[]
}

export const navigation: NavSection[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Explorer", href: "/explorer", icon: Search },
  {
    label: "Wallet", href: "/transactions", icon: Wallet,
    children: [
      { label: "Dashboard", href: "/transactions" },
      { label: "Send", href: "/transactions/send" },
      { label: "Fan Out", href: "/transactions/fan-out" },
      { label: "Drain", href: "/transactions/drain" },
    ],
  },
  {
    label: "C-Chain", href: "/c-chain", icon: Blocks,
    children: [
      { label: "Blocks", href: "/c-chain/blocks" },
      { label: "Transactions", href: "/c-chain/transactions" },
      { label: "Balances", href: "/c-chain/balances" },
      { label: "Tokens", href: "/c-chain/tokens" },
      { label: "Gas Tracker", href: "/c-chain/gas" },
      { label: "Contract Verification", href: "/c-chain/contracts" },
    ],
  },
  {
    label: "Validators", href: "/validators", icon: Shield,
    children: [
      { label: "Overview", href: "/validators" },
      { label: "Dashboard", href: "/validators/dashboard" },
      { label: "Status", href: "/validators/status" },
      { label: "Delegators", href: "/validators/delegators" },
      { label: "Staking History", href: "/validators/staking-history" },
    ],
  },
  {
    label: "Node", href: "/node", icon: Server,
    children: [
      { label: "Health", href: "/node/health" },
      { label: "Info", href: "/node/info" },
    ],
  },
  {
    label: "L1s", href: "/l1s", icon: Network,
    children: [
      { label: "Overview", href: "/l1s" },
      { label: "L1 Info", href: "/l1s/info" },
      { label: "Validators", href: "/l1s/validators" },
      { label: "Blockchains", href: "/l1s/blockchains" },
      { label: "Blockchain Status", href: "/l1s/blockchain-status" },
    ],
  },
  {
    label: "Key Management", href: "/wallet", icon: KeyRound,
    children: [
      { label: "Generate", href: "/wallet/generate" },
      { label: "Derive Addresses", href: "/wallet/derive" },
      { label: "Convert Address", href: "/wallet/convert" },
      { label: "Import / Export", href: "/wallet/import-export" },
      { label: "X-Chain Balance", href: "/wallet/x-chain-balance" },
    ],
  },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "About", href: "/about", icon: Info },
]
