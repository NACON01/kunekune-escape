export type DebugState = {
  direction: number;
  distance: number;
};

type DebugPanelOptions = {
  initialDirection: number;
  initialDistance: number;
  onChange: (state: DebugState) => void;
};

export function createDebugPanel(options: DebugPanelOptions) {
  let state: DebugState = {
    direction: options.initialDirection,
    distance: options.initialDistance,
  };

  const details = document.createElement("details");
  details.className = "debug-panel";
  details.open = true;

  const summary = document.createElement("summary");
  summary.textContent = "デバッグパネル";

  const body = document.createElement("div");
  body.className = "debug-body";

  const pseudoBody = document.createElement("div");
  pseudoBody.className = "debug-pseudo-controls";

  const directionControl = createRangeControl({
    label: "誘導方向",
    min: 0,
    max: 360,
    step: 1,
    value: state.direction,
    unit: "°",
    onInput: (value) => {
      state = { ...state, direction: value };
      options.onChange(state);
    },
  });

  const distanceControl = createRangeControl({
    label: "残り距離",
    min: 0,
    max: 10,
    step: 0.1,
    value: state.distance,
    unit: "m",
    onInput: (value) => {
      state = { ...state, distance: value };
      options.onChange(state);
    },
  });

  pseudoBody.append(directionControl.element, distanceControl.element);

  const sensorReadout = document.createElement("div");
  sensorReadout.className = "sensor-readout";
  const headingOutput = document.createElement("output");
  const stepsOutput = document.createElement("output");
  const segmentsOutput = document.createElement("output");
  const errorOutput = document.createElement("p");
  errorOutput.className = "sensor-error";

  appendReadoutRow(sensorReadout, "現在方位", headingOutput);
  appendReadoutRow(sensorReadout, "累計歩数", stepsOutput);
  appendReadoutRow(sensorReadout, "記録区間数", segmentsOutput);
  sensorReadout.append(errorOutput);
  setSensorReadings(null, 0, 0, "");

  body.append(pseudoBody, sensorReadout);
  details.append(summary, body);

  return {
    element: details,
    getState: () => state,
    setMode(mode: "pseudo" | "sensor"): void {
      pseudoBody.hidden = mode !== "pseudo";
    },
    setSensorReadings(heading: number | null, steps: number, segments: number, error: string): void {
      setSensorReadings(heading, steps, segments, error);
    },
  };

  function setSensorReadings(
    heading: number | null,
    steps: number,
    segments: number,
    error: string,
  ): void {
    headingOutput.textContent = heading === null ? "—" : `${heading.toFixed(1)}°`;
    stepsOutput.textContent = `${steps}歩`;
    segmentsOutput.textContent = `${segments}区間`;
    errorOutput.textContent = error;
  }
}

function appendReadoutRow(container: HTMLDivElement, label: string, output: HTMLOutputElement): void {
  const row = document.createElement("div");
  row.className = "readout-row";
  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  row.append(labelElement, output);
  container.append(row);
}

function createRangeControl(options: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
  onInput: (value: number) => void;
}) {
  const label = document.createElement("label");
  label.className = "range-control";

  const head = document.createElement("span");
  head.className = "range-head";

  const title = document.createElement("span");
  title.textContent = options.label;

  const value = document.createElement("output");
  value.textContent = formatValue(options.value, options.unit);

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step);
  input.value = String(options.value);

  input.addEventListener("input", () => {
    const nextValue = Number(input.value);
    value.textContent = formatValue(nextValue, options.unit);
    options.onInput(nextValue);
  });

  head.append(title, value);
  label.append(head, input);

  return { element: label };
}

function formatValue(value: number, unit: string): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${unit}`;
}
