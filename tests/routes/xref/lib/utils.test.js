import * as utils from "../../../../build/routes/xref/lib/utils.js";

describe("xref - utils", () => {
  test("objectHash", () => {
    expect(utils.objectHash({ foo: "1", bar: [1, 2, 3] })).toBe(
      "04722f6cdbdc00570d92f86e7dd4281e61c319bf",
    );
    expect(utils.objectHash({ bar: [1, 2, 3], foo: "1" })).toBe(
      "04722f6cdbdc00570d92f86e7dd4281e61c319bf",
    );
    expect(utils.objectHash({ bar: [1, 2, 3], foo: "2" })).toBe(
      "fd59a914ecc051a6844c781a151f34e9d0f8d89d",
    );
  });

  test("pickFields", () => {
    const object = {
      foo: "FOO",
      bar: { a: "A", b: "B" },
      baz: [1, 2, 3],
    };
    expect(utils.pickFields(object, ["bar"])).toEqual({
      bar: object.bar,
    });
    expect(utils.pickFields(object, ["foo", "nope", "bar"])).toEqual({
      foo: object.foo,
      bar: object.bar,
    });
    expect(utils.pickFields(object, ["foo", "nope", "bar"])).toStrictEqual({
      foo: object.foo,
      nope: undefined,
      bar: object.bar,
    });
    expect(utils.pickFields(object, ["bar"]).bar).toBe(object.bar);
  });

  test("uniq", () => {
    expect(
      utils.uniq([
        { foo: "FOO", bar: "BAR" },
        { foo: "FOO", bar: "BARS" },
        { foo: "FOO" },
        { foo: "FOO", bar: "BAR" }, // duplicate
        { bar: "BAR", foo: "FOO" },
        { foo: "FOO" }, // duplicate
        { foo: "FOO", bar: "BAR" }, // duplicate
      ]),
    ).toEqual([
      { foo: "FOO", bar: "BAR" },
      { foo: "FOO", bar: "BARS" },
      { foo: "FOO" },
      { bar: "BAR", foo: "FOO" },
    ]);
  });
});
