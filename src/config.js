/** Public connectivity presets. The derivation flag does not verify the connected chain. */
export const CONCORDIUM_MAINNET_CONFIG = {
  useMainnetKeyDerivation: true,
  grpcUrl: 'https://grpc.mainnet.concordium.software:20000',
  walletProxy: 'https://wallet-proxy.mainnet.concordium.software',
};

export const CONCORDIUM_TESTNET_CONFIG = {
  useMainnetKeyDerivation: false,
  grpcUrl: 'https://grpc.testnet.concordium.com:20000',
  walletProxy: 'https://wallet-proxy.testnet.concordium.com',
};

function parseHttpUrl(value, field) {
  try {
    if (typeof value !== 'string' || !value.trim()) throw new Error();
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error();
    return url;
  } catch {
    // Do not echo configuration URLs: they may contain credentials.
    throw new Error(`config.${field} must be an absolute HTTP(S) URL.`);
  }
}

/** Validate before seed initialization, without contacting any services. */
export function parseConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('A configuration with useMainnetKeyDerivation and grpcUrl is required.');
  }
  if ('network' in config || 'endpoint' in config) {
    throw new Error('config.network and config.endpoint are no longer supported. Use useMainnetKeyDerivation and grpcUrl.');
  }
  if (typeof config.useMainnetKeyDerivation !== 'boolean') {
    throw new Error('config.useMainnetKeyDerivation is required and must be a boolean.');
  }
  const grpc = parseHttpUrl(config.grpcUrl, 'grpcUrl');
  if (grpc.username || grpc.password || grpc.href.includes('?') || grpc.href.includes('#') || grpc.pathname !== '/') {
    throw new Error('config.grpcUrl must not contain credentials, query parameters, fragments, or a non-root path.');
  }
  const secure = grpc.protocol === 'https:';
  const port = Number(grpc.port || (secure ? 443 : 80));
  if (port < 1 || port > 65535) {
    throw new Error('config.grpcUrl port must be between 1 and 65535.');
  }
  const walletProxy = config.walletProxy === undefined
    ? undefined
    : parseHttpUrl(config.walletProxy, 'walletProxy').toString().replace(/\/+$/, '');
  return {
    ...config,
    walletProxy,
    // The SDK uses network-specific derivation even for custom chains.
    derivationNetwork: config.useMainnetKeyDerivation ? 'Mainnet' : 'Testnet',
    grpcEndpoint: { host: grpc.hostname, port, secure },
  };
}
