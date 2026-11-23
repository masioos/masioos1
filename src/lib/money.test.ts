import { describe, expect, it } from "vitest";
import { digitsOnly, groupAscii, groupFa } from "./money";

describe("price grouping", () => {
  it("groups Persian digits by three with /", () => {
    expect(groupFa(12_000_000)).toBe("۱۲/۰۰۰/۰۰۰");
    expect(groupFa(980)).toBe("۹۸۰");
  });
  it("groups a typed price", () => {
    expect(groupAscii("2587000")).toBe("2/587/000");
    expect(groupAscii(digitsOnly("۲٬۵۸۷,۰۰۰ "))).toBe("2/587/000");
  });
});
