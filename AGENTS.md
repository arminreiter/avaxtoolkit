# AVAX Toolkit

A local-first, statically exported Next.js app for the Avalanche ecosystem: chain explorers, validator dashboards, wallet tools, contract verification, and transaction utilities. There is **no backend** — all data is fetched client-side over JSON-RPC, and wallets/config live in the browser.

## Stack

- **Runtime**: Node.js (Next.js 16 requirement). **Package manager is `pnpm` only — never use npm or yarn.**
- **Framework**: Next.js 16 (App Router) with `output: 'export'` — fully static, no SSR, API routes, server actions, or middleware.
- **UI**: React 19 (client-side throughout), shadcn/ui (new-york style) over `radix-ui` primitives, Tailwind CSS 4.
- **Blockchain**: Ethers.js 6 for all C-Chain interaction; raw JSON-RPC 2.0 for P-Chain/Platform API.
- **Theming**: `next-themes` for dark mode; `tw-animate-css` for animations.
- **Syntax highlighting**: `shiki`. **Config import/export**: `jszip` + Web Crypto (AES) in `config-crypto.ts`.
- **Icons**: `lucide-react` only — do not add other icon libraries.
- **Testing**: Vitest 4 (node environment). Colocated `*.test.ts` next to the code under test.
- **Lint**: ESLint 9 via `eslint-config-next`. Path alias `@/*` → `./src/*`.

## Design Principles

- **No backend, ever**: all data comes from client-side RPC calls. Do not introduce server components, API routes, server actions, or any code that requires a running server — it breaks the static export.
- **Local-first & private**: wallets, custom networks, and API keys are persisted to `localStorage` (optionally AES-encrypted on export). Secrets never leave the browser.
- **Network-parameterized**: nothing is hardcoded to a single chain. Services receive endpoint URLs from `NetworkContext`, so the same code serves Mainnet, Fuji, Localhost, and Custom networks.

## Architecture

### State (providers wrap the app in `src/app/layout.tsx`)
- `src/lib/contexts/network-context.tsx` — **NetworkContext**: current network (Mainnet/Fuji/Localhost/Custom), chain endpoints, health checking. Persists to `localStorage`.
- `src/lib/contexts/wallet-context.tsx` — **WalletContext**: wallet list, active wallet, signer creation. Supports `private-key`, `mnemonic`, and `connected` (injected/MetaMask) wallet types. Persists to `localStorage`.

### Service layer (`src/lib/services/`, static-method classes)
- `rpc.service.ts` — **RpcService**: generic JSON-RPC 2.0 client with timeout handling.
- `avalanche.service.ts` — **AvalancheService**: Platform/P-Chain API (validators, staking, L1s/subnets).
- `cchain.service.ts` — **CChainService**: Ethers.js `JsonRpcProvider` wrapper (blocks, txs, balances, tokens, gas, contracts).
- `verification/verification.service.ts` — **VerificationService**: orchestrates contract verification across provider plugins in `verification/providers/` (Etherscan, Snowscan, Routescan, Sourcify, Avalanche Explorer).
- `config-crypto.ts` — encrypted/plain config file import-export (networks, API keys, optionally wallets) via Web Crypto AES.
- **Contract**: services take endpoint URLs as parameters from `NetworkContext` — never hardcode RPC URLs.

### Routing & navigation
- App Router pages live in `src/app/`. Every page is a client component.
- `src/lib/navigation.ts` is a typed array that drives the sidebar. Major sections: Dashboard, Explorer, Validators, C-Chain, L1s, Node, Wallet, Transactions, Settings.

### Components
- `src/components/ui/` — shadcn/ui primitives. **Do not edit by hand**; add via `pnpm shadcn add`.
- `src/components/tools/` — reusable building blocks (DataTable, FormField, OutputDisplay, CopyableId, …).
- `src/components/layout/` — Header, Sidebar, NavItem. `dashboard/`, `contracts/`, `wallet/`, `icons/` hold section-specific UI.

### Models & helpers
- `src/lib/models/` — `network.ts` (Network, ChainEndpoints, DEFAULT_NETWORKS), `wallet.ts` (StoredWallet, `localStorage` keys), `avalanche.ts`.
- `src/lib/utils.ts` — `nAvaxToAvax()`, `truncateId()`, `formatTimestamp()`, `relativeTime()`, address normalizers, `cn()`.

