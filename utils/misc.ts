import path from "path";
import { fileURLToPath } from "url";

/**
 * Ensure env variable exists and get its value.
 * @param name name of env variable
 * @throws if env variable is not set
 */
export function env(name: string) {
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
 * ``` js
 * seconds("1m") // 60
 * seconds("1.5m") // 90
 * ```
 */
export function seconds(duration: string) {
  const matches = duration.match(/^([\d\.,]+)\s?(\w)/);
  if (matches && matches.length === 3) {
    const value = parseFloat(matches[1]);
    const unit = matches[2].toLowerCase() as keyof typeof AS_SECONDS;
    if (value && AS_SECONDS[unit]) {
      return value * AS_SECONDS[unit];
    }
  }

  throw new Error(`Invalid duration format: "${duration}"`);
}

/**
 * Convert a human readable duration string to milliseconds value.
 * @example
 * ``` js
 * ms("1m") // 60_000
 * ms("10.5 seconds") // 10_500
 * ms("10.5s") // 10_500
 * ```
 */
export function ms(duration: string) {
  return seconds(duration) * 1000;
}

export class HTTPError extends Error {
  constructor(public statusCode: number, message: string, public url?: string) {
    super(message);
  }
}

// __dirname
export function legacyDirname(meta: ImportMeta) {
  return path.dirname(fileURLToPath(meta.url));
}

// __filename
export function legacyFilename(meta: ImportMeta) {
  return fileURLToPath(meta.url);
}
