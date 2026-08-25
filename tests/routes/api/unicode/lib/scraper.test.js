import { parseLine } from "../../../../../build/routes/api/unicode/lib/scraper.js";

describe("api/unicode/lib/scraper - parseLine", () => {
  it("parses a normal data line into [codepoint, { name }]", () => {
    const line = "0041;LATIN CAPITAL LETTER A;Lu;0;L;;;;;N;;;;0061;";
    expect(parseLine(line)).toEqual(["0041", { name: "LATIN CAPITAL LETTER A" }]);
  });

  it("maps angle-bracket control names to square brackets", () => {
    const line = "0001;<control>;Cc;0;BN;;;;;N;START OF HEADING;;;;";
    expect(parseLine(line)).toEqual(["0001", { name: "[control]" }]);
  });

  it("returns null for comment lines", () => {
    expect(parseLine("# comment")).toBeNull();
  });

  // Regression: parseLine previously read parts[1] unconditionally and threw
  // on any line without a ";", aborting the whole scrape.
  it("returns null for a blank line instead of throwing", () => {
    expect(parseLine("")).toBeNull();
  });

  it("returns null for a line with no fields (no semicolon)", () => {
    expect(parseLine("garbage")).toBeNull();
  });
});
