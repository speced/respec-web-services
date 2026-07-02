import { createHmac } from "crypto";
import githubWebhookAuthenticator from "../../build/utils/auth-github-webhook.js";

const SECRET = "test-webhook-secret-1234";

// The SHA-1 HMAC signature GitHub sends in X-Hub-Signature, e.g. "sha1=abc…".
const sign = (body, secret) =>
  `sha1=${createHmac("sha1", secret).update(body).digest("hex")}`;

function mockReq({ body, headers }) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return { body, headers: lower, get: name => lower[name.toLowerCase()] };
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    send(data) { res.body = data; return res; },
  };
  return res;
}

// Run the verifier (the 2nd middleware element; express.raw() is Express's own).
// `signature === undefined` means the header is absent.
function run({ body, signature, secret = SECRET }) {
  const verifier = githubWebhookAuthenticator(secret)[1];
  const headers = signature === undefined ? {} : { "X-Hub-Signature": signature };
  const req = mockReq({ body: Buffer.from(body), headers });
  const res = mockRes();
  let nextCalled = false;
  verifier(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

describe("utils/auth-github-webhook", () => {
  it("calls next() and parses the body when the signature is valid", () => {
    const payload = { action: "opened", number: 42 };
    const body = JSON.stringify(payload);
    const { nextCalled, req } = run({ body, signature: sign(Buffer.from(body), SECRET) });
    expect(nextCalled).toBeTrue();
    expect(req.body).toEqual(payload);
  });

  it("responds 'pong' to a ping event (zen field) without calling next()", () => {
    const body = JSON.stringify({ zen: "Keep it logically awesome.", hook_id: 1 });
    const { nextCalled, res } = run({ body, signature: sign(Buffer.from(body), SECRET) });
    expect(nextCalled).toBeFalse();
    expect(res.body).toBe("pong");
  });

  it("returns 401 when the X-Hub-Signature header is missing or empty", () => {
    for (const signature of [undefined, ""]) {
      const { nextCalled, res } = run({ body: "{}", signature });
      expect(nextCalled).toBeFalse();
      expect(res.statusCode).toBe(401);
    }
  });

  it("returns 401 when the signature doesn't match the body/secret", () => {
    // Correct length, wrong HMAC — covers a bad signature, a wrong secret, and a
    // tampered body (a valid signature computed over different bytes).
    const { nextCalled, res } = run({
      body: '{"action":"opened"}',
      signature: sign(Buffer.from("{}"), SECRET),
    });
    expect(nextCalled).toBeFalse();
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain("Failed to authenticate");
  });

  it("compares Buffer byte length, not string length (non-ASCII signature)", () => {
    // Same JS string length but a different UTF-8 byte length must be rejected by
    // the length guard before timingSafeEqual (which throws on unequal buffers).
    const body = JSON.stringify({ ref: "refs/heads/main" });
    const validSig = sign(Buffer.from(body), SECRET);
    const nonAsciiSig = validSig.slice(0, -2) + "ñ" + "a";
    expect(nonAsciiSig.length).toBe(validSig.length);
    const { nextCalled, res } = run({ body, signature: nonAsciiSig });
    expect(nextCalled).toBeFalse();
    expect(res.statusCode).toBe(401);
  });
});
