import { describe, expect, it } from "vitest";
import { getTimeDifference } from "../bet-verification";

describe("getTimeDifference", () => {
  it("formats pre-event distance with HH:mm input", () => {
    expect(getTimeDifference(
      "2026-04-26T09:59:00.000Z",
      "2026-04-29",
      "21:00",
    )).toBe("3d antes");
  });

  it("formats pre-event distance with HH:mm:ss input", () => {
    expect(getTimeDifference(
      "2026-04-29T17:45:00.000Z",
      "2026-04-29T00:00:00.000Z",
      "21:00:00",
    )).toBe("1h 15m antes");
  });

  it("does not leak NaN into share cards when dates are invalid", () => {
    expect(getTimeDifference("fecha-rota", "2026-04-29", "21:00:00")).toBe("Hora no disponible");
    expect(getTimeDifference("2026-04-29T19:45:00.000Z", "2026-04-29", "21:00:00")).not.toContain("NaN");
  });
});
