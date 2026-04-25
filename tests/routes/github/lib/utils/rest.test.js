// Set env before importing the module (tokens.ts reads GH_TOKEN at import time)
process.env.GH_TOKEN ??= "test-token-for-rest-tests";

const { requestData } = await import(
  "../../../../../build/routes/github/lib/utils/rest.js"
);

describe("github/lib/utils/rest - requestData", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * Creates a mock fetch that returns a single page of JSON data.
   * @param {object} [options]
   * @param {object} [options.json] - JSON body to return
   * @param {number} [options.status] - HTTP status code
   * @param {string} [options.statusText] - HTTP status text
   * @param {string} [options.linkHeader] - Link header value
   * @param {Record<string, string>} [options.extraHeaders] - Additional headers
   */
  function mockFetch({
    json = { ok: true },
    status = 200,
    statusText = "OK",
    linkHeader = "",
    extraHeaders = {},
  } = {}) {
    const headers = new Headers({
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-reset": "1700000000",
      "x-ratelimit-limit": "5000",
      ...extraHeaders,
    });
    if (linkHeader) {
      headers.set("link", linkHeader);
    }

    globalThis.fetch = jasmine
      .createSpy("fetch")
      .and.resolveTo(
        new Response(JSON.stringify(json), { status, statusText, headers }),
      );
  }

  // -- URL validation / SSRF guard --

  describe("endpoint URL validation (SSRF guard)", () => {
    it("rejects a non-GitHub URL", async () => {
      const gen = requestData("https://evil.example.com/repos");
      await expectAsync(gen.next()).toBeRejectedWithError(
        /expected https:\/\/api\.github\.com/,
      );
    });

    it("rejects an HTTP (non-HTTPS) GitHub URL", async () => {
      const gen = requestData("http://api.github.com/repos");
      await expectAsync(gen.next()).toBeRejectedWithError(
        /expected https:\/\/api\.github\.com/,
      );
    });

    it("rejects a URL that contains the prefix but doesn't start with it", async () => {
      const gen = requestData(
        "https://evil.com/?redirect=https://api.github.com/repos",
      );
      await expectAsync(gen.next()).toBeRejectedWithError(
        /expected https:\/\/api\.github\.com/,
      );
    });

    it("rejects an empty string", async () => {
      const gen = requestData("");
      await expectAsync(gen.next()).toBeRejectedWithError(
        /expected https:\/\/api\.github\.com/,
      );
    });

    it("accepts a valid GitHub API URL", async () => {
      mockFetch({ json: [{ id: 1 }] });

      const gen = requestData("https://api.github.com/repos/user/repo");
      const { value, done } = await gen.next();
      expect(done).toBeFalse();
      expect(value.result).toEqual([{ id: 1 }]);
    });

    it("accepts a GitHub API URL with path and query params", async () => {
      mockFetch({ json: { total: 42 } });

      const gen = requestData(
        "https://api.github.com/search/repositories?q=respec&per_page=100",
      );
      const { value } = await gen.next();
      expect(value.result).toEqual({ total: 42 });
    });
  });

  // -- Pagination URL validation --

  describe("pagination link validation", () => {
    it("rejects a pagination link pointing to a non-GitHub domain", async () => {
      mockFetch({
        json: { page: 1 },
        linkHeader: '<https://evil.com/next>; rel="next"',
      });

      const gen = requestData(
        "https://api.github.com/repos/w3c/respec/issues",
      );
      // First yield succeeds (the initial fetch is valid)
      const first = await gen.next();
      expect(first.value.result).toEqual({ page: 1 });

      // The generator throws when it processes the malicious Link header,
      // which surfaces on the next .next() call after the yield.
      await expectAsync(gen.next()).toBeRejectedWithError(
        /expected https:\/\/api\.github\.com/,
      );
    });

    it("follows valid GitHub pagination links", async () => {
      const page1Headers = new Headers({
        "x-ratelimit-remaining": "4999",
        "x-ratelimit-reset": "1700000000",
        "x-ratelimit-limit": "5000",
        link: '<https://api.github.com/repos/w3c/respec/issues?page=2>; rel="next"',
      });
      const page2Headers = new Headers({
        "x-ratelimit-remaining": "4998",
        "x-ratelimit-reset": "1700000000",
        "x-ratelimit-limit": "5000",
      });

      let callCount = 0;
      globalThis.fetch = jasmine.createSpy("fetch").and.callFake(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ page: 1 }), {
              status: 200,
              headers: page1Headers,
            }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ page: 2 }), {
            status: 200,
            headers: page2Headers,
          }),
        );
      });

      const gen = requestData(
        "https://api.github.com/repos/w3c/respec/issues",
      );
      const first = await gen.next();
      expect(first.value.result).toEqual({ page: 1 });

      const second = await gen.next();
      expect(second.value.result).toEqual({ page: 2 });

      // No more pages
      const third = await gen.next();
      expect(third.done).toBeTrue();
    });

    it("stops when there is no next page link", async () => {
      mockFetch({ json: { only: "page" } });

      const gen = requestData("https://api.github.com/repos/w3c/respec");
      const first = await gen.next();
      expect(first.value.result).toEqual({ only: "page" });

      const second = await gen.next();
      expect(second.done).toBeTrue();
    });
  });

  // -- HTTP error handling --

  describe("HTTP error handling", () => {
    it("throws on non-OK response", async () => {
      mockFetch({ status: 404, statusText: "Not Found", json: {} });

      const gen = requestData("https://api.github.com/repos/nonexistent");
      await expectAsync(gen.next()).toBeRejectedWithError(
        /Failed to fetch.*404 Not Found/,
      );
    });

    it("throws on 500 server error", async () => {
      mockFetch({
        status: 500,
        statusText: "Internal Server Error",
        json: {},
      });

      const gen = requestData("https://api.github.com/repos/w3c/respec");
      await expectAsync(gen.next()).toBeRejectedWithError(
        /Failed to fetch.*500 Internal Server Error/,
      );
    });
  });

  // -- Page limit --

  describe("page limit", () => {
    it("respects the pages argument", async () => {
      // Create a fetch that always returns a next page link
      let callCount = 0;
      globalThis.fetch = jasmine.createSpy("fetch").and.callFake(() => {
        callCount++;
        const headers = new Headers({
          "x-ratelimit-remaining": String(5000 - callCount),
          "x-ratelimit-reset": "1700000000",
          "x-ratelimit-limit": "5000",
          link: `<https://api.github.com/repos/w3c/respec/issues?page=${callCount + 1}>; rel="next"`,
        });
        return Promise.resolve(
          new Response(JSON.stringify({ page: callCount }), {
            status: 200,
            headers,
          }),
        );
      });

      // Request only 2 pages
      const gen = requestData(
        "https://api.github.com/repos/w3c/respec/issues",
        2,
      );
      const results = [];
      for await (const item of gen) {
        results.push(item.result);
      }
      expect(results).toEqual([{ page: 1 }, { page: 2 }]);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // -- Request headers --

  describe("request headers", () => {
    it("sends Accept and Authorization headers", async () => {
      mockFetch({ json: {} });

      const gen = requestData("https://api.github.com/repos/w3c/respec");
      await gen.next();

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
});
