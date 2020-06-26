require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { main: caniuse } = require("respec-caniuse-route/scraper");
const { main: xref } = require("respec-xref-route/scraper");
const w3c = require("./update-w3c-data");

async function update() {
  console.group("caniuse");
  await caniuse();
  console.groupEnd();
  console.group("xref");
  await xref();
  console.groupEnd();

  console.group("w3cGroups");
  await w3c.groups.update({ verbose: true });
  console.groupEnd();
}

update().catch(error => {
  console.log(error);
  process.exit(1);
});
