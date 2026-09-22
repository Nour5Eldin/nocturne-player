import { describe, expect, it } from "vitest";
import { chapterAt, clampTo, clock, colorVars, sortedChapters } from "../utils";

describe("clock", () => {
  it("formats minutes and seconds", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(75)).toBe("1:15");
    expect(clock(599.9)).toBe("9:59");
  });
  it("adds hours when needed", () => {
    expect(clock(3725)).toBe("1:02:05");
  });
  it("tolerates junk", () => {
    expect(clock(NaN)).toBe("0:00");
    expect(clock(-5)).toBe("0:00");
    expect(clock(Infinity)).toBe("0:00");
  });
});

describe("clampTo", () => {
  it("clamps both ends", () => {
    expect(clampTo(5, 0, 1)).toBe(1);
    expect(clampTo(-1, 0, 1)).toBe(0);
    expect(clampTo(0.4, 0, 1)).toBe(0.4);
  });
});

describe("chapters", () => {
  const list = sortedChapters([
    { time: 120, label: "Second" },
    { time: 0, label: "First" },
    { time: Number.NaN, label: "Broken" },
    { time: -4, label: "Negative" },
  ]);

  it("sorts, drops invalid times and clamps negatives to 0", () => {
    expect(list.map((c) => c.label)).toEqual(["First", "Negative", "Second"]);
    expect(list.every((c) => c.time >= 0)).toBe(true);
  });

  it("finds the chapter containing a time", () => {
    expect(chapterAt(list, 0)?.label).toBe("Negative");
    expect(chapterAt(list, 119)?.label).toBe("Negative");
    expect(chapterAt(list, 120)?.label).toBe("Second");
    expect(chapterAt([], 10)).toBeNull();
  });
});

describe("colorVars", () => {
  it("only emits the colors that were passed", () => {
    expect(colorVars({ accent: "#f00" })).toEqual({ "--nct-accent": "#f00" });
    expect(colorVars(undefined)).toEqual({});
    expect(colorVars({ corner: 8 })).toEqual({});
  });
});
