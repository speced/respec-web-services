import { EventEmitter } from "node:events";
import { stripVTControlCharacters } from "node:util";

import httpMocks from "node-mocks-http";

import { stdout } from "#utils/logging.ts";

describe("logging", () => {
  let originalWrite: typeof process.stdout.write;
  let lines: string[] = [];

  beforeEach(() => {
    originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      lines.push(chunk.toString());
      return true;
    }) as any;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  it("handles malformed paths safely", async () => {
    const logger = stdout();
    const paths = ["/x?q=%E0%A4%A", "///", "//%", "//[bad"];

    for (const path of paths) {
      lines = [];
      const req = httpMocks.createRequest({ method: "GET", url: path });
      const res = httpMocks.createResponse({ eventEmitter: EventEmitter, req });

      expect(() => {
        logger(req as any, res as any, () => {});
        res.statusCode = 200;
        res.end();
      })
        .withContext(path)
        .not.toThrow();

      await new Promise(setImmediate);

      expect(lines).withContext(path).toHaveSize(1);
      expect(stripVTControlCharacters(lines[0]))
        .withContext(path)
        .toContain(path);
    }
  });
});
