import { describe, expect, it } from "vitest";
import {
  getChartSharePeriodBadge,
  getChartSharePeriodLabel,
  getChartSharePeriodRange,
} from "../chart-share-period";

describe("chart share period copy", () => {
  const now = new Date(2026, 4, 2);

  it("labels each chart timeframe for the share card", () => {
    expect(getChartSharePeriodLabel("1D")).toBe("ÚLTIMO DÍA");
    expect(getChartSharePeriodLabel("1W")).toBe("ÚLTIMOS 7 DÍAS");
    expect(getChartSharePeriodLabel("1M")).toBe("ÚLTIMOS 30 DÍAS");
    expect(getChartSharePeriodLabel("3M")).toBe("ÚLTIMOS 3 MESES");
    expect(getChartSharePeriodLabel("6M")).toBe("ÚLTIMOS 6 MESES");
    expect(getChartSharePeriodLabel("1Y")).toBe("ÚLTIMO AÑO");
    expect(getChartSharePeriodLabel("ALL")).toBe("HISTÓRICO TOTAL");
  });

  it("uses the selected timeframe window instead of the data min/max", () => {
    const options = {
      now,
      firstDataDate: "2026-03-13",
      lastDataDate: "2026-04-27",
    };

    expect(getChartSharePeriodRange("1D", options)).toBe("2 MAY");
    expect(getChartSharePeriodRange("1W", options)).toBe("26 ABR - 2 MAY");
    expect(getChartSharePeriodRange("1M", options)).toBe("3 ABR - 2 MAY");
    expect(getChartSharePeriodRange("3M", options)).toBe("2 FEB - 2 MAY");
    expect(getChartSharePeriodRange("6M", options)).toBe("2 NOV 2025 - 2 MAY 2026");
    expect(getChartSharePeriodRange("1Y", options)).toBe("2 MAY 2025 - 2 MAY 2026");
  });

  it("keeps historical total tied to the actual chart data span", () => {
    expect(getChartSharePeriodRange("ALL", {
      now,
      firstDataDate: "2026-03-13",
      lastDataDate: "2026-04-27",
    })).toBe("13 MAR - 27 ABR");
    expect(getChartSharePeriodBadge("ALL")).toBe("ALL");
    expect(getChartSharePeriodBadge("1M")).toBe("1M");
  });
});
