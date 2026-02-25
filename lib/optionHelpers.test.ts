import { describe, it, expect } from "vitest";
import { Either, Option } from "effect";
import { whenSome, whenRight } from "./optionHelpers";

describe("whenSome", () => {
  it("calls fn when Option is Some", () => {
    let called = false;
    let captured: string | undefined;
    whenSome(Option.some("hello"), (v) => {
      called = true;
      captured = v;
    });
    expect(called).toBe(true);
    expect(captured).toBe("hello");
  });

  it("does not call fn when Option is None", () => {
    let called = false;
    whenSome(Option.none(), () => {
      called = true;
    });
    expect(called).toBe(false);
  });

  it("returns void regardless", () => {
    const result = whenSome(Option.some(42), () => {});
    expect(result).toBeUndefined();
  });
});

describe("whenRight", () => {
  it("calls fn when Either is Right", () => {
    let called = false;
    let captured: number | undefined;
    whenRight(Either.right(42), (v) => {
      called = true;
      captured = v;
    });
    expect(called).toBe(true);
    expect(captured).toBe(42);
  });

  it("does not call fn when Either is Left", () => {
    let called = false;
    whenRight(Either.left("err"), () => {
      called = true;
    });
    expect(called).toBe(false);
  });

  it("returns void regardless", () => {
    const result = whenRight(Either.right("ok"), () => {});
    expect(result).toBeUndefined();
  });
});
