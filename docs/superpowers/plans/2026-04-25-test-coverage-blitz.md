# Test Coverage Blitz — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring respec-web-services from ~10% test coverage to comprehensive coverage across all security-critical, infrastructure, and business-logic code, organized as 5 focused PRs.

**Architecture:** Pure unit tests using Jasmine (existing framework). No supertest for now — test exported functions directly by importing from `build/`. Each PR is independently mergeable and adds value on its own. Security-critical code first.

**Tech Stack:** Jasmine 6.2, ES modules, TypeScript → build/ imports, Node 24

---

## PR Overview

| PR | Scope | Priority | Effort | Files |
|----|-------|----------|--------|-------|
| 1 | Core utilities (env, seconds, ms, MemCache, DiskCache) | P1 | Small | 3 test files |
| 2 | Security (webhook auth, token masking, path traversal) | P1 | Small | 2 test files |
| 3 | xref routes (meta, update, textVariations) | P2 | Medium | 2 test files |
| 4 | caniuse + w3c routes (feature lookup, group handler) | P2 | Medium | 2 test files |
| 5 | GitHub + respec routes (contributors, issues, size) | P3 | Medium | 2 test files |

---

## PR 1: Core Utilities — `test/core-utils`

### Task 1: misc.ts — env(), seconds(), ms(), HTTPError

**Files:**
- Create: `tests/utils/misc.test.js`
- Tested: `build/utils/misc.js` (source: `utils/misc.ts`)

- [ ] **Step 1: Write env() tests**

```javascript
import { env, seconds, ms, HTTPError } from "../../build/utils/misc.js";

describe("utils/misc", () => {
  describe("env()", () => {
    it("returns the value of a set env variable", () => {
      process.env.TEST_MISC_VAR = "hello";
      expect(env("TEST_MISC_VAR")).toBe("hello");
      delete process.env.TEST_MISC_VAR;
    });

    it("throws when env variable is not set", () => {
      expect(() => env("DEFINITELY_NOT_SET_12345")).toThrow();
    });

    it("throws when env variable is empty string", () => {
      process.env.TEST_EMPTY = "";
      expect(() => env("TEST_EMPTY")).toThrow();
      delete process.env.TEST_EMPTY;
    });
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm build && pnpm test`
Expected: new specs pass alongside existing 28

- [ ] **Step 3: Add seconds() tests**

```javascript
  describe("seconds()", () => {
    it("parses seconds", () => {
      expect(seconds("1s")).toBe(1);
      expect(seconds("30s")).toBe(30);
    });

    it("parses minutes", () => {
      expect(seconds("1m")).toBe(60);
      expect(seconds("1.5m")).toBe(90);
    });

    it("parses hours", () => {
      expect(seconds("1h")).toBe(3600);
      expect(seconds("24h")).toBe(86400);
    });

    it("parses days", () => {
      expect(seconds("1d")).toBe(86400);
      expect(seconds("7d")).toBe(604800);
    });

    it("parses weeks", () => {
      expect(seconds("1w")).toBe(604800);
    });

    it("handles space between number and unit", () => {
      expect(seconds("1 m")).toBe(60);
    });

    it("handles decimal values", () => {
      expect(seconds("0.5h")).toBe(1800);
    });
  });
```

- [ ] **Step 4: Add ms() tests**

```javascript
  describe("ms()", () => {
    it("returns milliseconds", () => {
      expect(ms("1s")).toBe(1000);
      expect(ms("1m")).toBe(60_000);
      expect(ms("1h")).toBe(3_600_000);
      expect(ms("1d")).toBe(86_400_000);
    });
  });
```

- [ ] **Step 5: Add HTTPError tests**

```javascript
  describe("HTTPError", () => {
    it("is an instance of Error", () => {
      const err = new HTTPError(404, "not found");
      expect(err instanceof Error).toBeTrue();
    });

    it("has statusCode and message", () => {
      const err = new HTTPError(500, "broken");
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("broken");
    });

    it("optionally includes url", () => {
      const err = new HTTPError(404, "nope", "https://example.com");
      expect(err.url).toBe("https://example.com");
    });
  });
```

- [ ] **Step 6: Run tests, verify all pass**

Run: `pnpm build && pnpm test`

- [ ] **Step 7: Commit**

```
git add tests/utils/misc.test.js
git commit -m "test(utils): add tests for env, seconds, ms, HTTPError"
```

