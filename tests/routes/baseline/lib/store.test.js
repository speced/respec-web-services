import { normalizeUrl } from "../../../../build/routes/api/baseline/lib/store.js";

describe("routes/api/baseline/lib/store - normalizeUrl", () => {
  it("removes URL fragment (hash)", () => {
    expect(normalizeUrl("https://example.com/path#section")).toBe(
      "https://example.com/path/",
    );
  });

  it("removes URL search params (query string)", () => {
    expect(normalizeUrl("https://example.com/path?foo=bar&baz=1")).toBe(
      "https://example.com/path/",
    );
  });

  it("removes both fragment and search params", () => {
    expect(normalizeUrl("https://example.com/path?q=1#section")).toBe(
      "https://example.com/path/",
    );
  });

  it("adds trailing slash for directory-like paths", () => {
    expect(normalizeUrl("https://example.com/path")).toBe(
      "https://example.com/path/",
    );
  });

  it("does not add trailing slash for file paths with extension", () => {
    expect(normalizeUrl("https://example.com/spec.html")).toBe(
      "https://example.com/spec.html",
    );
  });

  it("preserves existing trailing slash", () => {
    expect(normalizeUrl("https://example.com/path/")).toBe(
      "https://example.com/path/",
    );
  });

  it("returns unchanged input for invalid URLs", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });
});
