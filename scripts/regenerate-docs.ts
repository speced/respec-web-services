import { regenerateDocs } from "../routes/docs/update.js";

const start = Date.now();
console.log("Regenerating docs...");

try {
  await regenerateDocs();
  console.log(`Successfully regenerated docs in ${Date.now() - start}ms.`);
} catch(err){
  console.log(err);
}
