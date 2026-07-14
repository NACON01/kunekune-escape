import { describe, expect, it } from "vitest";
import { createDriftV2State, updateDriftV2 } from "./drift";

const viewport = {
  viewportWidth: 400,
  viewportHeight: 800,
  contentWidth: 300,
  contentHeight: 400,
};

describe("driftV2", () => {
  it("moves on one axis and clamps at 75% of the viewport", () => {
    const state = updateDriftV2(createDriftV2State(90), {
      relativeAngle: 90,
      deltaSeconds: 100,
      ...viewport,
    });

    expect(state.offsetX).toBe(300);
    expect(state.offsetY).toBeCloseTo(0);
    expect(state.offset).toBe(300);
  });

  it("does not change the axis for hand jitter under 15 degrees", () => {
    const initial = updateDriftV2(createDriftV2State(0), {
      relativeAngle: 0,
      deltaSeconds: 1,
      ...viewport,
    });
    const jitter = updateDriftV2(initial, {
      relativeAngle: 10,
      deltaSeconds: 0,
      ...viewport,
    });

    expect(jitter.axisAngle).toBe(0);
    expect(jitter.offsetX).toBe(0);
    expect(jitter.offsetY).toBe(-40);
  });

  it("returns to an off-center fitting position when walking toward the target", () => {
    const drifting = updateDriftV2(createDriftV2State(0), {
      relativeAngle: 0,
      deltaSeconds: 10,
      ...viewport,
    });
    const walking = updateDriftV2(drifting, {
      relativeAngle: 0,
      deltaSeconds: 0.5,
      stepDetected: true,
      ...viewport,
    });

    expect(walking.status).toBe("walking");
    expect(walking.offsetY).toBe(-200);
    expect(walking.offset).not.toBe(0);
  });

  it("uses rotation hysteresis around the behind boundary", () => {
    const behind = updateDriftV2(createDriftV2State(120), {
      relativeAngle: 120,
      deltaSeconds: 0,
      ...viewport,
    });
    const boundary = updateDriftV2(behind, {
      relativeAngle: 95,
      deltaSeconds: 0,
      ...viewport,
    });
    const ahead = updateDriftV2(boundary, {
      relativeAngle: 70,
      deltaSeconds: 0,
      ...viewport,
    });

    expect(behind.rotation).toBe(180);
    expect(boundary.rotation).toBe(180);
    expect(ahead.rotation).toBe(0);
  });

  it("returns to drifting after 1.5 seconds without a step and can arrive", () => {
    const walking = updateDriftV2(createDriftV2State(0), {
      relativeAngle: 0,
      deltaSeconds: 0.1,
      stepDetected: true,
      ...viewport,
    });
    const stopped = updateDriftV2(walking, {
      relativeAngle: 0,
      deltaSeconds: 0.1,
      ...viewport,
    });
    const drifting = updateDriftV2(stopped, {
      relativeAngle: 0,
      deltaSeconds: 1.5,
      ...viewport,
    });
    const arrived = updateDriftV2(drifting, {
      relativeAngle: 0,
      deltaSeconds: 0,
      arrived: true,
      ...viewport,
    });

    expect(stopped.status).toBe("stopped");
    expect(drifting.status).toBe("drifting");
    expect(arrived).toMatchObject({ status: "arrived", offset: 0, arrived: true, rotation: 0 });
  });
});
