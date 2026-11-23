import { describe, expect, it } from "vitest";
import { formatPhone, supportPhoneSchema } from "./rules";

describe("support phone", () => {
  it("accepts Persian digits, dashes and +98", () => {
    expect(supportPhoneSchema.parse({ supportPhone: "۰۹۱۲-۱۲۳ ۴۵۶۷" }).supportPhone).toBe("09121234567");
    expect(supportPhoneSchema.parse({ supportPhone: "+98 912 123 4567" }).supportPhone).toBe("09121234567");
    expect(supportPhoneSchema.parse({ supportPhone: "021-1234-5678" }).supportPhone).toBe("02112345678");
  });
  it("refuses a short number", () => {
    expect(supportPhoneSchema.safeParse({ supportPhone: "12345" }).success).toBe(false);
  });
  it("formats for display", () => {
    expect(formatPhone("09121234567")).toBe("0912-123-4567");
    expect(formatPhone("02112345678")).toBe("021-1234-5678");
  });
});
