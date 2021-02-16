// @ts-check
/**
 * An in-memory cache.
 */
export class MemCache<ValueType> {
  #ttl = Infinity;
  #map = new Map<string, { time: number; value: ValueType }>();

  /**
   * @param ttl cache TTL in milliseconds
   */
  constructor(ttl: number) {
    this.#ttl = ttl;
  }

  set(key: string, value: ValueType) {
    this.#map.set(key, { time: Date.now(), value });
  }

  get(key: string) {
    if (!this.#map.has(key)) return;
    const { time, value } = this.#map.get(key);
    if (Date.now() - time > this.#ttl) {
      this.#map.delete(key);
      return;
    }
    return value;
  }

  has(key: string) {
    if (!this.#map.has(key)) return false;
    return Date.now() - this.#map.get(key).time > this.#ttl;
  }

  /**
   * Time (in ms) left for given key to expire.
   */
  expires(key: string) {
    if (!this.#map.has(key)) return 0;
    const remaining = this.#ttl - (Date.now() - this.#map.get(key).time);
    return Math.max(0, remaining);
  }

  invalidate() {
    const invalidatedKeys = [];
    for (const [key, { time }] of this.#map.entries()) {
      if (Date.now() - time > this.#ttl) {
        this.#map.delete(key);
        invalidatedKeys.push(key);
      }
    }
    return invalidatedKeys;
  }

  delete(key: string) {
    return this.#map.delete(key);
  }

  clear() {
    this.#map.clear();
  }
}
