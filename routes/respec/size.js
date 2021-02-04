// @ts-check
import { existsSync, mkdirSync, writeFileSync, promises as fs } from "fs";
import path from "path";

import { env } from "../../utils/misc.js";

const DATA_DIR = env("DATA_DIR");
const RESPEC_GH_ACTION_SECRET = env("RESPEC_GH_ACTION_SECRET");

const FILE_PATH = path.join(DATA_DIR, "respec/respec-w3c.json");
if (!existsSync(FILE_PATH)) {
  mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  writeFileSync(FILE_PATH, "");
}

export { getHandler as get };
export { putHandler as put };
/**
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 */
async function getHandler(_req, res) {
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Cache-Control", "max-age=1800");
  const text = await fs.readFile(FILE_PATH);
  res.send(text);
}

/**
 * We store last few commits in a buffer and later search it to ensure we don't
 * add duplicates. This is an optimization over reading and parsing entire file
 * from disk and checking for duplicates.
 * @type {Entry[]}
 */
const lastFewEntries = [];

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 *
 * @typedef {{ sha: string, time: number, size: number, xferSize: number }} Entry
 * @typedef {{ commits: Entry[] }} Data
 */
async function putHandler(req, res) {
  if (req.get("Authorization") !== RESPEC_GH_ACTION_SECRET) {
    return res.sendStatus(401);
  }

  /** @type {string} */
  const sha = req.body.sha;
  const size = parseInt(req.body.size, 10);
  const xferSize = parseInt(req.body.xferSize, 10);
  const time = parseInt(req.body.timestamp, 10);
  if (!size || !xferSize || !time || !/^([a-f0-9]{40})$/.test(sha)) {
    return res.sendStatus(400);
  }
  const entry = { sha: sha.slice(0, 10), time, size, xferSize };

  if (!ensureUnique(entry)) {
    return res.sendStatus(412);
  }

  await fs.appendFile(FILE_PATH, `${JSON.stringify(entry)}\n`);
  res.sendStatus(201);
}

/**
 * Make sure we don't end up adding duplicates to data file.
 * @param {Entry} entry
 */
function ensureUnique(entry) {
  if (lastFewEntries.some(e => e.sha === entry.sha)) {
    return false;
  }
  if (lastFewEntries.length === 3) {
    lastFewEntries.pop();
  }
  lastFewEntries.unshift(entry);
  return true;
}
