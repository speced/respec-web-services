import { createRequest, createResponse } from "node-mocks-http";

const { default: route } = await import("#routes/monitor/usage.ts");

type UsageRequest = Parameters<typeof route>[0];
type UsageResponse = Parameters<typeof route>[1];

function callRoute() {
  const req = createRequest<UsageRequest>();
  const res = createResponse<UsageResponse>();
  route(req, res);
  return res;
}

describe("monitor/usage", () => {
  it("returns all required fields with correct types", () => {
    const res = callRoute();
    const body = res._getJSONData();
    expect(body).toBeDefined();
    expect(typeof body.name).toBe("string");
    expect(typeof body.version).toBe("string");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.heapUsed).toBe("number");
    expect(typeof body.heapTotal).toBe("number");
  });

  it("returns respec.org as the service name", () => {
    const res = callRoute();
    expect(res._getJSONData().name).toBe("respec.org");
  });

  it("sets Cache-Control to no-store", () => {
    const res = callRoute();
    expect(res.getHeader("Cache-Control")).toBe("no-store");
  });

  it("returns positive uptime", () => {
    const res = callRoute();
    expect(res._getJSONData().uptime).toBeGreaterThan(0);
  });

  it("returns positive heap values", () => {
    const res = callRoute();
    const body = res._getJSONData();
    expect(body.heapUsed).toBeGreaterThan(0);
    expect(body.heapTotal).toBeGreaterThan(0);
    expect(body.heapTotal).toBeGreaterThanOrEqual(body.heapUsed);
  });
});
