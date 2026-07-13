export type VideoKind = "watch" | "shorts";

export type ParsedYouTubeUrl = {
  id: string;
  kind: VideoKind;
};

const DEFAULT_VIDEO_ID = "dQw4w9WgXcQ";

export function parseYouTubeUrl(rawUrl: string): ParsedYouTubeUrl | null {
  let url: URL;

  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const hostname = url.hostname.replace(/^www\./, "");

  if (hostname === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? { id, kind: "watch" } : null;
  }

  if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    const pathParts = url.pathname.split("/").filter(Boolean);

    if (pathParts[0] === "watch") {
      const id = url.searchParams.get("v");
      return id ? { id, kind: "watch" } : null;
    }

    if (pathParts[0] === "shorts" && pathParts[1]) {
      return { id: pathParts[1], kind: "shorts" };
    }
  }

  return null;
}

export function createEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?playsinline=1`;
}

export function createPlayer() {
  const section = document.createElement("section");
  section.className = "player-section";

  const form = document.createElement("form");
  form.className = "url-form";

  const input = document.createElement("input");
  input.type = "url";
  input.inputMode = "url";
  input.autocomplete = "off";
  input.placeholder = "YouTube URL";
  input.value = `https://www.youtube.com/watch?v=${DEFAULT_VIDEO_ID}`;
  input.setAttribute("aria-label", "YouTube URL");

  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "読み込み";

  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("role", "alert");

  const frameWrap = document.createElement("div");
  frameWrap.className = "player-wrap player-wrap--landscape";

  const frame = document.createElement("iframe");
  frame.title = "YouTube動画";
  frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  frame.allowFullscreen = true;
  frame.src = createEmbedUrl(DEFAULT_VIDEO_ID);
  frameWrap.append(frame);

  const loadVideo = (rawUrl: string): boolean => {
    const parsed = parseYouTubeUrl(rawUrl);
    if (!parsed) {
      error.textContent = "対応しているYouTube URLを入力してください";
      return false;
    }

    error.textContent = "";
    frame.src = createEmbedUrl(parsed.id);
    frameWrap.classList.toggle("player-wrap--shorts", parsed.kind === "shorts");
    frameWrap.classList.toggle("player-wrap--landscape", parsed.kind !== "shorts");
    return true;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    loadVideo(input.value);
  });

  form.append(input, button);
  section.append(form, error, frameWrap);

  return {
    element: section,
    transformTarget: frameWrap,
    loadVideo,
  };
}
