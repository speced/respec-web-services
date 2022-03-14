export const BROWSERS = new Map([
  ["and_chr", "Chrome (Android)"],
  ["and_ff", "Firefox (Android)"],
  ["and_uc", "UC Browser (Android)"],
  ["android", "Android"],
  ["chrome", "Chrome"],
  ["edge", "Edge"],
  ["firefox", "Firefox"],
  ["ios_saf", "Safari (iOS)"],
  ["op_mob", "Opera Mobile"],
  ["opera", "Opera"],
  ["safari", "Safari"],
  ["samsung", "Samsung Internet"],
]);

export const DEFAULT_BROWSERS = [
  "and_chr",
  "and_ff",
  "chrome",
  "edge",
  "firefox",
  "ios_saf",
  "safari",
  "samsung",
];

// Keys from https://github.com/Fyrd/caniuse/blob/master/CONTRIBUTING.md
export const SUPPORT_TITLES = new Map([
  ["y", "Supported."],
  ["a", "Almost supported (aka Partial support)."],
  ["n", "No support, or disabled by default."],
  ["p", "No support, but has Polyfill."],
  ["u", "Support unknown."],
  ["x", "Requires prefix to work."],
  ["d", "Disabled by default (needs to enabled)."],
]);

export type SupportKeys = ("y" | "n" | "a" | string)[];
// [ version, ['y', 'n'] ]
export type BrowserVersionData = [version: string, support: SupportKeys];

export interface ScraperOutput {
  all: { [browserName: string]: BrowserVersionData[] };
  summary: { [browserName: string]: BrowserVersionData[] };
}
