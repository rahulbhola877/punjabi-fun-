import { existsSync } from "node:fs";

/** Hardware by default; SOFTWARE=1 is an explicit, labelled fallback. */
export function browserOptions() {
  const candidates = [process.env.BROWSER_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"];
  const executablePath = candidates.find(p => p && existsSync(p));
  return { ...(executablePath ? { executablePath } : {}),
    args: ["--autoplay-policy=no-user-gesture-required", ...(process.env.SOFTWARE === "1"
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : [])] };
}
