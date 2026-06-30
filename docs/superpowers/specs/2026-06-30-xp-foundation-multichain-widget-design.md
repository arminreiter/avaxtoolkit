# Sub-project 1 — X/P-Chain Foundation + Multi-chain Balance Widget

- **Date:** 2026-06-30
- **Status:** Approved (design) — pending implementation plan
- **Author:** armin + Claude

## Context

The AVAX Toolkit's wallet, send, and transaction tooling currently works only on the
C-Chain (EVM, via ethers.js). We want to extend it to the X-Chain and P-Chain. Because
X/P use a UTXO model and secp256k1 signatures over serialized transaction bytes —
nothing like the EVM/ethers flow — this is a multi-part effort that has been decomposed
into dependency-ordered sub-projects, each shipped and validated independently:

1. **Foundation + multi-chain balance widget** ← *this spec*
2. X/P plain sends (first write — introduces the signing pipeline)
3. Cross-chain transfers / atomic import-export (the native "bridge": C↔P↔X)
4. P-Chain staking (delegate / add validator)

This spec covers **Sub-project 1 only**. It is read-only: it derives and displays X/P
addresses and balances. No transaction building or signing is in scope here.

A key reason this is sequenced first: it introduces the `@avalabs/avalanchejs`
dependency and proves it bundles cleanly in the static export (`output: 'export'`),
de-risking every later sub-project.

## Goals

- Add `@avalabs/avalanchejs` and confirm it works in the statically-exported, client-only build.
- Derive each wallet's paired X-Chain and P-Chain addresses, mirroring the existing
  C-Chain derivation 1:1 (deriving N C-Chain accounts yields N X/P addresses).
- Display the **active wallet's** C / X / P addresses and AVAX balances together in a
  glanceable dashboard widget.

## Non-goals (this sub-project)

- No transaction building, signing, or key export.
- No ERC-20 (C-Chain) or ANT (X-Chain) token listing — AVAX balances only.
- No summing of balances across a derived wallet group — active wallet only.
- No new wallet-model fields / localStorage migration.

## Decisions (resolved during brainstorming)

1. **View placement:** a **dashboard widget** summarizing the active wallet across chains
   (not a dedicated page, not the wallet-manager dialog).
2. **HD scope:** X/P addresses mirror the existing C-Chain derivation — one X/P address
   paired per derived account (per `StoredWallet`), not multi-index discovery.
3. **Derivation path (mnemonic wallets):** **standard Avalanche path** `m/44'/9000'/0'/0/i`,
   paired 1:1 with the C-Chain address at `m/44'/60'/0'/0/i`. This matches Core, Ledger,
   and other Avalanche wallets for the same seed (correct + recoverable). The rejected
   alternative — re-encoding the C-Chain `60'` key as bech32 — was a fund-loss footgun
   because those addresses would not match what the user sees elsewhere.
4. **Per wallet type:**
   - `mnemonic` → derive `m/44'/9000'/0'/0/i` (index `i` parsed from `derivationPath`).
   - `private-key` → encode the single key's pubkey as bech32 (only option; matches how
     Core treats a raw imported key).
   - `connected` (MetaMask/injected) → **no X/P** (no accessible key); widget shows
     C-Chain only and marks X/P as unavailable.
5. **Address derivation strategy:** derive **on demand** from the key + active network's
   HRP. Not persisted, because the bech32 HRP is network-dependent (`avax`/`fuji`/`local`)
   and a stored address would be wrong after a network switch.

## Current-state facts this design relies on

- `StoredWallet` (`src/lib/models/wallet.ts`): `{ id, name, type, address, privateKey?,
  mnemonic?, derivationPath?, connectorType?, createdAt }`. One address per record.
- Each derived address is its **own** `StoredWallet`; mnemonic records carry both the
  `mnemonic` and a pre-derived `privateKey`, plus `derivationPath` = `m/44'/60'/0'/0/i`.
  The wallet list groups them by mnemonic (`groupWallets` in `WalletDialog.tsx`).
- `WalletContext` exposes `activeWallet`, `wallets`, signer helpers (ethers-only today).
- `NetworkContext` provides the active network and `endpoints` (`cChain`, `pChain`,
  `xChain`, `info`, `health`).
- `AvalancheService` already has read methods incl. `getXChainBalances(address)` and
  `getUTXOs(...)`, but **no** P-Chain balance method.
- `src/lib/utils.ts` has `nAvaxToAvax`, `normalizePChainAddress`, `normalizeXChainAddress`,
  `truncateId`. `CopyableId` exists under `src/components/tools/`.

## Architecture

### 1. Address module — `src/lib/avalanche/addresses.ts` (pure, unit-tested)

```ts
// Returns null when the wallet has no accessible X/P key (connected/injected wallets).
function xpAddressesFor(
  wallet: StoredWallet,
  hrp: string,
): { xAddress: string; pAddress: string } | null

// Maps the active network to its bech32 human-readable part.
function hrpForNetwork(network: Network): "avax" | "fuji" | string // "local"/"custom" otherwise
```

