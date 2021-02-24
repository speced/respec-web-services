import "../build/utils/dotenv.js";
import caniuse from "../build/routes/caniuse/lib/scraper.js";
import xref from "../build/routes/xref/lib/scraper.js";
import w3cGroupsList from "./update-w3c-groups-list.js";

async function update() {
  console.group("caniuse");
  await caniuse();
  console.groupEnd();

  console.group("xref");
  await xref();
  console.groupEnd();

  console.group("W3C Groups List");
  if (process.env.W3C_API_KEY) {
    await w3cGroupsList();
  } else {
    console.log("Skipped.");
  }
  console.groupEnd();
}

update().catch(error => {
  console.log(error);
  process.exit(1);
});
