import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createRequest, createResponse } from "node-mocks-http";

// Fixture data representing the groups.json structure
const FIXTURE_GROUPS = {
  wg: {
    webapps: {
      id: 114929,
      name: "Web Applications Working Group",
      URI: "https://www.w3.org/groups/wg/webapps/",
    },
    css: {
      id: 32061,
      name: "CSS Working Group",
      URI: "https://www.w3.org/groups/wg/css/",
    },
    apa: {
      id: 83907,
      name: "Accessible Platform Architectures Working Group",
      URI: "https://www.w3.org/groups/wg/apa/",
    },
  },
  cg: {
    wicg: {
      id: 80485,
      name: "Web Incubator CG",
      URI: "https://www.w3.org/community/wicg/",
    },
  },
  ig: {
    wai: {
      id: 34520,
      name: "WAI Interest Group",
      URI: "https://www.w3.org/groups/ig/wai/",
    },
  },
  bg: {},
  other: {},
};

type GroupRouteModule = typeof import("#routes/w3c/group.ts");
type GroupRequest = Parameters<GroupRouteModule["default"]>[0];
type GroupResponse = Parameters<GroupRouteModule["default"]>[1];

let tmpDir: string;
let groupsJsonPath: string;
let route: GroupRouteModule["default"];
let reloadGroups: GroupRouteModule["reloadGroups"];
let origDataDir: string | undefined;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "w3c-group-test-"));
  const w3cDir = path.join(tmpDir, "w3c");
  groupsJsonPath = path.join(w3cDir, "groups.json");
  await mkdir(w3cDir, { recursive: true });
  await writeFile(groupsJsonPath, JSON.stringify(FIXTURE_GROUPS));

  // Set DATA_DIR before importing the module
  origDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = tmpDir;

  const mod = await import("#routes/w3c/group.ts");
  route = mod.default;
  reloadGroups = mod.reloadGroups;
});

afterAll(async () => {
  if (origDataDir !== undefined) {
    process.env.DATA_DIR = origDataDir;
  }
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

/**
 * Invoke the route with a mock request/response and return the response for
 * assertions.
 */
async function run(
  params: Record<string, string> = {},
  headers: Record<string, string> = {},
) {
  const req = createRequest<GroupRequest>({ params, headers });
  const res = createResponse<GroupResponse>();
  await route(req, res);
  return res;
}

describe("w3c/group - LEGACY_SHORTNAMES behavior", () => {
  it("redirects legacy shortnames with a 301", async () => {
    for (const [shortname, target] of [
      ["wai-apa", "/w3c/groups/apa"],
      ["i18n", "/w3c/groups/i18n-core"],
    ]) {
      const res = await run({ shortname });
      expect(res.statusCode).withContext(shortname).toBe(301);
      expect(res._getRedirectUrl()).withContext(shortname).toBe(target);
    }
  });
});

describe("w3c/group - no shortname", () => {
  it("returns JSON of all groups when no shortname and no html accept", async () => {
    const res = await run({}, { accept: "application/json" });
    expect(res._getJSONData()).toBeDefined();
    expect(res._getJSONData().wg).toBeDefined();
    expect(res._getJSONData().cg).toBeDefined();
    expect(res._getJSONData().ig).toBeDefined();
  });

  it("renders HTML view when accept includes text/html", async () => {
    const res = await run({}, { accept: "text/html" });
    expect(res._getRenderView()).toBeDefined();
    expect(res._getRenderView()).toBe("w3c/groups.ts");
    expect(res._getRenderData().groups).toBeDefined();
  });
});

describe("w3c/group - error handling", () => {
  it("returns 404 for invalid group type", async () => {
    const res = await run({ shortname: "webapps", type: "invalid-type" });
    expect(res.statusCode).toBe(404);
    expect(res._getData()).toContain("Invalid group type");
    expect(res._getData()).toContain("invalid-type");
    expect(res.getHeader("Content-Type")).toBe("text/plain");
  });

  it("returns 404 for unknown shortname with no type", async () => {
    const res = await run({ shortname: "totally-unknown-group" });
    expect(res.statusCode).toBe(404);
    expect(res._getData()).toContain("totally-unknown-group");
  });
});

describe("w3c/group - getGroupMeta disambiguation", () => {
  // This tests the group type disambiguation indirectly through the route handler.
  // When a shortname exists in only one type, it should work without specifying type.
  // When it exists in multiple types, it should return 409.

  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    // Stub the api.w3.org call so the test is deterministic and offline-safe.
    // No "active-charter" link, so getPatentPolicy() makes no further request.
    globalThis.fetch = jasmine.createSpy("fetch").and.resolveTo(
      new Response(
        JSON.stringify({
          id: 32061,
          name: "CSS Working Group",
          _links: {
            homepage: { href: "https://www.w3.org/groups/wg/css/" },
            "pp-status": { href: "https://www.w3.org/groups/wg/css/ipr" },
          },
        }),
        { status: 200 },
      ),
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("resolves an unambiguous shortname to its single group type", async () => {
    // 'css' exists only as a wg in the fixture, so the type is inferred (no
    // 409 ambiguity error) and the route returns that group's info.
    const res = await run({ shortname: "css" });
    expect(res.statusCode).not.toBe(409);
    expect(res._getJSONData()).toEqual(
      jasmine.objectContaining({
        shortname: "css",
        type: "wg",
        name: "CSS Working Group",
      }),
    );
  });
});

describe("w3c/group - reloadGroups()", () => {
  afterEach(async () => {
    await writeFile(groupsJsonPath, JSON.stringify(FIXTURE_GROUPS));
    reloadGroups();
  });

  it("returns true and updates in-memory groups from valid JSON", async () => {
    const updated = {
      wg: {
        newgroup: { id: 99999, name: "New Group", URI: "https://example.com" },
      },
      cg: {},
      ig: {},
      bg: {},
      other: {},
    };
    await writeFile(groupsJsonPath, JSON.stringify(updated));
    expect(reloadGroups()).toBe(true);

    const res = await run({}, { accept: "application/json" });
    expect(res._getJSONData().wg.newgroup).toBeDefined();
    expect(res._getJSONData().wg.newgroup.id).toBe(99999);
    expect(res._getJSONData().wg.css).toBeUndefined();
  });

  it("returns false when groups.json is missing", async () => {
    await unlink(groupsJsonPath);
    expect(reloadGroups()).toBe(false);

    const res = await run({}, { accept: "application/json" });
    expect(res._getJSONData().wg.css).toBeDefined();
  });

  it("returns false when groups.json contains invalid JSON", async () => {
    await writeFile(groupsJsonPath, "{not valid json!!!");
    expect(reloadGroups()).toBe(false);

    const res = await run({}, { accept: "application/json" });
    expect(res._getJSONData().wg.css).toBeDefined();
  });
});
