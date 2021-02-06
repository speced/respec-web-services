// @ts-check
import { queue } from "../../utils/background-task-queue.js";

import { cache } from "respec-caniuse-route";
import { main as scraper } from "respec-caniuse-route/scraper.js";

export default function route(req, res) {
  if (req.body.ref !== "refs/heads/master") {
    res.status(400); // Bad request
    res.locals.reason = `ref-not-master`;
    const msg = `Xref Payload was for ${req.body.ref}, ignored it.`;
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
