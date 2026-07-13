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
  summary.textContent = "擬似モード";

  const body = document.createElement("div");
  body.className = "debug-body";

  const directionControl = createRangeControl({
    label: "方向",
    min: 0,
    max: 360,
    step: 1,
    value: state.direction,
    unit: "度",
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

  body.append(directionControl.element, distanceControl.element);
  details.append(summary, body);

  return {
    element: details,
    getState: () => state,
  };
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
