# Changelog

User-facing changes to `@concordium/wdk-wallet-concordium` are recorded here.

## [Unreleased]

### Added

- Package changelog, included in the npm distribution.

## [0.1.0] - 2026-10-16

### Added

- Initial Concordium wallet module for Tether WDK, with TypeScript declarations and Node.js 18+ support.
- Explicit account paths (`provider/identity/credentialCounter`) with on-chain credential verification before returning an account.
- Mainnet and testnet connection presets, custom gRPC URLs, and an explicit key-derivation mode.
- CCD, PLT, and CIS-2 balances, transfers, and transaction-specific fee quotes.
- Message signing and verification, native transaction receipts, and CIS-2 metadata lookup.
- Sponsored PLT transfers with sender-first or sponsor-first signing.
- Account recovery for a single identity using node credential-ID lookup.
