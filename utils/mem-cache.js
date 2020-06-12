// @ts-check
/**
 * An in-memory cache.
 * @template ValueType
 */
class MemCache {
  #ttl = Infinity;
  /** @type {Map<string, { time: number, value: ValueType }>} */
  #map = new Map();

  /**
   * @param {number} ttl cache TTL in milliseconds
   */
  constructor(ttl) {
    this.#ttl = ttl;
  }

  /**
   * @param {string} key
   * @param {ValueType} value
   */
  set(key, value) {
    this._set(key, Date.now(), value);
  }

  /**
   * @param {string} key
   */
  get(key) {
    if (!this.#map.has(key)) return;
    const { time, value } = this.#map.get(key);
    if (Date.now() - time > this.#ttl) {
      this.#map.delete(key);
      return;
    }
    return value;
  }

  /** @param {string} key */
  has(key) {
    if (!this.#map.has(key)) return false;
    return Date.now() - this.#map.get(key).time > this.#ttl;
  }

  /**
   * Time (in ms) left for given key to expire.
   * @param {string} key
   */
  expires(key) {
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

  /** @param {string} key */
  delete(key) {
    return this.#map.delete(key);
  }

  clear() {
    this.#map.clear();
  }

  /**
   * @param {string} key
   * @param {number} time
   * @param {ValueType} value
   */
  _set(key, time, value) {
    this.#map.set(key, { time, value });
  }

  /**
   * @param {string} key
   * @returns {Readonly<{ time: number, value: ValueType }>}
   */
  _get(key) {
    return this.#map.get(key);
  }
}

module.exports = { MemCache };
