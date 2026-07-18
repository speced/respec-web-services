// GH_TOKEN is set by tests/helpers/env.js before any module loads; the tokens
// module reads it at import time. Assertions avoid the raw token value so a real
// developer token can't leak into Jasmine failure diffs.
const { getToken, updateRateLimit, getLimits } = await import(
  "../../../../../build/routes/github/lib/utils/tokens.js"
);

describe("routes/github/lib/utils/tokens", () => {
  it("getToken() returns the single configured token on every call", () => {
    expect(getToken()).toBe(getToken());
    expect(getToken().length).toBe((process.env.GH_TOKEN || "").length);
  });

  it("updateRateLimit() stores then overwrites a token's rate limit", () => {
    const token = getToken();
    const base = { resetAt: new Date("2026-01-01T00:00:00Z"), limit: 5000 };
    updateRateLimit(token, { ...base, remaining: 4500 });
    updateRateLimit(token, { ...base, remaining: 100 });
    const stored = Object.values(getLimits()).find(v => v !== null);
    expect(stored).toEqual(jasmine.objectContaining({ remaining: 100, limit: 5000 }));
  });

  it("getLimits() masks each token to asterisks plus the last 4 chars", () => {
    // Exact-match proves the security property in one assertion: length is
    // preserved, only the last 4 chars show, and the prefix is hidden.
    const token = process.env.GH_TOKEN;
    const masked = "*".repeat(token.length - 4) + token.slice(-4);
    expect(Object.keys(getLimits())).toEqual([masked]);
  });
});
