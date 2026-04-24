import { rateLimit } from "../../build/utils/rate-limit.js";

function makeReq(ip = "127.0.0.1") {
  return { ip, headers: {}, method: "GET", url: "/" };
}

function makeRes() {
  const headers = {};
  return {
    _status: null,
    _body: null,
    headers,
    setHeader(key, value) { headers[key.toLowerCase()] = value; return this; },
    getHeader(key) { return headers[key.toLowerCase()]; },
    status(code) { this._status = code; return this; },
    send(body) { this._body = body; return this; },
    end() { return this; },
    headersSent: false,
  };
}

describe("rate limiting behavior", () => {
  it("allows requests under the limit", async () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 3, validate: false });
    for (let i = 0; i < 3; i++) {
      const res = makeRes();
      await new Promise((resolve) => middleware(makeReq(), res, resolve));
      expect(res._status).toBeNull();
    }
  });

  it("returns 429 when limit is exceeded", async () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 2, validate: false });
    const req = makeReq();
    await new Promise((resolve) => middleware(req, makeRes(), resolve));
    await new Promise((resolve) => middleware(req, makeRes(), resolve));

    const blockedRes = makeRes();
    let nextCalled = false;
    await middleware(req, blockedRes, () => { nextCalled = true; });
    expect(blockedRes._status).toBe(429);
    expect(nextCalled).toBe(false);
  });

  it("tracks IPs independently", async () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1, validate: false });
    let count = 0;
    await new Promise((resolve) => middleware(makeReq("1.1.1.1"), makeRes(), () => { count++; resolve(); }));
    await new Promise((resolve) => middleware(makeReq("2.2.2.2"), makeRes(), () => { count++; resolve(); }));
    expect(count).toBe(2);
  });
});
