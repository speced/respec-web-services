import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { createRequest, createResponse } from "node-mocks-http";

function makeReq(ip = "127.0.0.1") {
  return createRequest<Request>({ ip, headers: {}, method: "GET", url: "/" });
}

function makeRes() {
  return createResponse<Response>();
}

describe("rate limiting behavior", () => {
  it("allows requests under the limit", async () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 3, validate: false });
    for (let i = 0; i < 3; i++) {
      const res = makeRes();
      await new Promise<void>(resolve =>
        middleware(makeReq(), res, () => resolve()),
      );
      expect(res.statusCode).toBe(200);
    }
  });

  it("returns 429 when limit is exceeded", async () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 2, validate: false });
    const req = makeReq();
    await new Promise<void>(resolve =>
      middleware(req, makeRes(), () => resolve()),
    );
    await new Promise<void>(resolve =>
      middleware(req, makeRes(), () => resolve()),
    );

    const blockedRes = makeRes();
    let nextCalled = false;
    await middleware(req, blockedRes, () => {
      nextCalled = true;
    });
    expect(blockedRes.statusCode).toBe(429);
    expect(blockedRes.getHeader("retry-after")).toBeDefined();
    expect(nextCalled).toBe(false);
  });

  it("tracks IPs independently", async () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1, validate: false });
    let count = 0;
    await new Promise<void>(resolve =>
      middleware(makeReq("1.1.1.1"), makeRes(), () => {
        count++;
        resolve();
      }),
    );
    await new Promise<void>(resolve =>
      middleware(makeReq("2.2.2.2"), makeRes(), () => {
        count++;
        resolve();
      }),
    );
    expect(count).toBe(2);
  });
});
