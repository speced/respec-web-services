let regenerateDocs;
let origFetch;

const SPEC_GENERATOR = "https://www.w3.org/publications/spec-generator/";

/** Build a spec-generator response carrying only the count headers it really sends. */
function generatorResponse(headers) {
  return new Response("<html></html>", { status: 200, headers });
}

beforeAll(async () => {
  const mod = await import("../../../build/routes/docs/update.js");
  regenerateDocs = mod.regenerateDocs;
});

beforeEach(() => {
  origFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = origFetch;
});

describe("routes/docs/update regenerateDocs()", () => {
  it("reports the error and warning counts the generator actually returned", async () => {
    globalThis.fetch = async () =>
      generatorResponse({ "x-errors-count": "3", "x-warnings-count": "7" });

    let message = "";
    try {
      await regenerateDocs();
    } catch (error) {
      message = error.message;
    }

    expect(message).toContain("3 errors");
    expect(message).toContain("7 warnings");
  });

  it("names the document that failed, so the log identifies it without reading the source", async () => {
    globalThis.fetch = async () =>
      generatorResponse({ "x-errors-count": "1", "x-warnings-count": "0" });

    let message = "";
    try {
      await regenerateDocs();
    } catch (error) {
      message = error.message;
    }

    expect(message).toContain("https://respec.org/docs/src.html");
    expect(message).toContain("npx respec");
  });

  it("says zero warnings when the generator omits that header", async () => {
    globalThis.fetch = async () => generatorResponse({ "x-errors-count": "2" });

    let message = "";
    try {
      await regenerateDocs();
    } catch (error) {
      message = error.message;
    }

    expect(message).toContain("0 warnings");
  });

  it("asks the generator for the docs source as respec", async () => {
    let requested = "";
    globalThis.fetch = async href => {
      requested = href;
      return generatorResponse({ "x-errors-count": "1" });
    };

    try {
      await regenerateDocs();
    } catch {
      // the throw is asserted elsewhere; this spec is about the request
    }

    const url = new URL(requested);
    expect(url.origin + url.pathname).toBe(SPEC_GENERATOR);
    expect(url.searchParams.get("type")).toBe("respec");
    expect(url.searchParams.get("url")).toBe(
      "https://respec.org/docs/src.html",
    );
  });
});
