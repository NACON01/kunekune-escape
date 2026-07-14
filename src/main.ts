import "./style.css";
import { createDebugPanel, type DebugState } from "./debug";
import {
  consumeRouteStep,
  createGuidance,
  getRelativeDirection,
  loadRoute,
  RouteRecorder,
  saveRoute,
  type Route,
  type RouteGuidanceState,
} from "./route";
import { calculateDrift, createDriftV2 } from "./drift";
import { createPlayer } from "./player";
import { createSensorController, type SensorSnapshot } from "./sensors";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("App root not found");
}

type Mode = "pseudo" | "sensor";

let mode: Mode = "pseudo";
let pseudoRunning = false;
let sensorRunning = false;
let isRecording = false;
let animationId: number | null = null;
let lastFrameAt: number | null = null;
let hasShownArrival = false;
let pseudoElapsed = 0;
let pendingStep = false;
let debugState: DebugState = { direction: 0, distance: 3 };
let sensorSnapshot: SensorSnapshot = { heading: null, totalSteps: 0, stepDetected: false };
let recorder: RouteRecorder | null = null;
let savedRoute: Route | null = loadRoute();
let guidance: RouteGuidanceState | null = null;

const sensorController = createSensorController();
const driftEngine = createDriftV2();

const shell = document.createElement("main");
shell.className = "app-shell";

const header = document.createElement("header");
header.className = "app-header";

const title = document.createElement("h1");
title.textContent = "クネクネ離脱システム";

const modeTabs = document.createElement("div");
modeTabs.className = "mode-tabs";
const pseudoTab = createModeTab("擬似モード", "pseudo");
const sensorTab = createModeTab("センサーモード", "sensor");
modeTabs.append(pseudoTab, sensorTab);

const toggleButton = document.createElement("button");
toggleButton.type = "button";
toggleButton.className = "start-button";
toggleButton.textContent = "擬似離脱 開始";

header.append(title, modeTabs, toggleButton);

const player = createPlayer();

const overlay = document.createElement("div");
overlay.className = "arrival-overlay";
overlay.textContent = "到着！🎉";
overlay.hidden = true;

const debugPanel = createDebugPanel({
  initialDirection: debugState.direction,
  initialDistance: debugState.distance,
  onChange: (state) => {
    debugState = state;
    if (state.distance >= 0.8) {
      hasShownArrival = false;
      overlay.hidden = true;
    }
  },
});

const sensorPanel = createSensorPanel();
shell.append(header, player.element, sensorPanel.element, overlay, debugPanel.element);
app.append(shell);
setMode(mode);
updateSavedRouteText();

sensorController.subscribe((snapshot) => {
  sensorSnapshot = snapshot;
  if (snapshot.stepDetected && isRecording && recorder && snapshot.heading !== null) {
    recorder.recordStep(snapshot.heading);
    sensorPanel.updateRouteProgress();
  }

  if (snapshot.stepDetected && sensorRunning) {
    pendingStep = true;
    if (guidance && savedRoute) {
      guidance = consumeRouteStep(savedRoute, guidance);
      sensorPanel.updateRouteProgress();
      if (guidance.arrived) {
        sensorRunning = false;
      }
    }
  }

  debugPanel.setSensorReadings(
    snapshot.heading,
    snapshot.totalSteps,
    recorder?.segments.length ?? savedRoute?.segments.length ?? 0,
    sensorPanel.error.textContent ?? "",
  );
});

toggleButton.addEventListener("click", () => {
  pseudoRunning = !pseudoRunning;
  toggleButton.textContent = pseudoRunning ? "擬似離脱 停止" : "擬似離脱 開始";
  toggleButton.classList.toggle("start-button--active", pseudoRunning);

  if (pseudoRunning) {
    pseudoElapsed = 0;
    hasShownArrival = false;
    overlay.hidden = true;
    startPseudoLoop();
  } else {
    stopLoop();
    resetPlayerTransform();
  }
});

function createModeTab(label: string, tabMode: Mode): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mode-tab";
  button.textContent = label;
  button.addEventListener("click", () => setMode(tabMode));
  return button;
}

