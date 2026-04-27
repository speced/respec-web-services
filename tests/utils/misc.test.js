import { env, seconds, ms, HTTPError } from "../../build/utils/misc.js";

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

    it("throws when env variable is not set", () => {
      savedEnv.SURELY_UNSET_VAR = process.env.SURELY_UNSET_VAR;
      delete process.env.SURELY_UNSET_VAR;
      try {
        env("SURELY_UNSET_VAR");
        fail("Expected env() to throw");
      } catch (thrown) {
        expect(thrown).toBe("env variable `SURELY_UNSET_VAR` is not set.");
      }
    });

    it("throws when env variable is empty string", () => {
      savedEnv.EMPTY_VAR = process.env.EMPTY_VAR;
      process.env.EMPTY_VAR = "";
      try {
        env("EMPTY_VAR");
        fail("Expected env() to throw");
      } catch (thrown) {
        expect(thrown).toBe("env variable `EMPTY_VAR` is not set.");
      }
    });
  });

  describe("seconds()", () => {
    it("parses seconds", () => {
      expect(seconds("1s")).toBe(1);
      expect(seconds("30s")).toBe(30);
    });

    it("parses minutes", () => {
      expect(seconds("1m")).toBe(60);
      expect(seconds("2m")).toBe(120);
    });

    it("parses hours", () => {
      expect(seconds("1h")).toBe(3600);
      expect(seconds("2h")).toBe(7200);
    });

    it("parses days", () => {
      expect(seconds("1d")).toBe(86400);
    });

    it("parses weeks", () => {
      expect(seconds("1w")).toBe(604800);
    });

    it("parses fractional values", () => {
      expect(seconds("1.5m")).toBe(90);
      expect(seconds("0.5h")).toBe(1800);
    });

    it("allows optional space between number and unit", () => {
      expect(seconds("1 m")).toBe(60);
      expect(seconds("2 h")).toBe(7200);
    });

    it("is case-insensitive for units", () => {
      expect(seconds("1M")).toBe(60);
      expect(seconds("1H")).toBe(3600);
      expect(seconds("1D")).toBe(86400);
      expect(seconds("1W")).toBe(604800);
      expect(seconds("1S")).toBe(1);
    });

    it("throws on invalid format", () => {
      expect(() => seconds("")).toThrowError("Invalid duration format: \"\"");
      expect(() => seconds("abc")).toThrowError(
        "Invalid duration format: \"abc\"",
      );
      expect(() => seconds("1x")).toThrowError(
        "Invalid duration format: \"1x\"",
      );
    });

    it("throws on zero value", () => {
      // parseFloat("0") returns 0, which is falsy, so the guard rejects it
      expect(() => seconds("0s")).toThrowError(
        "Invalid duration format: \"0s\"",
      );
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