---

### Task 2: MemCache

**Files:**
- Create: `tests/utils/mem-cache.test.js`
- Tested: `build/utils/mem-cache.js` (source: `utils/mem-cache.ts`)

- [ ] **Step 1: Write core MemCache tests**

```javascript
import { MemCache } from "../../build/utils/mem-cache.js";

describe("utils/mem-cache", () => {
  describe("set/get", () => {
    it("stores and retrieves a value", () => {
      const cache = new MemCache(10_000);
      cache.set("key", "value");
      expect(cache.get("key")).toBe("value");
    });

    it("returns undefined for missing key", () => {
      const cache = new MemCache(10_000);
      expect(cache.get("nope")).toBeUndefined();
    });
  });

  describe("TTL expiry", () => {
    it("returns undefined after TTL expires", () => {
      const cache = new MemCache(1); // 1ms TTL
      cache.set("key", "value", Date.now() - 10); // set in the past
      expect(cache.get("key")).toBeUndefined();
    });

    it("returns stale value when allowStale is true", () => {
      const cache = new MemCache(1);
      cache.set("key", "value", Date.now() - 10);
      expect(cache.get("key", true)).toBe("value");
    });
  });

  describe("has()", () => {
    it("returns true for existing non-expired key", () => {
      const cache = new MemCache(10_000);
      cache.set("key", "value");
      expect(cache.has("key")).toBeTrue();
    });

    it("returns false for missing key", () => {
      const cache = new MemCache(10_000);
      expect(cache.has("nope")).toBeFalse();
    });
  });

  describe("getOr()", () => {
    it("returns cached value if present", () => {
      const cache = new MemCache(10_000);
      cache.set("key", "cached");
      const result = cache.getOr("key", () => "fresh");
      expect(result).toBe("cached");
    });

    it("calls default function and caches result if missing", () => {
      const cache = new MemCache(10_000);
      const result = cache.getOr("key", () => "fresh");
      expect(result).toBe("fresh");
      expect(cache.get("key")).toBe("fresh");
    });
  });

  describe("delete()", () => {
    it("removes a key", () => {
      const cache = new MemCache(10_000);
      cache.set("key", "value");
      cache.delete("key");
      expect(cache.has("key")).toBeFalse();
    });
  });

  describe("clear()", () => {
    it("removes all keys", () => {
      const cache = new MemCache(10_000);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.clear();
      expect(cache.has("a")).toBeFalse();
      expect(cache.has("b")).toBeFalse();
    });
  });

  describe("expires()", () => {
    it("returns positive ms for non-expired key", () => {
      const cache = new MemCache(60_000);
      cache.set("key", "value");
      expect(cache.expires("key")).toBeGreaterThan(0);
    });
  });

  describe("invalidate()", () => {
    it("removes expired entries and returns their keys", () => {
      const cache = new MemCache(1);
      cache.set("old", "value", Date.now() - 100);
      cache.set("new", "value");
      const expired = cache.invalidate();
      expect(expired).toContain("old");
      expect(cache.has("old")).toBeFalse();
    });
  });
});
```

- [ ] **Step 2: Run tests, verify all pass**
- [ ] **Step 3: Commit**

```
git add tests/utils/mem-cache.test.js
git commit -m "test(utils): add comprehensive MemCache tests"
```

---

### Task 3: DiskCache

**Files:**
- Create: `tests/utils/disk-cache.test.js`
- Tested: `build/utils/disk-cache.js` (source: `utils/disk-cache.ts`)

- [ ] **Step 1: Write DiskCache tests**

```javascript
import { DiskCache } from "../../build/utils/disk-cache.js";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

describe("utils/disk-cache", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), "disk-cache-test-"));
    process.env.DATA_DIR = tmpDir;
  });

  afterEach(async () => {
    delete process.env.DATA_DIR;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("stores and retrieves a value", async () => {
    const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
    await cache.set("key1", { data: "hello" });
    const result = await cache.get("key1");
    expect(result).toEqual({ data: "hello" });
  });

  it("returns undefined for missing key", async () => {
    const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
    const result = await cache.get("nonexistent");
    expect(result).toBeUndefined();
  });

  it("rejects path traversal attempts in keys", async () => {
    const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
    await expectAsync(
      cache.set("../../../etc/passwd", "evil")
    ).toBeRejected();
  });

  it("rejects keys with slashes", async () => {
    const cache = new DiskCache({ ttl: 60_000, path: "test-cache" });
    await expectAsync(
      cache.set("foo/bar", "evil")
    ).toBeRejected();
  });
});
```

