// @ts-check

/** @template T */
class RingBuffer {
  /** @type {Array<T>} */
  #buffer = [];
  #ptr = 0;
  #length = 0;

  /** @param {number} capacity */
  constructor(capacity) {
    this.#buffer = Array.from({ length: capacity });
  }

  /** @param {T} value */
  push(value) {
    this.#buffer[this.#ptr] = value;
    this.#ptr = (this.#ptr + 1) % this.#buffer.length;
    this.#length = Math.min(this.#length + 1, this.#buffer.length);
    return value;
  }

  /** Get items in latest first order. */
  *[Symbol.iterator]() {
    let i = this.#ptr - 1;
    for (let k = 0; k < this.#length; k++) {
      yield this.#buffer[i];
      i = (i + this.#buffer.length - 1) % this.#buffer.length;
    }
  }

  /** Get items in oldest first order. */
  reverseIter() {
    const self = this;
    return (function* () {
      let i = self.#length < self.#buffer.length ? self.#ptr - 1 : self.#ptr;
      for (let k = 0; k < self.#length; k++) {
        yield self.#buffer[i];
        i = (i + 1) % self.#buffer.length;
      }
    })();
  }
}

module.exports = RingBuffer;
