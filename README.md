# @concordium/wdk-wallet-concordium

A [Tether Wallet Development Kit (WDK)](https://github.com/tetherto/wdk) module for Concordium.
Derive account keys, read balances, sign messages, transfer CCD and tokens, and discover existing accounts from a seed through the WDK interface.

> **Beta:** This package is currently in beta.
> Test thoroughly in development environments before using it in production.

## Features

- Seed-based account key derivation using `ConcordiumHdWallet`.
- Native CCD balances, transfers, and fee quotes.
- Protocol-level token (PLT) and CIS-2 token balances, transfers, and fee quotes.
- Sponsored PLT transactions with separate sender and sponsor signing.
- Message signing and verification.
- Account discovery through the Concordium wallet-proxy.
- TypeScript declarations.

## Requirements

- **Node.js 18+**, using ES modules. Bare/mobile is not supported.
- Access to a Concordium gRPC node endpoint.
  Account discovery also requires a Concordium wallet-proxy endpoint.
- An existing on-chain account for balance reads and transfers.
  Deriving keys does not create an account; see [Account creation](#account-creation).
- Sufficient CCD to pay transaction fees, or a funded sponsor for sponsored transfers.

## Installation

```bash
npm install @concordium/wdk-wallet-concordium@beta
```

For use through WDK, also install the host package:

```bash
npm install @tetherto/wdk
```

## Quick start

The snippets use a public demonstration mnemonic. **Never use it to secure funds.**
In real applications, load your own seed securely; never commit or log it.
The demonstration seed does not guarantee an existing on-chain account.

### With WDK

```js
import WDK from '@tetherto/wdk'
import WalletManagerConcordium, { CONCORDIUM_TESTNET_CONFIG } from '@concordium/wdk-wallet-concordium'

// Public demonstration seed only. Never use for real funds.
const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const wdk = new WDK(seed)
  .registerWallet('concordium', WalletManagerConcordium, {
    ...CONCORDIUM_TESTNET_CONFIG,
  })

const account = await wdk.getAccountByPath('concordium', '0/0/0')
console.log(await account.getAddress())
console.log(await account.getBalance(), 'microCCD')
```

### Standalone

```js
import WalletManagerConcordium, { CONCORDIUM_TESTNET_CONFIG } from '@concordium/wdk-wallet-concordium'

// Public demonstration seed only. Never use for real funds.
const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

const manager = new WalletManagerConcordium(seed, {
  ...CONCORDIUM_TESTNET_CONFIG,
})

try {
  const account = await manager.getAccountByPath('0/0/0')
  console.log(await account.getAddress())
  console.log(await account.getBalance(), 'microCCD')
} finally {
  manager.dispose()
}
```

The constructor accepts a BIP-39 mnemonic or raw seed bytes (`Uint8Array`).
The seed, key-derivation mode, identity-provider index, identity index, and credential counter must match the account you intend to access.
Address derivation fetches the network's cryptographic parameters from the node.

## Configuration

| Field | Required | Description |
| --- | --- | --- |
| `useMainnetKeyDerivation` | Yes | Boolean: `true` selects the SDK's Mainnet keys; `false` selects Testnet-compatible keys, including for other chains using that derivation scheme. |
| `grpcUrl` | Yes | Absolute HTTP(S) URL for the gRPC node. HTTPS enables TLS; HTTP disables it. Ports default to 443/80 when omitted. |
| `walletProxy` | No | Absolute HTTP(S) wallet-proxy URL, optionally with a base path. Required for discovery, recovery, and dev/testnet onboarding only. |

`useMainnetKeyDerivation` controls keys only: it does not choose endpoints or
verify the chain served by them. The same seed and coordinates produce different
keys under the two derivation modes. There are no implicit endpoint defaults.

`grpcUrl` selects a native gRPC connection, not a REST API. It cannot contain
credentials, query parameters, fragments, or a path other than `/`. Configuration
is validated locally without connecting to the node. Missing `walletProxy` is
reported when discovery, recovery, or onboarding is requested; other operations
remain available. The old `network` and `endpoint` fields are rejected.

### Public presets and custom endpoints

`CONCORDIUM_MAINNET_CONFIG` and `CONCORDIUM_TESTNET_CONFIG` are exported constants
containing the derivation flag and public service URLs:

| Preset | `useMainnetKeyDerivation` | `grpcUrl` | `walletProxy` |
| --- | --- | --- | --- |
| `CONCORDIUM_MAINNET_CONFIG` | `true` | `https://grpc.mainnet.concordium.software:20000` | `https://wallet-proxy.mainnet.concordium.software` |
| `CONCORDIUM_TESTNET_CONFIG` | `false` | `https://grpc.testnet.concordium.com:20000` | `https://wallet-proxy.testnet.concordium.com` |

Spread a preset to customize it rather than modifying the shared export:

```js
import { CONCORDIUM_TESTNET_CONFIG } from '@concordium/wdk-wallet-concordium'

const config = {
  ...CONCORDIUM_TESTNET_CONFIG,
  grpcUrl: 'http://localhost:20000',
  walletProxy: 'https://custom-proxy.example/base',
}
```

For a node-only configuration, provide `useMainnetKeyDerivation` and `grpcUrl`
directly, without a preset or proxy. For production deployments, choose service
endpoints appropriate to your availability and privacy requirements.

### Account paths

Concordium key derivation uses three coordinates: `providerIndex / identityIndex / credentialNumber`.

- `providerIndex`: The network-specific index of the identify provider.
- `identityIndex`: The personal identify issuance index.
- `credentialNumber`: The credential identifier for the issued identity.

Use `manager.getAccountByPath('0/0/3')` or `wdk.getAccountByPath('concordium', '0/0/3')` to select all three coordinates.
Replace the example path with the coordinates associated with your account.

Paths must contain three non-negative safe integers, without leading zeros.

## Usage

The following snippets assume an initialized `manager` and `account` as above.
Transaction-submission calls spend funds; use a funded testnet account when trying them.

### Transfer CCD

Amounts and fees are in **microCCD**: `1 CCD = 1_000_000 microCCD`. Prefer `bigint`
for amounts to avoid JavaScript number precision loss.

```js
const request = { to: recipientAddress, value: 1_000_000n }
const { fee: estimatedFee } = await account.quoteSendTransaction(request)

// Signs, submits, and waits for finalization.
const { hash, fee } = await account.sendTransaction(request)
```

Use `signTransaction(request)` to sign without broadcasting. Its result can be
passed to `sendTransaction(signedTransaction)` later. Quotes do not submit transactions.

### Work with tokens

Token identifiers distinguish PLTs from CIS-2 smart-contract tokens:

| Format | Meaning |
| --- | --- |
| `'TOKEN'` or `'plt:TOKEN'` | PLT symbol on the selected network. |
| `'cis2:<index>:<subindex>:<tokenIdHex>'` | CIS-2 contract address and hexadecimal token ID. |
| `'cis2:1234:0:'` | CIS-2 token with an empty token ID. |

Amounts are integers in the token's base units, not display units. Replace the
identifiers below with tokens available on your network.

```js
const token = 'plt:TOKEN'
const balance = await account.getTokenBalance(token)
const transfer = { token, recipient: recipientAddress, amount: 1n }
const quote = await account.quoteTransfer(transfer)
const result = await account.transfer(transfer) // Submits a transaction.

const { url, metadata } = await account.getCis2Metadata('cis2:1234:0:01')
if (metadata) console.log(metadata.name, metadata.symbol, metadata.decimals)
```

`getCis2Metadata` returns `metadata: null` if the off-chain metadata document
cannot be retrieved. `manager.listTokens()` lists PLT identifiers from the node.

### Sign and verify messages

```js
const message = 'Hello, Concordium'
const signature = await account.sign(message)
const valid = await account.verify(message, signature)
```

Verification reads the account's public keys from the node. Signatures are
JSON-encoded strings.

### Discover existing accounts

A derived public key does not by itself identify every on-chain account it
controls. A Concordium wallet-proxy must be provided for this mapping.

```js
const matches = await manager.findAccountByPublicKey(account.keyPair.publicKey)
// [{ address, credentialIndex, keyIndex, isSimpleAccount, publicKey }]

const recovered = await manager.recoverAccounts({
  providerIndex: 0,
  identityIndex: 0,
  startIndex: 0,
  gapLimit: 3,
  maxIndex: 50,
})
// [{ index, path, address, publicKey }]
```

Recovery requires explicit `providerIndex` and `identityIndex` options, both
non-negative safe integers. It scans credential counters under that identity,
stopping after `gapLimit` consecutive counters with no matching accounts or at
`maxIndex`. It does not scan all identities or create accounts. The result's
`index` is the scanned credential counter; account instances expose only `path`.

### Sponsored PLT transfers

A sponsor pays the CCD fee while the sender transfers PLTs. Both parties sign
the same transaction; either party can sign first. This API does not provide a
sponsor service or choose a sponsor for you.

```js
// sender and sponsor are WalletAccountConcordium instances.
const unsigned = await sender.buildSponsorableTransfer({
  token: 'plt:TOKEN',
  recipient: recipientAddress,
  amount: 1n,
  sponsorAddress: await sponsor.getAddress(),
})

// Sender signs first, then sponsor completes the transaction.
const senderSigned = await sender.signAsAccountToBeSponsored(unsigned)
const complete = await sponsor.signAsSponsorSigned(senderSigned)
const { hash, fee } = await sender.submitSponsored(complete)
```

For sponsor-first signing, use `sponsor.signAsSponsorToBeSigned(unsigned)` followed
by `sender.signAsAccountPreSponsored(sponsorSigned)`. Treat the returned transaction
JSON as opaque. Sponsored transfers support PLTs, not CIS-2 tokens.

## Account creation

Concordium accounts require an identity and an on-chain credential deployment.
This module does not provide a production identity-onboarding UI. Integrate
production onboarding at the host-application layer, then use the account's
public key and discovery APIs to locate the resulting account.

**`ConcordiumOnboarding` is a dev/testnet-only utility, not a production onboarding
solution.** It drives a headless identity-provider flow with an interactive
browser step:

```js
const onboarding = manager.getOnboarding()
const providerIndex = 0
const identityIndex = 0 // Choose the identity coordinates for this request.
const { issuanceUrl } = await onboarding.createIdentityRequest({ providerIndex, identityIndex })
// Open issuanceUrl in a browser and obtain callbackUrl from the redirect.
const identityObject = await onboarding.retrieveIdentity(callbackUrl)
const { address } = await onboarding.createAccount({ identityObject, providerIndex, identityIndex })
```

Both calls require explicit non-negative safe integer provider and identity
indices. `createAccount` defaults its credential counter (`credNumber`) to `0`
and deploys a credential on-chain. See
[`examples/example-onboard.mjs`](examples/example-onboard.mjs) for the full workflow.

## API and limitations

See [`types/index.d.ts`](types/index.d.ts) for request, result, and option types.

| API | Notes |
| --- | --- |
| `account.getBalanceForAddress(address)` | Reads any account's CCD balance without deriving its keys. |
| `account.getTransactionReceipt(hash)` | Returns the native node status, or `null` when unavailable. |
| `account.keyPair` | Exposes public and private key bytes; treat the private key as secret. |
| `manager.dispose()` | Disposes tracked accounts and clears the manager's seed. |
| `getAccount()` | Unsupported; use `getAccountByPath()` with all three identity coordinates. |
| `getFeeRates()` | Unsupported; use the transaction-specific quote methods. |
| Named signers | Unsupported; use seed-based accounts. |
| `getTransaction()` / `waitForTransaction()` | Unsupported; use `getTransactionReceipt()`. |
| `toReadOnlyAccount()` | Returns the same account instance, **not** a signing-isolated view. |

`getBalance()` throws `AccountNotCreatedError` when the derived account is not
on-chain, rather than returning zero. Submission methods throw
`TransactionRejectedError` when a transaction finalizes with a rejected outcome;
its `hash` and `rejectReason` identify the failure. A rejected transaction can
still incur a fee.

## Security

- Keep seeds and private keys out of source control, logs, errors, and telemetry.
- Never send real funds to the public test mnemonic used in repository fixtures.
- Do not expose `keyPair` or a `toReadOnlyAccount()` result to untrusted code.
- Call `dispose()` when finished. Disposal releases key references; it is not a
  guarantee that every JavaScript or WebAssembly memory copy has been erased.
- Review recipients, token identifiers, amounts, and the selected network before signing.
- Use the onboarding helper only in development/testnet environments.

## Examples

Examples are in [`examples/`](examples/). From a repository checkout:

```bash
npm ci
npm run example            # Address and CCD balance
npm run example:verify     # Message signing and verification
npm run example:send       # CCD transfer
npm run example:token      # Token balances, quotes, and transfers
npm run example:sponsored  # Sponsored transfers
npm run onboard:request    # Dev/testnet identity request
npm run onboard:create     # Dev/testnet credential deployment
```

Inspect each script's configuration before running it. Transfer and credential
deployment examples submit transactions; they are not read-only demonstrations.
Examples are not included in the npm package.

## Development and testing

```bash
npm ci
npm test
npx tsc --noEmit types/index.d.ts
```

Unit tests use local derivation and mocked services. CI runs them on pull
requests and pushes to `main`, including a run without external networking.

Live integration tests require environment-supplied testnet credentials:

| Variable | Purpose |
| --- | --- |
| `TESTNET_SEED` | Required mnemonic for the test account. |
| `TESTNET_ADDRESS` | Required address corresponding to credential counter `0`. |
| `TESTNET_PROVIDER_INDEX` | Provider index; defaults to fixture value `0`. |
| `TESTNET_IDENTITY_INDEX` | Identity index; defaults to fixture value `899424164`. |
| `PLT_TOKEN` | Held PLT identifier; defaults to `TN`. |
| `CIS2_TOKEN` | Held CIS-2 identifier; defaults to `cis2:12754:0:01`. |
| `WALLET_PROXY` | Optional testnet wallet-proxy override. |

Configure these securely in your shell, then run:

```bash
npm run test:integration           # Reads, quotes, and signing; no submission
WRITE=1 npm run test:integration   # Also submits transactions and spends testnet funds
```

Write tests cover transfers, sponsored submission, and rejection handling, with
fee comparisons for PLT and CIS-2 transfers. They require a funded account holding
the configured tokens. Live integration tests are not run in CI.

## Support

Report bugs and request help through
[GitHub issues](https://github.com/Concordium/tether-wdk-concordium/issues).

## License

[Apache-2.0](LICENSE).
