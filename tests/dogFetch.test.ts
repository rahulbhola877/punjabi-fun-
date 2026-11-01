import { describe, expect, it } from "vitest";
import { NullEngine, Scene, TransformNode, Vector3 } from "../src/babylon";
import type { Animal } from "../src/animals/Animals";
import { DogFetch, findFetchTarget } from "../src/animals/DogFetch";
import { HOME } from "../src/world/home";
import { isOpenGround } from "../src/world/layout";

describe("Sheru's fetch", () => {
  it("finds an open throw along the starting-house lane and avoids blocked routes", () => {
    const p = HOME!.start, dog = { x: p.x + 2.4, z: p.z - 6 };
    expect(isOpenGround(dog.x, dog.z)).toBe(true);
    expect(findFetchTarget(p, dog, Math.PI, isOpenGround)).not.toBeNull();
    expect(findFetchTarget(p, dog, Math.PI, () => false)).toBeNull();
    expect(findFetchTarget(p, dog, Math.PI, () => true, () => false)).toBeNull();
  });
  it("throws, lets the dog collect the ball and returns it to the player", () => {
    const engine = new NullEngine(), scene = new Scene(engine), messages: string[] = [];
    const dog = { state: "stand", t: 0, pos: new Vector3(0, 0, 1), goal: new Vector3(), vel: new Vector3(), facing: 0, root: new TransformNode("dog", scene) } as Animal;
    const fetch = new DogFetch(dog, scene, (s) => messages.push(s), () => {}), player = new Vector3(0, 0, 0);
    expect(fetch.start(player, 0, () => true)).toBe(true);
    expect(fetch.start(player, 0, () => true)).toBe(false);
    fetch.update(1, player, false);
    expect(dog.state).toBe("play"); expect(dog.goal.z).toBe(8);
    dog.pos.copyFrom(dog.goal); fetch.update(0.1, player, false);
    expect(dog.goal.z).toBe(0); expect(fetch.active).toBe(true);
    dog.pos.set(0, 0, 1); fetch.update(0.1, player, false);
    expect(fetch.active).toBe(false); expect(dog.state).toBe("stand"); expect(fetch.snapshot().completed).toBe(1);
    expect(messages.at(-1)).toContain("Good dog");
    scene.dispose(); engine.dispose();
  });
  it("lets the dog avoid traffic without forcing it back into the road", () => {
    const engine = new NullEngine(), scene = new Scene(engine), messages: string[] = [];
    const dog = { state: "stand", t: 0, pos: new Vector3(0, 0, 1), goal: new Vector3(), vel: new Vector3(), facing: 0, root: new TransformNode("dog", scene) } as Animal;
    const fetch = new DogFetch(dog, scene, (s) => messages.push(s), () => {}), player = new Vector3();
    fetch.start(player, 0, () => true); fetch.update(1, player, false);
    dog.state = "flee"; fetch.update(0.1, player, false);
    expect(fetch.active).toBe(false); expect(dog.state).toBe("flee"); expect(fetch.snapshot().completed).toBe(0);
    expect(messages.at(-1)).toContain("out of the way");
    scene.dispose(); engine.dispose();
  });
});
