// @ts-check
const { join } = require("path");
const { mkdir, unlink } = require("fs").promises;
const { createHash } = require("crypto");
const { readJSON, writeJSON, readDir } = require("./fs.js");
const { MemCache } = require("./mem-cache.js");

/**
 * An in-memory cache persisted by file-system.
 * @template ValueType
 */
class FsCache {
  /** @type {string} */
  #dirname = null;
  /** @type {MemCache<ValueType>} */
  #cache = null;
  /** @type {string[]} */
  #saveQueue = [];
  /** @type {string[]} */
  #deleteQueue = [];

  /**
   * @param {string} dirname where to store cached items on file-system
   * @typedef {{ key: string, time: number, value: ValueType }} FsCacheEntry
   */
  constructor(dirname, ttl = Infinity, autosaveInterval = 10000) {
    this.#dirname = dirname;
    this.#cache = new MemCache(ttl);
    if (autosaveInterval > 0) {
      setTimeout(this.dump.bind(this), autosaveInterval);
    }
  }

  /**
   * @param {string} key
   * @param {ValueType} value
   */
  set(key, value) {
    this.#cache.set(key, value);
    this.#saveQueue.push(key);
  }

  /**
   * @param {string} key
   */
  async get(key) {
    const fromMemory = this.#cache.get(key);
    if (fromMemory) {
      return fromMemory;
    }
    this.#deleteQueue.push(key);

    try {
      /** @type {FsCacheEntry} */
      const { time, value } = await readJSON(this.getFilePath(key));
      this.#cache._set(key, time, value);
      return value;
    } catch {
      return;
    }
  }

  async dump() {
    await mkdir(this.#dirname, { recursive: true });
    await this.invalidate();

    const promisesToWriteFile = [];
    for (const key of this.#saveQueue) {
      if (this.#cache.expires(key) > 0) {
        const file = this.getFilePath(key);
        const entry = this.#cache._get(key);
        promisesToWriteFile.push(writeJSON(file, { key, ...entry }));
      }
    }
    this.#saveQueue.length = 0;
    await Promise.all(promisesToWriteFile);
    return promisesToWriteFile.length;
  }

  async load() {
    await mkdir(this.#dirname, { recursive: true });

    const files = await readDir(this.#dirname);
    /** @type {FsCacheEntry[]} */
    for (const { key, time, value } of await Promise.all(files.map(readJSON))) {
      this.#cache._set(key, time, value);
    }
  }

  /**
   * Clears stale entries from in-memory cache as well as disk.
   */
  async invalidate() {
    const invalidatedKeys = this.#cache.invalidate();
    const keysToDelete = [
      ...new Set([...invalidatedKeys, ...this.#deleteQueue]),
    ];
    this.#deleteQueue.length = 0;
    const filesToDelete = keysToDelete.map(key => this.getFilePath(key));
    await Promise.all(filesToDelete.map(file => unlink(file).catch(() => {})));
    return keysToDelete;
  }

  /** @param {string} key */
  getFilePath(key) {
    const fileName = createHash("sha1").update(key).digest("hex").slice(0, 8);
    return join(this.#dirname, `${fileName}.json`);
  }
}

module.exports = { FsCache };
