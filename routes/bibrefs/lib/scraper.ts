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
// lowers peak resident memory on a host the server is also using.
const BUILD_HEAP_MB = 512;
const defaultOptions = { forceUpdate: false };
type Options = typeof defaultOptions;

/**
 * The commit whose data we last wrote out successfully. Set only after a build
 * succeeds, so a build that fails once the clone has already advanced is
 * retried rather than treated as up to date.
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
    // An interrupted fetch leaves an index.lock that fails every later run;
    // an interrupted clone leaves a directory that is not a repository at all.
    console.warn(
      "specref: git failed, discarding the clone and starting over.",
      error,
    );
    await rm(CLONE_DIRECTORY, { recursive: true, force: true });
    await clone();
    return head();
  }
}

/** Its own process: a worker thread would share this process's memory. */
async function buildData() {
  const script = path.join(import.meta.dirname, "build-data.js");
  const { PATH, HOME } = process.env;
  const { stdout } = await run(
    process.execPath,
    [
      `--max-old-space-size=${BUILD_HEAP_MB}`,
      script,
      CLONE_DIRECTORY,
      DATA_FILE,
    ],
    // Same allowlist as git: this child runs third-party code over third-party
    // data, so it must not inherit GH_TOKEN or the webhook secrets.
    { timeout: BUILD_TIMEOUT, env: { PATH, HOME } },
  );
  console.log(stdout.trim());
}
