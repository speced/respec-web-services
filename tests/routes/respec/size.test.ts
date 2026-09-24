import { readFile } from "node:fs/promises";
import path from "node:path";

import { createRequest, createResponse } from "node-mocks-http";

// Env vars (DATA_DIR, RESPEC_GH_ACTION_SECRET) are set by tests/helpers/env.ts
// before any spec loads, so the module can be imported statically.
import { get, put } from "#routes/respec/size.ts";

type PutRequest = Parameters<typeof put>[0];
type PutResponse = Parameters<typeof put>[1];
type PutRequestBody = PutRequest["body"];

const DATA_DIR = process.env.DATA_DIR!;
const TEST_SECRET = process.env.RESPEC_GH_ACTION_SECRET;
const VALID_SHA = "a".repeat(40);

const validBody = (
  overrides: Partial<PutRequestBody> = {},
): PutRequestBody => ({
  sha: VALID_SHA,
  size: "1000",
  xferSize: "500",
  timestamp: "1700000000",
  ...overrides,
});

// Call put() with an Authorization header (defaults to the valid secret).
async function putBody(
  body: PutRequestBody,
  authorization: string | null | undefined = TEST_SECRET,
) {
  const req = createRequest<PutRequest>({
    body,
    headers: authorization ? { authorization } : {},
  });
  const res = createResponse<PutResponse>();
  await put(req, res);
  return res;
}

async function lastStoredEntry() {
  const content = await readFile(
    path.join(DATA_DIR, "respec/respec-w3c.json"),
    "utf-8",
  );
  const lines = content.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]);
}

describe("routes/respec/size", () => {
  describe("PUT handler", () => {
    it("returns 401 without the correct Authorization header", async () => {
      // null (missing) doesn't trigger putBody's default secret.
      for (const auth of [null, "wrong-secret"]) {
        const res = await putBody(validBody(), auth);
        expect(res.statusCode).withContext(String(auth)).toBe(401);
      }
    });

    it("returns 400 for a missing or malformed field", async () => {
      const invalidBodies = [
        validBody({ sha: undefined }),
        validBody({ sha: "not-hex" }),
        validBody({ sha: "abcdef1234" }), // too short
        validBody({ sha: "A".repeat(40) }), // uppercase not allowed
        validBody({ sha: `g${"a".repeat(39)}` }), // non-hex char
        validBody({ sha: "a".repeat(41) }), // too long
        validBody({ size: "0" }),
        validBody({ size: "abc" }),
        validBody({ xferSize: "0" }),
        validBody({ timestamp: "0" }),
      ];
      for (const body of invalidBodies) {
        const res = await putBody(body);
        expect(res.statusCode).withContext(JSON.stringify(body)).toBe(400);
      }
    });

    it("returns 201 and stores an entry with the sha truncated to 10 chars", async () => {
      const sha = "b".repeat(40);
      const res = await putBody(validBody({ sha, timestamp: "1700000001" }));
      expect(res.statusCode).toBe(201);
      expect(await lastStoredEntry()).toEqual(
        jasmine.objectContaining({ sha: "b".repeat(10) }),
      );
    });

    it("rejects a duplicate sha with 412", async () => {
      const body = validBody({ sha: "d".repeat(40), timestamp: "1700000003" });
      expect((await putBody(body)).statusCode).toBe(201);
      expect((await putBody(body)).statusCode).toBe(412);
    });

    it("evicts the oldest sha once the dedup buffer exceeds 3 entries", async () => {
      const shas = ["e", "f", "1", "2"].map(c => c.repeat(40));
      for (const sha of shas) {
        const res = await putBody(validBody({ sha, timestamp: "1700000004" }));
        expect(res.statusCode).withContext(sha).toBe(201);
      }
      // The first sha was evicted, so submitting it again succeeds (not 412).
      const res = await putBody(
        validBody({ sha: shas[0], timestamp: "1700000005" }),
      );
      expect(res.statusCode).toBe(201);
    });
  });

  it("GET handler sends the file as a Buffer with caching headers", async () => {
    const req = createRequest<Parameters<typeof get>[0]>();
    const res = createResponse<Parameters<typeof get>[1]>();
    await get(req, res);
    expect(res.getHeader("Content-Type")).toBe("text/plain");
    expect(res.getHeader("Cache-Control")).toBe("max-age=1800");
    expect(Buffer.isBuffer(res._getBuffer())).toBeTrue();
  });
});
