import path from "path";
import { fileURLToPath } from "url";

/**
 * Get env variable value
 * @param {string} name name of env variable
 * @throws if env variable is not set
 */
export function env(name) {
  const value = process.env[name];
  if (value) return value;
  throw `env variable \`${name}\` is not set.`;
}

const AS_SECONDS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
  w: 60 * 60 * 24 * 7,
};

/**
 * Convert a human readable duration string to seconds value.
 * @param {string} duration
 * ``` js
 * seconds("1m") // 60
 * seconds("1.5m") // 90
 * ```
 */
export function seconds(duration) {
  const matches = duration.match(/^([\d\.,]+)\s?(\w)/);
  if (matches && matches.length === 3) {
    const value = parseFloat(matches[1]);
    const unit = matches[2].toLowerCase();
    if (value && AS_SECONDS[unit]) {
      return value * AS_SECONDS[unit];
    }
  }

  throw new Error(`Invalid duration format: "${duration}"`);
}

/**
 * Convert a human readable duration string to milliseconds value.
 * @param {string} duration
 * @example
 * ``` js
 * ms("1m") // 60_000
 * ms("10.5 seconds") // 10_500
 * ms("10.5s") // 10_500
 * ```
 */
export function ms(duration) {
  return seconds(duration) * 1000;
}

export class HTTPError extends Error {
  constructor(statusCode, message, url) {
    super(message);
    this.statusCode = statusCode;
    this.url = url;
  }
}

// __dirname
export function legacyDirname(meta) {
  return path.dirname(fileURLToPath(meta.url));
}

// __filename
export function legacyFilename(meta) {
  return fileURLToPath(meta.url);
}
