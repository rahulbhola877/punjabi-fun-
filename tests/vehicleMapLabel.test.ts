import { expect, it } from "vitest";
import { Vector3 } from "../src/babylon";
import { Game } from "../src/app/Game";
import { newSave } from "../src/save/schema";

it("identifies the player's Bullet separately from other motorcycles on the map", () => {
  const game = Object.create(Game.prototype) as any;
  const bullet = { id: "bullet_ghar", position: new Vector3(64, 0, -35), spec: { label: "Motorcycle" } };
  const other = { id: "motorcycle_1", position: new Vector3(9, 0, 20), spec: { label: "Motorcycle" } };
  game.save = newSave("preet", { x: 67, z: -35, yaw: 0 }, []);
  game.vehicles = [bullet, other]; game.driving = null; game.rides = { ride: null };
  game.traffic = { cars: [] }; game.buses = { runs: [] }; game.waypoint = null;
  game.currentObjective = () => ({ title: "", detail: "", target: null });
  game.isPersistentVehicle = () => true;
  const markers = game.mapMarkers().filter((m: { kind: string }) => m.kind === "vehicle");
  expect(markers).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: 64, z: -35, label: "Your Bullet" }),
    expect.objectContaining({ x: 9, z: 20, label: "Motorcycle" }),
  ]));
  game.driving = bullet;
  expect(game.mapMarkers().some((m: { label?: string }) => m.label === "Your Bullet")).toBe(false);
});
