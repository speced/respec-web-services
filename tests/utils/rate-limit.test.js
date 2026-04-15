import { rateLimit } from "../../build/utils/rate-limit.js";

describe("utils/rate-limit", () => {
  function makeReq(ip = "1.2.3.4") {
    return { ip };
  }

  function makeRes() {
    const headers = {};
    const res = {
      _status: null,
      _body: null,
      headers,
      set(key, value) {
        headers[key] = value;
        return res;
      },
      status(code) {
        res._status = code;
        return res;
      },
      send(body) {
        res._body = body;
        return res;
      },
    };
    return res;
  }

  it("allows requests under the limit", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 3 });
    const req = makeReq();
    let nextCalled = 0;

    for (let i = 0; i < 3; i++) {
      const res = makeRes();
      middleware(req, res, () => nextCalled++);
      expect(res._status).toBeNull();
    }
    expect(nextCalled).toBe(3);
  });

  it("returns 429 when limit is exceeded", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 2 });
    const req = makeReq();
    let nextCalled = 0;

    middleware(req, makeRes(), () => nextCalled++);
    middleware(req, makeRes(), () => nextCalled++);

    const blockedRes = makeRes();
    middleware(req, blockedRes, () => nextCalled++);

    expect(blockedRes._status).toBe(429);
    expect(blockedRes._body).toBe("Too Many Requests");
    expect(blockedRes.headers["Retry-After"]).toBeDefined();
    expect(nextCalled).toBe(2);
  });

  it("sets Retry-After to seconds until next request is allowed", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 2 });
    const req = makeReq();
    let nextCalled = 0;
    const nowSpy = spyOn(Date, "now").and.returnValues(1_000, 30_000, 31_000);

    middleware(req, makeRes(), () => nextCalled++);
    middleware(req, makeRes(), () => nextCalled++);

    const blockedRes = makeRes();
    middleware(req, blockedRes, () => nextCalled++);

    expect(blockedRes._status).toBe(429);
    expect(blockedRes.headers["Retry-After"]).toBe("30");
    expect(nextCalled).toBe(2);

    nowSpy.and.callThrough();
  });

  it("tracks IPs independently", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1 });
    let nextCalled = 0;

    middleware(makeReq("1.1.1.1"), makeRes(), () => nextCalled++);
    middleware(makeReq("2.2.2.2"), makeRes(), () => nextCalled++);

    expect(nextCalled).toBe(2);
  });

  it("uses 'unknown' as key when req.ip is undefined", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1 });
    const req = { ip: undefined };
    let nextCalled = 0;

    middleware(req, makeRes(), () => nextCalled++);
    expect(nextCalled).toBe(1);

    const blockedRes = makeRes();
    middleware(req, blockedRes, () => {});
    expect(blockedRes._status).toBe(429);
  });

  it("allows requests again after the window expires", async () => {
    const middleware = rateLimit({ windowMs: 50, max: 1 });
    const req = makeReq();
    let nextCalled = 0;

    middleware(req, makeRes(), () => nextCalled++);

    const blockedRes = makeRes();
    middleware(req, blockedRes, () => nextCalled++);
    expect(blockedRes._status).toBe(429);
    expect(nextCalled).toBe(1);

    await new Promise(resolve => setTimeout(resolve, 60));

    middleware(req, makeRes(), () => nextCalled++);
    expect(nextCalled).toBe(2);
  });

  describe("invalid options", () => {
    it("throws for windowMs = 0", () => {
      expect(() => rateLimit({ windowMs: 0, max: 10 })).toThrowError(RangeError);
    });

    it("throws for negative windowMs", () => {
      expect(() => rateLimit({ windowMs: -1000, max: 10 })).toThrowError(RangeError);
    });

    it("throws for non-finite windowMs", () => {
      expect(() => rateLimit({ windowMs: Infinity, max: 10 })).toThrowError(RangeError);
    });

    it("throws for max = 0", () => {
      expect(() => rateLimit({ windowMs: 60_000, max: 0 })).toThrowError(RangeError);
    });

    it("throws for negative max", () => {
      expect(() => rateLimit({ windowMs: 60_000, max: -1 })).toThrowError(RangeError);
    });

    it("throws for non-integer max", () => {
      expect(() => rateLimit({ windowMs: 60_000, max: 1.5 })).toThrowError(RangeError);
    });
  });
});
