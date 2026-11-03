import { describe, expect, it } from "vitest";
import { Game } from "../src/app/Game";
import type { Vehicle } from "../src/vehicles/Vehicle";

const v = (id: string) => ({ id } as Vehicle);

describe("police post saved vehicle ownership", () => {
  it("keeps legacy and acquired vehicles, but omits newly generated ambient vehicles", () => {
    const game = Object.create(Game.prototype) as any;
    game.ownedPostVehicleIds = new Set(["nakaGtEast_jeep28"]);
    expect(game.isPersistentVehicle(v("nakaGtEast_jeep28"))).toBe(true);
    expect(game.isPersistentVehicle(v("nakaGtEast_bike4"))).toBe(false);
    expect(game.isPersistentVehicle(v("bullet_ghar"))).toBe(true);
    expect(game.isPersistentVehicle(v("traffic_1"))).toBe(false);
  });
  it("finds a saved post slot despite a different wake-order suffix, without crossing post or type", () => {
    const game = Object.create(Game.prototype) as any;
    const jeep = v("nakaGtEast_jeep28"), bike = v("nakaGtEast_bike29"), other = v("nakaGtWest_jeep3");
    game.vehicles = [other, bike, jeep];
    game.ownedPostVehicleIds = new Set(game.vehicles.map((x: Vehicle) => x.id));
    expect(game.findOwnedPostVehicle("nakaGtEast_jeep3")).toBe(jeep);
    expect(game.findOwnedPostVehicle("nakaGtEast_bike4")).toBe(bike);
    expect(game.findOwnedPostVehicle("nakaKotli_jeep3")).toBeUndefined();
  });
});
