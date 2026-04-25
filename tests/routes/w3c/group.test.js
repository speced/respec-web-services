import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { HTTPError } from "../../../build/utils/misc.js";

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
let route;
let origDataDir;

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "w3c-group-test-"));
  const w3cDir = path.join(tmpDir, "w3c");
  await mkdir(w3cDir, { recursive: true });
  await writeFile(
    path.join(w3cDir, "groups.json"),
    JSON.stringify(FIXTURE_GROUPS),
  );

  // Set DATA_DIR before importing the module
  origDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = tmpDir;

  const mod = await import("../../../build/routes/w3c/group.js");
  route = mod.default;
});

afterAll(async () => {
  process.env.DATA_DIR = origDataDir;
  await rm(tmpDir, { recursive: true, force: true });
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

describe("HTTPError", () => {
  it("has statusCode and message properties", () => {
    const error = new HTTPError(404, "Not found");
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Not found");
    expect(error).toBeInstanceOf(Error);
  });

  it("supports optional url property", () => {
    const error = new HTTPError(500, "Server error", "https://example.com");
    expect(error.url).toBe("https://example.com");
  });

  it("defaults url to undefined when not provided", () => {
    const error = new HTTPError(400, "Bad request");
    expect(error.url).toBeUndefined();
  });
});
