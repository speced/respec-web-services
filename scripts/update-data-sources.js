const { main: caniuse } = require("respec-caniuse-route/scraper");
const { main: xref } = require("respec-xref-route/scraper");

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
