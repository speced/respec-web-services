import { createRequire } from "module";
import { main as xref } from "respec-xref-route/scraper.js";

const require = createRequire(import.meta.url);
const { main: caniuse } = require("respec-caniuse-route/scraper");

async function update() {
  console.group("caniuse");
  await caniuse();
  console.groupEnd();
  console.group("xref");
  await xref();
  console.groupEnd();
}

update().catch(error => {
  console.log(error);
  process.exit(1);
});
