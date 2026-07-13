import { describe, expect, it } from "vitest";
import { calculateDrift } from "./drift";

describe("calculateDrift", () => {
  it("前方へ時間に応じて上方向にズレる", () => {
    const result = calculateDrift({
      direction: 0,
      distance: 3,
      elapsed: 2,
      viewportWidth: 400,
      viewportHeight: 800,
    });

    expect(result.offsetX).toBeCloseTo(0);
    expect(result.offsetY).toBeCloseTo(-80);
    expect(result.rotation).toBe(0);
    expect(result.arrived).toBe(false);
  });

  it("背後方向ではコンテンツを逆さまにする", () => {
    const result = calculateDrift({
      direction: 180,
      distance: 3,
      elapsed: 1,
      viewportWidth: 400,
      viewportHeight: 800,
    });

    expect(result.offsetX).toBeCloseTo(0);
    expect(result.offsetY).toBeCloseTo(40);
    expect(result.rotation).toBe(180);
    expect(result.arrived).toBe(false);
  });

  it("画面から約75%はみ出す範囲でクランプする", () => {
    const result = calculateDrift({
      direction: 90,
      distance: 3,
      elapsed: 100,
      viewportWidth: 320,
      viewportHeight: 640,
    });

    expect(result.offsetX).toBe(240);
    expect(result.offsetY).toBeCloseTo(0);
    expect(result.rotation).toBe(180);
  });

  it("到着距離では演出をリセットする", () => {
    const result = calculateDrift({
      direction: 180,
      distance: 0.7,
      elapsed: 5,
      viewportWidth: 400,
      viewportHeight: 800,
    });

    expect(result).toEqual({
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      arrived: true,
    });
  });
});
