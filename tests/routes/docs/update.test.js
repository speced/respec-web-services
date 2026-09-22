let regenerateDocs;
let route;

const SPEC_GENERATOR = "https://www.w3.org/publications/spec-generator/";

/** The generator answers 200 even when ReSpec found errors; the counts arrive in headers. */
function generatorResponse(headers) {
  return new Response("<html></html>", { status: 200, headers });
}

function generatorRefusal(error, status = 500) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeExpressResponse() {
  return {
    status() {
      return this;
    },
    send() {
      return this;
    },
    sendStatus() {
      return this;
    },
  };
}

/** Returns the error a promise rejects with, and fails the spec if it resolves. */
async function catchError(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected regenerateDocs to reject, but it resolved.");
}

function answerWith(response) {
  spyOn(globalThis, "fetch").and.resolveTo(response);
}

beforeAll(async () => {
  const mod = await import("../../../build/routes/docs/update.js");
  regenerateDocs = mod.regenerateDocs;
  route = mod.default;
});

describe("routes/docs/update regenerateDocs()", () => {
  it("reports the error and warning counts the generator actually returned", async () => {
    answerWith(
      generatorResponse({ "x-errors-count": "3", "x-warnings-count": "7" }),
    );

    const error = await catchError(regenerateDocs());

    expect(error.message).toContain("3 errors");
    expect(error.message).toContain("7 warnings");
  });

  it("names the document that failed, so the log identifies it without reading the source", async () => {
    answerWith(
      generatorResponse({ "x-errors-count": "1", "x-warnings-count": "0" }),
    );

    const error = await catchError(regenerateDocs());

    expect(error.message).toContain("https://respec.org/docs/src.html");
    expect(error.message).toContain("npx respec");
  });

  it("says zero warnings when the generator omits that header", async () => {
    answerWith(generatorResponse({ "x-errors-count": "2" }));

    const error = await catchError(regenerateDocs());

    expect(error.message).toContain("0 warnings");
  });

  it("writes singular nouns for a single error and a single warning", async () => {
    answerWith(
      generatorResponse({ "x-errors-count": "1", "x-warnings-count": "1" }),
    );

    const error = await catchError(regenerateDocs());

    expect(error.message).toContain("1 error and 1 warning in");
    expect(error.message).not.toContain("1 errors");
    expect(error.message).not.toContain("1 warnings");
  });

  it("surfaces the generator's own status and error when it refuses the request", async () => {
    answerWith(generatorRefusal("unknown spec generator type", 502));

    const error = await catchError(regenerateDocs());

    expect(error.statusCode).toBe(502);
    expect(error.message).toBe("unknown spec generator type");
  });

  it("asks the generator for the docs source as respec", async () => {
    answerWith(generatorResponse({ "x-errors-count": "1" }));

    await catchError(regenerateDocs());

    const url = new URL(globalThis.fetch.calls.mostRecent().args[0]);
    expect(url.origin + url.pathname).toBe(SPEC_GENERATOR);
    expect(url.searchParams.get("type")).toBe("respec");
    expect(url.searchParams.get("url")).toBe(
      "https://respec.org/docs/src.html",
    );
  });
});

describe("routes/docs/update route()", () => {
  it("logs a short failure whole, with no trailing ellipsis", async () => {
    answerWith(generatorRefusal("spec generator is down"));
    spyOn(console, "error");

    await route({}, fakeExpressResponse());

    expect(console.error).toHaveBeenCalledWith(
      "Failed to regenerate docs: spec generator is down",
    );
  });

  it("truncates a failure longer than 400 characters and marks it with one ellipsis", async () => {
    answerWith(generatorRefusal("x".repeat(500)));
    spyOn(console, "error");

    await route({}, fakeExpressResponse());

    const line = console.error.calls.mostRecent().args[0];
    expect(line.endsWith("...")).toBe(true);
    expect(line).toContain("x".repeat(400));
    expect(line).not.toContain("x".repeat(401));
  });
});
