/**
 * WalletManagerConcordium
 * -------------------------------------------------------------------
 * The "factory" half of the module. Now built on Tether's base class:
 * it EXTENDS `WalletManager` from `@tetherto/wdk-wallet`, so it inherits
 * seed handling, signer management and account bookkeeping, and provides
 * the Concordium-specific implementations of the abstract methods
 * (getAccount, getAccountByPath, getFeeRates).
 *
 * Accounts are selected only by explicit "provider/identity/credentialCounter"
 * paths. Manager configuration does not select an identity.
 */

import WalletManager, { NotImplementedError } from '@tetherto/wdk-wallet';
import * as sdk from '@concordium/web-sdk';
import { ConcordiumGRPCNodeClient, credentials } from '@concordium/web-sdk/nodejs';
import WalletAccountConcordium from './WalletAccountConcordium.js';
import { parseConfig } from './config.js';

import { validateIdentityCoordinates } from './identity-coordinates.js';

export default class WalletManagerConcordium extends WalletManager {
  /**
   * @param {string | Uint8Array} seed  BIP-39 mnemonic or raw seed bytes.
   * @param {object} config WDK WalletConfig plus required useMainnetKeyDerivation
   *   and grpcUrl, and optional walletProxy.
   * @throws {Error} If configuration is missing or invalid.
   */
  constructor(seed, config) {
    const parsed = parseConfig(config);
    super(seed, config);                       // base stores the seed + config
    this._ccd = parsed;
    this._client = null;   // shared gRPC client (lazy)
    this._global = null;   // cached cryptographic parameters
  }

  /** The 64-byte BIP-39 seed (inherited from the base) as hex, for ConcordiumHdWallet. */
  get _seedHex() {
    return Buffer.from(this.seed).toString('hex');
  }

  async _getClient() {
    if (!this._client) {
      const { host, port, secure } = this._ccd.grpcEndpoint;
      this._client = new ConcordiumGRPCNodeClient(
        host, port, secure ? credentials.createSsl() : credentials.createInsecure()
      );
    }
    return this._client;
  }

  _requireWalletProxy() {
    if (!this._ccd.walletProxy) {
      throw new Error('config.walletProxy is required for account discovery and recovery.');
    }
    return this._ccd.walletProxy;
  }

  async _getGlobal() {
    if (!this._global) this._global = await (await this._getClient()).getCryptographicParameters();
    return this._global;
  }

  /** HTTP fetch used for wallet-proxy calls. Overridable so tests can inject a fake. */
  async _fetch(url, options) {
    return fetch(url, options);
  }

  /** Unsupported: all identity coordinates must be supplied through a path. */
  async getAccount(_index, _options) {
    throw new NotImplementedError('getAccount is not supported. Use getAccountByPath("provider/identity/credentialCounter").');
  }

  /**
   * Get an account by explicit Concordium path "provider/identity/cred".
   * (Concordium's key space is a 3-tuple, so we use this form rather than a
   * BIP-44 string.)
   */
  async getAccountByPath(path, _options = {}) {
    const value = String(path);
    // Require a canonical "provider/identity/cred" of non-negative integers with
    // no leading zeros and nothing extra — parseInt would accept sloppy input
    // like "1x" or " 1 ", which we reject here.
    if (!/^(0|[1-9]\d*)\/(0|[1-9]\d*)\/(0|[1-9]\d*)$/.test(value)) {
      throw new Error(`Invalid Concordium path "${path}". Use "provider/identity/cred", e.g. "0/0/3".`);
    }
    const [p, id, cred] = value.split('/').map(Number);
    if (![p, id, cred].every(Number.isSafeInteger)) {
      throw new Error(`Concordium path "${path}" exceeds the supported integer range.`);
    }
    return this._makeAccount(p, id, cred);
  }

  /**
   * Concordium fees are energy-based (not a simple gas rate), so a meaningful
   * implementation belongs with the send flow in Phase 2.
   */
  async getFeeRates() {
    throw new NotImplementedError('getFeeRates: Phase 2 (Concordium uses energy-based fees).');
  }

  /**
   * List the Protocol-Level Token ids available on this network (convenience,
   * beyond the standard WDK interface).
   * @returns {Promise<string[]>}
   */
  async listTokens(limit = 50) {
    const client = await this._getClient();
    const ids = [];
    for await (const t of client.getTokenList()) {
      ids.push(t?.id?.toString?.() ?? t?.tokenId?.toString?.() ?? String(t));
      if (ids.length >= limit) break;
    }
    return ids;
  }