Note: Read `utils/disk-cache.ts` to verify exactly how path traversal is prevented, and write the test assertions to match the actual implementation (it may throw, return undefined, or sanitize).

- [ ] **Step 2: Run tests, verify all pass**
- [ ] **Step 3: Commit**

```
git add tests/utils/disk-cache.test.js
git commit -m "test(utils): add DiskCache tests including path traversal guard"
```

---

## PR 2: Security-Critical Code — `test/security`

### Task 4: Webhook Authentication

**Files:**
- Create: `tests/utils/auth-github-webhook.test.js`
- Tested: `build/utils/auth-github-webhook.js`

- [ ] **Step 1: Read the source** to understand exact HMAC verification logic

Read `utils/auth-github-webhook.ts` carefully. Note:
- How the signature header is named (`X-Hub-Signature`)
- The HMAC algorithm used (SHA-1)
- How the body is parsed
- What happens on invalid/missing signature

- [ ] **Step 2: Write auth tests**

```javascript
import { createHmac } from "crypto";
import authGithubWebhook from "../../build/utils/auth-github-webhook.js";

describe("utils/auth-github-webhook", () => {
  const SECRET = "test-secret-123";

  function makeSignature(body, secret) {
    const hmac = createHmac("sha1", secret);
    hmac.update(body);
    return `sha1=${hmac.digest("hex")}`;
  }

  // Create mock req/res/next for testing the middleware
  function mockReq(body, signature) {
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    const rawBody = Buffer.from(bodyStr);
    return {
      body: rawBody,
      get(header) {
        if (header === "X-Hub-Signature") return signature;
        if (header === "Content-Type") return "application/json";
        return undefined;
      },
      headers: {
        "x-hub-signature": signature,
        "content-type": "application/json",
      },
    };
  }

  function mockRes() {
    let statusCode = 200;
    let body = "";
    return {
      status(code) { statusCode = code; return this; },
      send(b) { body = b; return this; },
      sendStatus(code) { statusCode = code; return this; },
      _status: () => statusCode,
      _body: () => body,
    };
  }

  // Note: authGithubWebhook returns middleware array.
  // The actual verification middleware is the last element.
  // Adapt these tests after reading the exact source code.

  it("returns a middleware function or array", () => {
    const middleware = authGithubWebhook(SECRET);
    expect(middleware).toBeDefined();
  });

  // Add more specific tests after reading source for exact behavior:
  // - Valid signature passes (calls next())
  // - Invalid signature rejects (returns 401/403)
  // - Missing signature header rejects
  // - Tampered body fails verification
  // - Body is parsed as JSON after verification
});
```

- [ ] **Step 3: Run tests, refine based on actual middleware shape**
- [ ] **Step 4: Commit**

```
git add tests/utils/auth-github-webhook.test.js
git commit -m "test(security): add webhook HMAC authentication tests"
```

---

### Task 5: GitHub Token Security

**Files:**
- Create: `tests/routes/github/lib/utils/tokens.test.js`
- Tested: `build/routes/github/lib/utils/tokens.js`

- [ ] **Step 1: Read source** `routes/github/lib/utils/tokens.ts`

Understand: token cycling, rate limit tracking, `secureToken()` masking.

- [ ] **Step 2: Write token masking test**

```javascript
// After reading the source, test that:
// - secureToken() masks all but last 4 chars
// - getLimits() output never contains full tokens
// - getToken() cycles through available tokens
// - Rate limit tracking works correctly
```

- [ ] **Step 3: Run tests, verify pass**
- [ ] **Step 4: Commit**

```
git add tests/routes/github/lib/utils/tokens.test.js
git commit -m "test(security): add GitHub token management tests"
```

---

## PR 3: xref Route Tests — `test/xref-routes`

### Task 6: xref meta endpoint

**Files:**
- Create: `tests/routes/xref/meta.test.js`
- Tested: `build/routes/xref/meta.js`

- [ ] **Step 1: Read source** `routes/xref/meta.ts`

Understand what fields are returned, how `:field` param selects subsets.

- [ ] **Step 2: Write meta tests**

