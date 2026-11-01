import { describe, expect, it } from "vitest";
import { JAPAN_LINES, japanConversation, japanParkConversation } from "../src/alternate/japanMap";
import { CHINA_LINES, chinaConversation } from "../src/alternate/chinaMap";
import { caption } from "../src/alternate/regionalDialogue";

describe("country dialogue identity", () => {
  it("pairs every native spoken take with an English subtitle and unique locale-scoped ID", () => {
    const lines = [...Object.values(JAPAN_LINES), ...Object.values(CHINA_LINES)];
    expect(new Set(lines.map(l => l.id)).size).toBe(lines.length);
    for (const line of lines) {
      expect(line.id.startsWith(line.locale === "ja-JP" ? "ja." : "zh.")).toBe(true);
      expect(line.text).toMatch(/[\u3040-\u30ff\u3400-\u9fff]/);
      expect(line.text).not.toMatch(/[\u0a00-\u0a7f]/);
      expect(line.translation).toMatch(/[a-z]/i);
      expect(caption(line)).toContain(line.text);
      expect(caption(line)).toContain(line.translation);
    }
  });

  it("keeps a dialogue's displayed words bound to its exact spoken take through story transitions", () => {
    for (let stage = 0; stage <= 4; stage++) {
      for (const person of ["shopkeeper", "resident", "neighbor"] as const) {
        const r = japanConversation(stage, person);
        expect(r.line.locale).toBe("ja-JP");
        expect(r.text).toBe(caption(r.line));
      }
      const park = japanParkConversation(stage);
      expect(park.line.locale).toBe("ja-JP");
      expect(park.text).toBe(caption(park.line));
      for (const person of ["host", "artisan", "musician", "keeper"] as const) {
        const r = chinaConversation(stage, person);
        expect(r.line.locale).toBe("zh-CN");
        expect(r.text).toBe(caption(r.line));
      }
    }
  });
});
