import { main as caniuse } from "respec-caniuse-route/scraper.js";
import { main as xref } from "respec-xref-route/scraper.js";

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