Test each field path: `/meta`, `/meta/version`, `/meta/types`, `/meta/specs`, `/meta/terms`.
Use a mock store object.

- [ ] **Step 3: Run tests, verify pass**
- [ ] **Step 4: Commit**

---

### Task 7: xref textVariations

**Files:**
- Create: `tests/routes/xref/lib/text-variations.test.js`
- Tested: `build/routes/xref/lib/utils.js` (`textVariations` export)

- [ ] **Step 1: Write textVariations tests**

```javascript
import { textVariations } from "../../../../build/routes/xref/lib/utils.js";

describe("xref - textVariations", () => {
  it("generates plural form", () => {
    const variations = [...textVariations("event")];
    expect(variations).toContain("events");
  });

  it("generates singular from plural", () => {
    const variations = [...textVariations("events")];
    expect(variations).toContain("event");
  });

  it("handles -ing suffix", () => {
    const variations = [...textVariations("parsing")];
    expect(variations).toContain("parse");
  });

  it("handles -ed suffix", () => {
    const variations = [...textVariations("parsed")];
    expect(variations).toContain("parse");
  });

  it("handles -ies/-y alternation", () => {
    const variations = [...textVariations("entry")];
    expect(variations).toContain("entries");
  });
});
```

- [ ] **Step 2: Run tests, verify pass. Remove istanbul ignore comment if all paths covered.**
- [ ] **Step 3: Commit**

---

### Task 8: xref update webhook

**Files:**
- Create: `tests/routes/xref/update.test.js`
- Tested: `build/routes/xref/update.js`

- [ ] **Step 1: Read source** `routes/xref/update.ts`

Test `hasRelevantUpdate()` — the function that checks if pushed commits contain relevant file changes.

- [ ] **Step 2: Write tests for ref validation and relevance checking**
- [ ] **Step 3: Commit**

---

## PR 4: caniuse + w3c Route Tests — `test/caniuse-w3c`

### Task 9: caniuse feature lookup

**Files:**
- Create: `tests/routes/caniuse/lib/index.test.js`
- Tested: `build/routes/caniuse/lib/index.js`

- [ ] **Step 1: Read source** `routes/caniuse/lib/index.ts`

Test: `normalizeOptions()`, `sanitizeBrowsersList()`, `getSupportTitle()`, response body formatting.

- [ ] **Step 2: Write tests**

```javascript
// Test normalizeOptions with various input shapes
// Test sanitizeBrowsersList filters invalid browsers
// Test getSupportTitle maps keys correctly
// Test compound keys produce joined titles
```

- [ ] **Step 3: Commit**

---

### Task 10: w3c group handler

**Files:**
- Create: `tests/routes/w3c/group.test.js`
- Tested: `build/routes/w3c/group.js`

- [ ] **Step 1: Read source** `routes/w3c/group.ts`

Test: legacy shortname mapping, type disambiguation logic, error handling (404, 409, 500 with statusCode default).

- [ ] **Step 2: Write tests** for the pure logic functions (not HTTP calls)
- [ ] **Step 3: Commit**

---

## PR 5: GitHub + Respec Route Tests — `test/github-respec`

### Task 11: GitHub route utilities

**Files:**
- Create: `tests/routes/github/lib/utils/rest.test.js`
- Tested: `build/routes/github/lib/utils/rest.js`

- [ ] **Step 1: Read source** — test URL validation (SSRF guard), pagination URL validation
- [ ] **Step 2: Write tests**
- [ ] **Step 3: Commit**

---

### Task 12: Respec size handler

**Files:**
- Create: `tests/routes/respec/size.test.js`
- Tested: `build/routes/respec/size.js`

- [ ] **Step 1: Read source** — test deduplication buffer, input validation
- [ ] **Step 2: Write tests**
- [ ] **Step 3: Commit**

---

## Execution Notes

- Always run `pnpm build` before `pnpm test` (tests import from `build/`)
- Test files are `.test.js` (not `.test.ts`) — plain JavaScript with ES modules
- Import pattern: `import { X } from "../../build/path/to/module.js"`
- Use Jasmine matchers: `toBe()`, `toEqual()`, `toBeTrue()`, `toBeFalse()`, `toBeUndefined()`, `toContain()`, `toThrow()`
- Async tests: `await expectAsync(promise).toBeRejected()` or return the promise
- Each PR should be independently mergeable
- Run full test suite after each commit to catch regressions
