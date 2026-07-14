import { describe, expect, it } from "vitest";
import {
  consumeRouteStep,
  createGuidance,
  createRoute,
  compressHeadings,
  getRelativeDirection,
} from "./route";

describe("route compression", () => {
  it("groups nearby circular headings and splits at more than 15 degrees", () => {
    const segments = compressHeadings([358, 2, 10, 30]);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ steps: 3 });
    expect(segments[0].heading).toBeCloseTo(3.33, 1);
    expect(segments[1]).toEqual({ heading: 30, steps: 1 });
  });

  it("creates a reusable route with a fixed 0.7m step length", () => {
    const route = createRoute([0, 0, 90]);

    expect(route.segments).toEqual([
      { heading: 0, steps: 2 },
      { heading: 90, steps: 1 },
    ]);
    expect(route.totalSteps).toBe(3);
  });
});

describe("route guidance", () => {
  it("consumes steps and advances to the next segment", () => {
    const route = createRoute([0, 0, 90]);
    const first = createGuidance(route);
    const second = consumeRouteStep(route, first);
    const third = consumeRouteStep(route, second);

    expect(second.remainingSteps).toBe(1);
    expect(third).toMatchObject({
      segmentIndex: 1,
      remainingSteps: 1,
      targetHeading: 90,
      remainingDistance: 0.7,
      arrived: false,
    });
    expect(consumeRouteStep(route, third).arrived).toBe(true);
  });

  it("returns the signed screen-relative direction", () => {
    expect(getRelativeDirection(0, 90)).toBe(-90);
    expect(getRelativeDirection(350, 10)).toBe(-20);
  });
});
