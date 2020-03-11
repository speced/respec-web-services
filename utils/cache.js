class Cache extends Map {
  /** @param {number} ttl Cache lifetime in **milliseconds** */
  constructor(ttl) {
    super();
    this.ttl = ttl;
  }

  set(key, value) {
    super.set(key, { timestamp: Date.now(), value });
  }

  get(key) {
    const { timestamp, value } = super.get(key) || {};
    if (!timestamp) return;
    if (Date.now() - timestamp > this.ttl) {
      super.delete(key);
      return;
    }
    return value;
  }
}

/**
 * @param {number} duration Cache lifetime
 * @param {(req: import('express').Request) => string} keyFn Cache key function
 */
function cacheMiddleware(duration, keyFn) {
  const ttl = convertDuration(duration);
  const cache = new Cache(ttl);

  /** @type {import('express').Handler} */
  const middleware = (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.url;
    const cached = cache.get(key);
    if (cached) {
      const { headers, body } = cached;
      for (const [name, value] of headers) {
        res.setHeader(name, value);
      }
      res.setHeader("X-Cache", "HIT");
      res.send(body);
    } else {
      res.sendOriginal = res.send;
      res.send = body => {
        if (Math.trunc(res.statusCode / 100) === 2) {
          res.setHeader("Cache-Control", `max-age=${Math.floor(ttl / 1000)}`);
          const headers = Object.entries(res.getHeaders());
          res.setHeader("X-Cache", "MISS");
          cache.set(key, { headers, body });
        }
        res.sendOriginal(body);
      };
      next();
    }
  };
  return middleware;
}

/**
 * Convert a human readable duration string to milliseconds value.
 * @param {string|number} duration
 * @example
 * ``` js
 * parseDuration("1m") // 60_000
 * parseDuration(500) // 500
 * parseDuration("10.5 seconds") // 10_500
 * parseDuration("10.5s") // 10_500
 * ```
 */
function convertDuration(duration) {
  if (typeof duration === "number") {
    return duration;
  }

  const AS_MILLISECONDS = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 60 * 60 * 1000 * 24,
    w: 60 * 60 * 1000 * 24 * 7,
  };

  if (typeof duration === "string") {
    const matches = duration.match(/^([\d\.,]+)\s?(\w)/);
    if (matches.length === 3) {
      const value = parseFloat(matches[1]);
      const unit = matches[2].toLowerCase();
      if (value && AS_MILLISECONDS[unit]) {
        return value * AS_MILLISECONDS[unit];
      }
    }
  }

  throw new Error(`Invalid duration format: ${duration}`);
}

module.exports = { cacheMiddleware, Cache };
