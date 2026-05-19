import { mkdtemp, writeFile, mkdir, rm, unlink } from "fs/promises";
import path from "path";
import { tmpdir } from "os";

// Fixture data representing the groups.json structure
const FIXTURE_GROUPS = {
  wg: {
    webapps: { id: 114929, name: "Web Applications Working Group", URI: "https://www.w3.org/groups/wg/webapps/" },
    css: { id: 32061, name: "CSS Working Group", URI: "https://www.w3.org/groups/wg/css/" },
    apa: { id: 83907, name: "Accessible Platform Architectures Working Group", URI: "https://www.w3.org/groups/wg/apa/" },
  },
  cg: {
    wicg: { id: 80485, name: "Web Incubator CG", URI: "https://www.w3.org/community/wicg/" },
  },
  ig: {
    wai: { id: 34520, name: "WAI Interest Group", URI: "https://www.w3.org/groups/ig/wai/" },
  },
  bg: {},
  other: {},
};

let tmpDir;
let groupsJsonPath;
let route;
let reloadGroups;
let origDataDir;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "w3c-group-test-"));
  const w3cDir = path.join(tmpDir, "w3c");
  groupsJsonPath = path.join(w3cDir, "groups.json");
  await mkdir(w3cDir, { recursive: true });
  await writeFile(groupsJsonPath, JSON.stringify(FIXTURE_GROUPS));

  // Set DATA_DIR before importing the module
  origDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = tmpDir;

  const mod = await import("../../../build/routes/w3c/group.js");
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
 * Create a mock Express request object.
 */
function mockReq(params = {}, headers = {}) {
  return { params, headers };
}

/**
 * Create a mock Express response object that tracks calls.
 */
function mockRes() {
  const res = {
    _status: 200,
    _body: undefined,
    _headers: {},
    _redirectUrl: undefined,
    _redirectStatus: undefined,
    _jsonBody: undefined,
    _rendered: undefined,
    status(code) {
      res._status = code;
      return res;
    },
    send(body) {
      res._body = body;
      return res;
    },
    json(body) {
      res._jsonBody = body;
      return res;
    },
    set(header, value) {
      res._headers[header] = value;
      return res;
    },
    redirect(status, url) {
      res._redirectStatus = status;
      res._redirectUrl = url;
      return res;
    },
    render(view, data) {
      res._rendered = { view, data };
      return res;
    },
  };
  return res;
}

describe("w3c/group - LEGACY_SHORTNAMES behavior", () => {
  it("redirects 'wai-apa' to 'apa'", async () => {
    const req = mockReq({ shortname: "wai-apa" });
    const res = mockRes();
    await route(req, res);
    expect(res._redirectStatus).toBe(301);
    expect(res._redirectUrl).toBe("/w3c/groups/apa");
  });

  it("redirects 'i18n' to 'i18n-core'", async () => {
    const req = mockReq({ shortname: "i18n" });
    const res = mockRes();
    await route(req, res);
    expect(res._redirectStatus).toBe(301);
    expect(res._redirectUrl).toBe("/w3c/groups/i18n-core");
  });
});

describe("w3c/group - no shortname", () => {
  it("returns JSON of all groups when no shortname and no html accept", async () => {
    const req = mockReq({}, { accept: "application/json" });
    const res = mockRes();
    await route(req, res);
    expect(res._jsonBody).toBeDefined();
    expect(res._jsonBody.wg).toBeDefined();
    expect(res._jsonBody.cg).toBeDefined();
    expect(res._jsonBody.ig).toBeDefined();
  });

  it("renders HTML view when accept includes text/html", async () => {
    const req = mockReq({}, { accept: "text/html" });
    const res = mockRes();
    await route(req, res);
    expect(res._rendered).toBeDefined();
    expect(res._rendered.view).toBe("w3c/groups.js");
    expect(res._rendered.data.groups).toBeDefined();
  });
});

describe("w3c/group - invalid group type", () => {
  it("returns 404 for invalid group type", async () => {
    const req = mockReq({ shortname: "webapps", type: "invalid-type" });
    const res = mockRes();
    await route(req, res);
    expect(res._status).toBe(404);
    expect(res._body).toContain("Invalid group type");
    expect(res._body).toContain("invalid-type");
    expect(res._headers["Content-Type"]).toBe("text/plain");
  });
});

describe("w3c/group - error handling", () => {
  it("returns 404 for unknown shortname with no type", async () => {
    const req = mockReq({ shortname: "totally-unknown-group" });
    const res = mockRes();
    await route(req, res);
    expect(res._status).toBe(404);
    expect(res._body).toContain("totally-unknown-group");
  });
});

describe("w3c/group - getGroupMeta disambiguation", () => {
  // This tests the group type disambiguation indirectly through the route handler.
  // When a shortname exists in only one type, it should work without specifying type.
  // When it exists in multiple types, it should return 409.

  it("does not return 409 for unambiguous shortname", async () => {
    // If a shortname existed in multiple group types (wg + cg), it would
    // return 409. Our fixture only has unique shortnames, so this tests
    // the non-ambiguous path doesn't return 409.
    const req = mockReq({ shortname: "css" });
    const res = mockRes();
    await route(req, res);
    expect(res._status).not.toBe(409);
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

    const req = mockReq({}, { accept: "application/json" });
    const res = mockRes();
    await route(req, res);
    expect(res._jsonBody.wg.newgroup).toBeDefined();
    expect(res._jsonBody.wg.newgroup.id).toBe(99999);
    expect(res._jsonBody.wg.css).toBeUndefined();
  });

  it("returns false when groups.json is missing", async () => {
    await unlink(groupsJsonPath);
    expect(reloadGroups()).toBe(false);

    const req = mockReq({}, { accept: "application/json" });
    const res = mockRes();
    await route(req, res);
    expect(res._jsonBody.wg.css).toBeDefined();
  });

  it("returns false when groups.json contains invalid JSON", async () => {
    await writeFile(groupsJsonPath, "{not valid json!!!");
    expect(reloadGroups()).toBe(false);

    const req = mockReq({}, { accept: "application/json" });
    const res = mockRes();
    await route(req, res);
    expect(res._jsonBody.wg.css).toBeDefined();
  });

});
