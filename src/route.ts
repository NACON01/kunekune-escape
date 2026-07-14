export type RouteSegment = {
  heading: number;
  steps: number;
};

export type Route = {
  segments: RouteSegment[];
  totalSteps: number;
  createdAt: string;
};

export type RouteGuidanceState = {
  segmentIndex: number;
  remainingSteps: number;
  remainingDistance: number;
  targetHeading: number | null;
  arrived: boolean;
};

export interface RouteStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const ROUTE_STORAGE_KEY = "kunekune-escape:route:v2";
export const STEP_LENGTH_METERS = 0.7;
export const HEADING_SEGMENT_THRESHOLD = 15;

export function normalizeRouteHeading(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function signedAngleDifference(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function headingDifference(first: number, second: number): number {
  return Math.abs(signedAngleDifference(first, second));
}

function circularMean(first: number, second: number, firstWeight: number, secondWeight: number): number {
  const firstRadians = (first * Math.PI) / 180;
  const secondRadians = (second * Math.PI) / 180;
  return normalizeRouteHeading(
    (Math.atan2(
      Math.sin(firstRadians) * firstWeight + Math.sin(secondRadians) * secondWeight,
      Math.cos(firstRadians) * firstWeight + Math.cos(secondRadians) * secondWeight,
    ) * 180) / Math.PI,
  );
}

export function compressHeadings(headings: readonly number[]): RouteSegment[] {
  const segments: RouteSegment[] = [];

  headings.forEach((rawHeading) => {
    if (!Number.isFinite(rawHeading)) {
      return;
    }

    const heading = normalizeRouteHeading(rawHeading);
    const previous = segments[segments.length - 1];
    if (!previous || headingDifference(previous.heading, heading) > HEADING_SEGMENT_THRESHOLD) {
      segments.push({ heading, steps: 1 });
      return;
    }

    previous.heading = circularMean(previous.heading, heading, previous.steps, 1);
    previous.steps += 1;
  });

  return segments;
}

export function createRoute(headings: readonly number[]): Route {
  const segments = compressHeadings(headings);
  return {
    segments,
    totalSteps: segments.reduce((total, segment) => total + segment.steps, 0),
    createdAt: new Date().toISOString(),
  };
}

export class RouteRecorder {
  private headings: number[] = [];

  recordStep(heading: number): void {
    if (Number.isFinite(heading)) {
      this.headings.push(normalizeRouteHeading(heading));
    }
  }

  get stepCount(): number {
    return this.headings.length;
  }

  get segments(): RouteSegment[] {
    return compressHeadings(this.headings);
  }

  finish(): Route {
    return createRoute(this.headings);
  }
}

export function saveRoute(route: Route, storage: RouteStorage = window.localStorage): void {
  storage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(route));
}

export function loadRoute(storage: RouteStorage = window.localStorage): Route | null {
  try {
    const raw = storage.getItem(ROUTE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRoute(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isRoute(value: unknown): value is Route {
  if (!value || typeof value !== "object") {
    return false;
  }

  const route = value as Partial<Route>;
  const totalSteps = route.totalSteps;
  return (
    Array.isArray(route.segments) &&
    route.segments.every(
      (segment) =>
        Boolean(segment) &&
        Number.isFinite(segment.heading) &&
        Number.isInteger(segment.steps) &&
        segment.steps > 0,
    ) &&
    Number.isInteger(totalSteps) &&
    typeof totalSteps === "number" &&
    totalSteps >= 0 &&
    typeof route.createdAt === "string"
  );
}

export function createGuidance(route: Route): RouteGuidanceState {
  const first = route.segments[0];
  return first
    ? {
        segmentIndex: 0,
        remainingSteps: first.steps,
        remainingDistance: route.totalSteps * STEP_LENGTH_METERS,
        targetHeading: first.heading,
        arrived: false,
      }
    : {
        segmentIndex: 0,
        remainingSteps: 0,
        remainingDistance: 0,
        targetHeading: null,
        arrived: true,
      };
}

export function consumeRouteStep(route: Route, state: RouteGuidanceState): RouteGuidanceState {
  if (state.arrived || !route.segments.length) {
    return state;
  }

  const nextRemainingSteps = Math.max(0, state.remainingSteps - 1);
  const consumed = route.segments
    .slice(0, state.segmentIndex)
    .reduce((total, segment) => total + segment.steps, 0) +
    (route.segments[state.segmentIndex].steps - nextRemainingSteps);
  const remainingDistance = Math.max(0, (route.totalSteps - consumed) * STEP_LENGTH_METERS);

  if (nextRemainingSteps > 0) {
    return { ...state, remainingSteps: nextRemainingSteps, remainingDistance };
  }

  const nextSegment = route.segments[state.segmentIndex + 1];
  if (!nextSegment) {
    return {
      ...state,
      remainingSteps: 0,
      remainingDistance: 0,
      targetHeading: null,
      arrived: true,
    };
  }

  return {
    ...state,
    segmentIndex: state.segmentIndex + 1,
    remainingSteps: nextSegment.steps,
    remainingDistance,
    targetHeading: nextSegment.heading,
  };
}

export function getRelativeDirection(currentHeading: number, targetHeading: number): number {
  return signedAngleDifference(targetHeading, currentHeading);
}
