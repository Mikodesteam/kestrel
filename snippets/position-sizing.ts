// Excerpt from Kestrel (server/src/smart/sizing.ts). Shown for illustration only. The full source code is available at https://store.mikodes.com/p/kestrel/
//
// Turns the size on an order ticket into an exact coin amount. Besides a fixed
// amount it supports a percentage of balance with leverage and risk-based
// sizing, where the position is sized so hitting the stop loses a set percent.
import { Decimal } from 'decimal.js';
import { floorToStep } from '../exchanges/precision.js';

export type SizeMode = 'quote' | 'base' | 'balancePct' | 'risk';
export interface SizeInput {
  mode: SizeMode;
  value: string;
}
export interface SizeContext {
  quoteBalance: string;
  price: string;
  stopPrice?: string;
  amountStep: string;
  leverage: number;
  marketType: 'spot' | 'swap';
}

/**
 * Turns the ticket's size into a base amount, floored to the market step.
 * - quote: position notional in the quote asset (not margin)
 * - base: amount of the base asset
 * - balancePct: % of the free quote balance used as margin (× leverage on futures)
 * - risk: % of the free quote balance lost if the stop is hit: balance × risk% / |entry − stop|
 */
export function resolveAmount(size: SizeInput, c: SizeContext): string {
  const v = new Decimal(size.value);
  if (v.lte(0)) throw new Error('Size must be positive');
  const price = new Decimal(c.price);
  const lev = c.marketType === 'swap' ? Math.max(1, c.leverage) : 1;
  let amount: Decimal;
  switch (size.mode) {
    case 'base':
      amount = v;
      break;
    case 'quote':
      amount = v.div(price);
      break;
    case 'balancePct':
      amount = new Decimal(c.quoteBalance).mul(v).div(100).mul(lev).div(price);
      break;
    case 'risk': {
      if (!c.stopPrice) throw new Error('Risk-based size needs a stop-loss price');
      const dist = price.minus(c.stopPrice).abs();
      if (dist.isZero()) throw new Error('Stop-loss cannot equal the entry price');
      amount = new Decimal(c.quoteBalance).mul(v).div(100).div(dist);
      break;
    }
  }
  return new Decimal(floorToStep(amount, c.amountStep)).toString();
}
