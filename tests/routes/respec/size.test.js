import { readFile } from "fs/promises";
import path from "path";

// Env vars (DATA_DIR, RESPEC_GH_ACTION_SECRET) are set by tests/helpers/env.js
// before any spec loads, so the module can be imported statically.
import { get, put } from "../../../build/routes/respec/size.js";

const DATA_DIR = process.env.DATA_DIR;
const TEST_SECRET = process.env.RESPEC_GH_ACTION_SECRET;
const VALID_SHA = "a".repeat(40);

const validBody = (overrides = {}) => ({
  sha: VALID_SHA,
  size: "1000",
  xferSize: "500",
  timestamp: "1700000000",
  ...overrides,
});

function mockRes() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    send: jasmine.createSpy("send"),
    sendStatus: jasmine.createSpy("sendStatus"),
  };
}

// Call put() with an Authorization header (defaults to the valid secret).
async function putBody(body, authorization = TEST_SECRET) {
  const req = { body, get: h => (h === "Authorization" ? authorization : undefined) };
  const res = mockRes();
  await put(req, res);
  return res;
}

async function lastStoredEntry() {
  const content = await readFile(path.join(DATA_DIR, "respec/respec-w3c.json"), "utf-8");
  const lines = content.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]);
}

describe("routes/respec/size", () => {
  describe("PUT handler", () => {
    it("returns 401 without the correct Authorization header", async () => {
      // null (missing) doesn't trigger putBody's default secret.
      for (const auth of [null, "wrong-secret"]) {
        const res = await putBody(validBody(), auth);
        expect(res.sendStatus).withContext(String(auth)).toHaveBeenCalledWith(401);
      }
    });

    it("returns 400 for a missing or malformed field", async () => {
      const invalidBodies = [
        validBody({ sha: undefined }),
        validBody({ sha: "not-hex" }),
        validBody({ sha: "abcdef1234" }), // too short
        validBody({ sha: "A".repeat(40) }), // uppercase not allowed
        validBody({ sha: "g" + "a".repeat(39) }), // non-hex char
        validBody({ sha: "a".repeat(41) }), // too long
        validBody({ size: "0" }),
        validBody({ size: "abc" }),
        validBody({ xferSize: "0" }),
        validBody({ timestamp: "0" }),
      ];
      for (const body of invalidBodies) {
        const res = await putBody(body);
        expect(res.sendStatus).withContext(JSON.stringify(body)).toHaveBeenCalledWith(400);
      }
    });

    it("returns 201 and stores an entry with the sha truncated to 10 chars", async () => {
      const sha = "b".repeat(40);
      const res = await putBody(validBody({ sha, timestamp: "1700000001" }));
      expect(res.sendStatus).toHaveBeenCalledWith(201);
      expect(await lastStoredEntry()).toEqual(jasmine.objectContaining({ sha: "b".repeat(10) }));
    });

    it("rejects a duplicate sha with 412", async () => {
      const body = validBody({ sha: "d".repeat(40), timestamp: "1700000003" });
      expect((await putBody(body)).sendStatus).toHaveBeenCalledWith(201);
      expect((await putBody(body)).sendStatus).toHaveBeenCalledWith(412);
    });

    it("evicts the oldest sha once the dedup buffer exceeds 3 entries", async () => {
      const shas = ["e", "f", "1", "2"].map(c => c.repeat(40));
      for (const sha of shas) {
        const res = await putBody(validBody({ sha, timestamp: "1700000004" }));
        expect(res.sendStatus).withContext(sha).toHaveBeenCalledWith(201);
      }
      // The first sha was evicted, so submitting it again succeeds (not 412).
      const res = await putBody(validBody({ sha: shas[0], timestamp: "1700000005" }));
      expect(res.sendStatus).toHaveBeenCalledWith(201);
    });
  });

  it("GET handler sends the file as a Buffer with caching headers", async () => {
    const res = mockRes();
    await get({}, res);
    expect(res.headers["Content-Type"]).toBe("text/plain");
    expect(res.headers["Cache-Control"]).toBe("max-age=1800");
    expect(Buffer.isBuffer(res.send.calls.first().args[0])).toBeTrue();
  });
});