function setMode(nextMode: Mode): void {
  mode = nextMode;
  pseudoTab.classList.toggle("mode-tab--active", mode === "pseudo");
  sensorTab.classList.toggle("mode-tab--active", mode === "sensor");
  sensorPanel.element.hidden = mode !== "sensor";
  toggleButton.hidden = mode !== "pseudo";
  debugPanel.setMode(mode);
  stopLoop();
  pseudoRunning = false;
  sensorRunning = false;
  isRecording = false;
  pendingStep = false;
  guidance = null;
  toggleButton.classList.remove("start-button--active");
  toggleButton.textContent = "擬似離脱 開始";
  resetPlayerTransform();
}

function createSensorPanel() {
  const panel = document.createElement("section");
  panel.className = "sensor-panel";
  panel.hidden = true;

  const heading = document.createElement("h2");
  heading.textContent = "センサーモード";
  const instructions = document.createElement("p");
  instructions.className = "sensor-instructions";
  instructions.textContent = "センサーを有効化してから、クネクネ地点で経路を記録してください。";

  const controls = document.createElement("div");
  controls.className = "sensor-controls";

  const enableButton = document.createElement("button");
  enableButton.type = "button";
  enableButton.className = "secondary-button";
  enableButton.textContent = "センサーを有効化";

  const recordButton = document.createElement("button");
  recordButton.type = "button";
  recordButton.className = "secondary-button";
  recordButton.textContent = "経路の記録開始";

  const finishButton = document.createElement("button");
  finishButton.type = "button";
  finishButton.className = "secondary-button";
  finishButton.textContent = "ここが目的地";
  finishButton.disabled = true;

  const startButton = document.createElement("button");
  startButton.type = "button";
  startButton.className = "start-button sensor-start-button";
  startButton.textContent = "クネクネ離脱 開始";

  const savedButton = document.createElement("button");
  savedButton.type = "button";
  savedButton.className = "secondary-button";
  savedButton.textContent = "前回の経路で開始";
  savedButton.hidden = !savedRoute;

  const status = document.createElement("p");
  status.className = "sensor-status";
  const error = document.createElement("p");
  error.className = "sensor-error";

  controls.append(enableButton, recordButton, finishButton, startButton, savedButton);
  panel.append(heading, instructions, controls, status, error);

  enableButton.addEventListener("click", async () => {
    enableButton.disabled = true;
    error.textContent = "";
    try {
      await sensorController.enable();
      enableButton.textContent = "センサー有効化済み";
      status.textContent = "方位・歩数の取得を開始しました。";
    } catch (reason) {
      enableButton.disabled = false;
      error.textContent = reason instanceof Error
        ? reason.message
        : "センサーを有効化できませんでした。ブラウザの設定を確認してください。";
    }
  });

  recordButton.addEventListener("click", () => {
    if (!sensorController.isEnabled()) {
      error.textContent = "先に「センサーを有効化」を押してください。";
      return;
    }
    recorder = new RouteRecorder();
    isRecording = true;
    savedRoute = null;
    recordButton.disabled = true;
    finishButton.disabled = false;
    status.textContent = "記録中：0歩・0区間。目的地まで歩いてください。";
    sensorPanel.updateRouteProgress();
  });

  finishButton.addEventListener("click", () => {
    if (!recorder || recorder.stepCount === 0) {
      error.textContent = "歩数がまだ記録されていません。目的地まで歩いてください。";
      return;
    }
    isRecording = false;
    savedRoute = recorder.finish();
    saveRoute(savedRoute);
    recordButton.disabled = false;
    finishButton.disabled = true;
    savedButton.hidden = false;
    status.textContent = `経路を保存しました（${savedRoute.totalSteps}歩・${savedRoute.segments.length}区間）。`;
    sensorPanel.updateRouteProgress();
  });

  startButton.addEventListener("click", () => {
    startSensorGuidance();
  });

  savedButton.addEventListener("click", () => {
    savedRoute = loadRoute();
    if (savedRoute) {
      status.textContent = `前回の経路を読み込みました（${savedRoute.totalSteps}歩・${savedRoute.segments.length}区間）。`;
      sensorPanel.updateRouteProgress();
    }
  });

  return { element: panel, error, status, startButton, updateRouteProgress };

  function updateRouteProgress(): void {
    if (isRecording && recorder) {
      status.textContent = `記録中：${recorder.stepCount}歩・${recorder.segments.length}区間。`;
    }
  }
}

