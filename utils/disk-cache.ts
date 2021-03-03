import path from "path";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";

import { env } from "./misc.js";
import { MemCache } from "./mem-cache.js";

interface CacheEntry<V> {
  time: number;
  value: V;
}

interface Options {
  /** Cache TTL in ms */
  ttl: number;
  /** Cache directory for persistent storage */
  path: string;
  /** Automatically evict stale entries every `autoEvict` ms */
  autoEvictInterval?: number;
}

/**
 * An in-memory cache persisted through filesystem.
 */
export class DiskCache<ValueType> {
  #ttl: number;
  #path: string;
  #memCache: MemCache<ValueType>;

  constructor(options: Options) {
    this.#ttl = options.ttl;
    this.#path = options.path;
    this.#memCache = new MemCache(options.ttl);
    if (options.autoEvictInterval) {
      setInterval(this.invalidate.bind(this), options.autoEvictInterval);
    }
  }

  /**
   * Store a key-value pair in memory as well as on filesystem.
   */
  async set(key: string, value: ValueType) {
    const time = Date.now();
    this.#memCache.set(key, value, time);
    await this.write(key, { time, value });
  }

  /**
   * Try to get entry from memory, if that misses, try from filesystem.
   *
   * Hits from filesystem are loaded into memory for faster future access. Stale
   * hits are evicted unless `allowStale` is true.
   */
  async get(key: string, allowStale?: boolean) {
    if (!this.#memCache.has(key, allowStale)) {
      const entry = await this.read(key);
      if (!entry) {
        return undefined;
      }
      if (this.isBusted(entry.time) && !allowStale) {
        // If the filesystem content is state and stale is not requested, delete
        // it from filesystem and do not load it in memory.
        await this.delete(key);
        return undefined;
      }
      this.#memCache.set(key, entry.value, entry.time);
    }

    return this.#memCache.get(key, allowStale);
  }

  /**
   * Remove stale entries from memory as well as filesystem.
   */
  async invalidate() {
    const invalidatedKeys = this.#memCache.invalidate();
    await Promise.all(invalidatedKeys.map(key => this.delete(key)));
  }

  private isBusted(time: number) {
    return Date.now() - time > this.#ttl;
  }

  private async read(key: string) {
    const fileName = this.keyToFilePath(key);
    try {
      const text = await readFile(fileName, "utf-8");
      return JSON.parse(text) as CacheEntry<ValueType>;
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error(error);
      }
    }
  }

  private async write(key: string, entry: CacheEntry<ValueType>) {
    const fileName = this.keyToFilePath(key);
    await mkdir(path.dirname(fileName), { recursive: true });
    await writeFile(fileName, JSON.stringify(entry, null, 2), "utf-8");
  }

  private async delete(key: string) {
    const fileName = this.keyToFilePath(key);
    await unlink(fileName);
  }

  private keyToFilePath(key: string) {
    return path.join(env("DATA_DIR"), this.#path, `${key}.json`);
  }
}
