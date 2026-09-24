import { EventEmitter } from "node:events";

import { createRequest, createResponse } from "node-mocks-http";

import bibrefs from "#routes/bibrefs/index.ts";
import { store } from "#routes/bibrefs/lib/store-init.ts";

type BibrefsRequest = Parameters<typeof bibrefs>[0];
type BibrefsResponse = Parameters<typeof bibrefs>[1];

type Query = Record<string, string>;

function send(query: Query, ip: string) {
  return new Promise(resolve => {
    const req = createRequest<BibrefsRequest>({
      method: "GET",
      url: "/",
      originalUrl: "/bibrefs",
      query,
      ip,
      ips: [],
      headers: {},
      app: { get: () => undefined },
    });
    const res = createResponse<BibrefsResponse>({ eventEmitter: EventEmitter });
    res.sendFile = (() => {
      resolve(res);
      return res;
    }) as BibrefsResponse["sendFile"];
    res.on("end", () => resolve(res));
    bibrefs(req, res, () => resolve(res));
  });
}

/** @returns the 1-based request number that first got a 429, or null. */
async function firstRejection(query: Query, ip: string, attempts: number) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { statusCode } = (await send(query, ip)) as { statusCode: number };
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
