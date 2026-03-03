# AVAX Toolkit

A comprehensive Avalanche network toolkit built as a statically exported Next.js app. Provides chain explorers, validator dashboards, wallet tools, contract verification, and transaction utilities. All data is fetched client-side via JSON-RPC -- there is no backend.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)

## Features

### Explorer
- **Live Block Feed** -- real-time C-Chain block explorer with 2-second polling, expandable block details, and inline transaction inspection

### Validators
- **Overview** -- sortable table of all current validators with stake, uptime, and status
- **Dashboard** -- comprehensive single-validator view with staking period, delegations, rewards, peer info, and L1 memberships
- **Status Diagnostics** -- uptime analysis with 80% reward threshold tracking, recovery estimates, and actionable recommendations
- **Delegator Lookup** -- view all delegators for a given validator with stake amounts and time ranges
- **Staking History** -- P-Chain address staking positions, UTXOs, and CSV/JSON export

### C-Chain Tools
- **Block Lookup** -- fetch any block by number with full details
- **Transaction Lookup** -- inspect transactions with status, gas, and address info
- **Balance Checker** -- AVAX balance for any C-Chain address
- **Token Info** -- ERC-20 token metadata (name, symbol, decimals, supply)
- **Gas Tracker** -- current gas price, max fee, and priority fee
- **Contract Verification** -- multi-provider verification status (Routescan, Snowscan, Sourcify, Avalanche Explorer) with source code viewer, proxy detection, and cross-verification

### L1s (Subnets)
- Browse all L1s, blockchains, and subnet validators
- L1 details with control keys and validator counts
- Blockchain sync/validation status checks

### Node
- **Health** -- liveness, readiness, and detailed health check results
- **Info** -- node identity, bootstrap status, installed VMs, network upgrades, and ACPs

### Wallet
- Generate BIP-39 seed phrases (12/24 words) and standalone key pairs
- Derive HD wallet addresses from a mnemonic
- Address format conversion (EIP-55 checksumming)
- JSON keystore import/export
- X-Chain balance lookup

### Transactions
- **Send** -- transfer AVAX on the C-Chain with gas estimation
- **Fan Out** -- distribute AVAX from one wallet to multiple addresses with CSV import
- **Drain** -- consolidate balances from multiple wallets into one destination

### Wallet Manager
- Persistent wallet storage (private key, mnemonic, MetaMask injection)
- Multi-wallet support with quick switching
- Integrated into all transaction tools

## Quick Start

```bash
git clone https://github.com/arminreiter/avaxtoolkit.git
cd avaxtoolkit
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app connects to Avalanche Mainnet by default.

### Build for Production

```bash
pnpm build
```

Produces a fully static site in `out/` that can be served from any static host.

## Connecting to a Remote Validator

If your node is not publicly exposed, use an SSH tunnel:

```
ssh -L 9650:localhost:9650 user@your-validator-ip
```

Then select **Localhost** in the Settings page or add a custom network pointing to `http://127.0.0.1:9650`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, static export) |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| Blockchain | Ethers.js 6 |
| Language | TypeScript 5 (strict mode) |
| Testing | Vitest |
| Icons | Lucide React |
| Syntax Highlighting | Shiki (dynamically imported) |

## Architecture

```
src/
  app/                  # Next.js App Router pages (all client components)
  components/
    ui/                 # shadcn/ui primitives
    tools/              # Reusable building blocks (DataTable, FormField, etc.)
    layout/             # Header, Sidebar, NavItem
    dashboard/          # Dashboard widgets
    contracts/          # Contract verification UI
    wallet/             # Wallet manager dialog
  lib/
    contexts/           # React Context providers
      network-context   #   Network selection, endpoints, health checking
      wallet-context    #   Wallet list, active wallet, signer creation
    services/           # RPC communication layer
      rpc.service       #   Generic JSON-RPC 2.0 client
      avalanche.service #   Platform API (validators, staking, L1s)
      cchain.service    #   Ethers.js provider wrapper
      verification/     #   Multi-provider contract verification
    models/             # Type definitions (Network, Wallet)
    navigation.ts       # Typed sidebar navigation structure
    utils.ts            # Shared utilities
```

### Key Patterns

- **No backend** -- all data fetched client-side via JSON-RPC. The app is a static export.
- **Context-driven** -- `NetworkContext` manages the active network and derived RPC endpoints. `WalletContext` manages wallet state and signer creation. Both persist to localStorage.
- **Service layer** -- static-method classes take endpoint URLs as parameters (from context), never hardcode URLs.
- **Multi-provider verification** -- contract verification queries Routescan, Snowscan, Sourcify, and Avalanche Explorer in parallel, with proxy detection and cross-verification support.

## Configuration

### Networks

The Settings page supports:
- **Default networks**: Mainnet, Fuji testnet, Localhost
- **Quick-add presets**: Anvil/Hardhat, Ganache
- **Custom networks**: any JSON-RPC endpoint with connection testing

Toggle **Plain JSON-RPC** for non-Avalanche chains (only C-Chain/EVM tools will work).

### API Keys

An optional Etherscan API key (stored in localStorage) enables the Snowscan verification provider. Configure it in Settings > API Keys.

## Development

```bash
pnpm dev          # Dev server with Turbopack
pnpm build        # Static export to out/
pnpm lint         # ESLint 9
pnpm vitest run   # Run all tests
pnpm vitest       # Watch mode
```
