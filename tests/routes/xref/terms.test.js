import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { tmpdir } from "os";

let tmpDir;
let route;
let origDataDir;

const FIXTURE_XREF = {
  EventTarget: [{ type: "interface", spec: "dom", uri: "#eventtarget" }],
  "event target": [{ type: "dfn", spec: "dom", uri: "#concept-event-target" }],
  event: [{ type: "dfn", spec: "dom", uri: "#concept-event" }],
  "event handler": [{ type: "dfn", spec: "html", uri: "#event-handler" }],
  "event loop": [{ type: "dfn", spec: "html", uri: "#event-loop" }],
  element: [{ type: "dfn", spec: "dom", uri: "#concept-element" }],
  "foreignObject": [{ type: "element", spec: "svg", uri: "#foreignObject" }],
  fetch: [{ type: "dfn", spec: "fetch", uri: "#concept-fetch" }],
  "fire an event": [{ type: "dfn", spec: "dom", uri: "#concept-event-fire" }],
  URL: [{ type: "interface", spec: "url", uri: "#url" }],
  "url": [{ type: "dfn", spec: "url", uri: "#concept-url" }],
  AbortController: [{ type: "interface", spec: "dom", uri: "#abortcontroller" }],
  AbortSignal: [{ type: "interface", spec: "dom", uri: "#abortsignal" }],
  "abort signal": [{ type: "dfn", spec: "dom", uri: "#concept-abort-signal" }],
  Node: [{ type: "interface", spec: "dom", uri: "#node" }],
  navigator: [{ type: "attribute", spec: "html", uri: "#navigator" }],
};

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "xref-terms-test-"));
  const xrefDir = path.join(tmpDir, "xref");
  await mkdir(xrefDir, { recursive: true });
  await writeFile(path.join(xrefDir, "xref.json"), JSON.stringify(FIXTURE_XREF));
  await writeFile(path.join(xrefDir, "specs.json"), "{}");
  await writeFile(path.join(xrefDir, "specmap.json"), '{"current":{},"snapshot":{}}');
  await writeFile(path.join(xrefDir, "headings.json"), "{}");

  origDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = tmpDir;

  const mod = await import("../../../build/routes/xref/terms.get.js");
  route = mod.default;
});

afterAll(async () => {
  if (origDataDir !== undefined) {
    process.env.DATA_DIR = origDataDir;
  }
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

function mockReq(query = {}) {
  return { query };
}

function mockRes() {
  const res = {
    _status: 200,
    _body: undefined,
    _headers: {},
    status(code) { res._status = code; return res; },
    json(body) { res._body = body; return res; },
    set(header, value) { res._headers[header] = value; return res; },
    send(body) { res._body = body; return res; },
  };
  return res;
}

describe("xref/terms - server autocomplete", () => {
  it("returns 400 when q is missing", () => {
    const res = mockRes();
    route(mockReq(), res);
    expect(res._status).toBe(400);
  });

  it("returns 400 when q is too short", () => {
    const res = mockRes();
    route(mockReq({ q: "a" }), res);
    expect(res._status).toBe(400);
  });

  it("returns prefix matches first", () => {
    const res = mockRes();
    route(mockReq({ q: "ev" }), res);
    expect(res._status).toBe(200);
    expect(Array.isArray(res._body)).toBeTrue();
    expect(res._body.length).toBeGreaterThan(0);
    for (const term of res._body) {
      expect(term.toLowerCase()).toMatch(/ev/);
    }
  });

  it("matches case-insensitively but preserves original case", () => {
    const res = mockRes();
    route(mockReq({ q: "eventtarget" }), res);
    expect(res._body).toContain("EventTarget");
  });

  it("returns infix matches when prefix results are insufficient", () => {
    const res = mockRes();
    route(mockReq({ q: "signal" }), res);
    expect(res._body).toContain("AbortSignal");
    expect(res._body).toContain("abort signal");
  });

  it("respects the limit parameter", () => {
    const res = mockRes();
    route(mockReq({ q: "ev", limit: "3" }), res);
    expect(res._body.length).toBeLessThanOrEqual(3);
  });

  it("caps limit at 50", () => {
    const res = mockRes();
    route(mockReq({ q: "ev", limit: "100" }), res);
    expect(res._body.length).toBeLessThanOrEqual(50);
  });

  it("defaults limit to 15", () => {
    const res = mockRes();
    route(mockReq({ q: "ab" }), res);
    expect(res._body.length).toBeLessThanOrEqual(15);
  });

  it("sets Cache-Control header", () => {
    const res = mockRes();
    route(mockReq({ q: "ev" }), res);
    expect(res._headers["Cache-Control"]).toBeDefined();
    expect(res._headers["Cache-Control"]).toMatch(/max-age=/);
  });

  it("returns empty array for no matches", () => {
    const res = mockRes();
    route(mockReq({ q: "zzzzzzz" }), res);
    expect(res._body).toEqual([]);
  });

  it("handles mixed case query preserving original", () => {
    const res = mockRes();
    route(mockReq({ q: "ForeignObj" }), res);
    expect(res._body).toContain("foreignObject");
  });
});
