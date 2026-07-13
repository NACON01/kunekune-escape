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
