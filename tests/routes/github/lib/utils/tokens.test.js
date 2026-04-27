// GH_TOKEN is set by tests/helpers/env.js before any module loads.
// The tokens module reads it at import time, so we use whatever value
// the helper provided.
const {
  getToken,
  updateRateLimit,
  getLimits,
} = await import(
  "../../../../../build/routes/github/lib/utils/tokens.js"
);

describe("routes/github/lib/utils/tokens", () => {
  describe("getToken()", () => {
    it("returns a token string", () => {
      const token = getToken();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("returns the configured GH_TOKEN", () => {
      const token = getToken();
      expect(token).toBe(process.env.GH_TOKEN);
    });

    it("cycles back to the same token (single-token rotation)", () => {
      // With a single token, every call returns the same value
      const first = getToken();
      const second = getToken();
      const third = getToken();
      expect(first).toBe(second);
      expect(second).toBe(third);
    });
  });

  describe("updateRateLimit()", () => {
    it("stores rate limit data for a token", () => {
      const token = getToken();
      const rateLimit = {
        remaining: 4500,
        resetAt: new Date("2026-01-01T00:00:00Z"),
        limit: 5000,
      };
      updateRateLimit(token, rateLimit);

      const limits = getLimits();
      const entries = Object.values(limits);
      // The stored rate limit should match what we set
      const stored = entries.find(v => v !== null);
      expect(stored).toBeDefined();
      expect(stored?.remaining).toBe(4500);
      expect(stored?.limit).toBe(5000);
    });

    it("updates existing rate limit data", () => {
      const token = getToken();
      const first = {
        remaining: 4500,
        resetAt: new Date("2026-01-01T00:00:00Z"),
        limit: 5000,
      };
      updateRateLimit(token, first);

      const second = {
        remaining: 100,
        resetAt: new Date("2026-01-01T01:00:00Z"),
        limit: 5000,
      };
      updateRateLimit(token, second);

      const limits = getLimits();
      const entries = Object.values(limits);
      const stored = entries.find(v => v !== null);
      expect(stored.remaining).toBe(100);
    });
  });

  describe("getLimits()", () => {
    it("returns an object keyed by masked tokens", () => {
      const limits = getLimits();
      expect(typeof limits).toBe("object");
      expect(Object.keys(limits).length).toBeGreaterThan(0);
    });

    it("never exposes the full token in keys", () => {
      const fullToken = process.env.GH_TOKEN;
      const limits = getLimits();
      for (const key of Object.keys(limits)) {
        expect(key).not.toBe(fullToken);
      }
    });

    it("masks all but the last 4 characters of the token", () => {
      const fullToken = process.env.GH_TOKEN;
      if (fullToken.length <= 4) {
        pending("GH_TOKEN too short to verify masking pattern");
        return;
      }
      const limits = getLimits();
      const keys = Object.keys(limits);
      expect(keys).toHaveSize(1);

      const maskedKey = keys[0];
      // Should show only the last 4 characters, rest are asterisks
      const expectedMaskedToken = fullToken.length <= 4
        ? fullToken
        : "*".repeat(fullToken.length - 4) + fullToken.slice(-4);
      expect(maskedKey).toBe(expectedMaskedToken);
    });

    it("masked key has the same length as the full token", () => {
      const fullToken = process.env.GH_TOKEN;
      const limits = getLimits();
      const maskedKey = Object.keys(limits)[0];
      // Length is preserved (stars replace chars 1:1)
      expect(maskedKey.length).toBe(fullToken.length);
    });

    it("does not leak the token prefix (ghp_ or similar)", () => {
      const fullToken = process.env.GH_TOKEN;
      const limits = getLimits();
      const maskedKey = Object.keys(limits)[0];
      // The ghp_ prefix must NOT appear in the masked key
      const prefix = fullToken.slice(0, 4);
      expect(maskedKey.startsWith(prefix)).toBeFalse();
      expect(maskedKey.startsWith("*")).toBeTrue();
    });

    it("exposes at most 4 characters of the actual token", () => {
      const fullToken = process.env.GH_TOKEN;
      const limits = getLimits();
      const maskedKey = Object.keys(limits)[0];
      // Count non-asterisk characters
      const visibleChars = [...maskedKey].filter(c => c !== "*").length;
      expect(visibleChars).toBeLessThanOrEqual(4);
    });
  });
});
