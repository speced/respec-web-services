import { requestData } from "../../../../../build/routes/github/lib/utils/rest.js";

describe("routes/github/lib/utils/rest - requestData", () => {
  it("throws for a non-GitHub API endpoint", async () => {
    const gen = requestData("https://evil.example.com/steal");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /expected https:\/\/api\.github\.com/,
    );
  });

  it("throws for an http (non-https) GitHub URL", async () => {
    const gen = requestData("http://api.github.com/repos/foo/bar");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /expected https:\/\/api\.github\.com/,
    );
  });

  it("throws for a GitHub URL that isn't the API subdomain", async () => {
    const gen = requestData("https://github.com/speced/respec");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /expected https:\/\/api\.github\.com/,
    );
  });

  it("throws for an empty string endpoint", async () => {
    const gen = requestData("");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /expected https:\/\/api\.github\.com/,
    );
  });

  it("throws for a URL with github.com as username (URL confusion)", async () => {
    const gen = requestData("https://api.github.com@evil.com/path");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /expected https:\/\/api\.github\.com/,
    );
  });

  it("throws for a blob: URL with matching origin", async () => {
    const gen = requestData("blob:https://api.github.com/some-uuid");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /expected https:\/\/api\.github\.com/,
    );
  });

  it("throws for a data: URL", async () => {
    const gen = requestData("data:text/html,<h1>hi</h1>");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /expected https:\/\/api\.github\.com/,
    );
  });

  it("accepts a valid GitHub API URL", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        "x-ratelimit-remaining": "10",
        "x-ratelimit-reset": "9999999999",
        "x-ratelimit-limit": "60",
      },
    });
    try {
      const gen = requestData("https://api.github.com/repos/w3c/respec/issues");
      const { value } = await gen.next();
      expect(value.url).toBe("https://api.github.com/repos/w3c/respec/issues");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("rejects a malicious pagination URL in Link header", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        link: '<https://evil.com/page2>; rel="next"',
        "x-ratelimit-remaining": "10",
        "x-ratelimit-reset": "9999999999",
        "x-ratelimit-limit": "60",
      },
    });
    try {
      const gen = requestData("https://api.github.com/repos/w3c/respec/issues");
      await gen.next();
      await expectAsync(gen.next()).toBeRejectedWithError(
        /expected https:\/\/api\.github\.com/,
      );
    } finally {
      globalThis.fetch = original;
    }
  });
});