function startSensorGuidance(): void {
  if (sensorRunning) {
    sensorRunning = false;
    stopLoop();
    resetPlayerTransform();
    sensorPanel.startButton.textContent = "クネクネ離脱 開始";
    return;
  }
  if (!sensorController.isEnabled()) {
    sensorPanel.error.textContent = "先に「センサーを有効化」を押してください。";
    return;
  }
  if (!savedRoute) {
    sensorPanel.error.textContent = "先に経路を記録して「ここが目的地」を押してください。";
    return;
  }

  stopLoop();
  guidance = createGuidance(savedRoute);
  pendingStep = false;
  sensorRunning = true;
  hasShownArrival = false;
  overlay.hidden = true;
  sensorPanel.startButton.textContent = "クネクネ離脱 停止";
  driftEngine.reset(getRelativeDirection(sensorSnapshot.heading ?? 0, guidance.targetHeading ?? 0));
  startSensorLoop();
}

function startPseudoLoop(): void {
  stopLoop();
  lastFrameAt = performance.now();
  const tick = (now: number) => {
    const elapsed = (now - (lastFrameAt ?? now)) / 1000;
    lastFrameAt = now;
    pseudoElapsed += elapsed;
    const drift = calculatePseudoDrift();
    if (drift.arrived) {
      resetPlayerTransform();
      showArrival();
    } else {
      applyTransform(drift.offsetX, drift.offsetY, drift.rotation);
    }
    if (pseudoRunning) {
      animationId = requestAnimationFrame(tick);
    }
  };
  animationId = requestAnimationFrame(tick);
}

function calculatePseudoDrift() {
  return calculateDrift({
    direction: debugState.direction,
    distance: debugState.distance,
    elapsed: pseudoElapsed,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  });
}

function startSensorLoop(): void {
  stopLoop();
  lastFrameAt = performance.now();
  const tick = (now: number) => {
    const deltaSeconds = (now - (lastFrameAt ?? now)) / 1000;
    lastFrameAt = now;
    const targetHeading = guidance?.targetHeading ?? sensorSnapshot.heading ?? 0;
    const currentHeading = sensorSnapshot.heading ?? 0;
    const bounds = player.transformTarget.getBoundingClientRect();
    const drift = driftEngine.update({
      relativeAngle: getRelativeDirection(currentHeading, targetHeading),
      deltaSeconds,
      stepDetected: pendingStep,
      arrived: guidance?.arrived ?? false,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      contentWidth: bounds.width,
      contentHeight: bounds.height,
    });
    pendingStep = false;
    applyTransform(drift.offsetX, drift.offsetY, drift.rotation);

    if (drift.arrived) {
      showArrival();
      sensorRunning = false;
      sensorPanel.startButton.textContent = "クネクネ離脱 開始";
    } else if (sensorRunning) {
      animationId = requestAnimationFrame(tick);
    }
  };
  animationId = requestAnimationFrame(tick);
}

function stopLoop(): void {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  lastFrameAt = null;
}

function applyTransform(offsetX: number, offsetY: number, rotation: 0 | 180): void {
  player.transformTarget.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) rotate(${rotation}deg)`;
}

function resetPlayerTransform(): void {
  player.transformTarget.dataset.pseudoOffset = "0";
  applyTransform(0, 0, 0);
}

function showArrival(): void {
  if (hasShownArrival) {
    return;
  }

  hasShownArrival = true;
  overlay.hidden = false;
  if ("vibrate" in navigator) {
    navigator.vibrate(200);
  }
  window.setTimeout(() => {
    overlay.hidden = true;
  }, 1800);
}

function updateSavedRouteText(): void {
  if (savedRoute) {
    sensorPanel.status.textContent = `保存済み経路：${savedRoute.totalSteps}歩・${savedRoute.segments.length}区間。`;
  }
}
