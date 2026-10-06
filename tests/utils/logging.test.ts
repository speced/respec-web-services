import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import httpMocks from "node-mocks-http";

import { formatter, stderr, stdout } from "#utils/logging.ts";

const colorStream = () =>
  Object.assign(new PassThrough(), {
    isTTY: true,
    hasColors: () => true,
    getColorDepth: () => 8,
  });

const line = (
  stream: NodeJS.WritableStream,
  { status = "200", url = "/test?q=1", locals = {} } = {},
) => {
  const tokens: any = {
    date: () => "2026-10-06T00:00:00.000Z",
    "remote-addr": () => "127.0.0.1",
    method: () => "GET",
    status: () => status,
    url: () => url,
    referrer: () => undefined,
    "response-time": () => "10",
  };
  const res: any = { locals, getHeader: () => undefined };
  return formatter(stream)(tokens, {} as any, res) as string;
};

describe("utils/logging", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const name of ["FORCE_COLOR", "NO_COLOR"]) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("colors the status by class and underlines deprecated requests", () => {
    const cases = [
      { status: "200", locals: {}, expected: "\x1b[32mGET  200\x1b[39m" },
      { status: "304", locals: {}, expected: "\x1b[33mGET  304\x1b[39m" },
      { status: "404", locals: {}, expected: "\x1b[31mGET  404\x1b[39m" },
      {
        status: "200",
        locals: { deprecated: true },
        expected: "\x1b[32m\x1b[4mGET  200\x1b[24m\x1b[39m",
      },
    ];
    for (const { status, locals, expected } of cases) {
      expect(line(colorStream(), { status, locals }))
        .withContext(`${status} ${JSON.stringify(locals)}`)
        .toContain(expected);
    }
  });

  it("colors null, number and boolean values in res.locals", () => {
    const locals = { a: null, b: 42, c: true };
    expect(line(colorStream(), { locals }).split(" | ")[6]).toEqual(
      "\x1b[95ma=\x1b[39m\x1b[33mnull\x1b[39m " +
        "\x1b[95mb=\x1b[39m\x1b[36m42\x1b[39m " +
        "\x1b[95mc=\x1b[39m\x1b[32mtrue\x1b[39m",
    );
  });

  it("leaves an empty query string uncolored", () => {
    expect(line(colorStream(), { url: "/test" }).split(" | ")[2]).toEqual(
      "\x1b[32mGET  200\x1b[39m \x1b[94m/test\x1b[39m",
    );
  });

  it("adds no escape codes for a stream without color", () => {
    const locals = { deprecated: true, user: 1 };
    expect(line(new PassThrough(), { locals })).toEqual(
      "2026-10-06T00:00:00.000Z |       127.0.0.1 | GET  200 /test?q=1 | - | - | 10 ms | deprecated=true user=1",
    );
  });

  it("decides colors from the stream each logger writes to", async () => {
    const cases = [
      { logger: stderr, own: "stderr", other: "stdout", status: 500 },
      { logger: stdout, own: "stdout", other: "stderr", status: 200 },
    ] as const;
    for (const { logger, own, other, status } of cases) {
      const real = process[own];
      const ownDesc = Object.getOwnPropertyDescriptor(process, own)!;
      const otherDesc = Object.getOwnPropertyDescriptor(process, other)!;
      const write = real.write;
      const writes: string[] = [];
      // Only the logger's own stream lacks color, so a logger that consults
      // the other stream writes escape codes.
      Object.defineProperty(process, own, {
        value: new PassThrough(),
        configurable: true,
      });
      Object.defineProperty(process, other, {
        value: colorStream(),
        configurable: true,
      });
      real.write = ((chunk: string) => writes.push(chunk) > 0) as any;
      try {
        const req = httpMocks.createRequest({ method: "GET", url: "/x" });
        const res = httpMocks.createResponse({
          eventEmitter: EventEmitter,
          req,
        });
        logger()(req, res, () => {});
        res.statusCode = status;
        res.end();
        await new Promise(setImmediate);
      } finally {
        real.write = write;
        Object.defineProperty(process, own, ownDesc);
        Object.defineProperty(process, other, otherDesc);
      }
      expect(writes).withContext(own).toHaveSize(1);
      expect(writes[0]).withContext(own).not.toContain("\x1b");
    }
  });
});
