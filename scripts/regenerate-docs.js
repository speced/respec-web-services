import { regenerateDocs } from "../build/routes/docs/update.js";

(async () => {
  const start = Date.now();
  console.log("Regenerating docs...");
  await regenerateDocs();
  console.log(`Successfully regenerated docs in ${Date.now() - start}ms.`);
})();
