// @ts-check
const {
  createReadStream,
  existsSync,
  mkdirSync,
  writeFileSync,
  promises: fs,
} = require("fs");
const path = require("path");

if (!process.env.DATA_DIR) {
  throw new Error("env variable `DATA_DIR` is not set.");
}

const respecSecret = process.env.RESPEC_SECRET;
if (!respecSecret) {
  throw new Error("env variable `RESPEC_SECRET` is not set.");
}

const FILE_PATH = path.join(process.env.DATA_DIR, "respec/respec-w3c.json");
if (!existsSync(FILE_PATH)) {
  mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  writeFileSync(FILE_PATH, `{ "commits": [] }`);
}

module.exports = {
  route: {
    get: getHandler,
    put: putHandler,
  },
};

/**
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 */
function getHandler(_req, res) {
  res.setHeader("Content-Type", "application/json");
  createReadStream(FILE_PATH).pipe(res);
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 *
 * @typedef {{ sha: string, time: number, size: number, gzipSize: number }} Entry
 * @typedef {{ commits: Entry[] }} Data
 */
async function putHandler(req, res) {
  if (req.get("Authorization") !== respecSecret) {
    return res.sendStatus(401);
  }

  const { sha } = req.body;
  const size = parseInt(req.body.size, 10);
  const gzipSize = parseInt(req.body.gzipSize, 10);
  const time = parseInt(req.body.timestamp, 10);
  if (!size || !gzipSize || !sha || !time) {
    return res.sendStatus(400);
  }
  const entry = { sha, time, size, gzipSize };

  const text = await fs.readFile(FILE_PATH, "utf-8");
  /** @type {Data} */
  const json = JSON.parse(text);

  if (!putIsValid(json, entry)) {
    return res.sendStatus(412);
  }

  json.commits.push(entry);
  await fs.writeFile(FILE_PATH, JSON.stringify(json));
  res.sendStatus(201);
}

/**
 * Make sure we are not adding duplicates.
 * @param {Data} data
 * @param {Entry} entry
 */
function putIsValid(data, entry) {
  const lastFewEntries = data.commits.slice(-3);
  return lastFewEntries.every((e) => e.sha !== entry.sha);
}
