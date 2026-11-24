import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { updateInputSource } from "#routes/xref/lib/scraper.ts";
import { env } from "#utils/misc.ts";

const DATA_DIR = env("DATA_DIR");
const CLONE_DIR = path.join(DATA_DIR, "webref");
const DFNS_FILE = "ed/dfns/a.json";
const NEW_FILE = "ed/dfns/new.json";

function git(cwd: string, ...args: string[]) {
  return execFileSync(
    "git",
    [
      ...["-c", "user.name=test", "-c", "user.email=test@example.com"],
      ...["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null"],
      ...args,
    ],
    {
      cwd,
      encoding: "utf-8",
      // A test run from a git hook would otherwise act on the hook's repository.
      env: {
        ...process.env,
        GIT_DIR: undefined,
        GIT_WORK_TREE: undefined,
        GIT_INDEX_FILE: undefined,
      },
    },
  );
}

async function writeFiles(dir: string, files: Record<string, string>) {
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), content);
  }
}

const read = (dir: string, file: string) =>
  readFile(path.join(dir, file), "utf-8");

async function withEnv(vars: Record<string, string>, run: () => Promise<void>) {
  const saved = { ...process.env };
  Object.assign(process.env, vars);
  try {
    await run();
  } finally {
    for (const key of Object.keys(vars)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

describe("xref/lib/scraper - updateInputSource", () => {
  let fixtureDir: string;
  let bareDir: string;
  let upstreamWorkDir: string;

  async function pushUpstream(files: Record<string, string>) {
    await writeFiles(upstreamWorkDir, files);
    git(upstreamWorkDir, "add", "-A");
    git(upstreamWorkDir, "commit", "-m", "update");
    git(upstreamWorkDir, "push", "origin", "main");
  }

  beforeEach(async () => {
    fixtureDir = await mkdtemp(path.join(os.tmpdir(), "webref-fixture-"));
    bareDir = path.join(fixtureDir, "upstream.git");
    upstreamWorkDir = path.join(fixtureDir, "work");
    git(fixtureDir, "init", "--bare", "-b", "main", bareDir);
    git(fixtureDir, "init", "-b", "main", upstreamWorkDir);
    git(upstreamWorkDir, "remote", "add", "origin", bareDir);
    await pushUpstream({ [DFNS_FILE]: "v1" });
    git(fixtureDir, "clone", bareDir, CLONE_DIR);
  });

  afterEach(async () => {
    const leftovers = [fixtureDir, CLONE_DIR, path.join(DATA_DIR, ".git")];
    leftovers.push(path.join(DATA_DIR, "ed"));
    await Promise.all(
      leftovers.map(dir => rm(dir, { recursive: true, force: true })),
    );
  });

  it("returns false when upstream has no new commits", async () => {
    await expectAsync(updateInputSource()).toBeResolvedTo(false);
  });

  it("returns true and updates the files when upstream has new commits", async () => {
    await pushUpstream({ [DFNS_FILE]: "v2" });
    await expectAsync(updateInputSource()).toBeResolvedTo(true);
    expect(await read(CLONE_DIR, DFNS_FILE)).toBe("v2");
  });

  const localOnlyChanges: Record<string, () => Promise<void>> = {
    "a local edit": () => writeFiles(CLONE_DIR, { [DFNS_FILE]: "local edit" }),
    "a stray untracked file": () =>
      writeFiles(CLONE_DIR, { "ed/headings/stray.json": "{}" }),
  };
  for (const [change, makeChange] of Object.entries(localOnlyChanges)) {
    it(`returns true when it discards ${change} and upstream has no new commits`, async () => {
      await makeChange();
      await expectAsync(updateInputSource()).toBeResolvedTo(true);
      expect(git(CLONE_DIR, "status", "--porcelain")).toBe("");
      expect(await read(CLONE_DIR, DFNS_FILE)).toBe("v1");
    });
  }

  it("reports a stray untracked file even when git is set to hide untracked files", async () => {
    await writeFiles(CLONE_DIR, { "ed/headings/stray.json": "{}" });
    const hideUntracked = {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "status.showUntrackedFiles",
      GIT_CONFIG_VALUE_0: "no",
    };
    await withEnv(hideUntracked, async () => {
      await expectAsync(updateInputSource()).toBeResolvedTo(true);
    });
    expect(
      git(CLONE_DIR, "status", "--porcelain", "--untracked-files=normal"),
    ).toBe("");
  });

  const stuckStates: Record<string, () => Promise<void>> = {
    "a local edit to a file that upstream changed": () =>
      writeFiles(CLONE_DIR, { [DFNS_FILE]: "local edit" }),
    "an untracked file that upstream adds": () =>
      writeFiles(CLONE_DIR, { [NEW_FILE]: "local" }),
    "a stray untracked file": () =>
      writeFiles(CLONE_DIR, { "ed/headings/stray.json": "{}" }),
    "a local commit": async () => {
      await writeFiles(CLONE_DIR, { "ed/dfns/local.json": "local" });
      git(CLONE_DIR, "add", "-A");
      git(CLONE_DIR, "commit", "-m", "local");
    },
  };
  for (const [state, makeStuck] of Object.entries(stuckStates)) {
    it(`resets the clone to upstream despite ${state}`, async () => {
      await makeStuck();
      await pushUpstream({ [DFNS_FILE]: "v2", [NEW_FILE]: "new" });

      await expectAsync(updateInputSource()).toBeResolvedTo(true);
      expect(git(CLONE_DIR, "rev-parse", "HEAD")).toBe(
        git(upstreamWorkDir, "rev-parse", "HEAD"),
      );
      expect(git(CLONE_DIR, "status", "--porcelain")).toBe("");
      expect(await read(CLONE_DIR, DFNS_FILE)).toBe("v2");
      expect(await read(CLONE_DIR, NEW_FILE)).toBe("new");
    });
  }

  it("leaves a repository that contains DATA_DIR alone when webref is not a repository", async () => {
    await rm(CLONE_DIR, { recursive: true, force: true });
    git(DATA_DIR, "init", "-b", "main");
    git(DATA_DIR, "remote", "add", "origin", bareDir);
    git(DATA_DIR, "fetch", "origin");
    git(DATA_DIR, "checkout", "-f", "-B", "main", "origin/main");
    git(DATA_DIR, "branch", "--set-upstream-to=origin/main", "main");
    await writeFiles(DATA_DIR, { [DFNS_FILE]: "outer edit" });
    await mkdir(CLONE_DIR);
    await pushUpstream({ [DFNS_FILE]: "v2" });
    const outerHead = git(DATA_DIR, "rev-parse", "HEAD");
    const outerStatus = git(DATA_DIR, "status", "--porcelain");

    await expectAsync(updateInputSource()).toBeRejectedWithError(
      /is not the root of a git repository/,
    );
    expect(await read(DATA_DIR, DFNS_FILE)).toBe("outer edit");
    expect(git(DATA_DIR, "rev-parse", "HEAD")).toBe(outerHead);
    expect(git(DATA_DIR, "status", "--porcelain")).toBe(outerStatus);
  });

  it("rejects when upstream no longer has the branch", async () => {
    git(bareDir, "update-ref", "-d", "refs/heads/main");
    // Turn fetch.prune off, so only the --prune flag can drop the stale ref.
    const pruneOff = {
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "fetch.prune",
      GIT_CONFIG_VALUE_0: "false",
    };
    await withEnv(pruneOff, async () => {
      await expectAsync(updateInputSource()).toBeRejectedWithError(
        /git reset --hard @\{u\}/,
      );
    });
  });

  it("rejects when HEAD is detached", async () => {
    git(CLONE_DIR, "checkout", "--detach");
    await expectAsync(updateInputSource()).toBeRejectedWithError(
      /git reset --hard @\{u\}/,
    );
  });

  it("ignores GIT_DIR, GIT_WORK_TREE and GIT_INDEX_FILE inherited from a git hook", async () => {
    const decoyDir = path.join(fixtureDir, "decoy");
    const decoyIndex = path.join(fixtureDir, "decoy-index");
    git(fixtureDir, "init", "-b", "main", decoyDir);
    await writeFile(decoyIndex, "decoy");
    await pushUpstream({ [DFNS_FILE]: "v2" });
    const hookEnv = {
      GIT_DIR: path.join(decoyDir, ".git"),
      GIT_WORK_TREE: decoyDir,
      GIT_INDEX_FILE: decoyIndex,
    };
    await withEnv(hookEnv, async () => {
      await expectAsync(updateInputSource()).toBeResolvedTo(true);
    });
    expect(await read(CLONE_DIR, DFNS_FILE)).toBe("v2");
    expect(await readFile(decoyIndex, "utf-8")).toBe("decoy");
  });
});
