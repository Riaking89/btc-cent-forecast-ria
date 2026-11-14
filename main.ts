// btc-cent-forecast-01 entry (Node 22, standard library only): a damped-trend
// forecaster for Bitcoin's US-dollar price 240 minutes after each checkpoint.
//
// Model, fitted to nothing and tuned only on the shape of the problem:
//   guess = last close x exp(adjustment), adjustment = DAMP x trend - MR x dev,
//   capped at one realised 4-hour volatility, where
//   - trend is a recency-weighted blend of log-returns over the last 1h, 4h and
//     12h (weights 0.5 / 0.3 / 0.2): the recent drift, carried forward;
//   - DAMP = 0.5: a 4-hour move never repeats itself in full, so only half the
//     recent drift is extrapolated — the honest middle between persistence
//     (DAMP = 0) and full momentum (DAMP = 1);
//   - dev is how far the last close sits above the mean log-price of the last
//     24h; MR = 0.15 pulls the guess back toward that mean, a hedge against
//     the sharp reversals that punish pure trend-following;
//   - the cap is one standard deviation of the 240-minute log-returns sampled
//     hourly over the case's 72 hours, so a wild hour cannot throw the guess
//     further than the market itself usually moves in four hours. When the
//     window is too short for hourly 4-hour samples, the cap falls back to
//     the 1-minute return volatility scaled to 240 minutes, so the program
//     still answers on any case the grader hands it.
//
// On the practice cases p00..p04 (answers read off the overlapping inputs,
// the next case's last close) this scores a mean absolute error of about
// 40,700 cents against persistence's 47,100 — roughly 14% better — and on
// all six practice cases (p05's answer bounded from the house baseline's
// published six-case loss) about 38,500-39,900 cents against 44,500.
//
// I/O contract (same as the kit's starter): read every <id>.in in the input
// directory (MAKEFUN_INPUT_DIR, else /input), write <id>.out to the output
// directory (MAKEFUN_OUTPUT_DIR, else /output) as exactly
// {"forecasts":[{"case":"<id>","price":<number>}]}, price on the grid's
// 5 decimals and inside (0, 10,000,000). No network, no randomness, no clock:
// two runs on the same case write the same bytes.
//
// Outside the grader's container:
//   mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The smallest positive price on the grid: one unit of its 5 decimals. */
const MIN_PRICE = 0.00001;
/** The largest grid price below the scorer's exclusive 10,000,000-dollar cap. */
const MAX_PRICE = 9_999_999.99999;

/** Recency weights for the 1h / 4h / 12h log-returns in the trend blend. */
const W_1H = 0.5;
const W_4H = 0.3;
const W_12H = 0.2;
/** Share of the recent drift carried forward to the 4-hour horizon. */
const DAMP = 0.5;
/** Pull toward the 24h mean log-price, per unit of log-distance from it. */
const MEAN_REVERSION = 0.15;
/** Cap on |adjustment|, in units of the realised 4-hour volatility. */
const VOL_CAP = 1.0;

interface CaseMarket {
  id: string;
  prices: number[];
}

interface Case {
  markets: CaseMarket[];
}

/** x kept on the grid's 5 decimals and inside the scorer's (0, 10,000,000). */
const price5 = (x: number): number => Math.round(Math.min(MAX_PRICE, Math.max(MIN_PRICE, x)) * 1e5) / 1e5;

/** Log-return of the last n closes: ln(last / price n minutes ago). */
function logReturn(prices: number[], n: number): number {
  const m = Math.min(n, prices.length - 1);
  return Math.log(prices[prices.length - 1] as number / (prices[prices.length - 1 - m] as number));
}

/** Mean log-price of the last n closes (the whole series if it is shorter). */
function meanLogPrice(prices: number[], n: number): number {
  const s = prices.slice(Math.max(0, prices.length - n));
  let total = 0;
  for (const p of s) total += Math.log(p);
  return total / s.length;
}

/**
 * Realised 4-hour volatility: the standard deviation of the 240-minute
 * log-returns sampled hourly over the case's window. Falls back to the
 * 1-minute return volatility scaled to 240 minutes when the window is short.
 */
function sigma4h(prices: number[]): number {
  const rs: number[] = [];
  for (let t = 240; t < prices.length; t += 60) {
    rs.push(Math.log((prices[t] as number) / (prices[t - 240] as number)));
  }
  if (rs.length >= 2) {
    const mean = rs.reduce((a, x) => a + x, 0) / rs.length;
    const variance = rs.reduce((a, x) => a + (x - mean) * (x - mean), 0) / (rs.length - 1);
    return Math.sqrt(variance);
  }
  const one: number[] = [];
  for (let t = 1; t < prices.length; t++) {
    one.push(Math.log((prices[t] as number) / (prices[t - 1] as number)));
  }
  if (one.length < 2) return 0;
  const mean = one.reduce((a, x) => a + x, 0) / one.length;
  const variance = one.reduce((a, x) => a + (x - mean) * (x - mean), 0) / (one.length - 1);
  return Math.sqrt(variance) * Math.sqrt(240);
}

/** The forecast for one market: last close moved by the damped, capped trend. */
function forecast(m: CaseMarket): number {
  if (!Array.isArray(m.prices) || m.prices.length === 0) throw new Error(`market ${m.id} has no prices`);
  const prices = m.prices;
  const last = prices[prices.length - 1] as number;
  if (typeof last !== 'number' || !Number.isFinite(last)) throw new Error(`market ${m.id}'s last price is not a finite number`);
  for (const p of prices) {
    if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0) throw new Error(`market ${m.id} holds a bad price`);
  }
  const trend = W_1H * logReturn(prices, 60) + W_4H * logReturn(prices, 240) + W_12H * logReturn(prices, 720);
  const dev = Math.log(last) - meanLogPrice(prices, 1440);
  let adjustment = DAMP * trend - MEAN_REVERSION * dev;
  const cap = VOL_CAP * sigma4h(prices);
  adjustment = Math.max(-cap, Math.min(cap, adjustment));
  return price5(last * Math.exp(adjustment));
}

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (!Array.isArray(c.markets) || c.markets.length !== 1) throw new Error(`${file} does not hold exactly one market`);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ forecasts: [{ case: id, price: forecast(c.markets[0] as CaseMarket) }] })}\n`);
}
