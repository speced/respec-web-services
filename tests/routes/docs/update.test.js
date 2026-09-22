let regenerateDocs;
let route;
let origFetch;

const SPEC_GENERATOR = "https://www.w3.org/publications/spec-generator/";

/** The generator answers 200 even when ReSpec found errors; the counts arrive in headers. */
function generatorResponse(headers) {
  return new Response("<html></html>", { status: 200, headers });
}

/** A generator refusal, which route() turns into a logged line and a response. */
function generatorRefusal(error) {
  return new Response(JSON.stringify({ error }), {
    status: 500,
    headers: { "content-type": "application/json" },
  });
}

/** Records what route() puts on the response, which is otherwise unobservable. */
function fakeExpressResponse() {
  return {
    statusCode: 0,
    body: "",
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    sendStatus(code) {
      this.statusCode = code;
      return this;
    },
  };
}

/** Runs route() and returns every line it passed to console.error. */
async function logsFromRoute() {
  const lines = [];
  const original = console.error;
  console.error = line => lines.push(line);
  try {
    await route({}, fakeExpressResponse());
  } finally {
    console.error = original;
  }
  return lines;
}

beforeAll(async () => {
  const mod = await import("../../../build/routes/docs/update.js");
  regenerateDocs = mod.regenerateDocs;
  route = mod.default;
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
      // the specs above cover the throw; this one only inspects the request
    }

    const url = new URL(requested);
    expect(url.origin + url.pathname).toBe(SPEC_GENERATOR);
    expect(url.searchParams.get("type")).toBe("respec");
    expect(url.searchParams.get("url")).toBe(
      "https://respec.org/docs/src.html",
    );
  });

  it("surfaces the generator's own status and error when it refuses the request", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "unknown spec generator type" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });

    let caught;
    try {
      await regenerateDocs();
    } catch (error) {
      caught = error;
    }

    expect(caught.statusCode).toBe(502);
    expect(caught.message).toBe("unknown spec generator type");
  });

  it("writes singular nouns for a single error and a single warning", async () => {
    globalThis.fetch = async () =>
      generatorResponse({ "x-errors-count": "1", "x-warnings-count": "1" });

    let message = "";
    try {
      await regenerateDocs();
    } catch (error) {
      message = error.message;
    }

    expect(message).toContain("1 error and 1 warning in");
    expect(message).not.toContain("1 errors");
    expect(message).not.toContain("1 warnings");
  });
});

describe("routes/docs/update route()", () => {
  it("logs a short failure whole, with no trailing ellipsis", async () => {
    globalThis.fetch = async () => generatorRefusal("spec generator is down");

    const [line] = await logsFromRoute();

    expect(line).toBe("Failed to regenerate docs: spec generator is down");
  });

  it("truncates a failure longer than 400 characters and marks it with one ellipsis", async () => {
    globalThis.fetch = async () => generatorRefusal("x".repeat(500));

    const [line] = await logsFromRoute();

    expect(line.endsWith("...")).toBe(true);
    expect(line).toContain("x".repeat(400));
    expect(line).not.toContain("x".repeat(401));
  });
});
