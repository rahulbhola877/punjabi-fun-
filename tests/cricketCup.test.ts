import { describe, expect, it, vi } from "vitest";
import { NullEngine, Scene, StandardMaterial, Vector3 } from "../src/babylon";
import { CricketGame, fieldingCatch, ruleShot, type CricketHost, type CricketResult } from "../src/minigames/Cricket";
function setup() {
  const engine = new NullEngine(), scene = new Scene(engine), mat = new StandardMaterial("test", scene);
  let aim = 0;
  const host = { scene, mats: { get: () => mat }, crowd: { spawn: () => ({ anim: { play: vi.fn() } }), remove: vi.fn() }, playerPos: () => Vector3.Zero(), placePlayer: vi.fn(), aim: () => aim, bat: vi.fn(), swing: vi.fn(), toast: vi.fn(), say: vi.fn(), sting: vi.fn(), results: vi.fn(async () => "ok"), reward: vi.fn(), hud: vi.fn(), setFlag: vi.fn(), persist: vi.fn() } as unknown as CricketHost;
  const game = new CricketGame(host);
  return { game, host, aim: (v: number) => { aim = v; }, dispose: () => { game.dispose(); scene.dispose(); engine.dispose(); } };
}
function miss(game: CricketGame) { game.update(1.5); game.update(2); game.update(2.3); }
describe("cup cricket input and cancellation", () => {
  it("keeps rule differences and rejects incorrect interception timing/lane", () => {
    expect(ruleShot({kind:"six",runs:6},"ground")).toEqual({kind:"two",runs:2});
    expect(ruleShot({kind:"six",runs:6},"open")).toEqual({kind:"six",runs:6});
    expect(fieldingCatch(3,3,1.7)).toBe(true); expect(fieldingCatch(0,3,1.7)).toBe(false); expect(fieldingCatch(3,3,0.5)).toBe(false);
  });
  it("stopping and restarting invalidates delayed shot continuation and rewards", () => {
    const x = setup(); x.game.start(); x.game.update(1.5); x.game.update(2);
    x.game.stop(); x.game.start(); x.game.update(0.5);
    expect(x.game.state()).toMatchObject({ ball:0, runs:0, out:0, phase:"wait" });
    expect(x.host.reward).not.toHaveBeenCalled(); x.dispose();
  });
  it("requires lateral interception and second timed return input", () => {
    const x = setup(), done = vi.fn<(r:CricketResult)=>void>();
    x.game.start({ mode:"practice",rules:"ground",seed:2,onComplete:done });
    miss(x.game); miss(x.game);
    expect(x.game.state().phase).toBe("field");
    x.aim(1); x.game.update(0.75); x.aim(0); x.game.update(0.9); x.game.swing();
    expect(x.game.state().phase).toBe("return");
    x.game.update(0.8); x.game.swing();
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ fielded:true, won:false }));
    expect(x.host.reward).not.toHaveBeenCalled(); x.dispose();
  });
  it("an open six blocks progression until nearby ball collection", () => {
    const x = setup(), done = vi.fn(); x.game.start({mode:"practice",rules:"open",seed:2,onComplete:done});
    x.game.update(1.5); x.game.update(1.55); x.game.swing(); x.game.update(0.1);
    // No gameplay ticks while paused: pending shot stays at ball zero.
    expect(x.game.state().ball).toBe(0);
    x.game.update(2.3); expect(x.game.state().phase).toBe("recover");
    x.game.swing(); expect(x.game.state().phase).toBe("recover");
    x.aim(1); x.game.update(0.75); x.aim(0); x.game.swing();
    expect(x.game.state().phase).toBe("field");
    x.game.update(2.3);
    expect(done.mock.calls[0]![0]).toMatchObject({recovered:true,fielded:false}); x.dispose();
  });
  it("no fielding input fails recoverably and emits completion once", () => {
    const x = setup(), done = vi.fn(); x.game.start({mode:"cup",rules:"open",seed:2,onComplete:done});
    miss(x.game); miss(x.game); x.game.update(2.3); x.game.update(10); x.game.swing();
    expect(done).toHaveBeenCalledTimes(1); expect(done.mock.calls[0]![0].fielded).toBe(false); x.dispose();
  });
});
