import { env } from "../../../../utils/misc.js";

export interface RateLimit {
  remaining: number;
  resetAt: Date;
  limit: number;
}

const TOKENS: Readonly<string[]> = [env("GH_TOKEN")];
const LIMITS = new Map<string, RateLimit | null>(TOKENS.map(t => [t, null]));

const tokensIterator = (function* TokenCycler(tokens: readonly string[]) {
  let idx = 0;
  while (true) {
    yield tokens[idx % tokens.length];
    idx++;
  }
})(TOKENS);

export function getToken() {
  return tokensIterator.next().value;
}

export function updateRateLimit(token: string, rateLimit: RateLimit) {
  LIMITS.set(token, rateLimit);
}

export function getLimits() {
  const secureToken = (token: string) => token.replace(/.{30}$/, "*".repeat(2));
  const result: Record<string, RateLimit | null> = {};
  for (const [token, limits] of LIMITS) {
    result[secureToken(token)] = limits;
  }
  return result;
}
