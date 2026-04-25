import { mkdtempSync } from "fs";
import { readFile, rm } from "fs/promises";
import path from "path";
import { tmpdir } from "os";

// Set required env vars before importing the module.
const DATA_DIR = mkdtempSync(path.join(tmpdir(), "respec-size-test-"));
const TEST_SECRET = "test-secret-key-12345";
const origDataDir = process.env.DATA_DIR;
const origSecret = process.env.RESPEC_GH_ACTION_SECRET;
process.env.DATA_DIR = DATA_DIR;
process.env.RESPEC_GH_ACTION_SECRET = TEST_SECRET;

// Dynamic import so env vars are set before module-level code runs.
const { get, put } = await import("../../../build/routes/respec/size.js");

/** A valid 40-char hex SHA. */
const VALID_SHA = "a".repeat(40);

/** Create a minimal Express-like request object. */
function mockReq({ authorization, body = {} } = {}) {
  return {
    get(header) {
      if (header === "Authorization") return authorization;
      return undefined;
    },
    body,
  };
}

/** Create a minimal Express-like response object and return a spy wrapper. */
function mockRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) {
      res.headers[name] = value;
    },
    send: jasmine.createSpy("send"),
    sendStatus: jasmine.createSpy("sendStatus"),
  };
  return res;
}

