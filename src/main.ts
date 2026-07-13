import "./style.css";
import { createDebugPanel, type DebugState } from "./debug";
import { calculateDrift } from "./drift";
import { createPlayer } from "./player";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

let isRunning = false;
let startTime = 0;
let animationId: number | null = null;
let hasShownArrival = false;
let debugState: DebugState = {
  direction: 0,
  distance: 3,
};

const shell = document.createElement("main");
shell.className = "app-shell";

const header = document.createElement("header");
header.className = "app-header";

const title = document.createElement("h1");
title.textContent = "クネクネ離脱システム";

const toggleButton = document.createElement("button");
toggleButton.type = "button";
toggleButton.className = "start-button";
toggleButton.textContent = "クネクネ離脱 開始";

header.append(title, toggleButton);

const player = createPlayer();

const overlay = document.createElement("div");
overlay.className = "arrival-overlay";
overlay.textContent = "とうちゃく!🛁";
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

shell.append(header, player.element, overlay, debugPanel.element);
app.append(shell);

toggleButton.addEventListener("click", () => {
  isRunning = !isRunning;
  toggleButton.textContent = isRunning ? "クネクネ離脱 停止" : "クネクネ離脱 開始";
  toggleButton.classList.toggle("start-button--active", isRunning);

  if (isRunning) {
    startTime = performance.now();
    hasShownArrival = false;
    overlay.hidden = true;
    startLoop();
    return;
  }

  stopLoop();
  resetPlayerTransform();
});

function startLoop(): void {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }

  const tick = (now: number) => {
    const elapsed = (now - startTime) / 1000;
    const drift = calculateDrift({
      direction: debugState.direction,
      distance: debugState.distance,
      elapsed,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });

    if (drift.arrived) {
      resetPlayerTransform();
      showArrival();
    } else {
      player.transformTarget.style.transform = `translate3d(${drift.offsetX}px, ${drift.offsetY}px, 0) rotate(${drift.rotation}deg)`;
    }

    if (isRunning) {
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
}

function resetPlayerTransform(): void {
  player.transformTarget.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
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
