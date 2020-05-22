// @ts-check
const {
  createReadStream,
  existsSync,
  mkdirSync,
  writeFileSync,
  promises: fs,
} = require("fs");
const path = require("path");
const RingBuffer = require("../../utils/ring-buffer");

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
  writeFileSync(FILE_PATH, "");
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
  res.setHeader("Content-Type", "text/plain");
  createReadStream(FILE_PATH).pipe(res);
}

/**
 * We store last few commits in a buffer and later search it to ensure we don't
 * add duplicates. This is an optimization over reading and parsing entire file
 * from disk and checking for duplicates.
 * @type {RingBuffer<Entry>}
 */
const lastFewEntries = new RingBuffer(3);

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

  /** @type {string} */
  const sha = req.body.sha;
  const size = parseInt(req.body.size, 10);
  const gzipSize = parseInt(req.body.gzipSize, 10);
  const time = parseInt(req.body.timestamp, 10);
  if (!size || !gzipSize || !time || !/^([a-f0-9]{40})$/.test(sha)) {
    return res.sendStatus(400);
  }
  const entry = { sha: sha.slice(0, 10), time, size, gzipSize };

  // Make sure we are not adding duplicates.
  if ([...lastFewEntries.reverseIter()].some((e) => e.sha === entry.sha)) {
    return res.sendStatus(412);
  }

  lastFewEntries.push(entry);
  await fs.appendFile(FILE_PATH, JSON.stringify(entry));

  res.sendStatus(201);
}
