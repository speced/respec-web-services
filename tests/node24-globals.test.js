describe("Node 24 globals", () => {
  it("fetch is available as a global", () => {
    expect(typeof fetch).toBe("function");
  });

  it("import.meta.dirname is a string", () => {
    expect(typeof import.meta.dirname).toBe("string");
  });

  it("import.meta.filename is a string", () => {
    expect(typeof import.meta.filename).toBe("string");
  });
});
