import { describe, it, expect } from "vitest";
import { score, reportsLeft, minutes, sanitize, type Report } from "./saferoute";

describe("SafeRoute rules", () => {
  it("each verified report lowers its route's report factor by 8", () => {
    const r: Report[] = [{ id: 1, cat: "Hazard", a: "fast", txt: "x", st: "verified" }];
    expect(score("fast", 0, []).P[3][1]).toBe(62);
    expect(score("fast", 0, r).P[3][1]).toBe(54);
  });
  it("pending reports do not affect score", () => {
    const r: Report[] = [{ id: 1, cat: "Hazard", a: "fast", txt: "x", st: "pending" }];
    expect(score("fast", 2, r).s).toBe(score("fast", 2, []).s);
  });
  it("safest route outscores fastest at night", () => {
    expect(score("safe", 2, []).s).toBeGreaterThan(score("fast", 2, []).s);
  });
  it("allows 3 reports per hour", () => {
    const now = 10_000_000;
    expect(reportsLeft([], now)).toBe(3);
    expect(reportsLeft([now - 1, now - 2, now - 3], now)).toBe(0);
    expect(reportsLeft([now - 3_600_001, now - 1], now)).toBe(2);
  });
  it("walking 1.2 km takes 14 min", () => expect(minutes("fast", "Walking")).toBe(14));
  it("strips markup from report text", () => expect(sanitize("<b>hi</b>")).toBe("bhi/b"));
});