### Build & external APIs
- **Static export**: `pnpm build` emits to `out/`. `images.unoptimized` is required for export.
- **CORS proxying**: verification providers call `/api/proxy/*`. In dev these are rewritten by `next.config.ts`; in production by `vercel.json` at the Vercel edge.

## Public URLs

- `https://avaxtoolkit.com` — hosted app (`metadataBase`).
- `https://github.com/arminreiter/avaxtoolkit` — source repo.

## Conventions

- **Every page and interactive component is a Client Component** — start files with `"use client"`. There are no Server Components, server actions, or API routes (static export).
- **Use shadcn/ui components** from `@/components/ui/`. Add new ones via `pnpm shadcn add` — never hand-edit generated primitives.
- **Icons**: use `lucide-react`. Do not add other icon libraries.
- **Styling**: Tailwind CSS 4 utility classes only. No CSS Modules, styled-components, or inline style objects for theming. Theme tokens live in `src/app/globals.css` (`@theme` + CSS variables).
- **Colors**: Avalanche red `#E84142` (primary), cyan `--neon`, green `--terminal`. Use semantic CSS variables / Tailwind tokens, not hardcoded hex. Sharp edges only — `--radius` is `0`.
- **Fonts**: Exo 2 (`--font-sans`), Rajdhani (`--font-display`), JetBrains Mono (`--font-mono`), loaded via `next/font/google` in `layout.tsx`. Headings use `font-display uppercase tracking-wider`.
- **Dark mode**: via `next-themes` and the `.dark` variant. Dark mode adds CRT scanlines, grid background, and phosphor glow (`glow-red`, `glow-neon`, `glow-green`, `terminal-chrome`, `ascii-sep`, `shimmer`, `cursor-blink`).
- **State**: React Context (`NetworkContext`, `WalletContext`) + hooks, persisted to `localStorage`. Do not add Redux, Zustand, or other state libraries.
- **Forms**: hand-rolled controlled inputs built on `@/components/tools/FormField`. No react-hook-form or zod in this project — don't add them without discussion.
- **Blockchain amounts**: convert nAVAX→AVAX with `nAvaxToAvax()` from `@/lib/utils`. Normalize bare `avax1…` addresses with `normalizePChainAddress()` / `normalizeXChainAddress()`.
- **Path alias**: `@/*` maps to `src/*` (mirrored in `tsconfig.json` and `vitest.config.ts`).
- **Linting**: `pnpm lint`. ESLint enforces `no-console` (warn) — only `console.warn` / `console.error` are allowed.
- **Logging**: there is no logger abstraction (client-only app). Do not use `console.log` in committed code; use `console.warn`/`console.error` sparingly. **Never log private keys, mnemonics, signers, or any wallet secret.**
- **Error handling**: services throw on RPC/HTTP failure (`RpcService` enforces timeouts); UI catches and surfaces errors. Trust TypeScript types inside the app — validate only at the RPC/import boundary (e.g. `isValidWallet`). No defensive try/catch for impossible states.
- **i18n**: English-only. Do not add an i18n framework.
- **Environment variables**: there is no `.env` requirement — the app is client-only. Build-time vars are defined in `next.config.ts` (`NEXT_PUBLIC_APP_VERSION` from `package.json`, `NEXT_PUBLIC_APP_ENV`). User-supplied secrets (e.g. Etherscan API key) are stored in `localStorage`, never in env.
- **Tests**: Vitest, node environment, colocated `*.test.ts`. Run all with `pnpm test` (`vitest run`) or a single file with `pnpm vitest run src/lib/models/network.test.ts`; watch with `pnpm test:watch`.
- **Deployment**: static export hosted on Vercel. `vercel.json` rewrites proxy the external verification APIs at the edge; keep its rewrite list in sync with the dev rewrites in `next.config.ts`.

# Basic Behaviour

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

# Next.js notes

- **Static export (`output: 'export'`)**: no SSR, API routes, route handlers, server actions, or middleware. Anything requiring a server at runtime breaks `pnpm build`. All logic runs in the browser.
- **Client-only routing**: read route params/query with the `useParams` / `useSearchParams` hooks, not the async `params`/`searchParams` props (every page is `"use client"`).
- **Turbopack** is the default dev bundler (`next dev --turbo`).
- **Images** must stay `unoptimized` — the export target has no image optimization server.
- **No request-time env**: env is baked at build time via the `env` block in `next.config.ts`. Update `next.config.ts` (and rebuild) for new build-time vars.
- When unsure about a specific API, verify against the installed version (Next 16, React 19, Ethers 6) rather than assuming. Heed deprecation notices in build output.
