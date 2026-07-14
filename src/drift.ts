export type DriftInput = {
  direction: number;
  distance: number;
  elapsed: number;
  viewportWidth: number;
  viewportHeight: number;
};

export type DriftOutput = {
  offsetX: number;
  offsetY: number;
  rotation: 0 | 180;
  arrived: boolean;
};

const SPEED_PX_PER_SECOND = 40;
const MAX_OUT_OF_VIEW_RATIO = 0.75;
const ARRIVAL_DISTANCE_METERS = 0.8;
const V2_AXIS_THRESHOLD_DEGREES = 15;
const V2_WALKING_ANGLE_DEGREES = 60;
const V2_STOPPED_TIMEOUT_SECONDS = 1.5;
const V2_RETURN_SECONDS = 0.5;

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const normalizeDegrees = (degrees: number): number => {
  return ((degrees % 360) + 360) % 360;
};

export function calculateDrift(input: DriftInput): DriftOutput {
  if (input.distance < ARRIVAL_DISTANCE_METERS) {
    return {
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      arrived: true,
    };
  }

  const direction = normalizeDegrees(input.direction);
  const radians = (direction * Math.PI) / 180;
  const magnitude = Math.max(0, input.elapsed) * SPEED_PX_PER_SECOND;
  const maxX = Math.max(0, input.viewportWidth * MAX_OUT_OF_VIEW_RATIO);
  const maxY = Math.max(0, input.viewportHeight * MAX_OUT_OF_VIEW_RATIO);

  const offsetX = clamp(Math.sin(radians) * magnitude, -maxX, maxX);
  const offsetY = clamp(-Math.cos(radians) * magnitude, -maxY, maxY);
  const isBehind = direction >= 90 && direction <= 270;

  return {
    offsetX,
    offsetY,
    rotation: isBehind ? 180 : 0,
    arrived: false,
  };
}

export type DriftV2Status = "drifting" | "walking" | "stopped" | "arrived";

export type DriftV2State = {
  status: DriftV2Status;
  axisAngle: number;
  offset: number;
  offsetX: number;
  offsetY: number;
  rotation: 0 | 180;
  arrived: boolean;
  noStepSeconds: number;
  walkingSeconds: number;
  walkingStartOffset: number;
};

export type DriftV2Input = {
  relativeAngle: number;
  deltaSeconds: number;
  stepDetected?: boolean;
  arrived?: boolean;
  viewportWidth: number;
  viewportHeight: number;
  contentWidth?: number;
  contentHeight?: number;
};

export type DriftV2Output = DriftV2State;