  // ================= Phase 6: seed-based account recovery =================
  //
  // On Concordium a derived key does NOT reveal its on-chain account (one
  // identity can back many accounts, and the key->account mapping lives on the
  // chain, not in the key). To recover a wallet from just the seed we derive
  // each account's public key locally and ask Concordium's wallet-proxy which
  // account(s) that key controls, via the documented endpoint:
  //   GET /v0/keyAccounts/{publicKeyHex}[?onlySimple=y]
  // See: https://github.com/Concordium/concordium-wallet-proxy (README).

  /**
   * Look up the on-chain accounts controlled by a signing-key public key.
   * This is the primitive behind recovery ("find the account BY the public key").
   *
   * @param {string | Uint8Array} publicKey  Ed25519 verify key (32-byte hex or bytes).
   * @param {object} [opts]
   * @param {boolean} [opts.onlySimple=false]  Only simple (single-credential, single-key) accounts.
   * @returns {Promise<Array<{
   *   address: string, credentialIndex: number, keyIndex: number,
   *   isSimpleAccount: boolean, publicKey: { schemeId: string, verifyKey: string }
   * }>>}  Empty array when the key controls no account.
   */
  async findAccountByPublicKey(publicKey, { onlySimple = false } = {}) {
    const hex = (typeof publicKey === 'string'
      ? publicKey.trim().replace(/^0x/i, '')
      : Buffer.from(publicKey).toString('hex')).toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hex)) {
      throw new Error(
        `findAccountByPublicKey: expected a 32-byte hex Ed25519 public key, got "${hex}".`
      );
    }
    const url = `${this._requireWalletProxy()}/v0/keyAccounts/${hex}${onlySimple ? '?onlySimple=y' : ''}`;
    const res = await this._fetch(url);
    if (res.status === 404) return [];                 // no accounts for this key
    if (!res.ok) {
      throw new Error(`wallet-proxy keyAccounts returned HTTP ${res.status} for ${hex}`);
    }
    const body = await res.json();
    const rows = Array.isArray(body) ? body : (body?.accounts ?? []);
    return rows.map((r) => ({
      address: r.address,
      credentialIndex: r.credential_index,
      keyIndex: r.key_index,
      isSimpleAccount: r.is_simple_account,
      publicKey: r.public_key,
    }));
  }

  /**
   * Recover accounts from the seed: scan credential counters under a fixed
   * (provider, identity), derive each public key, and ask the wallet-proxy which
   * accounts it controls. Stops after `gapLimit` consecutive empty indexes.
   *
   * @param {object} opts
   * @param {number} opts.providerIndex Required identity-provider index.
   * @param {number} opts.identityIndex Required identity index.
   * @param {number}  [opts.startIndex=0]   First credential counter to try.
   * @param {number}  [opts.gapLimit=3]     Stop after this many consecutive empty indexes.
   * @param {number}  [opts.maxIndex=50]    Hard cap on how far to scan.
   * @param {boolean} [opts.onlySimple=false]
   * @returns {Promise<Array<{ index: number, path: string, address: string, publicKey: string }>>}
   */
  async recoverAccounts({
    providerIndex,
    identityIndex,
    startIndex = 0,
    gapLimit = 3,
    maxIndex = 50,
    onlySimple = false,
  } = {}) {
    validateIdentityCoordinates(providerIndex, identityIndex);
    this._requireWalletProxy();
    const wallet = sdk.ConcordiumHdWallet.fromHex(this._seedHex, this._ccd.derivationNetwork);
    const found = [];
    let gap = 0;
    for (let i = startIndex; i <= maxIndex && gap < gapLimit; i++) {
      const pub = Buffer.from(
        wallet.getAccountPublicKey(providerIndex, identityIndex, i)
      ).toString('hex');
      const accounts = await this.findAccountByPublicKey(pub, { onlySimple });
      if (accounts.length === 0) { gap++; continue; }
      gap = 0;
      for (const a of accounts) {
        found.push({
          index: i,
          path: `${providerIndex}/${identityIndex}/${i}`,
          address: a.address,
          publicKey: pub,
        });
      }
    }
    return found;
  }

  dispose() {
    super.dispose();     // disposes tracked accounts + clears the seed
    this._client = null;
    this._global = null;
  }

  async _makeAccount(providerIndex, identityIndex, credNumber) {
    const wallet = sdk.ConcordiumHdWallet.fromHex(this._seedHex, this._ccd.derivationNetwork);
    const account = new WalletAccountConcordium({
      wallet,
      getClient: () => this._getClient(),
      getGlobal: () => this._getGlobal(),
      network: this._ccd.derivationNetwork,
      providerIndex,
      identityIndex,
      credNumber,
    });
    // Track it so the inherited dispose() cleans it up.
    this._accounts[account.path] = account;
    return account;
  }
}
