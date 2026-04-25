import { createHmac } from "crypto";
import githubWebhookAuthenticator from "../../build/utils/auth-github-webhook.js";

/**
 * Compute the SHA-1 HMAC signature GitHub sends in X-Hub-Signature.
 * @param {Buffer} body Raw request body
 * @param {string} secret Shared webhook secret
 * @returns {string} e.g. "sha1=abc123..."
 */
function sign(body, secret) {
  const hash = createHmac("sha1", secret).update(body).digest("hex");
  return `sha1=${hash}`;
}

/**
 * Create a minimal Express-like request object.
 * @param {object} options
 * @param {Buffer} options.body Raw body buffer
 * @param {Record<string, string>} [options.headers] Request headers
 * @returns {object} Mock request
 */
function mockReq({ body, headers = {} }) {
  const lowerHeaders = {};
  for (const [k, v] of Object.entries(headers)) {
    lowerHeaders[k.toLowerCase()] = v;
  }
  return {
    body,
    headers: lowerHeaders,
    get(name) {
      return this.headers[name.toLowerCase()];
    },
  };
}

/**
 * Create a minimal Express-like response object.
 * @returns {{ statusCode: number|null, body: string|null, status: Function, send: Function }}
 */
function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe("utils/auth-github-webhook", () => {
  const SECRET = "test-webhook-secret-1234";

  it("returns an array of [rawBodyParser, verifier]", () => {
    const middleware = githubWebhookAuthenticator(SECRET);
    expect(Array.isArray(middleware)).toBeTrue();
    expect(middleware).toHaveSize(2);
    // First element is express.raw() middleware, second is the verifier fn
    expect(typeof middleware[0]).toBe("function");
    expect(typeof middleware[1]).toBe("function");
  });

  describe("signature verification (verifier middleware)", () => {
    // We test the second element of the array (the verifier function)
    // directly, since express.raw() is Express's own middleware.
    let verifier;

    beforeEach(() => {
      const middleware = githubWebhookAuthenticator(SECRET);
      verifier = middleware[1];
    });

    it("calls next() when the HMAC signature is valid", () => {
      const payload = { action: "opened", number: 42 };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = sign(rawBody, SECRET);

      const req = mockReq({
        body: rawBody,
        headers: { "X-Hub-Signature": signature },
      });
      const res = mockRes();
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      verifier(req, res, next);

      expect(nextCalled).toBeTrue();
      // Body should be parsed as JSON after verification
      expect(req.body).toEqual(payload);
    });

    it("parses the raw body as JSON after successful verification", () => {
      const payload = { ref: "refs/heads/main", commits: [{ id: "abc" }] };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = sign(rawBody, SECRET);

      const req = mockReq({
        body: rawBody,
        headers: { "X-Hub-Signature": signature },
      });
      const res = mockRes();
      verifier(req, res, () => {});

      expect(req.body).toEqual(payload);
      expect(typeof req.body).toBe("object");
    });

    it("responds with 'pong' for GitHub ping events (zen field present)", () => {
      const payload = { zen: "Keep it logically awesome.", hook_id: 1 };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = sign(rawBody, SECRET);

      const req = mockReq({
        body: rawBody,
        headers: { "X-Hub-Signature": signature },
      });
      const res = mockRes();
      let nextCalled = false;

      verifier(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBeFalse();
      expect(res.body).toBe("pong");
    });

    it("returns 401 when the signature is invalid", () => {
      const payload = { action: "opened" };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const badSignature = "sha1=0000000000000000000000000000000000000000";

      const req = mockReq({
        body: rawBody,
        headers: { "X-Hub-Signature": badSignature },
      });
      const res = mockRes();
      let nextCalled = false;

      verifier(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBeFalse();
      expect(res.statusCode).toBe(401);
      expect(res.body).toContain("Failed to authenticate");
    });

    it("returns 401 when X-Hub-Signature header is missing", () => {
      const payload = { action: "opened" };
      const rawBody = Buffer.from(JSON.stringify(payload));

      const req = mockReq({ body: rawBody, headers: {} });
      const res = mockRes();
      let nextCalled = false;

      verifier(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBeFalse();
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when the body has been tampered with", () => {
      const original = { action: "opened", number: 42 };
      const rawOriginal = Buffer.from(JSON.stringify(original));
      const signature = sign(rawOriginal, SECRET);

      // Tamper with the body after signing
      const tampered = { action: "opened", number: 99 };
      const rawTampered = Buffer.from(JSON.stringify(tampered));

      const req = mockReq({
        body: rawTampered,
        headers: { "X-Hub-Signature": signature },
      });
      const res = mockRes();
      let nextCalled = false;

      verifier(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBeFalse();
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 when the secret is wrong", () => {
      const payload = { action: "opened" };
      const rawBody = Buffer.from(JSON.stringify(payload));
      // Sign with a different secret
      const signature = sign(rawBody, "wrong-secret");

      const req = mockReq({
        body: rawBody,
        headers: { "X-Hub-Signature": signature },
      });
      const res = mockRes();
      let nextCalled = false;

      verifier(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBeFalse();
      expect(res.statusCode).toBe(401);
    });

    it("rejects an empty signature header value", () => {
      const payload = { action: "opened" };
      const rawBody = Buffer.from(JSON.stringify(payload));

      const req = mockReq({
        body: rawBody,
        headers: { "X-Hub-Signature": "" },
      });
      const res = mockRes();
      let nextCalled = false;

      verifier(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBeFalse();
      expect(res.statusCode).toBe(401);
    });

    it("returns 401 for non-ASCII signature (Buffer byte length mismatch)", () => {
      const body = JSON.stringify({ ref: "refs/heads/main" });
      const validSig = sign(body, SECRET);
      // Replace last chars with non-ASCII that has same JS string length
      // but different UTF-8 byte length
      const nonAsciiSig = validSig.slice(0, -2) + "ñ" + "a";
      expect(nonAsciiSig.length).toBe(validSig.length);

      const req = mockReq(body, nonAsciiSig);
      const res = mockRes();
      let nextCalled = false;

      verifier(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBeFalse();
      expect(res.statusCode).toBe(401);
    });
  });
});
