import { describe, expect, it } from "vitest";
import { CLIP_DEFS, bakeClips } from "../src/kit/animations";
import { ARCHETYPES, BODIES, buildRig } from "../src/kit/rig";

/** Every clip (the kit's and the game's own: jog, swim, seated gestures...) bakes for every body. */
describe("kit clips", () => {
  it.each([...ARCHETYPES])("all bake for %s", (a) => {
    const clips = bakeClips(buildRig(BODIES[a]));
    expect(clips.map((c) => c.name)).toEqual(CLIP_DEFS.map((d) => d.name));
    for (const c of clips) for (const t of c.tracks) expect(Array.from(t.values).every(Number.isFinite), `${a} ${c.name} ${t.name}`).toBe(true);
  });
});