const signedDegrees = (degrees: number): number => {
  const normalized = ((degrees % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
};

const circularDistance = (first: number, second: number): number =>
  Math.abs(signedDegrees(first - second));

const axisVector = (angle: number): { x: number; y: number } => {
  const radians = (angle * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
};

const getAxisLimit = (
  angle: number,
  viewportWidth: number,
  viewportHeight: number,
  ratio: number,
): number => {
  const vector = axisVector(angle);
  const xLimit = Math.max(0, viewportWidth * ratio);
  const yLimit = Math.max(0, viewportHeight * ratio);
  const limits = [
    Math.abs(vector.x) > 0.0001 ? xLimit / Math.abs(vector.x) : Number.POSITIVE_INFINITY,
    Math.abs(vector.y) > 0.0001 ? yLimit / Math.abs(vector.y) : Number.POSITIVE_INFINITY,
  ];
  return Math.min(...limits);
};

const getFittingLimit = (
  angle: number,
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number,
): number => {
  const vector = axisVector(angle);
  const xLimit = Math.max(0, (viewportWidth - contentWidth) / 2);
  const yLimit = Math.max(0, (viewportHeight - contentHeight) / 2);
  const limits = [
    Math.abs(vector.x) > 0.0001 ? xLimit / Math.abs(vector.x) : Number.POSITIVE_INFINITY,
    Math.abs(vector.y) > 0.0001 ? yLimit / Math.abs(vector.y) : Number.POSITIVE_INFINITY,
  ];
  return Math.max(0, Math.min(...limits));
};

function withOffset(state: DriftV2State, offset: number): DriftV2State {
  const vector = axisVector(state.axisAngle);
  return {
    ...state,
    offset,
    offsetX: vector.x * offset,
    offsetY: vector.y * offset,
  };
}

export function createDriftV2State(relativeAngle = 0): DriftV2State {
  return {
    status: "drifting",
    axisAngle: signedDegrees(relativeAngle),
    offset: 0,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    arrived: false,
    noStepSeconds: 0,
    walkingSeconds: 0,
    walkingStartOffset: 0,
  };
}

export function updateDriftV2(state: DriftV2State, input: DriftV2Input): DriftV2State {
  const deltaSeconds = Math.max(0, input.deltaSeconds);
  let next = { ...state };

  if (input.arrived) {
    return {
      ...withOffset(next, 0),
      status: "arrived",
      rotation: 0,
      arrived: true,
      noStepSeconds: 0,
      walkingSeconds: 0,
    };
  }

  const relativeAngle = signedDegrees(input.relativeAngle);
  if (circularDistance(next.axisAngle, relativeAngle) >= V2_AXIS_THRESHOLD_DEGREES) {
    next.axisAngle = relativeAngle;
  }

  const absoluteAngle = Math.abs(relativeAngle);
  if (next.rotation === 0 && absoluteAngle >= 100) {
    next.rotation = 180;
  } else if (next.rotation === 180 && absoluteAngle <= 80) {
    next.rotation = 0;
  }

  const walkingTowardTarget = Boolean(input.stepDetected) && absoluteAngle <= V2_WALKING_ANGLE_DEGREES;
  if (walkingTowardTarget) {
    next.status = "walking";
    next.noStepSeconds = 0;
    next.walkingSeconds = 0;
    next.walkingStartOffset = next.offset;
  } else if (next.status === "walking") {
    next.status = "stopped";
    next.noStepSeconds += deltaSeconds;
    if (next.noStepSeconds >= V2_STOPPED_TIMEOUT_SECONDS) {
      next.status = "drifting";
    }
  } else if (next.status === "stopped") {
    next.noStepSeconds += deltaSeconds;
    if (next.noStepSeconds >= V2_STOPPED_TIMEOUT_SECONDS) {
      next.status = "drifting";
    }
  } else if (next.status === "drifting") {
    next.noStepSeconds += deltaSeconds;
  }

  if (next.status === "drifting") {
    const limit = getAxisLimit(next.axisAngle, input.viewportWidth, input.viewportHeight, MAX_OUT_OF_VIEW_RATIO);
    next = withOffset(next, clamp(next.offset + deltaSeconds * SPEED_PX_PER_SECOND, 0, limit));
  } else if (next.status === "walking") {
    next.walkingSeconds += deltaSeconds;
    const progress = clamp(next.walkingSeconds / V2_RETURN_SECONDS, 0, 1);
    const target = getFittingLimit(
      next.axisAngle,
      input.viewportWidth,
      input.viewportHeight,
      input.contentWidth ?? input.viewportWidth * 0.9,
      input.contentHeight ?? input.viewportHeight * 0.5,
    );
    next = withOffset(next, next.walkingStartOffset + (target - next.walkingStartOffset) * progress);
  }

  next.arrived = false;
  return next;
}

export function driftV2(state: DriftV2State, input: DriftV2Input): DriftV2Output {
  return updateDriftV2(state, input);
}

export function createDriftV2(initialRelativeAngle = 0) {
  let state = createDriftV2State(initialRelativeAngle);

  return {
    update(input: DriftV2Input): DriftV2State {
      state = updateDriftV2(state, input);
      return state;
    },
    getState(): DriftV2State {
      return state;
    },
    reset(relativeAngle = 0): DriftV2State {
      state = createDriftV2State(relativeAngle);
      return state;
    },
  };
}
