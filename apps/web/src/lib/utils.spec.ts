import { cn, formatDate, formatDateTime, formatRiskScore } from "@/lib/utils";

describe("utils", () => {
  it("merges tailwind classes with cn", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("formats dates and rejects invalid or empty values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDate("2026-11-25T10:30:00.000Z")).toContain("2026");

    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("invalid")).toBe("—");
    expect(formatDateTime(new Date("2026-11-25T10:30:00.000Z"))).toContain(
      "2026",
    );
  });

  it("formats risk scores safely", () => {
    expect(formatRiskScore(0.756)).toBe("0.76");
    expect(formatRiskScore(null)).toBe("0.00");
    expect(formatRiskScore(Number.NaN)).toBe("0.00");
  });
});
