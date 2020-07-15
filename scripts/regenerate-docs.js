const { regenerateDocs } = require("../routes/docs/update");

(async () => {
  const start = Date.now();
  console.log("Regenerating docs...");
  await regenerateDocs();
  console.log(`Successfully regenerated docs in ${Date.now() - start}ms.`);
})();
