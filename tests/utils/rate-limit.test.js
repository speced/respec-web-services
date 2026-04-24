import { rateLimit } from "../../build/utils/rate-limit.js";

describe("utils/rate-limit", () => {
  it("exports a function", () => {
    expect(typeof rateLimit).toBe("function");
  });

  it("returns middleware when called with valid options", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 10 });
    expect(typeof middleware).toBe("function");
  });
});
