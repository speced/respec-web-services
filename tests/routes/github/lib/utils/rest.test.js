import { requestData } from "../../../../../build/routes/github/lib/utils/rest.js";

describe("routes/github/lib/utils/rest - requestData", () => {
  it("throws for a non-GitHub API endpoint", async () => {
    const gen = requestData("https://evil.example.com/steal");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /endpoint origin must be https:\/\/api\.github\.com/,
    );
  });

  it("throws for an http (non-https) GitHub URL", async () => {
    const gen = requestData("http://api.github.com/repos/foo/bar");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /endpoint origin must be https:\/\/api\.github\.com/,
    );
  });

  it("throws for a GitHub URL that isn't the API subdomain", async () => {
    const gen = requestData("https://github.com/speced/respec");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /endpoint origin must be https:\/\/api\.github\.com/,
    );
  });

  it("throws for an empty string endpoint", async () => {
    const gen = requestData("");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /endpoint origin must be https:\/\/api\.github\.com/,
    );
  });

  it("throws for a URL with github.com as username (URL confusion)", async () => {
    const gen = requestData("https://api.github.com@evil.com/path");
    await expectAsync(gen.next()).toBeRejectedWithError(
      /endpoint origin must be https:\/\/api\.github\.com/,
    );
  });
});
