import { MemCache } from "../../build/utils/mem-cache.js";

describe("utils/MemCache", () => {
  describe("set() and get()", () => {
    it("stores and retrieves a value", () => {
      const cache = new MemCache(10_000);
      cache.set("key1", "value1");
      expect(cache.get("key1")).toBe("value1");
    });

    it("returns undefined for missing key", () => {
      const cache = new MemCache(10_000);
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("overwrites existing value", () => {
      const cache = new MemCache(10_000);
      cache.set("key", "old");
      cache.set("key", "new");
      expect(cache.get("key")).toBe("new");
    });

    it("works with non-string values", () => {
      const cache = new MemCache(10_000);
      cache.set("obj", { a: 1 });
      expect(cache.get("obj")).toEqual({ a: 1 });
      cache.set("arr", [1, 2, 3]);
      expect(cache.get("arr")).toEqual([1, 2, 3]);
    });
  });

  describe("TTL expiry", () => {
    it("returns undefined for expired entries", () => {
      const cache = new MemCache(1000); // 1 second TTL
      // Set entry with a time 2 seconds in the past
      cache.set("old", "stale", Date.now() - 2000);
      expect(cache.get("old")).toBeUndefined();
    });

    it("returns value for non-expired entries", () => {
      const cache = new MemCache(10_000);
      cache.set("fresh", "value", Date.now());
      expect(cache.get("fresh")).toBe("value");
    });

    it("returns stale value when allowStale is true", () => {
      const cache = new MemCache(1000);
      cache.set("old", "stale", Date.now() - 2000);
      expect(cache.get("old", true)).toBe("stale");
    });

    it("deletes expired entry from cache on non-stale get", () => {
      const cache = new MemCache(1000);
      cache.set("old", "stale", Date.now() - 2000);
      // First get removes it
      expect(cache.get("old")).toBeUndefined();
      // Even stale get now returns undefined because it was deleted
      expect(cache.get("old", true)).toBeUndefined();
    });
  });

  describe("has()", () => {
    it("returns true for existing non-expired key", () => {
      const cache = new MemCache(10_000);
      cache.set("key", "val");
      expect(cache.has("key")).toBeTrue();
    });

    it("returns false for missing key", () => {
      const cache = new MemCache(10_000);
      expect(cache.has("missing")).toBeFalse();
    });

    it("returns false for expired key without stale option", () => {
      const cache = new MemCache(1000);
      cache.set("old", "val", Date.now() - 2000);
      expect(cache.has("old")).toBeFalse();
    });

    it("returns true for expired key with stale option", () => {
      const cache = new MemCache(1000);
      cache.set("old", "val", Date.now() - 2000);
      expect(cache.has("old", true)).toBeTrue();
    });
  });

  describe("getOr()", () => {
    it("returns cached value if present", () => {
      const cache = new MemCache(10_000);
      cache.set("key", "cached");
      const result = cache.getOr("key", () => "default");
      expect(result).toBe("cached");
    });

    it("calls defaultFunction and caches result for missing key", () => {
      const cache = new MemCache(10_000);
      let callCount = 0;
      const factory = () => {
        callCount++;
        return "computed";
      };
      expect(cache.getOr("key", factory)).toBe("computed");
      expect(callCount).toBe(1);

      // Second call uses cached value
      expect(cache.getOr("key", factory)).toBe("computed");
      expect(callCount).toBe(1);
    });

    it("recomputes when entry has expired", () => {
      const cache = new MemCache(1000);
      cache.set("key", "old", Date.now() - 2000);
      const result = cache.getOr("key", () => "fresh");
      expect(result).toBe("fresh");
    });
  });

  describe("delete()", () => {
    it("removes an entry", () => {
      const cache = new MemCache(10_000);
      cache.set("key", "val");
      expect(cache.delete("key")).toBeTrue();
      expect(cache.get("key")).toBeUndefined();
    });

    it("returns false for nonexistent key", () => {
      const cache = new MemCache(10_000);
      expect(cache.delete("nonexistent")).toBeFalse();
    });
  });

  describe("clear()", () => {
    it("removes all entries", () => {
      const cache = new MemCache(10_000);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);
      cache.clear();
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("c")).toBeUndefined();
    });
  });

  describe("expires()", () => {
    it("returns remaining TTL for a valid entry", () => {
      const cache = new MemCache(10_000);
      cache.set("key", "val", Date.now());
      const remaining = cache.expires("key");
      // Should be close to 10_000 but we give some tolerance
      expect(remaining).toBeGreaterThan(9_900);
      expect(remaining).toBeLessThanOrEqual(10_000);
    });

    it("returns 0 for missing key", () => {
      const cache = new MemCache(10_000);
      expect(cache.expires("nonexistent")).toBe(0);
    });

    it("returns 0 for expired key", () => {
      const cache = new MemCache(1000);
      cache.set("old", "val", Date.now() - 2000);
      expect(cache.expires("old")).toBe(0);
    });
  });

  describe("invalidate()", () => {
    it("removes expired entries and returns their keys", () => {
      const cache = new MemCache(1000);
      cache.set("old1", "v1", Date.now() - 2000);
      cache.set("old2", "v2", Date.now() - 3000);
      cache.set("fresh", "v3", Date.now());

      const invalidated = cache.invalidate();
      expect(invalidated).toContain("old1");
      expect(invalidated).toContain("old2");
      expect(invalidated).not.toContain("fresh");
    });

    it("returns empty array when nothing is expired", () => {
      const cache = new MemCache(10_000);
      cache.set("a", 1);
      cache.set("b", 2);
      expect(cache.invalidate()).toEqual([]);
    });

    it("makes expired entries inaccessible", () => {
      const cache = new MemCache(1000);
      cache.set("old", "val", Date.now() - 2000);
      cache.invalidate();
      expect(cache.get("old", true)).toBeUndefined();
    });
  });
});
