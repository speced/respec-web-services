import { env, seconds, ms, HTTPError, getErrnoCode } from "../../build/utils/misc.js";

describe("utils/misc", () => {
  describe("env()", () => {
    let savedEnv;

    beforeEach(() => {
      savedEnv = {};
    });

    afterEach(() => {
      for (const key of Object.keys(savedEnv)) {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      }
    });

    it("returns value of a set env variable", () => {
      savedEnv.TEST_ENV_VAR = process.env.TEST_ENV_VAR;
      process.env.TEST_ENV_VAR = "hello";
      expect(env("TEST_ENV_VAR")).toBe("hello");
    });

    it("throws when env variable is unset or an empty string", () => {
      // Both an absent variable and one set to "" are treated as "not set".
      for (const [name, value] of [
        ["SURELY_UNSET_VAR", undefined],
        ["EMPTY_VAR", ""],
      ]) {
        savedEnv[name] = process.env[name];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
        try {
          env(name);
          fail(`Expected env() to throw for ${name}`);
        } catch (thrown) {
          expect(thrown)
            .withContext(name)
            .toBe(`env variable \`${name}\` is not set.`);
        }
      }
    });
  });

  describe("seconds()", () => {
    it("parses each unit, fractions, spaces, and is case-insensitive", () => {
      for (const [input, expected] of [
        ["1s", 1],
        ["30s", 30],
        ["1m", 60],
        ["2m", 120],
        ["1h", 3600],
        ["2h", 7200],
        ["1d", 86400],
        ["1w", 604800],
        // fractional values
        ["1.5m", 90],
        ["0.5h", 1800],
        // optional space between number and unit
        ["1 m", 60],
        ["2 h", 7200],
        // case-insensitive units
        ["1M", 60],
        ["1H", 3600],
        ["1D", 86400],
        ["1W", 604800],
        ["1S", 1],
      ]) {
        expect(seconds(input)).withContext(input).toBe(expected);
      }
    });

    it("throws on invalid format or zero value", () => {
      // parseFloat("0") returns 0, which is falsy, so the guard rejects it too.
      for (const input of ["", "abc", "1x", "0s"]) {
        expect(() => seconds(input))
          .withContext(input)
          .toThrowError(`Invalid duration format: "${input}"`);
      }
    });
  });

  describe("ms()", () => {
    it("returns milliseconds", () => {
      expect(ms("1s")).toBe(1000);
      expect(ms("1m")).toBe(60_000);
      expect(ms("10.5s")).toBe(10_500);
    });

    it("throws on invalid format", () => {
      expect(() => ms("bad")).toThrowError("Invalid duration format: \"bad\"");
    });
  });

  describe("getErrnoCode", () => {
    it("returns the string code from an Error with a code property", () => {
      const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      expect(getErrnoCode(err)).toBe("ENOENT");
    });

    it("returns the string code from a plain object with a code property", () => {
      expect(getErrnoCode({ code: "EACCES" })).toBe("EACCES");
    });

    it("returns undefined when there is no string code property", () => {
      // Non-string code, an Error without code, primitives, and nullish inputs
      // all lack a usable string code.
      for (const input of [
        { code: 42 },
        new Error("oops"),
        null,
        undefined,
        "ENOENT",
        404,
      ]) {
        expect(getErrnoCode(input))
          .withContext(JSON.stringify(input) ?? String(input))
          .toBeUndefined();
      }
    });
  });

  describe("HTTPError", () => {
    it("extends Error", () => {
      const err = new HTTPError(404, "Not Found");
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(HTTPError);
    });

    it("has statusCode and message", () => {
      const err = new HTTPError(500, "Internal Server Error");
      expect(err.statusCode).toBe(500);
      expect(err.message).toBe("Internal Server Error");
    });

    it("supports optional url property", () => {
      const err = new HTTPError(404, "Not Found", "https://example.com");
      expect(err.url).toBe("https://example.com");
    });

    it("url is undefined when not provided", () => {
      const err = new HTTPError(400, "Bad Request");
      expect(err.url).toBeUndefined();
    });
  });
});
