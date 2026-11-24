// Excerpt from Kestrel (server/src/exchanges/permissions.ts). Shown for illustration only.
// The full source code is available at https://store.mikodes.com/p/kestrel/
//
// Reads what an exchange API key is allowed to do. Withdraw rights (and, on Binance, internal
// transfer) mark a key as unsafe, and anything unexpected in the exchange reply fails closed:
// a key whose permissions cannot be verified is refused instead of trusted.

/** Raised when a key's permissions cannot be read with certainty. Fail-closed: such a key is refused. */
export class PermissionUnverified extends ExchangeError {
  constructor(detail: string) {
    super(`Could not verify this key's permissions (${detail}). Create a trade-only key and try again.`, 'other');
  }
}

const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

// Bitget authorities from the v2 API documentation and SDKs. Any other value fails closed: the key is refused.
const BITGET_KNOWN = new Set([/* … every authority listed in the v2 docs … */]);
const BITGET_WITHDRAW = new Set(['withdraw', 'wdr', 'wdw']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw exchange JSON; every field is type-checked below and anything unexpected fails closed
export function parsePermissions(exchange: ExchangeId, payload: any): Permissions {
  switch (exchange) {
    case 'binance': {
      if (typeof payload?.enableReading !== 'boolean')
        throw new PermissionUnverified('binance apiRestrictions missing');
      return {
        read: !!payload.enableReading,
        spot: !!payload.enableSpotAndMarginTrading,
        futures: !!payload.enableFutures,
        // Internal transfer can move funds to another Binance account → treated like a withdrawal.
        withdraw: !!payload.enableWithdrawals || !!payload.enableInternalTransfer,
      };
    }
    case 'okx': {
      const perm = payload?.data?.[0]?.perm;
      if (typeof perm !== 'string') throw new PermissionUnverified('okx account config missing');
      const set = new Set(perm.split(',').map((s: string) => s.trim()));
      const trade = set.has('trade');
      return { read: set.has('read_only') || trade, spot: trade, futures: trade, withdraw: set.has('withdraw') };
    }
    // … bybit …
    case 'bitget': {
      const auth = asArr(payload?.data?.authorities).map((s) => s.toLowerCase());
      if (!auth.length) throw new PermissionUnverified('bitget authorities missing');
      const unknown = auth.filter((a) => !BITGET_KNOWN.has(a));
      if (unknown.length) throw new PermissionUnverified(`bitget authority ${unknown.join(',')}`);
      const withdraw = auth.some((a) => BITGET_WITHDRAW.has(a));
      const trade = auth.some((a) => a === 'trade' || a.endsWith('_trade') || a.endsWith('w'));
      return { read: true, spot: trade, futures: trade, withdraw };
    }
  }
}
