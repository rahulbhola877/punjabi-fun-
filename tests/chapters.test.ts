import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterDone, finished, markDone, progress, type ChapterCtx } from "../src/missions/Chapters";

const ctx = (o: Partial<ChapterCtx> = {}): ChapterCtx => ({ introStage: 0, deliveries: 0, tiffins: 0, flags: {}, home: {}, rides: 0, dangalWins: 0, upgrades: 0, feesPaid: -1, ...o });

describe("the chapters", () => {
  it("start at the first step of chapter 1 for a new game", () => {
    const p = progress(ctx());
    expect(p.chapter?.id).toBe("ch1");
    expect(p.step?.id).toBe("bless");
    expect(p.done).toBe(0);
  });

  it("go by what the game can see, in any order", () => {
    const c = ctx({ introStage: 999, tiffins: 3 });
    expect(progress(c).step?.id).toBe("bless");
    expect(progress(c).done).toBe(2);
    c.home = { bless: 0 };
    expect(progress(c).step?.id).toBe("dinner");
    c.home = { bless: 0, meal2: 0 };
    expect(finished(c)?.id).toBe("ch1");
  });

  it("pay once: a closed chapter hands over to the next", () => {
    const c = ctx({ introStage: 999, tiffins: 5, home: { bless: 1, meal2: 1 } });
    const ch = finished(c)!;
    markDone(c.flags, ch);
    expect(chapterDone(c.flags, "ch1")).toBe(true);
    expect(finished(c)).toBeNull();
    expect(progress(c).chapter?.id).toBe("ch2");
    expect(progress(c).step?.id).toBe("chowk");
  });

  it("leave Amritsar locked, and end when the third chapter is done", () => {
    const c = ctx({ flags: { ch1_done: true, ch2_done: true, ch3_done: true } });
    expect(progress(c).chapter).toBeNull();
    expect(CHAPTERS.find((x) => x.id === "ch4")?.locked).toBe(true);
  });

  it("have the steps the plan names, each with a hint and a unique id", () => {
    for (const ch of CHAPTERS) {
      expect(new Set(ch.steps.map((s) => s.id)).size).toBe(ch.steps.length);
      for (const s of ch.steps) { expect(s.text.length).toBeGreaterThan(8); expect(s.hint.length).toBeGreaterThan(8); }
    }
    expect(CHAPTERS.filter((c) => !c.locked)).toHaveLength(3);
    expect(CHAPTERS[2]!.steps.map((s) => s.id)).toEqual(["lohri", "dangal", "cricket", "fees", "kabaddi"]);
  });
});
