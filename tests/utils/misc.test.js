import { getErrnoCode } from "../../build/utils/misc.js";

describe("utils/misc", () => {
  describe("getErrnoCode", () => {
    it("returns the string code from an Error with a code property", () => {
      const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      expect(getErrnoCode(err)).toBe("ENOENT");
    });

    it("returns the string code from a plain object with a code property", () => {
      expect(getErrnoCode({ code: "EACCES" })).toBe("EACCES");
    });

    it("returns undefined when the code property is not a string", () => {
      expect(getErrnoCode({ code: 42 })).toBeUndefined();
    });

    it("returns undefined for an Error without a code property", () => {
      expect(getErrnoCode(new Error("oops"))).toBeUndefined();
    });

    it("returns undefined for null", () => {
      expect(getErrnoCode(null)).toBeUndefined();
    });

    it("returns undefined for undefined", () => {
      expect(getErrnoCode(undefined)).toBeUndefined();
    });

    it("returns undefined for a string", () => {
      expect(getErrnoCode("ENOENT")).toBeUndefined();
    });

    it("returns undefined for a number", () => {
      expect(getErrnoCode(404)).toBeUndefined();
    });
  });
});
