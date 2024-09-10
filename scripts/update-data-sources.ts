import "dotenv/config";
import { mkdir } from "fs/promises";
import { env } from "../utils/misc.js";
import caniuse from "../routes/caniuse/lib/scraper.js";
import xref from "../routes/xref/lib/scraper.js";
import { pullRelease } from "../routes/respec/builds/update.js";
import w3cGroupsList from "./update-w3c-groups-list.js";

// ensure the data directory exists
await mkdir(env("DATA_DIR"), { recursive: true });

console.group("caniuse");
await caniuse({ forceUpdate: true });
console.groupEnd();

console.group("xref");
await xref({ forceUpdate: true });
console.groupEnd();

console.group("W3C Groups List");
await w3cGroupsList();
console.groupEnd();

console.group("Pull respec release");
await pullRelease();
console.groupEnd();
