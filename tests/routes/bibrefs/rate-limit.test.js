import bibrefs from "../../../build/routes/bibrefs/index.js";
import { store } from "../../../build/routes/bibrefs/lib/store-init.js";

/**
 * Drives the real router, middleware included, because the rate limits live in
 * middleware that calling the handler directly would skip.
 */
function send(query, ip) {
  return new Promise(resolve => {
    const res = {
      locals: {},
      statusCode: 200,
      headersSent: false,
      set() {
        return this;
      },
      setHeader() {
        return this;
      },
      getHeader() {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      sendStatus(code) {
        this.statusCode = code;
        resolve(this);
        return this;
      },
      json() {
        resolve(this);
        return this;
      },
      jsonp() {
        resolve(this);
        return this;
      },
      send() {
        resolve(this);
        return this;
      },
      type() {
        return this;
      },
      sendFile() {
        this.sentFile = true;
        resolve(this);
        return this;
      },
      end() {
        resolve(this);
        return this;
      },
    };
    const req = {
      method: "GET",
      url: "/",
      originalUrl: "/bibrefs",
      query,
      ip,
      ips: [],
      headers: {},
      get: () => undefined,
      app: { get: () => undefined },
    };
    bibrefs(req, res, () => resolve(res));
  });
}

/** @returns the 1-based request number that first got a 429, or null. */
async function firstRejection(query, ip, attempts) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { statusCode } = await send(query, ip);
    if (statusCode === 429) return attempt;
  }
  return null;
}

describe("routes/bibrefs - rate limits", () => {
  beforeEach(() => {
    store.degraded = false;
    store.references = { WEBIDL: { title: "Web IDL", id: "WEBIDL" } };
  });

  afterEach(() => {
    store.degraded = true;
    store.references = {};
  });

  // Each spec needs its own address: the limiter counts per address and its
  // state outlives a spec.
  it("cuts off whole-store requests well before a lookup would be cut off", async () => {
    expect(await firstRejection({}, "203.0.113.1", 25)).toBe(21);
  });

  it("does not spend the whole-store budget on lookups", async () => {
    expect(
      await firstRejection({ refs: "WEBIDL" }, "203.0.113.2", 30),
    ).toBeNull();
  });

  it("keeps the two budgets independent", async () => {
    const address = "203.0.113.3";
    // Spend the whole-store budget, then show the lookup budget is untouched:
    // the first lookup refused is still the one past the lookup limit itself.
    expect(await firstRejection({}, address, 21)).toBe(21);
    expect(await firstRejection({ refs: "WEBIDL" }, address, 121)).toBe(121);
  });
});
