// GH_TOKEN (read by tokens.ts at import time) is set by tests/helpers/env.js
// before any spec loads, so the module can be imported statically.
import { requestData } from "../../../../../build/routes/github/lib/utils/rest.js";

describe("github/lib/utils/rest - requestData", () => {
  let originalFetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  const rateLimitHeaders = {
    "x-ratelimit-remaining": "4999",
    "x-ratelimit-reset": "1700000000",
    "x-ratelimit-limit": "5000",
  };

  // A JSON page response; `next` (a page number) adds a rel="next" Link header.
  function page(body, { status = 200, statusText = "OK", next } = {}) {
    const headers = new Headers(rateLimitHeaders);
    if (next) {
      headers.set("link", `<https://api.github.com/repos/w3c/respec/issues?page=${next}>; rel="next"`);
    }
    return new Response(JSON.stringify(body), { status, statusText, headers });
  }

  function mockFetch(body, opts) {
    globalThis.fetch = jasmine.createSpy("fetch").and.resolveTo(page(body, opts));
  }

  describe("endpoint URL validation (SSRF guard)", () => {
    it("rejects non-GitHub, non-HTTPS, prefix-injection, and empty URLs", async () => {
      const badURLs = [
        "https://evil.example.com/repos",
        "http://api.github.com/repos",
        "https://evil.com/?redirect=https://api.github.com/repos",
        "",
      ];
      for (const url of badURLs) {
        await expectAsync(requestData(url).next())
          .withContext(url)
          .toBeRejectedWithError(/expected https:\/\/api\.github\.com/);
      }
    });

    it("accepts a valid GitHub API URL", async () => {
      mockFetch([{ id: 1 }]);
      const { value } = await requestData(
        "https://api.github.com/search/repositories?q=respec",
      ).next();
      expect(value.result).toEqual([{ id: 1 }]);
    });
  });

  describe("pagination", () => {
    it("rejects a next link pointing to a non-GitHub domain", async () => {
      globalThis.fetch = jasmine.createSpy("fetch").and.resolveTo(
        new Response(JSON.stringify({ page: 1 }), {
          headers: new Headers({ ...rateLimitHeaders, link: '<https://evil.com/next>; rel="next"' }),
        }),
      );
      const gen = requestData("https://api.github.com/repos/w3c/respec/issues");
      expect((await gen.next()).value.result).toEqual({ page: 1 });
      await expectAsync(gen.next()).toBeRejectedWithError(/expected https:\/\/api\.github\.com/);
    });

    it("follows valid next links and stops when there are none", async () => {
      let n = 0;
      globalThis.fetch = jasmine
        .createSpy("fetch")
        .and.callFake(() => Promise.resolve(++n === 1 ? page({ page: 1 }, { next: 2 }) : page({ page: 2 })));
      const results = [];
      for await (const item of requestData("https://api.github.com/repos/w3c/respec/issues")) {
        results.push(item.result);
      }
      expect(results).toEqual([{ page: 1 }, { page: 2 }]);
    });
  });

  it("throws on non-OK responses", async () => {
    for (const [status, statusText] of [[404, "Not Found"], [500, "Internal Server Error"]]) {
      mockFetch({}, { status, statusText });
      await expectAsync(requestData("https://api.github.com/repos/x").next())
        .withContext(String(status))
        .toBeRejectedWithError(new RegExp(`Failed to fetch.*${status} ${statusText}`));
    }
  });

  it("respects the pages limit and warns when pages remain", async () => {
    let n = 0;
    globalThis.fetch = jasmine
      .createSpy("fetch")
      .and.callFake(() => Promise.resolve(page({ page: ++n }, { next: n + 1 })));
    spyOn(console, "warn");
    const results = [];
    for await (const item of requestData("https://api.github.com/repos/w3c/respec/issues", 2)) {
      results.push(item.result);
    }
    expect(results).toEqual([{ page: 1 }, { page: 2 }]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(jasmine.stringMatching(/Some pages were skipped/));
  });

  it("sends Accept and Authorization headers", async () => {
    mockFetch({});
    await requestData("https://api.github.com/repos/w3c/respec").next();
    expect(globalThis.fetch).toHaveBeenCalledOnceWith(
      "https://api.github.com/repos/w3c/respec",
      jasmine.objectContaining({
        headers: jasmine.objectContaining({
          Accept: "application/vnd.github.v3+json",
          Authorization: jasmine.stringMatching(/^token /),
        }),
      }),
    );
  });
});
