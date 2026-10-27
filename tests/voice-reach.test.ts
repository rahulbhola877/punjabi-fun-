import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import MAP from "../src/audio/voiceMap.json";

// A recorded line can only play when the game says its moment. A moment that
// is named on the sheet but never said in the code leaves its lines silent
// for good, and nothing else fails. VoiceDirector.ts lists every moment as a
// type, so it does not count as the game saying one.
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sourceFiles(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

describe("recorded lines can play", () => {
  it("every moment on an enabled line is said somewhere in the game", () => {
    const root = fileURLToPath(new URL("../src", import.meta.url));
    const code = sourceFiles(root)
      .filter((f) => !f.endsWith(path.join("audio", "VoiceDirector.ts")))
      .map((f) => fs.readFileSync(f, "utf8"))
      .join("\n");
    const moments = new Map<string, string[]>();
    for (const [clip, row] of Object.entries(MAP as Record<string, { on: boolean; when: string[] }>)) {
      if (!row.on) continue;
      for (const w of row.when) moments.set(w, [...(moments.get(w) ?? []), clip]);
    }
    const silent = [...moments]
      .filter(([w]) => !code.includes(`"${w}"`) && !code.includes(`'${w}'`) && !code.includes(`\`${w}\``))
      .map(([w, clips]) => `${w} (${clips.join(", ")})`);
    expect(silent).toEqual([]);
  });
});
