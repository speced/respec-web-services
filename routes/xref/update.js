// @ts-check
const { queue } = require("../../utils/background-task-queue");
const { main: scraper } = require("respec-xref-route/scraper");
const { cache: searchCache } = require("respec-xref-route/search");
const { store } = require("respec-xref-route/store");
const { ms } = require("../../utils/misc");

setInterval(() => searchCache.invalidate(), ms("4h"));

module.exports.route = function route(req, res) {
  if (req.body.ref !== "refs/heads/master") {
    res.status(400); // Bad request
    const msg = `Webref payload was for ${req.body.ref}, ignored webhook.`;
    console.error(msg);
    return res.send(msg);
  }

  if (!hasRelevantUpdate(req.body.commits)) {
    res.status(400); // Bad request
    const msg = "No relevant Webref changes, ignored webhook.";
    console.error(msg);
    return res.send(msg);
  }

  const taskId = `[/xref/update]: ${req.get("X-GitHub-Delivery")}`;
  queue.add(updateData, taskId);
  res.status(202); // Accepted
  res.send();
};

/**
 * @typedef {{ message: string, added: string[], removed: string[], modified: string[] }} Commit
 * @param {Commit[]} commits
 */
function hasRelevantUpdate(commits) {
  if (!Array.isArray(commits)) return false;
  const changedFiles = commits
    .map(commit => [commit.added, commit.removed, commit.modified])
    .flat(2);
  return changedFiles.some(file => file?.startsWith("ed/dfns/"));
}

// TODO: Move this to a Worker maybe
async function updateData() {
  const hasUpdated = await scraper();
  if (hasUpdated) {
    searchCache.clear();
    store.fill();
  }
  return "Succesfully updated.";
}
