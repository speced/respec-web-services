import { DiskCache } from "../../build/utils/disk-cache.js";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("utils/DiskCache", () => {
  let tempDir;
  let originalDataDir;

  beforeEach(async () => {
    tempDir = undefined;
    originalDataDir = process.env.DATA_DIR;
    tempDir = await mkdtemp(join(tmpdir(), "disk-cache-test-"));
    process.env.DATA_DIR = tempDir;
  });

  afterEach(async () => {
    try {
      if (originalDataDir !== undefined) {
        process.env.DATA_DIR = originalDataDir;
      } else {
        delete process.env.DATA_DIR;
      }
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  });

  it("round-trips set and get", async () => {
    const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
    await cache.set("greeting", "hello");
    const result = await cache.get("greeting");
    expect(result).toBe("hello");
  });

  it("returns undefined for missing key", async () => {
    const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
    const result = await cache.get("nonexistent");
    expect(result).toBeUndefined();
  });

  it("stores complex objects", async () => {
    const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
    const data = { name: "test", items: [1, 2, 3], nested: { a: true } };
    await cache.set("complex", data);
    const result = await cache.get("complex");
    expect(result).toEqual(data);
  });

  it("overwrites existing values", async () => {
    const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
    await cache.set("key", "old");
    await cache.set("key", "new");
    expect(await cache.get("key")).toBe("new");
  });

  it("persists to disk and reads back in a fresh instance", async () => {
    const opts = { ttl: 60_000, path: "test-cache" };
    const cache1 = new DiskCache(opts);
    await cache1.set("persist", "data");

    // A new instance should read from disk
    const cache2 = new DiskCache(opts);
    expect(await cache2.get("persist")).toBe("data");
  });

  describe("time-dependent expiry", () => {
    let now;

    beforeEach(() => {
      now = 1_000;
      spyOn(Date, "now").and.callFake(() => now);
    });

    describe("TTL expiry", () => {
      it("returns undefined for expired entries", async () => {
        // Use a very short TTL
        const cache = new DiskCache({ ttl: 1, path: "test-cache" });
        await cache.set("key", "value");

        now += 10;
        expect(await cache.get("key")).toBeUndefined();
      });

      it("returns stale value when allowStale is true", async () => {
        const cache = new DiskCache({ ttl: 1, path: "test-cache" });
        await cache.set("key", "value");

        now += 10;
        expect(await cache.get("key", true)).toBe("value");
      });
    });

    describe("invalidate()", () => {
      it("removes expired entries from memory and disk", async () => {
        const cache = new DiskCache({ ttl: 1, path: "test-cache" });
        await cache.set("a", 1);
        await cache.set("b", 2);

        now += 10;
        await cache.invalidate();

        expect(await cache.get("a", true)).toBeUndefined();
        expect(await cache.get("b", true)).toBeUndefined();
      });
    });
  });

  describe("path traversal prevention", () => {
    it("rejects keys with path traversal (..)", async () => {
      const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
      await expectAsync(cache.set("foo/../evil", "data")).toBeRejectedWithError(
        Error,
        /Invalid (key|path)/i
      );
    });

    it("rejects keys with double slashes", async () => {
      const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
      await expectAsync(cache.set("foo//bar", "data")).toBeRejectedWithError(
        Error,
        /Invalid (key|path)/i
      );
    });

    it("rejects keys with dot segments", async () => {
      const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
      await expectAsync(cache.set("foo/./bar", "data")).toBeRejectedWithError(
        Error,
        /Invalid (key|path)/i
      );
    });

    it("rejects prefix-bypass traversal (../test-cache-evil)", async () => {
      // A key like ../test-cache-evil/pwn resolves to a path that *starts with*
      // the base directory string but escapes it (e.g. /tmp/test-cache-evil).
      // The check must use baseDir + sep to prevent this bypass.
      const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
      await expectAsync(
        cache.set("../test-cache-evil/pwn", "data")
      ).toBeRejectedWithError(Error, /Invalid (key|path)/i);
    });
  });
});
