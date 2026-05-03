const { default: route } = await import(
  "../../../build/routes/monitor/usage.js"
);

function mockRes() {
  const res = {
    _status: 200,
    _body: undefined,
    _headers: {},
    status(code) { res._status = code; return res; },
    json(body) { res._body = body; return res; },
    set(header, value) { res._headers[header] = value; return res; },
  };
  return res;
}

describe("monitor/usage", () => {
  it("returns all required fields with correct types", () => {
    const res = mockRes();
    route({}, res);
    expect(res._body).toBeDefined();
    expect(typeof res._body.name).toBe("string");
    expect(typeof res._body.version).toBe("string");
    expect(typeof res._body.uptime).toBe("number");
    expect(typeof res._body.heapUsed).toBe("number");
    expect(typeof res._body.heapTotal).toBe("number");
  });

  it("returns respec.org as the service name", () => {
    const res = mockRes();
    route({}, res);
    expect(res._body.name).toBe("respec.org");
  });

  it("sets Cache-Control to no-store", () => {
    const res = mockRes();
    route({}, res);
    expect(res._headers["Cache-Control"]).toBe("no-store");
  });

  it("returns positive uptime", () => {
    const res = mockRes();
    route({}, res);
    expect(res._body.uptime).toBeGreaterThan(0);
  });

  it("returns positive heap values", () => {
    const res = mockRes();
    route({}, res);
    expect(res._body.heapUsed).toBeGreaterThan(0);
    expect(res._body.heapTotal).toBeGreaterThan(0);
    expect(res._body.heapTotal).toBeGreaterThanOrEqual(res._body.heapUsed);
  });
});
