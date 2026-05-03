import { HTTPError } from "../../build/utils/misc.js";

describe("HTTPError", () => {
  it("has statusCode and message properties", () => {
    const error = new HTTPError(404, "Not found");
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Not found");
    expect(error).toBeInstanceOf(Error);
  });

  it("supports optional url property", () => {
    const error = new HTTPError(500, "Server error", "https://example.com");
    expect(error.url).toBe("https://example.com");
  });

  it("defaults url to undefined when not provided", () => {
    const error = new HTTPError(400, "Bad request");
    expect(error.url).toBeUndefined();
  });
});