describe("routes/respec/size", () => {
  afterAll(async () => {
    await rm(DATA_DIR, { recursive: true, force: true });
    process.env.DATA_DIR = origDataDir;
    process.env.RESPEC_GH_ACTION_SECRET = origSecret;
  });

  describe("PUT handler", () => {
    describe("authorization", () => {
      it("returns 401 when Authorization header is missing", async () => {
        const req = mockReq({ body: {} });
        const res = mockRes();
        await put(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(401);
      });

      it("returns 401 when Authorization header is wrong", async () => {
        const req = mockReq({
          authorization: "wrong-secret",
          body: {},
        });
        const res = mockRes();
        await put(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(401);
      });

      it("accepts the correct Authorization header", async () => {
        const req = mockReq({
          authorization: TEST_SECRET,
          body: {
            sha: VALID_SHA,
            size: "1000",
            xferSize: "500",
            timestamp: "1700000000",
          },
        });
        const res = mockRes();
        await put(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(201);
      });
    });

    describe("input validation", () => {
      /**
       * Helper: authorized request with given body.
       */
      function authorizedReq(body) {
        return mockReq({ authorization: TEST_SECRET, body });
      }

      it("returns 400 when sha is missing", async () => {
        const req = authorizedReq({
          size: "1000",
          xferSize: "500",
          timestamp: "1700000000",
        });
        const res = mockRes();
        await put(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(400);
      });

      it("returns 400 when sha is not a 40-char hex string", async () => {
        const cases = [
          "not-hex",
          "abcdef1234", // too short
          "A".repeat(40), // uppercase not allowed
          "g" + "a".repeat(39), // non-hex char
          "a".repeat(41), // too long
        ];
        for (const sha of cases) {
          const res = mockRes();
          await put(
            authorizedReq({
              sha,
              size: "1000",
              xferSize: "500",
              timestamp: "1700000000",
            }),
            res,
          );
          expect(res.sendStatus)
            .withContext(`sha="${sha}" should be rejected`)
            .toHaveBeenCalledWith(400);
        }
      });

      it("returns 400 when size is zero", async () => {
        const res = mockRes();
        await put(
          authorizedReq({
            sha: VALID_SHA,
            size: "0",
            xferSize: "500",
            timestamp: "1700000000",
          }),
          res,
        );
        expect(res.sendStatus).toHaveBeenCalledWith(400);
      });

      it("returns 400 when size is not a number", async () => {
        const res = mockRes();
        await put(
          authorizedReq({
            sha: VALID_SHA,
            size: "abc",
            xferSize: "500",
            timestamp: "1700000000",
          }),
          res,
        );
        expect(res.sendStatus).toHaveBeenCalledWith(400);
      });

      it("returns 400 when xferSize is zero", async () => {
        const res = mockRes();
        await put(
          authorizedReq({
            sha: VALID_SHA,
            size: "1000",
            xferSize: "0",
            timestamp: "1700000000",
          }),
          res,
        );
        expect(res.sendStatus).toHaveBeenCalledWith(400);
      });

      it("returns 400 when timestamp is zero", async () => {
        const res = mockRes();
        await put(
          authorizedReq({
            sha: VALID_SHA,
            size: "1000",
            xferSize: "500",
            timestamp: "0",
          }),
          res,
        );
        expect(res.sendStatus).toHaveBeenCalledWith(400);
      });

      it("returns 201 and writes entry for valid input", async () => {
        const sha = "b".repeat(40);
        const req = authorizedReq({
          sha,
          size: "2000",
          xferSize: "1000",
          timestamp: "1700000001",
        });
        const res = mockRes();
        await put(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(201);

        // Verify the entry was written to the file
        const filePath = path.join(DATA_DIR, "respec/respec-w3c.json");
        const content = await readFile(filePath, "utf-8");
        expect(content).toContain(sha.slice(0, 10));
      });

      it("truncates sha to 10 characters in stored entry", async () => {
        const sha = "c".repeat(40);
        const req = authorizedReq({
          sha,
          size: "3000",
          xferSize: "1500",
          timestamp: "1700000002",
        });
        const res = mockRes();
        await put(req, res);
        expect(res.sendStatus).toHaveBeenCalledWith(201);

        const filePath = path.join(DATA_DIR, "respec/respec-w3c.json");
        const content = await readFile(filePath, "utf-8");
        const lines = content.trim().split("\n");
        const lastEntry = JSON.parse(lines[lines.length - 1]);
        expect(lastEntry.sha).toBe("c".repeat(10));
        expect(lastEntry.sha.length).toBe(10);
      });
    });

    describe("deduplication buffer", () => {
      it("returns 412 for a duplicate sha", async () => {
        const sha = "d".repeat(40);
        const body = {
          sha,
          size: "4000",
          xferSize: "2000",
          timestamp: "1700000003",
        };
        const req1 = mockReq({ authorization: TEST_SECRET, body });
        const res1 = mockRes();
        await put(req1, res1);
        expect(res1.sendStatus).toHaveBeenCalledWith(201);

        // Second request with same sha should be rejected
        const req2 = mockReq({ authorization: TEST_SECRET, body });
        const res2 = mockRes();
        await put(req2, res2);
        expect(res2.sendStatus).toHaveBeenCalledWith(412);
      });

      it("buffer holds at most 3 entries (oldest evicted)", async () => {
        // Insert 4 unique entries to fill buffer past capacity.
        // The buffer size is 3, so after 4 inserts the first should be evicted.
        const shas = [
          "e".repeat(40),
          "f".repeat(40),
          "1".repeat(40),
          "2".repeat(40),
        ];

        for (const sha of shas) {
          const res = mockRes();
          await put(
            mockReq({
              authorization: TEST_SECRET,
              body: {
                sha,
                size: "5000",
                xferSize: "2500",
                timestamp: "1700000004",
              },
            }),
            res,
          );
          expect(res.sendStatus)
            .withContext(`sha=${sha} should succeed`)
            .toHaveBeenCalledWith(201);
        }

        // The first sha should have been evicted from the buffer,
        // so submitting it again should succeed (not 412).
        const resRetry = mockRes();
        await put(
          mockReq({
            authorization: TEST_SECRET,
            body: {
              sha: shas[0],
              size: "5000",
              xferSize: "2500",
              timestamp: "1700000005",
            },
          }),
          resRetry,
        );
        expect(resRetry.sendStatus)
          .withContext("evicted sha should be accepted again")
          .toHaveBeenCalledWith(201);
      });
    });
  });

  describe("GET handler", () => {
    it("sets Content-Type and Cache-Control headers", async () => {
      const req = {};
      const res = mockRes();
      await get(req, res);
      expect(res.headers["Content-Type"]).toBe("text/plain");
      expect(res.headers["Cache-Control"]).toBe("max-age=1800");
    });

    it("responds with file contents", async () => {
      const req = {};
      const res = mockRes();
      await get(req, res);
      expect(res.send).toHaveBeenCalledTimes(1);
      // The send call should receive a Buffer (from readFile without encoding)
      const arg = res.send.calls.first().args[0];
      expect(Buffer.isBuffer(arg)).toBeTrue();
    });
  });
});
