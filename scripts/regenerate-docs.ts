import { regenerateDocs } from "../routes/docs/update.js";

const start = Date.now();
console.log("Regenerating docs...");
await regenerateDocs();
console.log(`Successfully regenerated docs in ${Date.now() - start}ms.`);
