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

  set(key: string, value: ValueType, time = Date.now()) {
    this.#map.set(key, { time, value });
  }

  get(key: string, allowStale?: boolean) {
    if (!this.#map.has(key)) return undefined;
    const { time, value } = this.#map.get(key)!;
    if (this.isBusted(time) && !allowStale) {
      this.#map.delete(key);
      return;
    }
    return value;
  }

  /**
   * Get item from cache if exists, otherwise return the value of calling
   * `defaultFunction` while adding the result to the cache.
   */
  getOr(key: string, defaultFunction: () => ValueType, allowStale?: boolean) {
    const cachedValue = this.get(key, allowStale);
    if (cachedValue === undefined) return cachedValue;
    const result = defaultFunction();
    this.set(key, result);
    return result;
  }

  has(key: string, stale?: boolean) {
    return this.get(key, stale) !== undefined;
  }

  /**
   * Time (in ms) left for given key to expire.
   */
  expires(key: string) {
    if (!this.#map.has(key)) return 0;
    const remaining = this.#ttl - (Date.now() - this.#map.get(key)!.time);
    return Math.max(0, remaining);
  }

  invalidate() {
    const invalidatedKeys: string[] = [];
    for (const [key, { time }] of this.#map.entries()) {
      if (this.isBusted(time)) {
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

  private isBusted(time: number) {
    return Date.now() - time > this.#ttl;
  }
}
