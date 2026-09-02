import { ms } from "../../../utils/misc.js";

import scraper from "./scraper.js";
import { store } from "./store-init.js";

/** Polling, because we do not own tobie/specref. A webhook would need Tobie to add one. */
async function tick() {
  try {
    // forceUpdate when degraded: otherwise an unchanged upstream means the
    // scraper returns false and a store that rejected its file never retries.
    if (await scraper({ forceUpdate: store.degraded })) store.fill();
  } catch (error) {
    console.warn("bibrefs: refresh failed, will try again next hour.", error);
  } finally {
    startRefreshing();
  }
}

/**
 * setTimeout, not setInterval: a slow run must not overlap the next one.
 *
 * Schedule only, never fetch here: this runs when the route is imported, so a
 * fetch clones specref on every test run.
 */
export function startRefreshing() {
  setTimeout(tick, ms("1h")).unref();
}
