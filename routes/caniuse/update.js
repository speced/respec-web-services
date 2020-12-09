// @ts-check
import { createRequire } from "module";

import { queue } from "../../utils/background-task-queue.js";

const require = createRequire(import.meta.url);
const { cache } = require("respec-caniuse-route");
const { main: scraper } = require("respec-caniuse-route/scraper");

export default function route(req, res) {
  if (req.body.ref !== "refs/heads/master") {
    res.status(400); // Bad request
    const msg = `Xref Payload was for ${req.body.ref}, ignored it.`;
    console.log(msg);
    return res.send(msg);
  }

  const taskId = `[/caniuse/update]: ${req.get("X-GitHub-Delivery")}`;
  queue.add(updateData, taskId);
  res.status(202); // Accepted
  res.send();
}

// TODO: Move this to a Worker maybe
async function updateData() {
  const hasUpdated = await scraper();
  if (hasUpdated) {
    cache.clear();
  }
  return "Succesfully updated.";
}
