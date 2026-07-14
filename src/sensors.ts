export type SensorSnapshot = {
  heading: number | null;
  totalSteps: number;
  stepDetected: boolean;
};

export type SensorListener = (snapshot: SensorSnapshot) => void;

type PermissionEvent = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const STEP_THRESHOLD = 1.5;
const MIN_STEP_INTERVAL_MS = 300;
const GRAVITY = 9.81;

export function normalizeHeading(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function magnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

export function createSensorController() {
  let heading: number | null = null;
  let totalSteps = 0;
  let thresholdCrossed = false;
  let lastStepAt = Number.NEGATIVE_INFINITY;
  let hasAbsoluteHeading = false;
  let enabled = false;
  const listeners = new Set<SensorListener>();

  const emit = (stepDetected: boolean): void => {
    const snapshot = { heading, totalSteps, stepDetected };
    listeners.forEach((listener) => listener(snapshot));
  };

  const handleOrientation = (event: DeviceOrientationEvent): void => {
    const compassHeading = (event as DeviceOrientationEvent & {
      webkitCompassHeading?: number;
    }).webkitCompassHeading;

    if (typeof compassHeading === "number" && Number.isFinite(compassHeading)) {
      heading = normalizeHeading(compassHeading);
    } else if (typeof event.alpha === "number" && Number.isFinite(event.alpha)) {
      // Android の alpha は時計回りの回転量なので、北を 0 度とする方位へ反転する。
      heading = normalizeHeading(360 - event.alpha);
    }

    emit(false);
  };

  const handleAbsoluteOrientation = (event: Event): void => {
    hasAbsoluteHeading = true;
    handleOrientation(event as DeviceOrientationEvent);
  };

  const handleRelativeOrientation = (event: Event): void => {
    if (!hasAbsoluteHeading) {
      handleOrientation(event as DeviceOrientationEvent);
    }
  };

  const handleMotion = (event: DeviceMotionEvent): void => {
    const acceleration = event.acceleration;
    const accelerationIncludingGravity = event.accelerationIncludingGravity;
    let dynamicMagnitude = 0;

    if (
      acceleration &&
      [acceleration.x, acceleration.y, acceleration.z].every(
        (value): value is number => typeof value === "number" && Number.isFinite(value),
      )
    ) {
      const x = acceleration.x as number;
      const y = acceleration.y as number;
      const z = acceleration.z as number;
      dynamicMagnitude = magnitude(x, y, z);
    } else if (
      accelerationIncludingGravity &&
      [
        accelerationIncludingGravity.x,
        accelerationIncludingGravity.y,
        accelerationIncludingGravity.z,
      ].every((value): value is number => typeof value === "number" && Number.isFinite(value))
    ) {
      // 一部の iOS/WebView は acceleration が null のため、重力分を差し引いた近似を使う。
      const x = accelerationIncludingGravity.x as number;
      const y = accelerationIncludingGravity.y as number;
      const z = accelerationIncludingGravity.z as number;
      dynamicMagnitude = Math.abs(magnitude(x, y, z) - GRAVITY);
    }

    const now = Number.isFinite(event.timeStamp) && event.timeStamp > 0
      ? event.timeStamp
      : performance.now();
    const crossed = dynamicMagnitude >= STEP_THRESHOLD;

    if (crossed && !thresholdCrossed && now - lastStepAt >= MIN_STEP_INTERVAL_MS) {
      lastStepAt = now;
      totalSteps += 1;
      thresholdCrossed = true;
      emit(true);
      return;
    }

    if (dynamicMagnitude < STEP_THRESHOLD * 0.8) {
      thresholdCrossed = false;
    }
  };

  const requestPermission = async (eventConstructor: PermissionEvent | undefined): Promise<void> => {
    if (!eventConstructor?.requestPermission) {
      return;
    }

    const permission = await eventConstructor.requestPermission();
    if (permission !== "granted") {
      throw new Error("センサーの利用が拒否されました。ブラウザの設定から許可してください。");
    }
  };

  const enable = async (): Promise<void> => {
    if (enabled) {
      return;
    }

    if (!("DeviceOrientationEvent" in window) || !("DeviceMotionEvent" in window)) {
      throw new Error("この端末またはブラウザはモーションセンサーに対応していません。");
    }

    try {
      await Promise.all([
        requestPermission(window.DeviceOrientationEvent as unknown as PermissionEvent | undefined),
        requestPermission(window.DeviceMotionEvent as unknown as PermissionEvent | undefined),
      ]);
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error("センサーを有効化できませんでした。ブラウザの設定を確認してください。");
    }

    window.addEventListener("deviceorientationabsolute", handleAbsoluteOrientation);
    window.addEventListener("deviceorientation", handleRelativeOrientation);
    window.addEventListener("devicemotion", handleMotion);
    enabled = true;
    emit(false);
  };

  const dispose = (): void => {
    window.removeEventListener("deviceorientationabsolute", handleAbsoluteOrientation);
    window.removeEventListener("deviceorientation", handleRelativeOrientation);
    window.removeEventListener("devicemotion", handleMotion);
    enabled = false;
  };

  return {
    enable,
    dispose,
    subscribe(listener: SensorListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot(): SensorSnapshot {
      return { heading, totalSteps, stepDetected: false };
    },
    isEnabled(): boolean {
      return enabled;
    },
  };
}
