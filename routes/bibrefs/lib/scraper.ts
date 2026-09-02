import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { env, ms } from "../../../utils/misc.js";

import { DATA_FILE } from "./paths.js";

const run = promisify(execFile);

const UPSTREAM_REPOSITORY = "https://github.com/tobie/specref.git";
const CLONE_DIRECTORY = path.resolve(env("DATA_DIR"), "specref");

const GIT_TIMEOUT = ms("10m");
const BUILD_TIMEOUT = ms("2m");
// Keep this. A smaller old-generation budget makes V8 collect sooner, which
// measurably lowers the peak resident memory of a build that runs beside the
// server on a host with about a gigabyte.
const BUILD_HEAP_MB = 512;
const defaultOptions = { forceUpdate: false };
type Options = typeof defaultOptions;

/**
 * The commit whose data we last wrote out successfully.
 *
 * Compared against, rather than "did the clone move", so a build that fails
 * after the clone has already advanced gets retried instead of being treated as
 * up to date until upstream happens to commit again.
 */
let lastPublishedCommit: string | null = null;

export default async function main(options: Partial<Options> = {}) {
  const { forceUpdate } = { ...defaultOptions, ...options };
  const commit = await updateInputSource();
  if (!forceUpdate && commit === lastPublishedCommit && existsSync(DATA_FILE)) {
    console.log("Nothing to update from specref.");
    return false;
  }
  await mkdir(path.dirname(DATA_FILE), { recursive: true });
  await buildData();
  lastPublishedCommit = commit;
  return true;
}

/**
 * execFile, not utils/sh.ts: that one runs a shell, so anything interpolated
 * into the command is injectable. The env is an allowlist because the default
 * hands the child GH_TOKEN and every webhook secret.
 */
function git(gitArguments: string[], workingDirectory: string) {
  const { PATH, HOME } = process.env;
  return run("git", gitArguments, {
    cwd: workingDirectory,
    timeout: GIT_TIMEOUT,
    env: { PATH, HOME, GIT_TERMINAL_PROMPT: "0" },
  });
}

async function head() {
  const { stdout } = await git(["rev-parse", "HEAD"], CLONE_DIRECTORY);
  return stdout.trim();
}

async function clone() {
  await mkdir(path.dirname(CLONE_DIRECTORY), { recursive: true });
  // Shallow: nothing reads the history, and it is 638 MB of objects.
  await git(
    ["clone", "--depth", "1", UPSTREAM_REPOSITORY, CLONE_DIRECTORY],
    path.dirname(CLONE_DIRECTORY),
  );
}

/** @returns the commit the clone now sits at. */
async function updateInputSource() {
  if (!existsSync(CLONE_DIRECTORY)) {
    await clone();
    return head();
  }
  try {
    await git(["fetch", "--depth", "1", "origin", "main"], CLONE_DIRECTORY);
    await git(["reset", "--hard", "FETCH_HEAD"], CLONE_DIRECTORY);
    await git(["clean", "-fd"], CLONE_DIRECTORY);
    return await head();
  } catch (error) {
    // An interrupted fetch leaves an index.lock that fails every later run, and
    // an interrupted clone leaves a directory that is not a repository at all.
    // Reading the commit inside this block is what lets the second case recover.
    console.warn(
      "specref: git failed, discarding the clone and starting over.",
      error,
    );
    await rm(CLONE_DIRECTORY, { recursive: true, force: true });
    await clone();
    return head();
  }
}

/** Its own process: a worker thread shares this process's resident memory, and the transform peaks near 560 MB. */
async function buildData() {
  const script = path.join(import.meta.dirname, "build-data.js");
  const { stdout } = await run(
    process.execPath,
    [
      `--max-old-space-size=${BUILD_HEAP_MB}`,
      script,
      CLONE_DIRECTORY,
      DATA_FILE,
    ],
    { timeout: BUILD_TIMEOUT },
  );
  console.log(stdout.trim());
}
