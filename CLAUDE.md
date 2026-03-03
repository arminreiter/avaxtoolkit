# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AVAX Toolkit — a comprehensive Avalanche network toolkit built as a statically exported Next.js app. It provides chain explorers, validator dashboards, wallet tools, contract verification, and transaction utilities. All data is fetched client-side via JSON-RPC; there is no backend.

## Commands

- **Package manager**: `pnpm` (always use pnpm, never npm/yarn)
- **Dev server**: `pnpm dev` (Next.js with Turbopack)
- **Build**: `pnpm build` (static export to `out/`)
- **Lint**: `pnpm lint` (ESLint 9)
- **Test all**: `pnpm vitest run`
- **Test single file**: `pnpm vitest run src/lib/models/network.test.ts`
- **Test watch**: `pnpm vitest`

## Tech Stack

- Next.js 16 (App Router) with `output: 'export'` — static site, no SSR/API routes
- React 19 with client-side rendering (`"use client"` throughout)
- TypeScript 5 (strict mode), path alias `@/*` → `./src/*`
- Tailwind CSS 4 with `@tailwindcss/postcss`
- shadcn/ui + Radix UI primitives
- Ethers.js 6 for all blockchain interactions
- Vitest for unit tests

## Architecture

### State Management
Two React Context providers wrap the app in `layout.tsx`:
- **NetworkContext** (`src/lib/contexts/network-context.tsx`) — current network (Mainnet/Fuji/Localhost/Custom), chain endpoints, health checking. Persists to localStorage.
- **WalletContext** (`src/lib/contexts/wallet-context.tsx`) — wallet list, active wallet, signer creation. Supports private-key, mnemonic, and injected (MetaMask) wallet types. Persists to localStorage.

### Service Layer
Static-method classes in `src/lib/services/` handle all RPC communication:
- **RpcService** — generic JSON-RPC 2.0 client with timeout handling
- **AvalancheService** — Platform API (validators, staking, L1s/subnets, P-Chain)
- **CChainService** — Ethers.js JsonRpcProvider wrapper (blocks, transactions, balances, tokens, gas, contracts)
- **VerificationService** — contract verification orchestration with provider plugins (Etherscan, Sourcify, Avalanche Explorer) in `services/verification/providers/`

### Routing
App Router pages live in `src/app/`. Navigation structure is defined in `src/lib/navigation.ts` as a typed array driving the sidebar. Major sections: Dashboard, Explorer, Validators, C-Chain, L1s, Node, Wallet, Transactions, Settings.

### Components
- `src/components/ui/` — shadcn/ui primitives (do not manually edit, use `pnpm shadcn add`)
- `src/components/tools/` — reusable building blocks (DataTable, FormField, OutputDisplay, CopyableId, etc.)
- `src/components/layout/` — Header, Sidebar, NavItem
- `src/components/dashboard/` — dashboard-specific widgets
- `src/components/contracts/` — contract read/write/verification UI
- `src/components/wallet/` — wallet manager dialog

### Models
Type definitions in `src/lib/models/`:
- `network.ts` — Network types, ChainEndpoints, DEFAULT_NETWORKS
- `wallet.ts` — StoredWallet interface, localStorage keys

## Design System

Terminal/hacker aesthetic with sharp edges (border-radius: 0). Key conventions:
- **Colors**: Avalanche red `#E84142` (primary), cyan `--neon`, green `--terminal`
- **Fonts**: Exo 2 (`--font-sans`), Rajdhani (`--font-display`), JetBrains Mono (`--font-mono`)
- **Custom CSS classes**: `glow-red`, `glow-neon`, `glow-green`, `terminal-chrome`, `ascii-sep`, `shimmer`, `cursor-blink`
- Headings use `font-display uppercase tracking-wider`
- Dark mode has CRT scanlines, grid background, and phosphor glow effects
- Theme variables are in `src/app/globals.css`

## Key Patterns

- All pages are client components — use `"use client"` directive
- Services take endpoint URLs as parameters (from NetworkContext), never hardcode URLs
- Blockchain amounts: use `nAvaxToAvax()` from `src/lib/utils.ts` for nAVAX→AVAX conversion
- Address normalization: `normalizePChainAddress()` / `normalizeXChainAddress()` auto-prefix bare `avax1...` addresses
- Icons: use Lucide React (`lucide-react`), not other icon libraries
