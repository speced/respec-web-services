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
  foreignObject: [{ type: "element", spec: "svg", uri: "#foreignObject" }],
  fetch: [{ type: "dfn", spec: "fetch", uri: "#concept-fetch" }],
  "fire an event": [{ type: "dfn", spec: "dom", uri: "#concept-event-fire" }],
  "live event": [{ type: "dfn", spec: "html", uri: "#concept-live-event" }],
  URL: [{ type: "interface", spec: "url", uri: "#url" }],
  url: [{ type: "dfn", spec: "url", uri: "#concept-url" }],
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

  route = (await import("../../../build/routes/xref/terms.get.js")).default;
});

afterAll(async () => {
  if (origDataDir !== undefined) process.env.DATA_DIR = origDataDir;
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
});

const mockReq = (query = {}) => ({ query });

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

const search = query => {
  const res = mockRes();
  route(mockReq(query), res);
  return res;
};

describe("xref/terms - server autocomplete", () => {
  it("returns 400 for a missing or too-short query (including array first element)", () => {
    for (const query of [undefined, { q: "a" }, { q: ["a", "event"] }]) {
      expect(search(query)._status).withContext(JSON.stringify(query)).toBe(400);
    }
  });

  it("returns prefix matches (all containing the query) before infix-only matches", () => {
    const { _status, _body } = search({ q: "ev" });
    expect(_status).toBe(200);
    expect(_body.length).toBeGreaterThan(0);
    for (const term of _body) expect(term.toLowerCase()).toContain("ev");
    const firstInfix = _body.findIndex(t => !t.toLowerCase().startsWith("ev"));
    const lastPrefix = _body.findLastIndex(t => t.toLowerCase().startsWith("ev"));
    if (firstInfix !== -1) expect(lastPrefix).toBeLessThan(firstInfix);
  });

  it("matches case-insensitively but returns the original-case term", () => {
    for (const [q, expected] of [["eventtarget", "EventTarget"], ["ForeignObj", "foreignObject"]]) {
      expect(search({ q })._body).withContext(q).toContain(expected);
    }
  });

  it("falls back to infix matches when prefix results are insufficient", () => {
    const { _body } = search({ q: "signal" });
    expect(_body).toContain("AbortSignal");
    expect(_body).toContain("abort signal");
  });

  it("respects, caps (50), and defaults (15) the limit", () => {
    for (const [limit, max] of [["3", 3], ["100", 50], [undefined, 15]]) {
      expect(search({ q: "ev", limit })._body.length)
        .withContext(`limit=${limit}`)
        .toBeLessThanOrEqual(max);
    }
  });

  it("sets a Cache-Control max-age header", () => {
    expect(search({ q: "ev" })._headers["Cache-Control"]).toMatch(/max-age=/);
  });

  it("normalizes an array query param to its first element", () => {
    const { _status, _body } = search({ q: ["event", "ignored"] });
    expect(_status).toBe(200);
    expect(_body.length).toBeGreaterThan(0);
  });

  it("returns an empty array when nothing matches", () => {
    expect(search({ q: "zzzzzzz" })._body).toEqual([]);
  });
});