Behaviour of `xpAddressesFor`:

- `connected` → `null`.
- `private-key` → take `wallet.privateKey`, compute the compressed secp256k1 public key
  (ethers `SigningKey`), then `pubkey → ripemd160(sha256) → bech32` via avalanchejs.
- `mnemonic` → parse trailing index `i` from `derivationPath`, derive
  `m/44'/9000'/0'/0/i` with ethers `HDNodeWallet.fromPhrase(mnemonic, undefined, path)`,
  then encode its pubkey as above.
- X and P share one bech32 body; the function applies the `X-` / `P-` prefixes.

Implementation note: the exact `@avalabs/avalanchejs` v5 API for pubkey→address and
bech32 formatting (e.g. `secp256k1`, `utils`) must be confirmed against the installed
version during implementation; the contract above is what the module guarantees
regardless of which helper is used.

The module is structured so Sub-project 2 can add a sibling `xpSigningKeyFor(wallet)`
(returning the raw `9000'`/private key for signing) without reworking address logic.

### 2. Balances — extend `AvalancheService`

- Add `getPChainBalance(addresses: string[])` calling `platform.getBalance`, returning at
  least `{ balance, unlocked, locked }` in nAVAX.
- Reuse `getXChainBalances(address)` and filter the AVAX assetID for the X-Chain row.
- Reuse `CChainService.getBalance(address)` for the C-Chain row.

### 3. Widget — `src/components/dashboard/MultiChainBalanceWidget.tsx`

- Reads `activeWallet` (`useWallet`) and the active network + `endpoints` (`useNetwork`).
- Derives X/P addresses via `xpAddressesFor(activeWallet, hrpForNetwork(network))`.
- Renders three rows (C / X / P). Each row: chain label, truncated + copyable address
  (`truncateId` + `CopyableId`), and an AVAX balance (`nAvaxToAvax`). The P-Chain row shows
  a small "staked / locked" sub-line when `locked > 0`.
- Fetches each chain's balance independently with its own loading and **error** state.
- Mounted into the dashboard layout alongside the existing widgets.

### Data flow

```
activeWallet ─┐
              ├─► xpAddressesFor(wallet, hrp) ─► { xAddress, pAddress } (or null)
network/hrp ──┘
                         │
   ┌─────────────────────┼───────────────────────────┐
   ▼                     ▼                             ▼
CChainService     AvalancheService             AvalancheService
.getBalance(0x)   .getXChainBalances(X-addr)   .getPChainBalance([P-addr])
   │                     │ (filter AVAX)              │
   └─────────────────────┴──────────► widget rows (nAvaxToAvax) ◄──┘
```

## Edge cases & error handling

- **No active wallet:** widget prompts the user to select/add a wallet.
- **Connected/injected wallet:** C-Chain row only; X/P rows show "Unavailable — connected
  wallet has no X/P key."
- **Network without X/P** (custom EVM-only RPC, e.g. Anvil/Hardhat): detect failure /
  absence of usable X/P endpoints and show C-Chain only with an explanatory note for X/P.
- **Per-chain fetch failure:** that row shows an explicit error (e.g. "RPC error" with
  retry) — never a silent `0`.
- **HRP correctness:** addresses are recomputed when the active network changes, so the
  prefix (`avax`/`fuji`/`local`) always matches the selected network.

## Testing

- **Golden-vector unit tests** for `xpAddressesFor`:
  - *private-key path:* the well-known local "ewoq" test key, expected bech32 body
    `18jma8ppw3nhx5r4ap8clazz0dps7rv5u9xde7p` (asserting `X-…` and `P-…` with the right
    prefix/HRP).
  - *mnemonic `9000'` path:* a vector pinned from an external reference (Core / avalanchejs
    docs/examples), **not** self-generated by our own avalanchejs call, so the test guards
    correctness rather than restating the implementation.
- **`hrpForNetwork`** mapping tests (mainnet→`avax`, Fuji→`fuji`, local/custom→`local`).
- **Widget render smoke tests:** no-wallet state, connected-wallet state (X/P unavailable),
  and a happy-path render with mocked balances.

## Risks

- **avalanchejs in static export:** browser bundling / `Buffer` polyfill under Next 16 +
  Turbopack with `output: 'export'`. Validating this is an explicit goal of this
  sub-project; surface and resolve it early rather than discovering it in Sub-project 2.
- **Exact avalanchejs v5 API** for pubkey→bech32 must be confirmed against the installed
  version.

## Out of scope / future sub-projects

X/P plain sends, atomic cross-chain import/export ("bridge"), and P-Chain staking are
deferred to Sub-projects 2–4. The address module is designed to grow a signing-key
accessor for those without rework.
