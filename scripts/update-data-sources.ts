import { mkdir } from "node:fs/promises";

import baseline from "../routes/api/baseline/lib/scraper.ts";
import unicode from "../routes/api/unicode/lib/scraper.ts";
import bibrefs from "../routes/bibrefs/lib/scraper.ts";
import caniuse from "../routes/caniuse/lib/scraper.ts";
import { pullRelease } from "../routes/respec/builds/update.ts";
import xref from "../routes/xref/lib/scraper.ts";
import { env } from "../utils/misc.ts";
import w3cGroupsList from "./update-w3c-groups-list.ts";

// ensure the data directory exists
await mkdir(env("DATA_DIR"), { recursive: true });

console.group("caniuse");
await caniuse({ forceUpdate: true });
console.groupEnd();

console.group("xref");
await xref({ forceUpdate: true });
console.groupEnd();

console.group("baseline");
await baseline();
console.groupEnd();

console.group("unicode");
await unicode({ forceUpdate: true });
console.groupEnd();

console.group("bibrefs");
await bibrefs({ forceUpdate: true });
console.groupEnd();

console.group("W3C Groups List");
await w3cGroupsList();
console.groupEnd();

console.group("Pull respec release");
await pullRelease();
console.groupEnd();
