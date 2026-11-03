import { afterEach, expect, it, vi } from "vitest";
import { Home, type HomeHost } from "../src/missions/Home";

afterEach(() => vi.useRealTimers());

it("checkpoints Simran's drink, completion and reward together exactly once", async () => {
  vi.useFakeTimers();
  const data: Record<string, number> = { day: 3, errand: 3 };
  let drinks = 1, money = 0, rep = 0;
  const checkpoints: unknown[] = [];
  const host = {
    hour: () => 12,
    data: () => data,
    bagHas: () => drinks > 0,
    bagTake: () => { drinks--; },
    reward: (m: number, r: number) => { money += m; rep += r; },
    persist: () => checkpoints.push({ home: { ...data }, drinks, money, rep }),
    crowd: { residents: [] },
  } as unknown as HomeHost;
  const home = new Home(host) as unknown as { simran(): Promise<void> };

  await home.simran();
  // A reload at this checkpoint must retain the payment, before delayed chatter.
  expect(checkpoints).toEqual([{ home: { day: 3, errand: 3, errandDone: 3 }, drinks: 0, money: 40, rep: 2 }]);
  await home.simran();
  await vi.runAllTimersAsync();
  expect({ drinks, money, rep }).toEqual({ drinks: 0, money: 40, rep: 2 });
  expect(checkpoints).toHaveLength(1);
});

it("persists Simran's accepted errand before sending the player shopping", async () => {
  const data: Record<string, number> = { day: 3 };
  const checkpoints: unknown[] = [];
  const host = {
    hour: () => 12,
    data: () => data,
    dialogue: async () => "yes",
    persist: () => checkpoints.push({ ...data }),
    toast: vi.fn(),
    crowd: { residents: [], get: () => undefined },
  } as unknown as HomeHost;
  const home = new Home(host) as unknown as { simran(): Promise<void> };

  await home.simran();
  expect(checkpoints).toEqual([{ day: 3, errand: 3 }]);
});
